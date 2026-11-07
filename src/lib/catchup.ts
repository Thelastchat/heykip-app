// Old slips catching up a past month (approved mockup). Slips saved today can be from a pay month that's already over.
// If they push that month past its spending money, its saving already went to the goal on payday — so "Saved so far"
// says more than the person really has. Kip offers (never forces) to take the over part back out of the goal.
//
// Only what the new slips caused counts: a month that was already ฿300 over and is now ฿2,100 over asks about ฿1,800.
// Spending money is today's plan (the app keeps only the current plan). Rent & bills are planned money and never count.
// Slips older than a year (the Full calendar's limit) are left alone.
import { spendingTotal, type MonthBudget } from '@/lib/budget';
import { earliestDay } from '@/lib/calendar';
import { budgetKey, period, periodKey, periodMonth } from '@/lib/home';
import { supabase } from '@/lib/supabase';

export type Spend = { amount: number; at: Date; cat: string };
export type CatchRow = { key: string; month: Date; budget: number; spent: number; over: number; slips: number };

/** The past pay months the new slips fall in (newest first), each with its start and end — what to load. */
export function pastPeriods(news: Spend[], month: MonthBudget, now = new Date()) {
  const cycleStart = period(month.payday, now).start;
  const oldest = earliestDay(now);
  const out = new Map<string, { start: Date; end: Date; month: Date }>();
  for (const s of news) {
    if (s.at >= cycleStart || s.at < oldest || budgetKey(s.cat, month) === 'bills') continue;
    const k = periodKey(month.payday, s.at);
    if (!out.has(k)) {
      const P = period(month.payday, s.at);
      out.set(k, { start: P.start, end: P.end, month: periodMonth(P) });
    }
  }
  return out;
}

/**
 * For each past pay month the new slips land in: its spending money, what was spent with the new slips, and how much
 * over the new slips made it. `all` is every spend in those months after saving (the new slips included).
 */
export function catchUpRows(news: Spend[], all: Spend[], month: MonthBudget, now = new Date()): CatchRow[] {
  const periods = pastPeriods(news, month, now);
  const budget = spendingTotal(month);
  const counts = (s: Spend) => budgetKey(s.cat, month) !== 'bills';
  const rows: CatchRow[] = [];
  for (const [key, P] of periods) {
    const inP = (s: Spend) => s.at >= P.start && s.at < P.end && counts(s);
    const spent = all.filter(inP).reduce((a, s) => a + s.amount, 0);
    const added = news.filter(inP);
    const before = spent - added.reduce((a, s) => a + s.amount, 0);
    const over = Math.round(Math.max(0, spent - budget) - Math.max(0, before - budget));
    if (over > 0) rows.push({ key, month: P.month, budget, spent: Math.round(spent), over, slips: added.length });
  }
  return rows.sort((a, b) => b.month.getTime() - a.month.getTime());
}

/** One request: every spend in the past months the new slips fall in. Nothing is loaded when there are none. */
export async function loadCatchUp(userId: string, news: Spend[], month: MonthBudget, now = new Date()): Promise<CatchRow[]> {
  const periods = [...pastPeriods(news, month, now).values()];
  if (!periods.length) return [];
  const from = new Date(Math.min(...periods.map((p) => p.start.getTime())));
  const to = new Date(Math.max(...periods.map((p) => p.end.getTime())));
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, occurred_at, categories(key)')
    .eq('user_id', userId)
    .eq('kind', 'spend')
    .gte('occurred_at', from.toISOString())
    .lt('occurred_at', to.toISOString())
    .limit(5000);
  if (error) throw error;
  const all: Spend[] = (data ?? []).map((r) => ({ amount: Number(r.amount), at: new Date(r.occurred_at as string), cat: (r.categories as unknown as { key: string } | null)?.key ?? 'other' }));
  return catchUpRows(news, all, month, now);
}
