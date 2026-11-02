// Everything Home needs for the signed-in person: their pinned goal + promise, this month's spending,
// and the numbers Kip talks about. Spending comes from logged transactions (none yet = a fresh month).
import { useCallback, useEffect, useMemo, useState } from 'react';

import { spendingTotal, type CatKey, type MonthBudget } from '@/lib/budget';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type HomeGoal = {
  id: string;
  title: string;
  kind: string;
  goalType: string | null;
  target: number;
  saved: number;
  monthly: number | null;
  due: string | null;
  photo: string | null; // signed link
  photoKey: string | null; // storage path — the photo's cache key on the phone (signed links change)
  promise: string | null;
  signature: string | null; // signed link
  signatureKey: string | null;
  signedAt: string | null;
  createdAt: string;
};

/** What was spent this month, counted against the plan. `bills` = logged under Home & bills — already planned, so not taken from spending again. */
export type Spent = {
  total: number;
  today: number;
  bills: number;
  byCat: Partial<Record<CatKey, number>>;
  byDay: Record<string, number>;
  /** Extra money in this pay cycle that was kept for spending — in general, and for one category. */
  extraSpend?: number;
  extraCats?: Partial<Record<CatKey, number>>;
  /** Pay logged this cycle (the usual pay the plan runs on). */
  payIn?: number;
};

export type CatSpend = { id: string; amount: number; at: string; note: string | null; cat: string };

/** Taken back from this cycle's goal saving / the safety net to cover going over (see moneyin.ts). */
export function coverOf(month: MonthBudget | null, now = new Date()) {
  const pk = month ? periodKey(month.payday, now) : '';
  return month?.covers?.period === pk ? { goal: month.covers.goal, safety: month.covers.safety } : { goal: 0, safety: 0 };
}

/** Extra money that came in and was kept for spending, plus anything taken back to cover going over. */
export function addedThisCycle(month: MonthBudget | null, spent: Spent, now = new Date()) {
  const cats = Object.values(spent.extraCats ?? {}).reduce((a: number, n) => a + (n ?? 0), 0);
  const c = coverOf(month, now);
  // A cover made today pays for today itself, not for the days ahead.
  const t = month?.covers?.today;
  const today = t && t.day === now.toDateString() && month?.covers?.period === periodKey(month.payday, now) ? t.amount : 0;
  return { extra: (spent.extraSpend ?? 0) + cats, cover: c.goal + c.safety, coverToday: today };
}

/** Which budget a logged category counts against. Categories without their own budget (travel, pets…) count as Household & other. */
export function budgetKey(dbKey: string, month: MonthBudget | null): CatKey | 'bills' {
  if (dbKey === 'home_bills') return 'bills';
  if (month?.style === 'savefirst') return 'spend_freely';
  if (month?.spend.some((s) => s.key === dbKey)) return dbKey as CatKey;
  return 'other';
}

/** The month in numbers — the same on Home and in "Add it yourself". */
export function monthNumbers(month: MonthBudget | null, spent: Spent, now = new Date()) {
  const P = period(month?.payday ?? null, now);
  const added = addedThisCycle(month, spent, now);
  const spendBudget = month ? spendingTotal(month) + added.extra + added.cover : 0;
  const leftMonth = Math.max(0, spendBudget - spent.total);
  // Today's share of what was left when today started (today's spending counted back in).
  const leftAtStart = Math.max(0, spendBudget - (spent.total - spent.today));
  const dailyToday = Math.max(0, Math.round(Math.max(0, leftAtStart - added.coverToday) / P.daysLeft / 10) * 10) + added.coverToday;
  const leftToday = Math.max(0, dailyToday - spent.today);
  const pace = Math.round(spent.total - spendBudget * (P.dayIndex / P.total));
  // Going over: past today's money, and past the whole month's spending money.
  const overToday = Math.max(0, spent.today - dailyToday);
  const overMonth = Math.max(0, spent.total - spendBudget);
  // What each day after today gets now (the days ahead carry today's extra).
  const daysAfter = P.daysLeft - 1;
  const dailyAfter = daysAfter > 0 ? Math.max(0, Math.round(leftMonth / daysAfter / 10) * 10) : 0;
  return { P, spendBudget, leftMonth, dailyToday, leftToday, pace, overToday, overMonth, leftAtStart, daysAfter, dailyAfter, extraIn: added.extra };
}

/**
 * The month's spending money ran out: the extra comes out of this month's goal saving first, then the safety net —
 * never rent or bills. Returns how much each gives, and how many months later the goal arrives.
 */
export function overCover(over: number, goalPerMonth: number, safetyPerMonth: number, goalLeft: number) {
  const fromGoal = Math.min(over, Math.max(0, goalPerMonth));
  const fromSafety = Math.min(over - fromGoal, Math.max(0, safetyPerMonth));
  const later = goalPerMonth > 0 && goalLeft > 0 ? Math.ceil((goalLeft + fromGoal) / goalPerMonth) - Math.ceil(goalLeft / goalPerMonth) : 0;
  return { fromGoal, fromSafety, uncovered: over - fromGoal - fromSafety, later };
}

