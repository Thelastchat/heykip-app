// The bottom sheet every Profile edit uses: the same frosted cream sheet as "Put money in".
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/glow/Glass';
import { Squish } from '@/components/glow/motion';
import { colors, fonts } from '@/theme';

export function Sheet({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={sheet.dim} onPress={onClose} accessibilityLabel="Close" />
        <View style={[sheet.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={sheet.grip} />
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false} bounces={false}>
            <View style={{ alignItems: 'center', gap: 3 }}>
              <Text style={sheet.title}>{title}</Text>
              {sub ? <Text style={[sheet.sub, { textAlign: 'center' }]}>{sub}</Text> : null}
            </View>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A big baht amount you type with the number pad. */
export function AmountInput({ value, onChange, autoFocus, label }: { value: number | null; onChange: (v: number | null) => void; autoFocus?: boolean; label: string }) {
  return (
    <View style={sheet.amountRow}>
      <Text style={sheet.amountB}>฿</Text>
      <TextInput
        autoFocus={autoFocus}
        value={value === null ? '' : value.toLocaleString('en-US')}
        onChangeText={(t) => {
          const d = t.replace(/[^\d]/g, '');
          onChange(d ? Math.min(Number(d), 9_999_999) : null);
        }}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.faint}
        style={[sheet.amount, { minWidth: 60, outlineStyle: 'none' } as never]}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** A choice pill: picked = lime with a black outline. */
export function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Squish onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }}>
      <Glass radius={999} tint={on ? colors.lime : undefined} innerStyle={[sheet.pill, on && sheet.on]}>
        <Text style={[sheet.pillText, on && { fontFamily: fonts.medium }]}>{label}</Text>
      </Glass>
    </Squish>
  );
}

/** "Before → after" rows: what the change does to the month. */
export function Delta({ rows }: { rows: { label: string; was: string | null; now: string; warn?: boolean }[] }) {
  return (
    <Glass radius={22} innerStyle={{ paddingVertical: 12, paddingHorizontal: 14, gap: 9 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <Text style={[sheet.sub, { fontSize: 14, flexShrink: 1 }]}>{r.label}</Text>
          <Text style={[sheet.deltaNow, r.warn && { color: colors.orangeText }]}>
            {r.was && r.was !== r.now ? <Text style={sheet.deltaWas}>{r.was} </Text> : null}
            {r.now}
          </Text>
        </View>
      ))}
    </Glass>
  );
}

export function SaveButton({ label, onPress, disabled, danger }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Squish onPress={onPress} disabled={disabled} style={[sheet.save, danger && { backgroundColor: colors.orangeText }, disabled && { opacity: 0.45 }]} accessibilityRole="button">
      <Text style={sheet.saveText}>{label}</Text>
    </Squish>
  );
}

export const sheet = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(17,17,17,0.3)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '92%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: 'rgba(253,251,247,0.97)',
    paddingTop: 10,
    paddingHorizontal: 18,
    gap: 12,
  },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(17,17,17,0.15)' },
  title: { fontFamily: fonts.medium, fontSize: 21, letterSpacing: -0.4, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  amount: { fontFamily: fonts.regular, fontSize: 54, letterSpacing: -2.2, color: colors.ink, fontVariant: ['tabular-nums'], padding: 0 },
  amountB: { fontFamily: fonts.regular, fontSize: 28, color: colors.muted, marginRight: 2 },
  pill: { height: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  on: { borderWidth: 1.5, borderColor: colors.ink },
  deltaNow: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  deltaWas: { fontFamily: fonts.regular, color: colors.faint, textDecorationLine: 'line-through' },
  save: { height: 56, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.medium, fontSize: 16, color: '#FFFFFF' },
  field: { fontFamily: fonts.regular, fontSize: 17, color: colors.ink, height: 52, paddingHorizontal: 16 },
});
