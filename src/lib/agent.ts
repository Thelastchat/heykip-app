// Agent Kip (approved mockup): Kip turns what someone says into changes; this file makes them with the app's own
// rules and shows every number before anything is saved. Kip never decides money — if a change doesn't fit, it's
// refused here, not guessed.
//
// Two kinds of change:
//   change — the plan: move money between budgets, set a budget, add / remove / pay a bill (monthly or yearly),
//            move fun money to the goal for this month, switch money style, take money out of the goal.
//   fix    — things already logged: delete one, change its category or amount.
// Logging (spends, money in) isn't here: it's saved straight away with Undo.
import { applyOps } from '@/lib/monthops';
import type { ChangeRow } from '@/components/TellKip';
import { addBill, CATEGORY, lowerBudget, STYLES, withStyle, type BillType, type CatKey, type MonthBudget } from '@/lib/budget';
import { BILL_TYPES, guessType, nextDue, yearlySetAside } from '@/lib/everymonth';
import { arrivals, splitOf, type GoalLite } from '@/lib/goals';
import { periodKey } from '@/lib/home';
import { t } from '@/lib/i18n';
import { DB_CAT_NAME, type DbCat } from '@/lib/kip';
import { baht } from '@/lib/money';
import { monthYear } from '@/lib/setup/plan';
import type { BudgetStyle } from '@/lib/setup/draft';

export type AgentOp = {
  op: 'move' | 'set' | 'add_bill' | 'remove_bill' | 'pay_bill' | 'to_goal' | 'take_goal' | 'style';
  from?: string;
  to?: string;
  category?: string;
  amount?: number;
  name?: string;
  bill_type?: string;
  /** add_bill: a yearly bill — `amount` is the whole year, due in this month (1–12). */
  due_month?: number;
  style?: string;
};
export type FixOp = { ref: string; op: 'delete' | 'category' | 'amount'; category?: string; amount?: number };
export type RecentTx = { ref: string; id: string; name: string; amount: number; category: DbCat; at: string };

export type ChangePlan = { next: MonthBudget; take: number; rows: ChangeRow[] };
export type FixPlan = { edits: { tx: RecentTx; op: FixOp['op']; category?: DbCat; amount?: number }[]; rows: ChangeRow[] };

const STYLE_KEYS: BudgetStyle[] = ['kip', '503020', 'jars', 'savefirst'];
const DB_CATS: DbCat[] = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'home_bills', 'travel', 'family_pets', 'giving', 'learning', 'installments', 'other'];

/** Make the plan changes. Null = something doesn't fit (a bill that isn't there, more than the goal has…). */
export function planChange(m: MonthBudget, goals: GoalLite[], ops: AgentOp[], now = new Date()): ChangePlan | null {
  let next = m;
  let take = 0;
  const main = goals[0];
  for (const o of ops) {
    const amount = Math.round(Math.abs(Number(o.amount) || 0));
    if (o.op === 'move' || o.op === 'set' || o.op === 'remove_bill') {
      const r = applyOps(next, [o as never]);
      if (!r) return null;
      next = r;
    } else if (o.op === 'add_bill') {
      const name = (o.name ?? '').trim().slice(0, 40);
      if (!name || amount <= 0) return null;
      const type = BILL_TYPES.includes(o.bill_type as BillType) ? (o.bill_type as BillType) : guessType(name);
      const mo = Math.round(Number(o.due_month) || 0);
      if (mo >= 1 && mo <= 12) {
        const due = nextDue(mo - 1, now);
        const r = addBill(next, name, yearlySetAside(amount, due, 0, now), { type, yearly: { total: amount, due, since: now.toISOString().slice(0, 10) } });
        if (r.short > 0) return null;
        next = r.month;
      } else {
        // A bill bigger than what can bend this month doesn't fit: refused, never an overspent plan.
        const r = addBill(next, name, amount, { type });
        if (r.short > 0) return null;
        next = r.month;
      }
    } else if (o.op === 'pay_bill') {
      const want = (o.name ?? '').trim().toLowerCase();
      const key =
        /^(rent|ค่าเช่า|ค่าห้อง)$/.test(want) && next.bills.rent > 0 ? 'rent' : (next.bills.items ?? []).find((b) => b.name.toLowerCase() === want || b.name.toLowerCase().includes(want))?.name;
      if (!key) return null;
      const k = key === 'rent' ? 'rent' : `item:${key}`;
      const pk = periodKey(next.payday, now);
      const keys = next.paid?.period === pk ? next.paid.keys : [];
      if (keys.includes(k)) return null;
      next = { ...next, paid: { period: pk, keys: [...keys, k] } };
    } else if (o.op === 'to_goal') {
      const from = (o.from ?? 'fun') as CatKey;
      const cur = next.spend.find((s) => s.key === from)?.amount;
      if (cur === undefined || amount <= 0) return null;
      next = lowerBudget(next, from, Math.max(0, cur - amount), 'goal');
    } else if (o.op === 'style') {
      if (!STYLE_KEYS.includes(o.style as BudgetStyle) || o.style === next.style) return null;
      next = withStyle(next, o.style as BudgetStyle);
    } else if (o.op === 'take_goal') {
      if (!main || amount <= 0 || take + amount > main.saved) return null;
      take += amount;
    } else return null;
  }
  return { next, take, rows: changeRows(m, next, goals, take, now) };
}

