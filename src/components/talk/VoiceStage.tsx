// Talking with Kip out loud (Nov 27 redesign): one big Kip in the middle and one clear line saying whose turn it is.
// Your turn = yellow rings that move with your voice + your words appearing. Kip thinking = three dots. Kip's turn =
// black sound bars + his words as a caption. One big button does the obvious thing for that moment (send now · cut
// in), the keyboard goes back to typing, and ไทย/EN switches the language Kip listens in.
import { ArrowUp, HandPalm, Keyboard } from 'phosphor-react-native';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Kip, type KipMood } from '@/components/Kip';
import { Glass } from '@/components/glow/Glass';
import { LiveWords, Waves } from '@/components/talk/VoiceBits';
import { t } from '@/lib/i18n';
import { colors, fonts, inkA, themed } from '@/theme';

export type VoicePhase = 'listening' | 'thinking' | 'speaking';

export function VoiceStage({
  phase,
  level,
  hearing,
  youSaid,
  kipSaid,
  th,
  card,
  bottom,
  onPrimary,
  onKeyboard,
  onLang,
}: {
  phase: VoicePhase;
  level: number;
  hearing: string;
  youSaid: string;
  kipSaid: string;
  th: boolean;
  /** What Kip did on the last turn (logged items, a change to approve…), small, under the caption. */
  card?: ReactNode;
  bottom: number;
  onPrimary: () => void;
  onKeyboard: () => void;
  onLang: () => void;
}) {
  const mood: KipMood = phase === 'speaking' ? 'talk' : phase === 'thinking' ? 'think' : 'listen';
  // With a card to show (what Kip just logged or wants to change), Kip steps back a little so it all fits.
  const small = !!card && phase !== 'thinking';
  const label = phase === 'listening' ? t('Your turn — go ahead') : phase === 'thinking' ? t('Kip’s thinking…') : t('Kip’s talking');
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onPrimary} style={[styles.stage, small && styles.stageSmall]} accessibilityRole="button" accessibilityLabel={phase === 'speaking' ? t('Cut in') : t('Send now')}>
          <Waves size={small ? 150 : 210} level={level} on={phase === 'listening'} />
          <Kip mood={mood} size={small ? 124 : 176} />
        </Pressable>

        <View style={styles.turnRow}>
          {phase === 'listening' && <View style={[styles.turnDot, { backgroundColor: colors.limeDeep }]} />}
          {phase === 'thinking' && <Dots />}
          {phase === 'speaking' && <Bars />}
          <Text style={styles.turn}>{label}</Text>
        </View>

        <View style={styles.caption}>
          {phase === 'listening' ? (
            hearing ? (
              <LiveWords text={hearing} style={styles.words} />
            ) : (
              <Text style={[styles.words, styles.quiet]}>{th ? 'เช่น “ข้าวมันไก่ 60 วิน 40”' : 'Like “Chicken rice 60, Grab 80”'}</Text>
            )
          ) : phase === 'thinking' ? (
            <Text style={[styles.words, styles.quiet]} numberOfLines={3}>
              “{youSaid}”
            </Text>
          ) : (
            <Text style={styles.words} numberOfLines={4}>
              {kipSaid}
            </Text>
          )}
        </View>

        {card && phase !== 'thinking' ? <View style={styles.card}>{card}</View> : null}
      </ScrollView>

      <View style={[styles.controls, { paddingBottom: bottom }]}>
        <Side label={t('Type')} onPress={onKeyboard} a11y={t('Stop talking and type')}>
          <Keyboard size={22} color={colors.ink} weight="bold" />
        </Side>
        <View style={styles.mid}>
          <Pressable
            onPress={onPrimary}
            disabled={phase === 'thinking'}
            style={[styles.primary, phase === 'listening' && styles.pYou, phase === 'speaking' && styles.pKip, phase === 'thinking' && styles.pWait]}
            accessibilityRole="button"
            accessibilityLabel={phase === 'speaking' ? t('Cut in') : t('Send now')}>
            {phase === 'listening' && <ArrowUp size={30} color={colors.onAccent} weight="bold" />}
            {phase === 'speaking' && <HandPalm size={30} color={colors.onSolid} weight="fill" />}
            {phase === 'thinking' && <Dots dark />}
          </Pressable>
          <Text style={styles.sideText}>{phase === 'listening' ? t('Send now') : phase === 'speaking' ? t('Cut in') : t('One moment…')}</Text>
        </View>
        <Side label={t('Language')} onPress={onLang} a11y={t('Switch language')}>
          <Text style={styles.lang}>{th ? 'ไทย' : 'EN'}</Text>
        </Side>
      </View>
    </View>
  );
}

function Side({ children, label, onPress, a11y }: { children: ReactNode; label: string; onPress: () => void; a11y: string }) {
  return (
    <View style={styles.side}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y}>
        <Glass radius={30} innerStyle={styles.sideBtn}>
          {children}
        </Glass>
      </Pressable>
      <Text style={styles.sideText}>{label}</Text>
    </View>
  );
}

/** Kip thinking: three dots hopping in turn. */
function Dots({ dark }: { dark?: boolean }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <Hop key={i} delay={i * 140} color={dark ? colors.muted : colors.ink} />
      ))}
    </View>
  );
}
function Hop({ delay, color }: { delay: number; color: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withRepeat(withSequence(withTiming(-5, { duration: 260 }), withTiming(0, { duration: 260 }), withTiming(0, { duration: 300 })), -1));
  }, [y, delay]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, a]} />;
}

/** Kip talking: four black bars moving like a voice. */
function Bars() {
  return (
    <View style={styles.bars}>
      {[0, 1, 2, 3].map((i) => (
        <Bar key={i} delay={i * 110} />
      ))}
    </View>
  );
}
function Bar({ delay }: { delay: number }) {
  const h = useSharedValue(0.35);
  useEffect(() => {
    h.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }), withTiming(0.35, { duration: 280 })), -1));
  }, [h, delay]);
  const a = useAnimatedStyle(() => ({ height: 16 * h.value }));
  return <Animated.View style={[styles.bar, a]} />;
}

const styles = themed(() =>
  StyleSheet.create({
    body: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },
    stage: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
    stageSmall: { width: 190, height: 190 },
    turnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, height: 32 },
    turnDot: { width: 12, height: 12, borderRadius: 6 },
    turn: { fontFamily: fonts.medium, fontSize: 22, lineHeight: 30, letterSpacing: -0.4, color: colors.ink },
    caption: { minHeight: 64, marginTop: 12, alignSelf: 'stretch', alignItems: 'center' },
    words: { fontFamily: fonts.regular, fontSize: 19, lineHeight: 28, color: colors.ink, textAlign: 'center' },
    quiet: { color: colors.muted },
    card: { alignSelf: 'stretch', marginTop: 8 },
    controls: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 10 },
    side: { alignItems: 'center', gap: 6, width: 84 },
    sideBtn: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
    lang: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
    sideText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17, color: colors.muted, textAlign: 'center' },
    mid: { alignItems: 'center', gap: 6 },
    primary: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginTop: -12 },
    pYou: { backgroundColor: colors.limeDeep },
    pKip: { backgroundColor: colors.solid },
    pWait: { backgroundColor: inkA(0.06) },
    dots: { flexDirection: 'row', gap: 5, alignItems: 'center', height: 16 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    bars: { flexDirection: 'row', gap: 3, alignItems: 'center', height: 16 },
    bar: { width: 4, borderRadius: 2, backgroundColor: colors.ink },
  }),
);
