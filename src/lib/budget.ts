// "Your month": how this month's money is split, and how it re-balances when a budget changes.
// Goal-first, always: 1 saving (goal + safety net), 2 bills, 3 everyday spending split into categories.
import type { BudgetStyle } from '@/lib/setup/draft';
import type { Plan } from '@/lib/setup/plan';
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
  other: { name: 'Other', color: colors.grey, icon: 'more' },
  spend_freely: { name: 'Spend freely', color: colors.lime, icon: 'cash' },
};

/** Each style's starting split of everyday spending (shares of 100). */
const SPLIT: Record<BudgetStyle, Partial<Record<CatKey, number>>> = {
  // How Thai households really spend, adjusted for one person (Ministry of Commerce household survey).
  kip: { food: 45, transport: 15, shopping: 10, fun: 10, health_beauty: 8, learning: 4, giving: 3, other: 5 },
  // Needs vs wants: everyday needs first, then a bigger share for fun.
  '503020': { food: 38, transport: 14, health_beauty: 8, other: 5, shopping: 15, fun: 15, learning: 2, giving: 3 },
  // 6 Jars: living, then fun, learning and giving each get a real share.
  jars: { food: 36, transport: 13, shopping: 8, health_beauty: 6, other: 5, fun: 13, learning: 13, giving: 6 },
  // Save first: no tracking — one pot.
  savefirst: { spend_freely: 100 },
};

export const STYLES: { key: BudgetStyle; name: string; tag: string; tagColor: string; desc: string; source: string }[] = [
  {
    key: 'kip',
    name: 'Kip’s plan',
    tag: 'RECOMMENDED',
    tagColor: colors.lime,
    desc: 'Made from your own numbers. Bills first, then a daily budget for food, travel and fun — based on how people in Thailand really spend. I fine-tune it as I learn you.',
    source: 'your answers + Thai household spending (Ministry of Commerce, 2025)',
  },
  {
    key: '503020',
    name: '50 / 30 / 20',
    tag: 'THE CLASSIC',
    tagColor: colors.roseBeige,
    desc: 'Half on needs, a bit less than a third on fun, the rest saved. Easy to remember — works for most people.',
    source: 'Senator Elizabeth Warren & Amelia Warren Tyagi, All Your Worth (2005)',
  },
  {
    key: 'jars',
    name: '6 Jars',
    tag: 'GROW YOURSELF',
    tagColor: colors.lilac,
    desc: 'Six jars: living, fun, learning, giving, saving and investing. For when you want your money to build a better you.',
    source: 'T. Harv Eker, Secrets of the Millionaire Mind',
  },
  {
    key: 'savefirst',
    name: 'Save first',
    tag: 'NO TRACKING',
    tagColor: colors.sage,
    desc: 'Your saving leaves on payday. Whatever’s left is yours — spend it without guilt or spreadsheets.',
    source: '“pay yourself first” — a saying often credited to Warren Buffett',
  },
];

/** The coloured bar on each style card: [share, colour, label]. */
export function styleBar(style: BudgetStyle, plan: Pick<Plan, 'rent' | 'billsGuess' | 'spending' | 'dailySpend'>): [number, string, string][] {
  switch (style) {
    case 'kip': {
      const bills = plan.rent + plan.billsGuess;
      return [
        [bills, colors.clay, `Bills ฿${bills.toLocaleString('en-US')}`],
        [plan.spending, colors.orange, `Spending ฿${plan.spending.toLocaleString('en-US')} · ฿${plan.dailySpend}/day`],
      ];
    }
    case '503020':
      return [[50, colors.clay, 'Needs 50%'], [30, colors.orange, 'Fun 30%'], [20, colors.lime, 'Save 20%']];
    case 'jars':
      return [[55, colors.clay, 'Living 55%'], [10, colors.orange, 'Fun'], [10, colors.lavender, 'Learn'], [5, colors.peach, ''], [10, colors.lime, 'Save'], [10, colors.sky, 'Invest']];
    case 'savefirst':
      return [[20, colors.lime, 'Save'], [80, colors.orange, 'Spend freely']];
  }
}

// ---------- the month ----------

export type MonthBudget = {
  v: 1;
  style: BudgetStyle;
  income: number;
  payday: number | null; // the month runs payday → payday; null = calendar month
  alwaysFreedTo: FreedTo | null; // "Do this every time I lower a budget"
  goal: { title: string; amount: number; isSafetyNet: boolean };
  safety: { amount: number; target: number }; // amount includes the money style's extra saving
  goalExtra: number; // money moved to the goal from a lowered budget
  bills: { rent: number; guess: number };
  spend: { key: CatKey; amount: number }[];
};

const round10 = (n: number) => Math.round(n / 10) * 10;

/** Split an amount by shares, in ฿10 steps, so the parts add up exactly. */
function splitBy(total: number, shares: [CatKey, number][]): { key: CatKey; amount: number }[] {
  const sum = shares.reduce((a, [, s]) => a + s, 0) || 1;
  const parts = shares.map(([key, s]) => ({ key, amount: Math.floor((total * s) / sum / 10) * 10 }));
  const rest = total - parts.reduce((a, p) => a + p.amount, 0);
  if (parts.length) parts[0].amount += rest; // the biggest share (listed first) takes the rounding
  return parts;
}

export function startingMonth(style: BudgetStyle, plan: Plan, goalTitle: string, isSafetyNet: boolean, payday: number | null): MonthBudget {
  const shares = Object.entries(SPLIT[style]) as [CatKey, number][];
  return {
    v: 1,
    style,
    income: Math.round(plan.income),
    payday,
    alwaysFreedTo: null,
    goal: { title: plan.short || goalTitle, amount: plan.mode === 'noRoom' ? 0 : plan.monthlySave, isSafetyNet },
    safety: { amount: plan.safetyMonthly + plan.extraSave, target: plan.safetyTarget },
    goalExtra: 0,
    bills: { rent: plan.rent, guess: plan.billsGuess },
    spend: splitBy(plan.spending, shares),
  };
}

/** Switch money style: keep the goal, safety net and bills; re-split everyday spending. */
export function withStyle(m: MonthBudget, style: BudgetStyle): MonthBudget {
  return { ...m, style, spend: splitBy(spendingTotal(m), Object.entries(SPLIT[style]) as [CatKey, number][]) };
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
export function takePlan(m: MonthBudget, key: CatKey, to: number): { from: CatKey; was: number; now: number }[] {
  const cur = m.spend.find((s) => s.key === key)?.amount ?? 0;
  const others = m.spend.filter((s) => s.key !== key && s.amount > 0);
  const pool = others.reduce((a, s) => a + s.amount, 0);
  const need = Math.min(Math.max(0, to - cur), pool);
  let left = need;
  const cuts = others.map((s, i) => {
    const cut = i === others.length - 1 ? left : Math.min(left, round10((need * s.amount) / pool));
    left -= cut;
    return { from: s.key, was: s.amount, now: s.amount - cut };
  });
  return cuts;
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
