// A bill's due day and reminder (approved mockup): days 1–30 and "Last day" in black and greys (like the calendar),
// then when to be reminded. Tap the picked day again to clear it — a bill without a day just has no reminder.
import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Remind } from '@/lib/budget';
import { dateIn, REMIND_HOUR } from '@/lib/billdue';
import { monthShort, t } from '@/lib/i18n';
import { colors, fonts, inkA, themed } from '@/theme';

const CHIP = 44;
const GAP = 6;

export function DuePicker({ day, remind, yearlyMonth, onDay, onRemind }: { day: number | null; remind: Remind; yearlyMonth: number | null; onDay: (d: number | null) => void; onRemind: (r: Remind) => void }) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // Open on the picked day, a little in from the left.
  useEffect(() => {
    if (day) setTimeout(() => scroll.current?.scrollTo({ x: Math.max(0, (Math.min(day, 31) - 3) * (CHIP + GAP)), animated: false }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const first = (() => {
    if (!day) return null;
    if (yearlyMonth !== null) {
      const y = yearlyMonth >= now.getMonth() ? now.getFullYear() : now.getFullYear() + 1;
      return dateIn(y, yearlyMonth, day);
    }
    const d = dateIn(now.getFullYear(), now.getMonth(), day);
    return d.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() ? d : dateIn(now.getFullYear(), now.getMonth() + 1, day);
  })();
  const fire = first && remind !== 'off' ? new Date(first.getFullYear(), first.getMonth(), first.getDate() - (remind === 'before' ? 1 : 0)) : null;
  const time = `${REMIND_HOUR}:00`;
  const hint = !day
    ? t('Pick a day to get a reminder. Optional.')
    : remind === 'off'
      ? t('No reminder. It still shows on Home when it’s due.')
      : yearlyMonth !== null
        ? t('{time} on {date}, then every year.', { time, date: `${fire!.getDate()} ${monthShort(fire!.getMonth())}` })
        : day === 31
          ? t('{time} on {date}, then every month. A month without the 31st uses its last day.', { time, date: `${fire!.getDate()} ${monthShort(fire!.getMonth())}` })
          : t('{time} on {date}, then every month.', { time, date: `${fire!.getDate()} ${monthShort(fire!.getMonth())}` });

  return (
    <View>
      <Text style={styles.k}>{yearlyMonth !== null ? t('Due on') : t('Due every month on')}</Text>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: GAP }} style={{ marginTop: 8, marginHorizontal: -20 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: 20 - GAP }} />
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
          const on = day === d;
          const last = d === 31;
          return (
            <Pressable
              key={d}
              onPress={() => onDay(on ? null : d)}
              style={[styles.day, last && styles.dayWide, on && styles.dayOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={last ? t('Last day of the month') : t('Day {n}', { n: d })}>
              <Text style={[styles.dayT, on && styles.dayTOn]}>{last ? t('Last day') : d}</Text>
            </Pressable>
          );
        })}
        <View style={{ width: 20 - GAP }} />
      </ScrollView>
      {day ? (
        <>
          <Text style={styles.k}>{t('Remind me')}</Text>
          <View style={styles.seg}>
            {(['before', 'day', 'off'] as const).map((r) => (
              <Pressable key={r} onPress={() => onRemind(r)} style={[styles.segBtn, remind === r && styles.segOn]} accessibilityRole="radio" accessibilityState={{ selected: remind === r }}>
                <Text style={[styles.segT, remind === r && { fontFamily: fonts.semibold, color: colors.onAccent }]}>{r === 'before' ? t('Day before') : r === 'day' ? t('On the day') : t('Off')}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    k: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 6 },
    day: { width: CHIP, height: CHIP, borderRadius: 14, backgroundColor: inkA(0.05), alignItems: 'center', justifyContent: 'center' },
    dayWide: { width: undefined, paddingHorizontal: 12 },
    dayOn: { backgroundColor: colors.ink },
    dayT: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    dayTOn: { fontFamily: fonts.medium, color: colors.paper },
    seg: { flexDirection: 'row', gap: 6, marginTop: 8 },
    segBtn: { flex: 1, height: 44, borderRadius: 999, backgroundColor: inkA(0.05), alignItems: 'center', justifyContent: 'center' },
    segOn: { backgroundColor: colors.lime },
    segT: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
    hint: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginTop: 8 },
  }),
);
