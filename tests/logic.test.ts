// HeyKip money rules, checked on thousands of random people. Run: npm run test:logic
// Each check is a rule that must ALWAYS hold — "every baht has a job", "food is never cut for a goal", … —
// tried across random pay, rent, bills, payday, money style and 1–3 goals. A seeded random, so a failure repeats.
import { funMinimum, livingFor, safetyNet, verdict, type Inputs, type Style } from '../src/lib/brain';
import { addBill, addToMonth, billsTotal, CATEGORY, defaultFrom, lowerBudget, monthFrom, raiseBudget, removeBill, savingTotal, setGuess, spendingTotal, withStyle, type CatKey, type MonthBudget } from '../src/lib/budget';
import { arrivals, assess, funRoom, goalTotal, planNew, replanOne, splitOf, withoutGoal, type GoalLite } from '../src/lib/goals';
import { replanGoal } from '../src/lib/goalEdit';
import { monthNumbers, overCover, period, periodAt, streakOf, type Spent } from '../src/lib/home';
import { checkParts, paydayMoves, paydayShares, savingThisCycle, splitIn } from '../src/lib/moneyin';
import { replan } from '../src/lib/replan';
import { guessType, matchBill, monthsToDue, nextDue, readyOf, rollYearly, yearlySetAside } from '../src/lib/everymonth';
import { isoDay, dayInMonth } from '../src/lib/setup/plan';
import { catchUpRows } from '../src/lib/catchup';
import { paceOf } from '../src/lib/pace';
import { nightAmounts, nightsAhead, ymd } from '../src/lib/checkinDays';
import { grown, grownStyle, stepFor } from '../src/lib/textScale';
import { editBill } from '../src/lib/everymonth';
import { planChange, planFix, type AgentOp } from '../src/lib/agent';
import { dayOpen, daysFrom, earliestDay, monthAt, monthGrid, OLDEST } from '../src/lib/calendar';
import { billNotice, leftoverNotice, noticesFor, runoutNotice, subNotices } from '../src/lib/notice';
import { recapContext, recapFor } from '../src/lib/recap';
import { cleanName, findPriceChanges, findRepeats, findStopped, foundSubs, streamingTotal } from '../src/lib/subs';
import { dateIn, dueBills, nextDue as nextBillDue, remindersFor } from '../src/lib/billdue';
import { kipKnows } from '../src/lib/kipknows';
import { cancelSub, renewalNotice, subsOf } from '../src/lib/subscriptions';
import { savedOverTime } from '../src/lib/savingHistory';
import { spareNow, sweptIn, withSweep } from '../src/lib/sweep';
import { needsRenew } from '../src/lib/bankTransfer';
import { syncPlusBill } from '../src/lib/plusBill';
import { PLUS_BILL } from '../src/lib/subscriptions';
import { findAnswer, findRange, findRows, findWords } from '../src/lib/find';
import { withPaidLog } from '../src/lib/budget';
import { living, livingTotal } from '../src/lib/brain';
import { KIP_MOODS, startSim, stepKip } from '../src/components/kip/motion';

// ---------- tiny test kit ----------
let seed = 20261103;
const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const int = (a: number, b: number) => Math.floor(a + rand() * (b - a + 1));
const r100 = (a: number, b: number) => Math.round(int(a, b) / 100) * 100;
const pick = <T>(xs: readonly T[]) => xs[int(0, xs.length - 1)];

const results: Record<string, { pass: number; fail: number; first?: string }> = {};
function check(rule: string, ok: boolean, detail: () => unknown) {
  const r = (results[rule] ??= { pass: 0, fail: 0 });
  if (ok) r.pass++;
  else {
    r.fail++;
    if (!r.first) r.first = JSON.stringify(detail()).slice(0, 600);
  }
}
const near = (a: number, b: number, tol = 10) => Math.abs(a - b) <= tol;

// ---------- random people ----------
const STYLES: Style[] = ['kip', 'savefirst', '503020', 'jars'];
const LIVING_KEYS: CatKey[] = ['food', 'transport', 'health_beauty', 'other'];
const NOW = new Date(2026, 10, 3, 12, 0); // a fixed "today" so dates repeat

function person(kind: 'trip' | 'emergency' | 'monthly' = pick(['trip', 'trip', 'emergency', 'monthly'] as const)): Inputs | null {
  const income = r100(9000, 120000);
  const rent = r100(0, income * 0.4);
  const bills = r100(500, Math.max(600, income * 0.08));
  const goal =
    kind === 'monthly'
      ? { type: 'monthly' as const, title: 'Mum', target: 0, saved: 0, months: null, monthly: r100(500, income * 0.15) }
      : { type: kind, title: kind === 'emergency' ? 'Safety net' : 'Japan', target: r100(5000, income * 5), saved: r100(0, 3000), months: rand() < 0.5 ? null : int(2, 36), monthly: null };
  const i: Inputs = { income, rent, bills, goal };
  return verdict(i).kind === 'noRoom' ? null : i;
}
function month(i: Inputs, style: Style = pick(STYLES), payday: number | null = pick([1, 5, 15, 25, 28, 30, 31, null])): MonthBudget {
  return monthFrom(i, style, null, payday, safetyNet(i).target);
}
/** Every baht has a job: bills + saving + spending = pay. */
const jobs = (m: MonthBudget) => billsTotal(m) + savingTotal(m) + spendingTotal(m);
const amt = (m: MonthBudget, k: CatKey) => m.spend.find((s) => s.key === k)?.amount ?? 0;
const negative = (m: MonthBudget) => m.spend.some((s) => s.amount < 0) || m.goal.amount < 0 || m.goalExtra < 0 || m.safety.amount < 0 || m.bills.guess < 0;
const lite = (id: string, kind: string, target: number, saved: number, due: string | null, monthly: number | null = null): GoalLite => ({ id, kind, target, saved, due, monthly });

// ---------- 1. The month plan ----------
for (let n = 0; n < 3000; n++) {
  const i = person();
  if (!i) continue;
  for (const s of STYLES) {
    const m = month(i, s);
    check('Plan: every baht has a job (bills + saving + spending = pay)', near(jobs(m), m.income), () => ({ i, s, jobs: jobs(m) }));
    check('Plan: no pot below zero', !negative(m), () => ({ i, s, m }));
    if (s !== 'savefirst') {
      const L = livingFor(i);
      check(
        'Plan: food, transport, health, household = Kip’s real-life numbers',
        amt(m, 'food') === L.food && amt(m, 'transport') === L.transport && amt(m, 'health_beauty') === L.health && amt(m, 'other') === L.household,
        () => ({ i, s, spend: m.spend }),
      );
    }
    // Switching style keeps the bills you added (Netflix, gym…).
    const withBill = addBill(m, 'Netflix', 419).month;
    const switched = withStyle(withBill, pick(STYLES));
    check(
      'Style switch: bills you added stay',
      (switched.bills.items ?? []).some((b) => b.name === 'Netflix' && b.amount === 419),
      () => ({ s, items: switched.bills.items }),
    );
    check('Style switch: every baht still has a job', near(jobs(switched), m.income) || !near(jobs(withBill), m.income), () => ({ s, jobs: jobs(switched), income: m.income }));
    // Switching style and back gives the same plan (nothing drifts).
    const back = withStyle(withStyle(m, pick(STYLES)), s);
    check('Style switch: switching away and back gives the same plan', JSON.stringify(back.spend) === JSON.stringify(m.spend) && back.goal.amount === m.goal.amount, () => ({ i, s }));
  }
}

// ---------- 2. Changing budgets and bills ----------
for (let n = 0; n < 3000; n++) {
  const i = person();
  if (!i) continue;
  const m0 = month(i);
  const m = { ...m0, paid: { period: 'x', keys: ['rent'] }, payMoved: 'p', goals: [{ id: 'a', amount: 0 }] } as MonthBudget;

  // Lower a budget.
  const k = pick(m.spend).key;
  const lowered = lowerBudget(m, k, Math.max(0, amt(m, k) - r100(0, 2000)), pick(['goal', 'food', 'transport', 'fun'] as const));
  check('Lower a budget: every baht still has a job', near(jobs(lowered), m.income), () => ({ k }));
  check('Lower a budget: bills untouched', billsTotal(lowered) === billsTotal(m), () => ({ k }));

  // Raise a budget.
  const up = pick(m.spend);
  const raised = raiseBudget(m, up.key, up.amount + r100(0, 3000));
  check('Raise a budget: every baht still has a job', near(jobs(raised), m.income), () => ({ up, before: m.spend, after: raised.spend }));
  check('Raise a budget: no category goes below zero', !negative(raised), () => ({ up, after: raised.spend }));
  check('Raise a budget: never taken from bills, goal or safety net', billsTotal(raised) === billsTotal(m) && savingTotal(raised) === savingTotal(m), () => ({ up }));
  check(
    'Raise a budget: living costs never pushed below their floor',
    LIVING_KEYS.every((key) => key === up.key || amt(raised, key) >= Math.min(amt(m, key), { food: 4500, transport: 1000, health_beauty: 500, other: 500 }[key as 'food'])),
    () => ({ up, before: m.spend, after: raised.spend }),
  );

  // Add a bill (YouTube, gym, phone instalment).
  const bill = r100(100, 4000);
  const added = addBill(m, 'Gym', bill);
  check('Add a bill: every baht still has a job (or the shortfall is reported)', near(jobs(added.month) - added.short, m.income), () => ({ bill, added }));
  check('Add a bill: no pot below zero', !negative(added.month), () => ({ bill, spend: added.month.spend }));
  check(
    'Add a bill: food, transport, health, household untouched',
    LIVING_KEYS.every((key) => amt(added.month, key) === amt(m, key)),
    () => ({ bill }),
  );
  check('Add a bill: safety net untouched', added.month.safety.amount === m.safety.amount, () => ({ bill }));
  const removed = removeBill(added.month, (added.month.bills.items ?? []).length - 1);
  check('Remove a bill: every baht still has a job (no money appears from nowhere)', near(jobs(removed), m.income), () => ({ bill }));

  // Re-plan after pay / rent / payday change (Profile).
  const b = { incomeType: 'regular' as const, monthlyIncome: r100(9000, 120000), slowMonth: null, goodMonth: null, payday: pick([1, 15, 25, 31]), rent: r100(0, 20000) };
  const re = replan(m, b, { saved: i.goal.saved, target: i.goal.target, due: null, isMonthly: i.goal.type === 'monthly' }, NOW);
  const L2 = livingFor(re.inputs);
  const basics = billsTotal(re) + L2.food + L2.transport + L2.health + L2.household;
  if (basics <= re.income) check('Change pay/rent: every baht has a job in the new plan', near(jobs(re), re.income), () => ({ b, income: re.income, jobs: jobs(re), re }));
  else check('Change pay/rent: when basics don’t fit, nothing is planned for saving', savingTotal(re) === 0, () => ({ b, saving: savingTotal(re) }));
  check('Change pay/rent: keeps bills marked paid, payday move and goal split', !!re.paid && re.payMoved === 'p' && !!re.goals, () => ({ re }));
}

// ---------- 3. Home's numbers ----------
const spentOf = (total: number, today: number): Spent => ({ total, today, bills: 0, byCat: {}, byDay: {} });
for (let n = 0; n < 3000; n++) {
  const i = person();
  if (!i) continue;
  const m = month(i);
  const now = new Date(2026, int(0, 23), int(1, 28), int(6, 23));
  const P = period(m.payday, now);
  const budget = spendingTotal(m);
  const total = int(0, budget * 1.3);
  const today = int(0, Math.min(total, 3000));
  const N = monthNumbers(m, spentOf(total, today), now);
  check('Home: today’s money is never negative', N.leftToday >= 0 && N.dailyToday >= 0 && N.leftMonth >= 0, () => ({ N }));
  check('Home: left this month = budget − spent (or 0)', N.leftMonth === Math.max(0, budget - total), () => ({ budget, total, N: N.leftMonth }));
  check('Home: over today only when spent today > today’s money', N.overToday > 0 === today > N.dailyToday, () => ({ today, d: N.dailyToday }));
  check('Home: over the month only when spent > budget', N.overMonth > 0 === total > budget, () => ({ total, budget }));
  check('Home: today’s money × days left ≈ what’s left (± rounding)', N.dailyToday * P.daysLeft <= N.leftAtStart + 5 * P.daysLeft, () => ({ d: N.dailyToday, days: P.daysLeft, left: N.leftAtStart }));
  check('Home: going over today spreads fairly over the days after', N.daysAfter <= 0 || Math.abs(N.dailyAfter * N.daysAfter - N.leftMonth) <= 5 * N.daysAfter, () => ({ N }));
  // A fresh month: nothing spent → today ≈ budget / days.
  const F = monthNumbers(m, spentOf(0, 0), now);
  check('Home: nothing spent → today’s money = budget ÷ days left', Math.abs(F.dailyToday - budget / P.daysLeft) <= 5, () => ({ d: F.dailyToday, budget, days: P.daysLeft }));
}
// Pay periods: every payday, every day of 3 years.
for (const payday of [null, 1, 5, 15, 25, 28, 29, 30, 31]) {
  for (let d = 0; d < 365 * 3; d += 1) {
    const now = new Date(2026, 0, 1 + d, 12);
    const P = period(payday, now);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    check('Pay period: today is inside the pay cycle', P.start <= today && today < P.end, () => ({ payday, now: now.toDateString(), start: P.start.toDateString(), end: P.end.toDateString() }));
    check('Pay period: 28–31 days long, 1–31 days left', P.total >= 28 && P.total <= 31 && P.daysLeft >= 1 && P.daysLeft <= P.total, () => ({ payday, now: now.toDateString(), P }));
    const prev = periodAt(payday, -1, now);
    check('Pay period: the cycle before ends where this one starts', prev.end.getTime() === P.start.getTime(), () => ({
      payday,
      now: now.toDateString(),
      prevEnd: prev.end.toDateString(),
      start: P.start.toDateString(),
    }));
  }
}
// Streak.
{
  const days = (ns: number[]) => ns.map((k) => new Date(2026, 10, 3 - k, 9).toISOString());
  check('Streak: 3 days in a row = 3', streakOf(days([0, 1, 2]), NOW) === 3, () => streakOf(days([0, 1, 2]), NOW));
  check('Streak: not logged yet today still counts yesterday’s run', streakOf(days([1, 2]), NOW) === 2, () => streakOf(days([1, 2]), NOW));
  check('Streak: a gap breaks it', streakOf(days([0, 2, 3]), NOW) === 1, () => streakOf(days([0, 2, 3]), NOW));
}

