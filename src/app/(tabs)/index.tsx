// Home, the glow version: one soft field behind everything, frosted cards on top.
// Today's money first, then the week, Kip, your goal, what's left per category, Plus, and the bills.
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { CaretRight, Plus, UserCircle } from 'phosphor-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Kip, type KipMood } from '@/components/Kip';
import { PlusSheet, type PlusFeature } from '@/components/PlusSheet';
import { fasterStyle, plusPitch } from '@/components/plusPitch';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { CountUp, Float, RiseIn, Ring, Squish } from '@/components/glow/motion';
import { BillStack, type Bill } from '@/components/home/BillStack';
import { OverSheet, type OverInfo } from '@/components/home/OverSheet';
import { SlipFinder } from '@/components/home/SlipFinder';
import { WeekStrip } from '@/components/home/WeekStrip';
import { plan as splitMonth, type Style } from '@/lib/brain';
import { CATEGORY, savingTotal, STYLES, type CatKey, type MonthBudget } from '@/lib/budget';
import { useAuth } from '@/lib/auth';
import { dayShort, t } from '@/lib/i18n';
import { monthNumbers, overCover, periodKey, useHome, type HomeGoal } from '@/lib/home';
import { cover as coverMonth, savingThisCycle } from '@/lib/moneyin';
import { CAT_ICON3D, goalIcon3D, ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { typeInfo } from '@/lib/setup/goalTypes';
import { monthYear, monthsFromNow, ordinal, parseDay, shortName } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme';

/** ฿ drawn smaller next to a big number. */
const Big = (n: number) => (
  <>
    <Text style={{ fontSize: 26 }}>฿</Text>
    {n.toLocaleString('en-US')}
  </>
);

export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile, session, refreshProfile } = useAuth();
  const { month, save } = useMonth();
  const { goals, spent, streak, reload } = useHome(month);
  const [sheet, setSheet] = useState<PlusFeature | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(new Date().toDateString());
  const [kipMood, setKipMood] = useState<KipMood>('happy');
  const [overOpen, setOverOpen] = useState(false);
  const isPlus = profile ? profile.plan !== 'free' : false;

  useFocusEffect(
    useCallback(() => {
      reload();
      setSelectedDay(new Date().toDateString());
    }, [reload]),
  );

  const now = new Date();
  const goal = goals[0];
  const short = goal ? (goal.kind === 'monthly' ? goal.title : shortName(goal.title, goal.kind as never)) : t('your goal');

  // ---- the month in numbers (the same numbers as the + screen) ----
  const { P, spendBudget, leftMonth, dailyToday, leftToday, pace, overToday, overMonth, leftAtStart, daysAfter, dailyAfter, extraIn } = monthNumbers(month, spent, now);
  const saving = month ? savingTotal(month) : 0;
  const goalDate = goal?.due ? parseDay(goal.due) : null;
  const fast = spent.total > 0 && pace > 0;
  const isTodaySelected = selectedDay === now.toDateString();
  const dailyPlan = P.total ? spendBudget / P.total : 0;
  const showOverToday = isTodaySelected && overToday > 0;

  // Going over: what it changes (the sheet behind the minus numbers).
  const goalPerMonth = month && !month.goal.isSafetyNet ? savingThisCycle(month).goal : 0;
  const goalLeft = goal ? Math.max(0, goal.target - goal.saved) : 0;
  const safetySaved = Number(profile?.safety_saved ?? 0);
  const cover = overCover(overMonth, goal && goal.kind !== 'monthly' ? goalPerMonth : 0, safetySaved, goalLeft);
  const laterBy = (amount: number) => {
    if (!goalDate || goalPerMonth <= 0) return null;
    const later = Math.ceil((goalLeft + amount) / goalPerMonth) - Math.ceil(goalLeft / goalPerMonth);
    return later > 0 ? monthYear(new Date(goalDate.getFullYear(), goalDate.getMonth() + later, 1)) : null;
  };
  const overInfo: OverInfo = {
    spentToday: spent.today,
    dailyToday,
    overToday,
    overMonth,
    daysAfter,
    dailyAfter,
    leftAtStart,
    leftMonth,
    goal:
      goal && goal.kind !== 'monthly'
        ? {
            name: short,
            perMonth: goalPerMonth,
            date: goalDate ? monthYear(goalDate) : null,
            laterDate: goalDate && cover.later > 0 ? monthYear(new Date(goalDate.getFullYear(), goalDate.getMonth() + cover.later, 1)) : null,
            laterBy,
          }
        : null,
    fromGoal: cover.fromGoal,
    fromSafety: cover.fromSafety,
    safetySaved,
  };
  async function coverIt(take: { goal: number; safety: number }, forToday: boolean) {
    if (!month) return t('Your plan isn’t loaded yet — try again in a moment.');
    const r = await coverMonth(month, goal?.id ?? null, take, forToday);
    if ('error' in r) return t('Couldn’t save: {msg}', { msg: r.error });
    save(r.month);
    refreshProfile();
    reload();
    return null;
  }

  // Kip celebrates when something new was logged today, then settles.
  const lastToday = useRef(spent.today);
  useEffect(() => {
    if (spent.today > lastToday.current) {
      setKipMood('celebrate');
      const id = setTimeout(() => setKipMood(fast ? 'careful' : 'happy'), 2200);
      lastToday.current = spent.today;
      return () => clearTimeout(id);
    }
    lastToday.current = spent.today;
    setKipMood(fast ? 'careful' : 'happy');
  }, [spent.today, fast]);

  // Kip's line: one whole sentence per case, so Thai word order stays natural.
  const say =
    overMonth > 0
      ? t('This month’s spending money is used up — {amount} over. It comes out of your saving, so rent and bills are safe. Must-haves only until payday.', { amount: baht(overMonth) })
      : overToday > 0 && daysAfter > 0
        ? goalDate
          ? t('A big day — that’s okay. I spread the {amount} over the next {n} days, so {goal} stays on {date}.', { amount: baht(overToday), n: daysAfter, goal: short, date: monthYear(goalDate) })
          : t('A big day — that’s okay. I spread the {amount} over the next {n} days, so {goal} stays on track.', { amount: baht(overToday), n: daysAfter, goal: short })
        : spent.total === 0
          ? t('Your plan is running. Tell me what you spend and I’ll keep {goal} on track.', { goal: short })
          : pace <= 0
            ? goalDate
              ? t('You’re doing great — {amount} under pace. {goal} is on track for {date}.', { amount: baht(-pace), goal: short, date: monthYear(goalDate) })
              : t('You’re doing great — {amount} under pace. {goal} is on track.', { amount: baht(-pace), goal: short })
            : goalDate
              ? t('A bit fast this month — {amount} over pace. Keep to {daily} a day and {goal} stays on {date}.', {
                  amount: baht(pace),
                  daily: baht(dailyToday),
                  goal: short,
                  date: monthYear(goalDate),
                })
              : t('A bit fast this month — {amount} over pace. Keep to {daily} a day and {goal} stays on track.', { amount: baht(pace), daily: baht(dailyToday), goal: short });

  // ---- Plus ----
  function openFeature(f: PlusFeature) {
    if (!isPlus) return setSheet(f);
    unlocked(f);
  }
  async function unlocked(f: PlusFeature) {
    if (f === 'styles' || f === 'customize') return router.push('/month');
    if (f === 'talk') return router.push('/talk');
    if (f === 'goals') return router.push('/goals');
    if (f === 'automove' && session) {
      await supabase.from('profiles').update({ split_when_paid: true }).eq('id', session.user.id);
      await refreshProfile();
      flash(
        month?.payday
          ? t('On ✓ — {amount} moves to {goal} on the {day}', { amount: baht(saving), goal: short, day: ordinal(month.payday), n: month.payday })
          : t('On ✓ — {amount} moves to {goal} on payday', { amount: baht(saving), goal: short }),
      );
    }
  }
  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  const funLeft = Math.max(0, (month?.spend.find((s) => s.key === 'fun')?.amount ?? 0) - (spent.byCat.fun ?? 0));
  const pitch = plusPitch(month, short, funLeft);
  const styleCompare = month ? fasterStyle(month) : null;

  const plusCards: { f: PlusFeature; icon: Icon3D; title: string; teaser: string; on?: boolean }[] = [
    {
      f: 'styles',
      icon: 'piggy',
      title: t('Money styles'),
      teaser:
        styleCompare && styleCompare.sooner > 0
          ? styleCompare.sooner > 1
            ? t('{goal} {n} months sooner with {style}', { goal: short, n: styleCompare.sooner, style: t(styleCompare.best.s.name) })
            : t('{goal} {n} month sooner with {style}', { goal: short, n: styleCompare.sooner, style: t(styleCompare.best.s.name) })
          : t('Try Save first, 50/30/20 or 6 Jars'),
    },
    {
      f: 'automove',
      icon: 'income',
      title: t('Payday auto-move'),
      teaser: month?.payday
        ? t('{amount} moves itself on the {day}', { amount: baht(saving), day: ordinal(month.payday), n: month.payday })
        : t('{amount} moves itself on payday', { amount: baht(saving) }),
      on: !!profile?.split_when_paid,
    },
    { f: 'customize', icon: 'shield', title: t('Customize & locks'), teaser: t('Lock {goal}, move food & fun your way', { goal: short }) },
    { f: 'talk', icon: 'phone', title: t('Talk to Kip'), teaser: t('“Can I afford hotpot on Friday?”') },
  ];

  // ---- bills (paid marks reset each pay period) ----
  const pk = periodKey(month?.payday ?? null, now);
  const paidKeys = month?.paid?.period === pk ? month.paid.keys : [];
  const bills: Bill[] = month
    ? [
        ...(month.bills.rent > 0 ? [{ key: 'rent', name: t('Rent'), amount: month.bills.rent }] : []),
        ...(month.bills.items ?? []).map((b) => ({ key: `item:${b.name}`, name: b.name, amount: b.amount })),
        ...(month.bills.guess > 0 ? [{ key: 'guess', name: t('Other bills'), amount: month.bills.guess, estimate: true }] : []),
      ].map((b) => ({ ...b, paid: paidKeys.includes(b.key) }))
    : [];
  function setPaid(key: string, paid: boolean) {
    if (!month) return;
    const keys = new Set(paidKeys);
    if (paid) keys.add(key);
    else keys.delete(key);
    save({ ...month, paid: { period: pk, keys: [...keys] } } as MonthBudget);
    if (paid) flash(t('{name} paid ✓', { name: bills.find((b) => b.key === key)?.name ?? t('Bill') }));
  }

  // Left to spend: whatever is going faster than plan comes first, so it's never hidden off-screen.
  const gone = P.total ? P.dayIndex / P.total : 0;
  const spendTiles = (month?.spend ?? [])
    .map((s) => {
      const used = spent.byCat[s.key] ?? 0;
      const budget = s.amount + (spent.extraCats?.[s.key] ?? 0); // + extra money kept for this category
      const share = budget ? used / budget : 0;
      return { s: { ...s, amount: budget }, used, left: Math.max(0, budget - used), going: used > 0 && share > Math.max(gone + 0.15, gone * 1.5) };
    })
    .sort((a, b) => Number(b.going) - Number(a.going));

  const shownSpent = spent.byDay[selectedDay] ?? 0;
  const sel = new Date(selectedDay);
  const firstName = profile?.display_name?.split(' ')[0];

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground mood={fast ? 'fast' : 'calm'} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
        {/* top */}
        <RiseIn style={styles.top}>
          <Glass radius={999} shadow innerStyle={styles.pill}>
            <Text style={styles.pillText}>
              🔥 {streak > 0 ? <Text style={{ fontFamily: fonts.medium }}>{streak}</Text> : null}
              <Text style={{ color: colors.muted, fontSize: 12 }}>{' ' + (streak > 0 ? (streak > 1 ? t('days logged') : t('day logged')) : t('Log today to start a streak'))}</Text>
            </Text>
          </Glass>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Profile and settings')} onPress={() => router.push('/profile')} style={styles.avatar}>
            {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: 40, height: 40 }} /> : <UserCircle size={40} color={colors.ink} weight="light" />}
          </Pressable>
        </RiseIn>

        <RiseIn delay={60}>
          <Text style={styles.hello}>
            {firstName == null ? t('Hello, there') : t('Hello, {name}', { name: firstName })}
            {'\n'}
            <Text style={{ color: '#B9B8B0' }}>{t('Today’s money')}</Text>
          </Text>
        </RiseIn>

        {/* the two numbers */}
        <RiseIn delay={120} style={styles.nums}>
          <Pressable
            disabled={!showOverToday}
            onPress={() => setOverOpen(true)}
            accessibilityRole={showOverToday ? 'button' : undefined}
            accessibilityLabel={showOverToday ? t('{amount} over today — see what it changes', { amount: baht(overToday) }) : undefined}>
            <CountUp
              value={isTodaySelected ? (showOverToday ? overToday : leftToday) : shownSpent}
              format={showOverToday ? (n) => <>−{Big(n)}</> : Big}
              style={[styles.n1, showOverToday && { color: colors.orangeText }, overMonth > 0 && { fontSize: 38, lineHeight: 44 }]}
            />
            {showOverToday ? (
              <View style={styles.overLbl}>
                <Text style={[styles.lbl, styles.overText]}>{t('Over today')}</Text>
                <CaretRight size={11} color={colors.orangeText} weight="bold" style={{ marginTop: 6 }} />
              </View>
            ) : (
              <Text style={styles.lbl}>{isTodaySelected ? t('Left today') : t('Spent {day} {date}', { day: dayShort(sel.getDay()), date: sel.getDate() })}</Text>
            )}
          </Pressable>
          <View style={styles.vbar} />
          <Pressable
            style={{ flexShrink: 1 }}
            onPress={() => (overMonth > 0 ? setOverOpen(true) : router.push('/history'))}
            accessibilityRole="button"
            accessibilityLabel={
              overMonth > 0 ? t('{amount} over this month — see what it changes', { amount: baht(overMonth) }) : t('{amount} left this month — see history', { amount: baht(leftMonth) })
            }>
            <CountUp
              value={overMonth > 0 ? overMonth : leftMonth}
              format={(n) => (
                <>
                  {overMonth > 0 ? '−' : ''}
                  {Big(n)}
                </>
              )}
              style={[styles.n2, overMonth > 0 && { color: colors.orangeText, fontSize: 26 }]}
            />
            <Text style={[styles.lbl, overMonth > 0 && styles.overText]}>{overMonth > 0 ? t('Over this month') : t('Left this month')}</Text>
            {overMonth <= 0 && extraIn > 0 && <Text style={styles.extraIn}>{t('incl. +{amount} extra', { amount: baht(extraIn) })}</Text>}
          </Pressable>
          <Glass radius={25} style={{ marginLeft: 'auto' }} innerStyle={styles.cal}>
            <Text style={styles.calN}>{P.daysLeft}</Text>
            <Text style={styles.calS}>{t('days')}</Text>
          </Glass>
        </RiseIn>

        <RiseIn delay={180} style={{ paddingHorizontal: 18, marginTop: 22 }}>
          <WeekStrip start={P.start} end={P.end} byDay={spent.byDay} daily={dailyPlan} selected={selectedDay} onSelect={(d) => setSelectedDay(d.toDateString())} now={now} />
        </RiseIn>

        {/* Kip finding slips: only when there's something to set up or something new */}
        <SlipFinder isPlus={isPlus} />

        {/* Kip */}
        <RiseIn delay={240} style={{ paddingHorizontal: 18, marginTop: 22 }}>
          <Glass radius={30}>
            <View style={{ padding: 20, paddingBottom: 18, minHeight: 190 }}>
              <View style={styles.kip} pointerEvents="none">
                <Kip mood={kipMood} size={104} />
              </View>
              <Text style={styles.kipName}>Kip</Text>
              <Text style={styles.kipRole}>{t('Your money buddy')}</Text>
              <Text style={styles.say}>{say}</Text>
              <View style={styles.two}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.twoK}>{t('Spent today')}</Text>
                  <Text style={[styles.twoV, overToday > 0 && { color: colors.orangeText }]}>{t('{spent} of {total}', { spent: baht(spent.today), total: baht(dailyToday) })}</Text>
                </View>
                <View style={[styles.twoR]}>
                  <Text style={styles.twoK}>{short}</Text>
                  <Text style={styles.twoV}>{goalDate ? monthYear(goalDate) : goal?.monthly ? t('{amount}/mo', { amount: baht(goal.monthly) }) : '—'}</Text>
                </View>
              </View>
            </View>
            <Squish onPress={() => openFeature('talk')} style={styles.foot} accessibilityRole="button" accessibilityLabel={isPlus ? t('Ask Kip anything') : t('Ask Kip anything — Plus')}>
              <Text style={styles.footText}>{t('Ask Kip anything')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {!isPlus && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>Plus</Text>}
                <View style={styles.lockDot}>{isPlus ? <Arrow /> : <LockIcon />}</View>
              </View>
            </Squish>
          </Glass>
        </RiseIn>

        {/* goal */}
        <RiseIn delay={300}>
          <Section title={t('Your goal')} right={t('{n} of {total}', { n: 1, total: isPlus ? 3 : 1 })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={322} decelerationRate="fast" style={styles.rowOuter} contentContainerStyle={styles.rowInner}>
            {goal && <GoalCard g={goal} perMonth={month?.goal.amount ?? 0} width={Math.min(312, width - 60)} />}
            <Squish onPress={() => openFeature('goals')} style={styles.addGoal} accessibilityRole="button" accessibilityLabel={t('Pin 2 more goals')}>
              <Image source={ICON3D.piggy} style={{ width: 66, height: 66 }} contentFit="contain" />
              <Text style={styles.addGoalText}>{isPlus ? t('Add a goal') : t('Pin 2 more goals')}</Text>
              {!isPlus && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>✦ PLUS</Text>
                </View>
              )}
            </Squish>
          </ScrollView>
        </RiseIn>

        {/* left to spend */}
        <RiseIn delay={360}>
          <Section title={t('Left to spend')} right={t('Your month')} onRight={() => router.push('/month')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowOuter} contentContainerStyle={styles.rowInner}>
            {spendTiles.map(({ s, left, going }, i) => {
              return (
                <Squish
                  key={s.key}
                  onPress={() => router.push('/month')}
                  accessibilityRole="button"
                  accessibilityLabel={t('{category}: {left} left of {total}', { category: t(CATEGORY[s.key].name), left: baht(left), total: baht(s.amount) })}>
                  <Glass radius={24} innerStyle={styles.cat}>
                    <View style={{ width: 64, height: 64, marginBottom: 10 }}>
                      <Ring pct={s.amount ? left / s.amount : 0} color={going ? colors.orange : colors.limeDeep} delay={500 + i * 80} />
                      <Float delay={i * 600} style={StyleSheet.absoluteFill}>
                        <Image source={ICON3D[CAT_ICON3D[s.key]]} style={{ width: 40, height: 40, margin: 12 }} contentFit="contain" />
                      </Float>
                    </View>
                    <Text style={styles.pct}>{t('{pct}% left', { pct: s.amount ? Math.round((left / s.amount) * 100) : 0 })}</Text>
                    <Text style={styles.catName} numberOfLines={1}>
                      {catShort(s.key)}
                    </Text>
                    <Text style={styles.catBig}>{baht(left)}</Text>
                    {going ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange }} />
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.orangeText }}>{t('Going fast')}</Text>
                      </View>
                    ) : (
                      <Text style={styles.catOf}>{t('of {amount}', { amount: baht(s.amount) })}</Text>
                    )}
                  </Glass>
                </Squish>
              );
            })}
          </ScrollView>
        </RiseIn>

        {/* Plus */}
        <RiseIn delay={420}>
          <Section title={t('Do more with Kip')} tag="✦ PLUS" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.rowOuter, { marginTop: -38 }]} contentContainerStyle={[styles.rowInner, { paddingTop: 40 }]}>
            {plusCards.map((c, i) => (
              <Squish key={c.f} onPress={() => openFeature(c.f)} style={styles.plus} accessibilityRole="button" accessibilityLabel={isPlus ? c.title : t('{title} — Plus', { title: c.title })}>
                <Float delay={i * 700} style={styles.plusIcon}>
                  <Image source={ICON3D[c.icon]} style={{ width: 96, height: 96 }} contentFit="contain" />
                </Float>
                <Text style={styles.plusTitle}>{c.title}</Text>
                <Text style={styles.plusTeaser}>{c.teaser}</Text>
                <View style={styles.tryc}>
                  <Text style={styles.trycText}>{isPlus ? (c.on ? t('On ✓') : t('Open')) : t('✦ Try free')}</Text>
                </View>
              </Squish>
            ))}
          </ScrollView>
        </RiseIn>

        {/* bills */}
        {bills.length > 0 && (
          <RiseIn delay={480} style={{ paddingHorizontal: 18 }}>
            <Section title={t('Bills this month')} right={t('{amount} · set aside', { amount: baht(bills.reduce((a, b) => a + b.amount, 0)) })} inset={false} />
            <BillStack bills={bills} onPaid={setPaid} />
          </RiseIn>
        )}
      </ScrollView>

      {overOpen && (overToday > 0 || overMonth > 0) && (
        <OverSheet
          info={overInfo}
          isPlus={isPlus}
          onCover={coverIt}
          onClose={(msg) => {
            setOverOpen(false);
            if (msg) flash(msg);
          }}
        />
      )}
      {toast && (
        <View style={[styles.toast, { bottom: 176 + Math.max(insets.bottom, 12) }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <Squish
        haptic={false}
        accessibilityRole="button"
        accessibilityLabel={t('Add it yourself')}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/add');
        }}
        style={[styles.fab, { bottom: 104 + Math.max(insets.bottom, 12) - 12 }]}>
        <Plus size={26} color="#FFFFFF" weight="bold" />
      </Squish>

      {sheet && (
        <PlusSheet open onClose={() => setSheet(null)} onUnlocked={() => unlocked(sheet)} title={pitch[sheet].title} sub={pitch[sheet].sub}>
          {pitch[sheet].body}
        </PlusSheet>
      )}
    </View>
  );
}

