// History / ประวัติรายการ (approved mockup): every entry, one pay cycle at a time (payday → payday, the same
// "month" as Home), newest first, grouped by day. ‹ › to go back through months. Tap a category chip to see only
// that; tap an entry to change its category; swipe left to delete. Home updates when you come back.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { Squish } from '@/components/glow/motion';
import { Sheet } from '@/components/profile/Sheet';
import { useAuth } from '@/lib/auth';
import { budgetKey, monthNumbers, periodAt, periodMonth, useHome } from '@/lib/home';
import { dayShort, monthLong, monthShort, shownYear, t } from '@/lib/i18n';
import { ICON3D } from '@/lib/icons3d';
import { DB_CAT_NAME, dbCatIcon, IN_CAT_NAME, inCatIcon, type DbCat, type InCat } from '@/lib/kip';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { supabase } from '@/lib/supabase';
import { colors, fonts, inkA, themed } from '@/theme';

type Entry = { id: string; kind: 'spend' | 'income'; amount: number; note: string | null; occurred_at: string; source: string; cat: string };

const SPEND: DbCat[] = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'home_bills', 'travel', 'family_pets', 'giving', 'learning', 'installments', 'other'];
const INCOME: InCat[] = ['pay', 'side_gigs', 'gifts', 'other'];
const asSpend = (c: string): DbCat => ((SPEND as string[]).includes(c) ? (c as DbCat) : 'other');
const asIn = (c: string): InCat => ((INCOME as string[]).includes(c) ? (c as InCat) : 'other');

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const dm = (d: Date) => `${d.getDate()} ${monthShort(d.getMonth())}`;
function dayTitle(d: Date) {
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  const date = `${dayShort(d.getDay())} ${dm(d)}`;
  if (diff === 0) return `${t('Today')} · ${date}`;
  if (diff === 1) return `${t('Yesterday')} · ${date}`;
  return date;
}

