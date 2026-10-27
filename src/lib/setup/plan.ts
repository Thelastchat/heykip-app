import { baht } from '@/lib/money';

import { plannedIncome, type GoalKind, type Leak, type SetupDraft } from './draft';

// Kip's plan, worked out from what the person told Setup.
// The rules are deliberately simple and explainable:
//   • Save the same amount every payday until the goal date.
//   • Keep 10% of income aside for bills Kip hasn't learned about yet.
//   • Whatever is left, spread over 30 days, is the daily budget.

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
  progress: number; // 0–1 today
  stretch: boolean;
  suggestDue: Date | null;
  changes: string[];
  stays: string[];
  moment: { title: string; sub: string };
  promiseMain: string;
  promiseBackup: string;
  firstIsPayday: boolean; // today is payday, so the first amount comes from the new salary
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
  return t.replace(/^trip to\s+/i, '').replace(/\s+trip$/i, '').trim() || t;
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

export function makePlan(d: SetupDraft, now = new Date()): Plan {
  const today = startOfDay(now);
  const target = d.goalTarget ?? 0;
  const saved = Math.min(d.goalSaved ?? 0, target);
  const due = d.goalDue ? parseDay(d.goalDue) : today;
  const income = plannedIncome(d);
  const rent = d.rent ?? 0;
  const short = shortName(d.goalTitle, d.goalKind);
  const need = Math.max(0, target - saved);

  // The first amount goes in today, from what's in the account now; then every payday
  // (or, for changing income, the same date each month) up to the goal date.
  const day = d.incomeType === 'regular' && d.payday ? d.payday : today.getDate();
  const dates: Date[] = [today];
  for (let i = 0; i < 240; i++) {
    const c = dayInMonth(today.getFullYear(), today.getMonth() + i, day);
    if (c <= today) continue;
    if (c > due) break;
    dates.push(c);
  }

  const per = Math.ceil(need / dates.length / 10) * 10;
  let running = saved;
  const deposits = dates.map((date, i) => {
    const amount = i === dates.length - 1 ? Math.max(0, need - per * i) : per;
    running += amount;
    return { date, amount, pctAfter: target ? Math.min(1, running / target) : 1 };
  });

  const monthlySave = per;
  const free = income - rent - income * OTHER_BILLS;
  const dailySpend = Math.max(0, Math.floor((free - monthlySave) / DAYS_IN_MONTH / 10) * 10);
  const stretch = income > 0 && (monthlySave > free * 0.5 || dailySpend < 100);

  // If it's a stretch, suggest the date that keeps saving under 40% of what's free.
  let suggestDue: Date | null = null;
  if (stretch && free > 0) {
    const months = Math.ceil(need / (free * 0.4));
    suggestDue = dayInMonth(dates[0].getFullYear(), dates[0].getMonth() + months - 1, dates[0].getDate());
  }

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
    dailySaving: Math.round(monthlySave / DAYS_IN_MONTH),
    progress: target ? saved / target : 0,
    stretch,
    suggestDue,
    changes,
    stays,
    moment: moment(d.goalKind, d.goalTitle.trim(), short),
    promiseMain: promise(d.goalKind, d.goalTitle.trim(), short, due, target),
    promiseBackup: `If money gets tight, I’ll cut ${picked.length ? CUT_FIRST[picked[0]] : 'the extras'} first. I won’t touch my savings.`,
    firstIsPayday: d.incomeType === 'regular' && today.getDate() === day,
  };
}
