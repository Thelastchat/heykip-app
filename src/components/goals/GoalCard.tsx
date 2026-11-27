// The goal card from Home's "Your goal" row: a photo (or the goal's 3D object) pinned like a fridge door, the promise
// on a sticky note, and a frosted strip with what's saved. New goal shows the very same card as a live preview, so
// what you make is exactly what you'll see on Home.
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Glass } from '@/components/glow/Glass';
import { Float, Squish } from '@/components/glow/motion';
import { t } from '@/lib/i18n';
import { goalIcon3D, goalTypeIcon3D, ICON3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { typeInfo } from '@/lib/setup/goalTypes';
import { monthYear, shortName } from '@/lib/setup/plan';
import { blackA, colors, fonts, themed, whiteA } from '@/theme';

export type GoalCardData = {
  title: string;
  kind: string;
  goalType: string | null;
  photo?: string | null;
  photoKey?: string | null;
  /** The promise note's first line; no note without one. */
  promise?: string | null;
  target: number;
  saved: number;
  perMonth: number;
  arrives: Date | null;
  /** What went in this pay month (Home): shown as a small "+฿x this month". */
  added?: number;
  /** A goal with an amount and a date, even before the amount is typed (New goal's preview). */
  dated?: boolean;
};

/** The goal's own 3D object: its type when it has one (a concert is a party popper, not a phone), else its kind. */
export function goalObject(goalType: string | null, kind: string) {
  return goalType ? goalTypeIcon3D(goalType) : goalIcon3D(kind);
}

export function GoalCard({
  g,
  width,
  onPress,
  accessibilityLabel,
  style,
  children,
}: {
  g: GoalCardData;
  width?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Extra things on the card (New goal's photo button). */
  children?: ReactNode;
}) {
  const type = typeInfo(g.goalType, g.kind as never);
  const monthly = g.kind === 'monthly';
  const short = monthly ? g.title : shortName(g.title, g.kind as never);
  const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
  const hasTarget = g.target > 0 || !!g.dated;
  const line = (g.promise ?? '').split('\n')[0];
  const object = ICON3D[goalObject(g.goalType, g.kind)];
  const body = (
    <>
      {g.photo ? (
        <Image source={{ uri: g.photo, cacheKey: g.photoKey ?? undefined }} cachePolicy="disk" style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        // With a promise note on the right, the object moves to the left so the note never covers it.
        <View style={[StyleSheet.absoluteFill, { alignItems: line ? 'flex-start' : 'center', justifyContent: 'center', paddingBottom: 60, paddingLeft: line ? 20 : 0 }]}>
          <Float amount={6}>
            <Image source={object} style={{ width: 120, height: 120 }} contentFit="contain" />
          </Float>
        </View>
      )}
      {short ? (
        <View style={styles.chip}>
          <Image source={object} style={{ width: 26, height: 26 }} contentFit="contain" />
          <Text style={styles.chipText} numberOfLines={1}>
            {short}
          </Text>
        </View>
      ) : null}
      {line ? (
        <View style={styles.note}>
          <View style={styles.tape} />
          <Text allowFontScaling={false} style={styles.noteHead}>
            {monthly ? t('Why I save') : t('My promise')}
          </Text>
          <Text allowFontScaling={false} style={styles.noteText} numberOfLines={2}>
            {line}
          </Text>
        </View>
      ) : null}
      <View style={styles.strip}>
        <Glass radius={22} shadow={false} light tint="rgba(255,255,255,0.72)">
          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={styles.big}>{hasTarget ? t('{amount} saved', { amount: baht(g.saved) }) : t('{amount} this month', { amount: baht(g.perMonth) })}</Text>
              {hasTarget && <Text style={styles.small}>{pct}%</Text>}
            </View>
            {hasTarget ? (
              <>
                <View style={styles.track}>
                  <View style={[styles.trackFill, { width: `${Math.max(pct, 2)}%` }]} />
                </View>
                {g.target > 0 ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    {g.added ? (
                      <Text style={[styles.small, { fontFamily: fonts.medium, color: colors.onAccent }]}>{t('+{amount} this month', { amount: baht(g.added) })}</Text>
                    ) : (
                      <Text style={styles.small}>{t('{amount} a month', { amount: baht(g.perMonth) })}</Text>
                    )}
                    <Text style={styles.small}>{t('of {amount}', { amount: baht(g.target) })}</Text>
                  </View>
                ) : null}
                {g.arrives ? <Text style={[styles.small, { marginTop: 2 }]}>{t('On track for {date}', { date: monthYear(g.arrives) })}</Text> : null}
              </>
            ) : (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={styles.small}>{g.saved > 0 ? t('{amount} saved so far', { amount: baht(g.saved) }) : t('adds up every payday')}</Text>
              </View>
            )}
          </View>
        </Glass>
      </View>
      {children}
    </>
  );
  const card = [styles.card, { backgroundColor: type.color }, width ? { width } : null, style];
  return onPress ? (
    <Squish onPress={onPress} style={card} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {body}
    </Squish>
  ) : (
    <View style={card} accessibilityLabel={accessibilityLabel}>
      {body}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    card: { height: 272, borderRadius: 28, overflow: 'hidden', boxShadow: '0 1px 2px rgba(17,17,17,0.03), 0 16px 36px rgba(17,17,17,0.08)' },
    chip: {
      position: 'absolute',
      left: 12,
      top: 12,
      height: 32,
      paddingLeft: 4,
      paddingRight: 12,
      borderRadius: 999,
      backgroundColor: whiteA(0.9),
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: '70%',
    },
    chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onAccent, flexShrink: 1 },
    note: {
      position: 'absolute',
      right: 16,
      top: 52,
      width: 150,
      backgroundColor: colors.lime,
      paddingTop: 14,
      paddingHorizontal: 12,
      paddingBottom: 10,
      transform: [{ rotate: '3deg' }],
      boxShadow: '0 12px 20px rgba(0,0,0,0.22)',
    },
    tape: { position: 'absolute', top: -8, left: 52, width: 44, height: 15, backgroundColor: whiteA(0.65), transform: [{ rotate: '-4deg' }] },
    noteHead: { fontFamily: fonts.regular, fontSize: 12, color: blackA(0.55) },
    noteText: { fontFamily: fonts.hand, fontSize: 18, lineHeight: 18, color: colors.onAccent, marginTop: 2 },
    strip: { position: 'absolute', left: 12, right: 12, bottom: 12 },
    big: { fontFamily: fonts.medium, fontSize: 17, color: colors.onAccent },
    small: { fontFamily: fonts.regular, fontSize: 12, color: colors.onAccentMuted },
    track: { height: 8, borderRadius: 4, backgroundColor: blackA(0.08), marginTop: 9, marginBottom: 6, overflow: 'hidden' },
    trackFill: { height: 8, borderRadius: 4, backgroundColor: colors.limeDeep },
  }),
);
