// The paywall, inside the app: a black sheet made for the one feature someone just tapped, with their own numbers.
// The plan itself is always free — Plus makes Kip do the work. Store payments come later; "Try free" starts the 7-day trial.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { Squish } from '@/components/glow/motion';
import { useAuth } from '@/lib/auth';
import { ICON3D } from '@/lib/icons3d';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme';

export type PlusFeature = 'styles' | 'talk' | 'customize' | 'automove' | 'goals';

const PERKS = ['All 4 money styles — switch any time', 'Talk to Kip · “Can I buy this?”', 'Payday auto-move & nudges', 'Customize & locks · 3 goals · slip photos'];

export function PlusSheet({ open, onClose, onUnlocked, title, sub, children }: { open: boolean; onClose: () => void; onUnlocked: () => void; title: string; sub: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { session, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startTrial() {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase
      .from('profiles')
      .update({ plan: 'trial', trial_ends_at: new Date(Date.now() + 7 * 86_400_000).toISOString() })
      .eq('id', session.user.id);
    setBusy(false);
    if (e) return setError(`Couldn’t start your trial: ${e.message}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await refreshProfile();
    onClose();
    onUnlocked();
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.grip} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Kip mood="happy" size={58} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub}>{sub}</Text>
          </View>
        </View>
        {children}
        <View style={styles.perks}>
          {PERKS.map((p) => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.tick}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.ink }}>✓</Text>
              </View>
              <Text style={styles.perk}>{p}</Text>
            </View>
          ))}
        </View>
        {error && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.orange, textAlign: 'center' }}>{error}</Text>}
        <Squish onPress={startTrial} style={[styles.cta, busy && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Try free for 7 days">
          <Text style={styles.ctaText}>{busy ? 'Starting…' : 'Try free for 7 days'}</Text>
        </Squish>
        <Text style={styles.fine}>฿1.9 a day after · reminder 2 days before · cancel in 2 taps</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
          <Text style={styles.notNow}>Not now</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ---------- pictures for each feature (on black) ----------

/** Two planes racing to the goal: the current style vs a faster one. */
export function Race({ now, faster, tradeOff }: { now: { label: string; when: string }; faster: { label: string; when: string; share: number }; tradeOff?: string }) {
  return (
    <View style={{ gap: 12, marginTop: 4 }}>
      <Lane label={now.label} when={now.when} share={1} color="rgba(255,255,255,0.22)" />
      <Lane label={faster.label} when={faster.when} share={faster.share} color={colors.limeDeep} highlight />
      {tradeOff ? <Text style={styles.trade}>{tradeOff}</Text> : null}
    </View>
  );
}

function Lane({ label, when, share, color, highlight }: { label: string; when: string; share: number; color: string; highlight?: boolean }) {
  const [w, setW] = useState(0);
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(350, withTiming(Math.max(0.08, Math.min(1, share)), { duration: 1300, easing: Easing.out(Easing.cubic) }));
  }, [p, share]);
  const fill = useAnimatedStyle(() => ({ width: w * p.value }));
  const plane = useAnimatedStyle(() => ({ transform: [{ translateX: w * p.value - 34 }] }));
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={styles.laneLabel}>{label}</Text>
        <Text style={[styles.laneWhen, highlight && { color: colors.limeDeep }]}>{when}</Text>
      </View>
      <View style={styles.lane} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.laneFill, { backgroundColor: color }, fill]} />
        <Animated.View style={[styles.plane, plane]}>
          <Image source={ICON3D.plane} style={{ width: 40, height: 40 }} contentFit="contain" />
        </Animated.View>
      </View>
    </View>
  );
}

/** Payday, sorted: where the pay goes, as one bar. */
export function PaySplit({ parts, note }: { parts: { label: string; amount: number; color: string; light?: boolean }[]; note?: string }) {
  return (
    <View style={{ gap: 10, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', gap: 3, height: 46, borderRadius: 14, overflow: 'hidden' }}>
        {parts
          .filter((p) => p.amount > 0)
          .map((p) => (
            <View key={p.label} style={{ flex: p.amount, backgroundColor: p.color, justifyContent: 'flex-end', padding: 7 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: p.light ? colors.ink : '#FFFFFF' }} numberOfLines={1}>
                {p.label}
              </Text>
            </View>
          ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 }}>
        {parts.map((p) => (
          <View key={p.label} style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: p.color }} />
            <Text style={[styles.laneLabel, { flex: 1 }]}>{p.label}</Text>
            <Text style={[styles.laneWhen, { fontSize: 12 }]}>฿{p.amount.toLocaleString('en-US')}</Text>
          </View>
        ))}
      </View>
      {note ? <Text style={styles.trade}>{note}</Text> : null}
    </View>
  );
}

/** A peek at a conversation with Kip. */
export function ChatPeek({ ask, answer }: { ask: string; answer: ReactNode }) {
  return (
    <View style={{ gap: 8, marginTop: 4 }}>
      <View style={[styles.bub, styles.bubMe]}>
        <Text style={[styles.bubText, { color: colors.ink }]}>{ask}</Text>
      </View>
      <View style={styles.bub}>
        <Text style={styles.bubText}>{answer}</Text>
      </View>
    </View>
  );
}

/** Sliders with the goal locked: what Customize & locks feels like. */
export function LockPeek({ rows }: { rows: { label: string; amount: number; share: number; locked?: boolean; icon: keyof typeof ICON3D }[] }) {
  return (
    <View style={{ gap: 12, marginTop: 4 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={ICON3D[r.icon]} style={{ width: 30, height: 30 }} contentFit="contain" />
          <Text style={[styles.laneLabel, { width: 64, color: '#FFFFFF' }]} numberOfLines={1}>
            {r.label}
          </Text>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)' }}>
            <View style={{ width: `${r.share * 100}%`, height: 6, borderRadius: 3, backgroundColor: r.locked ? colors.limeDeep : '#FFFFFF' }} />
            <View style={[styles.knob, { left: `${r.share * 100}%` }]}>{r.locked ? <Text style={{ fontSize: 9 }}>🔒</Text> : null}</View>
          </View>
          <Text style={[styles.laneWhen, { width: 62, textAlign: 'right' }]}>฿{r.amount.toLocaleString('en-US')}</Text>
        </View>
      ))}
    </View>
  );
}

/** Three goal slots: one pinned, two waiting. */
export function GoalSlots({ first }: { first: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
      <View style={[styles.slot, { backgroundColor: colors.limeDeep }]}>
        <Image source={ICON3D.plane} style={{ width: 34, height: 34 }} contentFit="contain" />
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.ink }} numberOfLines={1}>
          {first}
        </Text>
      </View>
      {['A new phone', 'Moving out'].map((t) => (
        <View key={t} style={[styles.slot, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.25)' }]}>
          <Text style={{ fontSize: 22, color: 'rgba(255,255,255,0.5)' }}>+</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.5)' }} numberOfLines={1}>
            {t}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#141414', paddingTop: 10, paddingHorizontal: 20, gap: 16 },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  title: { fontFamily: fonts.medium, fontSize: 22, letterSpacing: -0.4, color: '#FFFFFF' },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  perks: { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, paddingHorizontal: 14, gap: 9 },
  perk: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  tick: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.limeDeep, alignItems: 'center', justifyContent: 'center' },
  cta: { height: 56, borderRadius: 999, backgroundColor: colors.limeDeep, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  fine: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: -6 },
  notNow: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.85)', textDecorationLine: 'underline' },
  trade: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.55)' },
  laneLabel: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  laneWhen: { fontFamily: fonts.medium, fontSize: 13, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  lane: { height: 26, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  laneFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  plane: { position: 'absolute', top: -7, left: 0 },
  bub: { alignSelf: 'flex-start', maxWidth: '86%', borderRadius: 16, borderBottomLeftRadius: 5, backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 9, paddingHorizontal: 12 },
  bubMe: { alignSelf: 'flex-end', borderBottomLeftRadius: 16, borderBottomRightRadius: 5, backgroundColor: colors.lime },
  bubText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  knob: { position: 'absolute', top: -7, width: 20, height: 20, marginLeft: -10, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  slot: { flex: 1, height: 84, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6 },
});
