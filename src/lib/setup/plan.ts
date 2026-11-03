import { billsGuess, living, livingFor, livingTotal, plan as splitMonth, room, safetyNet, verdict, type GoalType, type Inputs, type Result, type Verdict } from '@/lib/brain';
import type { SideIncome } from './draft';
import { getLang, monthLong, monthShort, shownYear, t } from '@/lib/i18n';

import { baht } from '@/lib/money';

import { plannedIncome, type GoalKind, type Leak, type SetupDraft } from './draft';

// Kip's plan for Setup, worked out from what the person told us. The maths lives in brain.ts
// (realistic living costs → safety net → goal → fun); this file turns it into dates and words.

export type Plan = {
  inputs: Inputs;
  short: string; // "Copenhagen"
  verdict: Verdict; // does the goal fit, as asked?
  result: Result; // the month, split by the chosen money style
  due: Date; // when the goal is reached at this pace
  daysToGo: number;
  monthlySave: number; // to the goal
  safetyMonthly: number;
  dailySpend: number;
  dailySaving: number; // goal + safety net, per day (for the paywall)
  mode: 'ok' | 'stretch' | 'noRoom'; // fits · not as asked · nothing spare yet
  incomeBasis: 'salary' | 'slow' | 'average';
  changes: string[];
  stays: string[];
  moment: { title: string; sub: string };
  promiseMain: string;
  promiseBackup: string;
};

// ---------- dates ----------

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The given day of a month, pulled back to the month's last day when needed (31st in February → 28th). */
/** That day in that month — the 31st becomes the 30th (or 28th) in a shorter month, never the 1st of the next. */
export function dayInMonth(year: number, month: number, day: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

export const shortDate = (d: Date) => `${d.getDate()} ${monthShort(d.getMonth())}`;
export const longDate = (d: Date) => `${d.getDate()} ${monthLong(d.getMonth())}`;
// Years: Buddhist era (2570) in Thai, or when the phone uses the Buddhist calendar — see i18n.
// Dates are still stored the normal way (2026).
export { shownYear };

export const fullDate = (d: Date) => `${d.getDate()} ${monthShort(d.getMonth())} ${shownYear(d)}`;

export function ordinal(n: number) {
  if (getLang() === 'th') return String(n); // Thai says "วันที่ 25", no suffix
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
  return `${n}${s}`;
}

const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);

// ---------- words ----------

/** "Copenhagen trip" → "Copenhagen"; "Trip to Japan" → "Japan". Other goals keep their name. */
export function shortName(title: string, kind: GoalKind) {
  const t = title.trim();
  if (kind !== 'trip') return t;
  const place = t
    .replace(/^(?:(?:a|my|our|the)\s+)?(?:trip|holiday|vacation|getaway)\s+(?:to|in|at)\s+/i, '')
    .replace(/\s+(?:trip|holiday|vacation|getaway)$/i, '')
    .trim();
  return place || t;
}

const CHANGE = (): Record<Leak, string> => ({
  delivery: t('Delivery under ฿200 a day'),
  grab: t('Fewer late-night Grabs'),
  shopping: t('A 24-hour wait before checkout'),
  coffee: t('Café coffee 3 times a week'),
  goingOut: t('One big night out a week'),
  beauty: t('Beauty buys from fun money'),
  snacks: t('A weekly 7-Eleven budget'),
  bubbleTea: t('Bubble tea twice a week'),
  subscriptions: t('Only subscriptions I use'),
  games: t('A monthly top-up limit'),
  treating: t('A set budget for treating friends'),
  sales: t('A budget before each sale day'),
});

const STAY = (): Record<Leak, string> => ({
  coffee: t('Your morning coffee'),
  goingOut: t('Weekends out'),
  beauty: t('Your skincare'),
  delivery: t('Your favourite takeaway'),
  shopping: t('Treats you plan for'),
  grab: t('Getting home safe'),
  snacks: t('Your favourite snacks'),
  bubbleTea: t('Your bubble tea'),
  subscriptions: t('The apps you love'),
  games: t('Your games'),
  treating: t('Treating the people you love'),
  sales: t('The deals you really want'),
});

const CUT_FIRST = (): Record<Leak, string> => ({
  delivery: t('delivery'),
  grab: t('late-night Grabs'),
  shopping: t('online shopping'),
  coffee: t('café coffee'),
  goingOut: t('nights out'),
  beauty: t('beauty buys'),
  snacks: t('7-Eleven runs'),
  bubbleTea: t('bubble tea'),
  subscriptions: t('subscriptions I don’t use'),
  games: t('game top-ups'),
  treating: t('treating friends'),
  sales: t('sale-day shopping'),
});

