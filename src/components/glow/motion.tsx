// Small pieces of movement used across the glow screens.
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

/** Blocks rise in one after another when a screen opens. */
export function RiseIn({ delay = 0, children, style }: { delay?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(650).springify().damping(16)} style={style}>
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A press that squishes a little and springs back. The style (size, position) is on the pressable itself, so the whole area is tappable. */
export function Squish({ children, style, onPress, haptic = true, ...rest }: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle>; haptic?: boolean }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, a]}
      onPressIn={() => (s.value = withSpring(0.965, { damping: 18, stiffness: 400 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 12, stiffness: 300 }))}
      onPress={(e) => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}>
      {children}
    </AnimatedPressable>
  );
}

/** A number that counts to its value (and from its last value when it changes). */
export function CountUp({ value, format, style, ms = 1000 }: { value: number; format: (n: number) => ReactNode; style?: StyleProp<TextStyle>; ms?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);
  return <Text style={style}>{format(Math.round(shown))}</Text>;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A ring that fills to `pct` (0–1). */
export function Ring({
  pct,
  size = 64,
  stroke = 6,
  color,
  track = 'rgba(17,17,17,0.07)',
  delay = 400,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
  track?: string;
  delay?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    const id = setTimeout(() => (p.value = withTiming(Math.max(0, Math.min(1, pct)), { duration: 1100, easing: Easing.out(Easing.cubic) })), delay);
    return () => clearTimeout(id);
  }, [pct, p, delay]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={props} />
    </Svg>
  );
}

/** Gentle up-and-down float for the 3D icons. */
export function Float({ children, delay = 0, amount = 4, style }: { children: ReactNode; delay?: number; amount?: number; style?: StyleProp<ViewStyle> }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2250, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [t, delay]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -amount * t.value }, { rotate: `${-4 * t.value}deg` }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}
