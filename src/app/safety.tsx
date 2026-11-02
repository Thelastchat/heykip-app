// Safety net (approved mockup): how much is saved against 3 months of basics, what that covers in real life,
// what went in and out, and two actions — put money in, or take some out for a real emergency ("I need it").
// When it's full, the monthly saving that went here goes to the goal instead (moneyin.ts savingThisCycle).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { soonerText } from '@/components/goals/PutMoneySheet';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { RiseIn, Ring, Squish } from '@/components/glow/motion';
import { AmountInput, SaveButton, Sheet } from '@/components/profile/Sheet';
import { useAuth } from '@/lib/auth';
import { useHome } from '@/lib/home';
import { monthShort, rich, t } from '@/lib/i18n';
import { ICON3D, goalIcon3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { safetyFull } from '@/lib/moneyin';
import { useMonth } from '@/lib/month';
import { monthYear, shortName } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { colors, fonts, inkA, money, themed } from '@/theme';

type Move = { id: string; amount: number; kind: 'payday' | 'extra' | 'manual' | 'cover' | 'emergency'; reason: string | null; created_at: string };
type Reason = 'health' | 'repair' | 'family' | 'other';

const REASONS: { key: Reason; emoji: string; label: () => string }[] = [
  { key: 'health', emoji: '🏥', label: () => t('Health') },
  { key: 'repair', emoji: '📱', label: () => t('Phone or repair') },
  { key: 'family', emoji: '👪', label: () => t('Family') },
  { key: 'other', emoji: '', label: () => t('Something else') },
];

const SEEN_FULL = 'heykip.safetyFullSeen';
const dm = (d: Date) => `${d.getDate()} ${monthShort(d.getMonth())}`;
const inMonths = (n: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
};

export default function Safety() {
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuth();
  const { month } = useMonth();
  const { goals } = useHome(month);
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [open, setOpen] = useState<null | 'put' | 'need' | 'full'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const uid = session?.user.id;

  const saved = Number(profile?.safety_saved ?? 0);
  const target = month?.safety.target ?? 0;
  const perPayday = month?.safety.amount ?? 0;
  const full = safetyFull(month, saved);
  const goal = goals[0] ?? null;
  const goalName = goal ? (goal.kind === 'monthly' ? goal.title : shortName(goal.title, goal.kind as never)) : t('your goal');

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase.from('safety_moves').select('id, amount, kind, reason, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(50);
    setMoves((data ?? []).map((m) => ({ ...m, amount: Number(m.amount) })) as Move[]);
  }, [uid]);
  useFocusEffect(
    useCallback(() => {
      load();
      refreshProfile();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  // The first time it's full: celebrate once.
  useEffect(() => {
    if (!full) return;
    AsyncStorage.getItem(SEEN_FULL)
      .then((v) => !v && setOpen('full'))
      .catch(() => {});
  }, [full]);

  function flash(s: string) {
    setToast(s);
    setTimeout(() => setToast(null), 2600);
  }
  async function done(message: string) {
    setOpen(null);
    await refreshProfile();
    load();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    flash(message);
  }

  // "Covers about N days if pay stops": 3 months of basics = the target.
  const perDay = target > 0 ? target / 90 : 0;
  const days = perDay > 0 ? Math.floor(saved / perDay) : 0;
  const monthsToFull = perPayday > 0 && !full ? Math.ceil((target - saved) / perPayday) : 0;
  const movedTotal = (moves ?? []).reduce((a, m) => a + m.amount, 0);
  const startedWith = Math.round(saved - movedTotal);

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <ScreenHeader title={t('Safety net')} />

        <RiseIn>
          <Glass radius={28} tint={full ? 'rgba(217,230,207,0.75)' : undefined} innerStyle={styles.hero}>
            <View style={styles.heroRow}>
              <View style={{ width: 88, height: 88 }}>
                <Ring pct={target ? saved / target : 0} size={88} stroke={8} color={SAFETY_GREEN} />
                <Image source={ICON3D.shield} style={styles.shield} contentFit="contain" />
              </View>
              <View style={{ flex: 1 }}>
                {full && <Text style={styles.fullTitle}>{t('Your safety net is full!')}</Text>}
                <Text style={styles.big}>
                  <Text style={{ fontSize: 20 }}>฿</Text>
                  {Math.round(saved).toLocaleString('en-US')}
                </Text>
                <Text style={styles.of}>{target ? t('of {target} · 3 months of basics', { target: baht(target) }) : t('saved')}</Text>
              </View>
            </View>
            {target > 0 && (
              <View style={styles.covers}>
                <Text style={styles.coversText}>
                  {full ? t('3 months of basics, ready if anything happens') : days === 1 ? t('Covers about 1 day if pay stops') : t('Covers about {n} days if pay stops', { n: days })}
                </Text>
              </View>
            )}
            {!full && perPayday > 0 && (
              <View style={styles.stats}>
                <Stat label={t('Every payday')} value={baht(perPayday)} />
                <Stat label={t('Full around')} value={monthYear(inMonths(monthsToFull))} />
              </View>
            )}
            {full && goal && perPayday > 0 && (
              <Text style={styles.small}>
                {rich('Your {amount} a month now goes to **{goal}** instead.', { amount: baht(perPayday), goal: goalName }, (s) => (
                  <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>{s}</Text>
                ))}
              </Text>
            )}
            <View style={styles.btns}>
              <Squish onPress={() => setOpen('put')} style={[styles.btn, styles.btnDark]} accessibilityRole="button">
                <Text style={styles.btnDarkText}>{t('+ Put money in')}</Text>
              </Squish>
              <Squish onPress={() => setOpen('need')} disabled={saved <= 0} style={[styles.btn, styles.btnSoft, saved <= 0 && { opacity: 0.45 }]} accessibilityRole="button">
                <Text style={styles.btnSoftText}>{t('I need it')}</Text>
              </Squish>
            </View>
          </Glass>
        </RiseIn>

        <Text style={styles.cap}>{t('What went in and out')}</Text>
        <Glass radius={22} innerStyle={{ paddingHorizontal: 14 }}>
          {(moves ?? []).map((m, i) => (
            <MoveRow key={m.id} m={m} first={i === 0} />
          ))}
          {startedWith > 0 && <Row icon="shield" title={t('Started with')} sub={t('what you already had')} amount={startedWith} first={(moves ?? []).length === 0} />}
          {moves !== null && moves.length === 0 && startedWith <= 0 && <Text style={[styles.small, { paddingVertical: 14 }]}>{t('Nothing yet. Your first payday moves money in by itself.')}</Text>}
        </Glass>
      </ScrollView>

      {open === 'put' && <PutSheet onClose={() => setOpen(null)} onDone={(a) => done(t('{amount} in your safety net ✓', { amount: baht(a) }))} />}
      {open === 'need' && <NeedSheet saved={saved} perPayday={perPayday} onClose={() => setOpen(null)} onDone={(a) => done(t('{amount} taken out — take care ✓', { amount: baht(a) }))} />}
      {open === 'full' && (
        <FullSheet
          saved={saved}
          perPayday={perPayday}
          goal={goal ? { name: goalName, icon: goalIcon3D(goal.kind), perMonth: month ? month.goal.amount + month.goalExtra : 0, left: Math.max(0, goal.target - goal.saved), due: goal.due } : null}
          onClose={() => {
            AsyncStorage.setItem(SEEN_FULL, '1').catch(() => {});
            setOpen(null);
          }}
        />
      )}
      {toast && (
        <View style={[styles.toast, { bottom: insets.bottom + 24 }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const SAFETY_GREEN = '#9BC48A'; // the safety net's own green (deeper than the sage swatch, so the ring reads)

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.small}>{label}</Text>
      <Text style={styles.statV}>{value}</Text>
    </View>
  );
}

function MoveRow({ m, first }: { m: Move; first: boolean }) {
  const d = new Date(m.created_at);
  const r = REASONS.find((x) => x.key === m.reason);
  const map: Record<Move['kind'], { icon: Icon3D; title: string; sub: string }> = {
    payday: { icon: 'income', title: t('Payday'), sub: t('{date} · moved by itself', { date: dm(d) }) },
    extra: { icon: 'piggy', title: t('Extra money'), sub: dm(d) },
    manual: { icon: 'piggy', title: t('You put in'), sub: dm(d) },
    cover: { icon: 'expense', title: t('Covered a day that ran over'), sub: dm(d) },
    emergency: { icon: 'expense', title: r ? r.label() : t('Emergency'), sub: t('{date} · from the safety net', { date: dm(d) }) },
  };
  const x = map[m.kind];
  return <Row icon={x.icon} title={x.title} sub={x.sub} amount={m.amount} first={first} />;
}

function Row({ icon, title, sub, amount, first }: { icon: Icon3D; title: string; sub: string; amount: number; first: boolean }) {
  return (
    <View style={[styles.row, !first && styles.line]}>
      <Image source={ICON3D[icon]} style={{ width: 34, height: 34 }} contentFit="contain" />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.small}>{sub}</Text>
      </View>
      <Text style={[styles.amt, amount < 0 && { color: colors.orangeText }]}>
        {amount < 0 ? '−' : '+'}
        {baht(Math.abs(amount))}
      </Text>
    </View>
  );
}

function PutSheet({ onClose, onDone }: { onClose: () => void; onDone: (amount: number) => void }) {
  const [amount, setAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!amount) return;
    setBusy(true);
    const { error: e } = await supabase.rpc('put_in_safety', { p_amount: amount, p_kind: 'manual' });
    setBusy(false);
    if (e) return setError(t('Couldn’t save: {msg}', { msg: e.message }));
    onDone(amount);
  }
  return (
    <Sheet open onClose={onClose} title={t('Put money in')} sub={t('Leftover money, a bonus, a gift — anything that makes it stronger')}>
      <AmountInput value={amount} onChange={setAmount} autoFocus label={t('Amount')} />
      <SaveButton label={busy ? t('Saving…') : amount ? t('Put {amount} in', { amount: baht(amount) }) : t('Put money in')} disabled={!amount || busy} onPress={save} />
      {error && <Text style={styles.err}>{error}</Text>}
    </Sheet>
  );
}

function NeedSheet({ saved, perPayday, onClose, onDone }: { saved: number; perPayday: number; onClose: () => void; onDone: (amount: number) => void }) {
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const take = Math.min(amount ?? 0, saved);
  const after = saved - take;
  const paydays = perPayday > 0 && take > 0 ? Math.ceil(take / perPayday) : 0;
  async function save() {
    if (!take || !reason) return;
    setBusy(true);
    const { error: e } = await supabase.rpc('put_in_safety', { p_amount: -take, p_kind: 'emergency', p_reason: reason });
    setBusy(false);
    if (e) return setError(t('Couldn’t save: {msg}', { msg: e.message }));
    onDone(take);
  }
  return (
    <Sheet open onClose={onClose} title={t('What happened?')} sub={t('This is what the safety net is for')}>
      <AmountInput value={amount} onChange={setAmount} autoFocus label={t('Amount')} />
      {(amount ?? 0) > saved && (
        <Text style={[styles.small, { textAlign: 'center', color: colors.orangeText }]}>{t('There’s {amount} in it — that’s the most you can take', { amount: baht(saved) })}</Text>
      )}
      <View style={styles.chips}>
        {REASONS.map((r) => {
          const on = reason === r.key;
          return (
            <Pressable key={r.key} onPress={() => setReason(r.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Glass radius={999} tint={on ? colors.lime : undefined} innerStyle={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && { fontFamily: fonts.medium }]}>{r.emoji ? `${r.emoji} ${r.label()}` : r.label()}</Text>
              </Glass>
            </Pressable>
          );
        })}
      </View>
      {take > 0 && (
        <>
          <View style={styles.kipRow}>
            <Kip mood="careful" size={52} />
            <Glass radius={22} style={{ flex: 1 }} innerStyle={styles.bub}>
              <Text style={styles.say}>
                {rich('Take what you need — **today’s money doesn’t change**. I’ll refill it from your {amount} each payday.', { amount: baht(perPayday) }, (s) => (
                  <Text style={{ fontFamily: fonts.semibold }}>{s}</Text>
                ))}
              </Text>
            </Glass>
          </View>
          <Glass radius={22} innerStyle={{ paddingHorizontal: 14 }}>
            <View style={styles.row}>
              <Image source={ICON3D.shield} style={{ width: 34, height: 34 }} contentFit="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t('Safety net')}</Text>
                <Text style={styles.small}>{paydays ? t('Back to {amount} by {month}', { amount: baht(saved), month: monthYear(inMonths(paydays)) }) : ' '}</Text>
              </View>
              <Text style={styles.from}>{baht(saved)}</Text>
              <Text style={[styles.amt, { color: colors.orangeText }]}>{baht(after)}</Text>
            </View>
            <View style={[styles.row, styles.line]}>
              <Image source={ICON3D.bowl} style={{ width: 34, height: 34 }} contentFit="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t('Today’s money')}</Text>
                <Text style={styles.small}>{t('Not touched')}</Text>
              </View>
              <Text style={styles.amt}>✓</Text>
            </View>
          </Glass>
        </>
      )}
      <SaveButton label={busy ? t('Saving…') : take ? t('Take {amount} out', { amount: baht(take) }) : t('Take money out')} disabled={!take || !reason || busy} onPress={save} />
      {!reason && take > 0 && <Text style={[styles.small, { textAlign: 'center' }]}>{t('Pick what happened — it’s only for your own history')}</Text>}
      {error && <Text style={styles.err}>{error}</Text>}
    </Sheet>
  );
}

function FullSheet({
  saved,
  perPayday,
  goal,
  onClose,
}: {
  saved: number;
  perPayday: number;
  goal: { name: string; icon: Icon3D; perMonth: number; left: number; due: string | null } | null;
  onClose: () => void;
}) {
  const sooner = goal ? soonerTextMonths(goal.left, goal.perMonth, perPayday) : null;
  return (
    <Sheet open onClose={onClose} title={t('Your safety net is full!')} sub={t('{amount} · 3 months of basics, ready if anything happens', { amount: baht(saved) })}>
      <View style={{ alignItems: 'center' }}>
        <Kip mood="celebrate" size={96} />
      </View>
      {goal && perPayday > 0 && (
        <>
          <Glass radius={22} innerStyle={styles.bub}>
            <Text style={styles.say}>
              {rich('From now on, the **{amount} a month goes to {goal}** instead. If you ever use some of it, I’ll refill it first.', { amount: baht(perPayday), goal: goal.name }, (s) => (
                <Text style={{ fontFamily: fonts.semibold }}>{s}</Text>
              ))}
            </Text>
          </Glass>
          <Glass radius={22} innerStyle={{ paddingHorizontal: 14 }}>
            <View style={styles.row}>
              <Image source={ICON3D[goal.icon]} style={{ width: 34, height: 34 }} contentFit="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t('{goal} every payday', { goal: goal.name })}</Text>
                <Text style={styles.small}>{sooner ?? t('+{amount} from the safety net', { amount: baht(perPayday) })}</Text>
              </View>
              <Text style={styles.from}>{baht(goal.perMonth)}</Text>
              <Text style={styles.amt}>{baht(goal.perMonth + perPayday)}</Text>
            </View>
          </Glass>
        </>
      )}
      <SaveButton label={t('Yay — got it')} onPress={onClose} />
    </Sheet>
  );
}

/** How much sooner the goal arrives when it gets `more` a month. */
function soonerTextMonths(left: number, per: number, more: number) {
  if (left <= 0 || per <= 0 || more <= 0) return null;
  const was = Math.ceil(left / per);
  const now = Math.ceil(left / (per + more));
  return was > now ? soonerText((was - now) * per, per) : null;
}

const styles = themed(() =>
  StyleSheet.create({
    hero: { padding: 18, gap: 12 },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    shield: { position: 'absolute', left: 18, top: 18, width: 52, height: 52 },
    fullTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, marginBottom: 2 },
    big: { fontFamily: fonts.medium, fontSize: 34, letterSpacing: -1.2, lineHeight: 42, color: colors.ink, fontVariant: ['tabular-nums'] },
    of: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    covers: { alignSelf: 'flex-start', backgroundColor: money.safetyNet, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
    coversText: { fontFamily: fonts.medium, fontSize: 12, color: colors.onAccent },
    stats: { flexDirection: 'row', gap: 8 },
    stat: { flex: 1, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: inkA(0.04) },
    statV: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, marginTop: 1, fontVariant: ['tabular-nums'] },
    btns: { flexDirection: 'row', gap: 8 },
    btn: { flex: 1, height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    btnDark: { backgroundColor: colors.ink },
    btnDarkText: { fontFamily: fonts.medium, fontSize: 15, color: colors.paper },
    btnSoft: { backgroundColor: inkA(0.07) },
    btnSoftText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    cap: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginLeft: 4, marginBottom: -6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.06) },
    rowTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
    amt: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    from: { fontFamily: fonts.regular, fontSize: 13, color: colors.faint, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'], marginRight: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },
    chip: { height: 38, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
    chipOn: { borderWidth: 1.5, borderColor: colors.ink },
    chipText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
    kipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    bub: { padding: 12, paddingHorizontal: 14 },
    say: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
    err: { fontFamily: fonts.regular, fontSize: 13, color: colors.orangeText, textAlign: 'center' },
    toast: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, maxWidth: '90%' },
    toastText: { fontFamily: fonts.regular, fontSize: 13, color: colors.paper, textAlign: 'center' },
  }),
);