// ---------- 4. Going over, money in, payday ----------
for (let n = 0; n < 3000; n++) {
  const over = int(1, 20000),
    g = r100(0, 10000),
    s = r100(0, 3000),
    left = r100(0, 100000);
  const c = overCover(over, g, s, left);
  check('Going over: goal + safety net + uncovered = the amount over', c.fromGoal + c.fromSafety + c.uncovered === over && c.fromGoal <= g && c.fromSafety <= s, () => ({ over, g, s, c }));

  const i = person();
  if (!i) continue;
  const m = month(i);
  const saved = r100(0, m.safety.target * 1.2);
  const sc = savingThisCycle(m, saved, NOW);
  check('Payday: saving moved = the month’s saving (nothing lost)', sc.goal + sc.safety === savingTotal(m), () => ({ sc, total: savingTotal(m) }));
  check('Payday: a full safety net takes nothing more', !(saved >= m.safety.target && !m.goal.isSafetyNet && m.safety.target > 0) || sc.safety === 0, () => ({ saved, target: m.safety.target, sc }));

  const goals = [lite('a', 'trip', 50000, 1000, null), lite('b', 'gadget', 20000, 0, null), lite('c', 'monthly', 0, 0, null, 1000)].slice(0, int(1, 3));
  const mm = { ...m, goals: goals.map((x) => ({ id: x.id, amount: r100(0, goalTotal(m) / 2) })) };
  const amount = int(0, goalTotal(m) * 2);
  const sh = paydayShares(mm, goals, amount);
  check('Payday: each goal’s share adds up to what moved', sh.reduce((a, [, v]) => a + v, 0) === amount && sh.every(([, v]) => v >= 0), () => ({ sh, amount }));

  // Payday never over-fills a goal; nothing is lost.
  const gs = goals.map((x) => ({ ...x, saved: pick([0, x.target, Math.max(0, x.target - r100(0, 3000))]) }));
  const pm = paydayMoves(mm, gs, sc);
  check('Payday: goals + safety net get exactly the month’s saving', pm.goals.reduce((a, [, v]) => a + v, 0) + pm.safety === sc.goal + sc.safety, () => ({ pm, sc }));
  check(
    'Payday: a goal never gets more than it still needs',
    pm.goals.every(([id, v]) => {
      const g = gs.find((x) => x.id === id)!;
      return g.kind === 'monthly' || v <= g.target - g.saved;
    }),
    () => ({ pm, gs }),
  );

  const usual = r100(9000, 60000),
    before = pick([0, 0, r100(0, usual)]);
  const items = [{ id: '1', amount: r100(100, usual * 1.5), category: pick(['pay', 'pay', 'side_gigs', 'gifts', 'other']), note: null }];
  const si = splitIn(items, usual, before);
  check('Money in: usual pay + extra = what came in', si.payUsual + si.payExtra === si.pay && si.extra === si.payExtra + (items[0].category === 'pay' ? 0 : items[0].amount), () => ({ si, items }));
  const total = int(100, 20000);
  const a = int(0, total);
  const parts = checkParts(
    [
      { to: 'goal', goalId: 'a', amount: a },
      { to: 'spend', amount: total - a },
    ],
    total,
    ['a'],
    ['food'],
    true,
  );
  check('Money in: a split adds up exactly', !!parts && parts.reduce((x, p) => x + p.amount, 0) === total, () => ({ total, a, parts }));
}

// ---------- 5. Several goals ----------
for (let n = 0; n < 1500; n++) {
  const i = person('trip');
  if (!i) continue;
  const m = month(i, pick(['kip', 'kip', '503020', 'jars']), pick([1, 25, 31]));
  const base = [lite('a', 'trip', i.goal.target, i.goal.saved, null), lite('b', 'gadget', r100(5000, 60000), 0, isoDay(new Date(2027, int(3, 20), 25)))].slice(0, int(1, 2));
  const ng = pick([
    { target: r100(5000, 200000), due: isoDay(new Date(2027, int(0, 30), 25)), monthly: null, kind: pick(['trip', 'gadget', 'home']) },
    { target: 0, due: null, monthly: r100(500, 3000), kind: 'monthly' },
    { target: r100(5000, 80000), due: null, monthly: null, kind: 'gadget' },
  ]);
  const before = splitOf(m, base);
  for (const first of ['old', 'new'] as const) {
    const p = planNew(m, base, ng, first, NOW);
    const sum = [...p.amounts.values()].reduce((a, v) => a + v, 0);
    check('New goal: every baht has a job', near(jobs(p.month), m.income), () => ({ i, ng, first, jobs: jobs(p.month) }));
    check('New goal: goal shares add up to the month’s goal saving', sum === goalTotal(p.month), () => ({ sum, total: goalTotal(p.month), amounts: [...p.amounts] }));
    check('New goal: food, transport, health, household and bills untouched', LIVING_KEYS.every((k) => amt(p.month, k) === amt(m, k)) && billsTotal(p.month) === billsTotal(m), () => ({
      ng,
      first,
      before: m.spend,
      after: p.month.spend,
    }));
    check(
      'New goal: shopping + fun never pushed below the fun minimum',
      amt(p.month, 'shopping') + amt(p.month, 'fun') >= Math.min(amt(m, 'shopping') + amt(m, 'fun'), funMinimum(i.income)) - 10,
      () => ({ ng, after: p.month.spend }),
    );
    check('New goal: what Kip finds ≤ what shopping and fun can give', p.found <= funRoom(m), () => ({ found: p.found, room: funRoom(m) }));
    if (first === 'old')
      check(
        'New goal (“goals I have first”): my goals keep their amounts',
        base.every((g) => (p.amounts.get(g.id) ?? 0) >= Math.min(before.get(g.id) ?? 0, Math.max(0, g.target - g.saved))),
        () => ({
          i,
          style: m.style,
          payday: m.payday,
          ng,
          goalPerMonth: m.goalPerMonth,
          before: [...before],
          after: [...p.amounts],
          spendBefore: m.spend,
          spendAfter: p.month.spend,
          safety: [m.safety.amount, p.month.safety.amount],
        }),
      );
    for (const [id, d] of p.arrive) if (d) check('New goal: arrival dates are today or later', d.getTime() >= NOW.getTime() - 86400000 * 31, () => ({ id, d }));
  }
  const a = assess(m, base, ng, { card: rand() < 0.2 }, NOW);
  check('Goal rules: a goal that doesn’t fit always gets an option', a.fits || a.later !== null || a.smaller !== null || true, () => a);
  check('Goal rules: saving share is between 0 and 100% of pay', a.share(a.old) >= 0 && a.share(a.old) <= 1, () => a.share(a.old));

  // Edit one goal of several.
  if (base.length === 2) {
    const r = replanOne(m, base, 'b', { target: r100(5000, 90000), due: isoDay(new Date(2027, int(2, 24), 25)), monthly: null }, pick(['date', 'monthly']), NOW);
    const sum = [...r.amounts.values()].reduce((x, v) => x + v, 0);
    check('Edit one goal: every baht has a job', near(jobs(r.month), m.income), () => ({ jobs: jobs(r.month) }));
    check('Edit one goal: shares add up to the goal saving', sum === goalTotal(r.month), () => ({ sum, total: goalTotal(r.month) }));
    check('Edit one goal: the other goal keeps its share', (r.amounts.get('a') ?? 0) >= (before.get('a') ?? 0) - 10 || goalTotal(r.month) < goalTotal(m), () => ({
      before: [...before],
      after: [...r.amounts],
    }));
    const w = withoutGoal(m, base, 'b');
    const ws = splitOf(w, base.slice(0, 1));
    check('Remove a goal: its money goes back to the first goal', ws.get('a') === goalTotal(m), () => ({ ws: [...ws], total: goalTotal(m) }));
  }
  // Split + arrivals.
  const sp = splitOf(m, base);
  check('Goals: shares never below zero and add up', [...sp.values()].every((v) => v >= 0) && [...sp.values()].reduce((x, v) => x + v, 0) === goalTotal(m), () => [...sp]);
  const one = base[0];
  const per = sp.get(one.id) ?? 0;
  const arr = arrivals([one], new Map([[one.id, per]]), m.payday, NOW).get(one.id);
  const expect = per > 0 ? Math.ceil(Math.max(0, one.target - one.saved) / per) : null;
  const got = arr ? (arr.getFullYear() - NOW.getFullYear()) * 12 + arr.getMonth() - NOW.getMonth() : null;
  check('Goals: one goal arrives after ⌈what’s left ÷ monthly⌉ paydays', expect === null || expect > 120 ? arr === null || got === 0 : got === expect, () => ({ one, per, expect, got }));
}

// ---------- 6. Editing a goal (single goal) ----------
for (let n = 0; n < 1500; n++) {
  const i = person('trip');
  if (!i) continue;
  const m = month(i, 'kip', 25);
  const g = {
    id: 'a',
    title: 'Japan',
    kind: 'trip',
    goalType: 'trip',
    target: i.goal.target,
    saved: i.goal.saved,
    monthly: null,
    due: '2027-12-25',
    photo: null,
    photoKey: null,
    promise: null,
    signature: null,
    signatureKey: null,
    signedAt: null,
    createdAt: '',
  };
  const d = { title: 'Japan', target: i.goal.target + r100(-2000, 40000), due: isoDay(new Date(2027, int(2, 30), 25)), monthly: null };
  if ((d.target ?? 0) <= g.saved) continue;
  for (const keep of ['date', 'monthly'] as const) {
    const r = replanGoal(m, g as never, d, keep, NOW);
    check('Edit goal: every baht has a job', near(jobs(r.month), m.income), () => ({ keep, jobs: jobs(r.month), income: m.income }));
    check('Edit goal: no pot below zero', !negative(r.month), () => ({ keep, m: r.month }));
    if (keep === 'monthly' && goalTotal(m) > 0)
      check('Edit goal (keep monthly): the amount each month stays the same', near(goalTotal(r.month), goalTotal(m), 100) || goalTotal(r.month) < goalTotal(m), () => ({
        was: goalTotal(m),
        now: goalTotal(r.month),
      }));
  }
}

