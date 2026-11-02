// Money in, the same way everywhere (typed with "Got paid", from a slip, or told to Kip):
// · Usual pay is what the plan already runs on — it changes nothing. Once this month's pay is all in, the saving
//   moves to the goal and the safety net (by itself with Payday auto-move, or with one tap).
// · Anything beyond that is extra and gets a job: a goal, the safety net, or spending (in general or one category).
//   Kept-for-spending money is remembered on the money-in entry (`job`), and Home adds it to this month.
import { coverOf, periodKey } from '@/lib/home';
import type { CatKey, MonthBudget } from '@/lib/budget';
import { splitOf, type GoalLite } from '@/lib/goals';
import { supabase } from '@/lib/supabase';

export type MoneyIn = { id: string; amount: number; category: string; note: string | null };

/** What an entry of money in was used for. Only `spend` and `cats` change this month's spending money. */
export type Job = { spend?: number; cats?: Partial<Record<CatKey, number>>; goals?: Record<string, number>; safety?: number };

/** One part of a split: where some of the extra money goes. */
export type Part = { to: 'goal'; goalId: string; amount: number } | { to: 'safety'; amount: number } | { to: 'spend'; amount: number } | { to: 'category'; category: CatKey; amount: number };

/** How much of what just came in is usual pay, and how much is extra. `payBefore` = pay already logged this cycle. */
export function splitIn(items: MoneyIn[], usual: number, payBefore: number) {
  const pay = items.filter((i) => i.category === 'pay').reduce((a, i) => a + i.amount, 0);
  const other = items.filter((i) => i.category !== 'pay').reduce((a, i) => a + i.amount, 0);
  const payRoom = usual > 0 ? Math.max(0, usual - payBefore) : pay; // how much pay the plan still expects
  const payUsual = Math.min(pay, payRoom);
  const payExtra = pay - payUsual;
  const payTotal = payBefore + pay;
  return {
    pay,
    payUsual,
    payExtra,
    extra: payExtra + other,
    payTotal,
    stillToCome: usual > 0 && pay > 0 ? Math.max(0, usual - payTotal) : 0,
    payComplete: pay > 0 && (usual <= 0 || payTotal >= usual),
  };
}

/** Where the extra money mostly came from (for the goal's history). */
export function fromKind(items: MoneyIn[], payExtra: number): 'bonus' | 'side' | 'gift' | 'other' {
  const sum = (c: string) => items.filter((i) => i.category === c).reduce((a, i) => a + i.amount, 0);
  const parts: ['bonus' | 'side' | 'gift' | 'other', number][] = [
    ['bonus', payExtra],
    ['side', sum('side_gigs')],
    ['gift', sum('gifts')],
    ['other', sum('other')],
  ];
  return parts.sort((a, b) => b[1] - a[1])[0][0];
}

/** Check a split before anything moves: real places only, whole baht, adds up exactly. */
export function checkParts(parts: Part[], total: number, goalIds: string[], cats: CatKey[], safetyOn: boolean): Part[] | null {
  const clean = parts
    .map((p) => ({ ...p, amount: Math.round(Number(p.amount) || 0) }))
    .filter((p) => p.amount > 0)
    .filter((p) => (p.to === 'goal' ? goalIds.includes(p.goalId) : p.to === 'category' ? cats.includes(p.category) : p.to === 'safety' ? safetyOn : p.to === 'spend'));
  const sum = clean.reduce((a, p) => a + p.amount, 0);
  if (!clean.length || Math.abs(sum - Math.round(total)) > 1) return null;
  // Rounding: any baht left over goes to the biggest part.
  const diff = Math.round(total) - sum;
  if (diff) clean.sort((a, b) => b.amount - a.amount)[0].amount += diff;
  return clean as Part[];
}

/** Carry out a split: goals and the safety net move now; spending is remembered on the entries. */
export async function giveJob(items: MoneyIn[], parts: Part[], from: 'bonus' | 'side' | 'gift' | 'other'): Promise<string | null> {
  const job: Job = {};
  const note = items
    .map((i) => i.note)
    .filter(Boolean)
    .join(', ')
    .slice(0, 120);
  for (const p of parts) {
    if (p.to === 'goal') {
      const { error } = await supabase.rpc('put_in_goal', { p_goal: p.goalId, p_amount: p.amount, p_source: 'extra', p_from: from, p_note: note || null });
      if (error) return error.message;
      job.goals = { ...job.goals, [p.goalId]: (job.goals?.[p.goalId] ?? 0) + p.amount };
    } else if (p.to === 'safety') {
      const { error } = await supabase.rpc('put_in_safety', { p_amount: p.amount, p_kind: 'extra' });
      if (error) return error.message;
      job.safety = (job.safety ?? 0) + p.amount;
    } else if (p.to === 'spend') job.spend = (job.spend ?? 0) + p.amount;
    else job.cats = { ...job.cats, [p.category]: (job.cats?.[p.category] ?? 0) + p.amount };
  }
  // The whole job sits on the first entry; the others are marked as handled.
  const [first, ...rest] = items;
  const { error } = await supabase.from('transactions').update({ job }).eq('id', first.id);
  if (error) return error.message;
  if (rest.length)
    await supabase
      .from('transactions')
      .update({ job: {} })
      .in(
        'id',
        rest.map((r) => r.id),
      );
  return null;
}

