// "Add it yourself" — Spent / Got paid, a category, a note, when, and the keypad.
// Kip shows what this does to today's money before you save, using the same numbers as Home.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Backspace, CalendarBlank, Lock, PencilSimple, Receipt } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatBadge } from '@/components/CatIcon';
import { Kip } from '@/components/Kip';
import { ChatPeek, PlusSheet } from '@/components/PlusSheet';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { Squish } from '@/components/glow/motion';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { CATEGORY, type IconKey } from '@/lib/budget';
import { budgetKey, monthNumbers, useHome } from '@/lib/home';
import { ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { supabase } from '@/lib/supabase';
import { colors, fonts, money } from '@/theme';

type Kind = 'spend' | 'income';
type Cat = { key: string; name: string; icon: IconKey; color: string; i3?: Icon3D };

// Spending: the five you use most, then More. Colours follow the budget each one counts against.
const SPEND_MAIN: Cat[] = [
  { key: 'food', name: 'Food', icon: 'food', color: CATEGORY.food.color, i3: 'bowl' },
  { key: 'transport', name: 'Transport', icon: 'travel', color: CATEGORY.transport.color, i3: 'car' },
  { key: 'shopping', name: 'Shopping', icon: 'shop', color: CATEGORY.shopping.color, i3: 'shop' },
  { key: 'fun', name: 'Fun', icon: 'fun', color: CATEGORY.fun.color, i3: 'fun' },
  { key: 'home_bills', name: 'Home & bills', icon: 'rent', color: money.fixed, i3: 'house' },
];
const SPEND_MORE: Cat[] = [
  { key: 'health_beauty', name: 'Health & beauty', icon: 'health', color: CATEGORY.health_beauty.color, i3: 'heart' },
  { key: 'giving', name: 'Giving', icon: 'gift', color: CATEGORY.giving.color, i3: 'piggy' },
  { key: 'learning', name: 'Learning', icon: 'book', color: CATEGORY.learning.color },
  { key: 'travel', name: 'Travel', icon: 'plane', color: CATEGORY.other.color, i3: 'plane' },
  { key: 'family_pets', name: 'Family & pets', icon: 'family', color: CATEGORY.other.color },
  { key: 'installments', name: 'Installments', icon: 'note', color: CATEGORY.other.color, i3: 'bill' },
  { key: 'other', name: 'Other', icon: 'more', color: CATEGORY.other.color },
];
// Money in is one kind of thing, so one colour (the Income colour on Home).
const INCOME: Cat[] = [
  { key: 'pay', name: 'Pay', icon: 'cash', color: colors.lavender, i3: 'income' },
  { key: 'side_gigs', name: 'Side gigs', icon: 'phone', color: colors.lavender, i3: 'phone' },
  { key: 'gifts', name: 'Gifts', icon: 'gift', color: colors.lavender, i3: 'piggy' },
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
    if (cat.key === 'pay' && amount > 0 && amount < month.income) return { text: 'Part of this month’s pay — ', bold: baht(month.income - amount), rest: ' still to come', warn: false };
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
    <View style={{ flex: 1, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }}>
      <GlowBackground />
      <View style={{ paddingHorizontal: 18 }}>
        <ScreenHeader
          title="Add it yourself"
          right={
            <Squish onPress={() => setSlip(true)} accessibilityRole="button" accessibilityLabel={isPlus ? 'Add from a slip' : 'Add from a slip — Plus'}>
              <Glass radius={23} innerStyle={styles.slip}>
                <Receipt size={17} color={colors.ink} weight="fill" />
                <Text style={styles.slipText}>Slip</Text>
                {!isPlus && (
                  <View style={styles.lk}>
                    <Lock size={9} color="#FFFFFF" weight="fill" />
                  </View>
                )}
              </Glass>
            </Squish>
          }
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 16, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {slip && isPlus && <Text style={[styles.hint, styles.soon]}>Slip reading is almost here — for now, type it in. It takes 3 seconds.</Text>}
        <View style={{ paddingHorizontal: 18 }}>
          <Switch kind={kind} onChange={switchKind} />
        </View>

        <View style={{ alignItems: 'center', gap: 10, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.amount, !digits && { color: colors.faint }]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={{ fontSize: 34 }}>฿</Text>
              {shown}
            </Text>
            <Caret />
          </View>
          {hint && (
            <View style={styles.kipLine}>
              <Kip mood={hint.warn ? 'careful' : 'happy'} size={30} />
              <Text style={[styles.hint, hint.warn && { color: colors.orangeText }]}>
                {hint.text}
                {hint.bold && <Text style={{ fontFamily: fonts.semibold, color: hint.warn ? colors.orangeText : colors.ink }}>{hint.bold}</Text>}
                {'rest' in hint ? hint.rest : ''}
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ marginVertical: -14 }}
          contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 14, gap: 8 }}>
          {chips.map((c) => {
            const on = c.key === cat.key;
            return (
              <Squish key={c.key} onPress={() => setCat(c)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={c.name}>
                <Glass radius={23} tint={on ? colors.lime : undefined} innerStyle={[styles.chip, on && styles.chipOn]}>
                  {c.i3 ? <Image source={ICON3D[c.i3]} style={{ width: 36, height: 36 }} contentFit="contain" /> : <CatBadge name={c.icon} color={c.color} size={30} />}
                  <Text style={[styles.chipText, on && { fontFamily: fonts.medium }]}>{c.name}</Text>
                </Glass>
              </Squish>
            );
          })}
          {kind === 'spend' && !more && (
            <Squish onPress={() => setMore(true)} accessibilityRole="button" accessibilityLabel="More categories">
              <Glass radius={23} innerStyle={styles.chip}>
                <Text style={[styles.chipText, { width: 30, textAlign: 'center', letterSpacing: 1 }]}>•••</Text>
                <Text style={styles.chipText}>More</Text>
              </Glass>
            </Squish>
          )}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 18 }}>
          <Glass radius={18} style={{ flex: 1 }} innerStyle={styles.field}>
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
          </Glass>
          <Pressable style={{ flex: 1 }} onPress={() => setPickWhen(true)} accessibilityRole="button" accessibilityLabel={`When: ${whenLabel(when)}`}>
            <Glass radius={18} innerStyle={styles.field}>
              <CalendarBlank size={16} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldK}>When</Text>
                <Text style={styles.fieldV} numberOfLines={1}>
                  {whenLabel(when)}
                </Text>
              </View>
            </Glass>
          </Pressable>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 18, gap: 10 }}>
        <View style={{ gap: 7 }}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['.', '0', 'del'],
          ].map((row) => (
            <View key={row.join('')} style={{ flexDirection: 'row', gap: 7 }}>
              {row.map((k) => (
                <Squish key={k} haptic={false} onPress={() => press(k)} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={k === 'del' ? 'Delete' : k}>
                  <Glass radius={18} innerStyle={styles.key}>
                    {k === 'del' ? <Backspace size={24} color={colors.ink} /> : <Text style={styles.keyText}>{k}</Text>}
                  </Glass>
                </Squish>
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
          sub="Take a photo of a bank slip and I fill in the amount, category and time for you.">
          <ChatPeek ask="📷  KBank slip · 13:05" answer="Got it — ฿80, Transport, today 13:05. Saved ✓" />
        </PlusSheet>
      )}
    </View>
  );
}

/** Spent / Got paid — a black knob slides between them. */
function Switch({ kind, onChange }: { kind: Kind; onChange: (k: Kind) => void }) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(kind === 'spend' ? 0 : 1, { damping: 16, stiffness: 180 });
  }, [kind, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (w / 2 - 4) }] }));
  return (
    <Glass radius={24} innerStyle={styles.seg}>
      <View style={StyleSheet.absoluteFill} onLayout={(e) => setW(e.nativeEvent.layout.width)} pointerEvents="none" />
      <Animated.View style={[styles.segKnob, { width: w / 2 - 4 }, knob]} />
      {(['spend', 'income'] as Kind[]).map((k) => (
        <Pressable key={k} onPress={() => onChange(k)} style={styles.segBtn} accessibilityRole="tab" accessibilityState={{ selected: kind === k }}>
          <Text style={[styles.segText, kind === k && { color: '#FFFFFF' }]}>{k === 'spend' ? 'Spent' : 'Got paid'}</Text>
        </Pressable>
      ))}
    </Glass>
  );
}