export const LEAKS: { key: Leak; label: string }[] = [
  {
    key: 'delivery',
    get label() {
      return t('Food delivery');
    },
  },
  {
    key: 'grab',
    get label() {
      return t('Grab late at night');
    },
  },
  {
    key: 'shopping',
    get label() {
      return t('Online shopping');
    },
  },
  {
    key: 'coffee',
    get label() {
      return t('Coffee');
    },
  },
  {
    key: 'goingOut',
    get label() {
      return t('Going out');
    },
  },
  {
    key: 'beauty',
    get label() {
      return t('Beauty');
    },
  },
  {
    key: 'snacks',
    get label() {
      return t('7-Eleven snacks');
    },
  },
  {
    key: 'bubbleTea',
    get label() {
      return t('Bubble tea');
    },
  },
  {
    key: 'subscriptions',
    get label() {
      return t('Subscriptions');
    },
  },
  {
    key: 'games',
    get label() {
      return t('Games & top-ups');
    },
  },
  {
    key: 'treating',
    get label() {
      return t('Treating friends');
    },
  },
  {
    key: 'sales',
    get label() {
      return t('Sale days (11.11)');
    },
  },
];

function moment(kind: GoalKind, title: string, short: string) {
  switch (kind) {
    case 'monthly':
      return { title: t('A year of saving'), sub: t('The habit is the win.') };
    case 'trip':
      return { title: t('Hello, {short}!', { short }), sub: t('Paid in full. No credit card.') };
    case 'safety_net':
      return { title: t('Your emergency fund is full'), sub: t('Ready for a rainy day.') };
    default:
      return { title: t('{title} is yours', { title }), sub: t('Paid in full. No credit card.') };
  }
}

function promise(kind: GoalKind, title: string, short: string, due: Date, target: number, monthly: number) {
  const when = longDate(due);
  switch (kind) {
    case 'monthly':
      return t('Every payday, {amount} goes to {short} first — before anything else.', { amount: baht(monthly), short });
    case 'trip':
      return t('By {when}, I’ll be in {short} — all paid for, no credit card.', { when, short });
    case 'safety_net':
      return t('By {when}, I’ll have {amount} set aside for a rainy day.', { when, amount: baht(target) });
    default:
      return t('By {when}, {title} will be mine — all paid for, no credit card.', { when, title });
  }
}

// ---------- the plan ----------

/** Months from today, landing on payday (or today's date for changing income). */
export function monthsFromNow(months: number, d: SetupDraft, now = new Date()): Date {
  const day = d.incomeType === 'regular' && d.payday ? d.payday : now.getDate();
  return dayInMonth(now.getFullYear(), now.getMonth() + months, day);
}
export const monthYear = (d: Date) => `${monthShort(d.getMonth())} ${shownYear(d)}`;
/** Paydays until the date: whole calendar months, so a date picked as "N months from now" always counts as N. */
export const monthsUntil = (iso: string, now = new Date()) => {
  const d = parseDay(iso);
  return Math.max(1, (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()));
};

/** Which income Kip plans on: salary, a slow month — or the average, if a slow month can't cover the basics. */
export function incomeBasis(d: SetupDraft): { income: number; basis: Plan['incomeBasis'] } {
  if (d.incomeType === 'regular') return { income: d.monthlyIncome ?? 0, basis: 'salary' };
  const slow = plannedIncome(d);
  const basics = (d.rent ?? 0) + (d.bills ?? billsGuess(slow)) + livingTotal(living(slow));
  if (d.goodMonth && slow < basics + 1000) return { income: Math.round((slow + d.goodMonth) / 2), basis: 'average' };
  return { income: slow, basis: 'slow' };
}

const GOAL_TYPE: Record<GoalKind, GoalType> = { trip: 'trip', gadget: 'gadget', car: 'car', home: 'home', safety_net: 'emergency', monthly: 'monthly' };

/** Side money that lands before the goal is reached (months = months to the goal). */
export function sideTotal(side: SideIncome | null | undefined, months: number): number {
  if (!side || side.amount <= 0) return 0;
  if (side.kind === 'once') return side.amount;
  return side.amount * Math.min(side.months ?? months, months);
}

