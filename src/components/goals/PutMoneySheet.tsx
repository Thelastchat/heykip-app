// "Put money in" — extra money for a goal (a bonus, leftovers, a gift). Kip shows how much sooner it gets you there
// before you save. Saving goes through put_in_goal, which records the move and updates the total together.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { Glass } from '@/components/glow/Glass';
import { Squish } from '@/components/glow/motion';
import { ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme';

export type MoneyFrom = 'bonus' | 'leftover' | 'side' | 'gift';
const FROM: { key: MoneyFrom; label: string; icon: Icon3D }[] = [
  { key: 'bonus', label: 'Bonus', icon: 'income' },
  { key: 'leftover', label: 'Leftover money', icon: 'piggy' },
  { key: 'side', label: 'Side gig', icon: 'phone' },
  { key: 'gift', label: 'Gift', icon: 'fun' },
];
const QUICK = [500, 1000, 2000];

/** How much sooner `extra` gets you there, in words a person uses. */
export function soonerText(extra: number, perMonth: number) {
  if (perMonth <= 0) return null;
  const months = extra / perMonth;
  if (months >= 1.5) return `${Math.round(months)} months sooner`;
  if (months >= 0.9) return 'a month sooner';
  const weeks = Math.round(months * 4.33);
  if (weeks >= 2) return `${weeks} weeks sooner`;
  if (weeks === 1) return 'a week sooner';
  return 'a few days sooner';
}

export function PutMoneySheet({
  open,
  onClose,
  onDone,
  goal,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (newTotal: number) => void;
  goal: { id: string; name: string; saved: number; target: number; perMonth: number; icon: Icon3D };
}) {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState<number | null>(1000);
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState<MoneyFrom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const a = amount ?? 0;
  const before = goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0;
  const after = goal.target > 0 ? Math.min(100, ((goal.saved + a) / goal.target) * 100) : 0;
  const sooner = a > 0 ? soonerText(a, goal.perMonth) : null;
  const done = goal.target > 0 && goal.saved + a >= goal.target;

  async function save() {
    if (a <= 0 || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('put_in_goal', { p_goal: goal.id, p_amount: a, p_source: 'extra', p_from: from });
    setBusy(false);
    if (e) return setError(`Couldn’t save: ${e.message}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onDone(Number(data ?? goal.saved + a));
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.dim} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.grip} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Kip mood="happy" size={50} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Put money in {goal.name}</Text>
              <Text style={styles.sub}>Extra money gets you there sooner.</Text>
            </View>
          </View>

          {custom ? (
            <View style={styles.amountRow}>
              <Text style={styles.amountB}>฿</Text>
              <TextInput
                autoFocus
                value={amount === null ? '' : amount.toLocaleString('en-US')}
                onChangeText={(t) => {
                  const d = t.replace(/[^\d]/g, '');
                  setAmount(d ? Math.min(Number(d), 9_999_999) : null);
                }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.faint}
                style={[styles.amount, { minWidth: 60, outlineStyle: 'none' } as never]}
                accessibilityLabel="Amount"
              />
            </View>
          ) : (
            <Text style={[styles.amount, { textAlign: 'center' }]}>
              <Text style={styles.amountB}>฿</Text>
              {a.toLocaleString('en-US')}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            {QUICK.map((q) => {
              const on = !custom && amount === q;
              return (
                <Squish
                  key={q}
                  onPress={() => {
                    setCustom(false);
                    setAmount(q);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}>
                  <Glass radius={999} tint={on ? colors.lime : undefined} innerStyle={[styles.pill, on && styles.on]}>
                    <Text style={[styles.pillText, on && { fontFamily: fonts.medium }]}>{baht(q)}</Text>
                  </Glass>
                </Squish>
              );
            })}
            <Squish onPress={() => setCustom(true)} accessibilityRole="radio" accessibilityState={{ selected: custom }}>
              <Glass radius={999} tint={custom ? colors.lime : undefined} innerStyle={[styles.pill, custom && styles.on]}>
                <Text style={[styles.pillText, custom && { fontFamily: fonts.medium }]}>Other</Text>
              </Glass>
            </Squish>
          </View>

          <Text style={styles.label}>
            Where’s it from? <Text style={{ color: colors.muted, fontFamily: fonts.regular }}>· helps Kip plan</Text>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {FROM.map((f) => {
              const on = from === f.key;
              return (
                <Squish key={f.key} onPress={() => setFrom(on ? null : f.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Glass radius={999} tint={on ? colors.lime : undefined} innerStyle={[styles.chip, on && styles.on]}>
                    <Image source={ICON3D[f.icon]} style={{ width: 30, height: 30 }} contentFit="contain" />
                    <Text style={[styles.pillText, on && { fontFamily: fonts.medium }]}>{f.label}</Text>
                  </Glass>
                </Squish>
              );
            })}
          </View>

          {a > 0 && (
            <Glass radius={22} innerStyle={styles.moves}>
              <Image source={ICON3D[goal.icon]} style={{ width: 40, height: 40 }} contentFit="contain" />
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={styles.movesText}>
                  {done ? (
                    <>
                      That’s <Text style={{ fontFamily: fonts.semibold }}>everything</Text> — {goal.name} is fully paid for 🎉
                    </>
                  ) : sooner ? (
                    <>
                      That moves {goal.name} <Text style={{ fontFamily: fonts.semibold }}>{sooner}</Text>.
                    </>
                  ) : (
                    <>Every baht counts — {goal.name} gets a little closer.</>
                  )}
                </Text>
                {goal.target > 0 && (
                  <>
                    <Bar label="Before" pct={before} color="rgba(17,17,17,0.25)" />
                    <Bar label="After" pct={after} color={colors.limeDeep} />
                  </>
                )}
              </View>
            </Glass>
          )}

          {error && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.orange, textAlign: 'center' }}>{error}</Text>}
          <Squish onPress={save} style={[styles.save, (a <= 0 || busy) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel={`Put ${baht(a)} in`}>
            <Text style={styles.saveText}>{busy ? 'Saving…' : a > 0 ? `Put ${baht(a)} in` : 'Put money in'}</Text>
          </Squish>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={styles.small}>{label}</Text>
        <Text style={[styles.small, { color: colors.ink, fontFamily: fonts.medium }]}>{Math.round(pct)}%</Text>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(17,17,17,0.07)' }}>
        <View style={{ width: `${Math.max(pct, 1.5)}%`, height: 10, borderRadius: 5, backgroundColor: color }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(17,17,17,0.3)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: 'rgba(253,251,247,0.97)',
    paddingTop: 10,
    paddingHorizontal: 18,
    gap: 14,
  },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(17,17,17,0.15)' },
  title: { fontFamily: fonts.medium, fontSize: 21, letterSpacing: -0.4, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  amount: { fontFamily: fonts.regular, fontSize: 56, letterSpacing: -2.4, color: colors.ink, fontVariant: ['tabular-nums'], padding: 0 },
  amountB: { fontFamily: fonts.regular, fontSize: 30, color: colors.ink },
  pill: { height: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  on: { borderWidth: 1.5, borderColor: colors.ink },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, marginBottom: -6 },
  chip: { height: 40, paddingLeft: 5, paddingRight: 13, flexDirection: 'row', alignItems: 'center', gap: 4 },
  moves: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  movesText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  save: { height: 56, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.medium, fontSize: 16, color: '#FFFFFF' },
});
