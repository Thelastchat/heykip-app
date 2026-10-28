import { router } from 'expo-router';
import { Check } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton, SetupScreen, Title } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { baht } from '@/lib/money';
import { useSetup } from '@/lib/setup/draft';
import { makePlan } from '@/lib/setup/plan';
import { finishSetup, type PlanChoice } from '@/lib/setup/save';
import { colors, fonts, radius, shadow } from '@/theme';

type Tier = 'yearly' | 'monthly' | 'student';
const PRICE: Record<Tier, { amount: number; per: 'yr' | 'mo'; perDay: string }> = {
  yearly: { amount: 690, per: 'yr', perDay: '฿1.9' },
  monthly: { amount: 129, per: 'mo', perDay: '฿4.3' },
  student: { amount: 590, per: 'yr', perDay: '฿1.6' },
};

// What's free forever vs what Kip Plus adds. The plan itself is never behind the paywall.
const TABLE: [string, string, string][] = [
  ['Your plan, goal & promise', '✓', '✓'],
  ['Log spending yourself', '✓', '✓'],
  ['Payday: Kip moves your saving', '—', '✓'],
  ['Delivery & shopping nudges', '—', '✓'],
  ['Kip rebalances when life happens', '—', '✓'],
  ['3 goals · “Can I buy this?”', '1', '✓'],
  ['Log by voice or slip photo', '—', '✓'],
];

// The last Setup step. Payments come with the store build; for now "Start 7 days free" starts the trial.
export default function SetupPaywall() {
  const { session, refreshProfile } = useAuth();
  const { draft, reset } = useSetup();
  const plan = makePlan(draft);
  const [tier, setTier] = useState<Tier>('yearly');
  const [busy, setBusy] = useState<PlanChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const price = PRICE[tier];

  async function finish(choice: PlanChoice) {
    if (!session) {
      router.push('/sign-in');
      return;
    }
    setBusy(choice);
    setError(null);
    try {
      await finishSetup(session.user.id, draft, choice);
      reset();
      await refreshProfile(); // flips the app to Home
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again?');
      setBusy(null);
    }
  }

  return (
    <SetupScreen
      footer={
        <>
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Try Plus free for 7 days" loading={busy === 'trial'} disabled={busy !== null} onPress={() => finish('trial')} />
          <Text style={styles.fine}>
            Kip reminds you 2 days before you’re charged · cancel in 2 taps · then {baht(price.amount)} a {price.per === 'yr' ? 'year' : 'month'}
          </Text>
          <Pressable hitSlop={8} disabled={busy !== null} onPress={() => finish('free')} accessibilityRole="button">
            <Text style={styles.free}>{busy === 'free' ? 'Saving…' : 'Keep my free plan'}</Text>
          </Pressable>
        </>
      }>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BackButton size={46} />
        <View style={styles.chip}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }} numberOfLines={1}>
            {plan.mode === 'noRoom'
              ? `${plan.short} · pinned`
              : draft.goalKind === 'monthly'
                ? `${plan.short} · ${baht(plan.monthlySave)}/mo`
                : `${plan.short} in ${plan.daysToGo} days · ${baht(plan.monthlySave)}/mo`}
          </Text>
        </View>
      </View>

      <View style={styles.saved}>
        <View style={styles.savedTick}>
          <Check size={13} color="#FFFFFF" weight="bold" />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink }}>
          <Text style={styles.strong}>Your plan is saved — free, forever.</Text> {plan.short}, your promise and your month stay yours.
        </Text>
      </View>

      <View style={{ gap: 6 }}>
        <Title>Want Kip to run it for you?</Title>
        <Text style={styles.sub}>
          Kip Plus costs <Text style={styles.strong}>{price.perDay} a day</Text> — less than one delivery fee.{' '}
          {plan.mode === 'noRoom' ? (
            <>Kip finds the small wins that get {plan.short} moving.</>
          ) : (
            <>
              Your plan already saves <Text style={styles.strong}>{baht(plan.monthlySave + plan.safetyMonthly)} a month</Text>.
            </>
          )}
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tRow}>
          <Text style={[styles.tCell, { flex: 1 }]} />
          <Text style={[styles.tHead, { color: colors.muted }]}>FREE</Text>
          <Text style={styles.tHead}>PLUS</Text>
        </View>
        {TABLE.map(([what, free, plus], k) => (
          <View key={what} style={[styles.tRow, k < TABLE.length - 1 && styles.tLine]}>
            <Text style={[styles.tCell, { flex: 1 }]}>{what}</Text>
            <Text style={[styles.tMark, { color: free === '—' ? colors.faint : colors.ink }]}>{free}</Text>
            <Text style={[styles.tMark, { fontFamily: fonts.bold }]}>{plus}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: 12, marginTop: 8 }}>
        <Option on={tier === 'yearly'} onPress={() => setTier('yearly')} title="Yearly" sub="First-member price, locked in" price={690} per="yr" was={990} badge="BEST VALUE" />
        <Option on={tier === 'monthly'} onPress={() => setTier('monthly')} title="Monthly" sub="Cancel any time" price={129} per="mo" color={colors.sky} />
        {tier === 'student' && <Option on onPress={() => {}} title="Student" sub="With a student email or ID" price={590} per="yr" color={colors.lavender} />}
      </View>

      {tier !== 'student' && (
        <Pressable onPress={() => setTier('student')} hitSlop={8} style={{ alignSelf: 'center' }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted }}>
            Student? <Text style={[styles.strong, { textDecorationLine: 'underline' }]}>฿590 a year</Text>
          </Text>
        </Pressable>
      )}
    </SetupScreen>
  );
}

function Option({
  on,
  onPress,
  title,
  sub,
  price,
  per,
  was,
  badge,
  color = colors.lime,
}: {
  on: boolean;
  onPress: () => void;
  title: string;
  sub: string;
  price: number;
  per: 'yr' | 'mo';
  was?: number;
  badge?: string;
  color?: string;
}) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.option, on ? [styles.optionOn, { backgroundColor: color }] : styles.optionOff]}>
      {badge && (
        <View style={styles.badge}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.ink }}>{badge}</Text>
        </View>
      )}
      <View style={[styles.radio, on && { borderWidth: 7, borderColor: colors.ink }]} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {was && <Text style={styles.was}>{baht(was)}</Text>}
        <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.ink, fontVariant: ['tabular-nums'] }}>
          {baht(price)}
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>/{per}</Text>
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  saved: { borderRadius: 16, backgroundColor: colors.lime, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  savedTick: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  table: { borderRadius: 18, backgroundColor: '#F8F6F4', paddingHorizontal: 14, paddingVertical: 4 },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  tLine: { borderBottomWidth: 1, borderBottomColor: 'rgba(17,17,17,0.06)' },
  tCell: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
  tHead: { width: 56, textAlign: 'center', fontFamily: fonts.bold, fontSize: 11, color: colors.ink },
  tMark: { width: 56, textAlign: 'center', fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  chip: { height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.lavender, justifyContent: 'center', flexShrink: 1, marginLeft: 12 },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  strong: { fontFamily: fonts.semibold, color: colors.ink },
  tick: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  option: { borderRadius: 20, borderWidth: 2, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionOn: { borderColor: colors.ink },
  optionOff: { backgroundColor: colors.grey, borderColor: 'transparent' },
  badge: {
    position: 'absolute',
    top: -11,
    left: 16,
    height: 22,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.ink,
    justifyContent: 'center',
  },
  radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, borderColor: '#C9C9C2' },
  was: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textDecorationLine: 'line-through' },
  fine: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  free: { textAlign: 'center', fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
  error: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 13, color: colors.orange },
});
