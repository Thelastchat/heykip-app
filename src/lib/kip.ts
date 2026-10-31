// Talk to Kip: what we send to the server (the person's month as plain numbers) and the money maths the app
// does itself — the AI only understands words; every baht figure comes from here.
import { CATEGORY, spendingTotal, type CatKey, type MonthBudget } from '@/lib/budget';
import { budgetKey, monthNumbers, type Spent } from '@/lib/home';
import type { Icon3D } from '@/lib/icons3d';
import { CAT_ICON3D } from '@/lib/icons3d';
import { supabase } from '@/lib/supabase';

/** Every category key the server can return (the database's categories). */
export type DbCat = 'food' | 'transport' | 'shopping' | 'fun' | 'health_beauty' | 'home_bills' | 'travel' | 'family_pets' | 'giving' | 'learning' | 'installments' | 'other';
export type LogItem = { name: string; amount: number; category: DbCat };
export type KipReply = { kind: 'log' | 'buy' | 'answer'; reply: string; items?: LogItem[]; buy?: LogItem };

export const DB_CAT_NAME: Record<DbCat, string> = {
  food: 'Food',
  transport: 'Transport',
  shopping: 'Shopping',
  fun: 'Fun',
  health_beauty: 'Health & beauty',
  home_bills: 'Home & bills',
  travel: 'Travel',
  family_pets: 'Family & pets',
  giving: 'Giving',
  learning: 'Learning',
  installments: 'Installments',
  other: 'Other',
};
export function dbCatIcon(c: DbCat): Icon3D {
  const extra: Partial<Record<DbCat, Icon3D>> = { home_bills: 'house', travel: 'plane', family_pets: 'piggy', installments: 'bill' };
  return extra[c] ?? (c in CAT_ICON3D ? CAT_ICON3D[c as CatKey] : 'bill');
}

/** The month as numbers Kip may quote. */
export function kipContext(month: MonthBudget | null, spent: Spent, goal: { name: string; arrives: string | null } | null, name?: string | null) {
  if (!month) return {};
  const n = monthNumbers(month, spent);
  return {
    name: name ?? undefined,
    leftToday: n.leftToday,
    leftThisMonth: n.leftMonth,
    daysLeft: n.P.daysLeft,
    dailyBudget: n.dailyToday,
    paceThisMonth: n.pace > 0 ? `${n.pace} baht faster than plan` : `${-n.pace} baht under plan`,
    goal: goal ? { name: goal.name, arrives: goal.arrives, perMonth: month.goal.amount + month.goalExtra } : undefined,
    categories: month.spend.map((s) => ({ name: CATEGORY[s.key].name, budget: s.amount, spent: spent.byCat[s.key] ?? 0, left: Math.max(0, s.amount - (spent.byCat[s.key] ?? 0)) })),
  };
}

export async function askKip(text: string, context: object): Promise<{ ok: true; reply: KipReply } | { ok: false; reason: 'plus' | 'nokey' | 'busy' | 'offline' }> {
  const { data, error } = await supabase.functions.invoke('kip', { body: { text, context } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 402) return { ok: false, reason: 'plus' };
    if (status === 503) return { ok: false, reason: 'nokey' };
    if (status === undefined) return { ok: false, reason: 'offline' };
    return { ok: false, reason: 'busy' };
  }
  if (!data || typeof data !== 'object' || !('kind' in data)) return { ok: false, reason: 'busy' };
  return { ok: true, reply: data as KipReply };
}

// ---------- "Can I buy this?" ----------

export type BuyPlan =
  | { fits: true; key: CatKey | 'bills'; left: number; moves: [] }
  | { fits: true; key: CatKey; left: number; moves: { from: CatKey; amount: number; leftAfter: number; tight: boolean }[] }
  | { fits: false; key: CatKey | 'bills'; left: number; short: number };

/**
 * Can this purchase fit this month without touching savings? First from its own budget's unspent money,
 * then borrowed from other budgets' spare money: fun-type budgets first (all their unspent money),
 * then everyday ones (only what's above pace, so food and transport still last the month).
 */
export function buyPlan(month: MonthBudget, spent: Spent, item: LogItem): BuyPlan {
  const key = budgetKey(item.category, month);
  const n = monthNumbers(month, spent);
  const share = n.P.total ? n.P.daysLeft / n.P.total : 0;
  const leftOf = (k: CatKey) => Math.max(0, (month.spend.find((s) => s.key === k)?.amount ?? 0) - (spent.byCat[k] ?? 0));
  if (key === 'bills') return { fits: true, key, left: 0, moves: [] };
  const left = leftOf(key);
  if (item.amount <= left) return { fits: true, key, left: left - item.amount, moves: [] };

  let need = item.amount - left;
  const everyday: CatKey[] = ['food', 'transport', 'health_beauty', 'other'];
  const others = month.spend.filter((s) => s.key !== key);
  const rounds = [
    others.filter((s) => !everyday.includes(s.key)).map((s) => ({ key: s.key, spare: leftOf(s.key) })),
    others.filter((s) => everyday.includes(s.key)).map((s) => ({ key: s.key, spare: Math.max(0, Math.floor((leftOf(s.key) - s.amount * share) / 10) * 10) })),
  ];
  const take = new Map<CatKey, number>();
  for (const round of rounds) {
    const pool = round.reduce((a, r) => a + r.spare, 0);
    if (need <= 0 || pool <= 0) continue;
    const want = Math.min(need, pool);
    let got = 0;
    round
      .filter((r) => r.spare > 0)
      .forEach((r, i, arr) => {
        const cut = i === arr.length - 1 ? Math.min(r.spare, want - got) : Math.min(r.spare, Math.round((want * r.spare) / pool / 10) * 10);
        take.set(r.key, (take.get(r.key) ?? 0) + cut);
        got += cut;
      });
    need -= got;
  }
  if (need > 0) return { fits: false, key, left, short: need };
  const moves = [...take.entries()]
    .filter(([, a]) => a > 0)
    .map(([from, amount]) => {
      const leftAfter = leftOf(from) - amount;
      const budget = month.spend.find((s) => s.key === from)?.amount ?? 0;
      return { from, amount, leftAfter, tight: leftAfter < budget * share * 0.6 };
    })
    .sort((a, b) => b.amount - a.amount);
  return { fits: true, key, left: 0, moves };
}

/** Apply a buy plan to the month: the item's budget grows by what's borrowed, the others shrink. Totals stay the same. */
export function applyBuy(month: MonthBudget, plan: BuyPlan): MonthBudget {
  if (!plan.fits || plan.moves.length === 0 || plan.key === 'bills') return month;
  const got = plan.moves.reduce((a, m) => a + m.amount, 0);
  const spend = month.spend.map((s) => {
    if (s.key === plan.key) return { ...s, amount: s.amount + got };
    const m = plan.moves.find((x) => x.from === s.key);
    return m ? { ...s, amount: s.amount - m.amount } : s;
  });
  const next = { ...month, spend };
  if (spendingTotal(next) !== spendingTotal(month)) return month; // never change the month's total
  return next;
}
