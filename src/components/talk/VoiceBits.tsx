// Talking with Kip out loud, right inside Talk (like a call, no extra screen): the yellow rings that breathe out from
// behind Kip while he listens, the blinking dot, and your words appearing as you say them.
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';

import { colors, fonts, themed } from '@/theme';

/** Two soft yellow rings breathing out from behind Kip — bigger when you're louder. `size` is the ring at rest. */
export function Waves({ size, level, on }: { size: number; level: number; on: boolean }) {
  if (!on) return null;
  return (
    <>
      <Wave size={size} delay={0} level={level} />
      <Wave size={size} delay={1100} level={level} />
    </>
  );
}

function Wave({ size, delay, level }: { size: number; delay: number; level: number }) {
  const t = useSharedValue(0);
  const loud = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false));
  }, [t, delay]);
  useEffect(() => {
    loud.value = withSpring(level, { damping: 14, stiffness: 120 });
  }, [level, loud]);
  const a = useAnimatedStyle(() => ({ opacity: (1 - t.value) * 0.7, transform: [{ scale: 0.7 + t.value * (0.6 + loud.value * 0.35) }] }));
  return <Animated.View style={[styles.wave, { width: size, height: size, borderRadius: size / 2 }, a]} pointerEvents="none" />;
}

export function Blink({ on, color = colors.orange }: { on: boolean; color?: string }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = on ? withRepeat(withTiming(0.3, { duration: 600 }), -1, true) : withTiming(1);
  }, [on, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: on ? color : colors.faint }, a]} />;
}

/** What they're saying, live: the last couple of words are still settling, so they're softer. */
export function LiveWords({ text, style }: { text: string; style?: object }) {
  // Thai has no spaces between words, so a short run is one "word": keep it firm rather than fading the lot.
  const words = text.trim().split(/\s+/).filter(Boolean);
  const cut = words.length >= 3 ? words.length - 2 : words.length;
  const firm = words.slice(0, cut).join(' ');
  const soft = words.slice(cut).join(' ');
  return (
    <Text style={style}>
      {firm ? `${firm} ` : ''}
      <Text style={{ color: colors.faint }}>{soft}</Text>
    </Text>
  );
}

/** ไทย · EN — which language Kip listens in. */
export function LangSwitch({ th }: { th: boolean }) {
  return (
    <View style={styles.lang}>
      <Text style={[styles.langText, th && styles.langOn]}>ไทย</Text>
      <Text style={styles.langText}>·</Text>
      <Text style={[styles.langText, !th && styles.langOn]}>EN</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wave: { position: 'absolute', backgroundColor: colors.lime },
    dot: { width: 8, height: 8, borderRadius: 4 },
    lang: { height: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
    langText: { fontFamily: fonts.medium, fontSize: 14, color: colors.faint },
    langOn: { color: colors.ink },
  }),
);
