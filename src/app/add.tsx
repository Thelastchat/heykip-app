// "Add it yourself" — Spent / Got paid, a category, a note, when, and the keypad.
// Kip shows what this does to today's money before you save, using the same numbers as Home.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Backspace, CalendarBlank, PencilSimple, Receipt } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatBadge } from '@/components/CatIcon';
import { PlusSheet } from '@/components/PlusSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { CATEGORY, type IconKey } from '@/lib/budget';
import { budgetKey, monthNumbers, useHome } from '@/lib/home';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { supabase } from '@/lib/supabase';
import { colors, fonts, money, radius } from '@/theme';

type Kind = 'spend' | 'income';
type Cat = { key: string; name: string; icon: IconKey; color: string };

// Spending: the five you use most, then More. Colours follow the budget each one counts against.
const SPEND_MAIN: Cat[] = [
  { key: 'food', name: 'Food', icon: 'food', color: CATEGORY.food.color },
  { key: 'transport', name: 'Transport', icon: 'travel', color: CATEGORY.transport.color },
  { key: 'shopping', name: 'Shopping', icon: 'shop', color: CATEGORY.shopping.color },
  { key: 'fun', name: 'Fun', icon: 'fun', color: CATEGORY.fun.color },
  { key: 'home_bills', name: 'Home & bills', icon: 'rent', color: money.fixed },
];
const SPEND_MORE: Cat[] = [
  { key: 'health_beauty', name: 'Health & beauty', icon: 'health', color: CATEGORY.health_beauty.color },
  { key: 'giving', name: 'Giving', icon: 'gift', color: CATEGORY.giving.color },
  { key: 'learning', name: 'Learning', icon: 'book', color: CATEGORY.learning.color },
  { key: 'travel', name: 'Travel', icon: 'plane', color: CATEGORY.other.color },
  { key: 'family_pets', name: 'Family & pets', icon: 'family', color: CATEGORY.other.color },
  { key: 'installments', name: 'Installments', icon: 'note', color: CATEGORY.other.color },
  { key: 'other', name: 'Other', icon: 'more', color: CATEGORY.other.color },
];
// Money in is one kind of thing, so one colour (the Income colour on Home).
const INCOME: Cat[] = [
  { key: 'pay', name: 'Pay', icon: 'cash', color: colors.lavender },
  { key: 'side_gigs', name: 'Side gigs', icon: 'phone', color: colors.lavender },
  { key: 'gifts', name: 'Gifts', icon: 'gift', color: colors.lavender },
  { key: 'other', name: 'Other', icon: 'more', color: colors.lavender },
];

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function whenLabel(d: Date) {
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / DAY_MS);
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${day}, ${hhmm(d)}`;
}

export default function Add() {
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const { month } = useMonth();
  const { spent, goals } = useHome(month);
  const isPlus = profile ? profile.plan !== 'free' : false;

  const [kind, setKind] = useState<Kind>('spend');
  const [digits, setDigits] = useState('');
  const [cat, setCat] = useState<Cat>(SPEND_MAIN[0]);
  const [more, setMore] = useState(false);
  const [note, setNote] = useState('');
  const [when, setWhen] = useState(() => new Date());
  const [pickWhen, setPickWhen] = useState(false);
  const [slip, setSlip] = useState(false);
  const [ids, setIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category ids, so a row points at the shared category list.
  useEffect(() => {
    supabase
      .from('categories')
      .select('id, key, kind')
      .is('user_id', null)
      .then(({ data }) => setIds(Object.fromEntries((data ?? []).map((c) => [`${c.kind}:${c.key}`, c.id]))));
  }, []);

  const amount = Number(digits || '0');
  const short = goals[0]?.title ?? 'your goal';

  // ---- what Kip says before you save ----
  const hint = useMemo(() => {
    if (!month) return null;
    if (kind === 'spend') {
      const bucket = budgetKey(cat.key, month);
      if (bucket === 'bills') return { text: 'Bills are already in your plan — this won’t touch today’s money', bold: null, warn: false };
      const isToday = when.toDateString() === new Date().toDateString();
      // Pretend it's saved, then ask the same question Home asks.
      const after = monthNumbers(month, { ...spent, total: spent.total + amount, today: spent.today + (isToday ? amount : 0) });
      const before = monthNumbers(month, spent);
      if (!isToday) return { text: 'Left for today after this: ', bold: baht(after.leftToday), warn: after.leftToday < before.leftToday };
      const over = amount - before.leftToday;
      if (over > 0) return { text: `That’s ${baht(over)} over today — fine, I’ll spread it over the next ${before.P.daysLeft - 1 || 1} days`, bold: null, warn: true };
      return { text: amount ? 'Left for today after this: ' : 'Left for today: ', bold: baht(after.leftToday), warn: false };
    }
    // Money in. Pay is what the plan already runs on; anything extra gets a job.
    const extra = cat.key === 'pay' ? Math.max(0, amount - month.income) : amount;
    if (cat.key === 'pay' && extra === 0) return { text: `Your plan runs on ${baht(month.income)} a month — this is it`, bold: null, warn: false };
    if (extra === 0) return null;
    const building = month.safety.amount > 0;
    const part = Math.round((extra * 0.2) / 10) * 10;
    if (building && part > 0)
      return isPlus ? { text: 'Kip puts ', bold: baht(part), rest: ' in your safety net first', warn: false } : { text: 'Tip: put ', bold: baht(part), rest: ' in your safety net first', warn: false };
    return { text: isPlus ? 'Kip moves it to ' : 'Tip: move it to ', bold: short, rest: ' — you’ll get there sooner', warn: false };
  }, [month, kind, cat, amount, when, spent, isPlus, short]);

  function press(k: string) {
    Haptics.selectionAsync().catch(() => {});
    setError(null);
    setDigits((d) => {
      if (k === 'del') return d.slice(0, -1);
      if (k === '.') return d.includes('.') ? d : (d || '0') + '.';
      if (d.includes('.') && d.split('.')[1].length >= 2) return d;
      if (!d.includes('.') && d.replace('.', '').length >= 7) return d;
      if (d === '0') return k;
      return d + k;
    });
  }

  function switchKind(k: Kind) {
    if (k === kind) return;
    setKind(k);
    setMore(false);
    setCat(k === 'spend' ? SPEND_MAIN[0] : INCOME[0]);
  }

  async function save() {
    if (!session || amount <= 0) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.from('transactions').insert({
      user_id: session.user.id,
      kind,
      amount,
      category_id: ids[`${kind}:${cat.key}`] ?? null,
      note: note.trim() || null,
      occurred_at: when.toISOString(),
      source: 'manual',
    });
    setBusy(false);
    if (e) return setError(`Couldn’t save: ${e.message}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.canGoBack() ? router.back() : router.replace('/');
  }

  const chips = kind === 'income' ? INCOME : more ? [...SPEND_MAIN, ...SPEND_MORE] : SPEND_MAIN;
  const shown = digits ? Number(digits.replace(/\.$/, '')).toLocaleString('en-US', { maximumFractionDigits: 2 }) + (digits.endsWith('.') ? '.' : '') : '0';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }}>
      <View style={{ paddingHorizontal: 20 }}>
        <ScreenHeader
          title="Add it yourself"
          right={
            <Pressable onPress={() => setSlip(true)} style={styles.slip} accessibilityRole="button" accessibilityLabel={isPlus ? 'Add from a slip' : 'Add from a slip — Plus'}>
              <Receipt size={18} color={colors.ink} />
              <Text style={styles.slipText}>Slip</Text>
            </Pressable>
          }
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        {slip && isPlus && (
          <Text style={[styles.hint, { backgroundColor: colors.lime, borderRadius: 14, padding: 10, color: colors.ink }]}>Slip reading is almost here — for now, type it in. It takes 3 seconds.</Text>
        )}
        <View style={styles.seg}>
          {(['spend', 'income'] as Kind[]).map((k) => (
            <Pressable key={k} onPress={() => switchKind(k)} style={[styles.segBtn, kind === k && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: kind === k }}>
              <Text style={[styles.segText, kind === k && { color: '#FFFFFF' }]}>{k === 'spend' ? 'Spent' : 'Got paid'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ alignItems: 'center', gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.amount, !digits && { color: colors.faint }]} numberOfLines={1} adjustsFontSizeToFit>
              ฿{shown}
            </Text>
            <View style={styles.caret} />
          </View>
          {hint && (
            <Text style={[styles.hint, hint.warn && { color: colors.orange }]}>
              {hint.text}
              {hint.bold && <Text style={{ fontFamily: fonts.semibold, color: hint.warn ? colors.orange : colors.ink }}>{hint.bold}</Text>}
              {'rest' in hint ? hint.rest : ''}
            </Text>
          )}
        </View>

        <View style={styles.chips}>
          {chips.map((c) => {
            const on = c.key === cat.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setCat(c);
                }}
                style={[styles.chip, on && { backgroundColor: c.color === money.fixed ? colors.grey : c.color, borderColor: colors.ink }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}>
                <CatBadge name={c.icon} color={c.color} size={28} />
                <Text style={[styles.chipText, on && { fontFamily: fonts.semibold }]}>{c.name}</Text>
              </Pressable>
            );
          })}
          {kind === 'spend' && !more && (
            <Pressable onPress={() => setMore(true)} style={[styles.chip, { backgroundColor: '#FFFFFF', borderColor: colors.border }]} accessibilityRole="button">
              <CatBadge name="more" color={colors.grey} size={28} />
              <Text style={styles.chipText}>More</Text>
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={styles.field}>
            <PencilSimple size={16} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldK}>Note</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={kind === 'spend' ? 'Grab to work' : 'Logo for a café'}
                placeholderTextColor={colors.faint}
                style={styles.fieldV}
                maxLength={60}
              />
            </View>
          </View>
          <Pressable style={styles.field} onPress={() => setPickWhen(true)} accessibilityRole="button" accessibilityLabel={`When: ${whenLabel(when)}`}>
            <CalendarBlank size={16} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldK}>When</Text>
              <Text style={styles.fieldV} numberOfLines={1}>
                {whenLabel(when)}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <View style={{ gap: 8 }}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['.', '0', 'del'],
          ].map((row) => (
            <View key={row.join('')} style={{ flexDirection: 'row', gap: 8 }}>
              {row.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => press(k)}
                  style={({ pressed }) => [styles.key, pressed && { backgroundColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={k === 'del' ? 'Delete' : k}>
                  {k === 'del' ? <Backspace size={24} color={colors.ink} /> : <Text style={styles.keyText}>{k}</Text>}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
        {error && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.orange, textAlign: 'center' }}>{error}</Text>}
        <Button label={amount > 0 ? `Save ${baht(amount)}` : 'Save'} disabled={amount <= 0 || busy} loading={busy} onPress={save} />
      </View>

      <Modal visible={pickWhen} transparent animationType="fade" onRequestClose={() => setPickWhen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickWhen(false)} />
        <View style={[styles.whenSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <Text style={styles.whenTitle}>When was it?</Text>
          {Array.from({ length: 7 }, (_, i) => {
            const now = new Date();
            const d = i === 0 ? now : new Date(new Date(now.getTime() - i * DAY_MS).setHours(12, 0, 0, 0));
            const on = d.toDateString() === when.toDateString();
            return (
              <Pressable
                key={i}
                onPress={() => {
                  setWhen(d);
                  setPickWhen(false);
                }}
                style={[styles.whenRow, on && { backgroundColor: colors.lime, borderColor: colors.ink }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}>
                <Text style={styles.chipText}>{i === 0 ? 'Today' : i === 1 ? 'Yesterday' : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`}</Text>
              </Pressable>
            );
          })}
        </View>
      </Modal>

      {slip && !isPlus && (
        <PlusSheet
          open
          onClose={() => setSlip(false)}
          onUnlocked={() => setSlip(false)}
          title="Snap a slip, I’ll log it"
          sub="Take a photo of a bank slip and I fill in the amount, category and time for you."
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slip: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
  },
  slipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  seg: { flexDirection: 'row', backgroundColor: colors.grey, borderRadius: radius.pill, padding: 4 },
  segBtn: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted },
  amount: { fontFamily: fonts.medium, fontSize: 60, letterSpacing: -2.4, color: colors.ink, fontVariant: ['tabular-nums'], maxWidth: 320 },
  caret: { width: 2.5, height: 52, backgroundColor: colors.orange, marginLeft: 3, borderRadius: 2 },
  hint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.muted, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 44,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.grey,
    borderWidth: 1.5,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipText: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  field: { flex: 1, minHeight: 56, borderRadius: radius.field, backgroundColor: colors.grey, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldK: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  fieldV: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, padding: 0, outlineStyle: 'none' } as never,
  key: { flex: 1, height: 52, borderRadius: 16, backgroundColor: colors.grey, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: fonts.medium, fontSize: 24, color: colors.ink },
  backdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.45)' },
  whenSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 8 },
  whenTitle: { fontFamily: fonts.semibold, fontSize: 19, color: colors.ink, marginBottom: 4 },
  whenRow: { height: 48, borderRadius: 14, backgroundColor: colors.grey, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 16, justifyContent: 'center' },
});
