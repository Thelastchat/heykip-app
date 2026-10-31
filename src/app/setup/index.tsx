import { Redirect, router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Kip } from '@/components/Kip';
import { Glass } from '@/components/glow/Glass';
import { SetupScreen } from '@/components/setup/kit';
import { Button, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ICON3D, type Icon3D } from '@/lib/icons3d';
import { useSetup } from '@/lib/setup/draft';
import { colors, fonts } from '@/theme';

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
        <T style={{ textAlign: 'center', fontFamily: fonts.regular, fontSize: 38, lineHeight: 44, letterSpacing: -1.2 }}>Hi, I’m Kip.</T>
        <Text style={styles.lead}>I help you save for the things you actually want — not just track where your money went.</Text>
      </View>

      <Glass radius={26} style={{ marginTop: 10 }} innerStyle={styles.card}>
        <Feature icon="expense" title="Just tell me what you spent" sub="I’ll sort it. No spreadsheets." />
        <Feature icon="shop" title="Ask “Can I buy this?”" sub="I’ll find a way that doesn’t hurt your goals." />
        <Feature icon="plane" title="Pin your goals" sub="A trip, a phone, a car — I’ll keep them on track." />
      </Glass>
    </SetupScreen>
  );
}

function Feature({ icon, title, sub }: { icon: Icon3D; title: string; sub: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Image source={ICON3D[icon]} style={{ width: 46, height: 46 }} contentFit="contain" />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted }}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted, textAlign: 'center' },
  card: { gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  note: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
