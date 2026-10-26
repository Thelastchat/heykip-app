import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
      <Muted>Your money, Kip settings, plan and privacy arrive in Step 4.</Muted>
      <Button label="Log out" kind="secondary" onPress={signOut} />
    </ScrollView>
  );
}
