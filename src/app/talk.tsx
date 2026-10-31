// Talk to Kip (Plus). Type what you spent, ask "Can I buy this?", or ask anything about your month.
// The server only understands the words; every number here comes from the person's own plan.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowUp, Microphone, X } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { PlusSheet } from '@/components/PlusSheet';
import { plusPitch } from '@/components/plusPitch';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { RiseIn, Squish } from '@/components/glow/motion';
import { useAuth } from '@/lib/auth';
import { CATEGORY } from '@/lib/budget';
import { monthNumbers, useHome } from '@/lib/home';
import { CAT_ICON3D, goalIcon3D, goalTypeIcon3D, ICON3D } from '@/lib/icons3d';
import { applyBuy, askKip, buyPlan, DB_CAT_NAME, dbCatIcon, kipContext, type BuyPlan, type KipReply, type LogItem } from '@/lib/kip';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { monthYear, parseDay, shortName } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { colors, fonts, glow } from '@/theme';

type Turn = { id: number; me: string; state: 'thinking' | 'done' | 'error'; reply?: KipReply; plan?: BuyPlan | null; error?: string; saved?: boolean; bought?: boolean; dismissed?: boolean };
const SUGGEST = ['Chicken rice 60, Thai tea 45 and Grab 80', 'Can I buy a shirt for 890?', 'How am I doing this month?', 'ข้าวกะเพรา 70 กาแฟ 55'];