/** Every number that changed, then what it does to the main goal. */
export function changeRows(a: MonthBudget, b: MonthBudget, goals: GoalLite[], take: number, now = new Date()): ChangeRow[] {
  const rows: ChangeRow[] = [];
  for (const s of b.spend) {
    const was = a.spend.find((x) => x.key === s.key)?.amount ?? 0;
    if (was !== s.amount) rows.push({ icon: null, title: CATEGORY[s.key].name, from: baht(was), to: baht(s.amount), warn: s.amount < was });
  }
  const aBills = a.bills.items ?? [];
  for (const bill of b.bills.items ?? [])
    if (!aBills.some((x) => x.name === bill.name))
      rows.push({
        icon: 'bill',
        title: bill.name,
        sub: bill.yearly ? t('{total} a year · set aside every month', { total: baht(bill.yearly.total) }) : t('New bill · every month'),
        to: `+${baht(bill.amount)}`,
      });
  for (const bill of aBills) if (!(b.bills.items ?? []).some((x) => x.name === bill.name)) rows.push({ icon: 'bill', title: bill.name, sub: t('Bill removed'), from: baht(bill.amount), to: baht(0) });
  // A new bill comes out of Kip's guess for other bills first: show it, so nothing looks free.
  if (a.bills.guess !== b.bills.guess)
    rows.push({ icon: null, title: t('Other bills'), sub: t('Kip’s guess shrinks as you add real ones'), from: `~${baht(a.bills.guess)}`, to: `~${baht(b.bills.guess)}` });
  const paidA = a.paid?.keys ?? [];
  for (const k of b.paid?.keys ?? []) if (!paidA.includes(k)) rows.push({ icon: 'bill', title: k === 'rent' ? t('Rent') : k.slice(5), sub: t('Marked paid'), to: '✓' });
  if (a.style !== b.style) rows.push({ icon: null, title: t('Money style'), from: STYLES.find((s) => s.key === a.style)?.name, to: STYLES.find((s) => s.key === b.style)?.name ?? '' });
  const ga = a.goal.amount + a.goalExtra;
  const gb = b.goal.amount + b.goalExtra;
  const main = goals[0];
  if (ga !== gb) rows.push({ icon: 'piggy', title: t('Saving a month'), from: baht(ga), to: baht(gb), warn: gb < ga });
  if (main && take > 0) rows.push({ icon: 'piggy', title: t('{goal} saved so far', { goal: b.goal.title }), from: baht(main.saved), to: baht(main.saved - take), warn: true });
  if (main && main.kind !== 'monthly') {
    const before = arrivals(goals, splitOf(a, goals), a.payday, now).get(main.id);
    const lites = goals.map((g) => (g.id === main.id ? { ...g, saved: g.saved - take } : g));
    const after = arrivals(lites, splitOf(b, lites), b.payday, now).get(main.id);
    const same = (before?.getTime() ?? 0) === (after?.getTime() ?? 0);
    rows.push({
      icon: 'plane',
      title: b.goal.title,
      sub: same ? t('No change') : undefined,
      from: same || !before ? undefined : monthYear(before),
      to: after ? monthYear(after) : t('No date yet'),
      warn: !same && !!before && !!after && after > before,
    });
  }
  return rows;
}

/** Fixes to things already logged. Null when Kip pointed at something that isn't in the recent list. */
export function planFix(recent: RecentTx[], fixes: FixOp[]): FixPlan | null {
  const edits: FixPlan['edits'] = [];
  for (const f of fixes) {
    const tx = recent.find((r) => r.ref === f.ref);
    if (!tx) return null;
    if (f.op === 'delete') edits.push({ tx, op: 'delete' });
    else if (f.op === 'category') {
      if (!DB_CATS.includes(f.category as DbCat) || f.category === tx.category) return null;
      edits.push({ tx, op: 'category', category: f.category as DbCat });
    } else if (f.op === 'amount') {
      const amount = Math.round(Math.abs(Number(f.amount) || 0));
      if (amount <= 0 || amount === tx.amount) return null;
      edits.push({ tx, op: 'amount', amount });
    } else return null;
  }
  if (!edits.length) return null;
  const rows: ChangeRow[] = edits.map((e) =>
    e.op === 'delete'
      ? { icon: null, title: e.tx.name, sub: DB_CAT_NAME[e.tx.category], from: baht(e.tx.amount), to: t('Deleted'), warn: true }
      : e.op === 'category'
        ? { icon: null, title: e.tx.name, sub: baht(e.tx.amount), from: DB_CAT_NAME[e.tx.category], to: DB_CAT_NAME[e.category!] }
        : { icon: null, title: e.tx.name, sub: DB_CAT_NAME[e.tx.category], from: baht(e.tx.amount), to: baht(e.amount!) },
  );
  return { edits, rows };
}

/** What Kip remembers of a turn: what was said, and what came of it — short, so memory stays cheap. */
export function memoryLine(kind: string, reply: string, outcome: string | null): string {
  return [reply, outcome].filter(Boolean).join(' ').slice(0, 280);
}