/** The pay period `offset` months from the current one (0 = now, -1 = the one before). */
export function periodAt(payday: number | null, offset: number, now = new Date()) {
  const cur = period(payday, now);
  const day = payday ?? 1;
  const y = cur.start.getFullYear();
  const m = cur.start.getMonth() + offset;
  const start = new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  return period(payday, start);
}

/** Which month a pay period is called by: the month most of its days fall in. */
export function periodMonth(p: { start: Date; total: number }) {
  return new Date(p.start.getFullYear(), p.start.getMonth(), p.start.getDate() + Math.floor(p.total / 2));
}

/** The month runs payday → payday (or 1st → 1st when pay changes). */
export function period(payday: number | null, now = new Date()) {
  const day = payday ?? 1;
  const clamp = (y: number, m: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  let start = clamp(now.getFullYear(), now.getMonth());
  if (start > now) start = clamp(now.getFullYear(), now.getMonth() - 1);
  const end = clamp(start.getFullYear(), start.getMonth() + 1);
  const dayMs = 86_400_000;
  const total = Math.round((end.getTime() - start.getTime()) / dayMs);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.max(1, Math.round((end.getTime() - today.getTime()) / dayMs));
  return { start, end, total, daysLeft, dayIndex: total - daysLeft };
}

// ---------- saving Supabase: one shared copy, signed links reused ----------
//
// Nine screens show Home's numbers. Each used to load goals, promises and spending on its own (often twice), and
// signed the goal photo again every time — a new link each time, so the photo downloaded again too. Now:
// · one shared copy: screens that open within a few seconds of each other share one load (and one in flight);
// · signed links are kept for 50 minutes, and photos are cached on the phone by their storage path (`photoKey`),
//   so a goal photo downloads once per phone, not on every visit.

const signedCache = new Map<string, { url: string; until: number }>();

async function signed(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const hit = signedCache.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const [bucket, ...rest] = path.split('/');
  const { data } = await supabase.storage.from(bucket).createSignedUrl(rest.join('/'), 60 * 60);
  if (data?.signedUrl) signedCache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60_000 });
  return data?.signedUrl ?? null;
}

type TxRow = { id: string; amount: number; kind: string; occurred_at: string; job: unknown; cat: string; note: string | null };
type Raw = { key: string; at: number; goals: HomeGoal[]; tx: TxRow[] };

const FRESH_MS = 10_000;
const store: { raw: Raw | null; inflight: { key: string; p: Promise<Raw> } | null; subs: Set<(r: Raw) => void> } = { raw: null, inflight: null, subs: new Set() };

