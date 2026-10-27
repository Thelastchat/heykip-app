import { router } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button, Card, Muted, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme';

// Profile — placeholder for Step 4. Sign-out works now.
export default function Profile() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
      <ScreenHeader title="Profile" />
      <Card>
        <T variant="bodyStrong">Signed in</T>
        <Muted style={{ marginTop: 4 }}>{session?.user.email}</Muted>
      </Card>
      <Pressable accessibilityRole="button" onPress={() => router.push('/kip-moods')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Kip size={44} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">Kip’s moods</T>
            <Muted>See how Kip moves</Muted>
          </View>
          <CaretRight size={18} color={colors.muted} weight="bold" />
        </Card>
      </Pressable>
      <Muted>Your money, Kip settings, plan and privacy arrive in Step 4.</Muted>
      <Button label="Log out" kind="secondary" onPress={signOut} />
    </ScrollView>
  );
}
