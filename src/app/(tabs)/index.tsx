import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Plus, UserCircle } from 'phosphor-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Muted, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme';

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good morning!';
  if (h < 17) return 'Good afternoon!';
  if (h < 21) return 'Get home safe!';
  return 'It’s late, get some rest';
}

// Home — placeholder for Step 4. Already has the avatar → Profile and the floating +.
export default function Home() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 200, gap: 14 }}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={() => router.push('/profile')} style={styles.avatar}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ width: 46, height: 46 }} />
            ) : (
              <UserCircle size={46} color={colors.ink} weight="light" />
            )}
          </Pressable>
        </View>

        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <T variant="greeting">{greeting()}</T>
        </View>

        <Card>
          <T variant="bodyStrong">Home is on its way</T>
          <Muted style={{ marginTop: 4 }}>Goals, “Left to spend today” and “Where it went” arrive in Step 4.</Muted>
        </Card>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add it yourself"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/add');
        }}
        style={[styles.fab, { bottom: 116 + Math.max(insets.bottom, 12) - 12 }]}>
        <Plus size={28} color="#FFFFFF" weight="bold" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(17,17,17,0.28)',
  },
});
