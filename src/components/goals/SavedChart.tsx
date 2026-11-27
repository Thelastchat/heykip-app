// Saving over time (approved 27 Nov): one line that only goes up when you save — everything put away (goals + safety
// net) at the start of each pay month, ending at today. Ink line on a soft lime area, today as the one lime dot.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { monthShort, t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import type { SavedPoint } from '@/lib/savingHistory';
import { colors, fonts, inkA, themed } from '@/theme';

const H = 120;
const PAD = 10;
/** Dots sit over the middle of their month label (labels are 40 wide, spread edge to edge). */
const PADX = 20;

/** A smooth line through the points that never overshoots them (monotone), so it never dips where saving didn't. */
function smooth(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return '';
  const n = pts.length;
  const dx = (i: number) => pts[i + 1].x - pts[i].x;
  const slope = (i: number) => (pts[i + 1].y - pts[i].y) / dx(i);
  const m = pts.map((_, i) => (i === 0 ? slope(0) : i === n - 1 ? slope(n - 2) : slope(i - 1) * slope(i) <= 0 ? 0 : (slope(i - 1) + slope(i)) / 2));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx(i) / 3;
    d += ` C${pts[i].x + h},${pts[i].y + m[i] * h} ${pts[i + 1].x - h},${pts[i + 1].y - m[i + 1] * h} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

export function SavedChart({ points }: { points: SavedPoint[] }) {
  const [w, setW] = useState(0);
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const grew = last.total - first.total;
  const max = Math.max(1, ...points.map((p) => p.total));
  const xy = points.map((p, i) => ({ x: PADX + (i * (w - PADX * 2)) / (points.length - 1), y: PAD + (1 - p.total / max) * (H - PAD * 2) }));
  const line = smooth(xy);
  const area = line ? `${line} L${xy[xy.length - 1].x},${H} L${xy[0].x},${H} Z` : '';

  return (
    <View style={styles.card}>
      <View>
        <View style={styles.head}>
          <Text style={styles.title}>{t('Saved over time')}</Text>
          {grew > 0 && (
            <Text style={styles.grew} numberOfLines={1}>
              {t('+{amount} since {month}', { amount: baht(grew), month: monthShort(first.at.getMonth()) })}
            </Text>
          )}
        </View>
        <Text style={styles.sub}>{t('Goals and safety net · {amount} now', { amount: baht(last.total) })}</Text>
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
        {w > 0 && (
          <Svg width={w} height={H}>
            <Path d={area} fill={colors.lime} opacity={0.55} />
            <Path d={line} stroke={colors.ink} strokeWidth={2} fill="none" strokeLinecap="round" />
            {xy.slice(0, -1).map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} />
            ))}
            <Circle cx={xy[xy.length - 1].x} cy={xy[xy.length - 1].y} r={6} fill={colors.limeDeep} stroke={colors.ink} strokeWidth={2} />
          </Svg>
        )}
      </View>
      <View style={styles.labels}>
        {points.map((p, i) => (
          <Text key={i} style={[styles.lbl, p.now && styles.lblNow]}>
            {p.now ? t('Now') : monthShort(p.at.getMonth())}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    card: { borderRadius: 28, backgroundColor: colors.paper, padding: 20, gap: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.06)' },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
    sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
    title: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
    grew: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
    labels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 0, borderTopWidth: 1, borderTopColor: inkA(0.08), paddingTop: 8 },
    lbl: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, width: 40, textAlign: 'center' },
    lblNow: { fontFamily: fonts.medium, color: colors.ink },
  }),
);
