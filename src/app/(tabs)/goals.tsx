// Goals: what you're saving for. The goal as the hero (photo, promise, progress, when it arrives), "Put money in",
// the safety net as its own pot, more goals (Plus), and what went in.
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretRight, LockSimple, Plus } from 'phosphor-react-native';

import { PlusSheet } from '@/components/PlusSheet';
import { plusPitch } from '@/components/plusPitch';
import { PutMoneySheet, type MoneyFrom } from '@/components/goals/PutMoneySheet';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { CountUp, Float, RiseIn, Ring, Squish } from '@/components/glow/motion';
import { useAuth } from '@/lib/auth';
import { savingTotal } from '@/lib/budget';
import { typeInfo } from '@/lib/setup/goalTypes';
import { monthShort, t } from '@/lib/i18n';
import { useHome, type HomeGoal } from '@/lib/home';
import { goalIcon3D, goalTypeIcon3D, ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { monthYear, ordinal, parseDay, shortName } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { colors, fonts, glassA, inkA, themed, whiteA, blackA } from '@/theme';

type Move = { id: string; amount: number; source: 'payday' | 'extra' | 'cover'; from_kind: MoneyFrom | 'other' | null; moved_at: string };
const FROM_LABEL: Record<string, string> = {
  get bonus() {
    return t('bonus');
  },
  get leftover() {
    return t('leftover money');
  },
  get side() {
    return t('side gig');
  },
  get gift() {
    return t('a gift');
  },
  get other() {
    return t('other');
  },
};
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return t('{month} {day}', { month: monthShort(d.getMonth()), day: d.getDate() });
};

/** Months until the goal is reached at this pace, as a date. */
function arrives(left: number, perMonth: number, payday: number | null, now = new Date()) {
  if (left <= 0) return t('Goal reached');
  if (perMonth <= 0) return t('When there’s room');
  const months = Math.ceil(left / perMonth);
  const d = new Date(now.getFullYear(), now.getMonth() + months, payday ?? 1);
  return monthYear(d);
}

