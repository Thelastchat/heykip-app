// Full calendar (approved mockup): a month at a time, each day with what was spent and a dot — grey under the daily
// budget, black over (white, light grey and black only, like Home's week). Tap a day to see its spends. Opens on this month; goes back one year and no further.
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { Squish } from '@/components/glow/motion';
import { useAuth } from '@/lib/auth';
import { dayOpen, daysFrom, earliestDay, loadMonth, monthAt, monthGrid, OLDEST } from '@/lib/calendar';
import { monthNumbers, useHome, type CatSpend } from '@/lib/home';
import { dayShort, monthLong, monthShort, shownYear, t } from '@/lib/i18n';
import { ICON3D } from '@/lib/icons3d';
import { DB_CAT_NAME, dbCatIcon, type DbCat } from '@/lib/kip';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { dayInMonth } from '@/lib/setup/plan';
import { colors, fonts, inkA, themed } from '@/theme';

const asCat = (c: string) => (c in DB_CAT_NAME ? c : 'other') as DbCat;

export default function FullCalendar() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { month } = useMonth();
  const { spent } = useHome(month);
  const now = new Date();
  const [offset, setOffset] = useState(0); // 0 = this month, −12 = the oldest
  const [rows, setRows] = useState<Record<string, CatSpend[]>>({});
  const [error, setError] = useState(false);
  const [picked, setPicked] = useState<string | null>(now.toDateString());

  const { y, m } = monthAt(offset, now);
  const key = `${y}-${m}`;

  // The daily budget Home uses for its dots (this month's plan — the only plan the app keeps).
  const { P, spendBudget } = monthNumbers(month, spent, now);
  const daily = P.total ? spendBudget / P.total : 0;
  const dailyShown = baht(Math.round(daily / 10) * 10);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let live = true;
      setError(false);
      loadMonth(session.user.id, y, m, now)
        .then((r) => live && setRows((s) => ({ ...s, [key]: r })))
        .catch(() => live && setError(true));
      return () => {
        live = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, key]),
  );

  const oldest = earliestDay(now);
  const loaded = rows[key];
  const data = useMemo(() => daysFrom(loaded ?? [], month, oldest), [loaded, month, oldest.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const grid = useMemo(() => monthGrid(y, m), [y, m]);
  const weeks = useMemo(() => Array.from({ length: grid.length / 7 }, (_, w) => grid.slice(w * 7, w * 7 + 7)), [grid]);
  const payday = month?.payday ? dayInMonth(y, m, month.payday).toDateString() : null;
  const overDays = Object.values(data.byDay).filter((v) => daily > 0 && v > daily).length;

  const canBack = offset > OLDEST;
  const canNext = offset < 0;
  function go(by: number) {
    const next = offset + by;
    if (next < OLDEST || next > 0) return;
    setOffset(next);
    setPicked(next === 0 ? now.toDateString() : null);
  }
  const swipe = Gesture.Race(
    Gesture.Fling()
      .direction(Directions.RIGHT)
      .runOnJS(true)
      .onEnd(() => go(-1)),
    Gesture.Fling()
      .direction(Directions.LEFT)
      .runOnJS(true)
      .onEnd(() => go(1)),
  );

  const summary = !loaded
    ? ' '
    : [
        t('Spent {amount}', { amount: baht(data.total) }),
        daily > 0
          ? overDays === 0
            ? t('never over {daily}', { daily: dailyShown })
            : overDays === 1
              ? t('1 day over {daily}', { daily: dailyShown })
              : t('{n} days over {daily}', { n: overDays, daily: dailyShown })
          : null,
      ]
        .filter(Boolean)
        .join(' · ');

  const pickedDate = picked ? new Date(picked) : null;
  const pickedHere = pickedDate && pickedDate.getFullYear() === y && pickedDate.getMonth() === m ? pickedDate : null;
  const dayItems = pickedHere ? (data.items[pickedHere.toDateString()] ?? []) : [];
  const dayTotal = pickedHere ? (data.byDay[pickedHere.toDateString()] ?? 0) : 0;
  const dayOver = daily > 0 ? Math.round(dayTotal - daily) : 0;

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20 }}>
          <ScreenHeader title={t('Full calendar')} />
        </View>

        <GestureDetector gesture={swipe}>
          <View collapsable={false}>
            <View style={styles.nav}>
              <Pressable onPress={() => go(-1)} disabled={!canBack} accessibilityRole="button" accessibilityLabel={t('Previous month')} style={[styles.circ, !canBack && { opacity: 0.3 }]}>
                <CaretLeft size={18} color={colors.ink} weight="bold" />
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.title}>{`${monthLong(m)} ${shownYear(new Date(y, m, 1))}`}</Text>
                <Text style={styles.sub}>{summary}</Text>
              </View>
              <Pressable onPress={() => go(1)} disabled={!canNext} accessibilityRole="button" accessibilityLabel={t('Next month')} style={[styles.circ, !canNext && { opacity: 0.3 }]}>
                <CaretRight size={18} color={colors.ink} weight="bold" />
              </Pressable>
            </View>

            <View style={styles.week}>
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <Text key={d} style={styles.wd}>
                  {dayShort(d)}
                </Text>
              ))}
            </View>

            {/* One row per week, seven equal cells (flex, not % widths — iPhone rounds 7 × 14.29% past 100% and drops Saturday). */}
            <View style={styles.grid}>
              {weeks.map((w, wi) => (
                <View key={wi} style={styles.wrow}>
                  {w.map((d, j) => {
                    const i = wi * 7 + j;
                    if (!d) return <View key={`b${i}`} style={styles.cell} />;
                    const k = d.toDateString();
                    const open = dayOpen(d, now);
                    const amount = data.byDay[k] ?? 0;
                    const over = daily > 0 && amount > daily;
                    const on = picked === k;
                    const isToday = k === now.toDateString();
                    const dot = !open || !loaded ? 'transparent' : over ? (on ? colors.paper : colors.ink) : amount > 0 ? (on ? 'rgba(255,255,255,0.5)' : inkA(0.22)) : 'transparent';
                    return (
                      <Pressable
                        key={k}
                        disabled={!open}
                        onPress={() => setPicked(k)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on, disabled: !open }}
                        accessibilityLabel={open ? t('{day} {date}, spent {amount}', { day: dayShort(d.getDay()), date: d.getDate(), amount }) : `${dayShort(d.getDay())} ${d.getDate()}`}
                        style={[styles.cell, on && styles.on, isToday && !on && styles.today]}>
                        <Text style={[styles.dd, on && { color: colors.paper }, !open && { color: inkA(0.22) }]}>
                          {d.getDate()}
                          {k === payday ? <Text style={[styles.pay, on && { color: colors.paper }]}>฿</Text> : null}
                        </Text>
                        <Text style={[styles.amt, over && { color: colors.ink, fontFamily: fonts.medium }, on && { color: colors.paper }]} numberOfLines={1}>
                          {open && loaded ? (amount > 0 ? Math.round(amount).toLocaleString('en-US') : '–') : ' '}
                        </Text>
                        <View style={[styles.dot, { backgroundColor: dot }]} />
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </GestureDetector>

        {!loaded && !error && <ActivityIndicator color={colors.muted} style={{ marginTop: 12 }} />}
        {error && <Text style={styles.note}>{t('Couldn’t load this month. Go back and try again')}</Text>}

        {loaded && daily > 0 && (
          <View style={styles.legend}>
            <Text style={styles.lg}>
              <Text style={{ color: inkA(0.22) }}>●</Text> {t('Under {amount}', { amount: dailyShown })}
            </Text>
            <Text style={styles.lg}>
              <Text style={{ color: colors.ink }}>●</Text> {t('Over')}
            </Text>
            {payday && <Text style={styles.lg}>฿ {t('Payday')}</Text>}
          </View>
        )}

        {loaded && pickedHere && (
          <View style={styles.card}>
            <View style={styles.dh}>
              <Text style={styles.dhT}>{`${dayShort(pickedHere.getDay())} ${pickedHere.getDate()} ${monthShort(pickedHere.getMonth())} · ${baht(dayTotal)}`}</Text>
              {dayOver > 0 && <Text style={styles.over}>{t('{amount} over', { amount: baht(dayOver) })}</Text>}
            </View>
            {dayItems.length === 0 ? (
              <Text style={styles.empty}>{t('Nothing spent this day')}</Text>
            ) : (
              dayItems.map((s, i) => (
                <View key={s.id} style={[styles.row, i > 0 && styles.line]}>
                  <Image source={ICON3D[dbCatIcon(asCat(s.cat))]} style={{ width: 28, height: 28 }} contentFit="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {s.note || DB_CAT_NAME[asCat(s.cat)]}
                    </Text>
                    {s.note ? <Text style={styles.rowCat}>{DB_CAT_NAME[asCat(s.cat)]}</Text> : null}
                  </View>
                  <Text style={styles.rowAmt}>{baht(s.amount)}</Text>
                </View>
              ))
            )}
            <Squish style={styles.all} accessibilityRole="button" onPress={() => router.push(`/history?at=${encodeURIComponent(pickedHere.toISOString())}` as never)}>
              <Text style={styles.allT}>{t('See all in History')}</Text>
            </Squish>
          </View>
        )}
        {loaded && !pickedHere && offset !== OLDEST && <Text style={styles.note}>{t('Tap a day to see what you spent')}</Text>}

        {offset === OLDEST && (
          <View style={styles.end}>
            <Text style={styles.endT}>
              {t('The calendar goes back one year, to {date}. Older days still count in your totals', { date: `${oldest.getDate()} ${monthShort(oldest.getMonth())} ${shownYear(oldest)}` })}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    body: { gap: 0 },
    nav: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 20 },
    circ: { width: 40, height: 40, borderRadius: 20, backgroundColor: inkA(0.05), alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: fonts.semibold, fontSize: 20, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
    week: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 20, marginBottom: 4 },
    wd: { flex: 1, textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    grid: { paddingHorizontal: 12, gap: 4 },
    wrow: { flexDirection: 'row' },
    cell: { flex: 1, height: 58, borderRadius: 999, alignItems: 'center', justifyContent: 'center', gap: 2 },
    on: { backgroundColor: colors.ink },
    today: { borderWidth: 1.5, borderColor: colors.ink },
    dd: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    pay: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
    amt: { fontFamily: fonts.regular, fontSize: 10.5, color: colors.muted, fontVariant: ['tabular-nums'] },
    dot: { width: 5, height: 5, borderRadius: 3 },
    legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
    lg: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    card: {
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.card,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 6,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
    },
    dh: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
    dhT: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
    over: { fontFamily: fonts.medium, fontSize: 13, color: colors.orangeText },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.06) },
    rowName: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
    rowCat: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
    rowAmt: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, paddingVertical: 10 },
    all: { alignItems: 'center', paddingVertical: 12 },
    allT: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
    note: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 16, paddingHorizontal: 24 },
    end: { marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 28, backgroundColor: inkA(0.04) },
    endT: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  }),
);
