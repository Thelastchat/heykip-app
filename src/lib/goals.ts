// More goals (Plus, approved mockup "fridge door"): up to 3 pinned goals share the month's goal saving.
//
// · The month plan keeps ONE goal-saving total (m.goal.amount + m.goalExtra) — the money engine (brain.ts) decides
//   how much the month can save without touching food, transport or bills. `m.goals` says how that total is split,
//   in pin order. No split stored (one goal, or an old plan) = everything goes to the first goal.
// · A goal that is reached passes its share to the first goal still going, so the money keeps working.
// · The timeline simulates payday by payday, so "Phone first" shows the real dates for both goals.
import { funMinimum, livingFor, livingTotal, safetyNet } from '@/lib/brain';
import { addBill, keepOnReplan, monthFrom, type MonthBudget } from '@/lib/budget';
import { isoDay, monthsUntil } from '@/lib/setup/plan';

export type GoalLite = { id: string; kind: string; target: number; saved: number; due: string | null; monthly: number | null };
export const MAX_GOALS = 3;

const isMonthly = (g: GoalLite) => g.kind === 'monthly';
const reached = (g: GoalLite) => !isMonthly(g) && g.target > 0 && g.saved >= g.target;
const up50 = (n: number) => Math.ceil(n / 50) * 50;

export const goalTotal = (m: MonthBudget) => m.goal.amount + m.goalExtra;

/** What each goal gets this month, in pin order. Always adds up to the month's goal saving. */
export function splitOf(m: MonthBudget, goals: GoalLite[]): Map<string, number> {
  const total = goalTotal(m);
  const out = new Map<string, number>();
  if (!goals.length) return out;
  const planned = new Map((m.goals ?? []).map((x) => [x.id, x.amount]));
  let used = 0;
  goals.forEach((g, i) => {
    const a = i === 0 ? 0 : Math.max(0, planned.get(g.id) ?? 0);
    out.set(g.id, a);
    used += a;
  });
  // The first goal gets the rest (and anything a lowered budget freed up, goalExtra).
  out.set(goals[0].id, Math.max(0, total - used));
  // Too little for the plan (e.g. the engine saved less this month): trim from the last goal up.
  let over = used - total;
  for (let i = goals.length - 1; i > 0 && over > 0; i--) {
    const cut = Math.min(over, out.get(goals[i].id) ?? 0);
    out.set(goals[i].id, (out.get(goals[i].id) ?? 0) - cut);
    over -= cut;
  }
  // A reached goal hands its share to the first goal still going.
  const going = goals.find((g) => !reached(g));
  if (going)
    for (const g of goals)
      if (reached(g) && g.id !== going.id) {
        out.set(going.id, (out.get(going.id) ?? 0) + (out.get(g.id) ?? 0));
        out.set(g.id, 0);
      }
  return out;
}

/**
 * When each goal arrives, payday by payday. A goal that finishes passes its monthly amount to the first goal still
 * going (pin order). Monthly goals never "arrive". null = not within 10 years at these amounts.
 */
export function arrivals(goals: GoalLite[], amounts: Map<string, number>, payday: number | null, now = new Date()): Map<string, Date | null> {
  const left = new Map(goals.map((g) => [g.id, isMonthly(g) ? Infinity : Math.max(0, g.target - g.saved)]));
  const per = new Map(goals.map((g) => [g.id, amounts.get(g.id) ?? 0]));
  const out = new Map<string, Date | null>(goals.map((g) => [g.id, null]));
  const at = (k: number) => new Date(now.getFullYear(), now.getMonth() + k, payday ?? 1);
  for (const g of goals) if (!isMonthly(g) && (left.get(g.id) ?? 0) <= 0) out.set(g.id, now);
  for (let k = 1; k <= 120; k++) {
    let freed = 0;
    for (const g of goals) {
      const l = left.get(g.id) ?? 0;
      if (l <= 0 || l === Infinity) continue;
      const nl = l - (per.get(g.id) ?? 0);
      left.set(g.id, nl);
      if (nl <= 0) {
        out.set(g.id, at(k));
        freed += per.get(g.id) ?? 0;
        per.set(g.id, 0);
      }
    }
    if (freed) {
      const next = goals.find((g) => (left.get(g.id) ?? 0) > 0);
      if (next) per.set(next.id, (per.get(next.id) ?? 0) + freed);
    }
    if (goals.every((g) => isMonthly(g) || (left.get(g.id) ?? 0) <= 0)) break;
  }
  return out;
}

/** Re-plan the month with a new goal-saving total, keeping everything the person already set up this month. */
export function withGoalTotal(m: MonthBudget, total: number, split: { id: string; amount: number }[] | undefined): MonthBudget {
  let next = monthFrom(m.inputs, m.style, Math.max(0, Math.round(total)), m.payday, safetyNet(m.inputs).target);
  for (const bill of m.bills.items ?? []) next = addBill(next, bill.name, bill.amount).month;
  return carry(m, { ...next, ...(split ? { goals: split } : {}) });
}

/** What a re-plan must never lose (see keepOnReplan); the goal split is set by the caller. */
export function carry(from: MonthBudget, to: MonthBudget): MonthBudget {
  const { goals: _drop, ...keep } = keepOnReplan(from) as ReturnType<typeof keepOnReplan> & { goals?: unknown };
  return { ...to, ...keep, ...(to.goals ? { goals: to.goals } : {}) };
}