export default function Goals() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { month } = useMonth();
  const { goals, spent, reload } = useHome(month);
  const [moves, setMoves] = useState<Move[]>([]);
  const [putOpen, setPutOpen] = useState(false);
  const [plus, setPlus] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const isPlus = profile ? profile.plan !== 'free' : false;
  const goal = goals[0];

  const loadMoves = useCallback(async () => {
    if (!goal) return;
    const { data } = await supabase.from('goal_moves').select('id, amount, source, from_kind, moved_at').eq('goal_id', goal.id).order('moved_at', { ascending: false }).limit(20);
    setMoves((data ?? []).map((m) => ({ ...m, amount: Number(m.amount) })) as Move[]);
  }, [goal]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  useFocusEffect(
    useCallback(() => {
      loadMoves();
    }, [loadMoves]),
  );

  const short = goal ? (goal.kind === 'monthly' ? goal.title : shortName(goal.title, goal.kind as never)) : t('your goal');
  const perMonth = month ? month.goal.amount + month.goalExtra : 0;
  const everyPayday = month ? savingTotal(month) : 0;
  const savedAll = goals.reduce((a, g) => a + g.saved, 0);
  const funLeft = Math.max(0, (month?.spend.find((s) => s.key === 'fun')?.amount ?? 0) - (spent.byCat.fun ?? 0));
  const pitch = plusPitch(month, short, funLeft);
  const icon: Icon3D = goal ? (goal.goalType ? goalTypeIcon3D(goal.goalType) : goalIcon3D(goal.kind)) : 'piggy';

  // "Started with": whatever was already saved before any moves were recorded.
  const movedTotal = moves.reduce((a, m) => a + m.amount, 0);
  const startedWith = goal ? Math.max(0, goal.saved - movedTotal) : 0;

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  if (!goal) {
    return (
      <View style={{ flex: 1 }}>
        <GlowBackground />
        <View style={{ paddingTop: insets.top + 76, paddingHorizontal: 20 }}>
          <Text style={styles.h1}>{t('Your goals')}</Text>
          <Text style={[styles.sub, { marginTop: 10 }]}>{t('Finish setup to pin your first goal.')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
        <RiseIn style={styles.head}>
          <Text style={styles.h1}>
            {t('Your goals')}
            {'\n'}
            <Text style={{ color: colors.soft }}>{t('and why you save')}</Text>
          </Text>
        </RiseIn>

        <RiseIn delay={60} style={styles.totals}>
          <View>
            <CountUp value={savedAll} format={big} style={styles.n1} fit />
            <Text style={styles.lbl}>{t('Saved so far')}</Text>
          </View>
          <View style={styles.vbar} />
          <View style={{ flexShrink: 1 }}>
            <CountUp value={everyPayday} format={big} style={styles.n2} fit />
            <Text style={styles.lbl}>{t('Going in every payday')}</Text>
          </View>
        </RiseIn>

        {/* the goal */}
        <RiseIn delay={120} style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Hero
            goal={goal}
            short={short}
            perMonth={perMonth}
            payday={month?.payday ?? null}
            icon={icon}
            onPut={() => setPutOpen(true)}
            onEdit={() => router.push('/month')}
            isPlus={isPlus}
            autoOn={!!profile?.split_when_paid}
          />
        </RiseIn>

        {/* safety net */}
        {month && !month.goal.isSafetyNet && month.safety.amount > 0 && (
          <RiseIn delay={180}>
            <Section title={t('Safety net')} right={t('Always on')} />
            <Squish onPress={() => router.push('/safety')} style={{ paddingHorizontal: 20 }} accessibilityRole="button" accessibilityLabel={t('Safety net')}>
              <Glass radius={24} innerStyle={styles.pot}>
                <Float>
                  <Image source={ICON3D.shield} style={{ width: 52, height: 52 }} contentFit="contain" />
                </Float>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.potName}>{t('For emergencies')}</Text>
                  <Text style={styles.sub}>
                    {Number(profile?.safety_saved ?? 0) >= month.safety.target && month.safety.target > 0
                      ? t('Full · 3 months of basics')
                      : t('{saved} of {amount}', { saved: baht(Number(profile?.safety_saved ?? 0)), amount: baht(month.safety.target) })}
                  </Text>
                </View>
                <Text style={styles.potAmt}>{t('{amount}/mo', { amount: baht(month.safety.amount) })}</Text>
                <CaretRight size={16} color={colors.muted} />
              </Glass>
            </Squish>
          </RiseIn>
        )}

        {/* more goals */}
        <RiseIn delay={220}>
          <Section title={t('More goals')} right={isPlus ? undefined : 'Plus'} />
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20 }}>
            {[
              { icon: 'phone' as Icon3D, top: t('A new phone?'), bottom: t('Pin a 2nd goal') },
              { icon: 'house' as Icon3D, top: t('Moving out?'), bottom: t('Pin a 3rd goal') },
            ].map((s, i) => (
              <Squish
                key={s.bottom}
                onPress={() => (isPlus ? flash(t('Adding more goals is coming next')) : setPlus(true))}
                style={styles.slot}
                accessibilityRole="button"
                accessibilityLabel={isPlus ? s.bottom : t('{title} — Plus', { title: s.bottom })}>
                {!isPlus && <LockSimple size={16} color={colors.muted} style={styles.lk} />}
                <Float delay={i * 900}>
                  <Image source={ICON3D[s.icon]} style={{ width: 54, height: 54 }} contentFit="contain" />
                </Float>
                <Text style={styles.slotText}>
                  {s.top}
                  {'\n'}
                  {s.bottom}
                </Text>
              </Squish>
            ))}
          </View>
        </RiseIn>

        {/* what went in */}
        <RiseIn delay={260}>
          <Section title={t('What went in')} right={short} />
          <View style={{ paddingHorizontal: 20 }}>
            <Glass radius={24} innerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}>
              {moves.length === 0 && startedWith === 0 ? (
                <Text style={[styles.sub, { paddingVertical: 14 }]}>{t('Nothing yet. Your first payday or “Put money in” shows up here.')}</Text>
              ) : (
                <>
                  {moves.map((m, i) => (
                    <HistRow
                      key={m.id}
                      first={i === 0}
                      icon={m.source === 'payday' ? 'income' : m.source === 'cover' ? 'expense' : 'piggy'}
                      lime={m.source === 'extra'}
                      title={m.source === 'payday' ? t('Payday') : m.source === 'cover' ? t('Covered a month that ran over') : t('You put in')}
                      sub={`${dayLabel(m.moved_at)}${m.from_kind ? ` · ${FROM_LABEL[m.from_kind]}` : ''}`}
                      amount={m.amount}
                    />
                  ))}
                  {startedWith > 0 && (
                    <HistRow first={moves.length === 0} icon={icon} title={t('Started with')} sub={t('{date} · what you’d already saved', { date: dayLabel(goal.createdAt) })} amount={startedWith} />
                  )}
                </>
              )}
            </Glass>
          </View>
        </RiseIn>
      </ScrollView>

      {toast && (
        <View style={[styles.toast, { bottom: 110 + Math.max(insets.bottom, 12) }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {putOpen && (
        <PutMoneySheet
          open
          onClose={() => setPutOpen(false)}
          goal={{ id: goal.id, name: short, saved: goal.saved, target: goal.target, perMonth, icon }}
          onDone={(total) => {
            setPutOpen(false);
            reload();
            loadMoves();
            flash(t('{amount} saved for {goal}', { amount: baht(total), goal: short }));
          }}
        />
      )}
      {plus && (
        <PlusSheet open onClose={() => setPlus(false)} onUnlocked={() => setPlus(false)} title={pitch.goals.title} sub={pitch.goals.sub}>
          {pitch.goals.body}
        </PlusSheet>
      )}
    </View>
  );
}

const big = (n: number) => (
  <>
    <Text style={{ fontSize: 26 }}>฿</Text>
    {n.toLocaleString('en-US')}
  </>
);

function Hero({
  goal,
  short,
  perMonth,
  payday,
  icon,
  onPut,
  onEdit,
  isPlus,
  autoOn,
}: {
  goal: HomeGoal;
  short: string;
  perMonth: number;
  payday: number | null;
  icon: Icon3D;
  onPut: () => void;
  onEdit: () => void;
  isPlus: boolean;
  autoOn: boolean;
}) {
  const monthly = goal.kind === 'monthly';
  const target = goal.target;
  const pct = target > 0 ? Math.min(100, Math.round((goal.saved / target) * 100)) : 0;
  const left = Math.max(0, target - goal.saved);
  const days = goal.due ? Math.max(0, Math.round((parseDay(goal.due).getTime() - Date.now()) / 86_400_000)) : null;
  const line = (goal.promise ?? '').split('\n')[0];
  const type = typeInfo(goal.goalType, goal.kind as never);
  return (
    <Glass radius={28}>
      <View style={styles.photo}>
        {goal.photo ? (
          <Image source={{ uri: goal.photo, cacheKey: goal.photoKey ?? undefined }} cachePolicy="disk" style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: type.color }]}>
            <Float amount={6}>
              <Image source={ICON3D[icon]} style={{ width: 120, height: 120 }} contentFit="contain" />
            </Float>
          </View>
        )}
        <View style={styles.chip}>
          <Image source={ICON3D[icon]} style={{ width: 26, height: 26 }} contentFit="contain" />
          <Text style={styles.chipText} numberOfLines={1}>
            {days !== null ? t('{goal} · {n} days', { goal: short, n: days }) : short}
          </Text>
        </View>
        {line ? (
          <View style={styles.note}>
            <View style={styles.tape} />
            <Text style={styles.noteHead}>{t('My promise')}</Text>
            <Text style={styles.noteText} numberOfLines={3}>
              {line}
            </Text>
            {goal.signature ? (
              <Image source={{ uri: goal.signature, cacheKey: goal.signatureKey ?? undefined }} cachePolicy="disk" style={{ width: 70, height: 26, alignSelf: 'flex-end' }} contentFit="contain" />
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {target > 0 && (
            <View style={{ width: 72, height: 72 }}>
              <Ring pct={pct / 100} size={72} stroke={6} color={colors.limeDeep} />
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.ink }}>{pct}%</Text>
              </View>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.heroBig}>{t('{amount} saved', { amount: baht(goal.saved) })}</Text>
            <Text style={styles.sub}>
              {target > 0 ? (monthly ? t('this year · goal {amount}', { amount: baht(target) }) : t('of {target} · {left} to go', { target: baht(target), left: baht(left) })) : t('every baht counts')}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Fact k={monthly ? t('Every month') : t('Arrives')} v={monthly ? baht(goal.monthly ?? perMonth) : arrives(left, perMonth, payday)} />
          {!monthly && <Fact k={t('Each month')} v={baht(perMonth)} />}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Squish onPress={onPut} style={[styles.btn, { flex: 1.4, backgroundColor: colors.ink }]} accessibilityRole="button" accessibilityLabel={t('Put money in')}>
            <Plus size={16} color={colors.paper} weight="bold" />
            <Text style={[styles.btnText, { color: colors.paper }]}>{t('Put money in')}</Text>
          </Squish>
          <Squish onPress={onEdit} style={[styles.btn, { flex: 1, backgroundColor: inkA(0.07) }]} accessibilityRole="button" accessibilityLabel={t('Edit the plan')}>
            <Text style={styles.btnText}>{t('Edit')}</Text>
          </Squish>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Image source={ICON3D.income} style={{ width: 28, height: 28 }} contentFit="contain" />
          <Text style={[styles.sub, { flex: 1 }]}>
            {isPlus && autoOn
              ? payday
                ? t('{amount} moves in by itself on the {day}.', { amount: baht(perMonth), day: ordinal(payday), n: payday })
                : t('{amount} moves in by itself on payday.', { amount: baht(perMonth) })
              : payday
                ? t('{amount} goes in on the {day} — Kip reminds you that morning.', { amount: baht(perMonth), day: ordinal(payday), n: payday })
                : t('{amount} goes in on payday — Kip reminds you that morning.', { amount: baht(perMonth) })}
          </Text>
        </View>
      </View>
    </Glass>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.fact}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>{k}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {v}
      </Text>
    </View>
  );
}

function HistRow({ icon, title, sub, amount, first, lime }: { icon: Icon3D; title: string; sub: string; amount: number; first: boolean; lime?: boolean }) {
  return (
    <View style={[styles.hist, !first && { borderTopWidth: 1, borderTopColor: inkA(0.06) }]}>
      <View style={[styles.histIc, { backgroundColor: lime ? colors.lime : glassA(0.6) }]}>
        <Image source={ICON3D[icon]} style={{ width: 32, height: 32 }} contentFit="contain" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.histTitle}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Text style={styles.histAmt}>
        {amount < 0 ? '−' : '+'}
        {baht(Math.abs(amount))}
      </Text>
    </View>
  );
}

