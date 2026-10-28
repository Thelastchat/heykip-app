// "Your month": how this month's money is split, and how it re-balances when a budget changes.
// The numbers come from Kip's brain (brain.ts): 1 saving first (goal + safety net), 2 bills, 3 living + fun by category.
import { livingFor, plan as splitMonth, type Inputs, type Result } from '@/lib/brain';
import type { BudgetStyle } from '@/lib/setup/draft';
import { colors } from '@/theme';

export type CatKey = 'food' | 'transport' | 'shopping' | 'fun' | 'health_beauty' | 'learning' | 'giving' | 'other' | 'spend_freely';
export type IconKey = 'food' | 'travel' | 'shop' | 'fun' | 'health' | 'book' | 'gift' | 'more' | 'rent' | 'bill' | 'shield' | 'cash' | 'plane' | 'phone';

export const CATEGORY: Record<CatKey, { name: string; color: string; icon: IconKey }> = {
  food: { name: 'Food & drinks', color: colors.lime, icon: 'food' },
  transport: { name: 'Transport', color: colors.sky, icon: 'travel' },
  shopping: { name: 'Shopping', color: colors.orange, icon: 'shop' },
  fun: { name: 'Fun', color: colors.lavender, icon: 'fun' },
  health_beauty: { name: 'Health & beauty', color: colors.lilac, icon: 'health' },
  learning: { name: 'Learning', color: colors.roseBeige, icon: 'book' },
  giving: { name: 'Giving', color: colors.pink, icon: 'gift' },
  other: { name: 'Household & other', color: colors.grey, icon: 'more' },
  spend_freely: { name: 'Spend freely', color: colors.lime, icon: 'cash' },
};

export const STYLES: { key: BudgetStyle; name: string; tag: string; tagColor: string; desc: string }[] = [
  { key: 'kip', name: 'Kip’s plan', tag: 'RECOMMENDED', tagColor: colors.lime, desc: 'Living costs first, a little safety net, then as much for your goal as you can comfortably save.' },
  { key: 'savefirst', name: 'Save first', tag: 'FASTEST', tagColor: colors.sage, desc: 'The most Kip will plan goes out on payday. The rest is one pot — no categories to track.' },
  { key: '503020', name: '50 / 30 / 20', tag: 'THE CLASSIC', tagColor: colors.roseBeige, desc: '20% saved, the rest on needs and wants.' },
  { key: 'jars', name: '6 Jars', tag: 'GROW YOURSELF', tagColor: colors.lilac, desc: 'Jars for learning and giving too, plus a bigger safety net.' },
];

// ---------- the month ----------

export type MonthBudget = {
  v: 2;
  style: BudgetStyle;
  inputs: Inputs; // what Kip planned from — kept so a style switch can re-plan
  goalPerMonth: number | null;
  income: number;
  payday: number | null; // the month runs payday → payday; null = calendar month
  alwaysFreedTo: FreedTo | null; // "Do this every time I lower a budget"
  goal: { title: string; amount: number; isSafetyNet: boolean };
  safety: { amount: number; target: number };
  goalExtra: number; // money moved to the goal from a lowered budget
  bills: { rent: number; guess: number };
  spend: { key: CatKey; amount: number }[];
};

/** Living costs + fun (+ learning and giving) as categories. */
function categories(i: Inputs, r: Result, style: BudgetStyle): { key: CatKey; amount: number }[] {
  const L = livingFor(i);
  if (style === 'savefirst') return [{ key: 'spend_freely', amount: r.living + r.fun + r.learn + r.give }];
  const shopping = Math.floor(r.fun / 2 / 10) * 10;
  return [
    { key: 'food', amount: L.food },
    { key: 'transport', amount: L.transport },
    { key: 'health_beauty', amount: L.health },
    { key: 'other', amount: L.household },
    { key: 'shopping', amount: shopping },
    { key: 'fun', amount: r.fun - shopping },
    ...(r.learn ? [{ key: 'learning' as const, amount: r.learn }] : []),
    ...(r.give ? [{ key: 'giving' as const, amount: r.give }] : []),
  ];
}

export function monthFrom(inputs: Inputs, style: BudgetStyle, goalPerMonth: number | null, payday: number | null, safetyTarget: number): MonthBudget {
  const r = splitMonth(inputs, style, goalPerMonth);
  return {
    v: 2,
    style,
    inputs,
    goalPerMonth,
    income: Math.round(inputs.income),
    payday,
    alwaysFreedTo: null,
    goal: { title: inputs.goal.title || 'Savings', amount: r.goal, isSafetyNet: inputs.goal.type === 'emergency' },
    safety: { amount: r.net + r.invest, target: safetyTarget },
    goalExtra: 0,
    bills: { rent: inputs.rent, guess: inputs.bills },
    spend: categories(inputs, r, style),
  };
}

