// Home, the glow version: one soft field behind everything, frosted cards on top.
// Today's money first, then the week, Kip, your goal, what's left per category, Plus, and the bills.
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { CalendarBlank, CaretRight, Flame, LockSimple, Plus } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlusSheet, type PlusFeature } from '@/components/PlusSheet';
import { fasterStyle, plusPitch } from '@/components/plusPitch';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { CountUp, Float, RiseIn, Ring, Squish } from '@/components/glow/motion';
import { BillStack, type Bill } from '@/components/home/BillStack';
import { CatSheet, type CatInfo } from '@/components/home/CatSheet';
import { OverSheet, type OverInfo } from '@/components/home/OverSheet';
import { SlipFinder } from '@/components/home/SlipFinder';
import { WeekStrip } from '@/components/home/WeekStrip';
import { PaceChart } from '@/components/home/PaceChart';
import { KipStill } from '@/components/KipStill';
import { KipSheet } from '@/components/home/KipSheet';
import { plan as splitMonth, type Style } from '@/lib/brain';
import { CATEGORY, savingTotal, STYLES, type CatKey, type MonthBudget } from '@/lib/budget';
import { useAuth } from '@/lib/auth';
import { dayShort, t } from '@/lib/i18n';
import { monthNumbers, overCover, periodKey, useHome, type HomeGoal } from '@/lib/home';
import { cover as coverMonth, savingThisCycle } from '@/lib/moneyin';
import { arrivals, MAX_GOALS, splitOf } from '@/lib/goals';
import { dueLabel, monthsToDue, readyOf, rollYearly, typeName, typeOf } from '@/lib/everymonth';
import { liteOf } from '@/components/goals/bits';
import { CAT_ICON3D, goalIcon3D, ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { useMonth } from '@/lib/month';
import { paceOf } from '@/lib/pace';
import { typeInfo } from '@/lib/setup/goalTypes';
import { monthYear, monthsFromNow, ordinal, parseDay, shortName } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { colors, fonts, inkA, themed, whiteA, blackA } from '@/theme';

/** ฿ drawn smaller next to a big number. */
// The baht sign at about half the number's size: big enough to read, small enough to let the number lead.
const bahtSized = (size: number) => (n: number) => (
  <>
    <Text style={{ fontSize: size }}>฿</Text>
    {n.toLocaleString('en-US')}
  </>
);
const Big = bahtSized(32);
const Small = bahtSized(20);

export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile, session, refreshProfile } = useAuth();
  const { month, save } = useMonth();
  const { goals, spent, streak, reload, spendsIn } = useHome(month);
  const [sheet, setSheet] = useState<PlusFeature | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(new Date().toDateString());
  const [overOpen, setOverOpen] = useState(false);
  const [kipOpen, setKipOpen] = useState(false);
  const [catOpen, setCatOpen] = useState<CatKey | null>(null);
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
  const split = month ? splitOf(month, goals.map(liteOf)) : new Map<string, number>();
  // When each goal really arrives at this month's pace — the same as the Goals screen (a new bill or a style change
  // moves it), not the date saved at setup.
  const arrive = month ? arrivals(goals.map(liteOf), splitOf(month, goals.map(liteOf)), month.payday ?? null) : new Map<string, Date | null>();
  const goalDate = goal && goal.kind !== 'monthly' ? (arrive.get(goal.id) ?? null) : null;
  const fast = spent.total > 0 && pace > 0;
  const isTodaySelected = selectedDay === now.toDateString();
  const dailyPlan = P.total ? spendBudget / P.total : 0;
  const line = paceOf(spent.byDay, P.start, P.total, P.dayIndex, spendBudget);
  const firstName = profile?.display_name?.split(' ')[0];
  const showOverToday = isTodaySelected && overToday > 0;
  const monthOver = overMonth > 0;

  // Going over: what it changes (the sheet behind the minus numbers).
  const goalPerMonth = month && !month.goal.isSafetyNet ? savingThisCycle(month, Number(profile?.safety_saved ?? 0)).goal : 0;
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
    if (f === 'styles') return router.push('/styles');
    if (f === 'customize') return router.push('/month');
    if (f === 'talk') return router.push('/talk');
    if (f === 'goals') return router.push(goals.length < MAX_GOALS ? '/goal-new' : '/goals');
    if (f === 'automove' && session) {
      await supabase.from('profiles').update({ split_when_paid: true }).eq('id', session.user.id);
      await refreshProfile();
      flash(
        month?.payday
          ? t('Auto-move on: {amount} moves to {goal} on the {day}', { amount: baht(saving), goal: short, day: ordinal(month.payday), n: month.payday })
          : t('Auto-move on: {amount} moves to {goal} on payday', { amount: baht(saving), goal: short }),
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
        ...(month.bills.rent > 0 ? [{ key: 'rent', name: t('Rent'), amount: month.bills.rent, type: 'rent' as const }] : []),
        ...(month.bills.items ?? []).map((b) => ({
          key: `item:${b.name}`,
          name: b.name,
          amount: b.amount,
          type: typeOf(b),
          ...(b.yearly
            ? {
                sub: t('Every year · due {month}', { month: dueLabel(b.yearly.due) }),
                note: t('{ready} of {total} ready', { ready: baht(readyOf(b, now)), total: baht(b.yearly.total) }),
                perMonth: true,
              }
            : { sub: t('{type} · monthly', { type: typeName(typeOf(b)) }) }),
        })),
        ...(month.bills.guess > 0 ? [{ key: 'guess', name: t('Other bills'), amount: month.bills.guess, estimate: true }] : []),
      ].map((b) => ({ ...b, paid: paidKeys.includes(b.key) }))
    : [];
  function setPaid(key: string, paid: boolean) {
    if (!month) return;
    const keys = new Set(paidKeys);
    if (paid) keys.add(key);
    else keys.delete(key);
    // A yearly item paid in (or after) the month it's due starts its next year: due again in a year, total ÷ 12 a month.
    const item = (month.bills.items ?? []).find((b) => `item:${b.name}` === key);
    const base = paid && item?.yearly && monthsToDue(item.yearly.due, now) <= 1 ? rollYearly(month, item.name, now) : month;
    save({ ...base, paid: { period: pk, keys: [...keys] } } as MonthBudget);
    if (paid) flash(t('{name} marked paid', { name: bills.find((b) => b.key === key)?.name ?? t('Bill') }));
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

  const catTile = catOpen ? spendTiles.find((x) => x.s.key === catOpen) : undefined;

  const shownSpent = spent.byDay[selectedDay] ?? 0;
  const sel = new Date(selectedDay);
  // How long this pay cycle has left: the plain-words version of the old "23 days" circle.
  const cycleLeft = month?.payday
    ? P.daysLeft > 1
      ? t('{n} days to payday', { n: P.daysLeft })
      : t('Payday is tomorrow')
    : P.daysLeft > 1
      ? t('{n} days left this month', { n: P.daysLeft })
      : t('Last day of the month');

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground mood={fast ? 'fast' : 'calm'} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
        {/* top */}
        <RiseIn style={styles.top}>
          <View style={styles.streak}>
            <Flame size={16} color={colors.muted} />
            <Text style={styles.streakText}>
              {streak > 0 ? <Text style={{ fontFamily: fonts.medium, color: colors.ink }}>{streak} </Text> : null}
              {streak > 0 ? (streak > 1 ? t('days logged') : t('day logged')) : t('Log today to start a streak')}
            </Text>
          </View>
        </RiseIn>

        <RiseIn delay={60}>
          <Text style={styles.hello}>
            {firstName ? t('Hello, {name}', { name: firstName }) : t('Hello, there')}
            {'\n'}
            <Text style={{ color: colors.soft }}>{cycleLeft}</Text>
          </Text>
        </RiseIn>

        {/* the two numbers (approved mockup G2): the one that matters on the left, big; the other on the right.
            Over is said in words and in orange (never a minus sign), and only one number is orange at a time:
            once the month is used up, "over today" means nothing, so the month leads and today just says what you spent. */}
        <RiseIn delay={120} style={styles.nums}>
          {monthOver && isTodaySelected ? (
            <Pressable
              style={{ flexShrink: 1 }}
              onPress={() => setOverOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('{amount} over this month — see what it changes', { amount: baht(overMonth) })}>
              <CountUp value={overMonth} format={Big} style={[styles.n1, { color: colors.orangeText }]} fit />
              <View style={styles.overLbl}>
                <Text style={[styles.l1, styles.overText]}>{t('Over this month')}</Text>
                <CaretRight size={12} color={colors.orangeText} weight="bold" style={{ marginTop: 6 }} />
              </View>
              <Text style={styles.l2}>{t('Spending money was {amount}', { amount: baht(spendBudget) })}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={{ flexShrink: 1 }}
              disabled={!showOverToday}
              onPress={() => setOverOpen(true)}
              accessibilityRole={showOverToday ? 'button' : undefined}
              accessibilityLabel={showOverToday ? t('{amount} over today — see what it changes', { amount: baht(overToday) }) : undefined}>
              <CountUp value={isTodaySelected ? (showOverToday ? overToday : leftToday) : shownSpent} format={Big} style={[styles.n1, showOverToday && { color: colors.orangeText }]} fit />
              {showOverToday ? (
                <View style={styles.overLbl}>
                  <Text style={[styles.l1, styles.overText]}>{t('Over today')}</Text>
                  <CaretRight size={12} color={colors.orangeText} weight="bold" style={{ marginTop: 6 }} />
                </View>
              ) : (
                <Text style={styles.l1}>{isTodaySelected ? t('Left today') : t('Spent {day} {date}', { day: dayShort(sel.getDay()), date: sel.getDate() })}</Text>
              )}
              {isTodaySelected && <Text style={styles.l2}>{t('{spent} spent of {total}', { spent: baht(spent.today), total: baht(dailyToday) })}</Text>}
            </Pressable>
          )}
          {monthOver && isTodaySelected ? (
            <Pressable
              style={{ alignItems: 'flex-end', flexShrink: 1 }}
              onPress={() => router.push('/history')}
              accessibilityRole="button"
              accessibilityLabel={t('{amount} spent today — see history', { amount: baht(spent.today) })}>
              <CountUp value={spent.today} format={Small} style={styles.n2} fit />
              <Text style={styles.l1}>{t('Spent today')}</Text>
              <Text style={styles.l2}>{t('Must-haves until payday')}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={{ alignItems: 'flex-end', flexShrink: 1 }}
              onPress={() => router.push('/history')}
              accessibilityRole="button"
              accessibilityLabel={t('{amount} left this month — see history', { amount: baht(leftMonth) })}>
              <CountUp value={leftMonth} format={Small} style={styles.n2} fit />
              <Text style={styles.l1}>{t('Left this month')}</Text>
              <Text style={styles.l2}>{t('of {amount}', { amount: baht(spendBudget) })}</Text>
              {extraIn > 0 && <Text style={styles.extraIn}>{t('incl. +{amount} extra', { amount: baht(extraIn) })}</Text>}
            </Pressable>
          )}
        </RiseIn>

        {/* the pay month as one line, with the plan as a safe zone (approved mockup G2) */}
        {spendBudget > 0 && (
          <RiseIn delay={160} style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <View style={styles.paceCard}>
              <View style={styles.paceHead}>
                <Text style={styles.weekLbl}>{t('This pay month')}</Text>
                <Text style={styles.paceSpent}>{t('{amount} spent', { amount: baht(line.spent) })}</Text>
              </View>
              <PaceChart pace={line} budget={spendBudget} total={P.total} start={P.start} />
            </View>
          </RiseIn>
        )}

        <RiseIn delay={200} style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={styles.weekHead}>
            <Text style={styles.weekLbl}>{t('This week')}</Text>
            <Squish style={styles.calBtn} accessibilityRole="button" onPress={() => router.push('/calendar' as never)}>
              <CalendarBlank size={15} color={colors.ink} />
              <Text style={styles.calText}>{t('Full calendar')}</Text>
            </Squish>
          </View>
          <WeekStrip start={P.start} end={P.end} byDay={spent.byDay} daily={dailyPlan} selected={selectedDay} onSelect={(d) => setSelectedDay(d.toDateString())} now={now} />
        </RiseIn>

        {/* Kip finding slips: only when there's something to set up or something new */}
        <SlipFinder isPlus={isPlus} />

        {/* Kip: one line on Home; tap to read the whole thing */}
        <RiseIn delay={240} style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <Squish style={styles.kipLine} onPress={() => setKipOpen(true)} accessibilityRole="button" accessibilityLabel={t('Kip says: {text}', { text: say })}>
            <KipStill size={32} />
            <Text style={styles.kipText} numberOfLines={1}>
              <Text style={styles.kipName}>Kip </Text>
              {say}
            </Text>
            <View style={styles.readBtn}>
              <Text style={styles.readText}>{t('Read')}</Text>
              <CaretRight size={12} color={colors.muted} weight="bold" />
            </View>
          </Squish>
        </RiseIn>

        {/* goal */}
        <RiseIn delay={300}>
          <Section title={goals.length > 1 ? t('Your goals') : t('Your goal')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={322} decelerationRate="fast" style={styles.rowOuter} contentContainerStyle={styles.rowInner}>
            {goals.map((g) => (
              <GoalCard key={g.id} g={g} perMonth={split.get(g.id) ?? 0} arrives={arrive.get(g.id) ?? null} width={Math.min(312, width - 60)} />
            ))}
            {goals.length < MAX_GOALS && (
              <Squish onPress={() => openFeature('goals')} style={styles.addGoal} accessibilityRole="button" accessibilityLabel={isPlus ? t('Add a goal') : t('Pin 2 more goals')}>
                <Image source={ICON3D.piggy} style={{ width: 66, height: 66 }} contentFit="contain" />
                <Text style={styles.addGoalText}>{isPlus ? t('Add a goal') : t('Pin 2 more goals')}</Text>
                {!isPlus && <Text style={styles.quiet}>Plus</Text>}
              </Squish>
            )}
          </ScrollView>
        </RiseIn>

        {/* left to spend */}
        <RiseIn delay={360}>
          <Section title={t('Left to spend')} right={t('Your month')} onRight={() => router.push('/month')} caret />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowOuter} contentContainerStyle={styles.rowInner}>
            {spendTiles.map(({ s, left, going }, i) => {
              return (
                <Squish
                  key={s.key}
                  onPress={() => setCatOpen(s.key)}
                  accessibilityRole="button"
                  accessibilityLabel={t('{category}: {left} left of {total}', { category: t(CATEGORY[s.key].name), left: baht(left), total: baht(s.amount) })}>
                  <Glass radius={24} innerStyle={styles.cat}>
                    <View style={{ width: 64, height: 64, marginBottom: 12 }}>
                      <Ring pct={s.amount ? left / s.amount : 0} color={going ? colors.orange : colors.limeDeep} delay={500 + i * 80} />
                      <Float delay={i * 600} style={StyleSheet.absoluteFill}>
                        <Image source={ICON3D[CAT_ICON3D[s.key]]} style={{ width: 40, height: 40, margin: 12 }} contentFit="contain" />
                      </Float>
                    </View>
                    <Text style={styles.catName} numberOfLines={1}>
                      {catShort(s.key)}
                    </Text>
                    <Text style={styles.catBig}>{baht(left)}</Text>
                    {going ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange }} />
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.orangeText }}>{t('Going fast')}</Text>
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

        {/* Plus: only for people who don't have it yet */}
        {!isPlus && (
          <RiseIn delay={420}>
            <Section title={t('Do more with Kip')} right="Plus" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.rowOuter, { marginTop: -38, marginBottom: -46 }]}
              contentContainerStyle={[styles.rowInner, { paddingTop: 56 }]}>
              {plusCards.map((c, i) => (
                <Squish key={c.f} onPress={() => openFeature(c.f)} style={styles.plus} accessibilityRole="button" accessibilityLabel={t('{title} — Plus', { title: c.title })}>
                  <Float delay={i * 700} style={styles.plusIcon}>
                    <Image source={ICON3D[c.icon]} style={{ width: 96, height: 96 }} contentFit="contain" />
                  </Float>
                  <Text style={styles.plusTitle}>{c.title}</Text>
                  <Text style={styles.plusTeaser}>{c.teaser}</Text>
                  <View style={styles.tryc}>
                    <Text style={styles.trycText}>{t('Try free')}</Text>
                  </View>
                </Squish>
              ))}
            </ScrollView>
          </RiseIn>
        )}

        {/* bills */}
        {bills.length > 0 && (
          <RiseIn delay={480} style={{ paddingHorizontal: 20 }}>
            <Section title={t('Every month')} right={t('{n} of {total} paid', { n: bills.filter((b) => b.paid).length, total: bills.length })} inset={false} />
            <BillStack bills={bills} onPaid={setPaid} />
          </RiseIn>
        )}
      </ScrollView>

      {kipOpen && (
        <KipSheet
          say={say}
          spentToday={t('{spent} of {total}', { spent: baht(spent.today), total: baht(dailyToday) })}
          over={overToday > 0}
          goalName={short}
          goalWhen={goalDate ? monthYear(goalDate) : goal?.monthly ? t('{amount}/mo', { amount: baht(goal.monthly) }) : '—'}
          isPlus={isPlus}
          onAsk={() => openFeature('talk')}
          onClose={() => setKipOpen(false)}
        />
      )}
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
      {catTile && (
        <CatSheet
          info={{ key: catTile.s.key, name: catShort(catTile.s.key), budget: catTile.s.amount, used: catTile.used, going: catTile.going, daysLeft: P.daysLeft } satisfies CatInfo}
          spends={spendsIn(catTile.s.key)}
          onClose={() => setCatOpen(null)}
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
        <Plus size={26} color={colors.paper} weight="bold" />
      </Squish>

      {sheet && (
        <PlusSheet open onClose={() => setSheet(null)} onUnlocked={() => unlocked(sheet)} title={pitch[sheet].title} sub={pitch[sheet].sub}>
          {pitch[sheet].body}
        </PlusSheet>
      )}
    </View>
  );
}

function Section({ title, right, onRight, caret, inset = true }: { title: string; right?: string; onRight?: () => void; caret?: boolean; inset?: boolean }) {
  return (
    <View style={[styles.sec, inset && { paddingHorizontal: 20 }]}>
      <Text style={styles.secTitle}>{title}</Text>
      {right ? (
        <Pressable onPress={onRight} disabled={!onRight} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={styles.secRight}>{right}</Text>
          {caret && <CaretRight size={14} color={colors.muted} />}
        </Pressable>
      ) : null}
    </View>
  );
}

function GoalCard({ g, perMonth, arrives, width }: { g: HomeGoal; perMonth: number; arrives: Date | null; width: number }) {
  const type = typeInfo(g.goalType, g.kind as never);
  const short = g.kind === 'monthly' ? g.title : shortName(g.title, g.kind as never);
  const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
  const days = arrives ? Math.max(0, Math.round((arrives.getTime() - Date.now()) / 86_400_000)) : null;
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
          <Text style={styles.noteHead}>{t('My promise')}</Text>
          <Text style={styles.noteText} numberOfLines={3}>
            {line}
          </Text>
        </View>
      ) : null}
      <View style={styles.strip}>
        <Glass radius={22} shadow={false} light tint="rgba(255,255,255,0.72)">
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

