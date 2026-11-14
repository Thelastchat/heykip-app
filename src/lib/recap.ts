// Payday recap (approved mockup): the pay month that just ended, in a minute. Every number is the app's own maths
// from what was logged; Kip (AI, Plus) only writes "Kip noticed" from these numbers and picks up to 3 changes from
// the ones made here (each already checked by the app's money rules). Nothing changes until it's tapped.
import { CATEGORY, spendingTotal, type CatKey, type MonthBudget } from '@/lib/budget';
import { arrivals, splitOf, type GoalLite } from '@/lib/goals';
import { budgetKey, period, periodAt, periodMonth } from '@/lib/home';
import { applyOps } from '@/lib/monthops';
import { leftoverNotice, subNotices, type LastCycle, type Notice } from '@/lib/notice';
import type { LoggedTx } from '@/lib/subs';

/** The recap card shows from payday for 5 days (or until it's opened). */
export const RECAP_DAYS = 5;

export type RecapCat = { key: CatKey; spent: number; plan: number };
export type Suggestion =
  | { id: string; kind: 'move'; from: CatKey; to: CatKey; amount: number; next: MonthBudget }
  | { id: string; kind: 'leftover'; notice: Extract<Notice, { kind: 'leftover' }> }
  | { id: string; kind: 'sub'; notice: Extract<Notice, { kind: 'sub' }> };

export type Recap = {
  id: string;
  /** the month it's called by, and its days */
  month: Date;
  start: Date;
  end: Date;
  spent: number;
  plan: number;
  left: number;
  cats: RecapCat[];
  mostOver: RecapCat | null;
  goal: { name: string; perMonth: number; arrives: Date | null } | null;
  /** facts for Kip to notice from: weekday vs weekend, and the most frequent things */
  facts: { weekdayPerDay: Partial<Record<CatKey, number>>; weekendPerDay: Partial<Record<CatKey, number>>; top: { name: string; times: number; total: number }[]; days: number };
  suggestions: Suggestion[];
};

/**
 * The recap of last pay month, or null when there's nothing honest to say: too early or too late in the new month
 * (outside `days`), or last month wasn't logged from its start on at least half its days.
 */
