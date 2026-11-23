// Which nights get an evening check-in (pure, so the logic tests can run it).

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The nights ahead that get a nudge, at `time` (HH:MM): from tonight, unless today already has a log or the time has passed. */
export function nightsAhead(now: Date, time: string, logged: string | null, days = 14): Date[] {
  const [h, m] = time.split(':').map(Number);
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, Number.isFinite(h) ? h : 21, Number.isFinite(m) ? m : 0);
    if (d <= now || (i === 0 && logged === ymd(now))) continue;
    out.push(d);
  }
  return out;
}
