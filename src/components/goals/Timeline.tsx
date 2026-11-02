// "Which goal first?" (approved mockup): one lane per goal, from today to the month it arrives. The goal's 3D object
// sits at the end of its line; when a choice moves a goal later, a small mark stays where it used to land.
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Glass } from '@/components/glow/Glass';
import { t } from '@/lib/i18n';
import { ICON3D, type Icon3D } from '@/lib/icons3d';
import { monthYear } from '@/lib/setup/plan';
import { colors, fonts, inkA, themed } from '@/theme';

export type Lane = { id: string; name: string; pin: string; color: string; icon: Icon3D; arrives: Date | null; was?: Date | null; monthly?: boolean; later?: boolean };

const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

/** `until` keeps the axis still while a choice moves the ends (pass the latest date any choice reaches). */
export function Timeline({ lanes, until, now = new Date() }: { lanes: Lane[]; until?: Date | null; now?: Date }) {
  // The axis runs from now to a little after the last arrival (at least a year), in whole months.
  const ends = [...lanes.flatMap((l) => [l.arrives, l.was]), until].filter((d): d is Date => !!d);
  const span = Math.max(12, ...ends.map((d) => monthsBetween(now, d) + 2));
  const at = (d: Date) => Math.min(1, Math.max(0, monthsBetween(now, d) / span));
  const ticks = [0, 1 / 3, 2 / 3, 1].map((f) => new Date(now.getFullYear(), now.getMonth() + Math.round(span * f), 1));

  return (
    <Glass radius={24} innerStyle={styles.box}>
      {lanes.map((l, i) => {
        const x = l.monthly ? 1 : l.arrives ? at(l.arrives) : 1;
        return (
          <View
            key={l.id}
            style={[styles.lane, i > 0 && { marginTop: 20 }]}
            accessible
            accessibilityLabel={`${l.name}: ${l.monthly ? t('every month') : l.arrives ? monthYear(l.arrives) : t('Not yet')}`}>
            <View style={styles.nameRow}>
              <View style={[styles.dot, { backgroundColor: l.pin }]} />
              <Text style={styles.name} numberOfLines={1}>
                {l.name}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(2, x * 100)}%`, backgroundColor: l.color }]} />
              {l.was && l.arrives && l.was.getTime() !== l.arrives.getTime() && <View style={[styles.ghost, { left: `${at(l.was) * 100}%` }]} />}
              {!l.monthly && (
                <View style={[styles.end, { left: `${x * 100}%` }]}>
                  <Image source={ICON3D[l.icon]} style={{ width: 36, height: 36 }} contentFit="contain" />
                </View>
              )}
            </View>
            <Text style={[styles.when, { alignSelf: x > 0.75 ? 'flex-end' : 'flex-start', marginLeft: x > 0.75 ? 0 : `${Math.max(0, x * 100 - 12)}%` }, l.later && { color: colors.orangeText }]}>
              {l.monthly ? t('Every month') : l.arrives ? monthYear(l.arrives) : t('Not yet')}
            </Text>
          </View>
        );
      })}
      <View style={styles.axis}>
        {ticks.map((d, i) => (
          <Text key={i} style={styles.tick}>
            {i === 0 ? t('Now') : monthYear(d)}
          </Text>
        ))}
      </View>
    </Glass>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    box: { paddingTop: 20, paddingBottom: 12, paddingHorizontal: 16 },
    lane: {},
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    name: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, flexShrink: 1 },
    track: { height: 10, borderRadius: 5, backgroundColor: inkA(0.06), marginTop: 16 },
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5 },
    ghost: { position: 'absolute', top: -3, width: 2, height: 16, marginLeft: -1, borderRadius: 1, backgroundColor: colors.faint },
    end: { position: 'absolute', top: -14, marginLeft: -18 },
    when: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, marginTop: 8, fontVariant: ['tabular-nums'] },
    axis: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: inkA(0.08), paddingTop: 8, marginTop: 20 },
    tick: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  }),
);
