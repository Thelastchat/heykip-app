// Every month (approved mockup): rent, bills, subscriptions, money for family — and yearly things like insurance,
// set aside a little each month so the month it's due doesn't blow up. Plus: matching bank slips to these bills.
//
// Money rules (the same as any bill — see addBill in budget.ts): a new item comes out of Kip's bill guess first, then
// fun money, then the goal. Food, transport and the safety net are never touched.
// A yearly item sets aside what still has to be ready, spread over the months left until it's due (catch-up), then
// total ÷ 12 once it's paid and starts again.
import type { BillItem, BillType, MonthBudget } from '@/lib/budget';
import { monthShort, t } from '@/lib/i18n';
import { isoDay } from '@/lib/setup/plan';

export const BILL_TYPES: BillType[] = ['rent', 'utilities', 'phone', 'internet', 'streaming', 'fitness', 'insurance', 'loan', 'family', 'other'];

export function typeName(k: BillType): string {
  return {
    rent: t('Rent'),
    utilities: t('Water & electricity'),
    phone: t('Phone plan'),
    internet: t('Internet'),
    streaming: t('Streaming'),
    fitness: t('Fitness'),
    insurance: t('Insurance'),
    loan: t('Loan'),
    family: t('Family'),
    other: t('Other'),
  }[k];
}

/** A best guess from the name — "AIS Fibre" is Internet, "Netflix" is Streaming. The person can change it. */
export function guessType(name: string): BillType {
  const n = name.toLowerCase();
  if (/rent|ค่าเช่า|ห้อง|condo|dorm|หอ/.test(n)) return 'rent';
  if (/elec|ไฟ|pea|mea|water|น้ำ|pwa|mwa/.test(n)) return 'utilities';
  if (/internet|wifi|wi-fi|3bb|fib(re|er)|เน็ต|true ?online/.test(n)) return 'internet';
  if (/phone|mobile|ais|true|dtac|โทร|มือถือ/.test(n)) return 'phone';
  if (/netflix|spotify|youtube|disney|apple|icloud|prime|hbo|\bmax\b|viu|wetv|joox|sub/.test(n)) return 'streaming';
  if (/gym|fitness|jetts|ฟิต|ยิม|yoga|โยคะ|muay|มวย/.test(n)) return 'fitness';
  if (/insur|ประกัน|aia|fwd|allianz|axa|muang ?thai|เมืองไทย|tokio|krungthai-axa/.test(n)) return 'insurance';
  if (/loan|สินเชื่อ|ผ่อน|instal|ktc|card|บัตร|กยศ|student/.test(n)) return 'loan';
  if (/mom|mum|dad|mother|father|parent|family|พ่อ|แม่|ครอบครัว|ยาย|ตา|น้อง/.test(n)) return 'family';
  return 'other';
}

export const typeOf = (item: Pick<BillItem, 'name' | 'type'>): BillType => item.type ?? guessType(item.name);

/** Whole months from now until the due month ("2027-03"), at least 1 — the month it's due counts as the last one. */
export function monthsToDue(due: string, now = new Date()): number {
  const [y, m] = due.split('-').map(Number);
  return Math.max(1, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()));
}

/** What a yearly item sets aside each month: what still has to be ready, over the months left (in ฿10 steps, up). */
export function yearlySetAside(total: number, due: string, ready = 0, now = new Date()): number {
  const need = Math.max(0, total - ready);
  return Math.ceil(need / monthsToDue(due, now) / 10) * 10;
}

/** How much of a yearly item is ready: one month's set-aside for each payday since it started (never more than due). */
export function readyOf(item: BillItem, now = new Date()): number {
  if (!item.yearly) return 0;
  const s = new Date(item.yearly.since);
  const months = Math.max(0, (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth()));
  return Math.min(item.yearly.total, months * item.amount);
}

/** "2027-03" → "Mar" (or "มี.ค." in Thai). */
export const dueLabel = (due: string) => monthShort(Number(due.split('-')[1]) - 1);

/** The next time this month-of-year comes round (for a new yearly item): "March" picked in November → next March. */
export function nextDue(month0: number, now = new Date()): string {
  const y = month0 > now.getMonth() ? now.getFullYear() : now.getFullYear() + 1;
  return `${y}-${String(month0 + 1).padStart(2, '0')}`;
}

/**
 * A yearly item was paid: next year it's due again a year later, and from now on it sets aside total ÷ 12.
 * Setting aside less frees money; it goes to the goal (the same way removing a bill does). Never more than the month has.
 */
export function rollYearly(m: MonthBudget, name: string, now = new Date()): MonthBudget {
  const items = m.bills.items ?? [];
  const i = items.findIndex((x) => x.name === name && x.yearly);
  if (i < 0) return m;
  const it = items[i];
  const [y, mo] = it.yearly!.due.split('-').map(Number);
  const due = `${y + 1}-${String(mo).padStart(2, '0')}`;
  const amount = yearlySetAside(it.yearly!.total, due, 0, now);
  const freed = Math.max(0, it.amount - amount);
  const next = items.map((x, k) => (k === i ? { ...x, amount: Math.min(x.amount, amount), yearly: { ...x.yearly!, due, since: isoDay(now) } } : x));
  return { ...m, bills: { ...m.bills, items: next }, goalExtra: m.goalExtra + freed };
}

// ---------- slips → bills ----------

export type SlipLike = { name: string; amount: number; category: string; money: 'in' | 'out' };
/** paid = this slip pays a bill in the plan (tick it off); new = a bill Kip hasn't seen (offer to add it). */
export type BillMatch = { kind: 'paid'; key: string; name: string } | { kind: 'new'; name: string; amount: number; type: BillType };

const BILL_CATS = ['home_bills', 'installments'];
const near = (a: number, b: number) => b > 0 && Math.abs(a - b) <= Math.max(20, b * 0.05);
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
const sameName = (a: string, b: string) => {
  const A = words(a);
  return words(b).some((w) => A.includes(w));
};

/**
 * Does this slip pay a bill in the plan? By name (a bill you added, like "Netflix") or by amount (within ~5%) for a
 * Home & bills / Installments slip. Bills already paid this cycle, or matched by another slip (`taken`), are skipped.
 * A Home & bills slip that matches nothing becomes an offer to add it to Every month.
 */
export function matchBill(slip: SlipLike, m: MonthBudget, paidKeys: string[], taken: Set<string>): BillMatch | null {
  if (slip.money !== 'out' || slip.amount <= 0) return null;
  const isBill = BILL_CATS.includes(slip.category);
  const plan = [
    ...(m.bills.rent > 0 ? [{ key: 'rent', name: t('Rent'), amount: m.bills.rent, real: 'rent' }] : []),
    ...(m.bills.items ?? []).filter((b) => !b.yearly).map((b) => ({ key: `item:${b.name}`, name: b.name, amount: b.amount, real: b.name })),
  ].filter((b) => !paidKeys.includes(b.key) && !taken.has(b.key));
  const byName = plan.find((b) => b.key !== 'rent' && sameName(slip.name, b.real));
  const byAmount = isBill ? plan.find((b) => near(slip.amount, b.amount)) : undefined;
  const hit = byName ?? byAmount;
  if (hit) return { kind: 'paid', key: hit.key, name: hit.name };
  if (!isBill) return null;
  return { kind: 'new', name: slip.name.trim() || t('New bill'), amount: Math.round(slip.amount), type: guessType(slip.name) };
}
