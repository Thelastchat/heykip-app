// The week at a glance, inside the pay period: one dot per day — lime under your daily amount, orange over.
// Tap a day to see what you spent that day; tap today to go back.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86_400_000;

export function WeekStrip({
  start,
  end,
  byDay,
  daily,
  selected,
  onSelect,
  now = new Date(),
}: {
  start: Date;
  end: Date;
  byDay: Record<string, number>;
  daily: number;
  selected: string;
  onSelect: (d: Date) => void;
  now?: Date;
}) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Seven days with today near the end, never before payday.
  let first = new Date(today.getTime() - 5 * DAY_MS);
  if (first < start) first = new Date(start);
  const days = Array.from({ length: 7 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  return (
    <View style={styles.row}>
      {days.map((d) => {
        const key = d.toDateString();
        const isToday = key === today.toDateString();
        const later = d > today || d >= end;
        const spent = byDay[key] ?? 0;
        const on = selected === key;
        const isPayday = key === start.toDateString();
        const dot = isToday || later ? 'none' : spent > daily ? 'over' : spent > 0 ? 'under' : 'empty';
        return (
          <Pressable
            key={key}
            disabled={later}
            onPress={() => onSelect(d)}
            accessibilityRole="button"
            accessibilityLabel={`${DAYS[d.getDay()]} ${d.getDate()}${isToday ? ', today' : ''}${!later && !isToday ? `, spent ${spent}` : ''}`}
            accessibilityState={{ selected: on }}
            style={[styles.day, on && styles.on, later && { opacity: 0.45 }]}>
            <Text style={[styles.dn, on && { color: 'rgba(255,255,255,0.6)' }]}>{DAYS[d.getDay()]}</Text>
            <Text style={[styles.dd, on && { color: '#FFFFFF' }]}>
              {d.getDate()}
              {isPayday ? <Text style={styles.pay}>฿</Text> : null}
            </Text>
            <View
              style={[
                styles.dot,
                dot === 'over' && { backgroundColor: colors.orange },
                dot === 'under' && { backgroundColor: colors.limeDeep },
                (dot === 'none' || dot === 'empty') && { backgroundColor: 'rgba(17,17,17,0.12)' },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 3 },
  on: { backgroundColor: colors.ink, boxShadow: '0 10px 20px rgba(17,17,17,0.18)' },
  dn: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  dd: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  pay: { fontFamily: fonts.regular, fontSize: 9, color: colors.muted },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
