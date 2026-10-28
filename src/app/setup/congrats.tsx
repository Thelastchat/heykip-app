import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { Button } from '@/components/ui';
import { baht } from '@/lib/money';
import { useSetup } from '@/lib/setup/draft';
import { typeInfo } from '@/lib/setup/goalTypes';
import { makePlan, monthYear } from '@/lib/setup/plan';
import { colors, fonts } from '@/theme';

const CONFETTI = [colors.lime, colors.orange, colors.sky, colors.lavender, colors.pink, colors.sage];

// Yay! The plan is ready — Kip celebrates, then the short version.
export default function SetupCongrats() {
  const { draft } = useSetup();
  const insets = useSafeAreaInsets();
  const plan = makePlan(draft);
  const monthly = draft.goalKind === 'monthly';
  const icon = typeInfo(draft.goalType, draft.goalKind).key === 'trip' ? '✈︎ ' : '';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 70, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <Confetti />
      <View style={{ alignItems: 'center' }}>
        <Kip mood="celebrate" size={170} />
      </View>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={styles.h1}>Yay! Your plan is ready</Text>
        <Text style={styles.sub}>Worked out from your numbers.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {icon}
          {monthly ? `${baht(plan.monthlySave)} every month for ${plan.short}` : `${plan.short} in ${monthYear(plan.due)}`}
        </Text>
        <Text style={styles.cardText}>
          {baht(plan.monthlySave)} a month · {baht(plan.dailySpend)} a day to spend
          {draft.goalKind === 'safety_net' ? '' : ' · a safety net growing from day one'}
        </Text>
      </View>
      <Pressable onPress={() => router.push('/setup/everything')} hitSlop={10} style={{ alignItems: 'center', gap: 2 }} accessibilityRole="link">
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' }}>See what I used →</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>optional · check or change any number</Text>
      </Pressable>
      <View style={{ marginTop: 'auto' }}>
        <Button label="Pick my plan" onPress={() => router.push('/setup/plan')} />
      </View>
    </View>
  );
}

/** Brand-colour confetti falling once behind Kip. */
function Confetti() {
  const { width } = useWindowDimensions();
  const pieces = useRef(
    Array.from({ length: 22 }, (_, i) => ({
      x: (i * 97) % width,
      delay: (i % 7) * 90,
      color: CONFETTI[i % CONFETTI.length],
      round: i % 3 === 0,
      turn: (i % 2 ? 1 : -1) * (180 + (i % 5) * 60),
      fall: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    Animated.stagger(
      30,
      pieces.map((p) => Animated.timing(p.fall, { toValue: 1, duration: 1800 + p.delay * 4, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    ).start();
  }, [pieces]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: -20,
            width: p.round ? 8 : 10,
            height: p.round ? 8 : 18,
            borderRadius: p.round ? 4 : 3,
            backgroundColor: p.color,
            opacity: p.fall.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0.9] }),
            transform: [
              { translateY: p.fall.interpolate({ inputRange: [0, 1], outputRange: [0, 260 + (i % 4) * 60] }) },
              { rotate: p.fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.turn}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, gap: 16 },
  h1: { fontFamily: fonts.semibold, fontSize: 32, letterSpacing: -0.6, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center' },
  card: { borderRadius: 22, borderWidth: 1, borderColor: colors.ink, paddingVertical: 16, paddingHorizontal: 18, gap: 6 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink, paddingRight: 20 },
  cardText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
});
