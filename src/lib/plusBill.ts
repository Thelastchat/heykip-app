// HeyKip Plus as a bill (approved 27 Nov): an app that tracks subscriptions shouldn't hide its own. Once Plus is paid,
// it sits in Every month at what the person really pays — the price Apple charged, from the receipt (RevenueCat's
// notice → profiles.plus_price). Never a price of our own.
//
// Money rules (the same as any bill):
//   · Free week: no bill. The Subscriptions page says when it ends and that Kip adds it then.
//   · Monthly: a bill of what was charged, on its renewal day. Yearly: set aside total ÷ 12 for the next renewal.
//   · Adding it takes from Kip's bill guess, then fun money, then the goal (addBill) — never living costs or the net.
//   · A new price (an intro price ending, Apple changing prices): the bill follows it, and Kip says so on Home.
//   · Plus ends: the bill goes and its money goes to the goal (removeBill), like cancelling any subscription.
//   · Paid in another currency: left alone (no guessing at exchange rates).
import { addBill, removeBill, type BillItem, type MonthBudget } from '@/lib/budget';
import { yearlySetAside } from '@/lib/everymonth';
import { isoDay } from '@/lib/setup/plan';
import { PLUS_BILL } from '@/lib/subscriptions';

export type PlusPrice = { amount: number; currency: string; period: 'monthly' | 'yearly'; renews_at: string };

/** What Kip tells them on Home after the bill changed by itself (cleared on "Got it"). */
export type PlusNote = {
  kind: 'added' | 'changed' | 'gone';
  /** what's charged each time (a month or a year) */
  charge: number;
  yearly: boolean;
  /** what it takes from each month */
  perMonth: number;
  /** the old charge (changed) */
  was?: number;
  fromFun: number;
  fromGoal: number;
};

const chargeOf = (b: BillItem) => b.yearly?.total ?? b.amount;

/** The month with HeyKip Plus where it should be, or null when nothing needs to change. */
export function syncPlusBill(m: MonthBudget, plan: string, price: PlusPrice | null | undefined, now = new Date()): MonthBudget | null {
  const items = m.bills.items ?? [];
  const i = items.findIndex((b) => b.name === PLUS_BILL);
  const paid = plan === 'monthly' || plan === 'yearly';

  if (!paid) {
    if (i < 0 || (plan !== 'free' && plan !== 'trial')) return null;
    const b = items[i];
    return { ...removeBill(m, i), plusNote: { kind: 'gone', charge: chargeOf(b), yearly: !!b.yearly, perMonth: b.amount, fromFun: 0, fromGoal: 0 } };
  }
  if (!price || price.currency !== 'THB' || !(price.amount > 0)) return null;

  const renews = new Date(price.renews_at);
  const charge = Math.round(price.amount);
  const yearly = price.period === 'yearly';
  const due = `${renews.getFullYear()}-${String(renews.getMonth() + 1).padStart(2, '0')}`;
  const want: Omit<BillItem, 'name' | 'amount'> & { amount: number } = yearly
    ? { amount: yearlySetAside(charge, due, 0, now), yearly: { total: charge, due, since: isoDay(now) }, day: renews.getDate(), type: 'other' }
    : { amount: charge, day: renews.getDate(), type: 'other' };

  if (i >= 0) {
    const b = items[i];
    if (chargeOf(b) === charge && !!b.yearly === yearly) {
      // Same price: only follow a new renewal date (a year paid → the next one is due a year later).
      if (yearly ? b.yearly!.due === due : b.day === want.day) return null;
      return { ...m, bills: { ...m.bills, items: items.map((x, k) => (k === i ? { ...x, ...want, name: PLUS_BILL } : x)) } };
    }
  }
  const base = i >= 0 ? removeBill(m, i) : m;
  const { amount, ...extra } = want;
  const r = addBill(base, PLUS_BILL, amount, extra);
  return {
    ...r.month,
    plusNote: { kind: i >= 0 ? 'changed' : 'added', charge, yearly, perMonth: amount, was: i >= 0 ? chargeOf(items[i]) : undefined, fromFun: r.fromFun, fromGoal: r.fromGoal },
  };
}