/** Switch money style: re-plan from the same numbers. */
export const withStyle = (m: MonthBudget, style: BudgetStyle): MonthBudget => ({
  ...monthFrom(m.inputs, style, m.goalPerMonth, m.payday, m.safety.target),
  alwaysFreedTo: m.alwaysFreedTo,
});

const round10 = (n: number) => Math.round(n / 10) * 10;

/** Split an amount by shares, in ฿10 steps, so the parts add up exactly. */
function splitBy(total: number, shares: [CatKey, number][]): { key: CatKey; amount: number }[] {
  const sum = shares.reduce((a, [, s]) => a + s, 0) || 1;
  const parts = shares.map(([key, s]) => ({ key, amount: Math.floor((total * s) / sum / 10) * 10 }));
  const rest = total - parts.reduce((a, p) => a + p.amount, 0);
  if (parts.length) parts[0].amount += rest;
  return parts;
}

export const savingTotal = (m: MonthBudget) => m.goal.amount + m.goalExtra + m.safety.amount;
export const billsTotal = (m: MonthBudget) => m.bills.rent + m.bills.guess;
export const spendingTotal = (m: MonthBudget) => m.spend.reduce((a, s) => a + s.amount, 0);
export const dailyOf = (m: MonthBudget) => Math.floor(spendingTotal(m) / 30 / 10) * 10;

export type FreedTo = 'goal' | 'safety' | 'spread';

/** A budget went down: the freed money goes to the goal, the safety net, or the other categories. */
export function lowerBudget(m: MonthBudget, key: CatKey, to: number, dest: FreedTo): MonthBudget {
  const cur = m.spend.find((s) => s.key === key)?.amount ?? 0;
  const freed = Math.max(0, cur - to);
  const spend = m.spend.map((s) => (s.key === key ? { ...s, amount: to } : s));
  if (dest === 'goal') return { ...m, spend, goalExtra: m.goalExtra + freed };
  if (dest === 'safety') return { ...m, spend, safety: { ...m.safety, amount: m.safety.amount + freed } };
  const others = spend.filter((s) => s.key !== key);
  const add = splitBy(freed, others.map((s) => [s.key, s.amount || 1] as [CatKey, number]));
  return { ...m, spend: spend.map((s) => ({ ...s, amount: s.amount + (add.find((a) => a.key === s.key)?.amount ?? 0) })) };
}

/** A budget went up: take a little from each other category, in proportion. Never from bills, the goal or the safety net. */
/** Living-cost categories Kip won't push below a realistic floor when taking money for another category. */
const FLOOR: Partial<Record<CatKey, number>> = { food: 4500, transport: 1000, health_beauty: 500, other: 500 };

/** A budget went up: take from fun money first (shopping, fun, learning, giving), in proportion.
 *  Only if that isn't enough, take from living costs — never below their realistic floor.
 *  Never from bills, the goal or the safety net. */
export function takePlan(m: MonthBudget, key: CatKey, to: number): { from: CatKey; was: number; now: number }[] {
  const cur = m.spend.find((s) => s.key === key)?.amount ?? 0;
  let left = Math.max(0, to - cur);
  const cuts = new Map<CatKey, number>();
  const takeFrom = (keys: { key: CatKey; spare: number }[]) => {
    const pool = keys.reduce((a, k) => a + k.spare, 0);
    if (pool <= 0 || left <= 0) return;
    const want = Math.min(left, pool);
    let got = 0;
    keys.forEach((k, i) => {
      const cut = i === keys.length - 1 ? Math.min(k.spare, want - got) : Math.min(k.spare, round10((want * k.spare) / pool));
      cuts.set(k.key, (cuts.get(k.key) ?? 0) + cut);
      got += cut;
    });
    left -= got;
  };
  const others = m.spend.filter((s) => s.key !== key);
  takeFrom(others.filter((s) => !(s.key in FLOOR)).map((s) => ({ key: s.key, spare: s.amount })));
  takeFrom(others.filter((s) => s.key in FLOOR).map((s) => ({ key: s.key, spare: Math.max(0, s.amount - (FLOOR[s.key] ?? 0)) })));
  return others.filter((s) => cuts.get(s.key)).map((s) => ({ from: s.key, was: s.amount, now: s.amount - (cuts.get(s.key) ?? 0) }));
}

export function raiseBudget(m: MonthBudget, key: CatKey, to: number): MonthBudget {
  const cuts = takePlan(m, key, to);
  const cur = m.spend.find((s) => s.key === key)?.amount ?? 0;
  const got = cuts.reduce((a, c) => a + (c.was - c.now), 0);
  return {
    ...m,
    spend: m.spend.map((s) => (s.key === key ? { ...s, amount: cur + got } : { ...s, amount: cuts.find((c) => c.from === s.key)?.now ?? s.amount })),
  };
}