/** With side money "until the goal", the date depends on it: the first month where pay + side money covers the rest. */
export function monthsWithSide(i: Inputs, side: SideIncome | null | undefined, perMonth: number): number | null {
  const left = Math.max(0, i.goal.target - i.goal.saved);
  for (let m = 1; m <= 600; m++) if (perMonth * m + sideTotal(side, m) >= left) return m;
  return null;
}

export function inputsFrom(d: SetupDraft, now = new Date()): Inputs {
  const { income } = incomeBasis(d);
  const base = inputsNoSide(d, income, now);
  if (!d.sideIncome || d.goalKind === 'monthly') return base;
  const months = base.goal.months ?? monthsWithSide(base, d.sideIncome, Math.max(room(base).comfortable, 100)) ?? 12;
  return { ...base, goal: { ...base.goal, extra: sideTotal(d.sideIncome, months) } };
}

function inputsNoSide(d: SetupDraft, income: number, now: Date): Inputs {
  return {
    income,
    rent: d.rent ?? 0,
    bills: d.bills ?? billsGuess(income),
    goal: {
      type: GOAL_TYPE[d.goalKind],
      title: d.goalTitle.trim(),
      target: d.goalKind === 'monthly' ? 0 : (d.goalTarget ?? 0),
      saved: d.goalSaved ?? 0,
      months: d.goalKind === 'monthly' || !d.goalDue ? null : monthsUntil(d.goalDue, now),
      monthly: d.goalKind === 'monthly' ? (d.goalMonthly ?? 0) : null,
    },
    living: d.living,
  };
}

/** Kip's suggested 3 months of costs for an emergency fund. */
export const emergencyTargetFor = (d: SetupDraft) => safetyNet(inputsFrom(d)).target;

export { livingFor, room };

export function makePlan(d: SetupDraft, now = new Date()): Plan {
  const today = startOfDay(now);
  const inputs = inputsFrom(d, now);
  const v = verdict(inputs);
  const result = splitMonth(inputs, d.budgetStyle, d.goalPerMonth);
  const short = d.goalKind === 'monthly' ? d.goalTitle.trim() || t('Savings') : shortName(d.goalTitle, d.goalKind);
  const due = result.goalMonths !== null ? monthsFromNow(result.goalMonths, d, now) : d.goalDue ? parseDay(d.goalDue) : monthsFromNow(12, d, now);
  const mode: Plan['mode'] = v.kind === 'noRoom' ? 'noRoom' : v.kind === 'notByThen' && !d.goalPerMonth ? 'stretch' : 'ok';

  const picked = LEAKS.map((l) => l.key).filter((k) => d.leaks.includes(k));
  const notPicked = (['coffee', 'goingOut', 'beauty', 'bubbleTea', 'snacks', 'delivery', 'shopping', 'grab', 'games', 'treating', 'subscriptions', 'sales'] as Leak[]).filter(
    (k) => !d.leaks.includes(k),
  );
  const change = CHANGE();
  const stay = STAY();
  const changes = picked.slice(0, 2).map((k) => change[k]);
  if (changes.length === 0) changes.push(t('Spending stays under your daily number'));
  const stays = notPicked.slice(0, 2).map((k) => stay[k]);
  if (stays.length < 2) stays.push(t('One treat a week'));
  else stays[1] = t('{thing}, one treat a week', { thing: stays[1] });

  const target = d.goalKind === 'monthly' ? (d.goalMonthly ?? 0) * 12 : (d.goalTarget ?? 0);
  return {
    inputs,
    short,
    verdict: v,
    result,
    due,
    daysToGo: Math.max(0, daysBetween(today, due)),
    monthlySave: result.goal,
    safetyMonthly: result.net,
    dailySpend: result.daily,
    dailySaving: Math.round((result.goal + result.net + result.invest) / 30),
    mode,
    incomeBasis: incomeBasis(d).basis,
    changes,
    stays,
    moment: moment(d.goalKind, d.goalTitle.trim(), short),
    promiseMain: promise(d.goalKind, d.goalTitle.trim(), short, due, target, d.goalMonthly ?? 0),
    promiseBackup: picked.length
      ? t('If money gets tight, I’ll cut {thing} first. I won’t touch my savings.', { thing: CUT_FIRST()[picked[0]] })
      : t('If money gets tight, I’ll cut the extras first. I won’t touch my savings.'),
  };
}
