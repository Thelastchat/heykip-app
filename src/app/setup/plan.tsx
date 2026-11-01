import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CatBadge } from '@/components/CatIcon';
import { SetupScreen, Title } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { livingFor, plan as splitMonth, type Style } from '@/lib/brain';
import { CATEGORY, STYLES } from '@/lib/budget';
import { t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { useSetup, type SetupDraft } from '@/lib/setup/draft';
import { inputsFrom, monthYear, monthsFromNow, ordinal, shortName, sideTotal } from '@/lib/setup/plan';
import { leakRules } from '@/lib/setup/rules';
import { colors, fonts, money, radius, inkA, themed } from '@/theme';

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

// Setup 4/6 · Pick your plan — each money style, worked out in full for this person.
export default function SetupPlan() {
  const { draft, update } = useSetup();
  const i = inputsFrom(draft);
  const monthly = draft.goalKind === 'monthly';
  const short = monthly ? draft.goalTitle.trim() || t('Savings') : shortName(draft.goalTitle, draft.goalKind);
  const style = draft.budgetStyle;
  const s = STYLES.find((x) => x.key === style) ?? STYLES[0];
  const r = splitMonth(i, style, draft.goalPerMonth);
  const L = livingFor(i);
  const due = r.goalMonths ? monthsFromNow(r.goalMonths, draft) : null;
  const funAll = r.fun + r.learn + r.give;
  const payday = draft.incomeType === 'regular' && draft.payday ? ordinal(draft.payday) : null;
  const early = draft.moneyStyle === 'disappears' || draft.moneyStyle === 'save';

  const bar: [number, string, string][] = (
    [
      [r.fixed, money.fixed, t('Rent & bills {amount}', { amount: baht(r.fixed) })],
      [r.living, money.living, t('Living {amount}', { amount: baht(r.living) })],
      [r.net + r.invest, money.safetyNet, t('Safety net {amount}', { amount: baht(r.net + r.invest) })],
      [r.goal, money.goal, `${short} ${baht(r.goal)}`],
      [funAll, money.fun, style === 'savefirst' ? t('Spend freely {amount}', { amount: baht(funAll) }) : t('Fun {amount}', { amount: baht(funAll) })],
    ] as [number, string, string][]
  ).filter(([n]) => n > 0);

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

  // Road to the goal: now, two stops, the goal.
  const road: { when: string; amount: string }[] = [];
  if (monthly) {
    road.push(
      { when: t('Now'), amount: baht(0) },
      { when: t('3 months'), amount: baht(r.goal * 3) },
      { when: t('6 months'), amount: baht(r.goal * 6) },
      { when: t('1 year'), amount: baht(r.goal * 12) },
    );
  } else if (r.goalMonths && due) {
    const n = r.goalMonths;
    road.push({ when: t('Now'), amount: baht(i.goal.saved) });
    for (const m of [Math.round(n / 3), Math.round((2 * n) / 3)].filter((m, k, a) => m > 0 && m < n && a.indexOf(m) === k)) {
      road.push({
        when: monthYear(monthsFromNow(m, draft)),
        amount: baht(Math.min(i.goal.target, i.goal.saved + r.goal * m + sideTotal(draft.sideIncome, m))),
      });
    }
    road.push({ when: monthYear(due), amount: `${short}!` });
  }

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

  const tabFor = (k: Style) => {
    const x = splitMonth(i, k, k === style ? draft.goalPerMonth : null);
    const when = monthly ? t('{amount}/mo', { amount: baht(x.goal + x.net) }) : x.goalMonths ? monthYear(monthsFromNow(x.goalMonths, draft)) : t('Not yet');
    return { when, day: baht(x.daily), r: x };
  };
  const kipR = tabFor('kip').r;
  const vsKip: { text: string; good: boolean }[] = [];
  if (style !== 'kip') {
    if (!monthly && r.goalMonths && kipR.goalMonths && r.goalMonths !== kipR.goalMonths) {
      const m = Math.abs(r.goalMonths - kipR.goalMonths);
      vsKip.push({
        text:
          r.goalMonths < kipR.goalMonths
            ? m > 1
              ? t('{short} {m} months sooner', { short, m })
              : t('{short} {m} month sooner', { short, m })
            : m > 1
              ? t('{short} {m} months later', { short, m })
              : t('{short} {m} month later', { short, m }),
        good: r.goalMonths < kipR.goalMonths,
      });
    }
    const saved = r.savedIn12 - kipR.savedIn12;
    if (Math.abs(saved) >= 100)
      vsKip.push({
        text: saved > 0 ? t('{amount} more saved a year', { amount: baht(Math.abs(saved)) }) : t('{amount} less saved a year', { amount: baht(Math.abs(saved)) }),
        good: saved > 0,
      });
    const day = r.daily - kipR.daily;
    if (Math.abs(day) >= 10)
      vsKip.push({
        text: day > 0 ? t('{amount} more a day', { amount: baht(Math.abs(day)) }) : t('{amount} less a day', { amount: baht(Math.abs(day)) }),
        good: day > 0,
      });
  }

  return (
    <SetupScreen step={4} footer={<Button label={t('Choose {name}', { name: s.name })} onPress={() => router.push('/setup/sign')} />}>
      <Title>{t('Pick your plan')}</Title>
      <Text style={styles.sub}>{t('Same pay, four ways to run it. Tap a tab — the page under it is that plan.')}</Text>

      <View>
        {/* A binder: each style is a tab with its own headline numbers; the picked tab joins the page below it. */}
        <View style={styles.tabs} accessibilityRole="tablist">
          {STYLES.map((x) => {
            const on = x.key === style;
            const tab = tabFor(x.key);
            return (
              <Pressable
                key={x.key}
                onPress={() => update({ budgetStyle: x.key, goalPerMonth: null })}
                style={[styles.tab, on ? [styles.tabOn, { backgroundColor: x.tagColor }] : styles.tabOff]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t('{name}: {when}, {day} a day', { name: x.name, when: tab.when, day: tab.day })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[styles.tabName, on && { fontFamily: fonts.bold }]} numberOfLines={1}>
                    {x.name.replace('50 / 30 / 20', '50/30/20')}
                  </Text>
                </View>
                <Text style={[styles.tabWhen, on && { fontSize: 15 }]} numberOfLines={1}>
                  {tab.when}
                </Text>
                <Text style={[styles.tabDay, on && { color: colors.ink }]}>{t('{amount}/day', { amount: tab.day })}</Text>
              </Pressable>
            );
          })}
        </View>
        <View
          style={[
            styles.body,
            { backgroundColor: s.tagColor },
            style === STYLES[0].key && { borderTopLeftRadius: 0 },
            style === STYLES[STYLES.length - 1].key && {
              borderTopRightRadius: 0,
            },
          ]}>
          <View style={{ gap: 4, paddingHorizontal: 2 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <Text style={styles.heroName}>{s.name}</Text>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{s.tag}</Text>
              </View>
            </View>
            <Text style={styles.heroText}>{BEST[style](draft, short)}</Text>
          </View>

          {style !== 'kip' && (
            <View style={{ gap: 6, paddingHorizontal: 2 }}>
              <Text style={[styles.head, { color: inkA(0.6) }]}>{t('VS KIP’S PLAN')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {vsKip.length ? (
                  vsKip.map((d) => (
                    <View key={d.text} style={styles.diff}>
                      <Text
                        style={{
                          fontFamily: fonts.bold,
                          fontSize: 11,
                          color: d.good ? '#3E7B3A' : '#B4532F',
                        }}>
                        {d.good ? '▲' : '▼'}
                      </Text>
                      <Text style={styles.diffText}>{d.text}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.diff}>
                    <Text style={styles.diffText}>{t('Same as Kip’s plan for you — your date already needs the most you can save.')}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.stats}>
            <Stat k={short} v={monthly ? t('{amount}/mo', { amount: baht(r.goal) }) : due ? monthYear(due) : t('Not yet')} />
            <Stat k={t('Saved in 1 year')} v={baht(r.savedIn12)} sub={r.netIn12 > 0 ? t('{short} {goal} + safety {net}', { short, goal: baht(r.goalIn12), net: baht(r.netIn12) }) : undefined} />
            <Stat k={t('Spend a day')} v={baht(r.daily)} />
            <Stat k={style === 'savefirst' ? t('After saving') : t('Fun a month')} v={style === 'savefirst' ? t('One pot') : baht(funAll)} />
          </View>

          <View style={styles.card}>
            <Text style={styles.head}>{t('YOUR MONTH')}</Text>
            <View style={styles.bar}>
              {bar.map(([n, c], k) => (
                <View
                  key={k}
                  style={{
                    flex: n,
                    backgroundColor: c,
                    borderRightWidth: k < bar.length - 1 ? 2 : 0,
                    borderColor: colors.paper,
                  }}
                />
              ))}
            </View>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                columnGap: 12,
              }}>
              {bar.map(([, c, label]) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      backgroundColor: c,
                    }}
                  />
                  <Text style={styles.legend}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.head}>{t('A NORMAL DAY · {amount}', { amount: baht(r.daily) })}</Text>
            <View style={{ flexDirection: 'row' }}>
              {day.map((d) => (
                <View key={d.k} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <CatBadge name={d.icon} color={d.color} size={40} />
                  <Text style={styles.dayV}>{baht(Math.round(d.v))}</Text>
                  <Text style={styles.dayK}>{d.k}</Text>
                </View>
              ))}
            </View>
          </View>

          {road.length > 1 && (
            <View style={styles.card}>
              <Text style={styles.head}>{t('ROAD TO {short}', { short: short.toUpperCase() })}</Text>
              <View style={styles.roadLine}>
                <View style={styles.roadTrack} />
                {road.map((_, k) => (
                  <View
                    key={k}
                    style={[
                      styles.roadDot,
                      k === 0
                        ? { backgroundColor: colors.ink }
                        : {
                            backgroundColor: money.goal,
                            borderWidth: 2,
                            borderColor: colors.ink,
                          },
                    ]}
                  />
                ))}
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}>
                {road.map((p, k) => (
                  <View
                    key={k}
                    style={{
                      alignItems: k === 0 ? 'flex-start' : k === road.length - 1 ? 'flex-end' : 'center',
                      flex: 1,
                    }}>
                    <Text style={styles.roadWhen}>{p.when}</Text>
                    <Text style={styles.roadAmt}>{p.amount}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.head}>{t('HOW KIP RUNS IT')}</Text>
            {rules.map((line, k) => (
              <Fragment key={k}>
                <View style={styles.rule}>
                  <View style={styles.num}>
                    <Text style={styles.numText}>{k + 1}</Text>
                  </View>
                  <Text style={styles.ruleText}>{line}</Text>
                </View>
              </Fragment>
            ))}
          </View>
        </View>
      </View>
      <Pressable onPress={() => router.push('/setup/yours')} style={styles.customize} accessibilityRole="button" accessibilityLabel={t('Customize your plan')}>
        <CatBadge name="cash" color={colors.peach} size={34} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{t('Customize')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted }}>{t('Change food, fun or the goal amount · lock what matters')}</Text>
        </View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.ink }}>›</Text>
      </Pressable>
      <Text style={[styles.foot, { marginTop: -6 }]}>{t('Optional — most people go straight on.')}</Text>

      <Text style={styles.foot}>{t('This is a starting plan. After a few weeks of real spending — subscriptions especially — I’ll update it with your real numbers.')}</Text>
    </SetupScreen>
  );
}

/** Rule 1 of "How Kip runs it": the payday move, as one whole sentence. day = "25th" (or null for changing pay). */
function movesOut(day: string | null, early: boolean, total: string, list: string) {
  if (day) return early ? t('On the {day}, {total} moves out first thing in the morning: {list}.', { day, total, list }) : t('On the {day}, {total} moves out: {list}.', { day, total, list });
  return early ? t('On payday, {total} moves out first thing in the morning: {list}.', { total, list }) : t('On payday, {total} moves out: {list}.', { total, list });
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statK} numberOfLines={1}>
        {k}
      </Text>
      <Text style={styles.statV} numberOfLines={1}>
        {v}
      </Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    customize: {
      borderRadius: 18,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: inkA(0.25),
      backgroundColor: colors.paper,
      paddingVertical: 12,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sub: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
      marginTop: -6,
    },
    tabText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
    tabs: {
      flexDirection: 'row',
      gap: 4,
      alignItems: 'flex-end',
      paddingHorizontal: 2,
      marginBottom: -1.5,
      zIndex: 2,
    },
    tab: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 6,
      gap: 1,
      borderWidth: 1.5,
      borderBottomWidth: 0,
    },
    tabOn: {
      borderColor: colors.ink,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 9,
      paddingBottom: 11,
    },
    tabOff: {
      backgroundColor: colors.grey,
      borderColor: 'transparent',
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      paddingTop: 7,
      paddingBottom: 8,
      marginBottom: 1.5,
    },
    tabDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: inkA(0.2),
    },
    tabName: {
      flexShrink: 1,
      fontFamily: fonts.medium,
      fontSize: 12,
      color: colors.ink,
    },
    tabWhen: {
      fontFamily: fonts.bold,
      fontSize: 13,
      letterSpacing: -0.2,
      color: colors.ink,
    },
    tabDay: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
    body: {
      borderWidth: 1.5,
      borderColor: colors.ink,
      borderRadius: 22,
      paddingTop: 14,
      paddingHorizontal: 12,
      paddingBottom: 14,
      gap: 10,
    },
    diff: {
      minHeight: 26,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 13,
      backgroundColor: colors.paper,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: '100%',
    },
    diffText: {
      flexShrink: 1,
      fontFamily: fonts.semibold,
      fontSize: 12,
      color: colors.ink,
    },
    heroName: { fontFamily: fonts.semibold, fontSize: 20, color: colors.ink },
    tag: {
      height: 22,
      paddingHorizontal: 9,
      borderRadius: radius.pill,
      backgroundColor: colors.paper,
      justifyContent: 'center',
    },
    tagText: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink },
    heroText: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink,
    },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stat: {
      width: '48.5%',
      borderRadius: 16,
      backgroundColor: colors.paper,
      paddingVertical: 12,
      paddingHorizontal: 14,
      minHeight: 72,
    },
    statK: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    statV: {
      fontFamily: fonts.bold,
      fontSize: 19,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    statSub: {
      fontFamily: fonts.regular,
      fontSize: 11,
      lineHeight: 14,
      color: colors.muted,
    },
    card: {
      borderRadius: 16,
      backgroundColor: colors.paper,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    head: {
      fontFamily: fonts.bold,
      fontSize: 11,
      letterSpacing: 0.5,
      color: colors.muted,
    },
    bar: {
      height: 14,
      borderRadius: 7,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    legend: { fontFamily: fonts.regular, fontSize: 12, color: colors.ink },
    dayV: {
      fontFamily: fonts.bold,
      fontSize: 16,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    dayK: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    roadLine: {
      height: 18,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    roadTrack: {
      position: 'absolute',
      left: 8,
      right: 8,
      height: 4,
      borderRadius: 2,
      backgroundColor: inkA(0.1),
    },
    roadDot: { width: 16, height: 16, borderRadius: 8 },
    roadWhen: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
    roadAmt: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    rule: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    num: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    numText: { fontFamily: fonts.bold, fontSize: 12, color: colors.paper },
    ruleText: {
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink,
    },
    foot: {
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
      color: colors.muted,
      paddingHorizontal: 4,
    },
  }),
);
