// Which nights get an evening check-in (pure, so the logic tests can run it).
import type { MonthBudget } from '@/lib/budget';
import type { Spent } from '@/lib/home';

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The nights ahead that get a nudge, at `time` (HH:MM): from tonight, unless today already has a log or the time has passed. */
export function nightsAhead(now: Date, time: string, logged: string | null, days = 14): Date[] {
  const [h, m] = time.split(':').map(Number);
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, Number.isFinite(h) ? h : 21, Number.isFinite(m) ? m : 0);
    if (d <= now || (i === 0 && logged === ymd(now))) continue;
    out.push(d);
  }
  return out;
}

/**
 * Each night's real "money for today" (ymd → baht), for the next `days` days. The nudge only comes on a night
 * nothing was logged, so that day's spending is what it was this morning: what's left this pay cycle, shared over
 * the days left. After payday it's the new month's daily amount. Logging anything opens HeyKip, which works it out
 * again — so the number on every nudge is the one Home would show that day.
 */
export function nightAmounts(
  month: MonthBudget,
  spent: Spent,
  numbers: (m: MonthBudget, s: Spent, now: Date) => { dailyToday: number },
  periodStart: (payday: number | null, now: Date) => number,
  now = new Date(),
  days = 15,
): Record<string, number> {
  const out: Record<string, number> = {};
  const here = periodStart(month.payday, now);
  const fresh: Spent = { total: 0, today: 0, bills: 0, byCat: {}, byDay: {} };
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
    const s = i === 0 ? spent : periodStart(month.payday, d) === here ? { ...spent, today: 0 } : fresh;
    out[ymd(d)] = Math.max(0, Math.round(numbers(month, s, d).dailyToday));
  }
  return out;
}