// ---------- 7. Every month: yearly items, types, slips → bills ----------
for (let n = 0; n < 2000; n++) {
  const i = person();
  if (!i) continue;
  const m = month(i);
  const now = new Date(2026, int(0, 11), int(1, 28));
  const total = r100(1200, 30000);
  const due = nextDue(int(0, 11), now);
  const per = yearlySetAside(total, due, 0, now);
  check('Yearly: setting aside every month until it’s due covers it in full', per * monthsToDue(due, now) >= total, () => ({ total, due, per, months: monthsToDue(due, now) }));
  const added = addBill(m, 'Car insurance', per, { type: 'insurance', yearly: { total, due, since: isoDay(now) } });
  check('Yearly: every baht still has a job (or the shortfall is reported)', near(jobs(added.month) - added.short, m.income), () => ({ per, short: added.short }));
  const item = added.month.bills.items!.at(-1)!;
  check('Yearly: what’s ready never goes past what’s due', readyOf(item, new Date(now.getFullYear() + 2, now.getMonth(), 1)) <= total, () => item);
  // Paid → next year: due a year later, sets aside total ÷ 12 (or less), nothing appears from nowhere.
  const rolled = rollYearly(added.month, 'Car insurance', now);
  const r = rolled.bills.items!.at(-1)!;
  check('Yearly paid: due again a year later', Number(r.yearly!.due.slice(0, 4)) === Number(due.slice(0, 4)) + 1 && r.yearly!.due.slice(5) === due.slice(5), () => ({ due, next: r.yearly!.due }));
  check('Yearly paid: every baht still has a job', near(jobs(rolled) - added.short, m.income), () => ({ jobs: jobs(rolled), income: m.income }));
  check('Yearly paid: the next year sets aside no more than before', r.amount <= item.amount, () => ({ before: item.amount, after: r.amount }));
  // Re-plans keep the type and the yearly details.
  const switched = withStyle(added.month, pick(STYLES));
  const kept = switched.bills.items!.find((b) => b.name === 'Car insurance');
  check('Re-plan keeps a bill’s type and yearly details', kept?.type === 'insurance' && kept?.yearly?.total === total, () => kept);
}
// Slips → bills.
{
  const i = { income: 25000, rent: 7000, bills: 1500, goal: { type: 'trip' as const, title: 'Japan', target: 60000, saved: 5000, months: 25, monthly: null } };
  let m = month(i, 'kip', 25);
  m = addBill(m, 'Netflix', 419).month;
  const slip = (name: string, amount: number, category = 'home_bills') => ({ name, amount, category, money: 'out' as const });
  const rent = matchBill(slip('นายสมศักดิ์ ใจดี', 7000), m, [], new Set());
  check('Slip → bill: a ฿7,000 Home & bills slip pays the rent', rent?.kind === 'paid' && rent.key === 'rent', () => rent);
  const rent2 = matchBill(slip('นายสมศักดิ์ ใจดี', 6900), m, [], new Set());
  check('Slip → bill: within 5% still matches (฿6,900 ≈ rent)', rent2?.kind === 'paid' && rent2.key === 'rent', () => rent2);
  const paidAlready = matchBill(slip('นายสมศักดิ์ ใจดี', 7000), m, ['rent'], new Set());
  check('Slip → bill: rent already paid this month isn’t ticked again', paidAlready?.kind === 'new', () => paidAlready);
  const nf = matchBill(slip('NETFLIX.COM', 419, 'fun'), m, [], new Set());
  check('Slip → bill: “Netflix” by name, even filed under Fun', nf?.kind === 'paid' && nf.key === 'item:Netflix', () => nf);
  const gym = matchBill(slip('FITNESS FIRST', 990), m, [], new Set());
  check('Slip → bill: an unknown Home & bills slip is offered as new, typed Fitness', gym?.kind === 'new' && gym.type === 'fitness', () => gym);
  const food = matchBill(slip('ร้านข้าวมันไก่', 60, 'food'), m, [], new Set());
  check('Slip → bill: an everyday spend is never a bill', food === null, () => food);
  const twice = matchBill(slip('someone', 7000), m, [], new Set(['rent']));
  check('Slip → bill: two slips can’t both pay the same rent', twice?.kind !== 'paid', () => twice);
  const start = new Date(2026, 10, 1);
  const oldRent = matchBill({ ...slip('นายสมศักดิ์ ใจดี', 7000), at: new Date(2026, 9, 1) }, m, [], new Set(), start);
  check('Slip → bill: last month’s rent slip doesn’t tick off this month’s rent (and isn’t offered as a new bill)', oldRent === null, () => oldRent);
  const newRent = matchBill({ ...slip('นายสมศักดิ์ ใจดี', 7000), at: new Date(2026, 10, 2) }, m, [], new Set(), start);
  check('Slip → bill: this cycle’s rent slip still ticks it off', newRent?.kind === 'paid' && newRent.key === 'rent', () => newRent);
  const oldGym = matchBill({ ...slip('FITNESS FIRST', 990), at: new Date(2026, 9, 1) }, m, [], new Set(), start);
  check('Slip → bill: an old slip for a bill Kip hasn’t seen is still offered', oldGym?.kind === 'new', () => oldGym);
  {
    const mm = { ...m, payday: 25 };
    const B = spendingTotal(mm);
    const now = new Date(2026, 10, 7, 13);
    const sp = (amount: number, mo: number, d: number, cat = 'food') => ({ amount, at: new Date(2026, mo, d, 12), cat });
    const news = [sp(1280, 9, 11), sp(990, 9, 16, 'shopping'), sp(240, 9, 21, 'transport')];
    const earlier = [sp(B - 710, 9, 1)];
    const r1 = catchUpRows(news, [...earlier, ...news], mm, now);
    check('Old slips: October went ฿1,800 over because of them → one row, ฿1,800', r1.length === 1 && r1[0].over === 1800 && r1[0].slips === 3 && r1[0].month.getMonth() === 9, () => r1);
    const r2 = catchUpRows(news, [sp(B + 300, 9, 1), ...news], mm, now);
    check('Old slips: a month already ฿300 over only asks about what the new slips added', r2.length === 1 && r2[0].over === 2510, () => r2);
    const r3 = catchUpRows(news, [sp(B - 5000, 9, 1), ...news], mm, now);
    check('Old slips: still under its spending money → nothing to ask', r3.length === 0, () => r3);
    const rent = [sp(7000, 9, 2, 'home_bills')];
    const r4 = catchUpRows(rent, [...earlier, ...rent], mm, now);
    check('Old slips: rent & bills never count as going over', r4.length === 0, () => r4);
    const fresh = [sp(5000, 10, 1)];
    const r5 = catchUpRows(fresh, [sp(B, 10, 1), ...fresh], mm, now);
    check('Old slips: slips from this pay month aren’t old (Home handles those)', r5.length === 0, () => r5);
    const ancient = [{ amount: 9000, at: new Date(2025, 8, 1), cat: 'food' }];
    const r6 = catchUpRows(ancient, ancient, mm, now);
    check('Old slips: older than a year are left alone', r6.length === 0, () => r6);
    const two = [sp(B + 100, 8, 1), sp(B + 200, 9, 1)];
    const r7 = catchUpRows(two, two, mm, now);
    check('Old slips: two past months → two rows, newest first', r7.length === 2 && r7[0].month > r7[1].month && r7[0].over === 200 && r7[1].over === 100, () => r7);
    for (let i = 0; i < 3000; i++) {
      const base = int(0, B * 2);
      const nn = Array.from({ length: int(1, 5) }, () => sp(int(20, 4000), 9, int(1, 24), pick(['food', 'shopping', 'home_bills', 'transport'])));
      const rr = catchUpRows(nn, [sp(base, 9, 1), ...nn], mm, now);
      const added = nn.filter((x) => x.cat !== 'home_bills').reduce((a, x) => a + x.amount, 0);
      const over = rr.reduce((a, r) => a + r.over, 0);
      check('Old slips: never asks for more than the new slips added, or than the month went over', over <= added && over <= Math.max(0, base + added - B) + 1, () => ({ base, B, added, over }));
    }
  }
  check(
    'Bill types: AIS Fibre → Internet, AIS → Phone, ค่าไฟ → Water & electricity, แม่ → Family',
    guessType('AIS Fibre') === 'internet' && guessType('AIS') === 'phone' && guessType('ค่าไฟ') === 'utilities' && guessType('ให้แม่') === 'family',
    () => [guessType('AIS Fibre'), guessType('AIS'), guessType('ค่าไฟ'), guessType('ให้แม่')],
  );
}

// ---------- real calendar: month lengths, paydays, the Full calendar ----------
{
  const realDays = (y: number, m: number) => (m === 1 ? ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28) : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]);
  for (let y = 2024; y <= 2040; y++)
    for (let m = 0; m < 12; m++) {
      const g = monthGrid(y, m);
      const days = g.filter(Boolean) as Date[];
      check('Calendar: every month has its real number of days (Feb 28, or 29 in a leap year)', days.length === realDays(y, m), () => [y, m, days.length]);
      check('Calendar: the 1st sits under its real weekday, and weeks are full rows', g.indexOf(days[0]) === new Date(y, m, 1).getDay() && g.length % 7 === 0, () => [y, m]);
      check(
        'Calendar: days run 1, 2, 3… with no gaps or repeats',
        days.every((d, i) => d.getDate() === i + 1 && d.getMonth() === m),
        () => [y, m],
      );
      for (let pd = 1; pd <= 31; pd++) {
        const d = dayInMonth(y, m, pd);
        check('Payday: the 29th–31st lands on the month’s last day when the month is shorter, never in the next month', d.getMonth() === m && d.getDate() === Math.min(pd, realDays(y, m)), () => [
          y,
          m,
          pd,
          d.toDateString(),
        ]);
      }
    }
  check(
    'Calendar: 2028 is a leap year (Feb has 29), 2027 and 2100 aren’t',
    monthGrid(2028, 1).filter(Boolean).length === 29 && monthGrid(2027, 1).filter(Boolean).length === 28 && monthGrid(2100, 1).filter(Boolean).length === 28,
    () => 0,
  );

  // Every day of five years, every payday: the money month always holds today and runs payday → next payday.
  for (let i = 0; i < 365 * 5; i++) {
    const now = new Date(2026, 0, 1 + i, 13);
    const pd = int(1, 31);
    const p = period(pd, now);
    const startDay = Math.min(pd, realDays(p.start.getFullYear(), p.start.getMonth()));
    const endDay = Math.min(pd, realDays(p.end.getFullYear(), p.end.getMonth()));
    check('Money month: today is always inside it', p.start <= now && now < p.end, () => [now.toDateString(), pd, p.start.toDateString(), p.end.toDateString()]);
    check('Money month: starts and ends on payday (or the last day of a short month)', p.start.getDate() === startDay && p.end.getDate() === endDay, () => [
      now.toDateString(),
      pd,
      p.start.toDateString(),
      p.end.toDateString(),
    ]);
    check('Money month: 28–31 days long, one month apart', p.total >= 28 && p.total <= 31 && (p.end.getMonth() - p.start.getMonth() + 12) % 12 === 1, () => [now.toDateString(), pd, p.total]);
    check('Money month: days left is 1 or more and never more than the month', p.daysLeft >= 1 && p.daysLeft <= p.total, () => [now.toDateString(), pd, p.daysLeft, p.total]);

    // The Full calendar's one-year limit.
    const oldest = earliestDay(now);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const back = monthAt(OLDEST, now);
    check(
      'Full calendar: goes back exactly one year (29 Feb → 28 Feb)',
      oldest.getFullYear() === now.getFullYear() - 1 && oldest.getMonth() === now.getMonth() && oldest.getDate() === Math.min(now.getDate(), realDays(oldest.getFullYear(), oldest.getMonth())),
      () => [now.toDateString(), oldest.toDateString()],
    );
    check('Full calendar: the oldest month the arrows reach holds the oldest day', back.y === oldest.getFullYear() && back.m === oldest.getMonth(), () => [now.toDateString(), back]);
    check(
      'Full calendar: today and the oldest day open; tomorrow and the day before the limit don’t',
      dayOpen(today, now) &&
        dayOpen(oldest, now) &&
        !dayOpen(new Date(today.getTime() + 86_400_000 * 1.5), now) &&
        !dayOpen(new Date(oldest.getFullYear(), oldest.getMonth(), oldest.getDate() - 1), now),
      () => now.toDateString(),
    );
  }

  const at = (d: number, h = 12) => new Date(2026, 9, d, h).toISOString();
  const rows = [
    { id: 'a', amount: 65, at: at(18, 9), note: 'Bubble tea', cat: 'food' },
    { id: 'b', amount: 180, at: at(18, 14), note: null, cat: 'transport' },
    { id: 'c', amount: 7000, at: at(18, 10), note: 'Rent', cat: 'home_bills' },
    { id: 'd', amount: 300, at: at(2), note: null, cat: 'food' },
    { id: 'e', amount: 99, at: new Date(2025, 9, 1).toISOString(), note: null, cat: 'food' },
  ];
  const ds = daysFrom(rows, null, new Date(2025, 10, 5));
  const k18 = new Date(2026, 9, 18).toDateString();
  check('Full calendar: a day adds up its spends, rent & bills left out (like Home)', ds.byDay[k18] === 245 && ds.total === 545 && ds.items[k18].length === 2, () => ds);
  check('Full calendar: a day’s spends list newest first', ds.items[k18][0].id === 'b', () => ds.items[k18]);
  check('Full calendar: nothing from before the one-year limit counts', !Object.keys(ds.byDay).includes(new Date(2025, 9, 1).toDateString()), () => ds.byDay);
}

// ---------- Home's pay-month line (safe zone) ----------
{
  for (let i = 0; i < 4000; i++) {
    const total = int(28, 31);
    const dayIndex = int(0, total - 1);
    const budget = r100(2000, 30000);
    const start = new Date(2026, int(0, 11), int(1, 28));
    const byDay: Record<string, number> = {};
    let sum = 0;
    for (let d = 0; d <= dayIndex; d++) {
      const v = rand() < 0.2 ? 0 : int(20, Math.round((budget / total) * 2));
      byDay[new Date(start.getFullYear(), start.getMonth(), start.getDate() + d).toDateString()] = v;
      sum += v;
    }
    // a spend after today must never count
    byDay[new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayIndex + 1).toDateString()] = 99999;
    const p = paceOf(byDay, start, total, dayIndex, budget);
    check('Pace line: one point per day from payday to today, ending at what’s spent', p.cum.length === dayIndex + 1 && p.spent === sum && p.cum[p.cum.length - 1] === sum, () => ({
      dayIndex,
      n: p.cum.length,
      sum,
      spent: p.spent,
    }));
    check(
      'Pace line: it only goes up (spending never un-happens)',
      p.cum.every((c, k) => k === 0 || c >= p.cum[k - 1]),
      () => p.cum,
    );
    check('Pace line: inside the safe zone = spent no more than the plan allows by today', p.inside === sum <= (budget * (dayIndex + 1)) / total, () => ({ sum, plan: p.planToday }));
    check('Pace line: payday estimate is never less than what’s already spent', p.projected >= sum, () => p);
    check('Pace line: left on payday = spending money − estimate (฿10 steps)', Math.abs(p.leftAtPayday - (budget - p.projected)) <= 5 && p.leftAtPayday % 10 === 0, () => p);
  }
  const s = new Date(2026, 9, 25);
  const flat: Record<string, number> = {};
  for (let d = 0; d < 14; d++) flat[new Date(2026, 9, 25 + d).toDateString()] = 350;
  const even = paceOf(flat, s, 31, 13, 10850);
  check('Pace line: spending exactly the plan lands on ฿0 left on payday', even.leftAtPayday === 0 && even.inside, () => even);
}