async function fetchRaw(key: string, userId: string, payday: number | null): Promise<Raw> {
  const p = period(payday);
  // One spending query covers both this pay cycle and the 60 days the streak needs.
  const since = new Date(Math.min(p.start.getTime(), Date.now() - 60 * 86_400_000)).toISOString();
  const [{ data: g }, { data: pr }, { data: tx }] = await Promise.all([
    supabase
      .from('goals')
      .select('id, title, kind, goal_type, target_amount, saved_amount, monthly_amount, due_date, photo_url, position, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('position'),
    supabase.from('promises').select('goal_id, text, signature_url, signed_at').eq('user_id', userId).order('signed_at', { ascending: false }),
    supabase.from('transactions').select('id, amount, kind, occurred_at, job, note, categories(key)').eq('user_id', userId).gte('occurred_at', since),
  ]);
  const goals = await Promise.all(
    (g ?? []).map(async (x) => {
      const promise = (pr ?? []).find((y) => y.goal_id === x.id);
      return {
        id: x.id,
        title: x.title,
        kind: x.kind,
        goalType: x.goal_type ?? null,
        target: Number(x.target_amount ?? 0),
        saved: Number(x.saved_amount ?? 0),
        monthly: x.monthly_amount === null ? null : Number(x.monthly_amount),
        due: x.due_date,
        photo: await signed(x.photo_url),
        photoKey: x.photo_url ?? null,
        promise: promise?.text ?? null,
        signature: await signed(promise?.signature_url),
        signatureKey: promise?.signature_url ?? null,
        signedAt: promise?.signed_at ?? null,
        createdAt: x.created_at,
      } satisfies HomeGoal;
    }),
  );
  const rows = (tx ?? []).map((t) => ({
    id: t.id as string,
    note: (t.note as string | null) ?? null,
    amount: Number(t.amount),
    kind: t.kind as string,
    occurred_at: t.occurred_at as string,
    job: t.job,
    cat: (t.categories as unknown as { key: string } | null)?.key ?? 'other',
  }));
  return { key, at: Date.now(), goals, tx: rows };
}

/** Load (or reuse) the shared copy. `force` = something just changed. */
function loadShared(userId: string, payday: number | null, force: boolean): Promise<Raw> {
  const key = `${userId}:${payday ?? 'cal'}`;
  if (!force && store.raw?.key === key && Date.now() - store.raw.at < FRESH_MS) return Promise.resolve(store.raw);
  if (store.inflight?.key === key) return store.inflight.p;
  const p = fetchRaw(key, userId, payday)
    .then((r) => {
      store.raw = r;
      store.subs.forEach((f) => f(r));
      return r;
    })
    .finally(() => {
      if (store.inflight?.p === p) store.inflight = null;
    });
  store.inflight = { key, p };
  return p;
}

/** Everything spent and received this pay cycle, worked out from the shared copy. */
function spentFrom(raw: Raw | null, month: MonthBudget | null, payday: number | null): Spent {
  const s: Spent = { total: 0, today: 0, bills: 0, byCat: {}, byDay: {}, extraSpend: 0, extraCats: {}, payIn: 0 };
  if (!raw) return s;
  const start = period(payday).start.getTime();
  const todayKey = new Date().toDateString();
  for (const t of raw.tx) {
    if (new Date(t.occurred_at).getTime() < start) continue;
    if (t.kind === 'income') {
      // Money in changes spending only through the part someone kept for spending.
      const job = (t.job ?? null) as { spend?: number; cats?: Partial<Record<CatKey, number>> } | null;
      if (t.cat === 'pay') s.payIn = (s.payIn ?? 0) + t.amount;
      s.extraSpend = (s.extraSpend ?? 0) + Number(job?.spend ?? 0);
      for (const [k, v] of Object.entries(job?.cats ?? {})) s.extraCats![k as CatKey] = (s.extraCats![k as CatKey] ?? 0) + Number(v ?? 0);
      continue;
    }
    if (t.kind !== 'spend') continue;
    const key = budgetKey(t.cat, month);
    if (key === 'bills') {
      s.bills += t.amount;
      continue;
    }
    s.total += t.amount;
    s.byCat[key] = (s.byCat[key] ?? 0) + t.amount;
    const d = new Date(t.occurred_at).toDateString();
    s.byDay[d] = (s.byDay[d] ?? 0) + t.amount;
    if (d === todayKey) s.today += t.amount;
  }
  return s;
}

export function useHome(month: MonthBudget | null) {
  const payday = month?.payday ?? null;
  const { session } = useAuth();
  const userId = session?.user.id;
  const key = userId ? `${userId}:${payday ?? 'cal'}` : '';
  const [raw, setRaw] = useState<Raw | null>(() => (store.raw?.key === key ? store.raw : null));

  useEffect(() => {
    if (!userId) return;
    const sub = (r: Raw) => r.key === key && setRaw(r);
    store.subs.add(sub);
    loadShared(userId, payday, false).then(sub, () => {});
    return () => {
      store.subs.delete(sub);
    };
  }, [userId, payday, key]);

  /** Something changed (saved, deleted, moved): load fresh — every screen showing it updates. */
  const reload = useCallback(async () => {
    if (userId) await loadShared(userId, payday, true).catch(() => null);
  }, [userId, payday]);

  // Only what the numbers depend on — not the month object itself, which is new on every load.
  const monthShape = month ? `${month.style}|${month.spend.map((x) => x.key).join(',')}` : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const spent = useMemo(() => spentFrom(raw, month, payday), [raw, monthShape, payday]);
  const streak = useMemo(() => streakOf((raw?.tx ?? []).map((t) => t.occurred_at)), [raw]);

  /** This pay cycle's spends that count against one Left-to-spend category, newest first (no extra request). */
  const spendsIn = useCallback(
    (key: CatKey): CatSpend[] => {
      const start = period(payday).start.getTime();
      return (raw?.tx ?? [])
        .filter((x) => x.kind === 'spend' && new Date(x.occurred_at).getTime() >= start && budgetKey(x.cat, month) === key)
        .map((x) => ({ id: x.id, amount: x.amount, at: x.occurred_at, note: x.note, cat: x.cat }))
        .sort((a, b) => b.at.localeCompare(a.at));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw, monthShape, payday],
  );

  return { goals: raw?.goals ?? [], spent, streak, loading: raw === null, reload, spendsIn };
}

/** Consecutive days with at least one log, ending today (or yesterday, so the streak doesn't break before you log today). */
export function streakOf(dates: string[], now = new Date()): number {
  const days = new Set(dates.map((d) => new Date(d).toDateString()));
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(day.toDateString())) day.setDate(day.getDate() - 1);
  let n = 0;
  while (days.has(day.toDateString())) {
    n++;
    day.setDate(day.getDate() - 1);
  }
  return n;
}

/** A stable key for the current pay period, used to reset "paid" bills each month. */
export const periodKey = (payday: number | null, now = new Date()) => period(payday, now).start.toDateString();
