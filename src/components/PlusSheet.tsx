// The paywall, inside the app: a sheet made for the one feature someone just tapped, with their own numbers.
// The plan itself is always free — Plus makes Kip do the work. Store payments come later; for now "Try free" starts the 7-day trial.
import * as Haptics from 'expo-haptics';
import { Check } from 'phosphor-react-native';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radius } from '@/theme';

export type PlusFeature = 'styles' | 'talk' | 'customize' | 'automove' | 'goals';

const PERKS = ['All 4 money styles — switch any time', 'Talk to Kip · “Can I buy this?”', 'Payday auto-move & nudges', 'Customize & locks · 3 goals'];

export function PlusSheet({ open, onClose, onUnlocked, title, sub, children }: { open: boolean; onClose: () => void; onUnlocked: () => void; title: string; sub: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { session, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startTrial() {
    if (!session) return;
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
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
        <View style={styles.grip} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Kip mood="happy" size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub}>{sub}</Text>
          </View>
        </View>
        {children}
        <View style={styles.perks}>
          <View style={styles.plusPill}>
            <Text style={styles.plusText}>✦ PLUS UNLOCKS</Text>
          </View>
          {PERKS.map((p) => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.tick}>
                <Check size={11} color={colors.ink} weight="bold" />
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.ink }}>{p}</Text>
            </View>
          ))}
        </View>
        {error && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.orange, textAlign: 'center' }}>{error}</Text>}
        <Button label="Try free for 7 days" loading={busy} onPress={startTrial} />
        <Text style={styles.fine}>฿1.9 a day after · reminder 2 days before · cancel in 2 taps</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
          <Text style={styles.notNow}>Not now</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/** Two side-by-side numbers, used inside the sheet ("Now" vs "With Plus"). */
export function Compare({ left, right }: { left: { k: string; v: string; sub: string }; right: { k: string; v: string; sub: string; color: string } }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={[styles.cmp, { backgroundColor: colors.grey }]}>
        <Text style={styles.cmpK}>{left.k}</Text>
        <Text style={styles.cmpV}>{left.v}</Text>
        <Text style={styles.cmpSub}>{left.sub}</Text>
      </View>
      <View style={[styles.cmp, { backgroundColor: right.color, borderWidth: 1.5, borderColor: colors.ink }]}>
        <Text style={styles.cmpK}>{right.k}</Text>
        <Text style={styles.cmpV}>{right.v}</Text>
        <Text style={styles.cmpSub}>{right.sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFFFFF', paddingTop: 10, paddingHorizontal: 20, gap: 12 },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(17,17,17,0.15)' },
  title: { fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.3, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  perks: { borderRadius: 16, backgroundColor: '#F8F6F4', paddingVertical: 10, paddingHorizontal: 12, gap: 7 },
  plusPill: { alignSelf: 'flex-start', height: 22, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.ink, justifyContent: 'center' },
  plusText: { fontFamily: fonts.bold, fontSize: 11, color: '#FFFFFF' },
  tick: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  fine: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: -4 },
  notNow: { textAlign: 'center', fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline', paddingBottom: 4 },
  cmp: { flex: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  cmpK: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  cmpV: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink },
  cmpSub: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(17,17,17,0.7)' },
});
