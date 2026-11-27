// Saving over time (approved 27 Nov): what was saved in total — every goal plus the safety net — at the start of each
// of the last pay months, and now. Rebuilt backwards from today's totals and the moves already recorded (goal_moves,
// safety_moves), so it never disagrees with the numbers on screen: total then = total now − what moved in since.
// Money that was already saved before HeyKip recorded any moves shows as where the line starts.
import { period } from '@/lib/home';

export type SavedPoint = { at: Date; total: number; now?: boolean };
export type MoveLite = { amount: number; at: Date };

/** `months` points at the start of each pay month (oldest first), then one for today. Never below ฿0. */
export function savedOverTime(totalNow: number, moves: MoveLite[], payday: number | null, months = 5, now = new Date()): SavedPoint[] {
  const starts: Date[] = [];
  let at = period(payday, now).start;
  for (let i = 0; i < months; i++) {
    starts.unshift(at);
    at = period(payday, new Date(at.getTime() - 86_400_000)).start;
  }
  const since = (d: Date) => moves.filter((m) => m.at >= d).reduce((a, m) => a + m.amount, 0);
  return [...starts.map((d) => ({ at: d, total: Math.max(0, Math.round(totalNow - since(d))) })), { at: now, total: Math.max(0, Math.round(totalNow)), now: true }];
}

/** The first month that shows any saving, so a brand-new account doesn't draw months of ฿0. */
export function trimEmpty(points: SavedPoint[]): SavedPoint[] {
  const first = points.findIndex((p) => p.total > 0);
  return first <= 0 ? points : points.slice(Math.min(first, points.length - 2));
}
