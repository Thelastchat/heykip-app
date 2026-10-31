// Goals: what you're saving for. The goal as the hero (photo, promise, progress, when it arrives), "Put money in",
// the safety net as its own pot, more goals (Plus), and what went in.
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PlusSheet } from '@/components/PlusSheet';
import { plusPitch } from '@/components/plusPitch';
import { PutMoneySheet, type MoneyFrom } from '@/components/goals/PutMoneySheet';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { CountUp, Float, RiseIn, Ring, Squish } from '@/components/glow/motion';
import { useAuth } from '@/lib/auth';
import { savingTotal } from '@/lib/budget';
import { useHome, type HomeGoal } from '@/lib/home';
import { goalIcon3D, goalTypeIcon3D, ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { monthYear, ordinal, parseDay, shortName } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme';

type Move = { id: string; amount: number; source: 'payday' | 'extra'; from_kind: MoneyFrom | 'other' | null; moved_at: string };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FROM_LABEL: Record<string, string> = { bonus: 'bonus', leftover: 'leftover money', side: 'side gig', gift: 'a gift', other: 'other' };
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/** Months until the goal is reached at this pace, as a date. */
function arrives(left: number, perMonth: number, payday: number | null, now = new Date()) {
  if (left <= 0) return 'Done 🎉';
  if (perMonth <= 0) return 'When there’s room';
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

  const short = goal ? (goal.kind === 'monthly' ? goal.title : shortName(goal.title, goal.kind as never)) : 'your goal';
  const perMonth = month ? month.goal.amount + month.goalExtra : 0;
  const everyPayday = month ? savingTotal(month) : 0;
  const savedAll = goals.reduce((a, g) => a + g.saved, 0);
  const funLeft = Math.max(0, (month?.spend.find((s) => s.key === 'fun')?.amount ?? 0) - (spent.byCat.fun ?? 0));
  const pitch = plusPitch(month, short, funLeft);
  const icon: Icon3D = goal ? (goal.goalType ? goalTypeIcon3D(goal.goalType) : goalIcon3D(goal.kind)) : 'piggy';

  // "Started with": whatever was already saved before any moves were recorded.
  const movedTotal = moves.reduce((a, m) => a + m.amount, 0);
  const startedWith = goal ? Math.max(0, goal.saved - movedTotal) : 0;

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(null), 2600);
  }

  if (!goal) {
    return (
      <View style={{ flex: 1 }}>
        <GlowBackground />
        <View style={{ paddingTop: insets.top + 58, paddingHorizontal: 22 }}>
          <Text style={styles.h1}>Your goals</Text>
          <Text style={[styles.sub, { marginTop: 10 }]}>Finish setup to pin your first goal.</Text>
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
            Your goals{'\n'}
            <Text style={{ color: '#B9B8B0' }}>and why you save</Text>
          </Text>
          <Glass radius={999} style={{ position: 'absolute', right: 22, top: 0 }} innerStyle={styles.pinned}>
            <Text style={styles.pinnedText}>{goals.length} of 3 pinned</Text>
          </Glass>
        </RiseIn>

        <RiseIn delay={60} style={styles.totals}>
          <View>
            <CountUp value={savedAll} format={big} style={styles.n1} />
            <Text style={styles.lbl}>Saved so far</Text>
          </View>
          <View style={styles.vbar} />
          <View style={{ flexShrink: 1 }}>
            <CountUp value={everyPayday} format={big} style={styles.n2} />
            <Text style={styles.lbl}>Going in every payday</Text>
          </View>
        </RiseIn>

        {/* the goal */}
        <RiseIn delay={120} style={{ paddingHorizontal: 18, marginTop: 22 }}>
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
            <Section title="Safety net" right="always on" />
            <View style={{ paddingHorizontal: 18 }}>
              <Glass radius={26} innerStyle={styles.pot}>
                <Float>
                  <Image source={ICON3D.shield} style={{ width: 52, height: 52 }} contentFit="contain" />
                </Float>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.potName}>For emergencies</Text>
                  <Text style={styles.sub}>Grows to {baht(month.safety.target)} — 3 months of basics</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.potAmt}>{baht(month.safety.amount)}</Text>
                  <Text style={styles.sub}>a month</Text>
                </View>
              </Glass>
            </View>
          </RiseIn>
        )}

        {/* more goals */}
        <RiseIn delay={220}>
          <Section title="More goals" tag={isPlus ? undefined : '✦ PLUS'} />
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 18 }}>
            {[
              { icon: 'phone' as Icon3D, top: 'A new phone?', bottom: 'Pin a 2nd goal' },
              { icon: 'house' as Icon3D, top: 'Moving out?', bottom: 'Pin a 3rd goal' },
            ].map((s, i) => (
              <Squish
                key={s.bottom}
                onPress={() => (isPlus ? flash('Adding more goals is coming next') : setPlus(true))}
                style={styles.slot}
                accessibilityRole="button"
                accessibilityLabel={`${s.bottom}${isPlus ? '' : ' — Plus'}`}>
                {!isPlus && (
                  <View style={styles.lk}>
                    <LockIcon />
                  </View>
                )}
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
          <Section title="What went in" right={short} />
          <View style={{ paddingHorizontal: 18 }}>
            <Glass radius={26} innerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}>
              {moves.length === 0 && startedWith === 0 ? (
                <Text style={[styles.sub, { paddingVertical: 14 }]}>Nothing yet. Your first payday or “Put money in” shows up here.</Text>
              ) : (
                <>
                  {moves.map((m, i) => (
                    <HistRow
                      key={m.id}
                      first={i === 0}
                      icon={m.source === 'payday' ? 'income' : 'piggy'}
                      lime={m.source === 'extra'}
                      title={m.source === 'payday' ? 'Payday' : 'You put in'}
                      sub={`${dayLabel(m.moved_at)}${m.from_kind ? ` · ${FROM_LABEL[m.from_kind]}` : ''}`}
                      amount={m.amount}
                    />
                  ))}
                  {startedWith > 0 && <HistRow first={moves.length === 0} icon={icon} title="Started with" sub={`${dayLabel(goal.createdAt)} · what you’d already saved`} amount={startedWith} />}
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
            flash(`${baht(total)} saved for ${short} ✓`);
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
    <Text style={{ fontSize: 24 }}>฿</Text>
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
  return (
    <Glass radius={30}>
      <View style={styles.photo}>
        {goal.photo ? (
          <Image source={{ uri: goal.photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,252,154,0.5)' }]}>
            <Float amount={6}>
              <Image source={ICON3D[icon]} style={{ width: 120, height: 120 }} contentFit="contain" />
            </Float>
          </View>
        )}
        <View style={styles.chip}>
          <Image source={ICON3D[icon]} style={{ width: 26, height: 26 }} contentFit="contain" />
          <Text style={styles.chipText} numberOfLines={1}>
            {short}
            {days !== null ? ` · ${days} days` : ''}
          </Text>
        </View>
        {line ? (
          <View style={styles.note}>
            <View style={styles.tape} />
            <Text style={styles.noteHead}>MY PROMISE</Text>
            <Text style={styles.noteText} numberOfLines={3}>
              {line}
            </Text>
            {goal.signature ? <Image source={{ uri: goal.signature }} style={{ width: 70, height: 26, alignSelf: 'flex-end' }} contentFit="contain" /> : null}
          </View>
        ) : null}
      </View>

      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {target > 0 && (
            <View style={{ width: 74, height: 74 }}>
              <Ring pct={pct / 100} size={74} stroke={7} color={colors.limeDeep} />
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.ink }}>{pct}%</Text>
              </View>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.heroBig}>{baht(goal.saved)} saved</Text>
            <Text style={styles.sub}>{target > 0 ? (monthly ? `this year · goal ${baht(target)}` : `of ${baht(target)} · ${baht(left)} to go`) : 'every baht counts'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Fact k={monthly ? 'Every month' : 'Arrives'} v={monthly ? baht(goal.monthly ?? perMonth) : arrives(left, perMonth, payday)} />
          {!monthly && <Fact k="Each month" v={baht(perMonth)} />}
          <Fact k="Payday" v={payday ? ordinal(payday) : '—'} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Squish onPress={onPut} style={[styles.btn, { flex: 1.4, backgroundColor: colors.ink }]} accessibilityRole="button" accessibilityLabel="Put money in">
            <Text style={[styles.btnText, { color: '#FFFFFF' }]}>+ Put money in</Text>
          </Squish>
          <Squish onPress={onEdit} style={[styles.btn, { flex: 1, backgroundColor: 'rgba(17,17,17,0.07)' }]} accessibilityRole="button" accessibilityLabel="Edit the plan">
            <Text style={styles.btnText}>Edit</Text>
          </Squish>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <Image source={ICON3D.income} style={{ width: 30, height: 30 }} contentFit="contain" />
          <Text style={[styles.sub, { flex: 1 }]}>
            {isPlus && autoOn
              ? `${baht(perMonth)} moves in by itself ${payday ? `on the ${ordinal(payday)}` : 'on payday'}.`
              : `${baht(perMonth)} goes in ${payday ? `on the ${ordinal(payday)}` : 'on payday'} — Kip reminds you that morning.`}
          </Text>
        </View>
      </View>
    </Glass>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.fact}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.muted }}>{k}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {v}
      </Text>
    </View>
  );
}

function HistRow({ icon, title, sub, amount, first, lime }: { icon: Icon3D; title: string; sub: string; amount: number; first: boolean; lime?: boolean }) {
  return (
    <View style={[styles.hist, !first && { borderTopWidth: 1, borderTopColor: 'rgba(17,17,17,0.06)' }]}>
      <View style={[styles.histIc, { backgroundColor: lime ? colors.lime : 'rgba(255,255,255,0.6)' }]}>
        <Image source={ICON3D[icon]} style={{ width: 32, height: 32 }} contentFit="contain" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.histTitle}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Text style={styles.histAmt}>+{baht(amount)}</Text>
    </View>
  );
}

