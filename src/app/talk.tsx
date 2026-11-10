// Talk to Kip (Plus) — agent Kip (approved mockup). Type what you spent, ask "Can I buy this?", ask anything about
// your month, change your plan ("add Netflix 419 every month") or fix what you logged ("delete the coffee").
// Logging saves straight away with Undo; anything that changes the plan shows a card with every number and waits
// for "Do it". Kip remembers the conversation. The server only understands the words; every number here comes from
// the person's own plan, checked by the app.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowUp, Microphone, X } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafe } from '@/components/KeyboardSafe';
import { Kip } from '@/components/Kip';
import { useAiConsent } from '@/components/AiConsent';
import { PlusSheet } from '@/components/PlusSheet';
import { Listening } from '@/components/talk/Listening';
import { plusPitch } from '@/components/plusPitch';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { RiseIn, Squish } from '@/components/glow/motion';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { CATEGORY } from '@/lib/budget';
import { budgetKey, monthNumbers, useHome } from '@/lib/home';
import { CAT_ICON3D, goalIcon3D, goalTypeIcon3D, ICON3D } from '@/lib/icons3d';
import { MoneyInSheet } from '@/components/MoneyInSheet';
import { planChange, planFix, type ChangePlan, type FixPlan, type RecentTx } from '@/lib/agent';
import type { ChangeRow } from '@/components/TellKip';
import type { MonthBudget } from '@/lib/budget';
import { liteOf } from '@/components/goals/bits';
import type { MoneyIn } from '@/lib/moneyin';
import {
  applyBuy,
  askKip,
  buyPlan,
  DB_CAT_NAME,
  dbCatIcon,
  IN_CAT_NAME,
  inCatIcon,
  incomeNotes,
  isIn,
  kipContext,
  type BuyPlan,
  type DbCat,
  type InCat,
  type InItem,
  type KipReply,
  type LogItem,
} from '@/lib/kip';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { monthYear, parseDay, shortName } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { defaultVoiceLang, saveVoiceLang, savedVoiceLang, useVoice, voiceModule, type VoiceLang } from '@/lib/voice';
import { colors, fonts, inkA, themed } from '@/theme';

type Turn = {
  id: number;
  me: string;
  state: 'thinking' | 'done' | 'error';
  reply?: KipReply;
  plan?: BuyPlan | null;
  error?: string;
  saved?: boolean;
  bought?: boolean;
  dismissed?: boolean;
  /** log: the rows saved, so Undo can take them back */
  savedIds?: string[];
  /** log: looks like something already logged (same name and amount today) — waits for "Save anyway" */
  dupe?: string;
  undone?: boolean;
  /** change / fix: what Kip would do (null = it doesn't fit), done once "Do it" is tapped */
  change?: ChangePlan | null;
  fix?: FixPlan | null;
  done?: boolean;
  /** change: the month before, for Undo */
  before?: MonthBudget;
  /** change / fix: a newer one came ("actually make it ฿279"), so this one can't be done any more */
  replaced?: boolean;
};
type Item = LogItem | InItem;
type GoalInfo = { id: string; name: string; arrives: string | null; icon: keyof typeof ICON3D; saved: number; target: number; perMonth: number } | null;
/** Suggestion chips — a function so they follow the app's language. */
const suggestions = () => [t('Chicken rice 60, Thai tea 45 and Grab 80'), t('Got paid 18,000 today'), t('Can I buy a shirt for 890?'), t('How am I doing this month?'), 'ข้าวกะเพรา 70 กาแฟ 55'];
const SPEND_CATS: DbCat[] = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'home_bills', 'travel', 'family_pets', 'giving', 'learning', 'installments', 'other'];
const IN_CATS: InCat[] = ['pay', 'side_gigs', 'gifts', 'other'];

