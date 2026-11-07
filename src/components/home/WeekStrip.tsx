// The week at a glance, inside the pay period (approved mockup G2): white pills, today/selected in black. A grey dot
// is a day you spent under your daily amount, a black dot a day you went over. No lime or orange here.
// Tap a day to see what you spent that day; tap today to go back.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayShort, t } from '@/lib/i18n';
import { colors, fonts, glassA, inkA, themed } from '@/theme';

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
        const name = dayShort(d.getDay());
        const dot = isToday || later ? 'none' : spent > daily ? 'over' : spent > 0 ? 'under' : 'empty';
        return (
          <Pressable
            key={key}
            disabled={later}
            onPress={() => onSelect(d)}
            accessibilityRole="button"
            accessibilityLabel={
              isToday
                ? t('{day} {date}, today', { day: name, date: d.getDate() })
                : !later
                  ? t('{day} {date}, spent {amount}', { day: name, date: d.getDate(), amount: spent })
                  : `${name} ${d.getDate()}`
            }
            accessibilityState={{ selected: on }}
            style={[styles.day, on && styles.on, later && { opacity: 0.5 }]}>
            <Text style={[styles.dn, on && { color: glassA(0.6) }]}>{name}</Text>
            <Text style={[styles.dd, on && { color: colors.paper }]}>
              {d.getDate()}
              {isPayday ? <Text style={styles.pay}>฿</Text> : null}
            </Text>
            <View
              style={[
                styles.dot,
                dot === 'over' && { backgroundColor: on ? colors.paper : colors.ink },
                dot === 'under' && { backgroundColor: on ? glassA(0.5) : inkA(0.22) },
                (dot === 'none' || dot === 'empty') && { backgroundColor: 'transparent' },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: 6 },
    day: { flex: 1, height: 68, borderRadius: 999, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: colors.card, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
    on: { backgroundColor: colors.ink, boxShadow: '0 10px 20px rgba(17,17,17,0.18)' },
    dn: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    dd: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    pay: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
    dot: { width: 6, height: 6, borderRadius: 3 },
  }),
);