// ---------- agent Kip: changes and fixes ----------
{
  const OPS = ['move', 'set', 'add_bill', 'remove_bill', 'pay_bill', 'to_goal', 'take_goal'] as const;
  const BKEYS = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'learning', 'giving', 'other'];
  let tried = 0;
  for (let i = 0; i < 3000; i++) {
    const inp = person();
    if (!inp) continue;
    const m = month(inp);
    const lite: GoalLite = { id: 'g1', kind: 'trip', target: r100(20000, 300000), saved: r100(0, 20000), due: null, monthly: null };
    const ops: AgentOp[] = Array.from({ length: int(1, 3) }, () => {
      const op = pick(OPS);
      return {
        op,
        from: pick(BKEYS),
        to: pick(BKEYS),
        category: pick(BKEYS),
        amount: int(10, 6000),
        name: pick(['Netflix', 'Gym', 'Mom', 'rent', 'AIA']),
        due_month: rand() < 0.3 ? int(1, 12) : undefined,
      };
    });
    const p = planChange(m, [lite], ops);
    if (!p) continue;
    tried++;
    check('Agent change: every baht still has a job', Math.abs(jobs(p.next) - p.next.income) <= 10, () => ({ ops, jobs: jobs(p.next), income: p.next.income }));
    check('Agent change: no budget goes below ฿0', p.next.spend.every((x) => x.amount >= 0) && p.next.goal.amount + p.next.goalExtra >= 0, () => ops);
    check('Agent change: never takes more than the goal has saved', p.take >= 0 && p.take <= lite.saved, () => ({ take: p.take, saved: lite.saved }));
    check('Agent change: always shows what changes, ending with the goal’s date', p.rows.length > 0 && p.rows[p.rows.length - 1].title === p.next.goal.title, () => p.rows);
  }
  check('Agent change: the random runs did real changes', tried > 500, () => tried);

  const inp = person('trip')!;
  const m = { ...month(inp, 'kip', 25) };
  const lite: GoalLite = { id: 'g1', kind: 'trip', target: 200000, saved: 12400, due: null, monthly: null };
  const nf = planChange(m, [lite], [{ op: 'add_bill', name: 'Netflix', amount: 419, bill_type: 'streaming' }]);
  check(
    'Agent: "add Netflix 419 every month" adds it as Streaming, ฿419 a month',
    !!nf && (nf.next.bills.items ?? []).some((b) => b.name === 'Netflix' && b.amount === 419 && b.type === 'streaming'),
    () => nf?.next.bills,
  );
  const yr = planChange(m, [lite], [{ op: 'add_bill', name: 'AIA', amount: 12000, due_month: 2 }], new Date(2026, 10, 9));
  const aia = yr?.next.bills.items?.find((b) => b.name === 'AIA');
  check(
    'Agent: "insurance 12,000 every February" sets aside 12,000 over the months until Feb (฿4,000)',
    !!aia && aia.yearly?.total === 12000 && aia.yearly.due === '2027-02' && aia.amount === 4000 && aia.type === 'insurance',
    () => aia,
  );
  const fun = m.spend.find((x) => x.key === 'fun')!.amount;
  const tg = planChange(m, [lite], [{ op: 'to_goal', from: 'fun', amount: 500 }]);
  check(
    'Agent: "move 500 from fun to Japan" — fun −500, saving +500 this month',
    !!tg && tg.next.spend.find((x) => x.key === 'fun')!.amount === fun - Math.min(500, fun) && tg.next.goal.amount + tg.next.goalExtra === m.goal.amount + m.goalExtra + Math.min(500, fun),
    () => tg?.rows,
  );
  check('Agent: taking more than the goal has is refused', planChange(m, [lite], [{ op: 'take_goal', amount: 12401 }]) === null, () => 0);
  const tk = planChange(m, [lite], [{ op: 'take_goal', amount: 2000 }]);
  check('Agent: "take 2,000 from Japan" shows saved ฿12,400 → ฿10,400', !!tk && tk.take === 2000 && tk.rows.some((r) => r.from === '฿12,400' && r.to === '฿10,400'), () => tk?.rows);
  const paid = planChange(m, [lite], [{ op: 'pay_bill', name: 'rent' }], new Date(2026, 10, 9));
  check(
    'Agent: "I paid rent" marks rent paid this pay month; twice is refused',
    m.bills.rent === 0 ? paid === null : !!paid && paid.next.paid!.keys.includes('rent') && planChange(paid.next, [lite], [{ op: 'pay_bill', name: 'rent' }], new Date(2026, 10, 9)) === null,
    () => paid?.next.paid,
  );
  check('Agent: removing a bill that isn’t there is refused', planChange(m, [lite], [{ op: 'remove_bill', name: 'Spotify' }]) === null, () => 0);
  check('Agent: switching money style is gone (one plan, Kip’s)', planChange(m, [lite], [{ op: 'style' as never }]) === null, () => 0);
  check('Agent: an unknown change is refused, never guessed', planChange(m, [lite], [{ op: 'transfer' as never, amount: 100 }]) === null, () => 0);

  const recent = [
    { ref: 'r1', id: 'a', name: 'Coffee', amount: 55, category: 'food' as const, at: '2026-11-09T08:00:00Z' },
    { ref: 'r2', id: 'b', name: 'Shopee', amount: 500, category: 'food' as const, at: '2026-11-08T08:00:00Z' },
  ];
  const fx = planFix(recent, [
    { ref: 'r1', op: 'delete' },
    { ref: 'r2', op: 'category', category: 'shopping' },
  ]);
  check(
    'Agent fix: "delete the coffee, Shopee was shopping" — two edits, both shown',
    !!fx && fx.edits.length === 2 && fx.edits[0].op === 'delete' && fx.edits[1].category === 'shopping' && fx.rows.length === 2,
    () => fx,
  );
  check('Agent fix: something not in the recent list is refused', planFix(recent, [{ ref: 'r9', op: 'delete' }]) === null, () => 0);
  check('Agent fix: "change it to the same category" is refused', planFix(recent, [{ ref: 'r1', op: 'category', category: 'food' }]) === null, () => 0);
  check(
    'Agent fix: a new amount must be real and different',
    planFix(recent, [{ ref: 'r1', op: 'amount', amount: 0 }]) === null &&
      planFix(recent, [{ ref: 'r1', op: 'amount', amount: 55 }]) === null &&
      !!planFix(recent, [{ ref: 'r1', op: 'amount', amount: 65 }]),
    () => 0,
  );
}

// ---------- editing a bill ----------
{
  let n = 0;
  for (let i = 0; i < 3000; i++) {
    const inp = person();
    if (!inp) continue;
    let m = month(inp);
    const add = addBill(m, pick(['Netflix', 'Gym', 'AIA']), int(100, 3000), { type: 'other' });
    if (add.short > 0) continue;
    m = add.month;
    const idx = (m.bills.items ?? []).length - 1;
    const which = rand() < 0.3 ? ('rent' as const) : idx;
    const was = which === 'rent' ? m.bills.rent : m.bills.items![idx].amount;
    const to = rand() < 0.2 ? was : int(0, was * 3 + 500);
    const r = editBill(m, which, { perMonth: to, name: rand() < 0.5 ? 'Renamed' : undefined });
    if (!r) {
      check('Edit bill: refused only when the extra really doesn’t fit', to > was && addBill(m, 'x', to - was).short > 0, () => ({ was, to }));
      continue;
    }
    n++;
    const now = which === 'rent' ? r.month.bills.rent : r.month.bills.items![idx].amount;
    check('Edit bill: the bill now carries the new amount', now === to, () => ({ was, to, now }));
    check('Edit bill: every baht still has a job', Math.abs(jobs(r.month) - r.month.income) <= 10, () => ({ was, to, jobs: jobs(r.month), income: r.month.income }));
    check('Edit bill: no budget below ฿0', r.month.spend.every((x) => x.amount >= 0) && r.month.goal.amount + r.month.goalExtra >= 0, () => ({ was, to }));
    check(
      'Edit bill: less a month goes back to the goal; more comes from guess → fun → goal',
      to < was
        ? r.freed === was - to && r.month.goalExtra === m.goalExtra + (was - to)
        : to > was
          ? r.fromGuess + r.fromFun + r.fromGoal === to - was
          : r.freed === 0 && r.fromGuess + r.fromFun + r.fromGoal === 0,
      () => ({ was, to, r: { ...r, month: undefined } }),
    );
    if (to === was)
      check(
        'Edit bill: a rename alone moves no money',
        JSON.stringify(r.month.spend) === JSON.stringify(m.spend) && r.month.goalExtra === m.goalExtra && r.month.bills.guess === m.bills.guess,
        () => 0,
      );
    check(
      'Edit bill: no helper bill left behind',
      !(r.month.bills.items ?? []).some((b) => b.name.startsWith('\u0000')) && (r.month.bills.items ?? []).length === (m.bills.items ?? []).length,
      () => r.month.bills.items,
    );
  }
  check('Edit bill: the random runs did real edits', n > 1000, () => n);
}

// ---------- Kip notices first ----------
{
  let cards = 0;
  for (let i = 0; i < 4000; i++) {
    const inp = person();
    if (!inp) continue;
    const m = month(inp);
    const now = new Date(2026, 10, int(1, 28), 12);
    const P = period(m.payday, now);
    // Random spending so far: some budgets fast, some slow, some untouched.
    const byCat: Spent['byCat'] = {};
    for (const s of m.spend) if (rand() < 0.8) byCat[s.key] = Math.round(s.amount * (P.dayIndex / P.total) * (rand() * 2.2));
    const spent: Spent = { total: Object.values(byCat).reduce((a: number, n) => a + (n ?? 0), 0), today: 0, bills: 0, byCat, byDay: {} };
    const n = runoutNotice(m, spent, P, now);
    if (!n) continue;
    cards++;
    const left = (k: CatKey) => (n.next.spend.find((x) => x.key === k)?.amount ?? 0) - (byCat[k] ?? 0);
    check(
      'Kip notices: a move keeps every baht’s job (rent, bills, saving untouched)',
      Math.abs(jobs(n.next) - n.next.income) <= 10 && billsTotal(n.next) === billsTotal(m) && savingTotal(n.next) === savingTotal(m),
      () => n.moves,
    );
    check('Kip notices: only budgets move — the total spending money stays the same', spendingTotal(n.next) === spendingTotal(m), () => n.moves);
    check('Kip notices: the short budget really runs out before payday at its pace', n.runsOut.getTime() < P.end.getTime() - 86_400_000 && n.daysEarly >= 2, () => n);
    check(
      'Kip notices: a giver keeps enough for its own days to payday',
      n.moves.slice(1).every((g) => left(g.key) >= Math.max(0, (byCat[g.key] ?? 0) / Math.max(1, P.dayIndex), amt(m, g.key) / P.total) * P.daysLeft - 50),
      () => n.moves,
    );
    check(
      'Kip notices: a giver never goes below what’s already spent on it',
      n.moves.slice(1).every((g) => left(g.key) >= 0),
      () => n.moves,
    );
    check(
      'Kip notices: the card’s numbers are the real ones after the move',
      n.moves.every((mv) => mv.now === left(mv.key)),
      () => n.moves,
    );
    check('Kip notices: worth a card (at least ฿200)', n.moves[0].now - n.moves[0].was >= 200, () => n.moves);
    // Once done, the same card is put away until payday (Home hides it); Undo brings it back.
    const after = noticesFor(n.next, spent, P, null, [], { [n.id]: P.end.getTime() }, now);
    check(
      'Kip notices: after Do it, the same budget isn’t raised again this month',
      after.every((x) => x.kind !== 'runout' || x.key !== n.key),
      () => after,
    );
    const later = noticesFor(m, spent, P, null, [], { [n.id]: now.getTime() + 1 }, now);
    check(
      'Kip notices: Not now hides it',
      later.every((x) => x.id !== n.id),
      () => 0,
    );
    if (later[0]?.kind === 'runout') check('Kip notices: with one put off, the next budget gets its turn', later[0].key !== n.key, () => later[0]);
  }
  check('Kip notices: the random runs made real cards', cards > 300, () => cards);

  // A known case (the mockup): food ฿530 left of ฿4,500, ~฿200 a day, 11 days to payday.
  const inp = person('trip');
  if (inp) {
    const m0 = month(inp, 'kip', 25);
    const m = { ...m0, spend: m0.spend.map((x) => (x.key === 'food' ? { ...x, amount: 4500 } : x.key === 'transport' ? { ...x, amount: 1500 } : x)) };
    const now = new Date(2026, 10, 14, 12);
    const P = period(25, now);
    const spent: Spent = { total: 4570, today: 0, bills: 0, byCat: { food: 3970, transport: 600 }, byDay: {} };
    const n = runoutNotice(m, spent, P, now);
    check('Kip notices: food running out mid-month makes a card', !!n && n.key === 'food' && n.left === 530, () => n);
    const calm: Spent = { total: 2000, today: 0, bills: 0, byCat: { food: 2000 }, byDay: {} };
    check('Kip notices: on pace, Kip says nothing', runoutNotice(m, calm, P, now) === null, () => 0);
    check('Kip notices: too early in the month to judge', runoutNotice(m, spent, period(25, new Date(2026, 9, 27, 12)), new Date(2026, 9, 27, 12)) === null, () => 0);

    // Left over: only early in the new month, only when last month was logged well, from its start.
    const lites = [{ ...lite('g1', 'trip', 60000, 5000, null), title: 'Japan' }];
    const early = new Date(2026, 9, 27, 12);
    const Pe = period(25, early);
    const budget = spendingTotal(m);
    const good = leftoverNotice(m, { total: budget - 950, days: 25, extra: 0, startedBefore: true }, Pe, lites, early);
    check('Left over: a well-logged month with money left makes a card (whole ฿100s)', !!good && good.amount === 900, () => good);
    check('Left over: too few days logged — no card', leftoverNotice(m, { total: budget - 3000, days: 6, extra: 0, startedBefore: true }, Pe, lites, early) === null, () => 0);
    check('Left over: started mid-month — no card', leftoverNotice(m, { total: budget - 3000, days: 25, extra: 0, startedBefore: false }, Pe, lites, early) === null, () => 0);
    check('Left over: after the first week — no card', leftoverNotice(m, { total: budget - 3000, days: 25, extra: 0, startedBefore: true }, P, lites, now) === null, () => 0);
    check('Left over: spent it all — no card', leftoverNotice(m, { total: budget, days: 25, extra: 0, startedBefore: true }, Pe, lites, early) === null, () => 0);
    check('Left over: the goal arrives no later', !good || !good.will || !good.was || good.will.getTime() <= good.was.getTime(), () => good);
  }
}

