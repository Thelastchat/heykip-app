// Agent Kip, step 2 (approved mockup): Kip notices first. Every time Home opens, the app's own maths looks at the
// real numbers; when something needs a decision, Kip's line on Home becomes a card with the exact change. Nothing
// moves until "Do it", and it can be undone. This is the app's maths, not the AI — free to run, so it's for everyone.
//
// What Kip speaks up about (only things this app can really see):
//   runout   — a budget will run out before payday at the way it's going. Kip moves money in from budgets that
//              have room to spare (what's left after their own days to payday), never from rent, bills, saving or
//              the safety net. If nothing has room, Kip says nothing — no card that can't help.
//   leftover — the pay month that just ended had money left over by what you logged. Kip asks (it can't see your
//              bank) whether to put it toward your goal. Only when last month was logged well, early in the new month.
import { CATEGORY, type CatKey, type MonthBudget } from '@/lib/budget';
import { arrivals, splitOf, type GoalLite } from '@/lib/goals';
import { periodAt, periodKey, type Spent } from '@/lib/home';
import { applyOps } from '@/lib/monthops';

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

/** Everything Kip would say now, most urgent first, minus what was put off ("Not now") or done. */
export function noticesFor(
  m: MonthBudget | null,
  spent: Spent,
  P: Period,
  last: LastCycle | null,
  goals: (GoalLite & { title: string })[],
  hidden: Record<string, number>,
  now = new Date(),
): Notice[] {
  if (!m) return [];
  const out: Notice[] = [];
  const off = (id: string) => hidden[id] > now.getTime();
  const r = runoutNotice(m, spent, P, now, off);
  if (r) out.push(r);
  const l = last ? leftoverNotice(m, last, P, goals, now) : null;
  if (l) out.push(l);
  return out.filter((n) => !off(n.id));
}

/** "Not now" puts a card off for 3 days. */
export const LATER_MS = 3 * 86_400_000;

export const catName = (k: CatKey) => CATEGORY[k].name;
