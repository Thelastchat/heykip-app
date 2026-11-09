// Changes to this month's plan, made the same way the screen makes them (a new bill comes out of Kip's bill guess
// first, then fun money, then the goal). Used by "Tell Kip" on Your month and by agent Kip in Talk.
import { addBill, lowerBudget, raiseBudget, removeBill, type CatKey, type MonthBudget } from '@/lib/budget';

export type Op = { op: 'move' | 'set' | 'add_bill' | 'remove_bill'; from?: string; to?: string; category?: string; amount?: number; name?: string };

/** Make the changes the same way the screen does. Returns null if something doesn't fit this month. */
export function applyOps(m: MonthBudget, ops: Op[]): MonthBudget | null {
  const has = (k?: string): k is CatKey => !!k && m.spend.some((s) => s.key === k);
  let next = m;
  for (const o of ops) {
    const amount = Math.round(Number(o.amount) || 0);
    if (o.op === 'move') {
      if (!has(o.from) || !has(o.to) || o.from === o.to || amount <= 0) return null;
      const from = next.spend.find((s) => s.key === o.from)!.amount;
      const take = Math.min(from, amount);
      next = { ...next, spend: next.spend.map((s) => (s.key === o.from ? { ...s, amount: s.amount - take } : s.key === o.to ? { ...s, amount: s.amount + take } : s)) };
    } else if (o.op === 'set') {
      if (!has(o.category) || amount < 0) return null;
      const cur = next.spend.find((s) => s.key === o.category)!.amount;
      next = amount > cur ? raiseBudget(next, o.category, amount) : amount < cur ? lowerBudget(next, o.category, amount, next.alwaysFreedTo ?? 'goal') : next;
    } else if (o.op === 'add_bill') {
      const name = (o.name ?? '').trim().slice(0, 40);
      if (!name || amount <= 0) return null;
      // A bill bigger than what can bend this month (guess, fun money, goal saving) doesn't fit: refuse, never overspend.
      const r = addBill(next, name, amount);
      if (r.short > 0) return null;
      next = r.month;
    } else if (o.op === 'remove_bill') {
      const i = (next.bills.items ?? []).findIndex((b) => b.name.toLowerCase() === (o.name ?? '').trim().toLowerCase());
      if (i < 0) return null;
      next = removeBill(next, i);
    } else return null;
  }
  return next;
}
