// "Your month": how this month's money is split, and how it re-balances when a budget changes.
// The numbers come from Kip's brain (brain.ts): 1 saving first (goal + safety net), 2 bills, 3 living + fun by category.
import { livingFor, plan as splitMonth, type Inputs, type Result } from '@/lib/brain';
import { t } from '@/lib/i18n';
import type { BudgetStyle } from '@/lib/setup/draft';
import { colors, money } from '@/theme';

export type CatKey = 'food' | 'transport' | 'shopping' | 'fun' | 'health_beauty' | 'learning' | 'giving' | 'other' | 'spend_freely';
export type IconKey =
  | 'food'
  | 'travel'
  | 'shop'
  | 'fun'
  | 'health'
  | 'book'
  | 'gift'
  | 'more'
  | 'rent'
  | 'bill'
  | 'shield'
  | 'cash'
  | 'plane'
  | 'phone'
  | 'family'
  | 'lipstick'
  | 'shirt'
  | 'note'
  | 'ring'
  | 'sparkle'
  | 'shuffle'
  | 'camera'
  | 'plus';

// Names are getters so they're translated when read, not when this file loads.
export const CATEGORY: Record<CatKey, { name: string; color: string; icon: IconKey }> = {
  food: {
    get name() {
      return t('Food & drinks');
    },
    color: colors.lime,
    icon: 'food',
  },
  transport: {
    get name() {
      return t('Transport');
    },
    color: colors.sky,
    icon: 'travel',
  },
  shopping: {
    get name() {
      return t('Shopping');
    },
    color: colors.pink,
    icon: 'shop',
  },
  fun: {
    get name() {
      return t('Fun');
    },
    color: money.fun,
    icon: 'fun',
  },
  health_beauty: {
    get name() {
      return t('Health & beauty');
    },
    color: colors.lavender,
    icon: 'health',
  },
  learning: {
    get name() {
      return t('Learning');
    },
    color: colors.clay,
    icon: 'book',
  },
  giving: {
    get name() {
      return t('Giving');
    },
    color: colors.peach,
    icon: 'gift',
  },
  other: {
    get name() {
      return t('Household & other');
    },
    color: colors.grey,
    icon: 'more',
  },
  spend_freely: {
    get name() {
      return t('Spend freely');
    },
    color: colors.lime,
    icon: 'cash',
  },
};

export const STYLES: { key: BudgetStyle; name: string; tag: string; tagColor: string; desc: string }[] = [
  {
    key: 'kip',
    get name() {
      return t('Kip’s plan');
    },
    get tag() {
      return t('Recommended');
    },
    tagColor: colors.lime,
    get desc() {
      return t('Living costs first, a little safety net, then as much for your goal as you can comfortably save.');
    },
  },
  {
    key: 'savefirst',
    get name() {
      return t('Save first');
    },
    get tag() {
      return t('Fastest');
    },
    tagColor: colors.sage,
    get desc() {
      return t('The most Kip will plan goes out on payday. The rest is one pot — no categories to track.');
    },
  },
  {
    key: '503020',
    name: '50 / 30 / 20',
    get tag() {
      return t('The classic');
    },
    tagColor: colors.roseBeige,
    get desc() {
      return t('20% saved, the rest on needs and wants.');
    },
  },
  {
    key: 'jars',
    get name() {
      return t('6 Jars');
    },
    get tag() {
      return t('Grow yourself');
    },
    tagColor: colors.lilac,
    get desc() {
      return t('Jars for learning and giving too, plus a bigger safety net.');
    },
  },
];

// ---------- the month ----------

/** What kind of thing it is (picks its icon). Missing = guessed from the name. */
export type BillType = 'rent' | 'utilities' | 'phone' | 'internet' | 'streaming' | 'fitness' | 'insurance' | 'loan' | 'family' | 'other';
/** Something paid every month — a bill, a subscription, money for family. A yearly one (insurance) is set aside monthly:
 *  `amount` is what this month sets aside; `yearly` says how much is due and when (see everymonth.ts). */
export type BillItem = { name: string; amount: number; type?: BillType; yearly?: { total: number; due: string; since: string } };

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
  bills: { rent: number; guess: number; items?: BillItem[] }; // guess = bills Kip hasn't seen yet
  spend: { key: CatKey; amount: number }[];
  /** Bills marked paid this month (cleared when a new month starts). */
  paid?: { period: string; keys: string[] };
  /** The pay cycle whose saving has already moved to the goal and safety net (once per cycle). */
  payMoved?: string;
  /** Taken back from this cycle's goal saving / the safety net to cover going over — added to spending money. */
  covers?: { period: string; goal: number; safety: number; today?: { day: string; amount: number } };
  /** More goals (Plus): how the goal saving is split, in pin order. Missing = all to the first goal. */
  goals?: { id: string; amount: number }[];
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

/** Switch money style: re-plan from the same numbers, keeping the bills you added (Netflix, gym…) and what this
 *  month already has (bills marked paid, the payday move, the goal split). A new style starts from Kip's amount for
 *  the goal unless `goalPerMonth` says otherwise. */
