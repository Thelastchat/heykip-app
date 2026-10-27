import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { isoDay, parseDay, shortDate } from '@/lib/setup/plan';
import { colors, fonts, radius } from '@/theme';

import { SmallTile, smallValue } from './kit';

/** "By when?" — a tile that opens the system date picker. Only future dates. */
export function DateTile({ label, value, onChange, style }: { label: string; value: string | null; onChange: (iso: string) => void; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const current = value ? parseDay(value) : new Date(tomorrow.getFullYear(), tomorrow.getMonth() + 2, tomorrow.getDate());
  const [picked, setPicked] = useState(current);

  if (Platform.OS === 'web') {
    return (
      <SmallTile label={label} style={style}>
        <TextInput value={value ?? ''} onChangeText={(t) => /^\d{4}-\d{2}-\d{2}$/.test(t) && onChange(t)} placeholder="2026-12-19" placeholderTextColor={colors.faint} style={smallValue} />
      </SmallTile>
    );
  }

  const show = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: current, minimumDate: tomorrow, mode: 'date', onChange: (e, d) => e.type === 'set' && d && onChange(isoDay(d)) });
    } else {
      setPicked(current);
      setOpen(true);
    }
  };

  return (
    <>
      <SmallTile label={label} style={style} onPress={show}>
        <Text style={[smallValue, !value && { color: colors.faint }]} numberOfLines={1}>
          {value ? shortDate(parseDay(value)) : '19 Dec'}
        </Text>
      </SmallTile>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <Text style={styles.sheetTitle}>{label}</Text>
          <DateTimePicker value={picked} minimumDate={tomorrow} mode="date" display="inline" accentColor={colors.ink} themeVariant="light" onChange={(_, d) => d && setPicked(d)} />
          <Button
            label="Done"
            onPress={() => {
              onChange(isoDay(picked));
              setOpen(false);
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(17,17,17,0.25)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: radius.cardLg, borderTopRightRadius: radius.cardLg, paddingTop: 18, paddingHorizontal: 20, gap: 8 },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink, textAlign: 'center' },
});
