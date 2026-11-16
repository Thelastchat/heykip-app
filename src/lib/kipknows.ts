// What Kip knows (Talk to Kip, step 3): the facts the app already has, handed to Kip as numbers so it can answer
// "when's Netflix due?", "what did I spend most on last month?" and mention what the detective found. All of it is
// the app's own maths on what's loaded; Kip never gets the bank, only these.
import { CATEGORY, type CatKey, type MonthBudget } from '@/lib/budget';
import { dueBills, nextDue } from '@/lib/billdue';
import { budgetKey, periodAt, periodMonth } from '@/lib/home';
import { findPriceChanges, findRepeats, findStopped, type LoggedTx } from '@/lib/subs';

export type KipKnows = {
  /** every bill with a due day: when it's due next (days from today; below 0 = late), and whether it's paid */
  dueDays: { name: string; day: number; dueIn: number | null; paid: boolean }[];
  /** the last 3 pay months that are over: spending by category and the things logged most often */
  lastMonths: { month: string; spent: number; byCategory: Record<string, number>; mostOften: { name: string; times: number; total: number }[] }[];
  /** what the detective found: repeats that aren't bills yet, bills whose price changed, bills that may have stopped */
  noticed: { subscriptions: { name: string; amount: number; day: number }[]; priceChanges: { name: string; was: number; now: number }[]; stopped: { name: string; amount: number }[] };
};

export function kipKnows(m: MonthBudget, tx: LoggedTx[], now = new Date()): KipKnows {
  const dueDays = dueBills(m, now).map((b) => {
    const n = nextDue(b, m.payday, now);
    return { name: b.name, day: b.day, dueIn: n ? n.days : null, paid: b.paid };
  });

  const lastMonths: KipKnows['lastMonths'] = [];
  for (let k = -1; k >= -3; k--) {
    const P = periodAt(m.payday, k, now);
    const from = P.start.getTime();
    const to = P.end.getTime();
    const byCat: Partial<Record<CatKey, number>> = {};
    const names = new Map<string, { name: string; times: number; total: number }>();
    let spent = 0;
    for (const t of tx) {
      const at = new Date(t.occurred_at).getTime();
      if (t.kind !== 'spend' || at < from || at >= to) continue;
      const key = budgetKey(t.cat ?? 'other', m);
      if (key === 'bills') continue;
      spent += t.amount;
      byCat[key] = (byCat[key] ?? 0) + t.amount;
      const n = (t.note ?? '').trim();
      if (n) {
        const id = n.toLowerCase();
        const cur = names.get(id) ?? { name: n.slice(0, 30), times: 0, total: 0 };
        names.set(id, { ...cur, times: cur.times + 1, total: cur.total + t.amount });
      }
    }
    if (spent <= 0) continue; // nothing logged: Kip isn't told a month of zeros
    lastMonths.push({
      month: periodMonth(P).toISOString().slice(0, 7),
      spent: Math.round(spent),
      byCategory: Object.fromEntries(Object.entries(byCat).map(([c, v]) => [CATEGORY[c as CatKey].name, Math.round(v ?? 0)])),
      mostOften: [...names.values()].sort((a, b) => b.times - a.times || b.total - a.total).slice(0, 5),
    });
  }

  return {
    dueDays,
    lastMonths,
    noticed: {
      subscriptions: findRepeats(tx, m, now).map((r) => ({ name: r.name, amount: r.amount, day: r.day })),
      priceChanges: findPriceChanges(tx, m).map((p) => ({ name: p.name, was: p.was, now: p.now })),
      stopped: findStopped(tx, m, now).map((s) => ({ name: s.name, amount: s.amount })),
    },
  };
}