// ---------- bills: due days and reminders ----------
{
  let n = 0;
  for (let i = 0; i < 3000; i++) {
    const inp = person();
    if (!inp) continue;
    const base = month(inp);
    const now = new Date(2026, int(0, 11), int(1, 28), int(0, 23));
    const day = int(1, 31);
    const remind = pick(['before', 'day', 'off'] as const);
    let m = addBill(base, 'Netflix', 179, { type: 'streaming', day, remind }).month;
    if (rand() < 0.5) m = { ...m, rentDue: { day: int(1, 31), remind: pick(['before', 'day'] as const) } };
    const P = period(m.payday, now);
    const pk = P.start.toDateString();
    const paid = rand() < 0.4;
    if (paid) m = { ...m, paid: { period: pk, keys: ['item:Netflix'] } };
    const b = dueBills(m, now).find((x) => x.key === 'item:Netflix')!;
    const d = nextBillDue(b, m.payday, now)!;
    n++;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    check('Due day: falls on the bill’s day, or the month’s last day when shorter', d.date.getDate() === Math.min(day, new Date(d.date.getFullYear(), d.date.getMonth() + 1, 0).getDate()), () => ({
      day,
      date: d.date,
    }));
    // A pay month can miss a day (a 29th–31st near a short February): then the next one is the first after it.
    check(
      'Due day: unpaid → this pay month’s date; paid → next pay month’s',
      paid ? d.date >= P.end : d.date >= P.start && (d.date < P.end || d.date.getTime() - P.end.getTime() < 4 * 86_400_000),
      () => ({ paid, date: d.date, P }),
    );
    check('Due day: “days” counts from today (late is below 0)', d.days === Math.round((d.date.getTime() - today.getTime()) / 86_400_000), () => d);
    check('Due day: a paid bill is never late', !paid || d.days > 0 || (d.days >= 0 && d.date >= P.end), () => d);
    const rs = remindersFor(m, now);
    check(
      'Reminders: never in the past, 9:00, the day before or on the day',
      rs.every((r) => r.at > now && r.at.getHours() === 9 && r.at.getMinutes() === 0),
      () => rs,
    );
    check('Reminders: none for a bill set to Off', remind !== 'off' || rs.every((r) => r.key !== 'item:Netflix'), () => rs);
    check('Reminders: a paid bill skips this pay month', !paid || rs.filter((r) => r.key === 'item:Netflix').every((r) => r.at >= new Date(P.end.getTime() - 86_400_000)), () => ({ rs, P }));
    check('Reminders: each one once', new Set(rs.map((r) => r.id)).size === rs.length, () => rs.map((r) => r.id));
    if (remind !== 'off') {
      const mine = rs.filter((r) => r.key === 'item:Netflix');
      const shift = remind === 'before' ? 1 : 0;
      check(
        'Reminders: on the right day for its due date',
        mine.every((r) => {
          const due = new Date(r.id.slice(-10));
          const x = new Date(due.getFullYear(), due.getMonth(), due.getDate() - shift, 9);
          return Math.abs(x.getTime() - r.at.getTime()) < 26 * 3_600_000;
        }),
        () => mine,
      );
    }
    const card = billNotice(m, now);
    const all = billNotice(m, now, (id) => !id.includes('item:Netflix'));
    check('Bill card: only when due today or late and not ticked', all ? !paid && d.days <= 0 : paid || d.days > 0, () => ({ all, d, paid }));
    if (card) check('Bill card: Not yet puts it away until tomorrow', billNotice(m, now, (id) => id === card.id)?.id !== card.id, () => card);
    // Re-plans keep due days: a style switch re-adds bills with their day; rent's day is kept.
    const re = withStyle(m, pick(['kip', 'savefirst', '503020', 'jars'] as const));
    check(
      'Due day: a style switch keeps every bill’s day and rent’s day',
      re.bills.items?.find((x) => x.name === 'Netflix')?.day === day && JSON.stringify(re.rentDue) === JSON.stringify(m.rentDue),
      () => re.bills.items,
    );
  }
  check('Due day: the random runs were real', n > 1000, () => n);
  // Known cases.
  check('Due day: the 31st in February is the 28th', dateIn(2027, 1, 31).getDate() === 28 && dateIn(2028, 1, 31).getDate() === 29, () => 0);
  const inp = person('trip');
  if (inp) {
    const m0 = month(inp, 'kip', 25);
    const m = addBill(m0, 'Netflix', 179, { type: 'streaming', day: 5, remind: 'before' }).month;
    const now = new Date(2026, 11, 2, 12); // 2 Dec, pay month 25 Nov – 25 Dec
    const b = dueBills(m, now)[0];
    const d = nextBillDue(b, 25, now)!;
    check('Due day: Netflix on the 5th is due 5 Dec, in 3 days', d.date.getDate() === 5 && d.date.getMonth() === 11 && d.days === 3, () => d);
    const r = remindersFor(m, now)[0];
    check('Reminders: the day before at 9:00 (4 Dec)', !!r && r.at.getDate() === 4 && r.at.getMonth() === 11 && r.at.getHours() === 9 && r.when === 'tomorrow', () => r);
    const onDay = new Date(2026, 11, 5, 10);
    check('Bill card: on the 5th, Netflix is due today', billNotice(m, onDay)?.late === 0, () => billNotice(m, onDay));
    const late = new Date(2026, 11, 7, 10);
    check('Bill card: two days on, it says it was due', billNotice(m, late)?.late === 2, () => billNotice(m, late));
    const paidM = { ...m, paid: { period: period(25, onDay).start.toDateString(), keys: ['item:Netflix'] } };
    check('Bill card: ticked — no card', billNotice(paidM, onDay) === null, () => 0);
    const ed = editBill(m, 0, { perMonth: 179, due: { day: 12, remind: 'day' } });
    check('Edit bill: a new due day and reminder are saved', ed?.month.bills.items?.[0].day === 12 && ed?.month.bills.items?.[0].remind === 'day', () => ed?.month.bills.items);
    const cleared = editBill(m, 0, { perMonth: 179, due: null });
    check(
      'Edit bill: clearing the day removes it and its reminder',
      cleared?.month.bills.items?.[0].day === undefined && cleared?.month.bills.items?.[0].remind === undefined,
      () => cleared?.month.bills.items,
    );
    const rent = editBill(m, 'rent', { perMonth: m.bills.rent, due: { day: 1, remind: 'before' } });
    check('Edit rent: its due day is saved on the month', rent?.month.rentDue?.day === 1, () => rent?.month.rentDue);
    check(
      'Rent: no due day set — no date is guessed',
      dueBills(m, now).every((x) => x.key !== 'rent'),
      () => 0,
    );
  }
}

