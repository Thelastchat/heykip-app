// Agent Kip, step 2 (approved mockup): Kip notices first. Every time Home opens, the app's own maths looks at the
// real numbers; when something needs a decision, Kip's line on Home becomes a card with the exact change. Nothing
// moves until "Do it", and it can be undone. This is the app's maths, not the AI — free to run, so it's for everyone.
//
// What Kip speaks up about (only things this app can really see):
//   runout   — a budget will run out before payday at the way it's going. Kip moves money in from budgets that
//              have room to spare (what's left after their own days to payday), never from rent, bills, saving or
//              the safety net. If nothing has room, Kip says nothing — no card that can't help.
//   billdue  — a bill with a due day is due today (or late) and isn't ticked: Kip asks if it's paid.
//   sub / subprice / substop / substream — the subscription detective (subs.ts): a payment that repeats and isn't a
//              bill yet, a bill that went up, one that stopped, and what streaming comes to in a year.
//   renew    — Keep or cancel (subscriptions.ts): a subscription renews in 1–3 days. Still using it, or cancel it and
//              let its money go to the goal.
//   leftover — the pay month that just ended had money left over by what you logged. Kip asks (it can't see your
//              bank) whether to put it toward your goal. Only when last month was logged well, early in the new month.
import { addBill, CATEGORY, removeBill, type CatKey, type MonthBudget } from '@/lib/budget';
import { editBill, guessType } from '@/lib/everymonth';
import type { Recap } from '@/lib/recap';
import { findPriceChanges, findRepeats, findStopped, streamingTotal, type LoggedTx } from '@/lib/subs';
import { arrivals, splitOf, type GoalLite } from '@/lib/goals';
import { periodAt, periodKey, type Spent } from '@/lib/home';
import { dueBills, nextDue } from '@/lib/billdue';
import { applyOps } from '@/lib/monthops';
import { renewalNotice, type Renewal } from '@/lib/subscriptions';

/** Days of the pay month that must have passed before a pace means anything. */
const MIN_DAYS = 4;
/** Runs out at least this many days before payday. */
const EARLY = 2;
/** The smallest move worth a card. */
const MIN_MOVE = 200;

export type Move = { key: CatKey; was: number; now: number };

export type Notice =
  | {
      id: string;
      kind: 'runout';
      key: CatKey;
      /** left in that budget now, and how much a day goes on it */
      left: number;
      perDay: number;
      runsOut: Date;
      daysEarly: number;
      /** what's left in each budget before → after (the short budget first) */
      moves: Move[];
      /** a day, after the move, until payday */
      perDayAfter: number;
      next: MonthBudget;
    }
  | {
      id: string;
      kind: 'billdue';
      key: string;
      name: string;
      amount: number;
      date: Date;
      /** 0 = today, above 0 = days late */
      late: number;
    }
  | {
      id: string;
      kind: 'sub';
      name: string;
      amount: number;
      day: number;
      dates: Date[];
      /** where the money comes from: Kip's bill guess, fun money, the goal's saving */
      from: { guess: number; fun: number; goal: number };
      next: MonthBudget;
    }
  | { id: string; kind: 'subprice'; name: string; was: number; now: number; next: MonthBudget }
  | { id: string; kind: 'substop'; name: string; amount: number; next: MonthBudget }
  | { id: string; kind: 'substream'; names: { name: string; amount: number }[]; perYear: number }
  | { id: string; kind: 'recap'; recap: Recap }
  | Renewal
  | {
      id: string;
      kind: 'leftover';
      amount: number;
      goalId: string;
      goalName: string;
      was: Date | null;
      will: Date | null;
    };

/** Last pay month as logged: what went on spending, on how many days, and what extra money was kept for spending. */
export type LastCycle = { total: number; days: number; extra: number; startedBefore: boolean };

type Period = { start: Date; end: Date; total: number; daysLeft: number; dayIndex: number };

const floor50 = (n: number) => Math.max(0, Math.floor(n / 50) * 50);
const ceil50 = (n: number) => Math.max(0, Math.ceil(n / 50) * 50);

/** A budget's money for this pay month (its plan plus extra money kept for it) and what's gone on it. */
function budgetsOf(m: MonthBudget, spent: Spent) {
  return m.spend.map((s) => {
    const budget = s.amount + (spent.extraCats?.[s.key] ?? 0);
    const used = spent.byCat[s.key] ?? 0;
    return { key: s.key, plan: s.amount, budget, used, left: budget - used };
  });
}

/**
 * The budget that runs out soonest before payday, and the move that carries it there. Days already over (today
 * included) count as spent: the pace is what went out over the days before today.
 */
