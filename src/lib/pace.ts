// Home's pay-month line (approved mockup G2, "Safe zone"): what you've spent so far, day by day, against the plan.
//
// The plan is a straight line from ฿0 on payday to the month's spending money on the next payday. The "safe zone" is
// everything under it: if your line is inside, you're spending slower than planned. The dotted end is where you'd land
// on payday at the pace so far — what's left (or short) then.
//
// Rent & bills are planned money and never count (Home's byDay already leaves them out).

export type Pace = {
  /** Spent so far by the end of each day, from payday (day 0) to today. */
  cum: number[];
  spent: number;
  /** What the plan allows by the end of today. */
  planToday: number;
  /** Spending at or under the plan so far. */
  inside: boolean;
  /** Spent by payday at the pace so far (never less than what's spent already). */
  projected: number;
  /** Left of the month's spending money on payday at this pace; negative = short. ฿10 steps. */
  leftAtPayday: number;
};

export function paceOf(byDay: Record<string, number>, start: Date, total: number, dayIndex: number, budget: number): Pace {
  const days = Math.max(1, total);
  const today = Math.min(Math.max(0, dayIndex), days - 1);
  const cum: number[] = [];
  let run = 0;
  for (let i = 0; i <= today; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    run += byDay[d.toDateString()] ?? 0;
    cum.push(run);
  }
  const elapsed = today + 1;
  const planToday = (budget * elapsed) / days;
  const projected = Math.max(run, (run / elapsed) * days);
  return { cum, spent: run, planToday, inside: run <= planToday, projected, leftAtPayday: Math.round((budget - projected) / 10) * 10 };
}
