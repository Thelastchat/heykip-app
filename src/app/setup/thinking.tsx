import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { livingFor, livingTotal, plan as splitMonth, type Style } from '@/lib/brain';
import { STYLES } from '@/lib/budget';
import { baht } from '@/lib/money';
import { useSetup, type MoneyStyle } from '@/lib/setup/draft';
import { makePlan, monthYear, monthsFromNow, ordinal } from '@/lib/setup/plan';
import { leakRules } from '@/lib/setup/rules';
import { colors, fonts } from '@/theme';

type Step = { doing: string; found: string; ms: number };

const HABIT: Record<MoneyStyle, (day: string) => string> = {
  disappears: (day) => `Your saving moves first thing ${day} — before you can spend it`,
  treat: () => 'Your payday treat is planned in fun money — no guilt',
  bills: (day) => `Saving moves ${day}, together with rent and bills`,
  save: (day) => `I’ll move your saving for you ${day}, every month`,
};

// Kip works out the plan from what the person said. Each line says what Kip is doing, then turns into what it
// found — real numbers from their answers, so no two people see the same screen. About 10 seconds.
export default function SetupThinking() {
  const { draft } = useSetup();
  const insets = useSafeAreaInsets();
  const steps = useRef<Step[]>(buildSteps()).current;

  function buildSteps(): Step[] {
    const plan = makePlan(draft);
    const i = plan.inputs;
    const r = plan.result;
    const L = livingFor(i);
    const fixed = i.rent + i.bills;
    const share = i.income ? Math.round((fixed / i.income) * 100) : 0;
    const monthly = draft.goalKind === 'monthly';
    const emergency = draft.goalKind === 'safety_net';
    const day = draft.incomeType === 'regular' && draft.payday ? `on the ${ordinal(draft.payday)}` : 'on payday';
    const out: Step[] = [
      {
        doing: 'Reading your pay',
        found: `${baht(i.income)} ${day} · rent & bills take ${share}% — ${share <= 30 ? 'healthy' : share <= 45 ? 'a big share, but workable' : 'a lot, so I plan carefully'}`,
        ms: 1100,
      },
      {
        doing: 'Pricing real life in Thailand',
        found: `Food ${baht(Math.round(L.food / 30))} a day, transport ${baht(L.transport)} — ${baht(livingTotal(L))} a month to live`,
        ms: 1300,
      },
      emergency
        ? { doing: 'Planning your emergency fund', found: `It is your safety net — I won’t double-save`, ms: 900 }
        : { doing: 'Building your safety net', found: `${baht(r.net)} a month · full by ${monthYear(monthsFromNow(Math.min(r.netMonths, 240), draft))}`, ms: 1000 },
      monthly
        ? { doing: `Fitting ${plan.short} into your month…`, found: `${baht(r.goal)} a month → ${baht(r.goal * 12)} in a year`, ms: 1600 }
        : {
            doing: `Fitting ${plan.short} into your month…`,
            found:
              r.goalMonths && r.goal > 0
                ? `${baht(Math.max(0, i.goal.target - i.goal.saved))} ÷ ${baht(r.goal)} a month${draft.sideIncome ? ' + side money' : ''} → ${monthYear(plan.due)}`
                : `Nothing spare yet — every day under budget goes to ${plan.short}`,
            ms: 1600,
          },
      { doing: 'Testing 4 money styles', found: compareStyles(), ms: 1500 },
    ];
    if (draft.moneyStyle) out.push({ doing: 'Your payday habit', found: HABIT[draft.moneyStyle](day), ms: 900 });
    const rules = leakRules(draft.leaks, i);
    if (rules.length) {
      out.push({
        doing: `Watching ${rules
          .slice(0, 2)
          .map((x) => x.title.toLowerCase())
          .join(' & ')}`,
        found: rules
          .slice(0, 2)
          .map((x) => (x.key === 'delivery' ? x.rule.split(',')[0].replace('A delivery budget of ', 'Delivery ') : x.key === 'shopping' ? 'Shopping over ฿500 waits 24 h' : x.rule.split('.')[0]))
          .join(' · '),
        ms: 1100,
      });
    }
    return out;

    function compareStyles(): string {
      const res = STYLES.map((s) => ({ s, r: splitMonth(i, s.key as Style) }));
      const kip = res.find((x) => x.s.key === 'kip')!.r;
      if (monthly) {
        const most = res.reduce((a, b) => (b.r.savedIn12 > a.r.savedIn12 ? b : a));
        return most.s.key === 'kip'
          ? `Kip’s plan fits you best — fun stays ${baht(kip.fun)}`
          : `${most.s.name} saves ${baht(most.r.savedIn12 - kip.savedIn12)} more a year; Kip’s plan keeps fun at ${baht(kip.fun)}`;
      }
      const fastest = res.filter((x) => x.r.goalMonths).reduce((a, b) => ((b.r.goalMonths ?? 999) < (a.r.goalMonths ?? 999) ? b : a), res[0]);
      const diff = (kip.goalMonths ?? 0) - (fastest.r.goalMonths ?? 0);
      return fastest.s.key !== 'kip' && diff > 0
        ? `${fastest.s.name} gets you there ${diff} month${diff > 1 ? 's' : ''} sooner — Kip’s plan keeps ${baht(kip.daily)} a day`
        : `Kip’s plan is already the fastest that still feels comfortable`;
    }
  }

  const [done, setDone] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const total = steps.reduce((a, s) => a + s.ms, 0);

  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.timing(progress, { toValue: 1, duration: total + 400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
    let t: ReturnType<typeof setTimeout>;
    let n = 0;
    const next = () => {
      if (n >= steps.length) {
        t = setTimeout(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.replace('/setup/congrats');
        }, 500);
        return;
      }
      t = setTimeout(() => {
        n += 1;
        setDone(n);
        Haptics.selectionAsync().catch(() => {});
        next();
      }, steps[n].ms);
    };
    next();
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 28, paddingBottom: Math.max(insets.bottom, 16) + 18 }]}>
      <View style={{ alignItems: 'center' }}>
        <Kip mood="think" size={120} />
      </View>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={styles.h1}>Making your plan…</Text>
        <Text style={styles.sub}>Every number below comes from what you told me.</Text>
      </View>
      <View style={styles.list}>
        {steps.map((s, n) => {
          const state = n < done ? 'done' : n === done ? 'now' : 'next';
          return (
            <View key={n} style={styles.line}>
              {state === 'done' ? (
                <View style={styles.tick}>
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: fonts.bold, marginTop: -1 }}>✓</Text>
                </View>
              ) : state === 'now' ? (
                <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
              ) : (
                <View style={styles.empty} />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.doing, state === 'now' && { fontFamily: fonts.semibold }, state === 'next' && { color: '#A9A9A1' }]}>{s.doing}</Text>
                {state === 'done' && <Text style={styles.found}>{s.found}</Text>}
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ marginTop: 'auto' }}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, gap: 14 },
  h1: { fontFamily: fonts.semibold, fontSize: 26, letterSpacing: -0.4, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  list: { borderRadius: 22, backgroundColor: '#F8F6F4', paddingVertical: 8, paddingHorizontal: 16 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 7 },
  doing: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  found: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#2E2E2A' },
  tick: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: colors.lime, borderTopColor: colors.ink },
  empty: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D6D6CF' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(17,17,17,0.08)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.ink },
});
