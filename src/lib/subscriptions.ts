// Subscriptions (approved 27 Nov): the bills you can actually cancel — streaming, apps, gyms — on one page, a "Keep or
// cancel?" card a few days before each one renews, and cancelling that pays the goal. All of it is the app's own
// maths on Every month: free, no AI. HeyKip Plus is on the list too, at what the person really pays (from the App
// Store receipt), because an app that tracks subscriptions shouldn't hide its own.
//
// Money rules:
//   · A subscription is a bill (Every month). Its monthly cost is its amount, or a yearly one's total ÷ 12.
//   · Cancelling removes the bill. Its money goes to the goal by default (removeBill), or back to fun money if the
//     person picks that. Never to rent, bills or the safety net — those are already whole.
//   · Keep or cancel shows once per renewal, 1–3 days before it; "Still using it" puts it away until after that date.
import { removeBill, type BillItem, type CatKey, type MonthBudget } from '@/lib/budget';
import { dueBills, nextDue } from '@/lib/billdue';
import { typeOf } from '@/lib/everymonth';
import { cleanName, KNOWN_SUBS } from '@/lib/subs';

/** The name HeyKip Plus has in Every month. */
export const PLUS_BILL = 'HeyKip Plus';

export type Sub = {
  index: number;
  name: string;
  /** what one payment is (a yearly one: the whole year) */
  charge: number;
  perMonth: number;
  perYear: number;
  yearly: boolean;
  day: number | null;
  next: Date | null;
  /** HeyKip's own */
  plus: boolean;
};

/** A bill you can cancel: streaming and fitness, any app or service we know by name, and HeyKip Plus. */
export function isSubscription(b: Pick<BillItem, 'name' | 'type'>): boolean {
  if (b.name === PLUS_BILL) return true;
  const type = typeOf(b);
  if (type === 'streaming' || type === 'fitness') return true;
  if (type !== 'other') return false;
  const known = cleanName(b.name).name;
  return KNOWN_SUBS.has(known);
}

/** Every subscription in the plan, the dearest first (a month's cost), with when it charges next. */
export function subsOf(m: MonthBudget | null, now = new Date()): Sub[] {
  if (!m) return [];
  const due = new Map(dueBills(m, now).map((b) => [b.name, b]));
  return (m.bills.items ?? [])
    .map((b, index) => ({ b, index }))
    .filter(({ b }) => isSubscription(b))
    .map(({ b, index }) => {
      const yearly = !!b.yearly;
      const charge = yearly ? b.yearly!.total : b.amount;
      // A month: what the plan really puts aside for it (a yearly one's set-aside, in ฿10 steps), so it matches Kip.
      const perMonth = b.amount;
      const d = due.get(b.name);
      // Renews: the next charge from today. A day already gone this month has renewed by itself (it's not "late").
      const n = d ? nextDue(d, m.payday, now) : null;
      const next = d && n && n.days < 0 ? (nextDue({ ...d, paid: true }, m.payday, now)?.date ?? null) : (n?.date ?? null);
      return { index, name: b.name, charge, perMonth, perYear: yearly ? charge : charge * 12, yearly, day: b.day ?? null, next, plus: b.name === PLUS_BILL };
    })
    .sort((a, c) => c.perMonth - a.perMonth);
}

/** What they really cost: a year, and that year ÷ 12 (so the two always agree; a yearly one's set-aside is rounded up). */
export const subsTotal = (subs: Sub[]) => {
  const perYear = subs.reduce((a, s) => a + s.perYear, 0);
  return { perMonth: Math.round(perYear / 12), perYear };
};

/** Kip asks this many days before a subscription renews (the day before at the latest). */
export const ASK_DAYS = 3;

export type Renewal = { id: string; kind: 'renew'; name: string; index: number; charge: number; perMonth: number; yearly: boolean; date: Date; days: number };

/** The next subscription to renew within ASK_DAYS (not today: by then it's too late to cancel), not HeyKip itself. */
export function renewalNotice(m: MonthBudget, now = new Date(), skip: (id: string) => boolean = () => false): Renewal | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const s of subsOf(m, now)
    .filter((x) => x.next && !x.plus)
    .sort((a, c) => a.next!.getTime() - c.next!.getTime())) {
    const days = Math.round((s.next!.getTime() - today.getTime()) / 86_400_000);
    if (days < 1 || days > ASK_DAYS) continue;
    const id = `renew:${s.name}:${s.next!.toISOString().slice(0, 10)}`;
    if (skip(id)) continue;
    return { id, kind: 'renew', name: s.name, index: s.index, charge: s.charge, perMonth: s.perMonth, yearly: s.yearly, date: s.next!, days };
  }
  return null;
}

/** Where a cancelled subscription's money goes: a goal (any pinned one), the safety net while it isn't full, or fun. */
export type FreedTo = { to: 'goal'; goalId?: string } | { to: 'safety' } | { to: 'fun' };

/**
 * The plan after cancelling. removeBill gives the money to the month's goal saving, which goes to the first goal;
 * from there it can go to another pinned goal (its share of the split grows), to the safety net, or back to fun.
 * Every baht still has one job: whatever goes somewhere else comes off the goal saving first.
 */
export function cancelSub(m: MonthBudget, index: number, dest: FreedTo): { month: MonthBudget; freed: number } {
  const before = m.goalExtra;
  const next = removeBill(m, index);
  const freed = Math.max(0, next.goalExtra - before);
  if (freed <= 0) return { month: next, freed: 0 };
  if (dest.to === 'goal') {
    // The first goal gets the goal saving's rest already; another goal gets its own share raised.
    if (!dest.goalId) return { month: next, freed };
    const goals = next.goals ?? [];
    const has = goals.some((g) => g.id === dest.goalId);
    return {
      month: { ...next, goals: has ? goals.map((g) => (g.id === dest.goalId ? { ...g, amount: g.amount + freed } : g)) : [...goals, { id: dest.goalId, amount: freed }] },
      freed,
    };
  }
  const back = { ...next, goalExtra: before };
  if (dest.to === 'safety') return { month: { ...back, safety: { ...back.safety, amount: back.safety.amount + freed } }, freed };
  // Back to fun: the fun budget (or the one free pot in Save first), else the first want there is.
  const key: CatKey | undefined = (['fun', 'spend_freely', 'shopping'] as CatKey[]).find((k) => back.spend.some((s) => s.key === k));
  if (!key) return { month: next, freed };
  return { month: { ...back, spend: back.spend.map((s) => (s.key === key ? { ...s, amount: s.amount + freed } : s)) }, freed };
}

/** Where you go to cancel. Apple and Google have one page for every subscription bought through them. */
export type PaidVia = 'apple' | 'google' | 'direct';
export const CANCEL_URL: Record<Exclude<PaidVia, 'direct'>, string> = {
  apple: 'https://apps.apple.com/account/subscriptions',
  google: 'https://play.google.com/store/account/subscriptions',
};
