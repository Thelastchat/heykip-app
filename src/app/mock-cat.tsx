// MOCKUP ONLY (not for shipping): the "Create your own category" states for ก้อย to approve. ?s=pick|create|move|slip
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { CaretDown, Plus } from 'phosphor-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateCategory, MovePast } from '@/components/categories/CreateCategory';
import { Kip } from '@/components/Kip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { Sheet } from '@/components/profile/Sheet';
import { getLang, t } from '@/lib/i18n';
import { CAT_ICON3D, ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { colors, fonts, glassA, inkA, themed } from '@/theme';

export default function MockCat() {
  const { s } = useLocalSearchParams<{ s?: string }>();
  const insets = useSafeAreaInsets();
  const th = getLang() === 'th';
  const name = th ? 'เคป๊อป' : 'K-pop';
  const slips: { name: string; when: string; amount: number; cat: string; icon: Icon3D; remembered?: boolean }[] = [
    { name: 'Ktown4u', when: th ? 'วันนี้ 14:20' : 'Today 14:20', amount: 450, cat: s === 'pick' ? t('Fun') : name, icon: 'fun', remembered: true },
    { name: '7-Eleven', when: th ? 'วันนี้ 12:05' : 'Today 12:05', amount: 85, cat: t('Food & drinks'), icon: 'bowl' },
    { name: 'BTS', when: th ? 'วันนี้ 08:40' : 'Today 08:40', amount: 47, cat: t('Transport'), icon: 'car' },
  ];
  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, gap: 12 }}>
        <ScreenHeader title={t('Slips')} />
        <Text style={styles.big}>{t('{n} slips to check', { n: 3 })}</Text>
        {slips.map((x) => (
          <Glass key={x.name} radius={22}>
            <View style={styles.row}>
              <View style={styles.mini} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{x.name}</Text>
                <Text style={styles.small}>{x.when}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.amt}>{baht(x.amount)}</Text>
                <View style={styles.cat}>
                  <Image source={ICON3D[x.icon]} style={{ width: 22, height: 22 }} contentFit="contain" />
                  <Text style={styles.catText}>{x.cat}</Text>
                  <CaretDown size={10} color={colors.muted} weight="bold" />
                </View>
              </View>
            </View>
            {x.remembered && s === 'slip' && (
              <View style={styles.learned}>
                <Kip mood="happy" size={24} />
                <Text style={styles.learnedText}>{t('Kip remembered: {shop} goes to {name}', { shop: x.name, name })}</Text>
              </View>
            )}
          </Glass>
        ))}
      </ScrollView>

      {s === 'pick' && (
        <Sheet open onClose={() => {}} title={t('What was it for?')} sub="Ktown4u">
          <View style={styles.cats}>
            {(['food', 'transport', 'shopping', 'fun', 'health_beauty', 'learning', 'giving', 'other'] as const).map((k) => (
              <Glass key={k} radius={23} tint={k === 'fun' ? colors.lime : undefined} innerStyle={styles.chip}>
                <Image source={ICON3D[CAT_ICON3D[k]]} style={{ width: 36, height: 36 }} contentFit="contain" />
                <Text style={[styles.chipText, k === 'fun' && { fontFamily: fonts.medium }]}>{t(CAT_NAME[k])}</Text>
              </Glass>
            ))}
            <View style={[styles.chip, styles.create]}>
              <View style={styles.plus}>
                <Plus size={16} color={colors.ink} weight="bold" />
              </View>
              <Text style={[styles.chipText, { fontFamily: fonts.medium }]}>{t('Create your own')}</Text>
            </View>
          </View>
        </Sheet>
      )}
      {s === 'create' && (
        <CreateCategory
          c={{ name, icon: 'fun', need: false, amount: 1000, from: { name: t('Shopping'), amount: 1800 } }}
          kipSays={t('Kip thinks it’s a want: fun money, like albums and concerts. Change it if not.')}
          onClose={() => {}}
        />
      )}
      {s === 'move' && (
        <MovePast
          name={name}
          icon="fun"
          budget={1000}
          items={[
            { name: th ? 'การ์ดสะสม · Shopee' : 'Photocards · Shopee', from: t('Shopping'), icon: 'shop', amount: 320 },
            { name: 'Weverse DM', from: t('Fun'), icon: 'fun', amount: 99 },
          ]}
          onClose={() => {}}
        />
      )}
    </View>
  );
}

const CAT_NAME = {
  food: 'Food & drinks',
  transport: 'Transport',
  shopping: 'Shopping',
  fun: 'Fun',
  health_beauty: 'Health & beauty',
  learning: 'Learning',
  giving: 'Giving',
  other: 'Household & other',
} as const;

const styles = themed(() =>
  StyleSheet.create({
    big: { fontFamily: fonts.medium, fontSize: 22, letterSpacing: -0.4, color: colors.ink, marginVertical: 6 },
    row: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
    mini: { width: 44, height: 60, borderRadius: 8, borderWidth: 1, borderColor: inkA(0.08), backgroundColor: colors.paper },
    name: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    small: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    amt: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
    cat: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingLeft: 4, paddingRight: 8, borderRadius: 999, backgroundColor: glassA(0.75), borderWidth: 1, borderColor: colors.paper },
    catText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
    learned: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, borderTopWidth: 1, borderTopColor: inkA(0.06) },
    learnedText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 8 },
    chip: { height: 44, paddingLeft: 4, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
    chipText: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
    create: { borderRadius: 23, backgroundColor: inkA(0.06), paddingLeft: 6 },
    plus: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  }),
);
