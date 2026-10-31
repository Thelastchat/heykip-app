import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { Button } from '@/components/ui';
import { baht } from '@/lib/money';
import { useSetup } from '@/lib/setup/draft';
import { makePlan, monthYear, ordinal } from '@/lib/setup/plan';
import { leakRules } from '@/lib/setup/rules';
import { colors, fonts } from '@/theme';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { ICON3D, goalTypeIcon3D, type Icon3D } from '@/lib/icons3d';

const CONFETTI = [colors.lime, colors.orange, colors.sky, colors.lavender, colors.pink, colors.sage];

// Yay! The plan is ready — Kip celebrates, then the short version.
export default function SetupCongrats() {
  const { draft } = useSetup();
  const insets = useSafeAreaInsets();
  const plan = makePlan(draft);
  const monthly = draft.goalKind === 'monthly';
  // What Kip will actually do with their answers: the payday habit, then their money leaks.
  const day = draft.incomeType === 'regular' && draft.payday ? `on the ${ordinal(draft.payday)}` : 'on payday';
  // Each rule gets the 3D icon of the money it's about.
  const LEAK_ICON: Record<string, Icon3D> = {
    delivery: 'bowl',
    coffee: 'bowl',
    snacks: 'bowl',
    grab: 'car',
    shopping: 'shop',
    sales: 'shop',
    goingOut: 'fun',
    bubbleTea: 'fun',
    games: 'fun',
    treating: 'fun',
    beauty: 'heart',
    subscriptions: 'phone',
  };
  const rules = leakRules(draft.leaks, plan.inputs).slice(0, 2);
  const howIcons: Icon3D[] = ['income', ...rules.map((r) => LEAK_ICON[r.key] ?? 'piggy')];
  const how = [
    `${baht(plan.monthlySave + plan.safetyMonthly)} moves to ${plan.short}${plan.safetyMonthly && draft.goalKind !== 'safety_net' ? ' and your safety net' : ''} ${day}${draft.moneyStyle === 'disappears' || draft.moneyStyle === 'save' ? ', first thing in the morning' : ''}`,
    ...rules.map((r) => r.rule.split('. ')[0].replace(/\.$/, '')),
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <GlowBackground mood="fast" />
      <Confetti />
      <View style={{ alignItems: 'center' }}>
        <Kip mood="celebrate" size={140} />
      </View>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={styles.h1}>Yay! Your plan is ready</Text>
        <Text style={styles.sub}>Worked out from your numbers.</Text>
      </View>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image source={ICON3D[goalTypeIcon3D(draft.goalType)]} style={{ width: 44, height: 44 }} contentFit="contain" />
          <Text style={[styles.cardTitle, { flex: 1 }]}>{monthly ? `${baht(plan.monthlySave)} every month for ${plan.short}` : `${plan.short} in ${monthYear(plan.due)}`}</Text>
        </View>
        <Text style={styles.cardText}>
          {baht(plan.monthlySave)} a month · {baht(plan.dailySpend)} a day to spend
          {draft.goalKind === 'safety_net' ? '' : ' · a safety net growing from day one'}
        </Text>
        <View style={styles.rule} />
        <Text style={styles.howHead}>HOW I’LL RUN IT</Text>
        {how.map((line, i) => (
          <View key={line} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4 }}>
            <Image source={ICON3D[howIcons[i] ?? 'piggy']} style={{ width: 34, height: 34 }} contentFit="contain" />
            <Text style={[styles.cardText, { flex: 1 }]}>{line}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22 }}>
        <Pressable onPress={() => router.push('/setup/everything')} hitSlop={10} accessibilityRole="link">
          <Text style={styles.link}>See what I used</Text>
        </Pressable>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: -8 }}>optional · you can change it any time in the app</Text>
      <View style={{ marginTop: 'auto' }}>
        <Button label="Make my promise" onPress={() => router.push('/setup/sign')} />
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
  rule: { height: 1, backgroundColor: 'rgba(17,17,17,0.1)', marginVertical: 4 },
  howHead: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.5, color: colors.muted },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
  screen: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 20, gap: 16 },
  h1: { fontFamily: fonts.semibold, fontSize: 32, letterSpacing: -0.6, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center' },
  card: {
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 6,
    boxShadow: '0 16px 36px rgba(17,17,17,0.06)',
  },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink, paddingRight: 20 },
  cardText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
});