export function runoutNotice(m: MonthBudget, spent: Spent, P: Period, now = new Date(), skip: (id: string) => boolean = () => false): Extract<Notice, { kind: 'runout' }> | null {
  if (P.dayIndex < MIN_DAYS) return null;
  const days = P.daysLeft; // today to payday
  const all = budgetsOf(m, spent);
  const pace = (b: (typeof all)[number]) => b.used / P.dayIndex;
  const planDaily = (b: (typeof all)[number]) => b.budget / P.total;

  const short = all
    .filter((b) => b.used > 0 && b.left > 0 && pace(b) > 0)
    .map((b) => ({ b, lasts: Math.floor(b.left / pace(b)) }))
    .filter((x) => x.lasts <= days - 1 - EARLY)
    .sort((a, b) => a.lasts - b.lasts);

  for (const { b, lasts } of short) {
    const id = `runout:${b.key}:${periodKey(m.payday, now)}`;
    if (skip(id)) continue; // put off or done: the next one gets its turn
    // Enough to reach payday at the plan's own daily amount for it — slower than now, but what the plan allows.
    const need = ceil50(planDaily(b) * days - b.left);
    if (need < MIN_MOVE) continue;
    // Room to spare elsewhere: what's left after their own days to payday, at whichever is more — pace or plan.
    const givers = all
      .filter((g) => g.key !== b.key && g.key !== 'spend_freely')
      .map((g) => ({ g, spare: floor50(g.left - Math.max(pace(g), planDaily(g)) * days) }))
      .filter((x) => x.spare >= 100)
      .sort((a, c) => c.spare - a.spare);
    let still = need;
    const ops: { op: 'move'; from: CatKey; to: CatKey; amount: number }[] = [];
    for (const { g, spare } of givers) {
      if (still <= 0) break;
      const amount = Math.min(spare, still);
      ops.push({ op: 'move', from: g.key, to: b.key, amount });
      still -= amount;
    }
    const total = need - Math.max(0, still);
    if (total < MIN_MOVE) continue;
    const next = applyOps(m, ops);
    if (!next) continue;
    const moves: Move[] = [
      { key: b.key, was: b.left, now: b.left + total },
      ...ops.map((o) => {
        const g = all.find((x) => x.key === o.from)!;
        return { key: o.from, was: g.left, now: g.left - o.amount };
      }),
    ];
    const runsOut = new Date(now.getFullYear(), now.getMonth(), now.getDate() + lasts);
    return {
      id,
      kind: 'runout',
      key: b.key,
      left: b.left,
      perDay: Math.round(pace(b) / 10) * 10,
      runsOut,
      daysEarly: days - 1 - lasts,
      moves,
      perDayAfter: Math.floor((b.left + total) / days / 10) * 10,
      next,
    };
  }
  return null;
}

/**
 * Money left over from the pay month that just ended, by what was logged. Only in the first week of the new month,
 * only when last month was logged from its start on at least half its days — otherwise "left over" is just
 * spending nobody logged.
 */
export function leftoverNotice(m: MonthBudget, last: LastCycle, P: Period, goals: (GoalLite & { title: string })[], now = new Date()): Extract<Notice, { kind: 'leftover' }> | null {
  const goal = goals[0];
  if (!goal || P.dayIndex > 6 || !last.startedBefore) return null;
  const prev = periodAt(m.payday, -1, now);
  if (last.days < Math.ceil(prev.total / 2)) return null;
  const budget = m.spend.reduce((a, s) => a + s.amount, 0) + last.extra;
  const amount = Math.floor((budget - last.total) / 100) * 100;
  if (amount < 300) return null;
  const lites = goals.map(({ title: _t, ...g }) => g);
  const was = goal.kind !== 'monthly' ? (arrivals(lites, splitOf(m, lites), m.payday, now).get(goal.id) ?? null) : null;
  const after = lites.map((g) => (g.id === goal.id ? { ...g, saved: g.saved + amount } : g));
  const will = goal.kind !== 'monthly' ? (arrivals(after, splitOf(m, after), m.payday, now).get(goal.id) ?? null) : null;
  return { id: `leftover:${prev.start.toDateString()}`, kind: 'leftover', amount, goalId: goal.id, goalName: goal.title, was, will };
}

