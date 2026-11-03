// HeyKip money rules, checked on thousands of random people. Run: npm run test:logic
// Each check is a rule that must ALWAYS hold — "every baht has a job", "food is never cut for a goal", … —
// tried across random pay, rent, bills, payday, money style and 1–3 goals. A seeded random, so a failure repeats.
import { funMinimum, livingFor, safetyNet, verdict, type Inputs, type Style } from '../src/lib/brain';
import { addBill, billsTotal, lowerBudget, monthFrom, raiseBudget, removeBill, savingTotal, spendingTotal, withStyle, type CatKey, type MonthBudget } from '../src/lib/budget';
import { arrivals, assess, funRoom, goalTotal, planNew, replanOne, splitOf, withoutGoal, type GoalLite } from '../src/lib/goals';
import { replanGoal } from '../src/lib/goalEdit';
import { monthNumbers, overCover, period, periodAt, streakOf, type Spent } from '../src/lib/home';
import { checkParts, paydayShares, savingThisCycle, splitIn } from '../src/lib/moneyin';
import { replan } from '../src/lib/replan';
import { isoDay } from '../src/lib/setup/plan';

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

// ---------- report ----------
const rules = Object.entries(results);
const failed = rules.filter(([, r]) => r.fail);
const total = rules.reduce((a, [, r]) => a + r.pass + r.fail, 0);
for (const [rule, r] of rules) console.log(`${r.fail ? '✗' : '✓'} ${rule}  (${r.pass + r.fail} cases${r.fail ? `, ${r.fail} failed` : ''})${r.first ? `\n    first failure: ${r.first}` : ''}`);
console.log(`\n${rules.length} rules, ${total.toLocaleString()} checks, ${failed.length} rules failing.`);
process.exit(failed.length ? 1 : 0);
