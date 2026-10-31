// Changing the basics (usual pay, payday, rent) from Profile: Kip re-plans the month the same way Setup does,
// then puts back what the person already set up — the bills they added, bills marked paid, their "always" choice.
// The goal's saved amount and months left come from today, not from the day they signed up.
import { billsGuess, safetyNet } from '@/lib/brain';
import { addBill, dailyOf, monthFrom, type MonthBudget } from '@/lib/budget';
import { EMPTY_DRAFT, type SetupDraft } from '@/lib/setup/draft';
import { incomeBasis, monthsUntil, monthYear } from '@/lib/setup/plan';

export type Basics = {
  incomeType: 'regular' | 'changes';
  monthlyIncome: number | null;
  slowMonth: number | null;
  goodMonth: number | null;
  payday: number | null;
  rent: number;
};

export type GoalNow = { saved: number; target: number; due: string | null; isMonthly: boolean } | null;

/** The income Kip plans on for these basics: salary, or a slow month (the average if a slow month can't cover the basics). */
export function plannedOn(b: Basics, bills: number): number {
  const draft: SetupDraft = { ...EMPTY_DRAFT, incomeType: b.incomeType, monthlyIncome: b.monthlyIncome, slowMonth: b.slowMonth, goodMonth: b.goodMonth, rent: b.rent, bills };
  return incomeBasis(draft).income;
}

export function replan(m: MonthBudget, b: Basics, goal: GoalNow, now = new Date()): MonthBudget {
  // Bills: if they never changed Kip's guess, the guess follows the new income.
  const oldIncome = m.inputs.income;
  const billsWereGuess = m.inputs.bills === billsGuess(oldIncome);
  const income0 = plannedOn(b, m.inputs.bills);
  const bills = billsWereGuess ? billsGuess(income0) : m.inputs.bills;
  const income = plannedOn(b, bills);
  const inputs = {
    ...m.inputs,
    income,
    rent: b.rent,
    bills,
    goal: goal
      ? { ...m.inputs.goal, saved: goal.saved, target: goal.isMonthly ? m.inputs.goal.target : goal.target, months: goal.isMonthly || !goal.due ? null : monthsUntil(goal.due, now) }
      : m.inputs.goal,
  };
  const payday = b.incomeType === 'regular' ? b.payday : null;
  let next = monthFrom(inputs, m.style, m.goalPerMonth, payday, safetyNet(inputs).target);
  for (const bill of m.bills.items ?? []) next = addBill(next, bill.name, bill.amount).month;
  return { ...next, alwaysFreedTo: m.alwaysFreedTo, ...(m.paid ? { paid: m.paid } : {}) };
}

/** When the goal arrives at this month's pace (null for monthly goals and when nothing goes to it). */
export function arrivesWith(m: MonthBudget, goal: GoalNow, now = new Date()): string | null {
  if (!goal || goal.isMonthly || goal.target <= 0) return null;
  const per = m.goal.amount + m.goalExtra;
  const left = Math.max(0, goal.target - goal.saved);
  if (left === 0) return 'Done';
  if (per <= 0) return null;
  const months = Math.ceil(left / per);
  return monthYear(new Date(now.getFullYear(), now.getMonth() + months, 1));
}

/** What changes, side by side — the numbers people feel. */
export function compare(before: MonthBudget, after: MonthBudget, goal: GoalNow) {
  return {
    daily: [dailyOf(before), dailyOf(after)] as const,
    goal: [before.goal.amount + before.goalExtra, after.goal.amount + after.goalExtra] as const,
    safety: [before.safety.amount, after.safety.amount] as const,
    arrives: [arrivesWith(before, goal), arrivesWith(after, goal)] as const,
  };
}