const styles = themed(() =>
  StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
    streak: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40 },
    streakText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
    quiet: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    hello: { paddingHorizontal: 20, paddingTop: 20, fontFamily: fonts.regular, fontSize: 30, lineHeight: 36, letterSpacing: -0.9, color: colors.ink },
    l1: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, marginTop: 4 },
    l2: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
    paceCard: { borderRadius: 32, backgroundColor: colors.paper, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.06)' },
    paceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 48 },
    paceSpent: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    weekLbl: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    kipLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
      paddingLeft: 8,
      paddingRight: 16,
      borderRadius: 999,
      backgroundColor: colors.paper,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.06)',
    },
    kipText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
    readBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4 },
    readText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
    nums: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, paddingHorizontal: 20, paddingTop: 20 },
    n1: { fontFamily: fonts.medium, fontSize: 60, letterSpacing: -3, lineHeight: 70, marginTop: -8, color: colors.ink, fontVariant: ['tabular-nums'] },
    n2: { fontFamily: fonts.medium, fontSize: 26, letterSpacing: -0.8, lineHeight: 34, color: colors.ink, fontVariant: ['tabular-nums'] },
    lbl: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4 },
    overLbl: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    overText: { color: colors.orangeText, fontFamily: fonts.medium },
    extraIn: { fontFamily: fonts.medium, fontSize: 12, color: colors.lavenderText, marginTop: 2 },
    vbar: { width: 1, height: 56, marginBottom: 4, backgroundColor: inkA(0.08) },
    kipName: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
    say: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.ink, marginTop: 4 },
    two: { flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: inkA(0.08) },
    twoR: { flex: 1, borderLeftWidth: 1, borderLeftColor: inkA(0.08), paddingLeft: 16 },
    twoK: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    twoV: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, marginTop: 2, fontVariant: ['tabular-nums'] },
    foot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: inkA(0.08),
      backgroundColor: inkA(0.04),
    },
    footText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    sec: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 32, paddingBottom: 12 },
    secTitle: { fontFamily: fonts.medium, fontSize: 19, letterSpacing: -0.3, color: colors.ink },
    secRight: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    // swipe rows: room for shadows to fade out, then the space is pulled back — no clipped edges
    rowOuter: { marginTop: -20, marginBottom: -30 },
    rowInner: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 12 },
    goal: { height: 272, borderRadius: 28, overflow: 'hidden', boxShadow: '0 1px 2px rgba(17,17,17,0.03), 0 16px 36px rgba(17,17,17,0.08)' },
    gchip: {
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
      maxWidth: '70%',
    },
    gchipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onAccent, flexShrink: 1 },
    note: {
      position: 'absolute',
      right: 16,
      top: 60,
      width: 150,
      backgroundColor: colors.lime,
      paddingTop: 14,
      paddingHorizontal: 12,
      paddingBottom: 10,
      transform: [{ rotate: '3deg' }],
      boxShadow: '0 12px 20px rgba(0,0,0,0.22)',
    },
    tape: { position: 'absolute', top: -8, left: 52, width: 44, height: 15, backgroundColor: whiteA(0.65), transform: [{ rotate: '-4deg' }] },
    noteHead: { fontFamily: fonts.regular, fontSize: 12, color: blackA(0.55) },
    calBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.card, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    calText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
    noteText: { fontFamily: fonts.hand, fontSize: 18, lineHeight: 18, color: colors.onAccent, marginTop: 2 },
    strip: { position: 'absolute', left: 12, right: 12, bottom: 12 },
    stripBig: { fontFamily: fonts.medium, fontSize: 17, color: colors.onAccent },
    stripSmall: { fontFamily: fonts.regular, fontSize: 12, color: colors.onAccentMuted },
    track: { height: 8, borderRadius: 4, backgroundColor: blackA(0.08), marginTop: 9, marginBottom: 6, overflow: 'hidden' },
    trackFill: { height: 8, borderRadius: 4, backgroundColor: colors.limeDeep },
    addGoal: {
      width: 140,
      height: 272,
      borderRadius: 28,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: inkA(0.16),
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 12,
    },
    addGoalText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center' },
    cat: { width: 136, padding: 16 },
    catName: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
    catBig: { fontFamily: fonts.medium, fontSize: 24, letterSpacing: -0.8, color: colors.ink, marginTop: 1, fontVariant: ['tabular-nums'] },
    catOf: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    plus: { width: 236, height: 136, borderRadius: 24, padding: 16, backgroundColor: colors.solid, boxShadow: '0 1px 2px rgba(17,17,17,0.04), 0 14px 28px rgba(17,17,17,0.12)' },
    plusIcon: { position: 'absolute', right: -4, top: -34 },
    plusTitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 20, color: colors.onSolid, maxWidth: 130 },
    plusTeaser: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: whiteA(0.62), marginTop: 4, maxWidth: 150 },
    tryc: { position: 'absolute', left: 16, bottom: 16, height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.limeDeep, justifyContent: 'center' },
    trycText: { fontFamily: fonts.medium, fontSize: 12, color: colors.onAccent },
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
    toastText: { fontFamily: fonts.regular, fontSize: 13, color: colors.paper },
    bubble: { alignSelf: 'flex-start', maxWidth: '88%', borderRadius: 16, borderTopLeftRadius: 4, backgroundColor: colors.grey, paddingVertical: 9, paddingHorizontal: 12 },
    bubbleMe: { alignSelf: 'flex-end', borderTopLeftRadius: 16, borderTopRightRadius: 4, backgroundColor: colors.lime },
    bubbleText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.ink },
  }),
);
