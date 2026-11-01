// After money comes in — typed with "Got paid", from a slip, or told to Kip (approved mockups):
// · Usual pay: "This month's pay is in ✓". The plan already runs on it, so nothing changes — except the saving,
//   which moves to the goal and safety net once per pay cycle (by itself with Payday auto-move, or one tap).
// · Extra money: pick its job — a goal, the safety net, or spending — or tell Kip in your own words (Plus).
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Kip } from '@/components/Kip';
import { askKipDo, KipAnswer, kipProblem, TellKipBox, TellKipPlus, useTellKip, type ChangeRow } from '@/components/TellKip';
import { soonerText } from '@/components/goals/PutMoneySheet';
import { Glass } from '@/components/glow/Glass';
import { SaveButton, Sheet } from '@/components/profile/Sheet';
import { useAuth } from '@/lib/auth';
import { CATEGORY, type CatKey } from '@/lib/budget';
import { monthNumbers, period, useHome, type HomeGoal } from '@/lib/home';
import { rich, t } from '@/lib/i18n';
import { CAT_ICON3D, goalIcon3D, ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { checkParts, fromKind, giveJob, moveSaving, savingMoved, savingThisCycle, splitIn, type MoneyIn, type Part } from '@/lib/moneyin';
import { useMonth } from '@/lib/month';
import { shortName } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme';

type Choice = { key: string; icon: Icon3D; title: string; sub: string; parts: Part[]; button: string };

const goalName = (g: HomeGoal) => (g.kind === 'monthly' ? g.title : shortName(g.title, g.kind as never));

export function MoneyInSheet({ items, onClose }: { items: MoneyIn[]; onClose: (message?: string) => void }) {
  const { profile, session, refreshProfile } = useAuth();
  const { month, save } = useMonth();
  const { goals, spent, loading } = useHome(month);
  const isPlus = profile ? profile.plan !== 'free' : false;
  const [payBefore, setPayBefore] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<{ goal: number; safety: number } | 'already' | null>(null);
  const autoTried = useRef(false);

  // Pay already logged this pay cycle, before these entries (so "part of this month's pay" adds up).
  useEffect(() => {
    if (!session || !month) return;
    const p = period(month.payday);
    supabase
      .from('transactions')
      .select('id, amount, categories!inner(key)')
      .eq('user_id', session.user.id)
      .eq('kind', 'income')
      .eq('categories.key', 'pay')
      .gte('occurred_at', p.start.toISOString())
      .then(({ data }) => setPayBefore((data ?? []).filter((r) => !items.some((i) => i.id === r.id)).reduce((a, r) => a + Number(r.amount), 0)));
  }, [session, month, items]);

  const usual = month?.income ?? 0;
  const s = splitIn(items, usual, payBefore ?? 0);
  const goal = goals[0] ?? null;
  const saving = month ? savingThisCycle(month) : { goal: 0, safety: 0 };
  const alreadyMoved = savingMoved(month);
  const showSafety = !!month && !month.goal.isSafetyNet && (month.safety.amount > 0 || month.safety.target > 0);

  // Payday auto-move (Plus): the moment this cycle's pay is all in, the saving moves — once.
  useEffect(() => {
    if (!month || payBefore === null || loading || autoTried.current || !s.payComplete) return;
    autoTried.current = true;
    if (alreadyMoved) return setMoved('already');
    if (isPlus && profile?.split_when_paid) movePay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, payBefore, loading, s.payComplete]);

  async function movePay() {
    if (!month) return;
    setBusy(true);
    const r = await moveSaving(month, goal?.id ?? null);
    setBusy(false);
    if ('error' in r) return setError(t('Couldn’t move the saving: {msg}', { msg: r.error }));
    save(r.month);
    refreshProfile();
    setMoved({ goal: r.goal, safety: r.safety });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  // ---- extra money: the choices ----
  const n = month ? monthNumbers(month, spent) : null;
  const days = n ? Math.max(1, n.P.daysLeft) : 1;
  const perDay = (left: number) => Math.max(0, Math.round(left / days / 10) * 10);
  const choices: Choice[] = useMemo(() => {
    if (!month || s.extra <= 0) return [];
    const out: Choice[] = goals.map((g, i) => {
      const per = i === 0 ? month.goal.amount + month.goalExtra : (g.monthly ?? 0);
      const sooner = soonerText(s.extra, per);
      const target =
        g.target > 0
          ? t('{from} → {to} of {target}', { from: baht(g.saved), to: baht(g.saved + s.extra), target: baht(g.target) })
          : t('{from} → {to}', { from: baht(g.saved), to: baht(g.saved + s.extra) });
      return {
        key: `goal:${g.id}`,
        icon: goalIcon3D(g.kind),
        title: t('Put it in {goal}', { goal: goalName(g) }),
        sub: sooner ? `${target} · ${sooner}` : target,
        parts: [{ to: 'goal', goalId: g.id, amount: s.extra }],
        button: t('Put {amount} in {goal}', { amount: baht(s.extra), goal: goalName(g) }),
      };
    });
    if (showSafety) {
      const have = Number(profile?.safety_saved ?? 0);
      out.push({
        key: 'safety',
        icon: 'shield',
        title: t('Safety net'),
        sub:
          month.safety.target > 0
            ? t('{from} → {to} of {target}', { from: baht(have), to: baht(have + s.extra), target: baht(month.safety.target) })
            : t('{from} → {to}', { from: baht(have), to: baht(have + s.extra) }),
        parts: [{ to: 'safety', amount: s.extra }],
        button: t('Put {amount} in the safety net', { amount: baht(s.extra) }),
      });
    }
    const left = n?.leftMonth ?? 0;
    out.push({
      key: 'spend',
      icon: 'bowl',
      title: t('Keep it for spending'),
      sub: t('Each day until payday {from} → {to}', { from: baht(perDay(left)), to: baht(perDay(left + s.extra)) }),
      parts: [{ to: 'spend', amount: s.extra }],
      button: t('Keep {amount} for spending', { amount: baht(s.extra) }),
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, goals, s.extra, showSafety, profile?.safety_saved, n?.leftMonth, days]);
  const choice = choices.find((c) => c.key === (picked ?? choices[0]?.key)) ?? null;

  async function doParts(parts: Part[]) {
    setBusy(true);
    setError(null);
    const err = await giveJob(items, parts, fromKind(items, s.payExtra));
    setBusy(false);
    if (err) return setError(t('Couldn’t save: {msg}', { msg: err }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    refreshProfile();
    const spendPart = parts.filter((p) => p.to === 'spend' || p.to === 'category').reduce((a, p) => a + p.amount, 0);
    onClose(spendPart === s.extra ? t('{amount} added to this month ✓', { amount: baht(spendPart) }) : t('Done ✓ — your extra money has a job'));
  }

  // ---- Tell Kip ----
  const cats = (month?.spend ?? []).map((x) => x.key);
  const tell = useTellKip<Part[]>(async (text) => {
    const r = await askKipDo<{ parts?: { to: string; goal_id?: string; category?: string; amount: number }[] }>('extra', text, {
      extra: s.extra,
      goals: goals.map((g) => ({ id: g.id, name: goalName(g), saved: g.saved, target: g.target })),
      safety: showSafety,
      categories: cats,
    });
    if (!r.ok) return { error: kipProblem(r.reason) };
    if (!r.out.ok) return { reply: r.out.reply, plan: null, rows: null };
    const parts = checkParts(
      (r.out.parts ?? []).map((p) =>
        p.to === 'goal'
          ? { to: 'goal', goalId: p.goal_id ?? '', amount: p.amount }
          : p.to === 'category'
            ? { to: 'category', category: p.category as CatKey, amount: p.amount }
            : { to: p.to as 'spend' | 'safety', amount: p.amount },
      ) as Part[],
      s.extra,
      goals.map((g) => g.id),
      cats,
      showSafety,
    );
    if (!parts) return { reply: t('Hmm, that didn’t add up to {amount}. Try saying it another way?', { amount: baht(s.extra) }), plan: null, rows: null };
    const rows: ChangeRow[] = parts.map((p) => {
      if (p.to === 'goal') {
        const g = goals.find((x) => x.id === p.goalId)!;
        const per = g.id === goal?.id && month ? month.goal.amount + month.goalExtra : (g.monthly ?? 0);
        return { icon: goalIcon3D(g.kind), title: goalName(g), sub: soonerText(p.amount, per) ?? undefined, to: baht(p.amount) };
      }
      if (p.to === 'safety') return { icon: 'shield', title: t('Safety net'), to: baht(p.amount) };
      if (p.to === 'spend') return { icon: 'bowl', title: t('Spending this month'), sub: t('More for each day until payday'), to: baht(p.amount) };
      return { icon: CAT_ICON3D[p.category], title: t('{category} · this month', { category: CATEGORY[p.category].name }), to: baht(p.amount) };
    });
    return { reply: r.out.reply, plan: parts, rows };
  });

  if (!month || payBefore === null) return null;
  const nothing = s.extra <= 0 && s.pay <= 0;
  if (nothing) return null;

  const title = s.extra > 0 ? t('Nice — extra money!') : s.payComplete ? t('This month’s pay is in ✓') : t('Part of this month’s pay');
  const fromLabel =
    s.payExtra > 0 && s.extra === s.payExtra
      ? t('More than your usual pay · not in your plan')
      : t('{kind} · not in your plan', {
          kind: items.find((i) => i.category === 'side_gigs') ? t('Side gig') : items.find((i) => i.category === 'gifts') ? t('Gift') : t('Money in'),
        });

  return (
    <>
      <Sheet open onClose={() => onClose()} title={title}>
        {/* usual pay */}
        {s.pay > 0 && (
          <View style={{ gap: 10 }}>
            {s.extra > 0 && <Text style={styles.cap}>{s.payComplete ? t('This month’s pay is in ✓') : t('Part of this month’s pay')}</Text>}
            <Text style={[styles.big, s.extra > 0 && { fontSize: 24 }]}>{baht(s.payUsual)}</Text>
            <Text style={styles.subC}>
              {s.payComplete ? t('Your plan runs on this — nothing to change') : t('{amount} still to come — the saving moves when it’s all in', { amount: baht(s.stillToCome) })}
            </Text>
            {s.payComplete && (saving.goal > 0 || saving.safety > 0) && (
              <>
                <View style={styles.kipRow}>
                  <Kip mood="happy" size={50} />
                  <Glass radius={22} style={{ flex: 1 }} innerStyle={styles.bub}>
                    <Text style={styles.say}>
                      {moved === 'already'
                        ? t('This month’s saving already moved ✓')
                        : moved
                          ? rich('Saving comes first, so it can’t get spent. **Payday auto-move** did it for you:', undefined, (x) => <Text style={styles.b}>{x}</Text>)
                          : t('Saving comes first, so it can’t get spent. Move it now?')}
                    </Text>
                  </Glass>
                </View>
                {moved !== 'already' && (
                  <Glass radius={22} innerStyle={{ paddingHorizontal: 14 }}>
                    {!month.goal.isSafetyNet && goal && saving.goal > 0 && (
                      <Row icon={goalIcon3D(goal.kind)} title={goalName(goal)} sub={t('This month’s saving')} to={`${baht(saving.goal)}${moved ? ' ✓' : ''}`} />
                    )}
                    {(saving.safety > 0 || month.goal.isSafetyNet) && (
                      <Row
                        icon="shield"
                        title={t('Safety net')}
                        sub={month.safety.target ? t('Building your {amount} cushion', { amount: baht(month.safety.target) }) : undefined}
                        to={`${baht(month.goal.isSafetyNet ? saving.goal + saving.safety : saving.safety)}${moved ? ' ✓' : ''}`}
                        line={!month.goal.isSafetyNet}
                      />
                    )}
                  </Glass>
                )}
                {!moved && <SaveButton label={busy ? t('Moving…') : t('Move {amount} now', { amount: baht(saving.goal + saving.safety) })} disabled={busy} onPress={movePay} />}
              </>
            )}
          </View>
        )}

        {/* extra money */}
        {s.extra > 0 && (
          <View style={{ gap: 10 }}>
            {s.pay > 0 && <View style={styles.hr} />}
            <Text style={styles.extra}>+{baht(s.extra)}</Text>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{fromLabel}</Text>
            </View>

            {tell.answer ? (
              <KipAnswer said={tell.answer.said} reply={tell.answer.reply} rows={tell.answer.rows} doing={busy} onDo={() => tell.answer?.plan && doParts(tell.answer.plan)} onBack={tell.clear} />
            ) : (
              <>
                <Text style={styles.cap}>{t('Give it a job')}</Text>
                {choices.map((c) => {
                  const on = c.key === choice?.key;
                  return (
                    <Pressable key={c.key} onPress={() => setPicked(c.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <Glass radius={20} tint={on ? colors.lime : undefined} innerStyle={[styles.opt, on && styles.optOn]}>
                        <Image source={ICON3D[c.icon]} style={{ width: 38, height: 38 }} contentFit="contain" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.optTitle}>{c.title}</Text>
                          <Text style={styles.optSub}>{c.sub}</Text>
                        </View>
                        <View style={[styles.radio, on && styles.radioOn]} />
                      </Glass>
                    </Pressable>
                  );
                })}
                {isPlus ? (
                  <TellKipBox placeholder={t('Or tell Kip… “half to {goal}”', { goal: goal ? goalName(goal) : t('my goal') })} onAsk={tell.ask} disabled={tell.busy} />
                ) : (
                  <TellKipPlus onPlus={() => (onClose(), router.push('/profile'))} />
                )}
                {choice && <SaveButton label={busy ? t('Saving…') : choice.button} disabled={busy} onPress={() => doParts(choice.parts)} />}
              </>
            )}
          </View>
        )}

        {s.extra <= 0 && (moved || !s.payComplete || (saving.goal <= 0 && saving.safety <= 0)) && <SaveButton label={t('Got it')} onPress={() => onClose()} />}
        {error && <Text style={styles.err}>{error}</Text>}
      </Sheet>
      {tell.consentSheet}
    </>
  );
}

function Row({ icon, title, sub, to, line }: { icon: Icon3D; title: string; sub?: string; to: string; line?: boolean }) {
  return (
    <View style={[styles.row, line && styles.line]}>
      <Image source={ICON3D[icon]} style={{ width: 36, height: 36 }} contentFit="contain" />
      <View style={{ flex: 1 }}>
        <Text style={styles.optTitle}>{title}</Text>
        {sub ? <Text style={styles.optSub}>{sub}</Text> : null}
      </View>
      <Text style={styles.to}>{to}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cap: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginLeft: 4 },
  big: { fontFamily: fonts.medium, fontSize: 36, letterSpacing: -1, color: colors.ink, textAlign: 'center', fontVariant: ['tabular-nums'] },
  subC: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: -4 },
  extra: { fontFamily: fonts.medium, fontSize: 36, letterSpacing: -1, color: colors.lavenderText, textAlign: 'center', fontVariant: ['tabular-nums'] },
  chip: { alignSelf: 'center', backgroundColor: colors.lilac, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginTop: -4 },
  chipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.lavenderText },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  optOn: { borderWidth: 1.5, borderColor: colors.ink },
  optTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  optSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.faint },
  radioOn: { borderWidth: 7, borderColor: colors.ink },
  kipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bub: { padding: 12, paddingHorizontal: 14 },
  say: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  b: { fontFamily: fonts.semibold },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  line: { borderTopWidth: 1, borderTopColor: 'rgba(17,17,17,0.07)' },
  to: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  hr: { height: 1, backgroundColor: 'rgba(17,17,17,0.08)', marginVertical: 4 },
  err: { fontFamily: fonts.regular, fontSize: 13, color: colors.orangeText, textAlign: 'center' },
});
