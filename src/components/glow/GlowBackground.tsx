// One soft field behind the whole screen, with slow-drifting glows. It never scrolls, so the cards
// float over a single surface. The glow warms to peach when spending runs a bit fast.
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop, Circle } from 'react-native-svg';

import { glow } from '@/theme';

export type GlowMood = 'calm' | 'fast';

type Blob = { color: string; size: number; x: number; y: number; dx: number; dy: number; s: number; ms: number; opacity: number };

export function GlowBackground({ mood = 'calm' }: { mood?: GlowMood }) {
  const { width, height } = useWindowDimensions();
  const blobs: Blob[] = [
    { color: mood === 'fast' ? glow.peachWarm : glow.peach, size: 1.0, x: 0.55, y: -0.08, dx: -40, dy: 50, s: 1.12, ms: 12000, opacity: 0.6 },
    { color: mood === 'fast' ? glow.peach : glow.cream, size: 0.75, x: 0.0, y: 0.12, dx: -30, dy: 40, s: 1.12, ms: 16000, opacity: 0.5 },
    { color: mood === 'fast' ? glow.cream : glow.yellow, size: 1.05, x: -0.25, y: 0.34, dx: 60, dy: -30, s: 0.9, ms: 14000, opacity: 0.55 },
    { color: glow.lavender, size: 1.0, x: 0.45, y: 0.66, dx: -30, dy: -50, s: 1.15, ms: 10000, opacity: 0.65 },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="field" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={glow.field[0]} />
            <Stop offset="0.4" stopColor={glow.field[1]} />
            <Stop offset="0.75" stopColor={glow.field[2]} />
            <Stop offset="1" stopColor={glow.field[3]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#field)" />
      </Svg>
      {blobs.map((b, i) => (
        <Drift key={i} blob={b} width={width} height={height} id={`g${i}`} />
      ))}
    </View>
  );
}

function Drift({ blob, width, height, id }: { blob: Blob; width: number; height: number; id: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: blob.ms, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t, blob.ms]);
  const size = width * blob.size;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: blob.dx * t.value }, { translateY: blob.dy * t.value }, { scale: 1 + (blob.s - 1) * t.value }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', left: blob.x * width, top: blob.y * height, width: size, height: size, opacity: blob.opacity }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={blob.color} stopOpacity="1" />
            <Stop offset="0.45" stopColor={blob.color} stopOpacity="0.7" />
            <Stop offset="1" stopColor={blob.color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}
