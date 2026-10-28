import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { livingFor, livingTotal } from '@/lib/brain';
import { baht } from '@/lib/money';
import { useSetup } from '@/lib/setup/draft';
import { makePlan, ordinal } from '@/lib/setup/plan';
import { LEAKS } from '@/lib/setup/plan';
import { colors, fonts } from '@/theme';

const STEP_MS = 620;

// Kip works out the plan, one line at a time, from what the person said — then celebrates.
export default function SetupThinking() {
  const { draft } = useSetup();
  const insets = useSafeAreaInsets();
  const plan = makePlan(draft);
  const i = plan.inputs;
  const L = livingFor(i);
  const leakNames = LEAKS.filter((l) => draft.leaks.includes(l.key)).map((l) => l.label.toLowerCase());

  const lines = [
    draft.incomeType === 'regular' && draft.payday ? `Your pay: ${baht(i.income)} on the ${ordinal(draft.payday)}` : `Your pay: planning on ${baht(i.income)} a month`,
    `Rent & bills out first: ${baht(i.rent + i.bills)}`,
    `Real living costs: ${baht(livingTotal(L))} · food ${baht(Math.round(L.food / 30))} a day`,
    draft.goalKind === 'safety_net' ? 'Your emergency fund comes first' : `A safety net: ${baht(plan.safetyMonthly)} a month`,
    `Fitting ${plan.short} into your month…`,
    'Testing 4 money styles',
    leakNames.length ? `Rules for ${leakNames.slice(0, 2).join(' & ')}` : 'Your payday rule',
  ];

  const [done, setDone] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.timing(progress, { toValue: 1, duration: STEP_MS * lines.length + 300, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
    const t = setInterval(() => {
      setDone((n) => {
        if (n + 1 <= lines.length) Haptics.selectionAsync().catch(() => {});
        return n + 1;
      });
    }, STEP_MS);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (done < lines.length + 1) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace('/setup/congrats');
  }, [done, lines.length]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 52, paddingBottom: Math.max(insets.bottom, 16) + 18 }]}>
      <View style={{ alignItems: 'center' }}>
        <Kip mood="think" size={150} />
      </View>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={styles.h1}>Making your plan…</Text>
        <Text style={styles.sub}>Using everything you told me — nothing generic.</Text>
      </View>
      <View style={styles.list}>
        {lines.map((line, n) => {
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
              <Text style={[styles.lineText, state === 'now' && { fontFamily: fonts.semibold }, state === 'next' && { color: '#A9A9A1' }]}>{line}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ marginTop: 'auto', gap: 10 }}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, gap: 16 },
  h1: { fontFamily: fonts.semibold, fontSize: 26, letterSpacing: -0.4, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  list: { borderRadius: 22, backgroundColor: '#F8F6F4', paddingVertical: 10, paddingHorizontal: 18 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  lineText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  tick: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: colors.lime, borderTopColor: colors.ink },
  empty: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D6D6CF' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(17,17,17,0.08)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.ink },
});