/** A blinking cursor after the amount. */
function Caret() {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 0 }), withTiming(0, { duration: 500 }), withTiming(1, { duration: 0 })), -1);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.caret, a]} />;
}

const styles = StyleSheet.create({
  slip: { height: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  slipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  lk: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  soon: { marginHorizontal: 18, backgroundColor: colors.lime, borderRadius: 14, padding: 10, color: colors.ink },
  seg: { flexDirection: 'row', height: 48, padding: 4 },
  segKnob: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 999, backgroundColor: colors.ink },
  segBtn: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  amount: { fontFamily: fonts.regular, fontSize: 64, letterSpacing: -3, color: colors.ink, fontVariant: ['tabular-nums'], maxWidth: 320 },
  caret: { width: 3, height: 54, backgroundColor: colors.ink, marginLeft: 4, borderRadius: 2 },
  kipLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  hint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.muted, textAlign: 'center', flexShrink: 1 },
  chip: { height: 46, paddingLeft: 5, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipOn: { borderWidth: 1.5, borderColor: colors.ink },
  chipText: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  field: { minHeight: 56, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldK: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  fieldV: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, padding: 0, outlineStyle: 'none' } as never,
  key: { height: 50, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: fonts.regular, fontSize: 24, color: colors.ink },
  backdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.45)' },
  whenSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 8 },
  whenTitle: { fontFamily: fonts.semibold, fontSize: 19, color: colors.ink, marginBottom: 4 },
  whenRow: { height: 48, borderRadius: 14, backgroundColor: colors.grey, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 16, justifyContent: 'center' },
});