/** Whatever the server says, every row ends up with a real category of the right kind and a positive amount. */
function clean(items: KipReply['items']): Item[] {
  return (items ?? [])
    .map((it) => ({ ...it, amount: Math.abs(Number(it.amount) || 0) }))
    .filter((it) => it.amount > 0)
    .map((it) =>
      it.money === 'in'
        ? ({ name: it.name, amount: it.amount, money: 'in', category: IN_CATS.includes(it.category as InCat) ? (it.category as InCat) : 'other' } as InItem)
        : ({ name: it.name, amount: it.amount, money: 'out', category: SPEND_CATS.includes(it.category as DbCat) ? (it.category as DbCat) : 'other' } as LogItem),
    );
}

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
  const [moneyIn, setMoneyIn] = useState<MoneyIn[] | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const nextId = useRef(1);

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, key, kind')
      .is('user_id', null)
      .then(({ data }) => setIds(Object.fromEntries((data ?? []).map((c) => [`${c.kind}:${c.key}`, c.id]))));
  }, []);

  const goal = goals[0];
  const short = goal ? (goal.kind === 'monthly' ? goal.title : shortName(goal.title, goal.kind as never)) : t('your goal');
  const arrives = goal?.due ? monthYear(parseDay(goal.due)) : null;
  const goalIcon = goal ? (goal.goalType ? goalTypeIcon3D(goal.goalType) : goalIcon3D(goal.kind)) : 'piggy';
  const perMonth = month ? month.goal.amount + month.goalExtra : 0;
  const goalInfo: GoalInfo = goal ? { id: goal.id, name: short, arrives, icon: goalIcon, saved: goal.saved, target: goal.target, perMonth } : null;
  const n = month ? monthNumbers(month, spent) : null;
  const funLeft = Math.max(0, (month?.spend.find((s) => s.key === 'fun')?.amount ?? 0) - (spent.byCat.fun ?? 0));
  const pitch = useMemo(() => plusPitch(month, short, funLeft), [month, short, funLeft]);
  const first = profile?.display_name?.split(' ')[0];

  // ---- talking out loud ----
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<VoiceLang>(defaultVoiceLang);
  useEffect(() => {
    savedVoiceLang().then((l) => l && setLang(l));
  }, []);
  const ai = useAiConsent(() => router.push('/privacy-policy'));
  const voice = useVoice((heard) => {
    // The phone stopped by itself (long silence, or a hiccup): use what it heard.
    setListening(false);
    if (heard) send(heard);
    else flash(t('I didn’t catch that — try again?'));
  });

  async function listen(l = lang) {
    if (!isPlus) return setLocked(true);
    if (!(await ai.ensure())) return;
    if (!voiceModule()) return flash(t('Talking out loud works in the HeyKip app build. For now, tap the mic on your keyboard.'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setListening(true);
    const problem = await voice.start(l);
    if (problem) {
      setListening(false);
      flash(problem === 'denied' ? t('I need the microphone — turn it on for HeyKip in Settings.') : t('Listening isn’t working right now — type it instead?'));
    }
  }
  async function doneTalking() {
    const heard = await voice.finish();
    setListening(false);
    if (heard) send(heard);
    else flash(t('I didn’t catch that — try again?'));
  }
  function stopTalking() {
    voice.cancel();
    setListening(false);
  }
  function switchLang(l: VoiceLang) {
    setLang(l);
    saveVoiceLang(l);
    voice.cancel();
    listen(l);
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }
  const update = (id: number, patch: Partial<Turn>) => setTurns((ts) => ts.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  // What Kip can fix: the last 20 things logged, loaded the first time it's needed (and again after a change).
  const recent = useRef<RecentTx[] | null>(null);
  async function loadRecent(): Promise<RecentTx[]> {
    if (recent.current) return recent.current;
    if (!session) return [];
    const { data } = await supabase
      .from('transactions')
      .select('id, amount, note, occurred_at, kind, categories(key)')
      .eq('user_id', session.user.id)
      .eq('kind', 'spend')
      .order('occurred_at', { ascending: false })
      .limit(20);
    recent.current = (data ?? []).map((r, i) => ({
      ref: `r${i + 1}`,
      id: r.id as string,
      name: (r.note as string | null) || DB_CAT_NAME[((r.categories as unknown as { key: string } | null)?.key ?? 'other') as DbCat] || '',
      amount: Number(r.amount),
      category: ((r.categories as unknown as { key: string } | null)?.key ?? 'other') as DbCat,
      at: (r.occurred_at as string | null) ?? new Date().toISOString(),
    }));
    return recent.current;
  }

  /** The first item that matches something logged today (same name, or same amount and kind), if any. */
  function alreadyLogged(items: Item[], rec: RecentTx[]): string | null {
    const today = new Date().toDateString();
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    for (const it of items) {
      const inChat = turns.some((x) => x.saved && !x.undone && (x.reply?.items ?? []).some((o) => same(o.name, it.name) && o.amount === it.amount && o.money === it.money));
      const inRecent = !isIn(it) && rec.some((r) => new Date(r.at).toDateString() === today && r.amount === it.amount && same(r.name, it.name));
      if (inChat || inRecent) return it.name;
    }
    return null;
  }

  /** What Kip remembers of each turn: what was said and what came of it (short, the last 6). */
  function history() {
    return turns
      .filter((x) => x.state === 'done' && x.reply)
      .slice(-6)
      .map((x) => {
        const r = x.reply!;
        const what =
          r.kind === 'log' && x.saved && !x.undone
            ? `(Logged: ${(r.items ?? []).map((i) => `${i.name} ${i.amount}`).join(', ')})`
            : r.kind === 'change' || r.kind === 'fix'
              ? `(Proposed: ${(JSON.stringify(r.kind === 'change' ? r.ops : r.fixes) ?? '').slice(0, 160)} — ${x.done ? (x.undone ? 'done, then undone' : 'done') : 'not done yet'})`
              : '';
        return { me: x.me, kip: `${r.reply} ${what}`.trim() };
      });
  }

  async function send(said = text) {
    const msg = said.trim();
    if (!msg) return;
    if (!isPlus) return setLocked(true);
    if (!(await ai.ensure())) return;
    Haptics.selectionAsync().catch(() => {});
    const id = nextId.current++;
    setText('');
    setTurns((ts) => [...ts, { id, me: msg, state: 'thinking' }]);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    const rec = await loadRecent();
    const res = await askKip(
      msg,
      kipContext(month, spent, goal ? { name: short, arrives } : null, first, {
        goalSaved: goal?.saved,
        recent: rec.map((r) => ({ ref: r.ref, name: r.name, amount: r.amount, category: r.category, day: (r.at ?? '').slice(0, 10) })),
      }),
      history(),
    );
    // Every answer is worked out once, from the month as it was when Kip answered.
    if (res.ok) {
      const reply = { ...res.reply, items: clean(res.reply.items) };
      const lites = goals.map(liteOf);
      // A new change replaces any earlier one still waiting for "Do it" — only the latest can be done.
      if (reply.kind === 'change' || reply.kind === 'fix')
        setTurns((ts) => ts.map((x) => (x.id !== id && (x.reply?.kind === 'change' || x.reply?.kind === 'fix') && !x.done && !x.dismissed ? { ...x, replaced: true } : x)));
      update(id, {
        state: 'done',
        reply,
        plan: reply.kind === 'buy' && reply.buy && month ? buyPlan(month, spent, reply.buy) : null,
        change: reply.kind === 'change' && month ? planChange(month, lites, reply.ops ?? []) : undefined,
        fix: reply.kind === 'fix' ? planFix(rec, reply.fixes ?? []) : undefined,
      });
      // Logging saves straight away (with Undo) — it's what people do most, so it stays one step.
      if (reply.kind === 'log' && reply.items.length) {
        // …unless it looks already logged (said twice, or a slip already did it): then it waits for "Save anyway".
        const dupe = alreadyLogged(reply.items as Item[], rec);
        if (dupe) update(id, { dupe });
        else saveItems({ id, me: msg, state: 'done' }, reply.items as Item[]);
      }
    } else
      update(id, {
        state: 'error',
        error:
          res.reason === 'consent'
            ? t('Kip’s reading is turned off — turn it on in Profile → Privacy & data.')
            : res.reason === 'limit'
              ? t('That’s a lot of Kip for one day — I’ll be back tomorrow. You can still log by hand.')
              : res.reason === 'nokey'
                ? t('I’m not switched on yet — my AI key still needs to be added in Supabase.')
                : res.reason === 'plus'
                  ? t('Talking to me is a Plus feature.')
                  : res.reason === 'offline'
                    ? t('I can’t reach the internet right now. Try again in a moment?')
                    : t('I got a bit muddled. Try saying it another way?'),
      });
    if (!res.ok && res.reason === 'plus') setLocked(true);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 120);
  }

  async function saveItems(turn: Turn, items: Item[]) {
    if (!session || items.length === 0) return;
    const rows = items.map((it) => {
      const kind = isIn(it) ? 'income' : 'spend';
      return { user_id: session.user.id, kind, amount: it.amount, category_id: ids[`${kind}:${it.category}`] ?? ids[`${kind}:other`] ?? null, note: it.name, source: 'typed' };
    });
    const { data: saved, error } = await supabase.from('transactions').insert(rows).select('id, kind, amount, note');
    if (error) return flash(t('Couldn’t save: {msg}', { msg: error.message }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    update(turn.id, { saved: true, savedIds: (saved ?? []).map((r) => r.id as string) });
    recent.current = null;
    reload();
    // Money in: the same "give it a job" sheet as everywhere else.
    const inn = (saved ?? []).map((r, i) => ({ r, it: items[i] })).filter(({ r }) => r.kind === 'income');
    if (inn.length) setMoneyIn(inn.map(({ r, it }) => ({ id: r.id as string, amount: Number(r.amount), category: it.category, note: (r.note as string | null) ?? null })));
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 120);
  }

  async function undoLog(turn: Turn) {
    if (!turn.savedIds?.length) return;
    const { error } = await supabase.from('transactions').delete().in('id', turn.savedIds);
    if (error) return flash(t('Couldn’t undo: {msg}', { msg: error.message }));
    update(turn.id, { undone: true });
    recent.current = null;
    reload();
  }

  /** "Do it": the change Kip showed, made with the app's own rules. */
  async function doChange(turn: Turn) {
    if (!month || !turn.change) return;
    const before = month;
    if (turn.change.take > 0 && goal) {
      const { error } = await supabase.rpc('take_from_goal', { p_goal: goal.id, p_amount: turn.change.take, p_note: t('Kip: {said}', { said: turn.me.slice(0, 60) }) });
      if (error) return flash(t('Couldn’t save: {msg}', { msg: error.message }));
    }
    if (turn.change.next !== month) save(turn.change.next);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    update(turn.id, { done: true, before });
    reload();
  }
  async function undoChange(turn: Turn) {
    if (!turn.before || !turn.change) return;
    if (turn.change.take > 0 && goal) {
      const { error } = await supabase.rpc('put_in_goal', { p_goal: goal.id, p_amount: turn.change.take, p_source: 'extra', p_note: t('Undo') });
      if (error) return flash(t('Couldn’t undo: {msg}', { msg: error.message }));
    }
    save(turn.before);
    update(turn.id, { undone: true });
    reload();
  }
  async function doFix(turn: Turn) {
    if (!turn.fix) return;
    for (const e of turn.fix.edits) {
      const q =
        e.op === 'delete'
          ? supabase.from('transactions').delete().eq('id', e.tx.id)
          : e.op === 'amount'
            ? supabase.from('transactions').update({ amount: e.amount }).eq('id', e.tx.id)
            : supabase
                .from('transactions')
                .update({ category_id: ids[`spend:${e.category}`] ?? null })
                .eq('id', e.tx.id);
      const { error } = await q;
      if (error) return flash(t('Couldn’t save: {msg}', { msg: error.message }));
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    update(turn.id, { done: true });
    recent.current = null;
    reload();
  }

  async function buyIt(turn: Turn, item: LogItem, plan: BuyPlan) {
    if (!session || !month) return;
    const { error } = await supabase
      .from('transactions')
      .insert({ user_id: session.user.id, kind: 'spend', amount: item.amount, category_id: ids[`spend:${item.category}`] ?? null, note: item.name, source: 'typed' });
    if (error) return flash(t('Couldn’t save: {msg}', { msg: error.message }));
    save(applyBuy(month, plan));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    update(turn.id, { bought: true });
    reload();
  }

  return (
    <KeyboardSafe style={{ flex: 1 }} done={false}>
      <GlowBackground />
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel={t('Close')}>
          <Glass radius={22} innerStyle={styles.round}>
            <X size={16} color={colors.ink} weight="bold" />
          </Glass>
        </Pressable>
        <Glass radius={999} innerStyle={styles.status}>
          <View style={[styles.dot, turns.some((x) => x.state === 'thinking') && { backgroundColor: colors.orange }]} />
          <Text style={styles.statusText}>{turns.some((x) => x.state === 'thinking') ? t('Thinking…') : isPlus ? 'Kip' : t('Kip · Plus feature')}</Text>
        </Glass>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 16, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {turns.length === 0 && (
          <RiseIn style={{ alignItems: 'center', marginTop: 12 }}>
            <Text style={styles.h1}>{t('What did you spend today?')}</Text>
            <View style={{ marginVertical: 20 }}>
              <Kip mood="listen" size={168} />
            </View>
            <Text style={[styles.sub, { textAlign: 'center', paddingHorizontal: 20 }]}>{t('Type it like you’d text a friend: what you spent, money that came in, or “Can I buy…?”')}</Text>
            {n && <Text style={styles.left}>{t('{amount} left today', { amount: baht(n.leftToday) })}</Text>}
          </RiseIn>
        )}

        {turns.map((turn) => (
          <View key={turn.id} style={{ gap: 10 }}>
            <View style={styles.me}>
              <Text style={styles.meText}>{turn.me}</Text>
            </View>
            {turn.state === 'thinking' && <KipLine mood="think" text={t('Let me look…')} />}
            {turn.state === 'error' && <KipLine mood="careful" text={turn.error ?? ''} />}
            {turn.state === 'done' && turn.reply && (
              <Answer
                turn={turn}
                reply={turn.reply}
                month={month}
                plan={turn.plan ?? null}
                goal={{ name: short, arrives, icon: goalIcon }}
                goalInfo={goalInfo}
                spent={spent}
                onUndo={() => undoLog(turn)}
                onSaveAnyway={() => saveItems(turn, (turn.reply?.items as Item[]) ?? [])}
                onBuy={(item, plan) => buyIt(turn, item, plan)}
                onNotNow={() => update(turn.id, { dismissed: true })}
                onDo={() => (turn.change ? doChange(turn) : doFix(turn))}
                onUndoChange={() => undoChange(turn)}
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
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}>
          {suggestions().map((s) => (
            <Squish key={s} onPress={() => send(s)} accessibilityRole="button">
              <Glass radius={999} innerStyle={styles.sug}>
                <Text style={styles.sugText}>{s}</Text>
              </Glass>
            </Squish>
          ))}
        </ScrollView>
      )}

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <Pressable onPress={() => listen()} accessibilityRole="button" accessibilityLabel={t('Talk to Kip out loud')}>
          <Glass radius={24} innerStyle={styles.mic}>
            <Microphone size={20} color={colors.ink} weight="bold" />
          </Glass>
        </Pressable>
        <Glass radius={24} style={{ flex: 1 }} innerStyle={styles.inputWrap}>
          <TextInput
            value={text}
            onChangeText={setText}
            onFocus={() => !isPlus && setLocked(true)}
            placeholder={isPlus ? t('Message Kip') : t('Talk to Kip is a Plus feature')}
            placeholderTextColor={colors.faint}
            style={styles.input}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            maxLength={300}
            accessibilityLabel={t('Message Kip')}
          />
        </Glass>
        <Squish onPress={() => send()} style={[styles.send, !text.trim() && styles.sendOff]} accessibilityRole="button" accessibilityLabel={t('Send')}>
          <ArrowUp size={20} color={text.trim() ? colors.paper : colors.muted} weight="bold" />
        </Squish>
      </View>

      {moneyIn && (
        <MoneyInSheet
          items={moneyIn}
          onClose={(msg) => {
            setMoneyIn(null);
            reload();
            if (msg) flash(msg);
          }}
        />
      )}
      {toast && (
        <View style={[styles.toast, { bottom: 90 + Math.max(insets.bottom, 12) }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {listening && <Listening name={first} state={voice.state} text={voice.text} level={voice.level} lang={lang} onLang={switchLang} onDone={doneTalking} onCancel={stopTalking} />}

      {ai.sheet}
      {locked && !isPlus && (
        <PlusSheet open onClose={() => setLocked(false)} onUnlocked={() => setLocked(false)} title={pitch.talk.title} sub={pitch.talk.sub}>
          {pitch.talk.body}
        </PlusSheet>
      )}
    </KeyboardSafe>
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

/** Kip's change, every number before → after. "Preview" until it's done. */
function ChangeCard({ rows, preview, faded }: { rows: ChangeRow[]; preview: boolean; faded?: boolean }) {
  return (
    <Glass radius={24} style={faded ? { opacity: 0.5 } : undefined} innerStyle={{ paddingHorizontal: 16, paddingVertical: 6 }}>
      <View style={[styles.secRow, { paddingTop: 8, paddingBottom: 4 }]}>
        <Text style={styles.cap}>{preview ? t('What changes') : t('Changed')}</Text>
        {preview && <Text style={styles.cap}>{t('Preview')}</Text>}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[styles.chRow, i > 0 && { borderTopWidth: 1, borderTopColor: inkA(0.06) }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{r.title}</Text>
            {r.sub ? <Text style={styles.sub}>{r.sub}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            {r.from ? <Text style={styles.from}>{r.from}</Text> : null}
            <Text style={[styles.itemAmt, r.warn && { color: colors.orangeText }]}>{r.to}</Text>
          </View>
        </View>
      ))}
    </Glass>
  );
}

function Answer({
  turn,
  reply,
  month,
  plan,
  goal,
  goalInfo,
  spent,
  onUndo,
  onSaveAnyway,
  onBuy,
  onNotNow,
  onDo,
  onUndoChange,
}: {
  turn: Turn;
  reply: KipReply;
  month: ReturnType<typeof useMonth>['month'];
  plan: BuyPlan | null;
  goal: { name: string; arrives: string | null; icon: keyof typeof ICON3D };
  goalInfo: GoalInfo;
  spent: ReturnType<typeof useHome>['spent'];
  onUndo: () => void;
  onSaveAnyway: () => void;
  onBuy: (item: LogItem, plan: BuyPlan) => void;
  onNotNow: () => void;
  onDo: () => void;
  onUndoChange: () => void;
}) {
  const items = (reply.items as Item[]) ?? [];

  if (reply.kind === 'change' || reply.kind === 'fix') {
    const p = reply.kind === 'change' ? turn.change : turn.fix;
    if (!p) return <KipLine mood="careful" text={t('Hmm, that doesn’t fit your plan right now. Try saying it another way?')} />;
    return (
      <>
        <KipLine text={reply.reply} />
        <ChangeCard rows={p.rows} preview={!turn.done} faded={!!turn.replaced || !!turn.dismissed} />
        {turn.undone ? (
          <Text style={[styles.sub, { textAlign: 'center' }]}>{t('Undone — back how it was.')}</Text>
        ) : turn.done ? (
          <View style={styles.doneRow}>
            <Text style={styles.sub}>
              <Text style={{ fontFamily: fonts.medium, color: colors.ink }}>{t('Done')}</Text>
            </Text>
            {reply.kind === 'change' && (
              <Squish onPress={onUndoChange} style={styles.undo} accessibilityRole="button">
                <Text style={styles.undoText}>{t('Undo')}</Text>
              </Squish>
            )}
          </View>
        ) : turn.replaced ? (
          <Text style={[styles.sub, { textAlign: 'center' }]}>{t('Replaced by the one below.')}</Text>
        ) : turn.dismissed ? (
          <Text style={[styles.sub, { textAlign: 'center' }]}>{t('Okay — nothing changed.')}</Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Squish onPress={onDo} style={[styles.dark, { flex: 1 }]} accessibilityRole="button">
              <Text style={styles.darkText}>{t('Do it')}</Text>
            </Squish>
            <Squish onPress={onNotNow} accessibilityRole="button">
              <Glass radius={999} innerStyle={[styles.light, { paddingHorizontal: 20 }]}>
                <Text style={styles.lightText}>{t('Not now')}</Text>
              </Glass>
            </Squish>
          </View>
        )}
      </>
    );
  }

  if (reply.kind === 'log' && items.length) {
    const ins = items.filter(isIn);
    const outs = items.filter((i): i is LogItem => !isIn(i));
    const inTotal = ins.reduce((a, i) => a + i.amount, 0);
    const outTotal = outs.reduce((a, i) => a + i.amount, 0);
    const { notes } = incomeNotes(ins, month);
    // Left for today once these are saved (bills don't touch today's money).
    const todayOut = month ? outs.filter((o) => budgetKey(o.category, month) !== 'bills').reduce((a, o) => a + o.amount, 0) : 0;
    // Once saved, Home's numbers already include them; before that, add them in. Either way: what's left for today.
    const nowN = month ? monthNumbers(month, turn.saved ? spent : { ...spent, total: spent.total + todayOut, today: spent.today + todayOut }) : null;
    const leftAfter = nowN && !turn.saved ? nowN.leftToday : null;
    const todayLine = !nowN || turn.undone ? null : nowN.overToday > 0 ? t('{amount} over today', { amount: baht(nowN.overToday) }) : t('{amount} left today', { amount: baht(nowN.leftToday) });
    const row = (it: Item, i: number, note: { text: string; extra: boolean } | null) => (
      <View key={`${it.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Image source={ICON3D[isIn(it) ? inCatIcon(it.category) : dbCatIcon(it.category)]} style={{ width: 34, height: 34 }} contentFit="contain" />
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName}>{it.name}</Text>
          <Text style={[styles.sub, note?.extra && { color: colors.lavenderText }]}>{isIn(it) ? `${IN_CAT_NAME[it.category]}${note ? ` · ${note.text}` : ''}` : DB_CAT_NAME[it.category]}</Text>
        </View>
        <Text style={[styles.itemAmt, isIn(it) && { color: colors.lavenderText }]}>
          {isIn(it) ? '+' : ''}
          {baht(it.amount)}
        </Text>
      </View>
    );
    return (
      <>
        <KipLine text={reply.reply} />
        <Glass radius={24} innerStyle={{ padding: 16, gap: 12 }}>
          {ins.length > 0 && (
            <>
              <View style={styles.secRow}>
                <Text style={styles.cap}>{t('Money in')}</Text>
                <Text style={[styles.capNum, { color: colors.lavenderText }]}>+{baht(inTotal)}</Text>
              </View>
              {ins.map((it, i) => row(it, i, notes[i]))}
            </>
          )}
          {ins.length > 0 && outs.length > 0 && <View style={styles.hr} />}
          {outs.length > 0 && (
            <>
              <View style={styles.secRow}>
                <Text style={styles.cap}>{ins.length || turn.saved ? t('Spent') : t('Kip heard')}</Text>
                {leftAfter !== null && <Text style={styles.capNum}>{t('{amount} left today after', { amount: baht(leftAfter) })}</Text>}
              </View>
              {outs.map((it, i) => row(it, i, null))}
            </>
          )}
        </Glass>
        {turn.undone ? (
          <Text style={[styles.sub, { textAlign: 'center' }]}>{t('Undone — nothing saved.')}</Text>
        ) : turn.dupe && !turn.saved ? (
          turn.dismissed ? (
            <Text style={[styles.sub, { textAlign: 'center' }]}>{t('Okay — not saved again.')}</Text>
          ) : (
            <>
              <Text style={[styles.sub, { paddingHorizontal: 4 }]}>{t('You already logged {name} today. Save it again?', { name: turn.dupe })}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Squish onPress={onSaveAnyway} style={[styles.dark, { flex: 1 }]} accessibilityRole="button">
                  <Text style={styles.darkText}>{t('Save anyway')}</Text>
                </Squish>
                <Squish onPress={onNotNow} accessibilityRole="button">
                  <Glass radius={999} innerStyle={[styles.light, { paddingHorizontal: 20 }]}>
                    <Text style={styles.lightText}>{t('Skip')}</Text>
                  </Glass>
                </Squish>
              </View>
            </>
          )
        ) : (
          <View style={styles.doneRow}>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.sub}>{turn.saved ? (items.length > 1 ? t('Saved all {n} · {amount}', { n: items.length, amount: baht(outTotal + inTotal) }) : t('Saved')) : t('Saving…')}</Text>
              {turn.saved && outs.length > 0 && todayLine && <Text style={[styles.todayLine, nowN!.overToday > 0 && { color: colors.orangeText }]}>{todayLine}</Text>}
            </View>
            {turn.saved && (
              <Squish onPress={onUndo} style={styles.undo} accessibilityRole="button">
                <Text style={styles.undoText}>{t('Undo')}</Text>
              </Squish>
            )}
          </View>
        )}
      </>
    );
  }

  if (reply.kind === 'buy' && reply.buy && plan && month) {
    const it = reply.buy;
    const catName = plan.key === 'bills' ? t('Home & bills') : CATEGORY[plan.key].name;
    const answer = !plan.fits
      ? t('Not this month, honestly. It’s {short} more than your budgets can spare — it would have to come from {goal}.', { short: baht(plan.short), goal: goal.name })
      : plan.moves.length
        ? t('Yes, you can. {cat} has {left} left, so I’d borrow {borrow} from {from}. {goal} isn’t touched.', {
            cat: catName,
            left: baht(it.amount - plan.moves.reduce((a, m) => a + m.amount, 0)),
            borrow: baht(plan.moves.reduce((a, m) => a + m.amount, 0)),
            from: plan.moves.length > 1 ? t('{n} other budgets', { n: plan.moves.length }) : CATEGORY[plan.moves[0].from].name,
            goal: goal.name,
          })
        : plan.key === 'bills'
          ? t('Yes — bills are already in your plan, so this won’t touch today’s money.')
          : t('Yes, it fits. {cat} still has {left} left after this.', { cat: catName, left: baht(plan.left) });
    return (
      <>
        <KipLine text={answer} mood={plan.fits ? 'happy' : 'careful'} />
        <Glass radius={24} innerStyle={{ padding: 16, gap: 12 }}>
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
              <View style={{ height: 1, backgroundColor: inkA(0.07) }} />
              <Text style={styles.cap}>{t('Kip’s plan')}</Text>
              {plan.moves.map((m) => (
                <View key={m.from} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Image source={ICON3D[CAT_ICON3D[m.from]]} style={{ width: 36, height: 36 }} contentFit="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{CATEGORY[m.from].name}</Text>
                    <Text style={[styles.sub, m.tight && { color: colors.orangeText }]}>
                      {m.tight ? t('{amount} left after — go easy here', { amount: baht(m.leftAfter) }) : t('{amount} left after', { amount: baht(m.leftAfter) })}
                    </Text>
                  </View>
                  <Text style={styles.itemAmt}>−{baht(m.amount)}</Text>
                </View>
              ))}
            </>
          )}
        </Glass>
        {plan.fits && (
          <Glass radius={24} tint={colors.lime} innerStyle={{ padding: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={ICON3D[goal.icon]} style={{ width: 40, height: 40 }} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{goal.arrives ? t('{goal} stays on {when}', { goal: goal.name, when: goal.arrives }) : t('{goal} stays on track', { goal: goal.name })}</Text>
              <Text style={styles.sub}>{t('Your savings aren’t used for this')}</Text>
            </View>
          </Glass>
        )}
        {turn.bought ? (
          <Text style={[styles.sub, { textAlign: 'center' }]}>{plan.fits && plan.moves.length ? t('Bought — I’ve logged it and moved the money.') : t('Bought — I’ve logged it.')}</Text>
        ) : turn.dismissed ? (
          <Text style={[styles.sub, { textAlign: 'center' }]}>{t('Okay — no change. Good call checking first.')}</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {plan.fits && (
              <Squish onPress={() => onBuy(it, plan)} style={styles.dark} accessibilityRole="button">
                <Text style={styles.darkText}>{plan.moves.length ? t('Buy it — move the money') : t('I bought it — log it')}</Text>
              </Squish>
            )}
            <Squish onPress={onNotNow} accessibilityRole="button">
              <Glass radius={999} innerStyle={styles.light}>
                <Text style={styles.lightText}>{t('Not now')}</Text>
              </Glass>
            </Squish>
          </View>
        )}
      </>
    );
  }

  return <KipLine text={reply.reply} />;
}

const styles = themed(() =>
  StyleSheet.create({
    secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    hr: { height: 1, backgroundColor: inkA(0.07), marginVertical: 2 },
    goalBar: { height: 10, borderRadius: 5, backgroundColor: inkA(0.07), overflow: 'hidden' },
    goalBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
    round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    status: { height: 32, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.limeDeep },
    statusText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
    left: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, marginTop: 8, fontVariant: ['tabular-nums'] },
    h1: { fontFamily: fonts.regular, fontSize: 30, lineHeight: 36, letterSpacing: -1, color: colors.ink, textAlign: 'center' },
    sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
    me: { alignSelf: 'flex-end', maxWidth: '80%', backgroundColor: colors.ink, borderRadius: 20, borderBottomRightRadius: 6, paddingVertical: 12, paddingHorizontal: 16 },
    meText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.paper },
    kipBub: { paddingVertical: 12, paddingHorizontal: 16, borderTopLeftRadius: 6 },
    kipText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
    cap: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    capNum: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, fontVariant: ['tabular-nums'] },
    itemName: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    itemAmt: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    price: { fontFamily: fonts.medium, fontSize: 24, letterSpacing: -0.6, color: colors.ink, fontVariant: ['tabular-nums'] },
    chRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    from: { fontFamily: fonts.regular, fontSize: 13, color: colors.faint, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
    todayLine: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, marginTop: 2, fontVariant: ['tabular-nums'] },
    doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
    undo: { borderRadius: 999, backgroundColor: inkA(0.05), paddingHorizontal: 12, paddingVertical: 6 },
    undoText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
    dark: { height: 48, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    darkText: { fontFamily: fonts.medium, fontSize: 15, color: colors.paper },
    light: { height: 48, alignItems: 'center', justifyContent: 'center' },
    lightText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    sug: { height: 36, paddingHorizontal: 12, justifyContent: 'center' },
    sugText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
    bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 8 },
    mic: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    inputWrap: { height: 48, paddingHorizontal: 16, justifyContent: 'center' },
    input: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, padding: 0, outlineStyle: 'none' } as never,
    send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    sendOff: { backgroundColor: inkA(0.08) },
    toast: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, maxWidth: '90%' },
    toastText: { fontFamily: fonts.regular, fontSize: 13, color: colors.paper, textAlign: 'center' },
  }),
);
