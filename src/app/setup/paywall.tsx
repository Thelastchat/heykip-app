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

const PERKS = ['Log by voice, typing or slips', '“Can I buy this?” plans that protect your goals', 'Week, month and year views', 'Up to 3 pinned goals + saving with friends'];

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
          <Button label="Start 7 days free" loading={busy === 'trial'} disabled={busy !== null} onPress={() => finish('trial')} />
          <Text style={styles.fine}>Kip reminds you 2 days before you’re charged · cancel in 2 taps · then {baht(price.amount)} a {price.per === 'yr' ? 'year' : 'month'}</Text>
          <Pressable hitSlop={8} disabled={busy !== null} onPress={() => finish('free')} accessibilityRole="button">
            <Text style={styles.free}>{busy === 'free' ? 'Saving…' : 'Use the free version (log it yourself)'}</Text>
          </Pressable>
        </>
      }>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BackButton size={46} />
        <View style={styles.chip}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }} numberOfLines={1}>
            {plan.mode === 'noRoom' ? `${plan.short} · pinned` : draft.goalKind === 'monthly' ? `${plan.short} · ${baht(plan.monthlySave)}/mo` : `${plan.short} in ${plan.daysToGo} days · ${baht(plan.monthlySave)}/mo`}
          </Text>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Title>Keep Kip on your side</Title>
        <Text style={styles.sub}>
          HeyKip costs <Text style={styles.strong}>{price.perDay} a day</Text>.{' '}
          {plan.mode === 'noRoom' ? (
            <>Kip finds the small wins that get {plan.short} moving.</>
          ) : (
            <>
              Your plan saves <Text style={styles.strong}>{baht(plan.dailySaving)} a day</Text>.
            </>
          )}
        </Text>
      </View>

      <View style={{ gap: 9, paddingHorizontal: 4, paddingVertical: 2 }}>
        {PERKS.map((p) => (
          <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.tick}>
              <Check size={12} color={colors.ink} weight="bold" />
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.ink, flex: 1 }}>{p}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: 12, marginTop: 8 }}>
        <Option on={tier === 'yearly'} onPress={() => setTier('yearly')} title="Yearly" sub="First-member price, locked in" price={690} per="yr" was={990} badge="BEST VALUE" />
        <Option on={tier === 'monthly'} onPress={() => setTier('monthly')} title="Monthly" sub="Cancel any time" price={129} per="mo" />
        {tier === 'student' && <Option on onPress={() => {}} title="Student" sub="With a student email or ID" price={590} per="yr" />}
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

function Option({ on, onPress, title, sub, price, per, was, badge }: { on: boolean; onPress: () => void; title: string; sub: string; price: number; per: 'yr' | 'mo'; was?: number; badge?: string }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.option, on ? styles.optionOn : styles.optionOff]}>
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
  chip: { height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.lavender, justifyContent: 'center', flexShrink: 1, marginLeft: 12 },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  strong: { fontFamily: fonts.semibold, color: colors.ink },
  tick: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  option: { borderRadius: 20, borderWidth: 2, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionOn: { backgroundColor: '#FFFFFF', borderColor: colors.ink, ...shadow.card },
  optionOff: { backgroundColor: colors.grey, borderColor: 'transparent' },
  badge: { position: 'absolute', top: -11, left: 16, height: 22, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.lime, justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, borderColor: '#C9C9C2' },
  was: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textDecorationLine: 'line-through' },
  fine: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  free: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
  error: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 13, color: colors.orange },
});
