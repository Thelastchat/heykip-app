// HeyKip money rules, checked on thousands of random people. Run: npm run test:logic
// Each check is a rule that must ALWAYS hold — "every baht has a job", "food is never cut for a goal", … —
// tried across random pay, rent, bills, payday, money style and 1–3 goals. A seeded random, so a failure repeats.
import { funMinimum, livingFor, safetyNet, verdict, type Inputs, type Style } from '../src/lib/brain';
import { addBill, billsTotal, lowerBudget, monthFrom, raiseBudget, removeBill, savingTotal, spendingTotal, withStyle, type CatKey, type MonthBudget } from '../src/lib/budget';
import { arrivals, assess, funRoom, goalTotal, planNew, replanOne, splitOf, withoutGoal, type GoalLite } from '../src/lib/goals';
import { replanGoal } from '../src/lib/goalEdit';
import { monthNumbers, overCover, period, periodAt, streakOf, type Spent } from '../src/lib/home';
import { checkParts, paydayMoves, paydayShares, savingThisCycle, splitIn } from '../src/lib/moneyin';
import { replan } from '../src/lib/replan';
import { guessType, matchBill, monthsToDue, nextDue, readyOf, rollYearly, yearlySetAside } from '../src/lib/everymonth';
import { isoDay, dayInMonth } from '../src/lib/setup/plan';
import { catchUpRows } from '../src/lib/catchup';
import { paceOf } from '../src/lib/pace';
import { editBill } from '../src/lib/everymonth';
import { planChange, planFix, type AgentOp } from '../src/lib/agent';
import { dayOpen, daysFrom, earliestDay, monthAt, monthGrid, OLDEST } from '../src/lib/calendar';

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
  const OPS = ['move', 'set', 'add_bill', 'remove_bill', 'pay_bill', 'to_goal', 'take_goal', 'style'] as const;
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
        style: pick(['kip', '503020', 'jars', 'savefirst']),
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
  check('Agent: switching to the style you already have is refused', planChange(m, [lite], [{ op: 'style', style: m.style }]) === null, () => m.style);
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

// ---------- report ----------
const rules = Object.entries(results);
const failed = rules.filter(([, r]) => r.fail);
const total = rules.reduce((a, [, r]) => a + r.pass + r.fail, 0);
for (const [rule, r] of rules) console.log(`${r.fail ? '✗' : '✓'} ${rule}  (${r.pass + r.fail} cases${r.fail ? `, ${r.fail} failed` : ''})${r.first ? `\n    first failure: ${r.first}` : ''}`);
console.log(`\n${rules.length} rules, ${total.toLocaleString()} checks, ${failed.length} rules failing.`);
process.exit(failed.length ? 1 : 0);
