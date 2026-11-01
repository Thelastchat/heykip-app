// "What going over changes" (approved mockups). Tapping the minus number on Home opens it.
// Over today only: the days ahead carry it (a little less each day) — the month and the goal don't move.
//   Or tell Kip another way: from this month's goal saving or the safety net, so every day stays the same.
// Over the whole month: "Okay" takes it from this month's goal saving, then the safety net — never rent or bills.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Kip } from '@/components/Kip';
import { askKipDo, KipAnswer, kipProblem, TellKipBox, useTellKip, type ChangeRow } from '@/components/TellKip';
import { Glass } from '@/components/glow/Glass';
import { SaveButton, Sheet } from '@/components/profile/Sheet';
import { rich, t } from '@/lib/i18n';
import { ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { colors, fonts, inkA, themed } from '@/theme';

export type OverInfo = {
  spentToday: number;
  dailyToday: number;
  overToday: number;
  overMonth: number;
  daysAfter: number; // days left after today, until payday
  dailyAfter: number; // each of those days now
  leftAtStart: number; // left this month when today started
  leftMonth: number;
  goal: { name: string; perMonth: number; date: string | null; laterDate: string | null; laterBy: (amount: number) => string | null } | null;
  fromGoal: number;
  fromSafety: number;
  safetySaved: number;
};

type Take = { goal: number; safety: number };

export function OverSheet({
  info,
  isPlus,
  onCover,
  onClose,
}: {
  info: OverInfo;
  isPlus: boolean;
  onCover: (take: Take, forToday: boolean) => Promise<string | null>;
  onClose: (message?: string) => void;
}) {
  const month = info.overMonth > 0;
  const over = month ? info.overMonth : info.overToday;
  const b = (s: string) => <Text style={styles.b}>{s}</Text>;
  const lessEach = Math.max(0, info.dailyToday - info.dailyAfter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const perDay = (left: number) => (info.daysAfter > 0 ? Math.max(0, Math.round(left / info.daysAfter / 10) * 10) : 0);

  async function apply(take: Take) {
    if (take.goal + take.safety <= 0) return onClose();
    setBusy(true);
    const err = await onCover(take, !month);
    setBusy(false);
    if (err) return setError(err);
    onClose(t('Covered ✓ — your days stay the same'));
  }

  // ---- Tell Kip: "take it from Japan", "half from the safety net"… ----
  const tell = useTellKip<Take>(async (text) => {
    const r = await askKipDo<{ days?: number; goal?: number; safety?: number }>('over', text, {
      over,
      goal_name: info.goal?.name ?? null,
      goal_saving: info.goal?.perMonth ?? 0,
      safety_saved: info.safetySaved,
      days_left: info.daysAfter,
      whole_month_over: month,
    });
    if (!r.ok) return { error: kipProblem(r.reason) };
    if (!r.out.ok) return { reply: r.out.reply, plan: null, rows: null };
    const goal = Math.max(0, Math.min(Math.round(r.out.goal ?? 0), info.goal?.perMonth ?? 0));
    const safety = Math.max(0, Math.min(Math.round(r.out.safety ?? 0), info.safetySaved));
    const rows: ChangeRow[] = [];
    if (goal > 0 && info.goal) {
      rows.push({
        icon: 'plane',
        title: t('{goal} saving this month', { goal: info.goal.name }),
        sub: t('{amount} goes to today', { amount: baht(goal) }),
        from: baht(info.goal.perMonth),
        to: baht(info.goal.perMonth - goal),
        warn: true,
      });
      const later = info.goal.laterBy(goal);
      if (info.goal.date)
        rows.push({
          icon: null,
          title: t('{goal} arrives', { goal: info.goal.name }),
          sub: later ? t('Unless you save {amount} more later', { amount: baht(goal) }) : t('About the same'),
          from: later ? info.goal.date : undefined,
          to: later ?? `${info.goal.date} ✓`,
          warn: !!later,
        });
    }
    if (safety > 0)
      rows.push({ icon: 'shield', title: t('Safety net'), sub: t('{amount} goes to today', { amount: baht(safety) }), from: baht(info.safetySaved), to: baht(info.safetySaved - safety), warn: true });
    if (info.daysAfter > 0) {
      const after = perDay(info.leftMonth + goal + safety);
      rows.push({
        icon: 'bowl',
        title: t('Each day until payday'),
        sub: t('Next {n} days', { n: info.daysAfter }),
        from: after !== info.dailyToday ? baht(info.dailyToday) : undefined,
        to: after === info.dailyToday ? `${baht(after)} ✓` : baht(after),
        warn: after < info.dailyToday,
      });
    }
    return { reply: r.out.reply, plan: { goal, safety }, rows };
  });

  return (
    <>
      <Sheet
        open
        onClose={() => onClose()}
        title={month ? t('{amount} over this month', { amount: baht(info.overMonth) }) : t('{amount} over today', { amount: baht(info.overToday) })}
        sub={
          tell.answer
            ? undefined
            : month
              ? info.daysAfter > 0
                ? t('Spending money for this month is used up · {n} days to payday', { n: info.daysAfter })
                : t('Spending money for this month is used up')
              : t('You spent {spent} · today’s money was {daily}', { spent: baht(info.spentToday), daily: baht(info.dailyToday) })
        }>
        {tell.answer ? (
          <KipAnswer said={tell.answer.said} reply={tell.answer.reply} rows={tell.answer.rows} doing={busy} onDo={() => tell.answer?.plan && apply(tell.answer.plan)} onBack={tell.clear} />
        ) : (
          <>
            <View style={styles.kipRow}>
              <Kip mood="careful" size={58} />
              <Glass radius={22} style={{ flex: 1 }} innerStyle={styles.bub}>
                <Text style={styles.say}>
                  {month
                    ? info.goal && info.fromGoal > 0
                      ? rich('This comes out of **this month’s {goal} saving**, so rent and bills are safe. Until payday, try to spend only on must-haves.', { goal: info.goal.name }, b)
                      : rich('This comes out of **your safety net**, so rent and bills are safe. Until payday, try to spend only on must-haves.', undefined, b)
                    : info.daysAfter > 0
                      ? rich('No stress — I took it from the days ahead, **about {amount} less each day**. Your month and your goal don’t move.', { amount: baht(lessEach) }, b)
                      : rich('No stress — payday is tomorrow, and **your month still has room** for it.', undefined, b)}
                </Text>
              </Glass>
            </View>

            <Glass radius={24} innerStyle={{ paddingHorizontal: 16 }}>
              {month ? (
                <>
                  {info.goal && info.fromGoal > 0 && (
                    <Change
                      icon="plane"
                      title={t('{goal} saving this month', { goal: info.goal.name })}
                      sub={t('{amount} went to spending', { amount: baht(info.fromGoal) })}
                      from={baht(info.goal.perMonth)}
                      to={baht(info.goal.perMonth - info.fromGoal)}
                      warn
                    />
                  )}
                  {info.goal?.date && info.goal.laterDate && info.goal.laterDate !== info.goal.date && (
                    <Change
                      icon="plane"
                      title={t('{goal} arrives', { goal: info.goal.name })}
                      sub={t('Unless you save {amount} more later', { amount: baht(info.fromGoal) })}
                      from={info.goal.date}
                      to={info.goal.laterDate}
                      warn
                      line
                    />
                  )}
                  {info.fromSafety > 0 && (
                    <Change
                      icon="shield"
                      title={t('Safety net')}
                      sub={t('{amount} went to spending', { amount: baht(info.fromSafety) })}
                      from={baht(info.safetySaved)}
                      to={baht(info.safetySaved - info.fromSafety)}
                      warn
                      line
                    />
                  )}
                  {info.daysAfter > 0 && <Change icon="bowl" title={t('Each day until payday')} sub={t('Next {n} days', { n: info.daysAfter })} from={baht(info.dailyToday)} to={baht(0)} warn line />}
                </>
              ) : (
                <>
                  {info.daysAfter > 0 && (
                    <Change
                      icon="bowl"
                      title={t('Each day until payday')}
                      sub={t('Next {n} days', { n: info.daysAfter })}
                      from={baht(info.dailyToday)}
                      to={baht(info.dailyAfter)}
                      warn={info.dailyAfter < info.dailyToday}
                    />
                  )}
                  <Change icon="income" title={t('Left this month')} sub={t('Already counted')} from={baht(info.leftAtStart)} to={baht(info.leftMonth)} line={info.daysAfter > 0} />
                  {info.goal && (
                    <Change
                      icon="plane"
                      title={info.goal.name}
                      sub={t('Still saving {amount} this month', { amount: baht(info.goal.perMonth) })}
                      to={info.goal.date ? `${info.goal.date} ✓` : '✓'}
                      line
                    />
                  )}
                </>
              )}
            </Glass>

            {isPlus && (info.goal?.perMonth || info.safetySaved > 0) ? (
              <TellKipBox
                placeholder={info.goal ? t('Or tell Kip… “take it from {goal}”', { goal: info.goal.name }) : t('Or tell Kip… “take it from the safety net”')}
                onAsk={tell.ask}
                disabled={tell.busy}
              />
            ) : null}

            {month && info.fromGoal + info.fromSafety > 0 ? (
              <SaveButton
                label={busy ? t('Saving…') : info.fromGoal > 0 && info.goal ? t('Okay — take it from {goal}', { goal: info.goal.name }) : t('Okay — take it from the safety net')}
                disabled={busy}
                onPress={() => apply({ goal: info.fromGoal, safety: info.fromSafety })}
              />
            ) : (
              <SaveButton label={t('Got it')} onPress={() => onClose()} />
            )}
            <Text
              style={styles.link}
              onPress={() => {
                onClose();
                router.push(month ? '/month' : '/history');
              }}
              accessibilityRole="link">
              {month ? t('Change my plan instead') : t('See what I spent today')}
            </Text>
          </>
        )}
        {error && <Text style={[styles.link, { color: colors.orangeText, textDecorationLine: 'none' }]}>{error}</Text>}
      </Sheet>
      {tell.consentSheet}
    </>
  );
}

function Change({ icon, title, sub, from, to, warn, line }: { icon: Icon3D; title: string; sub: string; from?: string; to: string; warn?: boolean; line?: boolean }) {
  return (
    <View style={[styles.row, line && styles.line]}>
      <Image source={ICON3D[icon]} style={{ width: 38, height: 38 }} contentFit="contain" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        {from ? <Text style={styles.from}>{from}</Text> : null}
        <Text style={[styles.to, warn && { color: colors.orangeText }]}>{to}</Text>
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    kipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    bub: { padding: 12, paddingHorizontal: 14, borderTopLeftRadius: 6 },
    say: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
    b: { fontFamily: fonts.semibold },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.07) },
    title: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
    from: { fontFamily: fonts.regular, fontSize: 13, color: colors.faint, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
    to: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
    link: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', textDecorationLine: 'underline', paddingVertical: 4 },
  }),
);