export default function History() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { month } = useMonth();
  const { spent } = useHome(month);
  const payday = month?.payday ?? null;
  const [offset, setOffset] = useState(0); // 0 = this pay cycle, -1 = the one before…
  const [rows, setRows] = useState<Entry[] | null>(null);
  const { cat } = useLocalSearchParams<{ cat?: string }>();
  const [filter, setFilter] = useState<string | null>(cat ? `spend:${cat}` : null); // 'spend:food' | 'income' | null
  const firstOffset = useRef(true);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [ids, setIds] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const P = useMemo(() => periodAt(payday, offset), [payday, offset]);
  const named = periodMonth(P);
  const lastDay = new Date(P.end.getFullYear(), P.end.getMonth(), P.end.getDate() - 1);
  const thisYear = named.getFullYear() === new Date().getFullYear();

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, key, kind')
      .is('user_id', null)
      .then(({ data }) => setIds(Object.fromEntries((data ?? []).map((c) => [`${c.kind}:${c.key}`, c.id]))));
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error: e } = await supabase
      .from('transactions')
      .select('id, kind, amount, note, occurred_at, source, categories(key)')
      .eq('user_id', session.user.id)
      .gte('occurred_at', P.start.toISOString())
      .lt('occurred_at', P.end.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(2000);
    if (e) return setError(e.message);
    setError(null);
    setRows(
      (data ?? []).map((r) => ({
        id: r.id as string,
        kind: r.kind as Entry['kind'],
        amount: Number(r.amount),
        note: r.note as string | null,
        occurred_at: r.occurred_at as string,
        source: r.source as string,
        cat: ((r.categories as { key?: string } | null)?.key ?? 'other') as string,
      })),
    );
  }, [session, P]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    // Opened from a Home category: keep that filter on the first load, reset it when the months change.
    if (firstOffset.current) {
      firstOffset.current = false;
      return;
    }
    setRows(null);
    setFilter(null);
  }, [offset]);

  // ---- the month in numbers ----
  const all = rows ?? [];
  const spendRows = all.filter((r) => r.kind === 'spend');
  const inRows = all.filter((r) => r.kind === 'income');
  const totalIn = inRows.reduce((a, r) => a + r.amount, 0);
  // This pay cycle: the same numbers as Home (bills are planned money, so they don't count against spending).
  const isNow = offset === 0;
  const nums = isNow ? monthNumbers(month, spent) : null;
  const counted = spendRows.filter((r) => budgetKey(r.cat, month) !== 'bills').reduce((a, r) => a + r.amount, 0);
  const totalOut = spendRows.reduce((a, r) => a + r.amount, 0);
  const bigNumber = isNow ? spent.total : counted; // rent & bills are planned money — shown on their own line

  const byCat = new Map<string, number>();
  for (const r of spendRows) byCat.set(r.cat, (byCat.get(r.cat) ?? 0) + r.amount);
  const chips = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

  const shown = filter === null ? all : filter === 'income' ? inRows : spendRows.filter((r) => `spend:${r.cat}` === filter);
  const groups: { key: string; title: string; out: number; inn: number; items: Entry[] }[] = [];
  for (const r of shown) {
    const d = new Date(r.occurred_at);
    const key = d.toDateString();
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) groups.push((g = { key, title: dayTitle(d), out: 0, inn: 0, items: [] }));
    g.items.push(r);
    if (r.kind === 'income') g.inn += r.amount;
    else g.out += r.amount;
  }

  async function remove(e: Entry) {
    setRows((xs) => (xs ? xs.filter((x) => x.id !== e.id) : xs));
    const { error: err } = await supabase.from('transactions').delete().eq('id', e.id);
    if (err) {
      setError(t('Couldn’t delete: {msg}', { msg: err.message }));
      return load();
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  async function setCat(e: Entry, c: string) {
    const id = ids[`${e.kind}:${c}`];
    setEditing(null);
    if (!id || c === e.cat) return;
    setRows((xs) => (xs ? xs.map((x) => (x.id === e.id ? { ...x, cat: c } : x)) : xs));
    const { error: err } = await supabase.from('transactions').update({ category_id: id }).eq('id', e.id);
    if (err) {
      setError(t('Couldn’t change it: {msg}', { msg: err.message }));
      return load();
    }
    Haptics.selectionAsync().catch(() => {});
  }

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: insets.bottom + 40, gap: 10 }}>
        <ScreenHeader title={t('History')} />

        {/* which month */}
        <View style={styles.switcher}>
          <Squish onPress={() => setOffset((o) => o - 1)} accessibilityRole="button" accessibilityLabel={t('The month before')}>
            <Glass radius={999} innerStyle={styles.arrow}>
              <CaretLeft size={15} color={colors.ink} weight="bold" />
            </Glass>
          </Squish>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={styles.month}>
              {monthLong(named.getMonth())}
              {thisYear ? '' : ` ${shownYear(named)}`}
            </Text>
            <Text style={styles.range}>{payday ? t('Pay cycle · {from} – {to}', { from: dm(P.start), to: dm(lastDay) }) : `${dm(P.start)} – ${dm(lastDay)}`}</Text>
          </View>
          <Squish onPress={() => setOffset((o) => Math.min(0, o + 1))} disabled={isNow} style={isNow && { opacity: 0.3 }} accessibilityRole="button" accessibilityLabel={t('The month after')}>
            <Glass radius={999} innerStyle={styles.arrow}>
              <CaretRight size={15} color={colors.ink} weight="bold" />
            </Glass>
          </Squish>
        </View>

        {/* the month in numbers */}
        <Glass radius={26} innerStyle={styles.sum}>
          <View style={styles.sumRow}>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.big}>{baht(bigNumber)}</Text>
              <Text style={styles.small}>
                {isNow && nums && nums.spendBudget > 0
                  ? nums.overMonth > 0
                    ? t('spent of {budget} · {over} over', { budget: baht(nums.spendBudget), over: baht(nums.overMonth) })
                    : t('spent of {budget} · {left} left', { budget: baht(nums.spendBudget), left: baht(nums.leftMonth) })
                  : t('spent')}
              </Text>
            </View>
            {totalIn > 0 && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.in}>+{baht(totalIn)}</Text>
                <Text style={styles.small}>{t('money in')}</Text>
              </View>
            )}
          </View>
          {isNow && nums && nums.spendBudget > 0 && (
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${Math.min(100, (spent.total / nums.spendBudget) * 100)}%` }, nums.overMonth > 0 && { backgroundColor: colors.orangeText }]} />
            </View>
          )}
          {counted !== totalOut && <Text style={styles.small}>{t('Rent & bills {amount} are planned on their own, so they’re not in this number', { amount: baht(totalOut - counted) })}</Text>}
          {(chips.length > 0 || totalIn > 0) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
              <View style={{ width: 8 }} />
              <Chip label={t('All')} on={filter === null} onPress={() => setFilter(null)} />
              {chips.map(([c, amt]) => (
                <Chip
                  key={c}
                  icon={dbCatIcon(asSpend(c))}
                  label={DB_CAT_NAME[asSpend(c)]}
                  amount={baht(amt)}
                  on={filter === `spend:${c}`}
                  onPress={() => setFilter(filter === `spend:${c}` ? null : `spend:${c}`)}
                />
              ))}
              {totalIn > 0 && <Chip icon="income" label={t('Money in')} amount={`+${baht(totalIn)}`} on={filter === 'income'} onPress={() => setFilter(filter === 'income' ? null : 'income')} inn />}
              <View style={{ width: 8 }} />
            </ScrollView>
          )}
        </Glass>

        {error && <Text style={[styles.small, { color: colors.orangeText, textAlign: 'center' }]}>{error}</Text>}

        {rows === null ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={colors.muted} />
        ) : all.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 10, marginTop: 30 }}>
            <Kip mood="idle" size={96} />
            <Text style={[styles.small, { textAlign: 'center' }]}>{isNow ? t('Nothing yet this month. Add spending with + or a slip.') : t('Nothing saved this month.')}</Text>
          </View>
        ) : (
          <>
            {groups.map((g) => (
              <View key={g.key} style={{ gap: 6 }}>
                <View style={styles.dayRow}>
                  <Text style={styles.day}>{g.title}</Text>
                  <Text style={styles.dayAmt}>{[g.out ? baht(g.out) : '', g.inn ? `+${baht(g.inn)}` : ''].filter(Boolean).join(' · ')}</Text>
                </View>
                <Glass radius={22} innerStyle={{ overflow: 'hidden' }}>
                  {g.items.map((e, i) => (
                    <Row key={e.id} entry={e} first={i === 0} onDelete={() => remove(e)} onPress={() => setEditing(e)} />
                  ))}
                </Glass>
              </View>
            ))}
            <Text style={[styles.small, { textAlign: 'center', marginTop: 4 }]}>{t('Tap an entry to change its category · swipe left to delete it.')}</Text>
          </>
        )}
      </ScrollView>

      {editing && (
        <Sheet open onClose={() => setEditing(null)} title={editing.kind === 'income' ? t('What was it?') : t('What was it for?')} sub={editing.note || undefined}>
          <View style={styles.cats}>
            {(editing.kind === 'income' ? INCOME : SPEND).map((c) => {
              const isIn = editing.kind === 'income';
              const on = (isIn ? asIn(editing.cat) : asSpend(editing.cat)) === c;
              return (
                <Squish key={c} onPress={() => setCat(editing, c)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Glass radius={999} tint={on ? (isIn ? colors.lavender : colors.lime) : undefined} innerStyle={[styles.catPick, on && { borderWidth: 1.5, borderColor: colors.ink }]}>
                    <Image source={ICON3D[isIn ? inCatIcon(c as InCat) : dbCatIcon(c as DbCat)]} style={{ width: 28, height: 28 }} contentFit="contain" />
                    <Text style={[styles.catText, on && { fontFamily: fonts.medium }]}>{isIn ? IN_CAT_NAME[c as InCat] : DB_CAT_NAME[c as DbCat]}</Text>
                  </Glass>
                </Squish>
              );
            })}
          </View>
        </Sheet>
      )}
    </View>
  );
}

function Chip({ icon, label, amount, on, onPress, inn }: { icon?: keyof typeof ICON3D; label: string; amount?: string; on: boolean; onPress: () => void; inn?: boolean }) {
  return (
    <Squish onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Glass radius={999} tint={on ? colors.ink : undefined} innerStyle={[styles.chip, !icon && { paddingLeft: 14 }]}>
        {icon && <Image source={ICON3D[icon]} style={{ width: 26, height: 26 }} contentFit="contain" />}
        <Text style={[styles.chipText, on && { color: colors.paper }]}>{label}</Text>
        {amount ? <Text style={[styles.chipAmt, inn && !on && { color: colors.lavenderText }, on && { color: colors.paper }]}>{amount}</Text> : null}
      </Glass>
    </Squish>
  );
}

function Row({ entry, first, onDelete, onPress }: { entry: Entry; first: boolean; onDelete: () => void; onPress: () => void }) {
  const isIn = entry.kind === 'income';
  const name = isIn ? IN_CAT_NAME[asIn(entry.cat)] : DB_CAT_NAME[asSpend(entry.cat)];
  const icon = isIn ? inCatIcon(asIn(entry.cat)) : dbCatIcon(asSpend(entry.cat));
  const from = entry.source === 'slip' ? t('slip') : entry.source === 'typed' ? 'Kip' : null;
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={60}
      overshootRight={false}
      renderRightActions={(_p, _t, methods) => (
        <Pressable
          onPress={() => {
            methods.close();
            onDelete();
          }}
          style={styles.del}
          accessibilityRole="button"
          accessibilityLabel={t('Delete')}>
          <Text style={styles.delText}>{t('Delete')}</Text>
        </Pressable>
      )}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, !first && styles.line, pressed && { backgroundColor: '#F5F2EC' }]}
        accessibilityRole="button"
        accessibilityHint={t('Change its category')}>
        <Image source={ICON3D[icon]} style={{ width: 36, height: 36 }} contentFit="contain" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.note || name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <Text style={styles.small}>
              {hhmm(new Date(entry.occurred_at))} · {name}
            </Text>
            {from && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{from}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={[styles.amt, isIn && { color: colors.lavenderText }]}>
          {isIn ? '+' : ''}
          {baht(entry.amount)}
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    switcher: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    month: { fontFamily: fonts.medium, fontSize: 24, letterSpacing: -0.5, color: colors.ink },
    range: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
    sum: { padding: 16, gap: 12 },
    sumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
    big: { fontFamily: fonts.medium, fontSize: 34, letterSpacing: -1.2, color: colors.ink, fontVariant: ['tabular-nums'] },
    in: { fontFamily: fonts.medium, fontSize: 19, color: colors.lavenderText, fontVariant: ['tabular-nums'] },
    bar: { height: 8, borderRadius: 9, backgroundColor: inkA(0.08), overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 9, backgroundColor: colors.ink },
    chip: { height: 38, paddingLeft: 6, paddingRight: 13, flexDirection: 'row', alignItems: 'center', gap: 6 },
    chipText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
    chipAmt: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, fontVariant: ['tabular-nums'] },
    dayRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 4, marginTop: 8 },
    day: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
    dayAmt: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, backgroundColor: colors.card },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.06) },
    name: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    amt: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
    tag: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: inkA(0.06) },
    tagText: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
    del: { width: 88, backgroundColor: colors.orangeText, alignItems: 'center', justifyContent: 'center' },
    delText: { fontFamily: fonts.medium, fontSize: 14, color: colors.paper },
    cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 8 },
    catPick: { height: 42, paddingLeft: 6, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
    catText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
  }),
);