/** This month's saving, after anything taken back from the goal to cover a day that ran over. */
export function savingThisCycle(month: MonthBudget, safetySaved: number | null = null, now = new Date()) {
  const goal = Math.max(0, month.goal.amount + month.goalExtra - coverOf(month, now).goal);
  // A full safety net stops taking money: whatever it doesn't need goes to the goal instead.
  if (safetySaved === null || month.goal.isSafetyNet || month.safety.target <= 0) return { goal, safety: month.safety.amount };
  const room = Math.max(0, month.safety.target - safetySaved);
  const safety = Math.min(month.safety.amount, room);
  return { goal: goal + (month.safety.amount - safety), safety };
}

/** This payday's goal saving, goal by goal: the planned split, with any difference (a full safety net adds, a cover
 * takes) settled on the first goal still going, then the next ones. */
export function paydayShares(month: MonthBudget, goals: GoalLite[], amount: number): [string, number][] {
  const split = splitOf(month, goals);
  const out: [string, number][] = goals.map((g) => [g.id, split.get(g.id) ?? 0]);
  let diff = amount - out.reduce((a, [, v]) => a + v, 0);
  if (diff > 0) {
    const i = Math.max(
      0,
      out.findIndex(([, v]) => v > 0),
    );
    out[i][1] += diff;
  }
  for (let i = 0; i < out.length && diff < 0; i++) {
    const cut = Math.min(-diff, out[i][1]);
    out[i][1] -= cut;
    diff += cut;
  }
  return out;
}

/** Is the safety net full? */
export const safetyFull = (month: MonthBudget | null, saved: number) => !!month && !month.goal.isSafetyNet && month.safety.target > 0 && saved >= month.safety.target;

/** Has this pay cycle's saving already been moved? */
export const savingMoved = (month: MonthBudget | null, now = new Date()) => !!month && month.payMoved === periodKey(month.payday, now);

/** Move this cycle's saving (goal + safety net) — once per pay cycle. Returns the month to save, or an error. */
export async function moveSaving(
  month: MonthBudget,
  goals: GoalLite[],
  safetySaved: number | null = null,
  now = new Date(),
): Promise<{ month: MonthBudget; goal: number; safety: number } | { error: string }> {
  if (savingMoved(month, now)) return { month, goal: 0, safety: 0 };
  const s = savingThisCycle(month, safetySaved, now);
  if (goals.length && s.goal > 0 && !month.goal.isSafetyNet) {
    // Each goal gets its share (More goals); anything extra or taken back to cover a day lands on the first goal.
    for (const [id, amount] of paydayShares(month, goals, s.goal)) {
      if (amount <= 0) continue;
      const { error } = await supabase.rpc('put_in_goal', { p_goal: id, p_amount: amount, p_source: 'payday' });
      if (error) return { error: error.message };
    }
  }
  const safety = month.goal.isSafetyNet ? s.goal + s.safety : s.safety;
  if (safety > 0) {
    const { error } = await supabase.rpc('put_in_safety', { p_amount: safety, p_kind: 'payday' });
    if (error) return { error: error.message };
  }
  return { month: { ...month, payMoved: periodKey(month.payday, now) }, goal: month.goal.isSafetyNet ? 0 : s.goal, safety };
}

// ---------- covering a day that ran over ----------

/** Take money from this cycle's goal saving and/or the safety net pot to pay for today. Spending money goes up by the same. */
export async function cover(
  month: MonthBudget,
  goalId: string | null,
  take: { goal: number; safety: number },
  forToday: boolean,
  now = new Date(),
): Promise<{ month: MonthBudget } | { error: string }> {
  const moved = savingMoved(month, now);
  // If payday already moved the saving, the money really comes back out of the pots.
  if (moved && take.goal > 0 && goalId) {
    const { error } = await supabase.rpc('take_from_goal', { p_goal: goalId, p_amount: take.goal, p_note: null });
    if (error) return { error: error.message };
  }
  // The safety net is a real pot: covering from it always takes from what's saved there.
  if (take.safety > 0) {
    const { error } = await supabase.rpc('put_in_safety', { p_amount: -take.safety, p_kind: 'cover' });
    if (error) return { error: error.message };
  }
  const was = coverOf(month, now);
  const pk = periodKey(month.payday, now);
  const day = now.toDateString();
  const prevToday = month.covers?.period === pk && month.covers.today?.day === day ? month.covers.today.amount : 0;
  const today = forToday ? { day, amount: prevToday + take.goal + take.safety } : month.covers?.today;
  return { month: { ...month, covers: { period: pk, goal: was.goal + take.goal, safety: was.safety + take.safety, ...(today ? { today } : {}) } } };
}
