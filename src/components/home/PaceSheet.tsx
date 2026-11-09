// "This pay month" (approved mockup): tap Home's safe-zone graph. A bigger graph you can drag along to see any day,
// why you land where you do on payday, what each day can be from here, and the categories pushing the line up.
// Inside the safe zone the "why" leads; above it, "to get back in" comes first, in black. No extra request: it uses
// what Home already loaded.
import { Image } from 'expo-image';
import { CaretRight } from 'phosphor-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { smooth } from '@/components/home/PaceChart';
import { CATEGORY, type CatKey } from '@/lib/budget';
import { monthShort, rich, t } from '@/lib/i18n';
import { CAT_ICON3D, ICON3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import type { Pace } from '@/lib/pace';
import { colors, fonts, inkA, themed } from '@/theme';

const H = 170;
const day = (d: Date) => `${d.getDate()} ${monthShort(d.getMonth())}`;

export type PaceCat = { key: CatKey; spent: number; budget: number };

type Props = {
  pace: Pace;
  budget: number;
  total: number;
  start: Date;
  end: Date;
  /** What's left this month and over how many days after today (Home's numbers). */
  left: number;
  daysAfter: number;
  perDayAfter: number;
  cats: PaceCat[];
  onCat: (key: CatKey) => void;
  onClose: () => void;
};

export function PaceSheet({ pace, budget, total, start, end, left, daysAfter, perDayAfter, cats, onCat, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [W, setW] = useState(0);
  const today = pace.cum.length - 1;
  const [scrub, setScrub] = useState(today);

  const top = Math.max(budget, pace.projected, 1);
  const x = (i: number) => (i / Math.max(1, total)) * W;
  const y = (amount: number) => H - (amount / top) * H;
  const pts: [number, number][] = [[0, H], ...pace.cum.map((c, i) => [x(i + 1), y(c)] as [number, number])];
  const [lx, ly] = pts[pts.length - 1];
  const py = y(pace.projected);
  const [sx, sy] = pts[scrub + 1];
  const scrubDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() + scrub);
  const thatDay = pace.cum[scrub] - (scrub > 0 ? pace.cum[scrub - 1] : 0);
  const short = pace.leftAtPayday < 0;
  const perDay = Math.round(pace.spent / (today + 1) / 10) * 10;
  const plan = Math.round(budget / Math.max(1, total) / 10) * 10;

  // Drag along the line: the finger's x picks the day (only days up to today have a line).
  const move = (e: GestureResponderEvent) => {
    if (!W) return;
    const i = Math.round((e.nativeEvent.locationX / W) * total) - 1;
    setScrub(Math.max(0, Math.min(today, i)));
  };

  const why = (
    <Text style={styles.why}>
      {rich(
        short
          ? '**Why:** you’re spending about **{pace} a day**; your plan allows {plan}. At this pace you’ll be **{amount} short** on payday.'
          : '**Why:** you’re spending about **{pace} a day**; your plan allows {plan}. At this pace you’ll have **{amount} left** on payday.',
        { pace: baht(perDay), plan: baht(plan), amount: baht(Math.abs(pace.leftAtPayday)) },
        // the third bold part is what's left (or short) on payday
        (s, i) => (
          <Text style={{ fontFamily: fonts.semibold, color: short && i === 5 ? colors.orangeText : colors.ink }}>{s}</Text>
        ),
      )}
    </Text>
  );
  const how = (
    <View style={[styles.how, !pace.inside && styles.howDark]}>
      <Text style={[styles.howK, !pace.inside && { color: 'rgba(255,255,255,0.7)' }]}>{pace.inside ? t('To stay inside') : t('To get back in')}</Text>
      <Text style={[styles.howV, !pace.inside && { color: '#FFFFFF' }]}>{daysAfter > 0 ? t('Keep days under {amount}', { amount: baht(perDayAfter) }) : t('Today is the last day before payday')}</Text>
      {daysAfter > 0 && <Text style={[styles.howK, !pace.inside && { color: 'rgba(255,255,255,0.7)' }]}>{t('That’s {left} left over {n} days', { left: baht(left), n: daysAfter })}</Text>}
    </View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} accessibilityLabel={t('Close')} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.grip} />
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
          <Text style={styles.title}>{t('This pay month')}</Text>
          <Text style={styles.sub}>{`${day(start)} – ${day(new Date(end.getTime() - 86_400_000))} · ${t('{amount} spent', { amount: baht(pace.spent) })}`}</Text>
          <View style={styles.tag}>
            <Text style={styles.tagT}>{pace.inside ? t('Inside the safe zone') : t('Above the safe zone')}</Text>
          </View>

          <View
            style={{ height: H, marginTop: 52 }}
            onLayout={(e) => setW(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={move}
            onResponderMove={move}
            accessible
            accessibilityLabel={t('{day}: {spent} spent so far, {that} that day', { day: day(scrubDay), spent: baht(pace.cum[scrub]), that: baht(thatDay) })}
            accessibilityHint={t('Drag along the line to see any day')}>
            {W > 0 && (
              <>
                <Svg width={W} height={H} style={{ overflow: 'visible' }}>
                  <Path d={`M0,${H} L${W},${y(budget)} L${W},${H} Z`} fill={inkA(0.045)} />
                  <Line x1={0} y1={H} x2={W} y2={y(budget)} stroke={inkA(0.18)} strokeWidth={1.5} />
                  <SvgText x={W - 6} y={H - 8} textAnchor="end" fontSize={11} fill={colors.muted} fontFamily={fonts.regular}>
                    {t('Safe zone')}
                  </SvgText>
                  <Path d={smooth(pts)} fill="none" stroke={colors.ink} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
                  <Line x1={lx} y1={ly} x2={W} y2={py} stroke={colors.ink} strokeWidth={2.2} strokeDasharray="1 7" strokeLinecap="round" />
                  <Circle cx={W} cy={py} r={4} fill={colors.paper} stroke={colors.ink} strokeWidth={2} />
                  <Line x1={sx} y1={0} x2={sx} y2={H} stroke={colors.ink} strokeWidth={1} />
                  <Circle cx={sx} cy={sy} r={12} fill={inkA(0.12)} />
                  <Circle cx={sx} cy={sy} r={6} fill={colors.paper} stroke={colors.ink} strokeWidth={2.5} />
                </Svg>
                <View style={[styles.bub, { left: Math.min(Math.max(sx - 82, 0), W - 164), top: Math.max(-46, sy - 76) }]} pointerEvents="none">
                  <Text style={styles.bubD}>{day(scrubDay)}</Text>
                  <Text style={styles.bubT}>{t('{amount} spent so far', { amount: baht(pace.cum[scrub]) })}</Text>
                  <Text style={styles.bubT}>{t('{amount} that day', { amount: baht(thatDay) })}</Text>
                </View>
              </>
            )}
          </View>
          <View style={styles.axis}>
            <Text style={styles.axT}>{day(start)}</Text>
            <Text style={[styles.axT, { color: colors.ink, fontFamily: fonts.medium }]}>{t('Drag along the line')}</Text>
            <Text style={styles.axT}>{t('Payday')}</Text>
          </View>

          {pace.inside ? (
            <>
              {why}
              {how}
            </>
          ) : (
            <>
              {how}
              {why}
            </>
          )}

          {cats.length > 0 && <Text style={styles.sec}>{t('What’s pushing the line up')}</Text>}
          {cats.map((c) => {
            const over = c.spent > c.budget;
            return (
              <Pressable
                key={c.key}
                onPress={() => {
                  onClose();
                  onCat(c.key);
                }}
                style={styles.cat}
                accessibilityRole="button"
                accessibilityLabel={t('{name}: {spent} of {budget}', { name: CATEGORY[c.key].name, spent: baht(c.spent), budget: baht(c.budget) })}>
                <Image source={ICON3D[CAT_ICON3D[c.key]]} style={{ width: 32, height: 32 }} contentFit="contain" />
                <View style={{ flex: 1 }}>
                  <View style={styles.catRow}>
                    <Text style={styles.catName} numberOfLines={1}>
                      {CATEGORY[c.key].name}
                    </Text>
                    <Text style={[styles.catAmt, over && { color: colors.orangeText }]}>
                      {baht(c.spent)} <Text style={styles.catOf}>{t('of {amount}', { amount: baht(c.budget) })}</Text>
                    </Text>
                  </View>
                  <View style={styles.bar}>
                    <View style={[styles.fill, { width: `${Math.min(100, (c.spent / Math.max(1, c.budget)) * 100)}%`, backgroundColor: over ? colors.orange : colors.ink }]} />
                  </View>
                </View>
                <CaretRight size={14} color={colors.faint} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    dim: { flex: 1, backgroundColor: inkA(0.38) },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '92%',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      backgroundColor: colors.sheet.replace(/,\s*[\d.]+\)$/, ',1)'),
      paddingTop: 10,
      paddingHorizontal: 20,
    },
    grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: inkA(0.15), marginBottom: 16 },
    title: { fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.3, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
    tag: { alignSelf: 'flex-start', marginTop: 12, borderRadius: 999, borderWidth: 1, borderColor: inkA(0.08), backgroundColor: colors.paper, paddingHorizontal: 10, paddingVertical: 4 },
    tagT: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
    bub: { position: 'absolute', width: 164, borderRadius: 16, backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 8 },
    bubD: { fontFamily: fonts.semibold, fontSize: 13, color: colors.paper },
    bubT: { fontFamily: fonts.regular, fontSize: 12, color: colors.paper, opacity: 0.75, fontVariant: ['tabular-nums'] },
    axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    axT: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    why: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink, marginTop: 16 },
    how: { marginTop: 12, borderRadius: 20, backgroundColor: colors.paper, paddingHorizontal: 16, paddingVertical: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 6px 18px rgba(0,0,0,0.05)' },
    howDark: { backgroundColor: '#111111' },
    howK: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    howV: { fontFamily: fonts.semibold, fontSize: 20, letterSpacing: -0.3, color: colors.ink, marginVertical: 2, fontVariant: ['tabular-nums'] },
    sec: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 20, marginBottom: 4 },
    cat: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
    catName: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, flexShrink: 1 },
    catAmt: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    catOf: { fontFamily: fonts.regular, color: colors.muted },
    bar: { height: 6, borderRadius: 3, backgroundColor: inkA(0.08), marginTop: 6, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3 },
  }),
);
