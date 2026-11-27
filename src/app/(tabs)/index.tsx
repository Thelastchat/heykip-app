// Home, the glow version: one soft field behind everything, frosted cards on top.
// Today's money first, then the week, Kip, your goal, what's left per category, Plus, and the bills.
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CalendarBlank, CaretRight, Flame, LockSimple, Plus } from 'phosphor-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { homeTour, Tour } from '@/components/Tour';
import { tourSpot, useTourScroll } from '@/lib/tour';
import { WeekStrip } from '@/components/home/WeekStrip';
import { Kip } from '@/components/Kip';
import { PaceSheet } from '@/components/home/PaceSheet';
import { KipStill } from '@/components/KipStill';
import { KipSheet } from '@/components/home/KipSheet';
import { KipDone, KipNotice } from '@/components/home/KipNotice';
import { DaySheet } from '@/components/DaySheet';
import { plan as splitMonth, type Style } from '@/lib/brain';
import { addBill, CATEGORY, savingTotal, STYLES, type CatKey, type MonthBudget } from '@/lib/budget';
import { useAuth } from '@/lib/auth';
import { dayShort, t } from '@/lib/i18n';
import { monthNumbers, overCover, period, periodKey, useHome, type HomeGoal } from '@/lib/home';
import { cover as coverMonth, savingThisCycle } from '@/lib/moneyin';
import { arrivals, MAX_GOALS, splitOf } from '@/lib/goals';
import { dueLabel, guessType, monthsToDue, readyOf, rollYearly, typeName, typeOf } from '@/lib/everymonth';
import { liteOf } from '@/components/goals/bits';
import { GoalCard } from '@/components/goals/GoalCard';
import { CAT_ICON3D, ICON3D, type Icon3D } from '@/lib/icons3d';
import { baht } from '@/lib/money';
import { noteDays } from '@/lib/checkin';
import { nightAmounts } from '@/lib/checkinDays';
import { useMonth } from '@/lib/month';
import { dueBills, nextDue } from '@/lib/billdue';
import { applyOps } from '@/lib/monthops';
import { laterFor, noticesFor, type Notice } from '@/lib/notice';
import { recapFor, type Recap, type Suggestion } from '@/lib/recap';
import { RecapSheet } from '@/components/home/RecapSheet';
import { paceOf } from '@/lib/pace';
import { typeInfo } from '@/lib/setup/goalTypes';
import { monthYear, monthsFromNow, ordinal, parseDay, shortName } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';
import { useTextStep } from '@/lib/textSize';
import { colors, fonts, inkA, themed, whiteA } from '@/theme';

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
  // Larger text (iPhone Text Size): the month numbers go under today's, so the big number keeps the whole width.
  const stacked = useTextStep() === 2;
  const { width } = useWindowDimensions();
  const { profile, session, refreshProfile } = useAuth();
  const { month, save } = useMonth();
  const { goals, spent, streak, reload, spendsIn, dayOf, last, tx } = useHome(month);
  const [sheet, setSheet] = useState<PlusFeature | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(new Date().toDateString());
  const [overOpen, setOverOpen] = useState(false);
  const [kipOpen, setKipOpen] = useState(false);
  // Tapping a day on the week opens that day (approved mockup) — everything spent, money in, and Add to this day.
  const [dayOpen, setDayOpen] = useState<Date | null>(null);
  const [paceOpen, setPaceOpen] = useState(false);
  const [catOpen, setCatOpen] = useState<CatKey | null>(null);
  const tourScroll = useTourScroll();
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
  // Every evening check-in says that day's real amount (it's only sent on a night nothing was logged).
  useEffect(() => {
    if (month) noteDays(nightAmounts(month, spent, monthNumbers, (p, d) => period(p, d).start.getTime(), now));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, dailyToday, spent.total]);
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

  // ---- Kip notices first (approved mockup): the app's own maths, one card at a time ----
  const hideKey = session ? `heykip.notices.${session.user.id}` : '';
  const [hidden, setHidden] = useState<Record<string, number>>({});
  const [kipDone, setKipDone] = useState<{ text: string; undo: () => Promise<string | null> } | null>(null);
  const [noticeBusy, setNoticeBusy] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hideKey) return;
    AsyncStorage.getItem(hideKey)
      .then((v) => {
        const all = JSON.parse(v ?? '{}') as Record<string, number>;
        // Forget what's no longer hidden, so the list never grows.
        setHidden(Object.fromEntries(Object.entries(all).filter(([, until]) => until > Date.now())));
      })
      .catch(() => {});
  }, [hideKey]);
  useEffect(() => () => void (doneTimer.current && clearTimeout(doneTimer.current)), []);
  function hide(id: string, until: number | null) {
    setHidden((h) => {
      const next = { ...h };
      if (until) next[id] = until;
      else delete next[id];
      if (hideKey) AsyncStorage.setItem(hideKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }
  const noticeGoals = useMemo(() => goals.map((g) => ({ ...liteOf(g), title: g.kind === 'monthly' ? g.title : shortName(g.title, g.kind as never) })), [goals]);
  // Payday recap (approved mockup): the first days of a new pay month, once it's been opened it moves to History.
  const today = now.toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recap = useMemo(() => recapFor(month, tx, last, noticeGoals, new Date()), [month, tx, last, noticeGoals, today]);
  // From History: last month's recap, any day of this pay month.
  const { recap: recapParam } = useLocalSearchParams<{ recap?: string }>();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recapAny = useMemo(() => (recapParam === '1' ? recapFor(month, tx, last, noticeGoals, new Date(), 40) : recap), [recapParam, recap, month, tx, last, noticeGoals]);
  const [recapOpen, setRecapOpenRaw] = useState<Recap | null>(null);
  const setRecapOpen = (on: boolean) => setRecapOpenRaw(on ? recapAny : null);
  useEffect(() => {
    if (recapParam === '1' && recapAny) {
      setRecapOpenRaw(recapAny);
      router.setParams({ recap: undefined } as never);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recapParam, !!recapAny]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const notices = useMemo(() => noticesFor(month, spent, period(month?.payday ?? null), last, noticeGoals, hidden, new Date(), tx, recap), [month, spent, last, noticeGoals, hidden, tx, recap, today]);
  const notice = kipDone ? null : notices[0];
  function showDone(text: string, undo: () => Promise<string | null>) {
    if (doneTimer.current) clearTimeout(doneTimer.current);
    setKipDone({ text, undo });
    // Undo stays for a while, then Kip's line (or the next card) is back.
    doneTimer.current = setTimeout(() => setKipDone(null), 12_000);
  }
  async function doNotice(n: Notice) {
    if (!month || noticeBusy) return;
    if (n.kind === 'runout') {
      const before = month;
      save(n.next);
      hide(n.id, P.end.getTime());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showDone(n.moves.map((m) => `${t(CATEGORY[m.key].name)} ${baht(m.now)}`).join(', '), async () => {
        save(before);
        hide(n.id, null);
        return null;
      });
      return;
    }
    if (n.kind === 'billdue') {
      const before = month;
      setPaid(n.key, true, true);
      showDone(t('{name} marked paid', { name: n.key === 'rent' ? t('Rent') : n.name }), async () => {
        save(before); // exactly as it was, a yearly bill's next year included
        return null;
      });
      return;
    }
    if (n.kind === 'sub' || n.kind === 'subprice' || n.kind === 'substop') {
      // A plan change, made with the app's own bill rules: the card already showed what it does.
      const before = month;
      save(n.next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showDone(
        n.kind === 'sub'
          ? t('{name} added · {amount} a month', { name: n.name, amount: baht(n.amount) })
          : n.kind === 'subprice'
            ? t('{name} now {amount}', { name: n.name, amount: baht(n.now) })
            : t('{name} removed', { name: n.name }),
        async () => {
          save(before);
          return null;
        },
      );
      return;
    }
    if (n.kind === 'substream') {
      hide(n.id, laterFor(n, new Date()));
      return;
    }
    if (n.kind === 'recap') {
      // Opened: the card's done for this pay month; the recap stays in History.
      hide(n.id, P.end.getTime());
      setRecapOpen(true);
      return;
    }
    setNoticeBusy(true);
    const r = await putLeftover(n);
    setNoticeBusy(false);
    if (typeof r === 'string') return flash(r);
    showDone(r.text, r.undo);
  }
  /** Left over → the goal (put_in_goal; Undo takes it back out). */
  async function putLeftover(n: Extract<Notice, { kind: 'leftover' }>): Promise<{ text: string; undo: () => Promise<string | null> } | string> {
    const { error } = await supabase.rpc('put_in_goal', { p_goal: n.goalId, p_amount: n.amount, p_source: 'extra', p_from: 'leftover', p_note: t('Kip: left over last month') });
    if (error) return t('Couldn’t save: {msg}', { msg: error.message });
    hide(n.id, Date.now() + 40 * 86_400_000);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    reload();
    return {
      text: t('{amount} put toward {goal}', { amount: baht(n.amount), goal: n.goalName }),
      undo: async () => {
        const { error: e } = await supabase.rpc('take_from_goal', { p_goal: n.goalId, p_amount: n.amount, p_note: t('Undo') });
        if (e) return t('Couldn’t undo: {msg}', { msg: e.message });
        hide(n.id, null);
        reload();
        return null;
      },
    };
  }
  /** A recap suggestion, made on the month as it is now (an earlier one may have changed it). */
  async function applySuggestion(sg: Suggestion): Promise<{ text: string; undo: () => Promise<string | null> } | string> {
    if (!month) return t('Your plan isn’t loaded yet — try again in a moment.');
    if (sg.kind === 'leftover') return putLeftover(sg.notice);
    const before = month;
    const next =
      sg.kind === 'move'
        ? applyOps(month, [{ op: 'move', from: sg.from, to: sg.to, amount: sg.amount }])
        : (() => {
            const r = addBill(month, sg.notice.name, sg.notice.amount, { type: guessType(sg.notice.name), day: sg.notice.day, remind: 'before' });
            return r.short > 0 ? null : r.month;
          })();
    if (!next) return t('That doesn’t fit your month any more.');
    save(next);
    if (sg.kind === 'sub') hide(sg.id, Date.now() + 365 * 86_400_000);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return {
      text: '',
      undo: async () => {
        save(before);
        if (sg.kind === 'sub') hide(sg.id, null);
        return null;
      },
    };
  }
  async function undoNotice() {
    if (!kipDone || noticeBusy) return;
    setNoticeBusy(true);
    const err = await kipDone.undo();
    setNoticeBusy(false);
    if (err) return flash(err);
    if (doneTimer.current) clearTimeout(doneTimer.current);
    setKipDone(null);
    flash(t('Undone — back how it was.'));
  }

  // Everything put away so far: every goal plus the safety net. The one number on Home that only goes up.
  const totalSaved = goals.reduce((a, g) => a + g.saved, 0) + safetySaved;
  // Where the plan is at the start of today — the same line "under plan" is measured against, so the numbers agree.
  const planSoFar = Math.max(0, spent.total - pace);
  // Payday (and the day after): the month's saving has just gone in — Kip says so before anything else.
  const paydaySaved = P.dayIndex <= 1 && goalPerMonth > 0 && !monthOver;

  // Kip's line: one whole sentence per case, so Thai word order stays natural.
  const say =
    overMonth > 0
      ? t('This month’s spending money is used up — {amount} over. That happens. It comes out of your saving, so rent and bills are safe, and payday resets everything.', { amount: baht(overMonth) })
      : overToday > 0 && daysAfter > 0
        ? goalDate
          ? t('A big day — that’s okay. I spread the {amount} over the next {n} days, so {goal} stays on {date}.', { amount: baht(overToday), n: daysAfter, goal: short, date: monthYear(goalDate) })
          : t('A big day — that’s okay. I spread the {amount} over the next {n} days, so {goal} stays on track.', { amount: baht(overToday), n: daysAfter, goal: short })
        : spent.total === 0
          ? t('Your plan is running. Tell me what you spend and I’ll keep {goal} on track.', { goal: short })
          : pace < 0 && overToday <= 0
            ? goalDate
              ? t('{amount} under plan so far. {goal} stays on track for {date}', { amount: baht(-pace), goal: short, date: monthYear(goalDate) })
              : t('{amount} under plan so far. {goal} stays on track', { amount: baht(-pace), goal: short })
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

  // ---- bills (paid marks reset each pay period); a bill with a due day shows when it's due next ----
  const pk = periodKey(month?.payday ?? null, now);
  const withDue = month ? dueBills(month, now) : [];
  const dueNext = new Map(withDue.map((b) => [b.key, nextDue(b, month?.payday ?? null, now)] as const));
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
      ].map((b) => ({ ...b, paid: paidKeys.includes(b.key), due: dueNext.get(b.key) ?? null }))
    : [];
  function setPaid(key: string, paid: boolean, quiet = false) {
    if (!month) return;
    const keys = new Set(paidKeys);
    if (paid) keys.add(key);
    else keys.delete(key);
    // A yearly item paid in (or after) the month it's due starts its next year: due again in a year, total ÷ 12 a month.
    const item = (month.bills.items ?? []).find((b) => `item:${b.name}` === key);
    const base = paid && item?.yearly && monthsToDue(item.yearly.due, now) <= 1 ? rollYearly(month, item.name, now) : month;
    save({ ...base, paid: { period: pk, keys: [...keys] } } as MonthBudget);
    if (paid && !quiet) flash(t('{name} marked paid', { name: bills.find((b) => b.key === key)?.name ?? t('Bill') }));
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
      <ScrollView {...tourScroll.props} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
        {/* top */}
        <RiseIn style={styles.top}>
          <View style={styles.streak}>
            <Flame size={16} color={colors.muted} />
            <Text style={styles.streakText}>
              {streak > 0 ? <Text style={{ fontFamily: fonts.medium, color: colors.ink }}>{streak} </Text> : null}
              {streak > 0 ? (streak > 1 ? t('days logged') : t('day logged')) : t('Log today to start a streak')}
            </Text>
          </View>
          {totalSaved > 0 && (
            <Pressable style={styles.saved} hitSlop={8} onPress={() => router.push('/goals')} accessibilityRole="button" accessibilityLabel={t('{amount} saved in total', { amount: baht(totalSaved) })}>
              <Text style={styles.streakText}>
                <Text style={{ fontFamily: fonts.medium, color: colors.ink, fontVariant: ['tabular-nums'] }}>{baht(totalSaved)} </Text>
                {t('saved')}
              </Text>
              <CaretRight size={12} color={colors.muted} weight="bold" />
            </Pressable>
          )}
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
        <RiseIn delay={120} style={[styles.nums, stacked && styles.numsStacked]}>
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
              ref={tourSpot('today')}
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
              style={{ alignItems: stacked ? 'flex-start' : 'flex-end', flexShrink: 1 }}
              onPress={() => router.push('/history')}
              accessibilityRole="button"
              accessibilityLabel={t('{amount} spent today — see history', { amount: baht(spent.today) })}>
              <CountUp value={spent.today} format={Small} style={styles.n2} fit />
              <Text style={styles.l1}>{t('Spent today')}</Text>
              <Text style={styles.l2}>{t('Payday resets it')}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={{ alignItems: stacked ? 'flex-start' : 'flex-end', flexShrink: 1 }}
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

        {/* Kip: one line on Home; tap to read the whole thing. When Kip notices something, the line becomes a card. */}
        <RiseIn delay={240} style={{ paddingHorizontal: 20, marginTop: 16 }}>
          {kipDone ? (
            <KipDone text={kipDone.text} busy={noticeBusy} onUndo={undoNotice} />
          ) : notice ? (
            <KipNotice
              notice={notice}
              index={0}
              count={notices.length}
              busy={noticeBusy}
              isPlus={isPlus}
              onLocked={() => setSheet('talk')}
              onDo={() => doNotice(notice)}
              onLater={() => hide(notice.id, laterFor(notice, new Date()))}
            />
          ) : paydaySaved ? (
            <Squish style={styles.payday} onPress={() => router.push('/goals')} accessibilityRole="button">
              <Kip mood="celebrate" size={56} />
              <View style={{ flex: 1 }}>
                <Text style={styles.paydayTitle}>{t('Payday. {amount} went to {goal}', { amount: baht(goalPerMonth), goal: short })}</Text>
                <Text style={styles.paydayText}>
                  {goalDate ? t('{saved} saved, on track for {date}', { saved: baht(goal?.saved ?? 0), date: monthYear(goalDate) }) : t('{saved} saved so far', { saved: baht(goal?.saved ?? 0) })}
                </Text>
              </View>
            </Squish>
          ) : (
            <Squish style={styles.kipLine} onPress={() => setKipOpen(true)} accessibilityRole="button" accessibilityLabel={t('Kip says: {text}', { text: say })}>
              <KipStill size={32} />
              <Text style={styles.kipText} numberOfLines={2}>
                <Text style={styles.kipName}>Kip </Text>
                {say}
              </Text>
              <View style={styles.readBtn}>
                <Text style={styles.readText}>{t('Read')}</Text>
                <CaretRight size={12} color={colors.muted} weight="bold" />
              </View>
            </Squish>
          )}
        </RiseIn>

        {/* goal */}
        <RiseIn delay={300}>
          <Section title={goals.length > 1 ? t('Your goals') : goal?.kind === 'monthly' ? t('Your saving') : t('Your goal')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={322} decelerationRate="fast" style={styles.rowOuter} contentContainerStyle={styles.rowInner}>
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                g={{ ...g, perMonth: split.get(g.id) ?? 0, arrives: arrive.get(g.id) ?? null, added: split.get(g.id) ?? 0 }}
                width={Math.min(312, width - 60)}
                onPress={() => router.push('/goals')}
                accessibilityLabel={
                  g.kind === 'monthly'
                    ? t('{goal}, {amount} a month', { goal: g.title, amount: baht(split.get(g.id) ?? 0) })
                    : t('{goal}, {pct}% saved', { goal: g.title, pct: g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0 })
                }
              />
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

        {/* the pay month, small: spent so far against the plan's line. Tap for the whole chart. */}
        {spendBudget > 0 && (
          <RiseIn delay={300} style={{ paddingHorizontal: 20, marginTop: 28 }}>
            <Pressable ref={tourSpot('month')} style={styles.paceRow} onPress={() => setPaceOpen(true)} accessibilityRole="button" accessibilityLabel={t('This pay month — see the details')}>
              <View style={styles.paceHead}>
                <Text style={styles.weekLbl}>{t('This pay month')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.paceSpent}>{t('{amount} spent', { amount: baht(line.spent) })}</Text>
                  <CaretRight size={12} color={colors.muted} weight="bold" />
                </View>
              </View>
              <View style={styles.paceTrack}>
                <View style={[styles.paceFill, { width: `${Math.min(100, Math.max(2, (line.spent / spendBudget) * 100))}%`, backgroundColor: line.inside ? colors.limeDeep : colors.orange }]} />
                <View style={[styles.paceMark, { left: `${Math.min(100, Math.max(0, (planSoFar / spendBudget) * 100))}%` }]} />
              </View>
              <View style={styles.paceFoot}>
                <Text style={styles.paceNote}>{t('Plan so far {amount}', { amount: baht(planSoFar) })}</Text>
                <Text style={styles.paceNote}>{t('of {amount}', { amount: baht(spendBudget) })}</Text>
              </View>
            </Pressable>
          </RiseIn>
        )}

        <RiseIn delay={200} style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View ref={tourSpot('week')} collapsable={false}>
            <View style={styles.weekHead}>
              <Text style={styles.weekLbl}>{t('This week')}</Text>
              <Squish style={styles.calBtn} accessibilityRole="button" onPress={() => router.push('/calendar' as never)}>
                <CalendarBlank size={15} color={colors.ink} />
                <Text style={styles.calText}>{t('Full calendar')}</Text>
              </Squish>
            </View>
            <WeekStrip start={P.start} end={P.end} byDay={spent.byDay} daily={dailyPlan} selected={selectedDay} onSelect={(d) => setDayOpen(d)} now={now} />
          </View>
        </RiseIn>

        {/* Kip finding slips: only when there's something to set up or something new */}
        <SlipFinder isPlus={isPlus} />

        {/* left to spend */}
        <RiseIn delay={360}>
          <Section title={t('Left to spend')} right={t('Your saving plan')} onRight={() => router.push('/month')} caret />
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
                    <Image source={ICON3D[c.icon]} style={{ width: 84, height: 84 }} contentFit="contain" />
                  </Float>
                  <Text style={styles.plusTitle} numberOfLines={2}>
                    {c.title}
                  </Text>
                  <Text style={styles.plusTeaser} numberOfLines={2}>
                    {c.teaser}
                  </Text>
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
            <View ref={tourSpot('bills')} collapsable={false}>
              <Section title={t('Monthly bills')} right={t('{n} of {total} paid', { n: bills.filter((b) => b.paid).length, total: bills.length })} inset={false} />
              <BillStack bills={bills} onPaid={setPaid} />
            </View>
          </RiseIn>
        )}
      </ScrollView>

      {paceOpen && month && (
        <PaceSheet
          pace={line}
          budget={spendBudget}
          total={P.total}
          start={P.start}
          end={P.end}
          left={leftMonth}
          daysAfter={P.daysLeft - 1}
          perDayAfter={P.daysLeft > 1 ? Math.floor(leftMonth / (P.daysLeft - 1) / 10) * 10 : 0}
          cats={month.spend
            .map((x) => ({ key: x.key, spent: spent.byCat[x.key] ?? 0, budget: x.amount }))
            .filter((c) => c.spent > 0)
            .sort((a, b) => b.spent - a.spent)
            .slice(0, 3)}
          onCat={(k) => setCatOpen(k)}
          onClose={() => setPaceOpen(false)}
        />
      )}
      {recapOpen && month && (
        <RecapSheet
          recap={recapOpen}
          month={month}
          isPlus={isPlus}
          goalSaved={goal?.saved ?? 0}
          onApply={applySuggestion}
          onSkip={(sg) => hide(sg.id, sg.kind === 'sub' ? Date.now() + 365 * 86_400_000 : Date.now() + 40 * 86_400_000)}
          onLocked={() => {
            setRecapOpen(false);
            setSheet('talk');
          }}
          onClose={() => setRecapOpen(false)}
        />
      )}
      {dayOpen && <DaySheet day={dayOpen} {...dayOf(dayOpen)} daily={dailyPlan} onClose={() => setDayOpen(null)} />}
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
        ref={tourSpot('plus')}
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

      {/* First-use tour (approved mockup): once, after Home has loaded */}
      <Tour name="home" stops={homeTour} ready={Boolean(month) && !sheet} scrollBy={tourScroll.scrollBy} />

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
    paceRow: { borderRadius: 24, backgroundColor: colors.paper, paddingHorizontal: 20, paddingVertical: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.06)' },
    paceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    paceTrack: { height: 8, borderRadius: 4, backgroundColor: inkA(0.07) },
    paceFill: { height: 8, borderRadius: 4 },
    paceMark: { position: 'absolute', top: -4, width: 2, height: 16, borderRadius: 1, backgroundColor: colors.ink },
    paceFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    paceNote: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted, fontVariant: ['tabular-nums'] },
    saved: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40 },
    payday: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 28, backgroundColor: colors.paper, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.06)' },
    paydayTitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.ink },
    paydayText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
    paceSpent: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    weekLbl: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    kipLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingLeft: 12,
      paddingRight: 16,
      borderRadius: 24,
      backgroundColor: colors.paper,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.06)',
    },
    kipText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
    readBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4 },
    readText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
    nums: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, paddingHorizontal: 20, paddingTop: 20 },
    numsStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 14 },
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
    calBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.card, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    calText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
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
    plusIcon: { position: 'absolute', right: 2, top: -30 },
    plusTitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 20, color: colors.onSolid, maxWidth: 124 },
    plusTeaser: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: whiteA(0.62), marginTop: 4, maxWidth: 124 },
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
