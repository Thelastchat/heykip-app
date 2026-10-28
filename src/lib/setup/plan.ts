import { baht } from '@/lib/money';

import { plannedIncome, type BudgetStyle, type GoalKind, type Leak, type SetupDraft } from './draft';

// Kip's plan, worked out from what the person told Setup.
// The rules are deliberately simple and explainable, and always goal-first:
//   • Save the same amount every payday until the goal date.
//   • Then a little safety net: 5% of income until it holds about 3 months of basics.
//   • Keep 10% of income aside for bills Kip hasn't learned about yet.
//   • Some money styles save more (50/30/20 and 6 Jars aim for 20%); the extra goes to the safety net.
//   • Whatever is left, spread over 30 days, is the daily budget — never below ฿150 a day.

const OTHER_BILLS = 0.1;
const DAYS_IN_MONTH = 30;

export type Deposit = { date: Date; amount: number; pctAfter: number };

export type Plan = {
  short: string; // "Copenhagen"
  due: Date;
  daysToGo: number;
  need: number;
  deposits: Deposit[];
  monthlySave: number;
  dailySpend: number;
  dailySaving: number; // the plan's saving, per day (for the paywall)
  income: number; // the monthly income Kip planned around
  rent: number;
  billsGuess: number; // Kip's guess for the other bills (10%), until it learns them
  safetyMonthly: number; // safety net, every payday (0 when the goal IS the safety net)
  safetyTarget: number; // about 3 months of basics
  extraSave: number; // extra saving some money styles ask for → safety net
  spending: number; // what's left for everyday life this month
  progress: number; // 0–1 today
  mode: 'ok' | 'stretch' | 'noRoom'; // fits · needs more than fits · nothing spare yet
  suggestDue: Date | null; // when it's a stretch: a date that fits
  incomeBasis: 'salary' | 'slow' | 'average';
  changes: string[];
  stays: string[];
  moment: { title: string; sub: string };
  promiseMain: string;
  promiseBackup: string;
  firstIsPayday: boolean; // the first saving day is a payday
  firstIsToday: boolean;
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
function dayInMonth(year: number, month: number, day: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const longDate = (d: Date) => `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
export const fullDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
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

const CHANGE: Record<Leak, string> = {
  delivery: 'Delivery under ฿200 a day',
  grab: 'Fewer late-night Grabs',
  shopping: 'A 24-hour wait before checkout',
  coffee: 'Café coffee 3 times a week',
  goingOut: 'One big night out a week',
  beauty: 'Beauty buys from fun money',
};

const STAY: Record<Leak, string> = {
  coffee: 'Your morning coffee',
  goingOut: 'Weekends out',
  beauty: 'Your skincare',
  delivery: 'Your favourite takeaway',
  shopping: 'Treats you plan for',
  grab: 'Getting home safe',
};

const CUT_FIRST: Record<Leak, string> = {
  delivery: 'delivery',
  grab: 'late-night Grabs',
  shopping: 'online shopping',
  coffee: 'café coffee',
  goingOut: 'nights out',
  beauty: 'beauty buys',
};

export const LEAKS: { key: Leak; label: string }[] = [
  { key: 'delivery', label: 'Food delivery' },
  { key: 'grab', label: 'Grab late at night' },
  { key: 'shopping', label: 'Online shopping' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'goingOut', label: 'Going out' },
  { key: 'beauty', label: 'Beauty' },
];

function moment(kind: GoalKind, title: string, short: string) {
  switch (kind) {
    case 'trip':
      return { title: `Hello, ${short}!`, sub: 'Paid in full. No credit card.' };
    case 'safety_net':
      return { title: 'Your safety net is full', sub: 'Ready for a rainy day.' };
    default:
      return { title: `${title} is yours`, sub: 'Paid in full. No credit card.' };
  }
}

function promise(kind: GoalKind, title: string, short: string, due: Date, target: number) {
  const when = longDate(due);
  switch (kind) {
    case 'trip':
      return `By ${when}, I’ll be in ${short} — all paid for, no credit card.`;
    case 'safety_net':
      return `By ${when}, I’ll have ${baht(target)} set aside for a rainy day.`;
    default:
      return `By ${when}, ${title} will be mine — all paid for, no credit card.`;
  }
}

// ---------- the plan ----------

const MIN_DAILY = 150; // never plan a day below this

/**
 * How much can comfortably go to goals each month.
 * Free money = income − rent − 10% for other bills. Kip keeps at least ฿150 a day to live on,
 * and never asks for more than half of what's free.
 * Changing income plans on a slow month — unless a slow month can't even cover that,
 * then it plans on an average of slow and good months.
 */
const round10 = (n: number) => Math.round(n / 10) * 10;
const floor10 = (n: number) => Math.max(0, Math.floor(n / 10) * 10);
export const billsGuessFor = (income: number) => round10(income * OTHER_BILLS);

export function savingRoom(d: SetupDraft) {
  const rent = d.rent ?? 0;
  const freeOf = (income: number) => income - rent - billsGuessFor(income);
  let basis: 'salary' | 'slow' | 'average' = d.incomeType === 'regular' ? 'salary' : 'slow';
  let income = plannedIncome(d);
  if (basis === 'slow' && d.goodMonth && freeOf(income) < MIN_DAILY * DAYS_IN_MONTH) {
    basis = 'average';
    income = (income + d.goodMonth) / 2;
  }
  const free = freeOf(income);
  const maxSave = floor10(Math.min(free * 0.5, free - MIN_DAILY * DAYS_IN_MONTH));
  return { income, free, maxSave, basis };
}

/** About 3 months of rent, bills and everyday life (≈ 80% of income each month), rounded to ฿5,000. */
export function safetyTargetFor(d: SetupDraft) {
  return Math.max(5000, Math.round((3 * 0.8 * savingRoom(d).income) / 5000) * 5000);
}

/** Money styles that aim to save a fixed share of income. */
const STYLE_SAVE_SHARE: Record<BudgetStyle, number> = { kip: 0, '503020': 0.2, jars: 0.2, savefirst: 0 };

export function makePlan(d: SetupDraft, now = new Date()): Plan {
  const today = startOfDay(now);
  const target = d.goalTarget ?? 0;
  const saved = Math.min(d.goalSaved ?? 0, target);
  const short = shortName(d.goalTitle, d.goalKind);
  const need = Math.max(0, target - saved);
  const room = savingRoom(d);

  // Saving days: once per pay cycle. The first amount goes in today (from what's in the
  // account now) unless payday is less than a week away; then every payday up to the goal date.
  // Changing income has no payday, so it uses today's date each month.
  const day = d.incomeType === 'regular' && d.payday ? d.payday : today.getDate();
  const nextPayday = dayInMonth(today.getFullYear(), today.getMonth() + (today.getDate() < day ? 0 : 1), day);
  const startToday = d.incomeType === 'changes' || today.getDate() === day || daysBetween(today, nextPayday) >= 7;
  const savingDay = (n: number) =>
    startToday
      ? n === 0
        ? today
        : dayInMonth(nextPayday.getFullYear(), nextPayday.getMonth() + n - 1, day)
      : dayInMonth(nextPayday.getFullYear(), nextPayday.getMonth() + n, day);

  // "No goal yet": no date. Kip saves a comfortable 10% (or less if that doesn't fit) and works out when it's full.
  let due: Date;
  if (d.goalDue) due = parseDay(d.goalDue);
  else {
    const easy = Math.min(floor10(room.income * 0.1), room.maxSave);
    due = easy > 0 ? savingDay(Math.max(1, Math.ceil(need / easy)) - 1) : dayInMonth(today.getFullYear() + 1, today.getMonth(), today.getDate());
  }

  const dates: Date[] = [];
  for (let n = 0; n < 240; n++) {
    const c = savingDay(n);
    if (c > due && dates.length > 0) break;
    dates.push(c);
    if (c > due) break;
  }

  const per = Math.ceil(need / dates.length / 10) * 10;
  let running = saved;
  const deposits = dates.map((date, i) => {
    const amount = i === dates.length - 1 ? Math.max(0, need - per * i) : per;
    running += amount;
    return { date, amount, pctAfter: target ? Math.min(1, running / target) : 1 };
  });

  // ok: fits comfortably · stretch: needs more than fits (Kip suggests a date) · noRoom: nothing spare yet.
  const mode: Plan['mode'] = need === 0 || per <= room.maxSave ? 'ok' : room.maxSave > 0 ? 'stretch' : 'noRoom';
  const monthlySave = mode === 'noRoom' ? 0 : per;

  // After the goal: the safety net (unless the goal is the safety net), then any extra the money style asks for.
  // Neither ever pushes everyday life below ฿150 a day.
  const spare = () => floor10(room.free - monthlySave - MIN_DAILY * DAYS_IN_MONTH);
  const safetyTarget = safetyTargetFor(d);
  const safetyMonthly = d.goalKind === 'safety_net' ? 0 : Math.min(floor10(room.income * 0.05), spare());
  const wanted = floor10(room.income * STYLE_SAVE_SHARE[d.budgetStyle] - monthlySave - safetyMonthly);
  const extraSave = Math.min(wanted, floor10(spare() - safetyMonthly));
  const spending = Math.max(0, room.free - monthlySave - safetyMonthly - extraSave);
  const dailySpend = floor10(spending / DAYS_IN_MONTH);

  let suggestDue: Date | null = null;
  if (mode === 'stretch') suggestDue = savingDay(Math.ceil(need / room.maxSave) - 1);

  const picked = LEAKS.map((l) => l.key).filter((k) => d.leaks.includes(k));
  // What stays: the most-loved everyday things first.
  const notPicked = (['coffee', 'goingOut', 'beauty', 'delivery', 'shopping', 'grab'] as Leak[]).filter((k) => !d.leaks.includes(k));
  const changes = picked.slice(0, 2).map((k) => CHANGE[k]);
  if (changes.length === 0) changes.push('Spending stays under your daily number');
  const stays = notPicked.slice(0, 2).map((k) => STAY[k]);
  if (stays.length < 2) stays.push('One treat a week');
  else stays[1] = `${stays[1]}, one treat a week`;

  return {
    short,
    due,
    daysToGo: Math.max(0, daysBetween(today, due)),
    need,
    deposits,
    monthlySave,
    dailySpend,
    dailySaving: Math.round((monthlySave + safetyMonthly + extraSave) / DAYS_IN_MONTH),
    income: room.income,
    rent: d.rent ?? 0,
    billsGuess: billsGuessFor(room.income),
    safetyMonthly,
    safetyTarget,
    extraSave,
    spending,
    progress: target ? saved / target : 0,
    mode,
    suggestDue,
    incomeBasis: room.basis,
    changes,
    stays,
    moment: moment(d.goalKind, d.goalTitle.trim(), short),
    promiseMain: promise(d.goalKind, d.goalTitle.trim(), short, due, target),
    promiseBackup: `If money gets tight, I’ll cut ${picked.length ? CUT_FIRST[picked[0]] : 'the extras'} first. I won’t touch my savings.`,
    firstIsToday: startToday,
    firstIsPayday: d.incomeType === 'regular' && daysBetween(dates[0], dayInMonth(dates[0].getFullYear(), dates[0].getMonth(), day)) === 0,
  };
}
