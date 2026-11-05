// Full calendar (approved mockup): every day of a month with what was spent, back one year and no further.
//
// Dates come from the phone's own calendar (JavaScript's Date), so February has 28 days or 29 in a leap year, and
// every month starts on its real weekday. Weeks start on Sunday, as Thai calendars do.
//
// Saving Supabase: one request per month, the first time it's opened. Past months don't change much, so they're
// kept for the session (History drops them when a spend is changed or deleted); this month is fetched each time the
// calendar opens, so a spend just added always shows.
import { budgetKey, type CatSpend } from '@/lib/home';
import type { MonthBudget } from '@/lib/budget';
import { supabase } from '@/lib/supabase';

/** The first day that can be opened: this day one year ago (29 Feb → 28 Feb when the year before has no 29th). */
export function earliestDay(now = new Date()): Date {
  const y = now.getFullYear() - 1;
  const last = new Date(y, now.getMonth() + 1, 0).getDate();
  return new Date(y, now.getMonth(), Math.min(now.getDate(), last));
}

/** Months between two months (b − a): Nov 2025 → Nov 2026 is 12. */
export const monthsBetween = (a: { y: number; m: number }, b: { y: number; m: number }) => (b.y - a.y) * 12 + (b.m - a.m);

/** The month `offset` months from now (0 = this month, −12 = the oldest one). */
export function monthAt(offset: number, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

/** How far back the arrows go: the month the earliest day is in (always −12). */
export const OLDEST = -12;

/** The month as a grid: blanks before the 1st (Sunday-first), every real day, blanks to fill the last week. */
export function monthGrid(y: number, m: number): (Date | null)[] {
  const days = new Date(y, m + 1, 0).getDate();
  const lead = new Date(y, m, 1).getDay();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** Can this day be opened? Not in the future, not before the one-year limit. */
export function dayOpen(d: Date, now = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d <= today && d >= earliestDay(now);
}

export type DaySpends = { byDay: Record<string, number>; items: Record<string, CatSpend[]>; total: number };

/** Spends of a month, by day. Rent & bills are planned money, so they're left out — the same as Home. */
export function daysFrom(rows: CatSpend[], month: MonthBudget | null, from: Date): DaySpends {
  const out: DaySpends = { byDay: {}, items: {}, total: 0 };
  const start = from.getTime();
  for (const r of rows) {
    const at = new Date(r.at);
    if (at.getTime() < start) continue;
    if (budgetKey(r.cat, month) === 'bills') continue;
    const k = at.toDateString();
    out.byDay[k] = (out.byDay[k] ?? 0) + r.amount;
    (out.items[k] ??= []).push(r);
    out.total += r.amount;
  }
  for (const k of Object.keys(out.items)) out.items[k].sort((a, b) => b.at.localeCompare(a.at));
  return out;
}

const cache = new Map<string, { rows: CatSpend[] }>();

/** Forget what's kept (after adding or changing a spend). */
export function dropCalendarCache() {
  cache.clear();
}

/** A month's spends: loaded once, then reused. */
export async function loadMonth(userId: string, y: number, m: number, now = new Date()): Promise<CatSpend[]> {
  const key = `${userId}:${y}-${m}`;
  const isNow = y === now.getFullYear() && m === now.getMonth();
  const hit = cache.get(key);
  if (hit && !isNow) return hit.rows;
  const { data, error } = await supabase
    .from('transactions')
    .select('id, amount, note, occurred_at, categories(key)')
    .eq('user_id', userId)
    .eq('kind', 'spend')
    .gte('occurred_at', new Date(y, m, 1).toISOString())
    .lt('occurred_at', new Date(y, m + 1, 1).toISOString())
    .order('occurred_at', { ascending: false })
    .limit(2000);
  if (error) throw error;
  const rows: CatSpend[] = (data ?? []).map((r) => ({
    id: r.id as string,
    amount: Number(r.amount),
    at: r.occurred_at as string,
    note: (r.note as string | null) ?? null,
    cat: (r.categories as unknown as { key: string } | null)?.key ?? 'other',
  }));
  cache.set(key, { rows });
  return rows;
}