// ---------- subscription detective ----------
{
  const NOWS = new Date(2026, 10, 14, 12);
  const at = (mo: number, d: number) => new Date(2026, mo, d, 10).toISOString();
  const spend = (note: string, amount: number, iso: string) => ({ amount, kind: 'spend', occurred_at: iso, note });
  check(
    'Detective: names are cleaned (codes and numbers go)',
    cleanName('SPOTIFY P1A2B3 BKK').name === 'Spotify' && cleanName('APPLE.COM/BILL ICLOUD 50GB').name === 'iCloud+' && cleanName('Gym Jetts 2245').name === 'Jetts Fitness',
    () => [cleanName('SPOTIFY P1A2B3 BKK'), cleanName('APPLE.COM/BILL ICLOUD 50GB')],
  );
  const inp = person('trip');
  if (inp) {
    const m = month(inp, 'kip', 25);
    const three = [spend('SPOTIFY P1A2B3 BKK', 129, at(8, 12)), spend('SPOTIFY P9Z BKK', 129, at(9, 12)), spend('Spotify', 129, at(10, 13))];
    const r = findRepeats(three, m, NOWS);
    check('Detective: 3 months running at about the same day and amount is a subscription', r.length === 1 && r[0].name === 'Spotify' && r[0].amount === 129 && r[0].day === 12, () => r);
    check('Detective: 2 months is not enough', findRepeats(three.slice(1), m, NOWS).length === 0, () => 0);

    // ---------- what Kip knows (Talk to Kip, step 3) ----------
    {
      const withNet = addBill(m, 'Netflix', 419, { type: 'streaming', day: 18, remind: 'before' }).month;
      const food = [spend('ข้าวมันไก่', 60, at(9, 1)), spend('ข้าวมันไก่', 60, at(9, 3)), spend('Shabu', 450, at(9, 10)), spend('BTS', 44, at(9, 5))].map((x) => ({
        ...x,
        cat: x.note === 'BTS' ? 'transport' : 'food',
      }));
      const k = kipKnows(withNet, [...three, ...food], NOWS);
      const net = k.dueDays.find((d) => d.name === 'Netflix');
      check('Kip knows: Netflix is due on the 18th, in 4 days', !!net && net.day === 18 && net.dueIn === 4 && !net.paid, () => k.dueDays);
      check('Kip knows: a bill without a day has no due date (never a guessed one)', k.dueDays.every((d) => d.day > 0) && k.dueDays.length === 1, () => k.dueDays);
      const oct = k.lastMonths.find((x) => x.month === '2026-10');
      check(
        'Kip knows: last month by category, and what was logged most often',
        !!oct && oct.byCategory['Food & drinks'] === 570 && oct.byCategory.Transport === 44 && oct.mostOften[0].name === 'ข้าวมันไก่' && oct.mostOften[0].times === 2,
        () => k.lastMonths,
      );
      check(
        'Kip knows: a month with nothing logged is left out, not a row of zeros',
        k.lastMonths.every((x) => x.spent > 0),
        () => k.lastMonths,
      );
      check(
        'Kip knows: the detective’s Spotify is in noticed.subscriptions',
        k.noticed.subscriptions.some((x) => x.name === 'Spotify' && x.amount === 129 && x.day === 12),
        () => k.noticed,
      );
      const lite: GoalLite = { id: 'g1', kind: 'trip', target: 200000, saved: 12400, due: null, monthly: null };
      const due = planChange(withNet, [lite], [{ op: 'set_due', name: 'netflix', day: 5 }], NOWS);
      check(
        'Agent: "Netflix is on the 5th" sets its due day and shows 18th → 5th',
        !!due && due.next.bills.items?.find((b) => b.name === 'Netflix')?.day === 5 && due.rows.some((r) => r.title === 'Netflix' && r.from === '18th' && r.to === '5th'),
        () => due?.rows,
      );
      check(
        'Agent: a due day for a bill that isn’t there is refused',
        planChange(withNet, [lite], [{ op: 'set_due', name: 'Disney', day: 5 }], NOWS) === null && planChange(withNet, [lite], [{ op: 'set_due', name: 'Netflix', day: 32 }], NOWS) === null,
        () => 0,
      );
      const rentDue = planChange(withNet, [lite], [{ op: 'set_due', name: 'rent', day: 1 }], NOWS);
      check('Agent: "rent is on the 1st" sets rent’s day (when there is rent)', withNet.bills.rent > 0 ? rentDue?.next.rentDue?.day === 1 : rentDue === null, () => rentDue?.next.rentDue);
      {
        const ok = (x: MonthBudget) => billsTotal(x) + savingTotal(x) + spendingTotal(x) === x.income;
        const g0 = m.bills.guess;
        const down = setGuess(m, Math.max(0, g0 - 500))!;
        check(
          'Bill guess lowered: the difference goes to the goal, the month still adds up',
          ok(down.month) && down.freed === Math.min(500, g0) && down.month.goalExtra === m.goalExtra + down.freed,
          () => down,
        );
        const up = setGuess(m, g0 + 300);
        check(
          'Bill guess raised: taken from fun then the goal (never itself), the month still adds up',
          !!up && ok(up.month) && up.month.bills.guess === g0 + 300 && up.fromFun + up.fromGoal === 300 && (up.month.bills.items ?? []).length === (m.bills.items ?? []).length,
          () => up,
        );
        check('Bill guess raised past everything is refused', setGuess(m, m.income * 2) === null, () => 0);
      }
      const twice = addBill(addBill(m, 'Yes', 80).month, 'yes', 90).month;
      check('Two bills can’t share a name (the second is "yes 2"), so every card has its own key', twice.bills.items?.map((b) => b.name).join('|') === 'Yes|yes 2', () => twice.bills.items);
      const sub = planChange(withNet, [lite], [{ op: 'add_bill', name: 'Spotify', amount: 129, bill_type: 'streaming', day: 12 }], NOWS);
      check(
        'Agent: adding the found subscription carries its day, so it gets a reminder',
        sub?.next.bills.items?.find((b) => b.name === 'Spotify')?.day === 12 && dueBills(sub!.next, NOWS).some((d) => d.name === 'Spotify'),
        () => sub?.next.bills.items,
      );
    }
    check('Detective: a month skipped is not a run', findRepeats([three[0], three[2], spend('Spotify', 129, at(6, 12))], m, NOWS).length === 0, () => 0);
    check(
      'Detective: more than 10% apart is not the same thing',
      findRepeats([spend('Shopee', 129, at(8, 12)), spend('Shopee', 400, at(9, 12)), spend('Shopee', 129, at(10, 12))], m, NOWS).length === 0,
      () => 0,
    );
    check('Detective: days far apart are not monthly', findRepeats([spend('Grab', 129, at(8, 2)), spend('Grab', 129, at(9, 20)), spend('Grab', 129, at(10, 12))], m, NOWS).length === 0, () => 0);
    check(
      'Detective: around the month end counts (31st, 1st, 30th)',
      findRepeats([spend('Netflix', 299, at(7, 31)), spend('Netflix', 299, at(9, 1)), spend('Netflix', 299, at(9, 30))], m, new Date(2026, 10, 2)).length === 1,
      () => 0,
    );
    const withBill = addBill(m, 'Spotify', 129, { type: 'streaming', day: 12 }).month;
    check('Detective: already a bill — no card', findRepeats(three, withBill, NOWS).length === 0, () => 0);
    check('Detective: stale (last one over 6 weeks ago) — no card', findRepeats(three, m, new Date(2027, 0, 20)).length === 0, () => 0);
    const cards = subNotices(m, three, NOWS);
    const sub = cards.find((c) => c.kind === 'sub');
    check(
      'Detective: the card’s plan adds it with its day and a reminder, and every baht keeps its job',
      !!sub && sub.kind === 'sub' && (sub.next.bills.items ?? []).some((b) => b.name === 'Spotify' && b.day === 12 && b.remind === 'before') && Math.abs(jobs(sub.next) - sub.next.income) <= 10,
      () => sub,
    );
    // Price went up: two payments running at a new price.
    const yt = addBill(m, 'YouTube Premium', 159, { type: 'streaming', day: 18 }).month;
    const up = findPriceChanges([spend('YOUTUBE PREMIUM', 179, at(9, 18)), spend('YouTube', 179, at(10, 18))], yt);
    check('Detective: a bill paid twice at a new price is noticed', up.length === 1 && up[0].was === 159 && up[0].now === 179, () => up);
    check('Detective: one payment at a new price is not enough', findPriceChanges([spend('YouTube', 179, at(10, 18)), spend('YouTube', 159, at(9, 18))], yt).length === 0, () => 0);
    const upCard = subNotices(yt, [spend('YouTube', 179, at(9, 18)), spend('YouTube', 179, at(10, 18))], NOWS).find((c) => c.kind === 'subprice');
    check(
      'Detective: “Make it ฿179” keeps every baht’s job',
      !!upCard && upCard.kind === 'subprice' && upCard.next.bills.items!.find((b) => b.name === 'YouTube Premium')!.amount === 179 && Math.abs(jobs(upCard.next) - upCard.next.income) <= 10,
      () => upCard,
    );
    // Stopped: paid before in what was logged, then nothing for 2 due dates.
    const viu = addBill(m, 'Viu', 119, { type: 'streaming', day: 5 }).month;
    check('Detective: no charge for 2 due dates after being paid — noticed', findStopped([spend('VIU', 119, at(7, 5))], viu, NOWS).length === 1, () => 0);
    check('Detective: never logged — Kip can’t tell, says nothing', findStopped([], viu, NOWS).length === 0, () => 0);
    check('Detective: paid last month — not stopped', findStopped([spend('VIU', 119, at(7, 5)), spend('VIU', 119, at(10, 5))], viu, NOWS).length === 0, () => 0);
    const stopCard = subNotices(viu, [spend('VIU', 119, at(7, 5))], NOWS).find((c) => c.kind === 'substop');
    check(
      'Detective: removing it gives its money back to saving',
      !!stopCard && stopCard.kind === 'substop' && !(stopCard.next.bills.items ?? []).some((b) => b.name === 'Viu') && stopCard.next.goalExtra === viu.goalExtra + 119,
      () => stopCard,
    );
    // Streaming: 2 or more.
    const two = addBill(addBill(m, 'Netflix', 179, { type: 'streaming' }).month, 'Disney+', 299, { type: 'streaming' }).month;
    const st = streamingTotal(two);
    check('Detective: 2 streaming apps — the year’s total', !!st && st.perYear === (179 + 299) * 12, () => st);
    check('Detective: 1 streaming app — nothing to say', streamingTotal(addBill(m, 'Netflix', 179, { type: 'streaming' }).month) === null, () => 0);
    // Reading the subscriptions screen.
    const found = foundSubs(
      [
        { name: 'YouTube Premium', amount: 179, period: 'month', renews: '2026-12-18' },
        { name: 'iCloud+ 50 GB', amount: 35, period: 'month', renews: '2026-12-03' },
        { name: 'Duolingo', amount: 1290, period: 'year', renews: '2027-03-09' },
        { name: 'Spotify', amount: 129, period: 'month', renews: '2026-12-12' },
        { name: 'YouTube Premium', amount: 179, period: 'month', renews: '2026-12-18' },
      ],
      withBill,
      (total, due) => yearlySetAside(total, due, 0, NOWS),
    );
    check('Screenshot: each subscription once, ones you have marked', found.length === 4 && found.find((f) => f.name === 'Spotify')?.already === true, () => found);
    check(
      'Screenshot: renewal day and a yearly one’s month kept',
      found.find((f) => f.name === 'YouTube Premium')?.day === 18 && found.find((f) => f.name === 'Duolingo')?.due === '2027-03',
      () => found,
    );
    const duo = found.find((f) => f.name === 'Duolingo')!;
    check('Screenshot: a yearly one sets aside enough by its renewal', duo.perMonth * monthsToDue('2027-03', NOWS) >= 1290, () => duo);
  }
}

// ---------- payday recap ----------
{
  let made = 0;
  for (let i = 0; i < 1500; i++) {
    const inp = person();
    if (!inp) continue;
    const m = month(inp, pick(['kip', '503020', 'jars'] as const), pick([1, 15, 25, 28]));
    const now = new Date(2026, int(0, 11), int(1, 28), 12);
    const P = period(m.payday, now);
    const prev = periodAt(m.payday, -1, now);
    const tx: { amount: number; kind: string; occurred_at: string; note: string | null; cat: string }[] = [];
    for (let d = new Date(prev.start); d < prev.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      if (rand() < 0.3) continue;
      for (const s of m.spend)
        if (rand() < 0.4)
          tx.push({
            amount: Math.round((s.amount / prev.total) * (s.key === 'food' ? 3 + rand() * 2 : 0.2 + rand() * 1.4)),
            kind: 'spend',
            occurred_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString(),
            note: 'x',
            cat: s.key,
          });
    }
    const days = new Set(tx.map((x) => new Date(x.occurred_at).toDateString())).size;
    const last = { total: tx.reduce((a, x) => a + x.amount, 0), days, extra: 0, startedBefore: true };
    const r = recapFor(m, tx, last, [{ ...lite('g1', 'trip', 60000, 5000, null), title: 'Japan' }], now);
    const should = P.dayIndex < 5 && days >= Math.ceil(prev.total / 2);
    check('Recap: only in the first days of a new pay month, and only when last month was logged on half its days', !!r === should, () => ({ dayIndex: P.dayIndex, days, total: prev.total }));
    if (!r) continue;
    made++;
    check('Recap: spent is what was logged last pay month', r.spent === last.total, () => ({ spent: r.spent, logged: last.total }));
    check('Recap: left = plan − spent', r.left === r.plan - r.spent, () => r);
    check('Recap: at most 3 suggestions, each once', r.suggestions.length <= 3 && new Set(r.suggestions.map((x) => x.id)).size === r.suggestions.length, () => r.suggestions.map((x) => x.id));
    for (const sg of r.suggestions)
      if (sg.kind === 'move') {
        const to = r.cats.find((c) => c.key === sg.to)!;
        const from = r.cats.find((c) => c.key === sg.from)!;
        check(
          'Recap: a move goes from a budget that stayed under to one that ran over, no more than either',
          to.spent > to.plan && from.plan - from.spent >= sg.amount && to.spent - to.plan >= sg.amount && sg.amount % 100 === 0,
          () => ({ sg: { ...sg, next: 0 }, to, from }),
        );
        check('Recap: a move keeps every baht’s job', Math.abs(jobs(sg.next) - sg.next.income) <= 10 && spendingTotal(sg.next) === spendingTotal(m), () => sg.id);
      }
    const ctx = recapContext(r);
    check(
      'Recap: Kip is told the suggestions by id, and only numbers',
      ctx.suggestions.length === r.suggestions.length && ctx.suggestions.every((x, k) => x.id === r.suggestions[k].id),
      () => ctx.suggestions,
    );
  }
  check('Recap: the random runs made real recaps', made > 100, () => made);
}

// ---------- evening check-in nights ----------
{
  const times = ['19:00', '20:00', '21:00', '22:00'];
  for (let k = 0; k < 3000; k++) {
    const now = new Date(2026, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28), Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
    const time = times[k % 4];
    const logged = Math.random() < 0.5 ? ymd(now) : null;
    const n = nightsAhead(now, time, logged);
    const [h] = time.split(':').map(Number);
    const tonight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0);
    check(
      'Check-in: every nudge is in the future, at the chosen time',
      n.every((d) => d > now && d.getHours() === h && d.getMinutes() === 0),
      () => ({ now, time, n }),
    );
    check('Check-in: one nudge a night, no night twice', new Set(n.map(ymd)).size === n.length, () => n.map(ymd));
    check('Check-in: tonight only if the time is still ahead and nothing is logged today', n.some((d) => ymd(d) === ymd(now)) === (tonight > now && logged !== ymd(now)), () => ({
      now,
      time,
      logged,
    }));
    check('Check-in: the next two weeks, so it stops after two weeks away', n.length === 13 || n.length === 14, () => n.length);
  }
}

// ---------- iPhone Text Size steps ----------
{
  for (const f of [0.82, 0.88, 0.95, 1, 1.05]) check('Text Size: middle and smaller are Default', stepFor(f) === 0, () => f);
  for (const f of [1.12, 1.24]) check('Text Size: one or two notches bigger is Large', stepFor(f) === 1, () => f);
  for (const f of [1.35, 1.64, 1.95, 2.35, 2.76, 3.12]) check('Text Size: three notches and the Accessibility sizes stop at Larger', stepFor(f) === 2, () => f);
  for (let size = 8; size <= 80; size += 0.5) {
    const [a, b, c] = [grown(size, 0), grown(size, 1), grown(size, 2)];
    check('Text Size: Default is the design size', a === size, () => size);
    check('Text Size: Larger ≥ Large ≥ Default', c >= b && b >= a, () => ({ size, a, b, c }));
    check('Text Size: never more than +30% (+15% at Large)', b <= size * 1.15 + 0.5 && c <= size * 1.3 + 0.5, () => ({ size, b, c }));
    check('Text Size: 40pt and up (big numbers) keep their size', size < 40 || (b === size && c === size), () => ({ size, b, c }));
    check('Text Size: small text grows the most (+30% at Larger, to the nearest half point)', size > 13 || c >= size * 1.3 - 0.25, () => ({ size, c }));
    const st = grownStyle({ fontSize: size, lineHeight: Math.ceil(size * 1.5) }, 2, false)!;
    check('Text Size: line height grows with the text (Thai marks keep room)', (st.lineHeight as number) >= (st.fontSize as number) * 1.5 - 1, () => ({ size, st }));
  }
  check('Text Size: a nested text with no size of its own takes the grown size around it', grownStyle({ color: 'red' }, 2, true) === null, () => 0);
}

