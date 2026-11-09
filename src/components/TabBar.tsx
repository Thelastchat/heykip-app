import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { CalendarBlank, House, Target, UserCircle } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { useAuth } from '@/lib/auth';
import { Glass } from '@/components/glow/Glass';
import { t } from '@/lib/i18n';
import { colors, themed } from '@/theme';

// Floating 5-spot bar (approved mockup): Home · Goals · Kip (centre, opens Talk) · Calendar · You.
// Two on each side keeps Kip in the middle. "You" is the person's photo: Profile and settings.
type TabName = 'index' | 'goals' | 'calendar' | 'profile';

export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const current = state.routes[state.index]?.name;

  const go = (name: TabName) => {
    Haptics.selectionAsync();
    const route = state.routes.find((r) => r.name === name);
    if (route) navigateToTab(route.key);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        <Glass radius={999} style={StyleSheet.absoluteFill} innerStyle={{ flex: 1 }} />
        <TabIcon label={t('Home')} active={current === 'index'} onPress={() => go('index')}>
          <House size={22} weight={current === 'index' ? 'fill' : 'regular'} color={current === 'index' ? colors.paper : colors.ink} />
        </TabIcon>
        <TabIcon label={t('Goals')} active={current === 'goals'} onPress={() => go('goals')}>
          <Target size={22} weight={current === 'goals' ? 'fill' : 'regular'} color={current === 'goals' ? colors.paper : colors.ink} />
        </TabIcon>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Tell Kip')}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/talk');
          }}
          style={styles.kip}>
          <Kip size={63} />
        </Pressable>

        <TabIcon label={t('Calendar')} active={current === 'calendar'} onPress={() => go('calendar')}>
          <CalendarBlank size={22} weight={current === 'calendar' ? 'fill' : 'regular'} color={current === 'calendar' ? colors.paper : colors.ink} />
        </TabIcon>
        {/* You: the photo itself, with a black ring when it's the open tab */}
        <TabIcon label={t('You')} active={false} onPress={() => go('profile')} selected={current === 'profile'}>
          <View style={[styles.face, current === 'profile' && styles.faceOn]}>
            {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: 30, height: 30 }} /> : <UserCircle size={30} color={colors.ink} weight="light" />}
          </View>
        </TabIcon>
      </View>
    </View>
  );
}

function TabIcon({ label, active, selected, onPress, children }: { label: string; active: boolean; selected?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: selected ?? active }}
      onPress={onPress}
      hitSlop={8}
      style={[styles.icon, active && { backgroundColor: colors.ink }]}>
      {children}
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
    bar: {
      width: 344,
      height: 72,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
    },
    icon: { width: 52, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    face: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.paper },
    faceOn: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.ink },
    kip: {
      top: -20,
      width: 70,
      height: 70,
      borderRadius: 999,
      backgroundColor: colors.lime,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 0 0 6px #FFFFFF',
    },
  }),
);
