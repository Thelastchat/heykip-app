// Everything Home needs for the signed-in person: their pinned goal + promise, this month's spending,
// and the numbers Kip talks about. Spending comes from logged transactions (none yet = a fresh month).
import { useCallback, useEffect, useState } from 'react';

import type { CatKey } from '@/lib/budget';
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
  promise: string | null;
  signature: string | null; // signed link
  signedAt: string | null;
};

export type Spent = { total: number; today: number; byCat: Partial<Record<CatKey | 'home_bills' | 'travel' | 'family_pets' | 'installments', number>>; byDay: Record<string, number> };

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

async function signed(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const [bucket, ...rest] = path.split('/');
  const { data } = await supabase.storage.from(bucket).createSignedUrl(rest.join('/'), 60 * 60);
  return data?.signedUrl ?? null;
}

export function useHome(payday: number | null) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [goals, setGoals] = useState<HomeGoal[]>([]);
  const [spent, setSpent] = useState<Spent>({ total: 0, today: 0, byCat: {}, byDay: {} });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const p = period(payday);
    const [{ data: g }, { data: pr }, { data: tx }] = await Promise.all([
      supabase
        .from('goals')
        .select('id, title, kind, goal_type, target_amount, saved_amount, monthly_amount, due_date, photo_url, position')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('position'),
      supabase.from('promises').select('goal_id, text, signature_url, signed_at').eq('user_id', userId).order('signed_at', { ascending: false }),
      supabase.from('transactions').select('amount, kind, occurred_at, categories(key)').eq('user_id', userId).eq('kind', 'spend').gte('occurred_at', p.start.toISOString()),
    ]);
    const list = await Promise.all(
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
          promise: promise?.text ?? null,
          signature: await signed(promise?.signature_url),
          signedAt: promise?.signed_at ?? null,
        } satisfies HomeGoal;
      }),
    );
    setGoals(list);
    const todayKey = new Date().toDateString();
    const s: Spent = { total: 0, today: 0, byCat: {}, byDay: {} };
    for (const t of tx ?? []) {
      const amt = Number(t.amount);
      const key = ((t.categories as unknown as { key: string } | null)?.key ?? 'other') as keyof Spent['byCat'];
      s.total += amt;
      s.byCat[key] = (s.byCat[key] ?? 0) + amt;
      const d = new Date(t.occurred_at).toDateString();
      s.byDay[d] = (s.byDay[d] ?? 0) + amt;
      if (d === todayKey) s.today += amt;
    }
    setSpent(s);
    setLoading(false);
  }, [userId, payday]);

  useEffect(() => {
    load();
  }, [load]);

  return { goals, spent, loading, reload: load };
}
