import { Image } from 'expo-image';
import { CaretRight } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Glass } from '@/components/glow/Glass';
import { Squish } from '@/components/glow/motion';
import { Title } from '@/components/setup/kit';
import { livingFor, plan as splitMonth, type Inputs, type Style } from '@/lib/brain';
import { CATEGORY, STYLES } from '@/lib/budget';
import { goalIcon3D, goalTypeIcon3D, ICON3D, type Icon3D } from '@/lib/icons3d';
import { t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import type { SetupDraft } from '@/lib/setup/draft';
import { monthYear, monthsFromNow, ordinal, shortName } from '@/lib/setup/plan';
import { leakRules } from '@/lib/setup/rules';
import { colors, fonts, money, inkA, themed } from '@/theme';

/** A picked plan: its own pastel (light in both looks, so the dark text and outline always read). */
const PICK: Record<Style, string> = { kip: '#FFFC9A', savefirst: '#D9E6CF', '503020': '#EDE6E5', jars: '#E7E1F0' };
const DAY_ICON: Record<'food' | 'travel' | 'health' | 'fun', Icon3D> = { food: 'bowl', travel: 'car', health: 'heart', fun: 'fun' };

/** "Best for you if: …" — the whole sentence, so Thai can word it freely. */
const BEST: Record<Style, (d: SetupDraft, short: string) => string> = {
  kip: (d) =>
    ({
      disappears: () => t('Best for you if: payday money “just disappears”. It saves first, keeps real life covered, and still leaves fun.'),
      treat: () => t('Best for you if: you like a payday treat. Saving moves first, and the treat is planned in your fun money.'),
      bills: () => t('Best for you if: you pay the bills, then see. Now your saving moves the same day, so nothing is left to chance.'),
      save: () => t('Best for you if: you already save first. It keeps that habit — and covers real life too.'),
    })[d.moneyStyle ?? 'disappears'](),
  savefirst: (_d, short) => t('Best for you if: you want {short} as soon as possible. The most Kip will plan goes out on payday; the rest is one pot — no categories to track.', { short }),
  '503020': () => t('Best for you if: you like a simple rule: half for needs, the rest for wants and saving.'),
  jars: () => t('Best for you if: you want to grow: jars for learning and giving too, plus a bigger safety net.'),
};

export type PlanPickerProps = {
  /** Who this is for: pay, payday, goal, habits (Setup's draft, or one built from the saved month). */
  draft: SetupDraft;
  /** The numbers to plan on (Setup: from the draft; in the app: the saved month's own, with any changed living costs). */
  inputs: Inputs;
  style: Style;
  goalPerMonth: number | null;
  onPick: (style: Style) => void;
  onCustomize?: () => void;
  /** Setup: say it's a starting plan Kip will tune to real spending. */
  starting?: boolean;
};

/**
 * Pick your plan (approved mockup): the four money styles worked out in full for this person. The goal rides a line to
 * the month each plan gets it there; all four are compared at a glance. Used by Setup and by Money styles (Plus).
 */
export function PlanPicker({ draft, inputs, style, goalPerMonth, onPick, onCustomize, starting }: PlanPickerProps) {
  const i = inputs;
  const monthly = draft.goalKind === 'monthly';
  const short = monthly ? draft.goalTitle.trim() || t('Savings') : shortName(draft.goalTitle, draft.goalKind);
  const s = STYLES.find((x) => x.key === style) ?? STYLES[0];
  const r = splitMonth(i, style, goalPerMonth);
  const L = livingFor(i);
  const due = r.goalMonths ? monthsFromNow(r.goalMonths, draft) : null;
  const funAll = r.fun + r.learn + r.give;
  const payday = draft.incomeType === 'regular' && draft.payday ? ordinal(draft.payday) : null;
  const early = draft.moneyStyle === 'disappears' || draft.moneyStyle === 'save';
  const [allRules, setAllRules] = useState(false);

  const day: {
    k: string;
    v: number;
    icon: 'food' | 'travel' | 'health' | 'fun';
    color: string;
  }[] = [
    { k: t('Food'), v: L.food / 30, icon: 'food', color: CATEGORY.food.color },
    {
      k: t('Transport'),
      v: L.transport / 30,
      icon: 'travel',
      color: CATEGORY.transport.color,
    },
    {
      k: t('Health & home'),
      v: (L.health + L.household) / 30,
      icon: 'health',
      color: CATEGORY.health_beauty.color,
    },
    { k: t('Fun'), v: funAll / 30, icon: 'fun', color: money.fun },
  ];

  // Where the payday money goes: "฿X to Japan, ฿Y to your safety net, ฿Z to your freedom jar".
  const list = [
    t('{amount} to {short}', { amount: baht(r.goal), short }),
    ...(r.net ? [t('{amount} to your safety net', { amount: baht(r.net) })] : []),
    ...(r.invest ? [t('{amount} to your freedom jar', { amount: baht(r.invest) })] : []),
  ].join(', ');
  const rules = [
    r.goal + r.net > 0
      ? movesOut(payday, early, baht(r.goal + r.net + r.invest), list)
      : payday
        ? t('On the {day}, rent and bills go first.', { day: payday })
        : t('On payday, rent and bills go first.'),
    ...(draft.sideIncome && !monthly
      ? [
          draft.sideIncome.kind === 'once'
            ? t('When your {amount} bonus arrives, log it — it goes straight to {short}.', { amount: baht(draft.sideIncome.amount), short })
            : draft.sideIncome.months
              ? t('Side work: log your {amount} on the 1st for {months} months — it goes straight to {short}. Missed a month? I’ll show the new date, no guilt.', {
                  amount: baht(draft.sideIncome.amount),
                  months: draft.sideIncome.months,
                  short,
                })
              : t('Side work: log your {amount} on the 1st — it goes straight to {short}. Missed a month? I’ll show the new date, no guilt.', { amount: baht(draft.sideIncome.amount), short }),
        ]
      : []),
    draft.goalKind === 'safety_net'
      ? t('You get {daily} a day. Spend less → the rest goes to {short} on payday.', { daily: baht(r.daily), short })
      : t('You get {daily} a day. Spend less → the rest goes to your safety net on payday.', { daily: baht(r.daily) }),
    ...leakRules(draft.leaks, i).map((x) => `${x.title}: ${x.rule}`),
    monthly
      ? t('Bad month? I lower {short} first — never food or rent — and tell you.', { short })
      : t('Bad month? I lower {short} first — never food or rent — and tell you the new date.', { short }),
    monthly ? t('Bonus or a good month? Put it in — I’ll show you what it adds up to.') : t('Bonus or a good month? Put it in and I show you how much sooner {short} gets.', { short }),
  ];

  // Every style worked out for this person, so the four can be compared at a glance.
  const all = STYLES.map((x) => ({ x, r: splitMonth(i, x.key, x.key === style ? goalPerMonth : null) }));
  const kipR = all[0].r;
  const whenOf = (x: typeof r) => (monthly ? t('{amount}/mo', { amount: baht(x.goal) }) : x.goalMonths ? monthYear(monthsFromNow(x.goalMonths, draft)) : t('Not yet'));

  /** One line against Kip's plan: "4 months sooner · ฿80 less a day". */
  function vsKip(x: typeof r) {
    const parts: string[] = [];
    if (!monthly && x.goalMonths && kipR.goalMonths && x.goalMonths !== kipR.goalMonths) {
      const m = Math.abs(x.goalMonths - kipR.goalMonths);
      parts.push(x.goalMonths < kipR.goalMonths ? (m > 1 ? t('{m} months sooner', { m }) : t('{m} month sooner', { m })) : m > 1 ? t('{m} months later', { m }) : t('{m} month later', { m }));
    }
    if (monthly) {
      const y = x.savedIn12 - kipR.savedIn12;
      if (Math.abs(y) >= 100) parts.push(y > 0 ? t('{amount} more saved a year', { amount: baht(y) }) : t('{amount} less saved a year', { amount: baht(-y) }));
    }
    const d = x.daily - kipR.daily;
    if (Math.abs(d) >= 10) parts.push(d > 0 ? t('{amount} more a day', { amount: baht(d) }) : t('{amount} less a day', { amount: baht(-d) }));
    return parts.length ? parts.join(' · ') : t('Same as Kip’s plan for you');
  }

  // The line: from now to the latest arrival (or, for a monthly goal, from ฿0 to the most saved in a year).
  const span = monthly ? Math.max(1, ...all.map((a) => a.r.savedIn12)) : Math.max(12, ...all.map((a) => a.r.goalMonths ?? 0)) + 2;
  const at = (x: typeof r) => (monthly ? x.savedIn12 : (x.goalMonths ?? span)) / span;
  const marker = draft.goalPhoto ? { uri: draft.goalPhoto } : ICON3D[draft.goalType ? goalTypeIcon3D(draft.goalType) : goalIcon3D(draft.goalKind)];

  return (
    <>
      <Title>{t('Pick your plan')}</Title>
      <Text style={styles.sub}>{t('Same {pay} pay, four ways to run it', { pay: baht(i.income) })}</Text>

      {/* The one bright thing: the goal itself, sitting where this plan gets you there. */}
      <Glass radius={28} innerStyle={styles.hero}>
        <Text style={styles.heroK}>{monthly ? t('Saved in a year with {name}', { name: s.name }) : t('{goal} with {name}', { goal: short, name: s.name })}</Text>
        <Text style={styles.heroWhen}>{monthly ? baht(r.savedIn12) : due ? monthYear(due) : t('Not yet')}</Text>
        <Track pos={at(r)} others={all.filter((a) => a.x.key !== style).map((a) => at(a.r))} marker={marker} round={!!draft.goalPhoto} />
        <View style={styles.ends}>
          <Text style={styles.endText}>{monthly ? baht(0) : t('Now')}</Text>
          <Text style={styles.endText}>{monthly ? baht(span) : monthYear(monthsFromNow(span, draft))}</Text>
        </View>
        <View style={styles.facts}>
          <View style={{ flex: 1 }}>
            <Text style={styles.factV}>{baht(r.daily)}</Text>
            <Text style={styles.factK}>{t('to spend a day')}</Text>
          </View>
          <View style={[{ flex: 1 }, styles.factR]}>
            <Text style={styles.factV}>{monthly ? t('{amount}/mo', { amount: baht(r.goal) }) : baht(r.savedIn12)}</Text>
            <Text style={styles.factK}>{monthly ? t('to {goal}', { goal: short }) : t('saved in a year')}</Text>
          </View>
        </View>
      </Glass>

      <Text style={styles.sec}>{t('Four ways')}</Text>
      <View style={{ gap: 8, marginTop: -4 }} accessibilityRole="radiogroup">
        {all.map(({ x, r: xr }) => {
          const on = x.key === style;
          return (
            <Squish
              key={x.key}
              onPress={() => onPick(x.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t('{name}: {when}, {day} a day', { name: x.name, when: whenOf(xr), day: baht(xr.daily) })}>
              <Glass radius={22} tint={on ? PICK[x.key] : undefined} innerStyle={[styles.opt, on && styles.optOn]}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.optName, on && { color: colors.onAccent }]}>{x.name.replace('50 / 30 / 20', '50/30/20')}</Text>
                    {x.key === 'kip' && (
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{x.tag}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.optWhy, on && { color: colors.onAccentMuted }]}>{x.key === 'kip' ? t('Saves first, keeps real life covered') : vsKip(xr)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={[styles.optWhen, on && { color: colors.onAccent }]}>{whenOf(xr)}</Text>
                  <Text style={[styles.optWhy, on && { color: colors.onAccentMuted }]}>{t('{amount} a day', { amount: baht(xr.daily) })}</Text>
                </View>
              </Glass>
            </Squish>
          );
        })}
      </View>
      <Text style={styles.best}>{BEST[style](draft, short)}</Text>

      <Text style={styles.sec}>{t('How it runs')}</Text>
      <View style={{ gap: 8, marginTop: -4 }}>
        <Glass radius={22} innerStyle={styles.day}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={styles.dayHead}>{t('A normal day')}</Text>
            <Text style={styles.dayTotal}>{baht(r.daily)}</Text>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            {day.map((d) => (
              <View key={d.k} style={{ flex: 1, alignItems: 'center' }}>
                <Image source={ICON3D[DAY_ICON[d.icon]]} style={{ width: 44, height: 44 }} contentFit="contain" />
                <Text style={styles.dayV}>{baht(Math.round(d.v))}</Text>
                <Text style={styles.dayK}>{d.k}</Text>
              </View>
            ))}
          </View>
        </Glass>
        <Glass radius={22} innerStyle={styles.pay}>
          <Image source={ICON3D.income} style={{ width: 40, height: 40 }} contentFit="contain" />
          <Text style={styles.payText}>{rules[0]}</Text>
        </Glass>
        {allRules ? (
          <Glass radius={22} innerStyle={{ padding: 16, gap: 12 }}>
            {rules.slice(1).map((line, k) => (
              <View key={k} style={styles.rule}>
                <View style={styles.num}>
                  <Text style={styles.numText}>{k + 2}</Text>
                </View>
                <Text style={styles.ruleText}>{line}</Text>
              </View>
            ))}
          </Glass>
        ) : (
          <Pressable onPress={() => setAllRules(true)} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 6 }}>
            <Text style={styles.more}>{t('See all {n} rules Kip follows', { n: rules.length })}</Text>
          </Pressable>
        )}
      </View>

      {onCustomize && (
        <Squish onPress={onCustomize} accessibilityRole="button" accessibilityLabel={t('Customize your plan')}>
          <Glass radius={22} innerStyle={styles.customize}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.custTitle}>{t('Customize')}</Text>
              <Text style={styles.optWhy}>{t('Change food, fun or the goal amount · lock what matters')}</Text>
            </View>
            <CaretRight size={18} color={colors.muted} />
          </Glass>
        </Squish>
      )}
      {starting && <Text style={styles.foot}>{t('This is a starting plan. After a few weeks of real spending — subscriptions especially — I’ll update it with your real numbers.')}</Text>}
    </>
  );
}