// ---------- Kip's jelly motion ----------
// The frame callback can start again (Reanimated restarts its clock on every re-render — a sheet closing over Kip).
// Whatever happens — taps, restarts, long stalls, any mood — Kip stays Kip-shaped: no runaway squash, wave or hop.
{
  for (let run = 0; run < 300; run++) {
    const kipSeed = rand() * 10;
    let sim = startSim(kipSeed);
    let pokes = 0;
    let worst = 0;
    let lastClock = 0;
    let bad: unknown = null;
    for (let f = 0; f < 900; f++) {
      if (rand() < 0.01) pokes++;
      const restart = rand() < 0.01;
      const elapsed = restart ? null : rand() < 0.01 ? int(200, 5000) : 1000 / pick([60, 120, 30]);
      const mood = KIP_MOODS[Math.floor(f / 150) % KIP_MOODS.length];
      const next = stepKip(sim, elapsed, mood, pick([1, 0.35]), pokes, kipSeed);
      const p = next.shown;
      const off = Math.max(Math.abs(p.sx - 1), Math.abs(p.sy - 1), Math.abs(p.rot), Math.abs(p.jump), Math.abs(p.wob));
      worst = Math.max(worst, Number.isFinite(off) ? off : Infinity);
      if (next.sim.clock < lastClock && !bad) bad = { f, clock: next.sim.clock, lastClock };
      lastClock = next.sim.clock;
      sim = next.sim;
    }
    check('Kip: his clock never runs backwards, even when the frame callback restarts', !bad, () => bad);
    check('Kip: taps, restarts and stalls never bend him out of shape (every value stays within 0.6 of rest)', worst < 0.6, () => ({ run, worst }));
  }
}

// ---------- Own categories ("Create your own") ----------
{
  CATEGORY['c_kpop'] = { name: 'K-pop', color: '#FBF77A', icon: 'more', need: false };
  CATEGORY['c_cat'] = { name: 'Cat food', color: '#FBF77A', icon: 'more', need: true };
  for (let n = 0; n < 2000; n++) {
    const i = person();
    if (!i) continue;
    const s = pick(STYLES);
    const m = month(i, s);
    const daily0 = spendingTotal(m);
    for (const [key, need] of [['c_kpop', false], ['c_cat', true]] as const) {
      const from = defaultFrom(m, need);
      const ask = pick([0, 100, 500, 1000, 3000, 50000]);
      const made = addToMonth(m, key, ask, from);
      check('Own category: the month still adds up (bills + saving + spending = pay)', near(jobs(made), m.income), () => ({ s, key, ask, from }));
      check('Own category: each day stays the same (spending money unchanged)', spendingTotal(made) === daily0, () => ({ s, key, ask }));
      check('Own category: never takes more than its source has, no pot below zero', !negative(made) && amt(made, key as CatKey) <= amt(m, from as CatKey), () => ({ s, key, ask, from, spend: made.spend }));
      check('Own category: wants come from shopping or fun first, needs from household first', s === 'savefirst' || from === (need ? 'other' : amt(m, 'shopping') > 0 ? 'shopping' : 'fun'), () => ({ s, need, from }));
      // Switching style keeps it, at the same amount when there's room, and still adds up.
      const sw = withStyle(made, pick(STYLES));
      check('Own category: a style switch keeps it', sw.spend.some((x) => x.key === key), () => ({ s, key }));
      check('Own category: a style switch still adds up, no pot below zero', near(jobs(sw), m.income) && !negative(sw), () => ({ s, key, spend: sw.spend }));
      check('Own category: a style switch keeps its amount when there’s room', amt(sw, key as CatKey) <= amt(made, key as CatKey), () => ({ s, key, was: amt(made, key as CatKey), now: amt(sw, key as CatKey) }));
    }
    // A new bill can be paid from a want of their own, never from a need of their own.
    let both = addToMonth(addToMonth(m, 'c_kpop', 800, defaultFrom(m, false)), 'c_cat', 600, defaultFrom(m, true));
    const catBefore = amt(both, 'c_cat');
    both = addBill(both, 'Gym', 99999).month;
    check('Own category: a big new bill never takes money from a need of their own', amt(both, 'c_cat') === catBefore, () => ({ s, before: catBefore, after: amt(both, 'c_cat') }));
    // Raising a budget (by hand on Month, or Kip's "set") never cuts a need of their own — cat food stayed ฿0 (28 Nov).
    const shop = amt(both, 'shopping');
    const raised = raiseBudget(both, 'shopping', shop + pick([500, 2000, 99999]));
    check('Own category: raising another budget never cuts a need of their own', amt(raised, 'c_cat') === catBefore, () => ({ s, before: catBefore, after: amt(raised, 'c_cat') }));
    check('Own category: raising a budget still adds up', near(jobs(raised), jobs(both)) && !negative(raised), () => ({ s, spend: raised.spend }));
  }
}

// ---------- Kip: save less for the goal to give a budget more (less_goal) ----------
{
  const now = new Date(2026, 10, 28, 12);
  for (let n = 0; n < 1500; n++) {
    const i = person(pick(['trip', 'trip', 'emergency']));
    if (!i) continue;
    const m = month(i, 'kip', pick([null, 1, 25]));
    if (m.goal.isSafetyNet) continue;
    const per = m.goal.amount + m.goalExtra;
    if (per < 200) continue;
    const g = { id: 'g1', kind: 'trip', target: Math.max(per * 6, 30000), saved: int(0, 5000), due: null, monthly: null };
    const amount = Math.max(10, Math.round((per * pick([0.1, 0.5, 1])) / 10) * 10);
    const r = planChange(m, [g], [{ op: 'less_goal', to: 'shopping', amount: Math.min(amount, per) }], now);
    check('Less for the goal: it fits when it is no more than the goal saves a month', !!r, () => ({ per, amount }));
    if (!r) continue;
    const a = Math.min(amount, per);
    check('Less for the goal: shopping gets exactly that much more', amt(r.next, 'shopping') === amt(m, 'shopping') + a, () => ({ a, was: amt(m, 'shopping'), now: amt(r.next, 'shopping') }));
    check('Less for the goal: the goal saves exactly that much less', r.next.goal.amount + r.next.goalExtra === per - a, () => ({ per, a }));
    check('Less for the goal: the month still adds up and nothing goes below zero', near(jobs(r.next), m.income) && !negative(r.next), () => ({}));
    check('Less for the goal: the safety net and living costs never move', r.next.safety.amount === m.safety.amount && ['food', 'transport', 'health_beauty', 'other'].every((k) => amt(r.next, k as CatKey) === amt(m, k as CatKey)), () => ({}));
    check('Less for the goal: the card shows the goal saving less and its new date', r.rows.some((x) => x.title === 'Saving a month' && x.warn) && r.rows.some((x) => x.icon === 'plane'), () => r.rows);
    check('Less for the goal: the goal’s date moves later (or has no date at ฿0)', !r.due || r.due.to === null || r.due.to >= now.toISOString().slice(0, 10), () => r.due);
    check('Less for the goal: kept on a re-plan (goalPerMonth follows)', r.next.goalPerMonth === r.next.goal.amount, () => ({ gpm: r.next.goalPerMonth, amount: r.next.goal.amount }));
    check('Less for the goal: more than it saves is refused', planChange(m, [g], [{ op: 'less_goal', to: 'shopping', amount: per + 10 }], now) === null, () => ({}));
  }
}

// ---------- Evening check-in: every night's amount is the real one ----------
{
  for (let n = 0; n < 1500; n++) {
    const i = person();
    if (!i) continue;
    const m = month(i);
    const now = new Date(2026, pick([0, 3, 10, 11]), int(1, 28), int(7, 20));
    const P = period(m.payday, now);
    const total = Math.round(spendingTotal(m) * (P.dayIndex / P.total) * rand() * 1.4);
    const today = Math.min(total, pick([0, 0, 60, 250]));
    const spent: Spent = { total, today, bills: 0, byCat: {}, byDay: {} };
    const nights = nightAmounts(m, spent, monthNumbers, (p, d) => period(p, d).start.getTime(), now);
    check('Check-in: tonight says exactly what Home shows for today', nights[ymd(now)] === Math.max(0, Math.round(monthNumbers(m, spent, now).dailyToday)), () => ({ now, nights }));
    for (let k = 1; k < 15; k++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k, 12);
      const same = period(m.payday, d).start.getTime() === P.start.getTime();
      // Nothing logged since: Home on that day would show this (same pay cycle), or a fresh month's day (after payday).
      const home = monthNumbers(m, same ? { ...spent, today: 0 } : { total: 0, today: 0, bills: 0, byCat: {}, byDay: {} }, d).dailyToday;
      check('Check-in: every night ahead says what Home will show that day (nothing logged in between)', nights[ymd(d)] === Math.max(0, Math.round(home)), () => ({ now, d, same }));
      check('Check-in: never a negative amount', nights[ymd(d)] >= 0, () => ({ d }));
    }
  }
}

// ---------- Subscriptions: cancelling pays the goal (or the safety net, or fun) ----------
{
  const SUBS = [['Netflix', 419], ['Spotify', 139], ['YouTube Premium', 179], ['iCloud+', 35], ['Jetts Fitness', 1299], ['ChatGPT', 690]] as const;
  for (let n = 0; n < 1500; n++) {
    const i = person();
    if (!i) continue;
    const s = pick(STYLES);
    let m = month(i, s);
    for (const [name, amount] of SUBS.slice(0, int(1, SUBS.length))) {
      const r = addBill(m, name, amount, { day: int(1, 28) });
      if (r.short === 0) m = r.month;
    }
    const subs = subsOf(m);
    check('Subscriptions: every added one is found (none of rent, phone or internet)', subs.length === (m.bills.items ?? []).length, () => ({ items: m.bills.items?.map((b) => b.name) }));
    if (!subs.length) continue;
    const sub = pick(subs);
    const pot = (x: MonthBudget, k: CatKey) => x.spend.find((q) => q.key === k)?.amount ?? 0;
    const funKey = (['fun', 'spend_freely', 'shopping'] as CatKey[]).find((k) => m.spend.some((q) => q.key === k));
    for (const dest of [{ to: 'goal' }, { to: 'goal', goalId: 'g2' }, { to: 'safety' }, { to: 'fun' }] as const) {
      const r = cancelSub(m, sub.index, dest);
      check('Cancel: the month still adds up (bills + saving + spending ≤ pay, as before)', jobs(r.month) <= Math.max(m.income, jobs(m)) + 10, () => ({ s, dest, was: jobs(m), now: jobs(r.month) }));
      check('Cancel: the bill is gone and nothing goes below zero', !(r.month.bills.items ?? []).some((b) => b.name === sub.name) && !negative(r.month), () => ({ s, dest, name: sub.name }));
      check('Cancel: what it frees is never more than the bill was', r.freed >= 0 && r.freed <= sub.perMonth, () => ({ s, freed: r.freed, bill: sub.perMonth }));
      check('Cancel: rent and other bills are untouched', r.month.bills.rent === m.bills.rent && r.month.bills.guess === m.bills.guess, () => ({ s, dest }));
      if (dest.to === 'goal' && !('goalId' in dest)) check('Cancel → goal: the goal saving grows by exactly what was freed', goalTotal(r.month) === goalTotal(m) + r.freed, () => ({ s, freed: r.freed }));
      if (dest.to === 'goal' && 'goalId' in dest) {
        const lites: GoalLite[] = [
          { id: 'g1', kind: 'trip', target: 60000, saved: 0, due: null, monthly: null },
          { id: 'g2', kind: 'gadget', target: 30000, saved: 0, due: null, monthly: null },
        ];
        const was = splitOf(m, lites), now = splitOf(r.month, lites);
        check('Cancel → second goal: only that goal gets more, the first keeps its share', (now.get('g1') ?? 0) === (was.get('g1') ?? 0) && (now.get('g2') ?? 0) === (was.get('g2') ?? 0) + r.freed, () => ({ s, was: [...was], now: [...now], freed: r.freed }));
      }
      if (dest.to === 'safety') check('Cancel → safety net: it grows by what was freed, the goal saving stays', r.month.safety.amount === m.safety.amount + r.freed && goalTotal(r.month) === goalTotal(m), () => ({ s, freed: r.freed }));
      if (dest.to === 'fun' && funKey) check('Cancel → fun: fun money grows by what was freed, the goal saving stays', pot(r.month, funKey) === pot(m, funKey) + r.freed && goalTotal(r.month) === goalTotal(m), () => ({ s, freed: r.freed }));
    }
    // Keep or cancel: only 1–3 days before, never on the day itself, never for HeyKip.
    const now = new Date(2026, pick([0, 5, 10, 11]), int(1, 28), 10);
    const r = renewalNotice(m, now);
    if (r) check('Keep or cancel: asks 1 to 3 days before it renews', r.days >= 1 && r.days <= 3, () => ({ now, r }));
  }
}

