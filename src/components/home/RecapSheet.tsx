// Payday recap (approved mockup): how last pay month went (the app's numbers), what Kip noticed (AI, Plus — asked once
// per month and kept on the phone), and up to 3 changes for this month, each with its exact numbers and its own Do it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Squish } from '@/components/glow/motion';
import { askKipDo } from '@/components/TellKip';
import { Sheet } from '@/components/profile/Sheet';
import { CATEGORY, type MonthBudget } from '@/lib/budget';
import { monthLong, monthShort, t } from '@/lib/i18n';
import { CAT_ICON3D, ICON3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { recapContext, type Recap, type Suggestion } from '@/lib/recap';
import { monthYear, ordinal } from '@/lib/setup/plan';
import { colors, fonts, inkA, themed } from '@/theme';

type Kip = { noticed: string; picks: { id: string; title: string; why: string }[] };
type Done = { text: string; undo: () => Promise<string | null> };

const day = (d: Date) => `${d.getDate()} ${monthShort(d.getMonth())}`;
const cat = (k: keyof typeof CATEGORY) => t(CATEGORY[k].name);

/** The app's own words for a suggestion (used when Kip's aren't there). */
function plain(s: Suggestion, r: Recap): { title: string; why: string } {
  if (s.kind === 'move') {
    const to = r.cats.find((c) => c.key === s.to);
    const from = r.cats.find((c) => c.key === s.from);
    return {
      title: t('Move {amount} from {from} to {to}', { amount: baht(s.amount), from: cat(s.from), to: cat(s.to) }),
      why: t('{to} ran {over} over; {from} had {spare} to spare.', { to: cat(s.to), over: baht((to?.spent ?? 0) - (to?.plan ?? 0)), from: cat(s.from), spare: baht((from?.plan ?? 0) - (from?.spent ?? 0)) }),
    };
  }
  if (s.kind === 'leftover')
    return {
      title: t('Put {amount} toward {goal}', { amount: baht(s.notice.amount), goal: s.notice.goalName }),
      why:
        s.notice.will && s.notice.was && s.notice.will.getTime() !== s.notice.was.getTime()
          ? t('If it’s still in your account. {goal} arrives {will} instead of {was}.', { goal: s.notice.goalName, will: monthYear(s.notice.will), was: monthYear(s.notice.was) })
          : t('If it’s still in your account.'),
    };
  return {
    title: t('Add {name} to Every month', { name: s.notice.name }),
    why: t('{amount} around the {day}, 3 months running.', { amount: baht(s.notice.amount), day: ordinal(s.notice.day), n: s.notice.day }),
  };
}

export function RecapSheet({
  recap: r,
  month,
  isPlus,
  goalSaved,
  onApply,
  onSkip,
  onLocked,
  onClose,
}: {
  recap: Recap;
  month: MonthBudget;
  isPlus: boolean;
  goalSaved: number;
  onApply: (s: Suggestion) => Promise<Done | string>;
  onSkip: (s: Suggestion) => void;
  onLocked: () => void;
  onClose: () => void;
}) {
  const [kip, setKip] = useState<Kip | null>(null);
  const [asking, setAsking] = useState(isPlus);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState<Record<string, Done>>({});
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const key = `heykip.${r.id}`;

  // Kip's part: asked once per pay month, then kept on the phone.
  useEffect(() => {
    if (!isPlus) return;
    let live = true;
    (async () => {
      const kept = await AsyncStorage.getItem(key).catch(() => null);
      if (kept) {
        if (live) setKip(JSON.parse(kept));
        if (live) setAsking(false);
        return;
      }
      const res = await askKipDo<{ picks?: Kip['picks'] }>('recap', 'Write my payday recap.', recapContext(r));
      if (!live) return;
      setAsking(false);
      if (!res.ok || !res.out.reply) return setFailed(true);
      const ids = new Set(r.suggestions.map((s) => s.id));
      const k: Kip = {
        noticed: res.out.reply.slice(0, 400),
        picks: (res.out.picks ?? []).filter((p) => ids.has(p.id)).slice(0, 3).map((p) => ({ id: p.id, title: String(p.title).slice(0, 48), why: String(p.why).slice(0, 100) })),
      };
      setKip(k);
      AsyncStorage.setItem(key, JSON.stringify(k)).catch(() => {});
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlus, key]);

  // Kip's picks in Kip's order; if Kip didn't pick (or couldn't be reached), the app's own, in its order.
  const shown: { s: Suggestion; title: string; why: string }[] = (
    kip?.picks.length ? kip.picks.map((p) => ({ s: r.suggestions.find((s) => s.id === p.id)!, title: p.title, why: p.why })) : r.suggestions.map((s) => ({ s, ...plain(s, r) }))
  ).filter((x) => x.s && !gone.has(x.s.id));

  const amt = (k: string) => month.spend.find((x) => x.key === k)?.amount ?? 0;
  const chips = (s: Suggestion): string[] =>
    s.kind === 'move'
      ? [`${cat(s.to)} ${baht(amt(s.to))} → ${baht(amt(s.to) + s.amount)}`, `${cat(s.from)} ${baht(amt(s.from))} → ${baht(Math.max(0, amt(s.from) - s.amount))}`]
      : s.kind === 'leftover'
        ? [t('{goal} saved {was} → {now}', { goal: s.notice.goalName, was: baht(goalSaved), now: baht(goalSaved + s.notice.amount) })]
        : [t('{name} +{amount} · due the {day}', { name: s.notice.name, amount: baht(s.notice.amount), day: ordinal(s.notice.day), n: s.notice.day })];

  async function apply(s: Suggestion) {
    setBusy(s.id);
    setProblem(null);
    const res = await onApply(s);
    setBusy(null);
    if (typeof res === 'string') return setProblem(res);
    setDone((d) => ({ ...d, [s.id]: res }));
  }
  async function undo(s: Suggestion) {
    const d = done[s.id];
    if (!d) return;
    setBusy(s.id);
    const err = await d.undo();
    setBusy(null);
    if (err) return setProblem(err);
    setDone(({ [s.id]: _drop, ...rest }) => rest);
  }

  const name = monthLong(r.month.getMonth());
  const next = monthLong((r.month.getMonth() + 1) % 12);
  return (
    <Sheet open onClose={onClose} title={t('{month} recap', { month: name })} sub={t('Pay month {from} – {to}', { from: day(r.start), to: day(r.end) })}>
      <Text style={styles.sec}>{t('How it went')}</Text>
      <Text style={styles.line}>
        <Text style={styles.b}>{baht(r.spent)}</Text> {t('of {plan} spent', { plan: baht(r.plan) })} ·{' '}
        <Text style={[styles.b, r.left < 0 && { color: colors.orangeText }]}>{r.left >= 0 ? t('{amount} left', { amount: baht(r.left) }) : t('{amount} over', { amount: baht(-r.left) })}</Text>
      </Text>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${Math.min(100, r.plan ? (r.spent / r.plan) * 100 : 0)}%` }, r.left < 0 && { backgroundColor: colors.orange }]} />
      </View>
      <View style={{ marginTop: 6 }}>
        {r.cats
          .filter((c) => c.spent > 0 || c.plan > 0)
          .slice(0, 4)
          .map((c) => (
            <View key={c.key} style={styles.cr}>
              <Image source={ICON3D[CAT_ICON3D[c.key]]} style={{ width: 26, height: 26 }} contentFit="contain" />
              <Text style={styles.crName} numberOfLines={1}>
                {cat(c.key)}
              </Text>
              <Text style={[styles.crAmt, c.spent > c.plan && { color: colors.orangeText }]}>{baht(c.spent)}</Text>
              <Text style={styles.crOf}>{t('of {amount}', { amount: baht(c.plan) })}</Text>
            </View>
          ))}
      </View>
      {r.goal ? (
        <>
          <Text style={styles.sec}>{t('Saving')}</Text>
          <View style={styles.cr}>
            <Image source={ICON3D.plane} style={{ width: 26, height: 26 }} contentFit="contain" />
            <Text style={styles.crName} numberOfLines={1}>
              {r.goal.arrives ? t('{goal} · on track for {date}', { goal: r.goal.name, date: monthYear(r.goal.arrives) }) : r.goal.name}
            </Text>
            <Text style={styles.crAmt}>{t('{amount}/mo', { amount: baht(r.goal.perMonth) })}</Text>
          </View>
        </>
      ) : null}

      <Text style={styles.sec}>{t('Kip noticed')}</Text>
      {isPlus ? (
        <View style={styles.note}>
          {asking ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={colors.muted} />
              <Text style={styles.noteT}>{t('Kip is reading your month…')}</Text>
            </View>
          ) : kip ? (
            <Text style={styles.noteT}>{kip.noticed}</Text>
          ) : (
            <Text style={[styles.noteT, { color: colors.muted }]}>{failed ? t('Kip couldn’t write this part just now. The numbers above are all yours.') : ''}</Text>
          )}
        </View>
      ) : (
        <Squish style={styles.lock} onPress={onLocked} accessibilityRole="button">
          <Text style={styles.lockT}>{t('What Kip noticed + changes for {month}', { month: next })}</Text>
          <Text style={styles.plus}>Plus</Text>
        </Squish>
      )}

      {isPlus && shown.length > 0 && (
        <>
          <Text style={styles.sec}>{t('For {month}, Kip suggests', { month: next })}</Text>
          {shown.map(({ s, title, why }) => {
            const d = done[s.id];
            return (
              <View key={s.id} style={styles.sug}>
                <Text style={styles.sugT}>{title}</Text>
                <Text style={styles.sugW}>{why}</Text>
                <View style={styles.chips}>
                  {chips(s).map((c) => (
                    <Text key={c} style={styles.chip}>
                      {c}
                    </Text>
                  ))}
                </View>
                {d ? (
                  <View style={styles.ok}>
                    <Text style={styles.okT}>✓ {t('Done')}</Text>
                    <Squish style={styles.undo} disabled={busy === s.id} onPress={() => undo(s)} accessibilityRole="button" accessibilityLabel={t('Undo')}>
                      <Text style={styles.undoT}>{t('Undo')}</Text>
                    </Squish>
                  </View>
                ) : (
                  <View style={styles.btns}>
                    <Squish style={[styles.do, busy === s.id && { opacity: 0.5 }]} disabled={!!busy} onPress={() => apply(s)} accessibilityRole="button" accessibilityLabel={`${t('Do it')}: ${title}`}>
                      <Text style={styles.doT}>{busy === s.id ? t('Saving…') : t('Do it')}</Text>
                    </Squish>
                    <Squish
                      style={styles.no}
                      disabled={!!busy}
                      onPress={() => {
                        onSkip(s);
                        setGone((g) => new Set([...g, s.id]));
                      }}
                      accessibilityRole="button">
                      <Text style={styles.noT}>{s.kind === 'leftover' ? t('Keep it') : t('Not now')}</Text>
                    </Squish>
                  </View>
                )}
              </View>
            );
          })}
          {problem ? <Text style={[styles.fine, { color: colors.orangeText }]}>{problem}</Text> : null}
          <Text style={styles.fine}>{t('Kip only suggests what fits your month. Nothing changes until you tap.')}</Text>
        </>
      )}
    </Sheet>
  );
}

const card = { borderRadius: 18, backgroundColor: colors.paper, paddingHorizontal: 14, paddingVertical: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 6px 18px rgba(0,0,0,0.05)' } as const;
const styles = themed(() =>
  StyleSheet.create({
    sec: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 6 },
    line: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
    b: { fontFamily: fonts.semibold, color: colors.ink },
    bar: { height: 8, borderRadius: 4, backgroundColor: inkA(0.08), overflow: 'hidden', marginTop: 8 },
    fill: { height: '100%', borderRadius: 4, backgroundColor: colors.ink },
    cr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    crName: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
    crAmt: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
    crOf: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, fontVariant: ['tabular-nums'] },
    note: { ...card, backgroundColor: colors.paper },
    noteT: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.ink },
    lock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, borderRadius: 999, backgroundColor: inkA(0.05), paddingHorizontal: 16 },
    lockT: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, flexShrink: 1 },
    plus: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    sug: { ...card, backgroundColor: colors.paper, marginTop: 8 },
    sugT: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
    sugW: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    chip: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.ink, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: inkA(0.05), overflow: 'hidden', fontVariant: ['tabular-nums'] },
    btns: { flexDirection: 'row', gap: 8, marginTop: 10 },
    do: { flex: 1, height: 40, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    doT: { fontFamily: fonts.medium, fontSize: 14, color: colors.paper },
    no: { height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: inkA(0.05), alignItems: 'center', justifyContent: 'center' },
    noT: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
    ok: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    okT: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
    undo: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: inkA(0.06), alignItems: 'center', justifyContent: 'center' },
    undoT: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
    fine: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, textAlign: 'center', marginTop: 10 },
  }),
);