export function withStyle(m: MonthBudget, style: BudgetStyle, goalPerMonth: number | null = m.goalPerMonth): MonthBudget {
  let next = monthFrom(m.inputs, style, goalPerMonth, m.payday, m.safety.target);
  for (const { name, amount, ...extra } of m.bills.items ?? []) next = addBill(next, name, amount, extra).month;
  return { ...next, ...keepOnReplan(m) };
}

/** What any re-plan keeps: the "always" choice, bills marked paid, this cycle's payday move, covers, the goal split. */
export const keepOnReplan = (m: MonthBudget) => ({
  alwaysFreedTo: m.alwaysFreedTo,
  ...(m.paid ? { paid: m.paid } : {}),
  ...(m.payMoved ? { payMoved: m.payMoved } : {}),
  ...(m.covers ? { covers: m.covers } : {}),
  ...(m.goals ? { goals: m.goals } : {}),
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
export const billsTotal = (m: MonthBudget) => m.bills.rent + m.bills.guess + (m.bills.items ?? []).reduce((a, b) => a + b.amount, 0);
export const spendingTotal = (m: MonthBudget) => m.spend.reduce((a, s) => a + s.amount, 0);
export const dailyOf = (m: MonthBudget) => Math.floor(spendingTotal(m) / 30 / 10) * 10;

export type FreedTo = 'goal' | 'food' | 'transport' | 'fun';

/** A budget went down: the freed money goes to the goal, food, transport or fun money — never to bills. */
export function lowerBudget(m: MonthBudget, key: CatKey, to: number, dest: FreedTo): MonthBudget {
  const cur = m.spend.find((s) => s.key === key)?.amount ?? 0;
  const freed = Math.max(0, cur - to);
  const spend = m.spend.map((s) => (s.key === key ? { ...s, amount: to } : s));
  if (dest === 'goal') return { ...m, spend, goalExtra: m.goalExtra + freed };
  const target: CatKey = dest === 'fun' ? (spend.some((s) => s.key === 'fun') ? 'fun' : 'spend_freely') : dest;
  if (!spend.some((s) => s.key === target)) return { ...m, spend, goalExtra: m.goalExtra + freed };
  return { ...m, spend: spend.map((s) => (s.key === target ? { ...s, amount: s.amount + freed } : s)) };
}

// ---------- a new bill (YouTube Premium, a gym, a phone instalment…) ----------
//
// Kip's bill guess exists for exactly this: bills it hasn't seen yet. So a new bill comes out of the guess first —
// often nothing else changes. Beyond the guess: fun money pays (shopping, fun), then the goal slows down.
// Living costs and the safety net are left alone.

export type BillImpact = { month: MonthBudget; fromGuess: number; fromFun: number; fromGoal: number; short: number };

const FUN_KEYS: CatKey[] = ['shopping', 'fun', 'spend_freely', 'learning', 'giving'];

export function addBill(m: MonthBudget, name: string, amount: number, extra: Omit<BillItem, 'name' | 'amount'> = {}): BillImpact {
  let left = Math.max(0, Math.round(amount));
  const fromGuess = Math.min(left, m.bills.guess);
  left -= fromGuess;
  // Fun money, in proportion, down to zero (a bill is a must; fun bends).
  const fun = m.spend.filter((s) => FUN_KEYS.includes(s.key) && s.amount > 0);
  const pool = fun.reduce((a, s) => a + s.amount, 0);
  const fromFun = Math.min(left, pool);
  // In proportion (฿10 steps), then whatever rounding left over goes to whichever still has room — never more than a
  // category has, so nothing goes below ฿0.
  const cut = new Map<CatKey, number>();
  let got = 0;
  for (const s of fun) {
    const c = Math.min(s.amount, round10((fromFun * s.amount) / pool), fromFun - got);
    cut.set(s.key, c);
    got += c;
  }
  for (const s of fun) {
    if (got >= fromFun) break;
    const more = Math.min(s.amount - (cut.get(s.key) ?? 0), fromFun - got);
    cut.set(s.key, (cut.get(s.key) ?? 0) + more);
    got += more;
  }
  left -= fromFun;
  const goalHave = m.goal.amount + m.goalExtra;
  const fromGoal = Math.min(left, goalHave);
  left -= fromGoal;
  const extraCut = Math.min(fromGoal, m.goalExtra);
  return {
    month: {
      ...m,
      bills: { ...m.bills, guess: m.bills.guess - fromGuess, items: [...(m.bills.items ?? []), { ...extra, name, amount }] },
      spend: m.spend.map((s) => ({ ...s, amount: s.amount - (cut.get(s.key) ?? 0) })),
      goalExtra: m.goalExtra - extraCut,
      goal: { ...m.goal, amount: m.goal.amount - (fromGoal - extraCut) },
    },
    fromGuess,
    fromFun,
    fromGoal,
    short: left,
  };
}

/** Remove a bill: the money goes back the way it came — goal first, then fun, then the guess. */
export function removeBill(m: MonthBudget, index: number): MonthBudget {
  const items = [...(m.bills.items ?? [])];
  const [bill] = items.splice(index, 1);
  if (!bill) return m;
  // A bill bigger than everything it could take from left the month short; only the money it really took comes back.
  const short = Math.max(0, billsTotal(m) + savingTotal(m) + spendingTotal(m) - m.income);
  return { ...m, bills: { ...m.bills, items }, goalExtra: m.goalExtra + bill.amount - Math.min(bill.amount, short) };
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