function Section({ title, right }: { title: string; right?: string }) {
  return (
    <View style={styles.sec}>
      <Text style={styles.secTitle}>{title}</Text>
      {right ? <Text style={styles.sub}>{right}</Text> : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    head: { paddingHorizontal: 20, paddingTop: 64 }, // lines up with "Today's money" on Home
    h1: { fontFamily: fonts.regular, fontSize: 34, lineHeight: 40, letterSpacing: -1.1, color: colors.ink },
    totals: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, paddingHorizontal: 20, paddingTop: 20 },
    n1: { fontFamily: fonts.medium, fontSize: 46, letterSpacing: -2, lineHeight: 58, marginTop: -8, color: colors.ink, fontVariant: ['tabular-nums'] },
    n2: { fontFamily: fonts.regular, fontSize: 30, letterSpacing: -1, lineHeight: 38, marginTop: -4, color: colors.soft, fontVariant: ['tabular-nums'] },
    lbl: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4 },
    vbar: { width: 1, height: 56, marginBottom: 4, backgroundColor: inkA(0.08) },
    sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
    photo: { height: 208, overflow: 'hidden' },
    chip: {
      position: 'absolute',
      left: 12,
      top: 12,
      height: 32,
      paddingLeft: 4,
      paddingRight: 12,
      borderRadius: 999,
      backgroundColor: whiteA(0.9),
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: '62%',
    },
    chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onAccent, flexShrink: 1 },
    note: {
      position: 'absolute',
      right: 16,
      top: 52,
      width: 148,
      backgroundColor: colors.lime,
      paddingTop: 14,
      paddingHorizontal: 12,
      paddingBottom: 8,
      transform: [{ rotate: '3deg' }],
      boxShadow: '0 12px 20px rgba(0,0,0,0.22)',
    },
    tape: { position: 'absolute', top: -8, left: 52, width: 44, height: 16, backgroundColor: whiteA(0.65), transform: [{ rotate: '-4deg' }] },
    noteHead: { fontFamily: fonts.regular, fontSize: 11, color: blackA(0.55) },
    noteText: { fontFamily: fonts.hand, fontSize: 18, lineHeight: 18, color: colors.onAccent, marginTop: 2 },
    heroBig: { fontFamily: fonts.medium, fontSize: 26, letterSpacing: -0.8, color: colors.ink, fontVariant: ['tabular-nums'] },
    fact: { flex: 1, borderRadius: 16, backgroundColor: inkA(0.04), paddingVertical: 8, paddingHorizontal: 12 },
    btn: { height: 48, borderRadius: 24, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    sec: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 32, paddingBottom: 12 },
    secTitle: { fontFamily: fonts.medium, fontSize: 19, letterSpacing: -0.3, color: colors.ink },
    pot: { paddingVertical: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    potName: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
    potAmt: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
    slot: { flex: 1, height: 148, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed', borderColor: inkA(0.16), alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
    slotText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center' },
    lk: { position: 'absolute', top: 12, right: 12 },
    hist: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    histIc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    histTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    histAmt: { fontFamily: fonts.medium, fontSize: 15, color: colors.lavenderText, fontVariant: ['tabular-nums'] }, // money in
    toast: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
    toastText: { fontFamily: fonts.regular, fontSize: 13, color: colors.paper },
  }),
);
