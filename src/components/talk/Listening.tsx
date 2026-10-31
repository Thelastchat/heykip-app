// The listening screen (approved mockup "Tap Kip → just say it"): Kip big in the middle with soft yellow waves,
// your words appearing live, and one black button to say you're done. Waves and bars follow your voice.
import { X } from 'phosphor-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { RiseIn, Squish } from '@/components/glow/motion';
import type { VoiceLang, VoiceState } from '@/lib/voice';
import { colors, fonts } from '@/theme';

export function Listening({
  name,
  state,
  text,
  level,
  lang,
  onLang,
  onDone,
  onCancel,
}: {
  name?: string;
  state: VoiceState;
  text: string;
  level: number;
  lang: VoiceLang;
  onLang: (l: VoiceLang) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const live = state === 'listening';
  const words = text.trim().split(/\s+/).filter(Boolean);
  // The last couple of words are still settling — show them softer, like the mockup.
  const firm = words.slice(0, Math.max(0, words.length - 2)).join(' ');
  const soft = words.slice(Math.max(0, words.length - 2)).join(' ');

  return (
    <View style={StyleSheet.absoluteFill}>
      <GlowBackground />
      <View style={[styles.body, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.top}>
          <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Stop and close">
            <Glass radius={22} innerStyle={styles.round}>
              <X size={16} color={colors.ink} weight="bold" />
            </Glass>
          </Pressable>
          <Glass radius={999} innerStyle={styles.status}>
            <Blink on={live} />
            <Text style={styles.statusText}>{state === 'finishing' ? 'Got it…' : live ? 'Listening' : 'Getting ready…'}</Text>
          </Glass>
          <Pressable onPress={() => onLang(lang === 'th-TH' ? 'en-US' : 'th-TH')} accessibilityRole="button" accessibilityLabel="Switch language">
            <Glass radius={999} innerStyle={styles.lang}>
              <Text style={[styles.langText, lang === 'th-TH' && styles.langOn]}>ไทย</Text>
              <Text style={styles.langSep}>·</Text>
              <Text style={[styles.langText, lang === 'en-US' && styles.langOn]}>EN</Text>
            </Glass>
          </Pressable>
        </View>

        <RiseIn style={{ alignItems: 'center', marginTop: 10 }}>
          <Text style={styles.hey}>Hey {name ?? 'there'}</Text>
          <Text style={styles.h1}>{lang === 'th-TH' ? 'วันนี้ใช้อะไรไปบ้าง?' : 'What did you spend today?'}</Text>
        </RiseIn>

        <View style={styles.stage}>
          <Wave delay={0} level={level} />
          <Wave delay={1100} level={level} />
          <Kip mood="listen" size={180} />
        </View>

        <Text style={styles.said}>
          {words.length === 0 ? (
            <Text style={styles.hint}>{lang === 'th-TH' ? 'เช่น “ข้าวมันไก่ 60 วิน 40” หรือ “ได้เงินเดือนแล้ว”' : 'Like “Chicken rice 60, Grab 80” or “Got paid today”'}</Text>
          ) : (
            <>
              {firm ? `${firm} ` : ''}
              <Text style={{ color: colors.faint }}>{soft}</Text>
            </>
          )}
          {live && <Text style={styles.caret}>{'\u00A0|'}</Text>}
        </Text>

        <View style={{ marginTop: 'auto', alignItems: 'center', gap: 10 }}>
          <Squish onPress={onDone} disabled={state === 'finishing'} style={styles.mic} accessibilityRole="button" accessibilityLabel="Done talking">
            {[0.35, 0.7, 1, 0.6, 0.3].map((h, i) => (
              <Bar key={i} i={i} h={h} level={level} live={live} />
            ))}
          </Squish>
          <Text style={styles.micLabel}>{state === 'finishing' ? 'One moment…' : 'Tap when you’re done'}</Text>
        </View>
      </View>
    </View>
  );
}

function Blink({ on }: { on: boolean }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = on ? withRepeat(withTiming(0.3, { duration: 600 }), -1, true) : withTiming(1);
  }, [on, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: on ? colors.orange : colors.faint }, a]} />;
}

/** A soft yellow ring that breathes out from behind Kip — bigger when you're louder. */
function Wave({ delay, level }: { delay: number; level: number }) {
  const t = useSharedValue(0);
  const loud = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false));
  }, [t, delay]);
  useEffect(() => {
    loud.value = withSpring(level, { damping: 14, stiffness: 120 });
  }, [level, loud]);
  const a = useAnimatedStyle(() => ({ opacity: 1 - t.value, transform: [{ scale: 0.7 + t.value * (0.6 + loud.value * 0.35) }] }));
  return <Animated.View style={[styles.wave, a]} pointerEvents="none" />;
}

function Bar({ i, h, level, live }: { i: number; h: number; level: number; live: boolean }) {
  const s = useSharedValue(h);
  const idle = useSharedValue(0);
  useEffect(() => {
    idle.value = live ? withDelay(i * 90, withRepeat(withTiming(1, { duration: 500 }), -1, true)) : withTiming(0);
  }, [live, i, idle]);
  useEffect(() => {
    s.value = withSpring(h * (0.45 + level * 0.75), { damping: 12, stiffness: 160 });
  }, [level, h, s]);
  const a = useAnimatedStyle(() => ({ height: 36 * Math.min(1, s.value * (0.75 + idle.value * 0.25)) + 6 }));
  return <Animated.View style={[styles.bar, i === 2 && { backgroundColor: colors.limeDeep }, a]} />;
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 18 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  status: { height: 34, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  lang: { height: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  langText: { fontFamily: fonts.medium, fontSize: 14, color: colors.faint },
  langOn: { color: colors.ink },
  langSep: { fontFamily: fonts.medium, fontSize: 14, color: colors.faint },
  hey: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  h1: { fontFamily: fonts.regular, fontSize: 30, lineHeight: 38, letterSpacing: -1, color: colors.ink, textAlign: 'center' },
  stage: { alignSelf: 'center', width: 240, height: 240, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  wave: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,244,122,0.55)' },
  said: { fontFamily: fonts.medium, fontSize: 21, lineHeight: 30, color: colors.ink, textAlign: 'center', paddingHorizontal: 8, marginTop: 6 },
  hint: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted },
  caret: { color: colors.ink, fontFamily: fonts.regular },
  mic: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    boxShadow: '0 14px 28px rgba(17,17,17,0.3)',
  } as never,
  bar: { width: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
  micLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
