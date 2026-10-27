import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { House, Target } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { colors, shadow } from '@/theme';

// Floating 3-item bar: Home · Kip (centre, opens Talk) · Goals.
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;

  const go = (name: 'index' | 'goals') => {
    Haptics.selectionAsync();
    const route = state.routes.find((r) => r.name === name);
    if (route) navigateToTab(route.key);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        <TabIcon label="Home" active={current === 'index'} onPress={() => go('index')}>
          <House size={22} weight={current === 'index' ? 'fill' : 'regular'} color={current === 'index' ? '#FFFFFF' : colors.ink} />
        </TabIcon>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tell Kip"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/talk');
          }}
          style={styles.kip}>
          <Kip size={63} />
        </Pressable>

        <TabIcon label="Goals" active={current === 'goals'} onPress={() => go('goals')}>
          <Target size={22} weight={current === 'goals' ? 'fill' : 'regular'} color={current === 'goals' ? '#FFFFFF' : colors.ink} />
        </TabIcon>
      </View>
    </View>
  );
}

function TabIcon({ label, active, onPress, children }: { label: string; active: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={8}
      style={[styles.icon, active && { backgroundColor: colors.ink }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: {
    width: 256,
    height: 72,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    ...shadow.card,
  },
  icon: { width: 52, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
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
});
