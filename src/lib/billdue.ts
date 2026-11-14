// Bills with a due day (approved mockup): each bill and subscription can have its own day of the month, and a
// reminder the day before or on the day. Pure dates here — Home shows what's due next, Kip's card asks on the day,
// and reminders.ts turns these into phone notifications.
//
// Rules:
//   · A day is 1–31; 31 means "the last day" (a month without the 31st uses its last day).
//   · Each pay month holds one due date per bill: the date of its day that falls inside that pay month.
//   · Paid this pay month → the next one is next pay month's. Not paid and the date has passed → overdue.
//   · Yearly bills keep their month (yearly.due, "YYYY-MM") and use the day inside it.
//   · Rent's day is on the month itself (rentDue). A bill without a day has no due date — never a guessed one.
import type { BillItem, MonthBudget, Remind } from '@/lib/budget';
import { period, periodKey } from '@/lib/home';

export type { Remind };
export const REMINDS: Remind[] = ['before', 'day', 'off'];
/** Reminders go out at 9:00 in the morning. */
export const REMIND_HOUR = 9;

export type DueBill = { key: string; name: string; amount: number; day: number; remind: Remind; yearly?: string; paid: boolean; explicit: boolean };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Day `day` of a month, or its last day when the month is shorter. */
export const dateIn = (y: number, m: number, day: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));

/** Every bill that has a due day. */
export function dueBills(m: MonthBudget, now = new Date()): DueBill[] {
  const pk = periodKey(m.payday, now);
  const paid = m.paid?.period === pk ? m.paid.keys : [];
  const out: DueBill[] = [];
  if (m.bills.rent > 0 && m.rentDue) out.push({ key: 'rent', name: 'Rent', amount: m.bills.rent, day: m.rentDue.day, remind: m.rentDue.remind, paid: paid.includes('rent'), explicit: true });
  for (const b of m.bills.items ?? [])
    if (b.day)
      out.push({
        key: `item:${b.name}`,
        name: b.name,
        amount: b.yearly ? b.yearly.total : b.amount,
        day: b.day,
        remind: b.remind ?? 'before',
        yearly: b.yearly?.due,
        paid: paid.includes(`item:${b.name}`),
        explicit: true,
      });
  return out;
}

/** The bill's due date inside the pay month that holds `at` (null when a yearly bill isn't due in it). */
function dueInPeriod(b: Pick<DueBill, 'day' | 'yearly'>, payday: number | null, at: Date): Date | null {
  const P = period(payday, at);
  if (b.yearly) {
    const d = dateIn(Number(b.yearly.slice(0, 4)), Number(b.yearly.slice(5)) - 1, b.day);
    return d >= P.start && d < P.end ? d : null;
  }
  // The pay month spans at most two calendar months: the day in one of them falls inside it.
  for (const k of [0, 1]) {
    const d = dateIn(P.start.getFullYear(), P.start.getMonth() + k, b.day);
    if (d >= P.start && d < P.end) return d;
  }
  return null;
}

/** When it's due next, and in how many days (0 = today, below 0 = overdue and not paid yet). */
export function nextDue(b: DueBill, payday: number | null, now = new Date()): { date: Date; days: number } | null {
  const today = startOfDay(now);
  const days = (d: Date) => Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
  const here = dueInPeriod(b, payday, now);
  if (here && !b.paid) return { date: here, days: days(here) };
  // Paid (or not due this pay month): look ahead month by month — a yearly bill can be up to a year away.
  let at = period(payday, now).end;
  for (let i = 0; i < 13; i++) {
    const d = dueInPeriod(b, payday, at);
    if (d) return { date: d, days: days(d) };
    at = period(payday, at).end;
  }
  return null;
}

export type Reminder = { id: string; key: string; at: Date; name: string; amount: number; when: 'tomorrow' | 'today' };

/**
 * The reminders to have waiting on the phone: for each bill with a reminder, its next few due dates (a paid one
 * skips this pay month's), at 9:00 the day before or on the day. Never in the past; at most `max` in all
 * (iPhones keep 64 waiting).
 */
export function remindersFor(m: MonthBudget, now = new Date(), max = 60): Reminder[] {
  const out: Reminder[] = [];
  for (const b of dueBills(m, now)) {
    if (b.remind === 'off' || !b.explicit) continue;
    let at: Date = now;
    for (let n = 0; n < (b.yearly ? 1 : 3); n++) {
      const d = nextDue({ ...b, paid: n === 0 ? b.paid : true }, m.payday, at);
      if (!d) break;
      const fire = new Date(d.date.getFullYear(), d.date.getMonth(), d.date.getDate() - (b.remind === 'before' ? 1 : 0), REMIND_HOUR);
      if (fire > now) out.push({ id: `bill:${b.key}:${d.date.toISOString().slice(0, 10)}`, key: b.key, at: fire, name: b.name, amount: b.amount, when: b.remind === 'before' ? 'tomorrow' : 'today' });
      at = new Date(d.date.getTime() + 86_400_000);
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, max);
}

/** A bill's due day and reminder, kept by the bill when it's edited. */
export const dueOf = (b: BillItem | undefined) => ({ day: b?.day ?? null, remind: b?.remind ?? ('before' as Remind) });
