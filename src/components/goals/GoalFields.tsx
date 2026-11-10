// The fields Edit goal and New goal share: an amount row, the "By when" date row, a lime choice card, and a
// before → after row.
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CaretRight } from 'phosphor-react-native';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/glow/Glass';
import { Squish } from '@/components/glow/motion';
import { Button } from '@/components/ui';
import { t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { isoDay, monthYear, parseDay } from '@/lib/setup/plan';
import { colors, fonts, inkA, themed } from '@/theme';
import { DragSheet } from '@/components/DragSheet';

export function AmountRow({ label, value, was, onChange }: { label: string; value: number | null; was: number | null; onChange: (v: number | null) => void }) {
  return (
    <View style={[styles.row, styles.line]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.k}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.v}>฿</Text>
          <TextInput
            value={value === null ? '' : value.toLocaleString('en-US')}
            onChangeText={(s) => {
              const n = s.replace(/[^\d]/g, '');
              onChange(n ? Math.min(Number(n), 99_999_999) : null);
            }}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.faint}
            style={[styles.v, styles.input, { flex: 1 }]}
            accessibilityLabel={label}
          />
        </View>
      </View>
      {was !== null && <Text style={styles.was}>{t('was {amount}', { amount: baht(was) })}</Text>}
    </View>
  );
}

/** "By when" — the phone's date picker (a typed date on web). */
export function DueRow({ value, onChange }: { value: string | null; onChange: (iso: string) => void }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const tomorrow = new Date(Date.now() + 86_400_000);
  const current = value ? parseDay(value) : new Date(tomorrow.getFullYear() + 1, tomorrow.getMonth(), 1);
  const [picked, setPicked] = useState(current);
  const dark = colors.paper !== '#FFFFFF';

  if (Platform.OS === 'web')
    return (
      <View style={[styles.row, styles.line]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.k}>{t('By when')}</Text>
          <TextInput
            defaultValue={value ?? ''}
            onChangeText={(s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && onChange(s)}
            placeholder="2027-12-25"
            placeholderTextColor={colors.faint}
            style={[styles.v, styles.input]}
            accessibilityLabel={t('By when')}
          />
        </View>
      </View>
    );

  const show = () => {
    if (Platform.OS === 'android') return DateTimePickerAndroid.open({ value: current, minimumDate: tomorrow, mode: 'date', onChange: (e, x) => e.type === 'set' && x && onChange(isoDay(x)) });
    setPicked(current);
    setOpen(true);
  };
  return (
    <>
      <Pressable onPress={show} style={[styles.row, styles.line]} accessibilityRole="button" accessibilityLabel={t('By when')}>
        <View style={{ flex: 1 }}>
          <Text style={styles.k}>{t('By when')}</Text>
          <Text style={styles.v}>{value ? monthYear(parseDay(value)) : t('Pick a date')}</Text>
        </View>
        <CaretRight size={14} color={colors.faint} weight="bold" />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel={t('Close')} />
        <DragSheet onClose={() => setOpen(false)} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <Text style={styles.sheetTitle}>{t('By when')}</Text>
          <DateTimePicker value={picked} minimumDate={tomorrow} mode="date" display="inline" accentColor={colors.ink} themeVariant={dark ? 'dark' : 'light'} onChange={(_, x) => x && setPicked(x)} />
          <Button
            label={t('Done')}
            onPress={() => {
              onChange(isoDay(picked));
              setOpen(false);
            }}
          />
        </DragSheet>
      </Modal>
    </>
  );
}

export function Choice({ on, title, sub, onPress }: { on: boolean; title: string; sub: string; onPress: () => void }) {
  return (
    <Squish onPress={onPress} style={{ flex: 1 }} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${title}. ${sub}`}>
      <Glass radius={20} tint={on ? colors.lime : undefined} innerStyle={[styles.choice, on && styles.choiceOn]}>
        <Text style={[styles.choiceTitle, on && { color: colors.onAccent }]}>{title}</Text>
        <Text style={[styles.choiceSub, on && { color: colors.onAccentMuted }]}>{sub}</Text>
      </Glass>
    </Squish>
  );
}

export function Delta({ label, was, now, warn }: { label: string; was: string | null; now: string; warn?: boolean }) {
  return (
    <View style={[styles.drow, styles.line]}>
      <Text style={styles.dk}>{label}</Text>
      {was ? <Text style={styles.dwas}>{was}</Text> : null}
      <Text style={[styles.dnow, warn && { color: colors.orangeText }]}>{now}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.08) },
    k: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    v: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 },
    input: { padding: 0, outlineStyle: 'none' } as never,
    was: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
    scrim: { flex: 1, backgroundColor: inkA(0.25) },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, paddingHorizontal: 20, gap: 8 },
    sheetTitle: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, textAlign: 'center' },
    choice: { paddingVertical: 12, paddingHorizontal: 14, minHeight: 72 },
    choiceOn: { borderWidth: 1.5, borderColor: colors.onAccent },
    choiceTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    choiceSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
    drow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingVertical: 14 },
    dk: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    dwas: { fontFamily: fonts.regular, fontSize: 13, color: colors.faint, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
    dnow: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
  }),
);
