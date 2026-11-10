// One Left-to-spend category, up close (approved mockup): tap a tile on Home and this opens over it.
// What's left, how fast it's going, what Kip suggests a day, and this pay cycle's spends in it.
// Everything comes from the copy Home already loaded, so opening it costs no request.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { Float, Ring, Squish } from '@/components/glow/motion';
import { sheet } from '@/components/profile/Sheet';
import type { CatKey } from '@/lib/budget';
import type { CatSpend } from '@/lib/home';
import { dayShort, monthShort, rich, t } from '@/lib/i18n';
import { CAT_ICON3D, ICON3D } from '@/lib/icons3d';
import { DB_CAT_NAME, type DbCat } from '@/lib/kip';
import { baht } from '@/lib/money';
import { colors, fonts, inkA, themed } from '@/theme';
import { DragSheet } from '@/components/DragSheet';

const SHOWN = 5;
/** Tiles whose spends are one database category, so History can show just that one. */
const ONE_CAT: CatKey[] = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'learning', 'giving'];

export type CatInfo = { key: CatKey; name: string; budget: number; used: number; going: boolean; daysLeft: number };

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
function when(iso: string) {
  const d = new Date(iso);
  const diff = Math.round((new Date(new Date().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (diff === 0) return `${t('Today')} · ${hhmm(d)}`;
  if (diff === 1) return `${t('Yesterday')} · ${hhmm(d)}`;
  return `${dayShort(d.getDay())} ${d.getDate()} ${monthShort(d.getMonth())}`;
}

export function CatSheet({ info, spends, onClose }: { info: CatInfo; spends: CatSpend[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { key, name, budget, used, going, daysLeft } = info;
  const left = Math.max(0, budget - used);
  const perDay = Math.round(left / Math.max(1, daysLeft) / 10) * 10;
  const lower = name.toLowerCase();
  const warn = going || (used > 0 && left === 0);

  // Kip's line: the real maths — what's left over the days to payday.
  const line =
    used > 0 && left === 0
      ? rich('**All used.** More {cat} now comes out of the rest of your month', { cat: lower }, (s) => <Text style={styles.warnB}>{s}</Text>)
      : going
        ? rich('**Going fast.** About {amount} a day keeps {cat} in plan for the next {n} days', { amount: baht(perDay), cat: lower, n: daysLeft }, (s) => <Text style={styles.warnB}>{s}</Text>)
        : used === 0
          ? t('Nothing spent yet. That’s {amount} a day for the next {n} days', { amount: baht(perDay), n: daysLeft })
          : t('On track. About {amount} a day for the next {n} days', { amount: baht(perDay), n: daysLeft });

  function go(path: string) {
    onClose();
    router.push(path as never);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheet.dim} onPress={onClose} accessibilityLabel={t('Close')} />
      <DragSheet onClose={onClose} style={[sheet.sheet, styles.box, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={sheet.grip} />
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.head} accessible accessibilityLabel={t('{category}: {left} left of {total}', { category: name, left: baht(left), total: baht(budget) })}>
            <View style={{ width: 64, height: 64 }}>
              <Ring pct={budget ? left / budget : 0} color={going ? colors.orange : colors.limeDeep} delay={150} />
              <Float style={StyleSheet.absoluteFill}>
                <Image source={ICON3D[CAT_ICON3D[key]]} style={{ width: 40, height: 40, margin: 12 }} contentFit="contain" />
              </Float>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.big}>
                {baht(left)} <Text style={styles.bigSmall}>{t('left')}</Text>
              </Text>
              <Text style={styles.of}>{t('of {total} · {spent} spent', { total: baht(budget), spent: baht(used) })}</Text>
            </View>
          </View>

          <View style={styles.kip}>
            <Kip mood={warn ? 'careful' : 'happy'} size={30} />
            <Text style={styles.kipText}>{line}</Text>
          </View>

          <View style={styles.listHead}>
            <Text style={styles.listTitle}>{t('This pay cycle')}</Text>
            {spends.length > 0 && <Text style={styles.count}>{spends.length === 1 ? t('1 spend') : t('{n} spends', { n: spends.length })}</Text>}
          </View>
          {spends.length === 0 ? (
            <Text style={styles.empty}>{t('Nothing here yet. Spends you add to {cat} show up here', { cat: lower })}</Text>
          ) : (
            spends.slice(0, SHOWN).map((s, i) => (
              <View key={s.id} style={[styles.row, i > 0 && styles.line]}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {s.note || DB_CAT_NAME[(s.cat in DB_CAT_NAME ? s.cat : 'other') as DbCat]}
                  <Text style={styles.rowWhen}>
                    {'  '}
                    {when(s.at)}
                  </Text>
                </Text>
                <Text style={styles.rowAmt}>{baht(s.amount)}</Text>
              </View>
            ))
          )}

          <View style={styles.btns}>
            <Squish style={styles.btn} accessibilityRole="button" onPress={() => go(ONE_CAT.includes(key) ? `/history?cat=${key}` : '/history')}>
              <Text style={styles.btnText}>{t('See all in History')}</Text>
            </Squish>
            <Squish style={styles.btn} accessibilityRole="button" onPress={() => go('/month')}>
              <Text style={styles.btnText}>{t('Change {cat} budget', { cat: lower })}</Text>
            </Squish>
          </View>
        </ScrollView>
      </DragSheet>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    // solid: Home's tiles and text would show through the usual 97% sheet
    box: { paddingHorizontal: 20, backgroundColor: colors.sheet.replace(/,\s*[\d.]+\)$/, ',1)') },
    head: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 20 },
    name: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
    big: { fontFamily: fonts.medium, fontSize: 32, letterSpacing: -1, color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 },
    bigSmall: { fontFamily: fonts.regular, fontSize: 15, letterSpacing: 0, color: colors.muted },
    of: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4, fontVariant: ['tabular-nums'] },
    kip: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, padding: 14, borderRadius: 20, backgroundColor: inkA(0.05) },
    kipText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
    warnB: { fontFamily: fonts.medium, color: colors.orangeText },
    listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 24, marginBottom: 4 },
    listTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    count: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 44 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.08) },
    rowName: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    rowWhen: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    rowAmt: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    empty: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, paddingVertical: 8 },
    btns: { flexDirection: 'row', gap: 8, marginTop: 20 },
    btn: { flex: 1, height: 48, borderRadius: 999, backgroundColor: inkA(0.06), alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    btnText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, textAlign: 'center' },
  }),
);