export default function Talk() {
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const { month, save } = useMonth();
  const { spent, goals, reload } = useHome(month);
  const isPlus = profile ? profile.plan !== 'free' : false;
  const [locked, setLocked] = useState(!isPlus);
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [ids, setIds] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const nextId = useRef(1);

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, key')
      .eq('kind', 'spend')
      .is('user_id', null)
      .then(({ data }) => setIds(Object.fromEntries((data ?? []).map((c) => [c.key, c.id]))));
  }, []);

  const goal = goals[0];
  const short = goal ? (goal.kind === 'monthly' ? goal.title : shortName(goal.title, goal.kind as never)) : 'your goal';
  const arrives = goal?.due ? monthYear(parseDay(goal.due)) : null;
  const goalIcon = goal ? (goal.goalType ? goalTypeIcon3D(goal.goalType) : goalIcon3D(goal.kind)) : 'piggy';
  const n = month ? monthNumbers(month, spent) : null;
  const funLeft = Math.max(0, (month?.spend.find((s) => s.key === 'fun')?.amount ?? 0) - (spent.byCat.fun ?? 0));
  const pitch = useMemo(() => plusPitch(month, short, funLeft), [month, short, funLeft]);
  const first = profile?.display_name?.split(' ')[0];

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(null), 2400);
  }
  const update = (id: number, patch: Partial<Turn>) => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  async function send(said = text) {
    const msg = said.trim();
    if (!msg) return;
    if (!isPlus) return setLocked(true);
    Haptics.selectionAsync().catch(() => {});
    const id = nextId.current++;
    setText('');
    setTurns((ts) => [...ts, { id, me: msg, state: 'thinking' }]);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    const res = await askKip(msg, kipContext(month, spent, goal ? { name: short, arrives } : null, first));
    // The buy answer is worked out once, from the month as it was when Kip answered.
    if (res.ok) update(id, { state: 'done', reply: res.reply, plan: res.reply.kind === 'buy' && res.reply.buy && month ? buyPlan(month, spent, res.reply.buy) : null });
    else
      update(id, {
        state: 'error',
        error:
          res.reason === 'nokey'
            ? 'I’m not switched on yet — my AI key still needs to be added in Supabase.'
            : res.reason === 'plus'
              ? 'Talking to me is a Plus feature.'
              : res.reason === 'offline'
                ? 'I can’t reach the internet right now. Try again in a moment?'
                : 'I got a bit muddled. Try saying it another way?',
      });
    if (!res.ok && res.reason === 'plus') setLocked(true);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 120);
  }

  async function saveItems(t: Turn, items: LogItem[]) {
    if (!session || items.length === 0) return;
    const rows = items.map((it) => ({ user_id: session.user.id, kind: 'spend', amount: it.amount, category_id: ids[it.category] ?? ids.other ?? null, note: it.name, source: 'typed' }));
    const { error } = await supabase.from('transactions').insert(rows);
    if (error) return flash(`Couldn’t save: ${error.message}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    update(t.id, { saved: true });
    reload();
  }

  async function buyIt(t: Turn, item: LogItem, plan: BuyPlan) {
    if (!session || !month) return;
    const { error } = await supabase
      .from('transactions')
      .insert({ user_id: session.user.id, kind: 'spend', amount: item.amount, category_id: ids[item.category] ?? null, note: item.name, source: 'typed' });
    if (error) return flash(`Couldn’t save: ${error.message}`);
    save(applyBuy(month, plan));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    update(t.id, { bought: true });
    reload();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <GlowBackground />
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel="Close">
          <Glass radius={22} innerStyle={styles.round}>
            <X size={16} color={colors.ink} weight="bold" />
          </Glass>
        </Pressable>
        <Glass radius={999} innerStyle={styles.status}>
          <View style={[styles.dot, turns.some((t) => t.state === 'thinking') && { backgroundColor: colors.orange }]} />
          <Text style={styles.statusText}>{turns.some((t) => t.state === 'thinking') ? 'Thinking…' : isPlus ? 'Kip · Plus' : 'Kip · Plus feature'}</Text>
        </Glass>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 20, gap: 14, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {turns.length === 0 && (
          <RiseIn style={{ alignItems: 'center', gap: 4, marginTop: 10 }}>
            <Text style={styles.hey}>Hey {first ?? 'there'}</Text>
            <Text style={styles.h1}>What did you spend today?</Text>
            <View style={{ marginVertical: 18 }}>
              <Kip mood="listen" size={170} />
            </View>
            <Text style={[styles.sub, { textAlign: 'center', paddingHorizontal: 20 }]}>
              Just type it like you’d text a friend — or ask me “Can I buy…?”. {n ? `You have ${baht(n.leftToday)} left today.` : ''}
            </Text>
          </RiseIn>
        )}

        {turns.map((t) => (
          <View key={t.id} style={{ gap: 10 }}>
            <View style={styles.me}>
              <Text style={styles.meText}>{t.me}</Text>
            </View>
            {t.state === 'thinking' && <KipLine mood="think" text="Let me look…" />}
            {t.state === 'error' && <KipLine mood="careful" text={t.error ?? ''} />}
            {t.state === 'done' && t.reply && (
              <Answer
                t={t}
                reply={t.reply}
                month={month}
                plan={t.plan ?? null}
                goal={{ name: short, arrives, icon: goalIcon }}
                onSave={(items) => saveItems(t, items)}
                onBuy={(item, plan) => buyIt(t, item, plan)}
                onNotNow={() => update(t.id, { dismissed: true })}
              />
            )}
          </View>
        ))}
      </ScrollView>

      {turns.length === 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 18, gap: 7, paddingBottom: 10 }}>
          {SUGGEST.map((s) => (
            <Squish key={s} onPress={() => send(s)} accessibilityRole="button">
              <Glass radius={999} innerStyle={styles.sug}>
                <Text style={styles.sugText}>{s}</Text>
              </Glass>
            </Squish>
          ))}
        </ScrollView>
      )}

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <Pressable onPress={() => flash('Talking out loud comes with the next app build — type for now')} accessibilityRole="button" accessibilityLabel="Voice — coming soon">
          <Glass radius={25} innerStyle={styles.mic}>
            <Microphone size={20} color={colors.muted} />
          </Glass>
        </Pressable>
        <Glass radius={25} style={{ flex: 1 }} innerStyle={styles.inputWrap}>
          <TextInput
            value={text}
            onChangeText={setText}
            onFocus={() => !isPlus && setLocked(true)}
            placeholder={isPlus ? 'Grab 80, lunch 60… or “Can I buy…?”' : 'Talk to Kip is a Plus feature'}
            placeholderTextColor={colors.faint}
            style={styles.input}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            maxLength={300}
            accessibilityLabel="Message Kip"
          />
        </Glass>
        <Squish onPress={() => send()} style={[styles.send, !text.trim() && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Send">
          <ArrowUp size={20} color="#FFFFFF" weight="bold" />
        </Squish>
      </View>

      {toast && (
        <View style={[styles.toast, { bottom: 90 + Math.max(insets.bottom, 12) }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {locked && !isPlus && (
        <PlusSheet open onClose={() => setLocked(false)} onUnlocked={() => setLocked(false)} title={pitch.talk.title} sub={pitch.talk.sub}>
          {pitch.talk.body}
        </PlusSheet>
      )}
    </KeyboardAvoidingView>
  );
}

function KipLine({ text, mood = 'happy' }: { text: string; mood?: 'happy' | 'think' | 'careful' }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <Kip mood={mood} size={40} />
      <Glass radius={20} style={{ flex: 1 }} innerStyle={styles.kipBub}>
        <Text style={styles.kipText}>{text}</Text>
      </Glass>
    </View>
  );
}

function Answer({
  t,
  reply,
  month,
  plan,
  goal,
  onSave,
  onBuy,
  onNotNow,
}: {
  t: Turn;
  reply: KipReply;
  month: ReturnType<typeof useMonth>['month'];
  plan: BuyPlan | null;
  goal: { name: string; arrives: string | null; icon: keyof typeof ICON3D };
  onSave: (items: LogItem[]) => void;
  onBuy: (item: LogItem, plan: BuyPlan) => void;
  onNotNow: () => void;
}) {
  const [items, setItems] = useState<LogItem[]>(reply.items ?? []);

  if (reply.kind === 'log' && items.length) {
    const total = items.reduce((a, i) => a + i.amount, 0);
    return (
      <>
        <KipLine text={reply.reply} />
        <Glass radius={24} innerStyle={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.cap}>{t.saved ? 'SAVED ✓' : 'KIP HEARD · TAP × TO REMOVE'}</Text>
            <Text style={styles.cap}>{baht(total)}</Text>
          </View>
          {items.map((it, i) => (
            <View key={`${it.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image source={ICON3D[dbCatIcon(it.category)]} style={{ width: 34, height: 34 }} contentFit="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.sub}>{DB_CAT_NAME[it.category]}</Text>
              </View>
              <Text style={styles.itemAmt}>{baht(it.amount)}</Text>
              {!t.saved && (
                <Pressable onPress={() => setItems((xs) => xs.filter((_, j) => j !== i))} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${it.name}`} style={styles.x}>
                  <X size={11} color={colors.muted} weight="bold" />
                </Pressable>
              )}
            </View>
          ))}
          {!t.saved && (
            <Squish onPress={() => onSave(items)} style={styles.dark} accessibilityRole="button">
              <Text style={styles.darkText}>
                Save {items.length > 1 ? `all ${items.length}` : 'it'} · {baht(total)}
              </Text>
            </Squish>
          )}
        </Glass>
      </>
    );
  }

  if (reply.kind === 'buy' && reply.buy && plan && month) {
    const it = reply.buy;
    const catName = plan.key === 'bills' ? 'Home & bills' : CATEGORY[plan.key].name;
    const answer = !plan.fits
      ? `Not this month, honestly. It’s ${baht(plan.short)} more than your budgets can spare — it would have to come from ${goal.name}.`
      : plan.moves.length
        ? `Yes, you can. ${catName} has ${baht(it.amount - plan.moves.reduce((a, m) => a + m.amount, 0))} left, so I’d borrow ${baht(plan.moves.reduce((a, m) => a + m.amount, 0))} from ${plan.moves.length > 1 ? `${plan.moves.length} other budgets` : CATEGORY[plan.moves[0].from].name}. ${goal.name} isn’t touched.`
        : plan.key === 'bills'
          ? `Yes — bills are already in your plan, so this won’t touch today’s money.`
          : `Yes, it fits. ${catName} still has ${baht(plan.left)} left after this.`;
    return (
      <>
        <KipLine text={answer} mood={plan.fits ? 'happy' : 'careful'} />
        <Glass radius={26} innerStyle={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={ICON3D[dbCatIcon(it.category)]} style={{ width: 48, height: 48 }} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { fontSize: 17 }]}>{it.name}</Text>
              <Text style={styles.sub}>{catName}</Text>
            </View>
            <Text style={styles.price}>{baht(it.amount)}</Text>
          </View>
          {plan.fits && plan.moves.length > 0 && (
            <>
              <View style={{ height: 1, backgroundColor: 'rgba(17,17,17,0.07)' }} />
              <Text style={styles.cap}>KIP’S PLAN</Text>
              {plan.moves.map((m) => (
                <View key={m.from} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Image source={ICON3D[CAT_ICON3D[m.from]]} style={{ width: 36, height: 36 }} contentFit="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{CATEGORY[m.from].name}</Text>
                    <Text style={[styles.sub, m.tight && { color: colors.orangeText }]}>
                      {baht(m.leftAfter)} left after{m.tight ? ' — go easy here' : ''}
                    </Text>
                  </View>
                  <Text style={styles.itemAmt}>−{baht(m.amount)}</Text>
                </View>
              ))}
            </>
          )}
        </Glass>
        {plan.fits && (
          <Glass radius={22} tint="rgba(255,252,154,0.55)" innerStyle={{ padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={ICON3D[goal.icon]} style={{ width: 40, height: 40 }} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>
                {goal.name} stays {goal.arrives ? `on ${goal.arrives}` : 'on track'}
              </Text>
              <Text style={styles.sub}>Your savings aren’t used for this</Text>
            </View>
          </Glass>
        )}
        {t.bought ? (
          <Text style={[styles.sub, { textAlign: 'center' }]}>Bought ✓ — I’ve logged it{plan.fits && plan.moves.length ? ' and moved the money' : ''}.</Text>
        ) : t.dismissed ? (
          <Text style={[styles.sub, { textAlign: 'center' }]}>Okay — no change. Good call checking first.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {plan.fits && (
              <Squish onPress={() => onBuy(it, plan)} style={styles.dark} accessibilityRole="button">
                <Text style={styles.darkText}>{plan.moves.length ? 'Buy it — move the money' : 'I bought it — log it'}</Text>
              </Squish>
            )}
            <Squish onPress={onNotNow} accessibilityRole="button">
              <Glass radius={999} innerStyle={styles.light}>
                <Text style={styles.lightText}>Not now</Text>
              </Glass>
            </Squish>
          </View>
        )}
      </>
    );
  }

  return <KipLine text={reply.reply} />;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  status: { height: 34, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.limeDeep },
  statusText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  hey: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  h1: { fontFamily: fonts.regular, fontSize: 30, lineHeight: 36, letterSpacing: -1, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  me: { alignSelf: 'flex-end', maxWidth: '80%', backgroundColor: colors.ink, borderRadius: 22, borderBottomRightRadius: 6, paddingVertical: 11, paddingHorizontal: 15 },
  meText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: '#FFFFFF' },
  kipBub: { paddingVertical: 11, paddingHorizontal: 14, borderTopLeftRadius: 6 },
  kipText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  cap: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8, color: colors.muted },
  itemName: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  itemAmt: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  price: { fontFamily: fonts.medium, fontSize: 24, letterSpacing: -0.6, color: colors.ink, fontVariant: ['tabular-nums'] },
  x: { width: 22, height: 22, borderRadius: 11, backgroundColor: glow.control, alignItems: 'center', justifyContent: 'center' },
  dark: { height: 52, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  darkText: { fontFamily: fonts.medium, fontSize: 15, color: '#FFFFFF' },
  light: { height: 52, alignItems: 'center', justifyContent: 'center' },
  lightText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  sug: { height: 38, paddingHorizontal: 13, justifyContent: 'center' },
  sugText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 6 },
  mic: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { height: 50, paddingHorizontal: 16, justifyContent: 'center' },
  input: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, padding: 0, outlineStyle: 'none' } as never,
  send: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, maxWidth: '90%' },
  toastText: { fontFamily: fonts.regular, fontSize: 13, color: '#FFFFFF', textAlign: 'center' },
});