function Section({ title, right, tag }: { title: string; right?: string; tag?: string }) {
  return (
    <View style={styles.sec}>
      <Text style={styles.secTitle}>{title}</Text>
      {tag ? (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ) : right ? (
        <Text style={styles.sub}>{right}</Text>
      ) : null}
    </View>
  );
}

function LockIcon() {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24">
      <Path fill="#FFFFFF" d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 22, paddingTop: 34 },
  h1: { fontFamily: fonts.regular, fontSize: 34, lineHeight: 40, letterSpacing: -1.1, color: colors.ink },
  pinned: { height: 30, paddingHorizontal: 12, justifyContent: 'center' },
  pinnedText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
  totals: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, paddingHorizontal: 22, paddingTop: 18 },
  n1: { fontFamily: fonts.medium, fontSize: 44, letterSpacing: -2, lineHeight: 48, color: colors.ink, fontVariant: ['tabular-nums'] },
  n2: { fontFamily: fonts.regular, fontSize: 28, letterSpacing: -1, lineHeight: 32, color: '#B9B8B0', fontVariant: ['tabular-nums'] },
  lbl: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 6 },
  vbar: { width: 1, height: 50, backgroundColor: 'rgba(17,17,17,0.12)' },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  photo: { height: 210, overflow: 'hidden' },
  chip: {
    position: 'absolute',
    left: 12,
    top: 12,
    height: 34,
    paddingLeft: 4,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '62%',
  },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, flexShrink: 1 },
  note: {
    position: 'absolute',
    right: 14,
    top: 52,
    width: 150,
    backgroundColor: colors.lime,
    paddingTop: 13,
    paddingHorizontal: 11,
    paddingBottom: 7,
    transform: [{ rotate: '3deg' }],
    boxShadow: '0 12px 20px rgba(0,0,0,0.22)',
  },
  tape: { position: 'absolute', top: -8, left: 52, width: 44, height: 15, backgroundColor: 'rgba(255,255,255,0.65)', transform: [{ rotate: '-4deg' }] },
  noteHead: { fontFamily: fonts.regular, fontSize: 8, letterSpacing: 1, color: 'rgba(17,17,17,0.55)' },
  noteText: { fontFamily: fonts.hand, fontSize: 18, lineHeight: 18, color: colors.ink, marginTop: 2 },
  heroBig: { fontFamily: fonts.medium, fontSize: 26, letterSpacing: -0.8, color: colors.ink, fontVariant: ['tabular-nums'] },
  fact: { flex: 1, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.5)', paddingVertical: 9, paddingHorizontal: 12 },
  btn: { height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  sec: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 12 },
  secTitle: { fontFamily: fonts.medium, fontSize: 19, color: colors.ink },
  tag: { height: 24, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.ink, justifyContent: 'center', alignSelf: 'center' },
  tagText: { fontFamily: fonts.semibold, fontSize: 11, color: '#FFFFFF' },
  pot: { paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  potName: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  potAmt: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
  slot: { flex: 1, height: 150, borderRadius: 26, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(17,17,17,0.16)', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 },
  slotText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center' },
  lk: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  hist: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  histIc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  histTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  histAmt: { fontFamily: fonts.medium, fontSize: 15, color: '#5D7D4E', fontVariant: ['tabular-nums'] },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  toastText: { fontFamily: fonts.regular, fontSize: 13, color: '#FFFFFF' },
});
