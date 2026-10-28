import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CatBadge } from '@/components/CatIcon';
import { SetupScreen, Title } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { livingFor, plan as splitMonth, type Style } from '@/lib/brain';
import { CATEGORY, STYLES } from '@/lib/budget';
import { baht } from '@/lib/money';
import { useSetup, type SetupDraft } from '@/lib/setup/draft';
import { inputsFrom, monthYear, monthsFromNow, ordinal, shortName } from '@/lib/setup/plan';
import { leakRules } from '@/lib/setup/rules';
import { colors, fonts, money, radius } from '@/theme';

const BEST: Record<Style, (d: SetupDraft, short: string) => string> = {
  kip: (d) =>
    ({
      disappears: 'payday money “just disappears”. It saves first, keeps real life covered, and still leaves fun.',
      treat: 'you like a payday treat. Saving moves first, and the treat is planned in your fun money.',
      bills: 'you pay the bills, then see. Now your saving moves the same day, so nothing is left to chance.',
      save: 'you already save first. It keeps that habit — and covers real life too.',
    })[d.moneyStyle ?? 'disappears'],
  savefirst: (_d, short) => `you want ${short} as soon as possible. The most Kip will plan goes out on payday; the rest is one pot — no categories to track.`,
  '503020': () => 'you like a simple rule: half for needs, the rest for wants and saving.',
  jars: () => 'you want to grow: jars for learning and giving too, plus a bigger safety net.',
};

