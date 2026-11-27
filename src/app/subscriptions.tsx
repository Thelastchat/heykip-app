// Subscriptions (approved 27 Nov): every bill you can cancel on one page, as one picture — what they come to a month
// and a year, one bar split by subscription, then each one with when it renews. HeyKip Plus is on it too: during the
// free week as a line (nothing to pay yet), and once paid as a bill at what the person really pays. Kip asks before
// each renewal on Home (Keep or cancel); this page is where you look at them all at once.
import { CaretRight, Plus } from 'phosphor-react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KipStill } from '@/components/KipStill';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { RiseIn } from '@/components/glow/motion';
import { useAuth } from '@/lib/auth';
import { monthShort, t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { plusPlans } from '@/lib/purchases';
import { monthYear } from '@/lib/setup/plan';
import { ASK_DAYS, subsOf, subsTotal, type Sub } from '@/lib/subscriptions';
import { colors, fonts, inkA, themed } from '@/theme';

const dm = (d: Date) => `${d.getDate()} ${monthShort(d.getMonth())}`;

/** One colour per subscription, never two close ones next to each other (brand palette, in this order). */
const SEG = () => [colors.limeDeep, colors.orange, colors.lavender, colors.sky, colors.sage, colors.peach, colors.pink, colors.clay];

export default function Subscriptions() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { month } = useMonth();
  const subs = subsOf(month);
  const { perMonth, perYear } = subsTotal(subs);
  const pay = month?.income ?? 0;
  const pct = pay > 0 ? Math.round((perMonth / pay) * 100) : 0;

  // The free week: no bill yet, just when it ends and what the store will charge then (never a price of our own).
  const trialEnds = profile?.plan === 'trial' && profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const [yearPrice, setYearPrice] = useState<string | null>(null);
  useEffect(() => {
    if (!trialEnds) return;
    const demo = process.env.EXPO_PUBLIC_VOICE_DEMO === '1' ? (globalThis as { __PLUS_PRICE?: string }).__PLUS_PRICE : undefined;
    if (demo) return setYearPrice(demo);
    plusPlans().then((p) => setYearPrice(p.find((x) => x.key === 'yearly')?.price ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!trialEnds]);

  const colorsFor = SEG();
  const color = (s: Sub, i: number) => (s.plus ? colors.ink : colorsFor[i % colorsFor.length]);

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 16 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Subscriptions')} />

        <RiseIn>
          <View style={styles.hero}>
            <View style={styles.nums}>
              <View>
                <Text style={styles.big}>{baht(perMonth)}</Text>
                <Text style={styles.lbl}>{t('A month')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.mid}>{baht(perYear)}</Text>
                <Text style={styles.lbl}>{t('A year')}</Text>
              </View>
            </View>
            {/* the one picture: every subscription as its share of the month */}
            <View style={styles.bar}>
              {subs.map((s, i) => (
                <View key={s.name} style={{ flex: Math.max(s.perMonth, 1), backgroundColor: color(s, i), marginLeft: i ? 2 : 0 }} />
              ))}
            </View>
            <Text style={styles.note}>
              {subs.length === 1 ? t('1 subscription') : t('{n} subscriptions', { n: subs.length })}
              {pct > 0 ? ` · ${t('{pct}% of your pay', { pct })}` : ''}
            </Text>
          </View>
        </RiseIn>

        <RiseIn delay={60}>
          <Glass radius={24} innerStyle={{ paddingHorizontal: 16 }}>
            {trialEnds && (
              <View style={[styles.row, subs.length > 0 && styles.line]}>
                <KipStill size={24} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name}>HeyKip Plus</Text>
                  <Text style={styles.sub}>
                    {yearPrice ? t('Free until {date}, then {price} a year', { date: dm(trialEnds), price: yearPrice }) : t('Free until {date}', { date: dm(trialEnds) })}
                  </Text>
                  <Text style={styles.sub}>{t('Kip adds it to your bills when it starts')}</Text>
                </View>
                <Text style={styles.amt}>฿0</Text>
              </View>
            )}
            {subs.map((s, i) => (
              <View key={s.name} style={[styles.row, (i > 0 || trialEnds) && styles.line]}>
                {s.plus ? <KipStill size={24} /> : <View style={[styles.dot, { backgroundColor: color(s, i) }]} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {s.next ? (s.yearly ? t('Renews {date}', { date: `${s.next.getDate()} ${monthYear(s.next)}` }) : t('Renews {date}', { date: dm(s.next) })) : t('No renewal day yet')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amt}>{s.yearly ? t('{amount} a year', { amount: baht(s.charge) }) : baht(s.charge)}</Text>
                  {s.yearly && <Text style={styles.sub}>{t('{amount} a month set aside', { amount: baht(s.perMonth) })}</Text>}
                </View>
              </View>
            ))}
          </Glass>
        </RiseIn>

        <RiseIn delay={120} style={styles.kip}>
          <KipStill size={28} />
          <Text style={styles.kipText}>{t('{n} days before each one renews, Kip asks if you still use it', { n: ASK_DAYS })}</Text>
        </RiseIn>

        <RiseIn delay={160} style={{ gap: 8 }}>
          <Pressable onPress={() => router.push('/month?subs=1')} style={styles.action} accessibilityRole="button">
            <Plus size={16} color={colors.ink} weight="bold" />
            <Text style={styles.actionText}>{t('Show Kip your subscriptions')}</Text>
            <CaretRight size={14} color={colors.muted} weight="bold" />
          </Pressable>
        </RiseIn>
      </ScrollView>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    hero: { borderRadius: 28, backgroundColor: colors.paper, padding: 20, gap: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.06)' },
    nums: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    big: { fontFamily: fonts.medium, fontSize: 44, letterSpacing: -2, lineHeight: 52, color: colors.ink, fontVariant: ['tabular-nums'] },
    mid: { fontFamily: fonts.medium, fontSize: 22, letterSpacing: -0.6, lineHeight: 28, color: colors.ink, fontVariant: ['tabular-nums'] },
    lbl: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
    bar: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: inkA(0.06) },
    note: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.08) },
    dot: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 6 },
    name: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
    amt: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
    kip: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
    kipText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
    action: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: 26, backgroundColor: colors.paper },
    actionText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  }),
);