/** A bill due today or late that isn't ticked — the latest-due first. */
export function billNotice(m: MonthBudget, now = new Date(), skip: (id: string) => boolean = () => false): Extract<Notice, { kind: 'billdue' }> | null {
  const due = dueBills(m, now)
    .filter((b) => !b.paid)
    .map((b) => ({ b, d: nextDue(b, m.payday, now) }))
    .filter((x) => x.d && x.d.days <= 0)
    .sort((a, c) => a.d!.days - c.d!.days);
  for (const { b, d } of due) {
    const id = `billdue:${b.key}:${d!.date.toDateString()}`;
    if (skip(id)) continue;
    return { id, kind: 'billdue', key: b.key, name: b.name, amount: b.amount, date: d!.date, late: -d!.days };
  }
  return null;
}

/** The subscription detective's cards, in order: new ones first, then changes to ones you have. */
export function subNotices(m: MonthBudget, tx: LoggedTx[], now = new Date()): Notice[] {
  const out: Notice[] = [];
  for (const r of findRepeats(tx, m, now)) {
    const res = addBill(m, r.name, r.amount, { type: guessType(r.name), day: r.day, remind: 'before' });
    if (res.short > 0) continue; // doesn't fit this month: never an overspent plan
    out.push({ id: `sub:${r.key}`, kind: 'sub', name: r.name, amount: r.amount, day: r.day, dates: r.dates, from: { guess: res.fromGuess, fun: res.fromFun, goal: res.fromGoal }, next: res.month });
  }
  for (const p of findPriceChanges(tx, m)) {
    const e = editBill(m, p.index, { perMonth: p.now });
    if (e) out.push({ id: `subprice:${p.name}:${p.now}`, kind: 'subprice', name: p.name, was: p.was, now: p.now, next: e.month });
  }
  for (const st of findStopped(tx, m, now)) out.push({ id: `substop:${st.name}`, kind: 'substop', name: st.name, amount: st.amount, next: removeBill(m, st.index) });
  const s = streamingTotal(m);
  if (s) {
    const names = (m.bills.items ?? []).filter((b) => s.names.includes(b.name)).map((b) => ({ name: b.name, amount: b.amount }));
    out.push({ id: `substream:${[...s.names].sort().join('+')}`, kind: 'substream', names, perYear: s.perYear });
  }
  return out;
}

/** Everything Kip would say now, most urgent first, minus what was put off ("Not now") or done. */
export function noticesFor(
  m: MonthBudget | null,
  spent: Spent,
  P: Period,
  last: LastCycle | null,
  goals: (GoalLite & { title: string })[],
  hidden: Record<string, number>,
  now = new Date(),
  tx: LoggedTx[] = [],
  recap: Recap | null = null,
): Notice[] {
  if (!m) return [];
  const out: Notice[] = [];
  const off = (id: string) => hidden[id] > now.getTime();
  // Payday: the recap leads, and the left-over and subscription cards it carries don't show twice.
  // (While the recap's days last, its suggestions live in the recap — opened or not — not as cards of their own.)
  if (recap) {
    if (!off(recap.id)) out.push({ id: recap.id, kind: 'recap', recap });
    hidden = { ...hidden, ...Object.fromEntries(recap.suggestions.map((x) => [x.id, Infinity])) };
  }
  const r = runoutNotice(m, spent, P, now, (id) => hidden[id] > now.getTime());
  if (r) out.push(r);
  const off2 = (id: string) => hidden[id] > now.getTime();
  const b = billNotice(m, now, off2);
  if (b) out.push(b);
  const rn = renewalNotice(m, now, off2);
  if (rn) out.push(rn);
  const subs = subNotices(m, tx, now).filter((n) => !off2(n.id));
  out.push(...subs.filter((n) => n.kind !== 'substream'));
  const l = last ? leftoverNotice(m, last, P, goals, now) : null;
  if (l) out.push(l);
  out.push(...subs.filter((n) => n.kind === 'substream')); // just so you see it: last
  return out.filter((n) => !off2(n.id));
}

/** "Not now" puts a card off for 3 days. */
export const LATER_MS = 3 * 86_400_000;

/** How long each "no" puts a card away: Not a bill — a year; Keep it — 2 months; Got it — half a year. */
export function laterFor(n: Notice, now = new Date()): number {
  const day = 86_400_000;
  if (n.kind === 'billdue' || n.kind === 'recap') return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  // Still using it: quiet until the day after it renews (the next renewal asks again).
  if (n.kind === 'renew') return new Date(n.date.getFullYear(), n.date.getMonth(), n.date.getDate() + 1).getTime();
  if (n.kind === 'sub') return now.getTime() + 365 * day;
  if (n.kind === 'substop') return now.getTime() + 60 * day;
  if (n.kind === 'substream') return now.getTime() + 182 * day;
  if (n.kind === 'subprice') return now.getTime() + 30 * day;
  return now.getTime() + LATER_MS;
}

export const catName = (k: CatKey) => CATEGORY[k].name;
