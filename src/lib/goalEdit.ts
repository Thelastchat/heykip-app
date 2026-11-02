// Editing a goal after setup (approved mockup). Changing the name, photo or promise touches no money. Changing how
// much or by when re-plans the month the way Setup does — keeping the date (save more each month) or keeping the
// monthly amount (it arrives later) — and puts back what the person already set up this month.
import { safetyNet } from '@/lib/brain';
import { addBill, keepOnReplan, monthFrom, type MonthBudget } from '@/lib/budget';
import { monthNumbers, type HomeGoal, type Spent } from '@/lib/home';
import { arrivesWith } from '@/lib/replan';
import { isoDay, monthsUntil, parseDay } from '@/lib/setup/plan';

export type GoalDraft = { title: string; target: number | null; due: string | null; monthly: number | null };
export type Keep = 'date' | 'monthly';

export const draftOf = (g: HomeGoal): GoalDraft => ({ title: g.title, target: g.kind === 'monthly' ? null : g.target, due: g.due, monthly: g.kind === 'monthly' ? (g.monthly ?? null) : null });

const sameMonth = (a: string | null, b: string | null) => (a && b ? a.slice(0, 7) === b.slice(0, 7) : a === b);

/** What changed, in the terms the screen cares about. */
export function changes(g: HomeGoal, d: GoalDraft) {
  const monthly = g.kind === 'monthly';
  const target = !monthly && d.target !== g.target;
  const date = !monthly && !sameMonth(d.due, g.due);
  const each = monthly && d.monthly !== (g.monthly ?? null);
  return { title: d.title.trim() !== g.title, target, date, each, money: target || date || each };
}

/** Is the draft complete enough to save? */
export function valid(g: HomeGoal, d: GoalDraft, now = new Date()) {
  if (!d.title.trim()) return false;
  if (g.kind === 'monthly') return (d.monthly ?? 0) > 0;
  if (!d.target || d.target <= g.saved) return false;
  return !d.due || parseDay(d.due).getTime() > now.getTime();
}

/** The month (and the goal's new date) after this edit. Only call when money changed. */
export function replanGoal(m: MonthBudget, g: HomeGoal, d: GoalDraft, keep: Keep, now = new Date()): { month: MonthBudget; due: string | null } {
  const monthly = g.kind === 'monthly';
  const perNow = m.goal.amount + m.goalExtra;
  let goalPerMonth: number | null;
  let due: string | null = d.due;
  let goal = { ...m.inputs.goal, title: d.title.trim(), saved: g.saved };

  if (monthly) {
    goalPerMonth = d.monthly ?? 0;
    goal = { ...goal, monthly: goalPerMonth, target: goalPerMonth * 12, months: null };
  } else if (keep === 'monthly' && perNow > 0) {
    // Same amount each month: the date moves to whenever that amount gets there.
    goalPerMonth = perNow;
    const months = Math.ceil(Math.max(0, (d.target ?? 0) - g.saved) / perNow);
    due = isoDay(new Date(now.getFullYear(), now.getMonth() + months, m.payday ?? 1));
    goal = { ...goal, target: d.target ?? 0, months: null };
  } else {
    // Same date (or a new one): Kip works out the monthly amount, the way Setup does.
    goalPerMonth = null;
    goal = { ...goal, target: d.target ?? 0, months: d.due ? monthsUntil(d.due, now) : null };
  }

  const inputs = { ...m.inputs, goal };
  let next = monthFrom(inputs, m.style, goalPerMonth, m.payday, safetyNet(inputs).target);
  for (const bill of m.bills.items ?? []) next = addBill(next, bill.name, bill.amount).month;
  next = { ...next, ...keepOnReplan(m) };
  return { month: next, due };
}

/** Only the name changed: the plan keeps every number and just learns the new name. */
export const renamed = (m: MonthBudget, title: string): MonthBudget => ({ ...m, goal: { ...m.goal, title }, inputs: { ...m.inputs, goal: { ...m.inputs.goal, title } } });

/** Before → after for the rows under Kip's question: each month, today's money (the same number Home shows), and when it arrives. */
export function preview(before: MonthBudget, after: MonthBudget, g: HomeGoal, d: GoalDraft, due: string | null, spent: Spent, now = new Date()) {
  const monthly = g.kind === 'monthly';
  const was = arrivesWith(before, { saved: g.saved, target: g.target, due: g.due, isMonthly: monthly }, now);
  const will = arrivesWith(after, { saved: g.saved, target: d.target ?? g.target, due, isMonthly: monthly }, now);
  return {
    each: [before.goal.amount + before.goalExtra, after.goal.amount + after.goalExtra] as const,
    daily: [monthNumbers(before, spent, now).dailyToday, monthNumbers(after, spent, now).dailyToday] as const,
    arrives: [was, will] as const,
  };
}