function Section({ title, right, onRight, tag, inset = true }: { title: string; right?: string; onRight?: () => void; tag?: string; inset?: boolean }) {
  return (
    <View style={[styles.sec, inset && { paddingHorizontal: 22 }]}>
      <Text style={styles.secTitle}>{title}</Text>
      {tag ? (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ) : right ? (
        <Pressable onPress={onRight} disabled={!onRight} hitSlop={8}>
          <Text style={styles.secRight}>{right}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function GoalCard({ g, perMonth, width }: { g: HomeGoal; perMonth: number; width: number }) {
  const type = typeInfo(g.goalType, g.kind as never);
  const short = g.kind === 'monthly' ? g.title : shortName(g.title, g.kind as never);
  const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
  const days = g.due ? Math.max(0, Math.round((parseDay(g.due).getTime() - Date.now()) / 86_400_000)) : null;
  const line = (g.promise ?? '').split('\n')[0];
  return (
    <Squish
      onPress={() => router.push('/goals')}
      style={[styles.goal, { width, backgroundColor: type.color }]}
      accessibilityRole="button"
      accessibilityLabel={t('{goal}, {pct}% saved', { goal: g.title, pct })}>
      {g.photo ? (
        <Image source={{ uri: g.photo, cacheKey: g.photoKey ?? undefined }} cachePolicy="disk" style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }]}>
          <Float amount={6}>
            <Image source={ICON3D[goalIcon3D(g.kind)]} style={{ width: 120, height: 120 }} contentFit="contain" />
          </Float>
        </View>
      )}
      <View style={styles.gchip}>
        <Image source={ICON3D[goalIcon3D(g.kind)]} style={{ width: 26, height: 26 }} contentFit="contain" />
        <Text style={styles.gchipText} numberOfLines={1}>
          {days !== null ? t('{goal} · {n} days', { goal: short, n: days }) : short}
        </Text>
      </View>
      {line ? (
        <View style={styles.note}>
          <View style={styles.tape} />
          <Text style={styles.noteHead}>{t('MY PROMISE')}</Text>
          <Text style={styles.noteText} numberOfLines={3}>
            {line}
          </Text>
        </View>
      ) : null}
      <View style={styles.strip}>
        <Glass radius={22} shadow={false} tint="rgba(255,255,255,0.72)">
          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={styles.stripBig}>{g.target > 0 ? t('{amount} saved', { amount: baht(g.saved) }) : t('{amount} a month', { amount: baht(perMonth) })}</Text>
              {g.target > 0 && <Text style={styles.stripSmall}>{pct}%</Text>}
            </View>
            {g.target > 0 && (
              <>
                <View style={styles.track}>
                  <View style={[styles.trackFill, { width: `${Math.max(pct, 2)}%` }]} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.stripSmall}>{t('{amount} a month', { amount: baht(perMonth) })}</Text>
                  <Text style={styles.stripSmall}>{t('of {amount}', { amount: baht(g.target) })}</Text>
                </View>
              </>
            )}
          </View>
        </Glass>
      </View>
    </Squish>
  );
}