export function recapFor(
  m: MonthBudget | null,
  tx: LoggedTx[],
  last: LastCycle | null,
  goals: (GoalLite & { title: string })[],
  now = new Date(),
  days = RECAP_DAYS,
): Recap | null {
  if (!m || !last || !last.startedBefore) return null;
  const P = period(m.payday, now);
  if (P.dayIndex >= days) return null;
  const prev = periodAt(m.payday, -1, now);
  if (last.days < Math.ceil(prev.total / 2)) return null;

  const from = prev.start.getTime();
  const to = prev.end.getTime();
  const byCat: Partial<Record<CatKey, number>> = {};
  const wd: Partial<Record<CatKey, number>> = {};
  const we: Partial<Record<CatKey, number>> = {};
  const names = new Map<string, { name: string; times: number; total: number }>();
  let weekdays = 0;
  let weekends = 0;
  for (let d = new Date(prev.start); d < prev.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) weekends++;
    else weekdays++;
  }
  for (const t of tx) {
    const at = new Date(t.occurred_at);
    if (t.kind !== 'spend' || at.getTime() < from || at.getTime() >= to) continue;
    const key = budgetKey(t.cat ?? 'other', m);
    if (key === 'bills') continue;
    byCat[key] = (byCat[key] ?? 0) + t.amount;
    const bucket = at.getDay() === 0 || at.getDay() === 6 ? we : wd;
    bucket[key] = (bucket[key] ?? 0) + t.amount;
    const n = (t.note ?? '').trim();
    if (n) {
      const k = n.toLowerCase();
      const cur = names.get(k) ?? { name: n.slice(0, 30), times: 0, total: 0 };
      names.set(k, { ...cur, times: cur.times + 1, total: cur.total + t.amount });
    }
  }
  const perDay = (src: Partial<Record<CatKey, number>>, n: number) =>
    Object.fromEntries(Object.entries(src).map(([k, v]) => [k, n ? Math.round((v ?? 0) / n) : 0])) as Partial<Record<CatKey, number>>;

  // What ran over first (most first), then the rest by what was spent.
  const cats: RecapCat[] = m.spend
    .map((s) => ({ key: s.key, spent: Math.round(byCat[s.key] ?? 0), plan: s.amount }))
    .sort((a, b) => Math.max(0, b.spent - b.plan) - Math.max(0, a.spent - a.plan) || b.spent - a.spent);
  const spent = cats.reduce((a, c) => a + c.spent, 0);
  const plan = spendingTotal(m) + last.extra;
  const overs = cats.filter((c) => c.spent > c.plan).sort((a, b) => b.spent - b.plan - (a.spent - a.plan));

  const goal0 = goals[0];
  const lites = goals.map(({ title: _t, ...g }) => g);
  const goal = goal0
    ? { name: goal0.title, perMonth: splitOf(m, lites).get(goal0.id) ?? 0, arrives: goal0.kind !== 'monthly' ? (arrivals(lites, splitOf(m, lites), m.payday, now).get(goal0.id) ?? null) : null }
    : null;

  // Suggestions the app can stand behind; Kip may pick and word them, never invent them.
  const suggestions: Suggestion[] = [];
  // 1. A budget that ran over gets money from one that stayed well under (what it didn't use, in ฿100s).
  const unders = cats.filter((c) => c.plan - c.spent >= 300 && c.key !== 'spend_freely').sort((a, b) => b.plan - b.spent - (a.plan - a.spent));
  for (const o of overs.slice(0, 2)) {
    const u = unders.find((x) => x.key !== o.key);
    if (!u) break;
    const amount = Math.floor(Math.min(o.spent - o.plan, u.plan - u.spent) / 100) * 100;
    if (amount < 200) continue;
    const next = applyOps(m, [{ op: 'move', from: u.key, to: o.key, amount }]);
    if (next) suggestions.push({ id: `move:${u.key}:${o.key}:${amount}`, kind: 'move', from: u.key, to: o.key, amount, next });
    unders.splice(unders.indexOf(u), 1);
  }
  // 2. Left over → the goal (asked: Kip can't see the bank).
  const lo = leftoverNotice(m, last, P, goals, now);
  if (lo && lo.kind === 'leftover') suggestions.push({ id: lo.id, kind: 'leftover', notice: lo });
  // 3. A subscription that isn't a bill yet.
  const sub = subNotices(m, tx, now).find((n) => n.kind === 'sub');
  if (sub && sub.kind === 'sub') suggestions.push({ id: sub.id, kind: 'sub', notice: sub });

  return {
    id: `recap:${prev.start.toDateString()}`,
    month: periodMonth(prev),
    start: prev.start,
    end: new Date(prev.end.getTime() - 86_400_000),
    spent,
    plan,
    left: plan - spent,
    cats,
    mostOver: overs[0] ?? null,
    goal,
    facts: {
      weekdayPerDay: perDay(wd, weekdays),
      weekendPerDay: perDay(we, weekends),
      top: [...names.values()].sort((a, b) => b.total - a.total).slice(0, 5),
      days: last.days,
    },
    suggestions: suggestions.slice(0, 3),
  };
}

/** What Kip is told: numbers only (the AI writes words from them and picks suggestion ids). */
export function recapContext(r: Recap) {
  const name = (k: CatKey) => CATEGORY[k].name;
  return {
    month: r.month.toISOString().slice(0, 7),
    spent: r.spent,
    plan: r.plan,
    left: r.left,
    categories: r.cats.map((c) => ({ name: name(c.key), spent: c.spent, plan: c.plan })),
    weekday_per_day: Object.fromEntries(Object.entries(r.facts.weekdayPerDay).map(([k, v]) => [name(k as CatKey), v])),
    weekend_per_day: Object.fromEntries(Object.entries(r.facts.weekendPerDay).map(([k, v]) => [name(k as CatKey), v])),
    most_often: r.facts.top,
    days_logged: r.facts.days,
    goal: r.goal ? { name: r.goal.name, per_month: r.goal.perMonth, arrives: r.goal.arrives?.toISOString().slice(0, 7) ?? null } : null,
    suggestions: r.suggestions.map((s) =>
      s.kind === 'move'
        ? { id: s.id, what: `move ${s.amount} from ${name(s.from)} to ${name(s.to)}` }
        : s.kind === 'leftover'
          ? { id: s.id, what: `put ${s.notice.amount} left over toward ${s.notice.goalName}` }
          : { id: s.id, what: `add ${s.notice.name} ${s.notice.amount} a month as a bill` },
    ),
  };
}
