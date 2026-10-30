import { Redirect, router } from 'expo-router';
import { ChatCenteredText, PushPin, ShoppingBag } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Kip } from '@/components/Kip';
import { SetupScreen } from '@/components/setup/kit';
import { Button, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useSetup } from '@/lib/setup/draft';
import { colors, fonts, radius, shadow } from '@/theme';

// Setup 0 · "Hi, I'm Kip." The first screen anyone sees.
export default function SetupIntro() {
  const { session } = useAuth();
  const { draft, ready } = useSetup();

  // Just created an account after signing the promise → straight to the last step.
  if (ready && session && draft.signature) return <Redirect href="/setup/finish" />;

  return (
    <SetupScreen
      footer={
        <>
          <Button label="Let’s start" onPress={() => router.push('/setup/basics')} />
          <Text style={styles.note}>Takes about 3 minutes</Text>
        </>
      }>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', minHeight: 20 }}>
        {!session && (
          <Pressable accessibilityRole="link" hitSlop={10} onPress={() => router.push('/sign-in')}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.muted }}>Log in</Text>
          </Pressable>
        )}
      </View>

      <View style={{ alignSelf: 'center', width: 170, height: 170, marginTop: 4, alignItems: 'center', justifyContent: 'center' }}>
        <Kip size={156} />
      </View>

      <View style={{ gap: 8, paddingHorizontal: 6 }}>
        <T variant="hero" style={{ textAlign: 'center' }}>
          Hi, I’m Kip.
        </T>
        <Text style={styles.lead}>I help you save for the things you actually want — not just track where your money went.</Text>
      </View>

      <View style={styles.card}>
        <Feature color={colors.lime} icon={<ChatCenteredText size={20} color={colors.ink} weight="fill" />} title="Just tell me what you spent" sub="I’ll sort it. No spreadsheets." />
        <Feature color={colors.orange} icon={<ShoppingBag size={20} color={colors.ink} weight="fill" />} title="Ask “Can I buy this?”" sub="I’ll find a way that doesn’t hurt your goals." />
        <Feature color={colors.lavender} icon={<PushPin size={20} color={colors.ink} weight="fill" />} title="Pin your goals" sub="A trip, a phone, a car — I’ll keep them on track." />
      </View>
    </SetupScreen>
  );
}

function Feature({ color, icon, title, sub }: { color: string; icon: ReactNode; title: string; sub: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={[styles.dot, { backgroundColor: color }]}>{icon}</View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted }}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 25, color: '#3D3D38', textAlign: 'center' },
  card: { gap: 16, marginTop: 10, padding: 18, borderRadius: radius.card, backgroundColor: '#FFFFFF', ...shadow.card },
  dot: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  note: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