/** The goal on its way: a line from now to the latest date, the other plans as small stops, this plan's goal riding on it. */
function Track({ pos, others, marker, round }: { pos: number; others: number[]; marker: number | { uri: string }; round: boolean }) {
  const [w, setW] = useState(0);
  const x = useSharedValue(pos);
  useEffect(() => {
    x.value = withSpring(pos, { damping: 12, stiffness: 140 });
  }, [pos, x]);
  const ride = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * w - 28 }] }));
  const fill = useAnimatedStyle(() => ({ width: Math.max(0, x.value * w) }));
  return (
    <View style={styles.track} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View style={styles.line} />
      <Animated.View style={[styles.lineFill, fill]} />
      {w > 0 && others.map((o, k) => <View key={k} style={[styles.stop, { left: o * w - 6 }]} />)}
      {w > 0 && (
        <Animated.View style={[styles.rider, ride]}>
          {round ? (
            <View style={styles.photo}>
              <Image source={marker} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
          ) : (
            <Image source={marker} style={{ width: 56, height: 56 }} contentFit="contain" />
          )}
        </Animated.View>
      )}
    </View>
  );
}

/** Rule 1 of "How Kip runs it": the payday move, as one whole sentence. day = "25th" (or null for changing pay). */
function movesOut(day: string | null, early: boolean, total: string, list: string) {
  if (day) return early ? t('On the {day}, {total} moves out first thing in the morning: {list}.', { day, total, list }) : t('On the {day}, {total} moves out: {list}.', { day, total, list });
  return early ? t('On payday, {total} moves out first thing in the morning: {list}.', { total, list }) : t('On payday, {total} moves out: {list}.', { total, list });
}