// Setup 4/6 · Pick your plan — each money style, worked out in full for this person.
export default function SetupPlan() {
  const { draft, update } = useSetup();
  const i = inputsFrom(draft);
  const monthly = draft.goalKind === 'monthly';
  const short = monthly ? draft.goalTitle.trim() || 'Savings' : shortName(draft.goalTitle, draft.goalKind);
  const style = draft.budgetStyle;
  const s = STYLES.find((x) => x.key === style) ?? STYLES[0];
  const r = splitMonth(i, style, draft.goalPerMonth);
  const L = livingFor(i);
  const due = r.goalMonths ? monthsFromNow(r.goalMonths, draft) : null;
  const funAll = r.fun + r.learn + r.give;
  const payday = draft.incomeType === 'regular' && draft.payday ? `On the ${ordinal(draft.payday)}` : 'On payday';
  const early = draft.moneyStyle === 'disappears' || draft.moneyStyle === 'save' ? ' first thing in the morning' : '';

  const bar: [number, string, string][] = (
    [
      [r.fixed, money.fixed, `Rent & bills ${baht(r.fixed)}`],
      [r.living, money.living, `Living ${baht(r.living)}`],
      [r.net + r.invest, money.safetyNet, `Safety net ${baht(r.net + r.invest)}`],
      [r.goal, money.goal, `${short} ${baht(r.goal)}`],
      [funAll, money.fun, style === 'savefirst' ? `Spend freely ${baht(funAll)}` : `Fun ${baht(funAll)}`],
    ] as [number, string, string][]
  ).filter(([n]) => n > 0);

  const day: {
    k: string;
    v: number;
    icon: 'food' | 'travel' | 'health' | 'fun';
    color: string;
  }[] = [
    { k: 'Food', v: L.food / 30, icon: 'food', color: CATEGORY.food.color },
    {
      k: 'Transport',
      v: L.transport / 30,
      icon: 'travel',
      color: CATEGORY.transport.color,
    },
    {
      k: 'Health & home',
      v: (L.health + L.household) / 30,
      icon: 'health',
      color: CATEGORY.health_beauty.color,
    },
    { k: 'Fun', v: funAll / 30, icon: 'fun', color: money.fun },
  ];

  // Road to the goal: now, two stops, the goal.
  const road: { when: string; amount: string }[] = [];
  if (monthly) {
    road.push({ when: 'Now', amount: baht(0) }, { when: '3 months', amount: baht(r.goal * 3) }, { when: '6 months', amount: baht(r.goal * 6) }, { when: '1 year', amount: baht(r.goal * 12) });
  } else if (r.goalMonths && due) {
    const n = r.goalMonths;
    road.push({ when: 'Now', amount: baht(i.goal.saved) });
    for (const m of [Math.round(n / 3), Math.round((2 * n) / 3)].filter((m, k, a) => m > 0 && m < n && a.indexOf(m) === k)) {
      road.push({
        when: monthYear(monthsFromNow(m, draft)),
        amount: baht(Math.min(i.goal.target, i.goal.saved + r.goal * m)),
      });
    }
    road.push({ when: monthYear(due), amount: `${short}!` });
  }

  const rules = [
    r.goal + r.net > 0
      ? `${payday}, ${baht(r.goal + r.net + r.invest)} moves out${early}: ${baht(r.goal)} to ${short}${r.net ? `, ${baht(r.net)} to your safety net` : ''}${r.invest ? `, ${baht(r.invest)} to your freedom jar` : ''}.`
      : `${payday}, rent and bills go first.`,
    `You get ${baht(r.daily)} a day. Spend less → the rest goes to ${draft.goalKind === 'safety_net' ? short : 'your safety net'} on payday.`,
    ...leakRules(draft.leaks, i).map((x) => `${x.title}: ${x.rule}`),
    monthly ? `Bad month? I lower ${short} first — never food or rent — and tell you.` : `Bad month? I lower ${short} first — never food or rent — and tell you the new date.`,
    monthly ? 'Bonus or a good month? Put it in — I’ll show you what it adds up to.' : `Bonus or a good month? Put it in and I show you how much sooner ${short} gets.`,
  ];

  const tabFor = (k: Style) => {
    const x = splitMonth(i, k, k === style ? draft.goalPerMonth : null);
    const when = monthly ? `${baht(x.goal + x.net)}/mo` : x.goalMonths ? monthYear(monthsFromNow(x.goalMonths, draft)) : 'Not yet';
    return { when, day: baht(x.daily), r: x };
  };
  const kipR = tabFor('kip').r;
  const vsKip: { text: string; good: boolean }[] = [];
  if (style !== 'kip') {
    if (!monthly && r.goalMonths && kipR.goalMonths && r.goalMonths !== kipR.goalMonths) {
      const m = Math.abs(r.goalMonths - kipR.goalMonths);
      vsKip.push({
        text: `${short} ${m} month${m > 1 ? 's' : ''} ${r.goalMonths < kipR.goalMonths ? 'sooner' : 'later'}`,
        good: r.goalMonths < kipR.goalMonths,
      });
    }
    const saved = r.savedIn12 - kipR.savedIn12;
    if (Math.abs(saved) >= 100)
      vsKip.push({
        text: `${baht(Math.abs(saved))} ${saved > 0 ? 'more' : 'less'} saved a year`,
        good: saved > 0,
      });
    const day = r.daily - kipR.daily;
    if (Math.abs(day) >= 10)
      vsKip.push({
        text: `${baht(Math.abs(day))} ${day > 0 ? 'more' : 'less'} a day`,
        good: day > 0,
      });
  }

  return (
    <SetupScreen step={4} footer={<Button label={`Choose ${s.name}`} onPress={() => router.push('/setup/yours')} />}>
      <Title>Pick your plan</Title>
      <Text style={styles.sub}>Same pay, four ways to run it. Tap a tab — the page under it is that plan.</Text>

      <View>
        {/* A binder: each style is a tab with its own headline numbers; the picked tab joins the page below it. */}
        <View style={styles.tabs} accessibilityRole="tablist">
          {STYLES.map((x) => {
            const on = x.key === style;
            const t = tabFor(x.key);
            return (
              <Pressable
                key={x.key}
                onPress={() => update({ budgetStyle: x.key, goalPerMonth: null })}
                style={[styles.tab, on ? [styles.tabOn, { backgroundColor: x.tagColor }] : styles.tabOff]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${x.name}: ${t.when}, ${t.day} a day`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[styles.tabName, on && { fontFamily: fonts.bold }]} numberOfLines={1}>
                    {x.name.replace('50 / 30 / 20', '50/30/20')}
                  </Text>
                </View>
                <Text style={[styles.tabWhen, on && { fontSize: 15 }]} numberOfLines={1}>
                  {t.when}
                </Text>
                <Text style={[styles.tabDay, on && { color: colors.ink }]}>{t.day}/day</Text>
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
            <Text style={styles.heroText}>Best for you if: {BEST[style](draft, short)}</Text>
          </View>

          {style !== 'kip' && (
            <View style={{ gap: 6, paddingHorizontal: 2 }}>
              <Text style={[styles.head, { color: 'rgba(17,17,17,0.6)' }]}>VS KIP’S PLAN</Text>
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
                    <Text style={styles.diffText}>Same as Kip’s plan for you — your date already needs the most you can save.</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.stats}>
            <Stat k={short} v={monthly ? `${baht(r.goal)}/mo` : due ? monthYear(due) : 'Not yet'} />
            <Stat k="Saved in 1 year" v={baht(r.savedIn12)} sub={r.netIn12 > 0 ? `${short} ${baht(r.goalIn12)} + safety ${baht(r.netIn12)}` : undefined} />
            <Stat k="Spend a day" v={baht(r.daily)} />
            <Stat k={style === 'savefirst' ? 'After saving' : 'Fun a month'} v={style === 'savefirst' ? 'One pot' : baht(funAll)} />
          </View>

          <View style={styles.card}>
            <Text style={styles.head}>YOUR MONTH</Text>
            <View style={styles.bar}>
              {bar.map(([n, c], k) => (
                <View
                  key={k}
                  style={{
                    flex: n,
                    backgroundColor: c,
                    borderRightWidth: k < bar.length - 1 ? 2 : 0,
                    borderColor: '#FFFFFF',
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
            <Text style={styles.head}>A NORMAL DAY · {baht(r.daily)}</Text>
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
              <Text style={styles.head}>ROAD TO {short.toUpperCase()}</Text>
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
            <Text style={styles.head}>HOW KIP RUNS IT</Text>
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
      <Text style={styles.foot}>This is a starting plan. After a few weeks of real spending — subscriptions especially — I’ll update it with your real numbers.</Text>
    </SetupScreen>
  );
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

const styles = StyleSheet.create({
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
    borderColor: 'rgba(17,17,17,0.2)',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: 'rgba(17,17,17,0.1)',
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
  numText: { fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' },
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
});