/** How much more a month can save by lowering shopping and fun — never below Kip's fun minimum, never food or bills. */
export function funRoom(m: MonthBudget): number {
  const amt = (k: string) => m.spend.find((s) => s.key === k)?.amount ?? 0;
  const fun = m.spend.some((s) => s.key === 'spend_freely') ? amt('spend_freely') - livingTotal(livingFor(m.inputs)) : amt('shopping') + amt('fun');
  return Math.max(0, Math.floor((fun - funMinimum(m.inputs.income)) / 50) * 50);
}

export type NewGoal = { target: number; due: string | null; monthly: number | null; kind: string };
export type First = 'old' | 'new';

/**
 * A new goal joins. Kip finds what the month can still save without touching food, transport or bills (shopping and
 * fun pay first, down to their minimum). "old" = the goals you have keep their amounts and the new one gets what's
 * found. "new" = the new one gets what it needs for its date, topped up from the other goals (last pin first).
 */
export function planNew(m: MonthBudget, goals: GoalLite[], ng: NewGoal, first: First, now = new Date()) {
  const total = goalTotal(m);
  const months = !ng.monthly && ng.due ? monthsUntil(ng.due, now) : null;
  const need = ng.monthly ? ng.monthly : months ? up50(ng.target / months) : null;
  // How much more the month can save at most.
  const probe = withGoalTotal(m, total + (need ?? 50_000), undefined);
  const found = Math.min(Math.max(0, goalTotal(probe) - total), funRoom(m));

  const split = splitOf(m, goals);
  let amount: number;
  let fromSpend: number;
  if (first === 'old' || need === null) {
    amount = need === null ? found : Math.min(need, found);
    fromSpend = amount;
  } else {
    fromSpend = Math.min(need, found);
    let rest = need - fromSpend;
    for (let i = goals.length - 1; i >= 0 && rest > 0; i--) {
      const g = goals[i];
      const cut = Math.min(rest, split.get(g.id) ?? 0);
      split.set(g.id, (split.get(g.id) ?? 0) - cut);
      rest -= cut;
    }
    amount = need - rest;
  }
  const NEW = 'new';
  const order = [...goals.map((g) => ({ id: g.id, amount: split.get(g.id) ?? 0 })), { id: NEW, amount }];
  const month = withGoalTotal(m, total + fromSpend, order);
  // The engine may still save a little less than asked: the new goal absorbs the difference.
  const short = total + fromSpend - goalTotal(month);
  if (short > 0) {
    amount = Math.max(0, amount - short);
    month.goals = order.map((x) => (x.id === NEW ? { ...x, amount } : x));
  }
  const all: GoalLite[] = [...goals, { id: NEW, kind: ng.kind, target: ng.monthly ? 0 : ng.target, saved: 0, due: ng.due, monthly: ng.monthly }];
  const amounts = splitOf(month, all);
  return { month, need, found, amount, amounts, arrive: arrivals(all, amounts, m.payday, now), goals: all, newId: NEW };
}

/** The new goal's real id, once it's saved. */
export const renameSplit = (m: MonthBudget, from: string, to: string): MonthBudget => ({ ...m, goals: (m.goals ?? []).map((x) => (x.id === from ? { ...x, id: to } : x)) });

/**
 * One goal of several changed its amount or date. "date" = it saves what it needs to arrive on its date;
 * "monthly" = it keeps its monthly amount and the date moves. Only that goal's share (and the total) changes.
 */
export function replanOne(m: MonthBudget, goals: GoalLite[], id: string, next: { target: number; due: string | null; monthly: number | null }, keep: 'date' | 'monthly', now = new Date()) {
  const split = splitOf(m, goals);
  const was = split.get(id) ?? 0;
  const g = goals.find((x) => x.id === id)!;
  const changed: GoalLite = { ...g, target: next.monthly ? next.monthly * 12 : next.target, due: next.due, monthly: next.monthly };
  let want = was;
  if (next.monthly) want = next.monthly;
  else if (keep === 'date' && next.due) want = up50(Math.max(0, changed.target - g.saved) / Math.max(1, monthsUntil(next.due, now)));
  // More than before only as far as shopping and fun can give.
  if (want > was) want = was + Math.min(want - was, funRoom(m));
  const total = goalTotal(m) - was + want;
  const order = goals.map((x) => ({ id: x.id, amount: x.id === id ? want : (split.get(x.id) ?? 0) }));
  const month = withGoalTotal(m, total, order);
  const short = total - goalTotal(month);
  if (short > 0) month.goals = order.map((x) => (x.id === id ? { ...x, amount: Math.max(0, want - short) } : x));
  const all = goals.map((x) => (x.id === id ? changed : x));
  const amounts = splitOf(month, all);
  const arrive = arrivals(all, amounts, m.payday, now);
  const due = !next.monthly && keep === 'monthly' ? (arrive.get(id) ? isoDay(arrive.get(id)!) : next.due) : next.due;
  return { month, amounts, arrive, due, was, now: amounts.get(id) ?? 0 };
}

/** A goal leaves the board (removed or swapped): its share goes back to the first goal. */
export function withoutGoal(m: MonthBudget, goals: GoalLite[], id: string): MonthBudget {
  const rest = goals.filter((g) => g.id !== id);
  const split = splitOf(m, goals);
  if (!rest.length) return m;
  const order = rest.map((g, i) => ({ id: g.id, amount: (split.get(g.id) ?? 0) + (i === 0 ? (split.get(id) ?? 0) : 0) }));
  return { ...m, goals: order };
}

/** The first goal's planned date after it moved to pin 1 or a split changed — for the goal row. */
export const dueFrom = (d: Date | null | undefined) => (d ? isoDay(d) : null);