const styles = themed(() =>
  StyleSheet.create({
    sub: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted, marginTop: -6 },
    hero: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16 },
    heroK: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
    heroWhen: { fontFamily: fonts.medium, fontSize: 40, lineHeight: 48, letterSpacing: -1.4, color: colors.ink, fontVariant: ['tabular-nums'] },
    track: { height: 56, marginTop: 12, justifyContent: 'center' },
    line: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: inkA(0.08) },
    lineFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: colors.ink },
    stop: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.faint, backgroundColor: colors.paper },
    rider: { position: 'absolute', left: 0, width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
    photo: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: colors.paper, overflow: 'hidden', backgroundColor: colors.paper, boxShadow: '0 4px 12px rgba(17,17,17,0.18)' },
    ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
    endText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
    facts: { flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: inkA(0.08) },
    factR: { borderLeftWidth: 1, borderLeftColor: inkA(0.08), paddingLeft: 16 },
    factV: { fontFamily: fonts.medium, fontSize: 20, letterSpacing: -0.4, color: colors.ink, fontVariant: ['tabular-nums'] },
    factK: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
    sec: { fontFamily: fonts.medium, fontSize: 19, letterSpacing: -0.3, color: colors.ink, marginTop: 12 },
    opt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
    optOn: { borderWidth: 1.5, borderColor: colors.onAccent },
    optName: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
    optWhen: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
    optWhy: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, fontVariant: ['tabular-nums'] },
    tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.onAccent },
    tagText: { fontFamily: fonts.medium, fontSize: 12, color: '#FFFFFF' },
    best: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted, paddingHorizontal: 4, marginTop: -4 },
    day: { padding: 16 },
    dayHead: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    dayTotal: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
    dayV: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, marginTop: 4, fontVariant: ['tabular-nums'] },
    dayK: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted, textAlign: 'center' },
    pay: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
    payText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
    more: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textDecorationLine: 'underline' },
    rule: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    num: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    numText: { fontFamily: fonts.medium, fontSize: 12, color: colors.paper },
    ruleText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
    customize: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
    custTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    foot: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, paddingHorizontal: 4 },
  }),
);
