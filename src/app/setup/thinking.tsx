import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { nth } from '@/components/setup/kit';
import { livingFor, livingTotal, plan as splitMonth, type Style } from '@/lib/brain';
import { STYLES } from '@/lib/budget';
import { t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { useSetup, type MoneyStyle } from '@/lib/setup/draft';
import { makePlan, monthYear, monthsFromNow } from '@/lib/setup/plan';
import { leakRules } from '@/lib/setup/rules';
import { colors, fonts } from '@/theme';
import { GlowBackground } from '@/components/glow/GlowBackground';

type Step = { doing: string; found: string; ms: number };

const HABIT: Record<MoneyStyle, (day: string) => string> = {
  disappears: (day) => t('Your saving moves first thing {day} — before you can spend it', { day }),
  treat: () => t('Your payday treat is planned in fun money — no guilt'),
  bills: (day) => t('Saving moves {day}, together with rent and bills', { day }),
  save: (day) => t('I’ll move your saving for you {day}, every month', { day }),
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
    const day = draft.incomeType === 'regular' && draft.payday ? t('on the {day}', { day: nth(draft.payday) }) : t('on payday');
    const out: Step[] = [
      {
        doing: t('Reading your pay'),
        found: t('{income} {day} · rent & bills take {share}% — {note}', {
          income: baht(i.income),
          day,
          share,
          note: share <= 30 ? t('healthy') : share <= 45 ? t('a big share, but workable') : t('a lot, so I plan carefully'),
        }),
        ms: 1100,
      },
      {
        doing: t('Pricing real life in Thailand'),
        found: t('Food {perDay} a day, transport {transport} — {total} a month to live', { perDay: baht(Math.round(L.food / 30)), transport: baht(L.transport), total: baht(livingTotal(L)) }),
        ms: 1300,
      },
      emergency
        ? { doing: t('Planning your emergency fund'), found: t('It is your safety net — I won’t double-save'), ms: 900 }
        : { doing: t('Building your safety net'), found: t('{amount} a month · full by {date}', { amount: baht(r.net), date: monthYear(monthsFromNow(Math.min(r.netMonths, 240), draft)) }), ms: 1000 },
      monthly
        ? { doing: t('Fitting {goal} into your month…', { goal: plan.short }), found: t('{amount} a month → {year} in a year', { amount: baht(r.goal), year: baht(r.goal * 12) }), ms: 1600 }
        : {
            doing: t('Fitting {goal} into your month…', { goal: plan.short }),
            found:
              r.goalMonths && r.goal > 0
                ? draft.sideIncome
                  ? t('{need} ÷ {amount} a month + side money → {date}', { need: baht(Math.max(0, i.goal.target - i.goal.saved)), amount: baht(r.goal), date: monthYear(plan.due) })
                  : t('{need} ÷ {amount} a month → {date}', { need: baht(Math.max(0, i.goal.target - i.goal.saved)), amount: baht(r.goal), date: monthYear(plan.due) })
                : t('Nothing spare yet — every day under budget goes to {goal}', { goal: plan.short }),
            ms: 1600,
          },
      { doing: t('Testing 4 money styles'), found: compareStyles(), ms: 1500 },
    ];
    if (draft.moneyStyle) out.push({ doing: t('Your payday habit'), found: HABIT[draft.moneyStyle](day), ms: 900 });
    const rules = leakRules(draft.leaks, i);
    if (rules.length) {
      out.push({
        doing: t('Watching {things}', {
          things: rules
            .slice(0, 2)
            .map((x) => x.title.toLowerCase())
            .join(' & '),
        }),
        found: rules
          .slice(0, 2)
          .map((x) => (x.key === 'delivery' ? x.rule.split(',')[0].replace('A delivery budget of ', 'Delivery ') : x.key === 'shopping' ? t('Shopping over ฿500 waits 24 h') : x.rule.split('.')[0]))
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
          ? t('Kip’s plan fits you best — fun stays {fun}', { fun: baht(kip.fun) })
          : t('{style} saves {more} more a year; Kip’s plan keeps fun at {fun}', { style: most.s.name, more: baht(most.r.savedIn12 - kip.savedIn12), fun: baht(kip.fun) });
      }
      const fastest = res.filter((x) => x.r.goalMonths).reduce((a, b) => ((b.r.goalMonths ?? 999) < (a.r.goalMonths ?? 999) ? b : a), res[0]);
      const diff = (kip.goalMonths ?? 0) - (fastest.r.goalMonths ?? 0);
      return fastest.s.key !== 'kip' && diff > 0
        ? diff > 1
          ? t('{style} gets you there {n} months sooner — Kip’s plan keeps {daily} a day', { style: fastest.s.name, n: diff, daily: baht(kip.daily) })
          : t('{style} gets you there {n} month sooner — Kip’s plan keeps {daily} a day', { style: fastest.s.name, n: diff, daily: baht(kip.daily) })
        : t('Kip’s plan is already the fastest that still feels comfortable');
    }
  }

  const [done, setDone] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const total = steps.reduce((a, s) => a + s.ms, 0);

  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.timing(progress, { toValue: 1, duration: total + 400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
    let timer: ReturnType<typeof setTimeout>;
    let n = 0;
    const next = () => {
      if (n >= steps.length) {
        timer = setTimeout(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.replace('/setup/congrats');
        }, 500);
        return;
      }
      timer = setTimeout(() => {
        n += 1;
        setDone(n);
        Haptics.selectionAsync().catch(() => {});
        next();
      }, steps[n].ms);
    };
    next();
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 28, paddingBottom: Math.max(insets.bottom, 16) + 18 }]}>
      <GlowBackground />
      <View style={{ alignItems: 'center' }}>
        <Kip mood="think" size={120} />
      </View>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={styles.h1}>{t('Making your plan…')}</Text>
        <Text style={styles.sub}>{t('Every number below comes from what you told me.')}</Text>
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
  screen: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 20, gap: 14 },
  h1: { fontFamily: fonts.semibold, fontSize: 26, letterSpacing: -0.4, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  list: {
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    boxShadow: '0 16px 36px rgba(17,17,17,0.06)',
  },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 7 },
  doing: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  found: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#2E2E2A' },
  tick: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: colors.lime, borderTopColor: colors.ink },
  empty: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D6D6CF' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(17,17,17,0.08)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.ink },
});
