// Kip is thinking: three dots that rise and fall one after another, like a friend typing in Messenger or WhatsApp
// (approved 28 Nov). Under Reduce Motion they sit still and fade gently instead (Reanimated's default).
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme';

function Dot({ delay }: { delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }), withTiming(0, { duration: 300 })), -1));
  }, [delay, p]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * p.value }], opacity: 0.35 + 0.55 * p.value }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.ink }, style]} />;
}

export function TypingDots() {
  return (
    <View style={{ flexDirection: 'row', gap: 5, height: 21, alignItems: 'center' }} accessible accessibilityLabel="Kip is thinking">
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </View>
  );
}
