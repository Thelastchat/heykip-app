// Weekly sweep (approved 27 Nov, from the money-styles research): money left unspent tempts more spending later in the
// month, so once a week Kip offers to send what's spare so far to the goal. "Spare" is exactly how far under the
// plan's line the month is at the start of today — so after a sweep every day left still gets its planned amount.
// It's a plan move like the rest (spending money goes down by the amount, the goal goes up), recorded per pay month.
import type { MonthBudget } from '@/lib/budget';
import { periodKey, type Spent } from '@/lib/home';

/** Ask on Monday (and Tuesday if it was missed), about the week that just ended. */
export const SWEEP_DAYS = [1, 2];
/** The smallest amount worth a card. */
export const MIN_SWEEP = 200;

/** Sent to the goal from this pay month's spending money so far. */
export function sweptIn(m: MonthBudget | null, now = new Date()): number {
  return m?.swept?.[periodKey(m.payday, now)] ?? 0;
}

/** The plan after sending `amount` more this pay month (only the last two pay months are kept). */
export function withSweep(m: MonthBudget, amount: number, now = new Date()): MonthBudget {
  const pk = periodKey(m.payday, now);
  const kept = Object.entries(m.swept ?? {})
    .filter(([k]) => k !== pk)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 1);
  return { ...m, swept: { ...Object.fromEntries(kept), [pk]: (m.swept?.[pk] ?? 0) + amount } };
}

/** How much is spare at the start of today: the plan's line through yesterday minus what went out before today. */
export function spareNow(spendBudget: number, spent: Pick<Spent, 'total' | 'today'>, swept: number, P: { dayIndex: number; total: number }): number {
  const line = (spendBudget * P.dayIndex) / Math.max(1, P.total);
  return Math.floor((line - (spent.total - spent.today + swept)) / 50) * 50;
}

/** The Monday this week's question belongs to, as an id. */
export const weekOf = (now: Date) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
