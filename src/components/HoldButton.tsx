// A button you press and hold to do something that can't be undone (Start fresh). It fills from the left while you
// hold; letting go early empties it and nothing happens. A tap alone never fires it.
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, fonts, themed } from '@/theme';

export function HoldButton({ label, onDone, ms = 1800, disabled, demo }: { label: string; onDone: () => void; ms?: number; disabled?: boolean; demo?: number }) {
  const p = useSharedValue(demo ?? 0);
  useEffect(() => {
    if (demo != null) p.value = demo;
  }, [demo, p]);
  const done = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onDone();
  };
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        p.value = withTiming(1, { duration: ms * (1 - p.value), easing: Easing.linear }, (finished) => {
          if (finished) runOnJS(done)();
        });
      }}
      onPressOut={() => {
        if (p.value >= 1) return;
        cancelAnimation(p);
        p.value = withTiming(0, { duration: 220 });
      }}
      style={[styles.btn, disabled && { opacity: 0.45 }]}
      accessibilityRole="button"
      accessibilityHint={label}>
      <Animated.View style={[styles.fill, fill]} />
      <View style={styles.inner} pointerEvents="none">
        <Text style={styles.text}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    btn: { height: 56, borderRadius: 999, backgroundColor: colors.ink, overflow: 'hidden', justifyContent: 'center' },
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.orangeText },
    inner: { alignItems: 'center' },
    text: { fontFamily: fonts.medium, fontSize: 16, color: colors.paper },
  }),
);
