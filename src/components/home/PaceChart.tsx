// Home's pay-month line (approved mockup G2, "Safe zone"). The plan is a soft shaded zone; your spending is the bold
// line; the dotted end shows where you land on payday at this pace. Black and greys only — orange stays on the number.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { monthShort, t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import type { Pace } from '@/lib/pace';
import { colors, fonts, inkA, themed } from '@/theme';

const H = 120;

/**
 * A smooth line through the points that never dips or bulges past them (monotone cubic, Fritsch–Carlson):
 * spending only goes up, so the line must too.
 */
function smooth(pts: [number, number][]) {
  const n = pts.length;
  if (n < 2) return `M${pts[0][0]},${pts[0][1]}`;
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const m = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (dx[i] || 1));
  const tan = pts.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      tan[i] = 0;
      tan[i + 1] = 0;
      continue;
    }
    const a = tan[i] / m[i];
    const b = tan[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      tan[i] = k * a * m[i];
      tan[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + tan[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - tan[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

export function PaceChart({ pace, budget, total, start }: { pace: Pace; budget: number; total: number; start: Date }) {
  const [W, setW] = useState(0);
  const top = Math.max(budget, pace.projected, 1);
  const x = (day: number) => (day / Math.max(1, total)) * W;
  const y = (amount: number) => H - (amount / top) * H;
  const pts: [number, number][] = [[0, H], ...pace.cum.map((c, i) => [x(i + 1), y(c)] as [number, number])];
  const [lx, ly] = pts[pts.length - 1];
  const py = y(pace.projected);
  const planEnd = y(budget);
  const short = pace.leftAtPayday < 0;
  const bubble = pace.inside ? t('Inside the safe zone') : t('Above the safe zone');
  const bubbleW = 150;

  return (
    <View accessible accessibilityLabel={`${bubble}. ${short ? t('Payday · {amount} short', { amount: baht(-pace.leftAtPayday) }) : t('Payday · {amount} left', { amount: baht(pace.leftAtPayday) })}`}>
      <View style={{ height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {W > 0 && (
          <>
            <Svg width={W} height={H} style={{ overflow: 'visible' }}>
              <Path d={`M0,${H} L${W},${planEnd} L${W},${H} Z`} fill={inkA(0.045)} />
              <Line x1={0} y1={H} x2={W} y2={planEnd} stroke={inkA(0.18)} strokeWidth={1.5} />
              <SvgText x={W - 6} y={H - 8} textAnchor="end" fontSize={11} fill={colors.muted} fontFamily={fonts.regular}>
                {t('Safe zone')}
              </SvgText>
              <Path d={smooth(pts)} fill="none" stroke={colors.ink} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
              <Line x1={lx} y1={ly} x2={W} y2={py} stroke={colors.ink} strokeWidth={2.2} strokeDasharray="1 7" strokeLinecap="round" />
              <Circle cx={lx} cy={ly} r={11} fill={inkA(0.1)} />
              <Circle cx={lx} cy={ly} r={5.5} fill={colors.ink} />
              <Circle cx={W} cy={py} r={4} fill={colors.paper} stroke={colors.ink} strokeWidth={2} />
            </Svg>
            <View style={[styles.bub, { left: Math.min(Math.max(lx - bubbleW / 2, 0), W - bubbleW), top: Math.max(-6, ly - 44), width: bubbleW }]} pointerEvents="none">
              <Text style={styles.bubT} numberOfLines={1}>
                {bubble}
              </Text>
            </View>
          </>
        )}
      </View>
      <View style={styles.foot}>
        <Text style={styles.axis}>{`${start.getDate()} ${monthShort(start.getMonth())}`}</Text>
        <View style={styles.chip}>
          <Text style={styles.chipT}>{short ? t('Payday · {amount} short', { amount: baht(-pace.leftAtPayday) }) : t('Payday · {amount} left', { amount: baht(pace.leftAtPayday) })}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    bub: { position: 'absolute', alignItems: 'center', justifyContent: 'center', height: 30, borderRadius: 999, backgroundColor: colors.card, boxShadow: '0 4px 14px rgba(0,0,0,0.10)' },
    bubT: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
    foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    axis: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
    chip: { borderRadius: 999, backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 6 },
    chipT: { fontFamily: fonts.medium, fontSize: 12, color: colors.paper, fontVariant: ['tabular-nums'] },
  }),
);