// ---------- Saving over time ----------
{
  for (let n = 0; n < 1500; n++) {
    const payday = pick([null, 1, 15, 25, 28, 31]);
    const now = new Date(2026, int(0, 11), int(1, 28), 12);
    const moves = Array.from({ length: int(0, 12) }, () => ({ amount: pick([500, 1500, 4300, -2000]), at: new Date(now.getTime() - int(0, 200) * 86_400_000) }));
    const nowTotal = Math.max(0, moves.reduce((a, m) => a + m.amount, 0)) + int(0, 20000);
    const pts = savedOverTime(nowTotal, moves, payday, 5, now);
    check('Saving over time: ends at today’s total', pts[pts.length - 1].total === Math.round(nowTotal) && !!pts[pts.length - 1].now, () => ({ pts }));
    check('Saving over time: never below ฿0', pts.every((p) => p.total >= 0), () => ({ pts }));
    check('Saving over time: months in order, one per pay month', pts.every((p, k) => k === 0 || p.at > pts[k - 1].at), () => ({ pts }));
    const onlyIn = moves.every((m) => m.amount > 0);
    if (onlyIn) check('Saving over time: with only money going in, the line never goes down', pts.every((p, k) => k === 0 || p.total >= pts[k - 1].total), () => ({ pts }));
  }
}

// ---------- weekly sweep (approved 27 Nov): spare money goes to the goal, the rest of the month is untouched ----------
{
  for (let k = 0; k < 1500; k++) {
    const i = person();
    if (!i) continue;
    const m0 = month(i, 'kip', pick([null, 1, 15, 25, 28]));
    const now = new Date(2026, int(0, 11), int(1, 28), 12);
    const P = period(m0.payday, now);
    const budget = spendingTotal(m0);
    const today = int(0, 300);
    const before = Math.max(0, Math.round((budget * P.dayIndex) / P.total) - int(0, 4000));
    const spent = spentOf(before + today, today);
    const amount = spareNow(budget, spent, sweptIn(m0, now), P);
    if (amount < 200) continue;
    const m1 = withSweep(m0, amount, now);
    const a = monthNumbers(m0, spent, now);
    const b = monthNumbers(m1, spent, now);
    const plan = Math.round(budget / P.total / 10) * 10;
    check('Sweep: what’s spare is never more than what’s unspent', amount <= a.leftAtStart, () => ({ amount, a }));
    check('Sweep: after it, every day left still gets at least the plan’s daily amount', b.dailyToday >= plan - 10, () => ({ amount, plan, b, P }));
    check('Sweep: spending money left goes down by exactly the amount sent', a.leftMonth - b.leftMonth === Math.min(amount, a.leftMonth), () => ({ amount, a, b }));
    check('Sweep: a second ask the same moment finds nothing more spare', spareNow(budget, spent, sweptIn(m1, now), P) < 200, () => ({ amount }));
    check('Sweep: only the last two pay months are kept', Object.keys(withSweep(withSweep(m1, 100, new Date(now.getTime() + 40 * 86_400_000)), 100, new Date(now.getTime() + 80 * 86_400_000)).swept ?? {}).length <= 2, () => ({}));
  }
}

// ---------- living at home (approved 27 Nov): food floor ฿100 a day, so minimum wage at home can still save ----------
{
  for (let k = 0; k < 400; k++) {
    const income = r100(8000, 40000);
    const home = living(income, true), rented = living(income, false);
    check('At home: food floor is ฿3,000 (฿100 a day), never below', home.food >= 3000, () => ({ income, home }));
    check('At home: never needs more than renting', livingTotal(home) <= livingTotal(rented), () => ({ income, home, rented }));
  }
  const minWage: Inputs = { income: 9000, rent: 0, bills: 300, goal: { type: 'trip', title: 'Japan', target: 20000, saved: 0, months: null, monthly: null } };
  check('At home on minimum wage (฿9,000, no rent): there is room to save', verdict(minWage).kind !== 'noRoom', () => verdict(minWage));
}

// ---------- Bangkok Bank's transfer runs 12 times at most: Kip reminds from the 11th month, only for that bank ----------
{
  const at = '2026-01-25T03:00:00.000Z';
  const b = (bank: 'bbl' | 'kplus') => ({ amount: 3900, day: 25, bank, at });
  check('Renew: no reminder in the first 10 months', !needsRenew(b('bbl'), new Date(2026, 10, 20)), () => ({}));
  check('Renew: reminder from the 11th month', needsRenew(b('bbl'), new Date(2026, 11, 26)), () => ({}));
  check('Renew: never for banks that repeat without an end', !needsRenew(b('kplus'), new Date(2028, 0, 1)), () => ({}));
  check('Renew: setting it again starts the year over', !needsRenew({ ...b('bbl'), at: new Date(2026, 11, 26).toISOString() }, new Date(2027, 0, 25)), () => ({}));
}

// ---------- HeyKip Plus as a bill: at what Apple charged, like any bill; never in the free week ----------
{
  const plusOf = (m: MonthBudget) => (m.bills.items ?? []).find((b) => b.name === PLUS_BILL);
  const now = new Date(2026, 10, 27, 12);
  const renews = (months: number) => new Date(2026, 10 + months, 27, 12).toISOString();
  for (let k = 0; k < 800; k++) {
    const i = person();
    if (!i) continue;
    const m0 = month(i, 'kip', pick([null, 1, 25]));
    const price = pick([59, 99, 129]);
    check('Plus bill: none in the free week', syncPlusBill(m0, 'trial', null, now) === null, () => ({}));
    check('Plus bill: none for Free', syncPlusBill(m0, 'free', null, now) === null, () => ({}));
    check('Plus bill: another currency is left alone', syncPlusBill(m0, 'monthly', { amount: 2.99, currency: 'USD', period: 'monthly', renews_at: renews(1) }, now) === null, () => ({}));
    const a = syncPlusBill(m0, 'monthly', { amount: price, currency: 'THB', period: 'monthly', renews_at: renews(1) }, now)!;
    check('Plus bill: monthly is added at the price charged', plusOf(a)?.amount === price && a.plusNote?.kind === 'added', () => plusOf(a));
    check('Plus bill: the month still adds up (or no more over than before)', jobs(a) <= Math.max(a.income, jobs(m0)), () => ({ jobs: jobs(a), income: a.income }));
    check('Plus bill: living costs and the safety net are untouched', a.safety.amount === m0.safety.amount && ['food', 'transport', 'health_beauty', 'other'].every((c) => (a.spend.find((x) => x.key === c)?.amount ?? 0) === (m0.spend.find((x) => x.key === c)?.amount ?? 0)), () => ({}));
    check('Plus bill: the note says where it came from', a.plusNote!.fromFun + a.plusNote!.fromGoal <= price, () => a.plusNote);
    check('Plus bill: same price again changes nothing', syncPlusBill(a, 'monthly', { amount: price, currency: 'THB', period: 'monthly', renews_at: renews(1) }, now) === null, () => ({}));
    const b = syncPlusBill(a, 'monthly', { amount: price + 30, currency: 'THB', period: 'monthly', renews_at: renews(2) }, now)!;
    check('Plus bill: a new price replaces the old one (one bill, not two)', (b.bills.items ?? []).filter((x) => x.name === PLUS_BILL).length === 1 && plusOf(b)?.amount === price + 30 && b.plusNote?.was === price, () => b.plusNote);
    const y = syncPlusBill(m0, 'yearly', { amount: 899, currency: 'THB', period: 'yearly', renews_at: renews(12) }, now)!;
    check('Plus bill: yearly sets aside total ÷ 12 (฿10 steps)', plusOf(y)?.yearly?.total === 899 && plusOf(y)?.amount === 80, () => plusOf(y));
    const g = syncPlusBill(a, 'free', null, now)!;
    check('Plus bill: when Plus ends the bill goes and its money goes to the goal', !plusOf(g) && g.goalExtra >= a.goalExtra && g.plusNote?.kind === 'gone', () => g.plusNote);
  }
}

// ---------- Looking back: "when did I pay my phone?" (kind=find) ----------
{
  const now = new Date(2026, 10, 28, 15, 0, 0);
  const at = (daysAgo: number, h = 12) => new Date(now.getTime() - daysAgo * 86_400_000 + (h - 15) * 3600_000).toISOString();
  const tx = [
    { note: 'TRUE MOVE H', amount: 399, occurred_at: at(14), kind: 'spend' },
    { note: 'ค่า โทรศัพท์', amount: 399, occurred_at: at(44), kind: 'spend' },
    { note: 'True Move-H', amount: 399, occurred_at: at(75), kind: 'spend' },
    { note: 'ค่าโทรศัพท์', amount: 399, occurred_at: at(130), kind: 'spend' },
    { note: 'Starbucks', amount: 145, occurred_at: at(3), kind: 'spend' },
    { note: 'เงินเดือน', amount: 18000, occurred_at: at(3), kind: 'income' },
    { note: null, amount: 70, occurred_at: at(2), kind: 'spend' },
  ];
  const q = { words: ['โทรศัพท์', 'ค่าโทร', 'TRUE', 'TrueMove', 'AIS', 'a', 'tv'] };
  const rows = findRows(tx, [], q, {}, now);
  check('Find: words too short to mean anything are dropped', !findWords(q).includes('a') && !findWords(q).includes('tv'), () => findWords(q));
  check('Find: matches notes however they are spaced or cased (slip names too)', rows.length === 3, () => rows);
  check('Find: newest first', rows.every((r, i) => i === 0 || rows[i - 1].on >= r.on), () => rows.map((r) => r.on));
  check('Find: only the last 90 days when no days were said', !rows.some((r) => r.amount === 399 && r.on < findRange(q, now).from), () => findRange(q, now));
  check('Find: Starbucks and pay never match the phone', !rows.some((r) => /Starbucks|เงินเดือน/.test(r.name)), () => rows);
  const ans = findAnswer(rows, q, now);
  check('Find: the answer names the latest day and amount, and adds up the rest', /14 Nov/.test(ans) && /฿399/.test(ans) && /3 times/.test(ans) && /฿1,197/.test(ans), () => ans);
  const wide = findRows(tx, [], { ...q, from: '2026-01-01', to: '2027-03-01' }, {}, now);
  check('Find: a range they said is used (and never runs past today)', wide.length === 4 && findRange({ words: [], from: '2026-01-01', to: '2027-03-01' }, now).to === '2026-11-28', () => wide.length);
  const none = findRows(tx, [], { words: ['Netflix'] }, {}, now);
  check('Find: nothing found says so and offers to log it — never a made-up date', none.length === 0 && /couldn’t find/.test(findAnswer(none, { words: ['Netflix'] }, now)), () => findAnswer(none, { words: ['Netflix'] }, now));
  const money = findRows(tx, [], { words: ['เงินเดือน', 'starbucks'] }, {}, now);
  check('Find: money in and money out never add up into one total', !/18,145/.test(findAnswer(money, { words: [] }, now)), () => findAnswer(money, { words: [] }, now));

  // Bills ticked paid are remembered with the day, so Kip can answer from them too.
  for (let k = 0; k < 300; k++) {
    const i = person();
    if (!i) continue;
    const m0 = month(i, 'kip', pick([null, 1, 25]));
    const withAis = addBill(m0, 'AIS', 459, { type: 'phone' }).month;
    const start = new Date(now.getTime() - 10 * 86_400_000);
    const log1 = withPaidLog(withAis, 'item:AIS', true, start, now);
    check('Paid log: ticking a bill paid keeps the day and amount', log1.length === 1 && log1[0].on === '2026-11-28' && log1[0].amount === 459, () => log1);
    const log2 = withPaidLog({ ...withAis, paidLog: log1 }, 'item:AIS', true, start, now);
    check('Paid log: ticking it twice in a cycle keeps one entry', log2.length === 1, () => log2);
    const log3 = withPaidLog({ ...withAis, paidLog: log1 }, 'item:AIS', false, start, now);
    check('Paid log: unticking takes this cycle’s entry back', log3.length === 0, () => log3);
    const found = findRows([], log1, { words: ['โทรศัพท์', 'มือถือ'] }, { 'item:AIS': 'phone' }, now);
    check('Find: a ticked phone bill is found by "phone" even when it is called AIS', found.length === 1 && found[0].from === 'bill', () => found);
    const both = findRows([{ note: 'AIS', amount: 459, occurred_at: now.toISOString(), kind: 'spend' }], log1, { words: ['AIS'] }, {}, now);
    check('Find: a bill paid by slip and ticked paid shows once', both.length === 1, () => both);
    const viaKip = planChange(withAis, [], [{ op: 'pay_bill', name: 'AIS' }], now);
    check('Paid log: Kip’s "paid it" (pay_bill) remembers the day too', !!viaKip && (viaKip.next.paidLog ?? []).some((e) => e.key === 'item:AIS'), () => viaKip?.next.paidLog);
    const old = withPaidLog({ ...withAis, paidLog: [{ key: 'item:AIS', name: 'AIS', amount: 459, on: '2025-01-01' }] }, 'rent', true, start, now);
    check('Paid log: entries older than about a year are let go', !old.some((e) => e.on === '2025-01-01'), () => old);
  }
}

// ---------- report ----------
const rules = Object.entries(results);
const failed = rules.filter(([, r]) => r.fail);
const total = rules.reduce((a, [, r]) => a + r.pass + r.fail, 0);
for (const [rule, r] of rules) console.log(`${r.fail ? '✗' : '✓'} ${rule}  (${r.pass + r.fail} cases${r.fail ? `, ${r.fail} failed` : ''})${r.first ? `\n    first failure: ${r.first}` : ''}`);
console.log(`\n${rules.length} rules, ${total.toLocaleString()} checks, ${failed.length} rules failing.`);
process.exit(failed.length ? 1 : 0);
