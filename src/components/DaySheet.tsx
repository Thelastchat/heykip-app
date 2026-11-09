// One day, opened from Home's week or the Calendar (approved mockup): what was spent against that day's money, every
// spend, money that came in, and "Add to this day" for anything forgotten — it opens Add with that date set.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Plus } from 'phosphor-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Squish } from '@/components/glow/motion';
import type { CatSpend } from '@/lib/home';
import { dayShort, monthShort, t } from '@/lib/i18n';
import { ICON3D } from '@/lib/icons3d';
import { DB_CAT_NAME, dbCatIcon, IN_CAT_NAME, inCatIcon, type DbCat, type InCat } from '@/lib/kip';
import { baht } from '@/lib/money';
import { colors, fonts, inkA, themed } from '@/theme';

type Props = { day: Date; spends: CatSpend[]; ins: CatSpend[]; daily: number; loading?: boolean; onHistory?: () => void; onClose: () => void };

export function DaySheet({ day, spends, ins, daily, loading, onHistory, onClose }: Props) {
  const insets = useSafeAreaInsets();
  // Rent & bills are planned money: they're listed, but they don't count against the day's money.
  const spent = spends.filter((s) => s.cat !== 'home_bills').reduce((a, s) => a + s.amount, 0);
  const over = daily > 0 ? Math.round(spent - daily) : 0;
  const title = `${dayShort(day.getDay())} ${day.getDate()} ${monthShort(day.getMonth())}`;
  const asCat = (c: string) => (c in DB_CAT_NAME ? c : 'other') as DbCat;
  const asIn = (c: string) => (c in IN_CAT_NAME ? c : 'other') as InCat;

  function addToDay() {
    onClose();
    // Noon that day, so it lands on that day whatever the time zone does.
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
    router.push(`/add?at=${encodeURIComponent(at.toISOString())}` as never);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} accessibilityLabel={t('Close')} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.grip} />
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 4 }} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.head}>
            <Text style={styles.title}>{`${title} · ${baht(spent)}`}</Text>
            {over > 0 ? <Text style={styles.over}>{t('{amount} over', { amount: baht(over) })}</Text> : null}
          </View>
          {daily > 0 && (
            <View style={styles.two}>
              <View style={styles.box}>
                <Text style={styles.k}>{t('Spent')}</Text>
                <Text style={styles.v}>{baht(spent)}</Text>
              </View>
              <View style={styles.box}>
                <Text style={styles.k}>{t('That day’s money')}</Text>
                <Text style={styles.v}>{baht(Math.round(daily / 10) * 10)}</Text>
              </View>
            </View>
          )}

          {spends.length > 0 && <Text style={styles.sec}>{t('Spent')}</Text>}
          {spends.map((s, i) => (
            <View key={s.id} style={[styles.row, i > 0 && styles.line]}>
              <Image source={ICON3D[dbCatIcon(asCat(s.cat))]} style={{ width: 30, height: 30 }} contentFit="contain" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {s.note || DB_CAT_NAME[asCat(s.cat)]}
                </Text>
                {s.note ? <Text style={styles.sub}>{DB_CAT_NAME[asCat(s.cat)]}</Text> : null}
              </View>
              <Text style={styles.amt}>{baht(s.amount)}</Text>
            </View>
          ))}

          {ins.length > 0 && <Text style={styles.sec}>{t('Also that day')}</Text>}
          {ins.map((s) => (
            <View key={s.id} style={styles.ev}>
              <Image source={ICON3D[inCatIcon(asIn(s.cat))]} style={{ width: 24, height: 24 }} contentFit="contain" />
              <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>
                {t('Money in · {name}', { name: s.note || IN_CAT_NAME[asIn(s.cat)] })}
              </Text>
              <Text style={[styles.amt, { color: colors.lavenderText }]}>{`+${baht(s.amount)}`}</Text>
            </View>
          ))}

          {!loading && spends.length === 0 && ins.length === 0 && <Text style={[styles.sub, { paddingVertical: 12 }]}>{t('Nothing logged this day')}</Text>}

          <Squish onPress={addToDay} style={styles.add} accessibilityRole="button">
            <Plus size={16} color={colors.ink} weight="bold" />
            <Text style={styles.addT}>{t('Add to this day')}</Text>
          </Squish>
          {onHistory && (
            <Pressable
              onPress={() => {
                onClose();
                onHistory();
              }}
              style={{ alignItems: 'center', paddingVertical: 12 }}
              accessibilityRole="button">
              <Text style={styles.addT}>{t('See all in History')}</Text>
            </Pressable>
          )}
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
      maxHeight: '86%',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      backgroundColor: colors.sheet.replace(/,\s*[\d.]+\)$/, ',1)'),
      paddingTop: 10,
      paddingHorizontal: 20,
    },
    grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: inkA(0.15), marginBottom: 16 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
    title: { fontFamily: fonts.semibold, fontSize: 20, color: colors.ink, fontVariant: ['tabular-nums'], flexShrink: 1 },
    over: { fontFamily: fonts.medium, fontSize: 13, color: colors.orangeText },
    two: { flexDirection: 'row', gap: 8, marginTop: 12 },
    box: { flex: 1, borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 10 },
    k: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    v: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, marginTop: 2, fontVariant: ['tabular-nums'] },
    sec: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 16, marginBottom: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.06) },
    name: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
    amt: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    ev: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: inkA(0.04), paddingHorizontal: 12, paddingVertical: 10, marginTop: 4 },
    add: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: 999,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: inkA(0.25),
      marginTop: 16,
    },
    addT: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  }),
);
