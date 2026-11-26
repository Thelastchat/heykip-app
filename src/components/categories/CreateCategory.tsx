// "Create your own" category (mockup, awaiting approval): a name, one of the 3D icons, need or want (so 50/30/20 and
// Jars still add up), and how much a month — taken from a category they pick, so the month still adds up and each day
// stays the same. Kip suggests the icon and need/want from the name; they can change both.
import { Image } from 'expo-image';
import { CaretDown } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Kip } from '@/components/Kip';
import { Glass } from '@/components/glow/Glass';
import { Squish } from '@/components/glow/motion';
import { Delta, SaveButton, Sheet } from '@/components/profile/Sheet';
import { t } from '@/lib/i18n';
import { ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { colors, fonts, inkA, themed } from '@/theme';

const ICONS: Icon3D[] = ['fun', 'heart', 'shop', 'bowl', 'car', 'house', 'plane', 'phone', 'piggy', 'bill', 'shield', 'income', 'expense'];

export type NewCategory = { name: string; icon: Icon3D; need: boolean; amount: number; from: { name: string; amount: number } };

export function CreateCategory({ c, kipSays, onClose }: { c: NewCategory; kipSays: string; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title={t('Your own category')}>
      <Glass radius={18} innerStyle={styles.field}>
        <Text style={styles.k}>{t('Name')}</Text>
        <TextInput value={c.name} style={styles.v} accessibilityLabel={t('Name')} />
      </Glass>

      <Text style={styles.cap}>{t('Icon')}</Text>
      <View style={styles.icons}>
        {ICONS.map((i) => (
          <View key={i} style={[styles.icon, i === c.icon && styles.iconOn]}>
            <Image source={ICON3D[i]} style={{ width: 34, height: 34 }} contentFit="contain" />
          </View>
        ))}
      </View>

      <Text style={styles.cap}>{t('Is it a need or a want?')}</Text>
      <View style={styles.seg}>
        {[true, false].map((n) => (
          <View key={String(n)} style={[styles.segBtn, c.need === n && styles.segOn]}>
            <Text style={[styles.segText, c.need === n && { color: colors.paper }]}>{n ? t('Need') : t('Want')}</Text>
          </View>
        ))}
      </View>
      <View style={styles.kip}>
        <Kip mood="happy" size={28} />
        <Text style={styles.kipText}>{kipSays}</Text>
      </View>

      <Text style={styles.cap}>{t('How much a month?')}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Glass radius={18} style={{ flex: 1 }} innerStyle={styles.field}>
          <Text style={styles.k}>{t('Amount')}</Text>
          <Text style={styles.v}>{baht(c.amount)}</Text>
        </Glass>
        <Pressable style={{ flex: 1 }}>
          <Glass radius={18} innerStyle={styles.field}>
            <Text style={styles.k}>{t('Take it from')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.v, { flexShrink: 1 }]} numberOfLines={1}>
                {c.from.name}
              </Text>
              <CaretDown size={12} color={colors.muted} weight="bold" />
            </View>
          </Glass>
        </Pressable>
      </View>
      <Delta
        rows={[
          { label: c.from.name, was: baht(c.from.amount), now: baht(c.from.amount - c.amount), warn: true },
          { label: c.name, was: null, now: baht(c.amount) },
          { label: t('Each day'), was: null, now: t('No change') },
        ]}
      />
      <SaveButton label={t('Create {name}', { name: c.name })} onPress={onClose} />
    </Sheet>
  );
}

/** Right after creating it: Kip offers to move this month's things that look like it. Nothing moves without a yes. */
export function MovePast({ name, icon, items, budget, onClose }: { name: string; icon: Icon3D; items: { name: string; from: string; icon: Icon3D; amount: number }[]; budget?: number; onClose: () => void }) {
  const total = items.reduce((a, i) => a + i.amount, 0);
  return (
    <Sheet open onClose={onClose} title={t('{name} is ready', { name })}>
      <View style={styles.kipRow}>
        <Kip mood="happy" size={52} />
        <Glass radius={22} style={{ flex: 1 }} innerStyle={styles.bub}>
          <Text style={styles.say}>{t('I found {n} things this month that look like {name}. Move them there?', { n: items.length, name })}</Text>
        </Glass>
      </View>
      <Glass radius={22} innerStyle={{ paddingHorizontal: 14 }}>
        {items.map((it, i) => (
          <View key={it.name} style={[styles.row, i > 0 && styles.line]}>
            <Image source={ICON3D[it.icon]} style={{ width: 34, height: 34 }} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{it.name}</Text>
              <Text style={styles.sub}>{t('{from} → {to}', { from: it.from, to: name })}</Text>
            </View>
            <Text style={styles.amt}>{baht(it.amount)}</Text>
          </View>
        ))}
        <View style={[styles.row, styles.line]}>
          <Image source={ICON3D[icon]} style={{ width: 34, height: 34 }} contentFit="contain" />
          <Text style={[styles.title, { flex: 1 }]}>{t('{name} this month', { name })}</Text>
          <Text style={styles.amt}>
            {baht(total)}
            {budget ? <Text style={styles.of}>{t(' of {amount}', { amount: baht(budget) })}</Text> : null}
          </Text>
        </View>
      </Glass>
      <SaveButton label={t('Move them')} onPress={onClose} />
      <Squish onPress={onClose} accessibilityRole="button">
        <Glass radius={999} innerStyle={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.title}>{t('Not now')}</Text>
        </Glass>
      </Squish>
    </Sheet>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    field: { paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
    k: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    v: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, padding: 0, outlineStyle: 'none' } as never,
    cap: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginBottom: -6, marginLeft: 2 },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: inkA(0.05), alignItems: 'center', justifyContent: 'center' },
    iconOn: { backgroundColor: colors.lime },
    seg: { flexDirection: 'row', backgroundColor: inkA(0.07), borderRadius: 999, padding: 4 },
    segBtn: { flex: 1, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    segOn: { backgroundColor: colors.ink },
    segText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
    kip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4 },
    kipText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
    kipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    bub: { paddingVertical: 12, paddingHorizontal: 14, borderTopLeftRadius: 6 },
    say: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.06) },
    title: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
    amt: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    of: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  }),
);