/** The short category name on a tile ("Food", not "Food & drinks"). */
function catShort(key: CatKey) {
  const short: Partial<Record<CatKey, string>> = {
    food: t('Food'),
    transport: t('Transport'),
    shopping: t('Shopping'),
    fun: t('Fun'),
    health_beauty: t('Health'),
    learning: t('Learning'),
    giving: t('Giving'),
    other: t('Household'),
    spend_freely: t('Spend freely'),
  };
  return short[key] ?? t(CATEGORY[key].name.split(' &')[0]);
}

function LockIcon() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24">
      <Path fill="#FFFFFF" d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z" />
    </Svg>
  );
}
function Arrow() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24">
      <Path d="M5 12h13M13 6l6 6-6 6" stroke="#FFFFFF" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  pill: { height: 40, paddingHorizontal: 14, justifyContent: 'center' },
  pillText: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF' },
  hello: { paddingHorizontal: 22, paddingTop: 26, fontFamily: fonts.regular, fontSize: 34, lineHeight: 40, letterSpacing: -1.1, color: colors.ink },
  nums: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, paddingHorizontal: 22, paddingTop: 22 },
  n1: { fontFamily: fonts.medium, fontSize: 46, letterSpacing: -2, lineHeight: 50, color: colors.ink, fontVariant: ['tabular-nums'] },
  n2: { fontFamily: fonts.regular, fontSize: 30, letterSpacing: -1, lineHeight: 34, color: '#B9B8B0', fontVariant: ['tabular-nums'] },
  lbl: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 6 },
  overLbl: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  overText: { color: colors.orangeText, fontFamily: fonts.medium },
  extraIn: { fontFamily: fonts.medium, fontSize: 11, color: colors.lavenderText, marginTop: 2 },
  vbar: { width: 1, height: 54, backgroundColor: 'rgba(17,17,17,0.12)' },
  cal: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  calN: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 16, color: colors.ink },
  calS: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
  kip: { position: 'absolute', right: 10, top: 6 },
  kipName: { fontFamily: fonts.medium, fontSize: 24, letterSpacing: -0.5, color: colors.ink },
  kipRole: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 1 },
  say: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: 14, maxWidth: 210, minHeight: 63 },
  two: { flexDirection: 'row', marginTop: 14 },
  twoR: { flex: 1, borderLeftWidth: 1, borderLeftColor: 'rgba(17,17,17,0.1)', paddingLeft: 16 },
  twoK: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  twoV: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, marginTop: 2, fontVariant: ['tabular-nums'] },
  foot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(255,252,154,0.35)',
  },
  footText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  lockDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  sec: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 34, paddingBottom: 12 },
  secTitle: { fontFamily: fonts.medium, fontSize: 19, letterSpacing: -0.3, color: colors.ink },
  secRight: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  tag: { height: 24, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.ink, justifyContent: 'center', alignSelf: 'center' },
  tagText: { fontFamily: fonts.semibold, fontSize: 11, color: '#FFFFFF' },
  // swipe rows: room for shadows to fade out, then the space is pulled back — no clipped edges
  rowOuter: { marginTop: -20, marginBottom: -30 },
  rowInner: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 48, gap: 10 },
  goal: { height: 270, borderRadius: 30, overflow: 'hidden', boxShadow: '0 1px 2px rgba(17,17,17,0.03), 0 16px 36px rgba(17,17,17,0.08)' },
  gchip: {
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
    maxWidth: '70%',
  },
  gchipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, flexShrink: 1 },
  note: {
    position: 'absolute',
    right: 16,
    top: 60,
    width: 150,
    backgroundColor: colors.lime,
    paddingTop: 13,
    paddingHorizontal: 11,
    paddingBottom: 8,
    transform: [{ rotate: '3deg' }],
    boxShadow: '0 12px 20px rgba(0,0,0,0.22)',
  },
  tape: { position: 'absolute', top: -8, left: 52, width: 44, height: 15, backgroundColor: 'rgba(255,255,255,0.65)', transform: [{ rotate: '-4deg' }] },
  noteHead: { fontFamily: fonts.regular, fontSize: 8, letterSpacing: 1, color: 'rgba(17,17,17,0.55)' },
  noteText: { fontFamily: fonts.hand, fontSize: 18, lineHeight: 18, color: colors.ink, marginTop: 2 },
  strip: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  stripBig: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
  stripSmall: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(17,17,17,0.08)', marginTop: 9, marginBottom: 6, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 4, backgroundColor: colors.limeDeep },
  addGoal: {
    width: 140,
    height: 270,
    borderRadius: 30,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(17,17,17,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 12,
  },
  addGoalText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center' },
  cat: { width: 136, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  pct: { position: 'absolute', right: 14, top: 14, fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  catName: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  catBig: { fontFamily: fonts.medium, fontSize: 24, letterSpacing: -0.8, color: colors.ink, marginTop: 1, fontVariant: ['tabular-nums'] },
  catOf: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  plus: { width: 236, height: 136, borderRadius: 26, padding: 16, backgroundColor: '#141414', boxShadow: '0 1px 2px rgba(17,17,17,0.04), 0 14px 28px rgba(17,17,17,0.12)' },
  plusIcon: { position: 'absolute', right: -4, top: -34 },
  plusTitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 20, color: '#FFFFFF', maxWidth: 130 },
  plusTeaser: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.62)', marginTop: 4, maxWidth: 150 },
  tryc: { position: 'absolute', left: 16, bottom: 14, height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.limeDeep, justifyContent: 'center' },
  trycText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
  fab: {
    position: 'absolute',
    right: 20,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 14px 28px rgba(17,17,17,0.28)',
  },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  toastText: { fontFamily: fonts.regular, fontSize: 13, color: '#FFFFFF' },
  bubble: { alignSelf: 'flex-start', maxWidth: '88%', borderRadius: 16, borderTopLeftRadius: 4, backgroundColor: colors.grey, paddingVertical: 9, paddingHorizontal: 12 },
  bubbleMe: { alignSelf: 'flex-end', borderTopLeftRadius: 16, borderTopRightRadius: 4, backgroundColor: colors.lime },
  bubbleText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.ink },
});
