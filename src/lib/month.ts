// Loads and saves "Your month" for the signed-in person.
// Setup saves a starting month; anyone without one gets it rebuilt from their profile and first goal.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { safetyNet } from '@/lib/brain';
import { monthFrom, type MonthBudget } from '@/lib/budget';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { EMPTY_DRAFT, type BudgetStyle, type GoalKind, type SetupDraft } from '@/lib/setup/draft';
import { inputsFrom } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';

async function buildFromProfile(userId: string): Promise<MonthBudget | null> {
  const [{ data: p }, { data: g }] = await Promise.all([
    supabase.from('profiles').select('income_type, monthly_income, slow_month_income, good_month_income, payday, rent, budget_style').eq('id', userId).single(),
    supabase.from('goals').select('title, kind, target_amount, saved_amount, due_date, monthly_amount').eq('user_id', userId).eq('position', 1).eq('status', 'active').maybeSingle(),
  ]);
  if (!p) return null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const draft: SetupDraft = {
    ...EMPTY_DRAFT,
    incomeType: p.income_type,
    monthlyIncome: num(p.monthly_income),
    slowMonth: num(p.slow_month_income),
    goodMonth: num(p.good_month_income),
    payday: p.payday,
    rent: num(p.rent),
    budgetStyle: (p.budget_style ?? 'kip') as BudgetStyle,
    goalTitle: g?.title ?? 'Savings',
    goalKind: (g?.kind ?? 'safety_net') as GoalKind,
    goalTarget: num(g?.target_amount),
    goalSaved: num(g?.saved_amount),
    goalDue: g?.due_date ?? null,
    goalMonthly: num(g?.monthly_amount),
  };
  const inputs = inputsFrom(draft);
  return monthFrom(inputs, draft.budgetStyle, null, draft.incomeType === 'regular' ? draft.payday : null, safetyNet(inputs).target);
}

// One shared copy for every screen (see home.ts): screens that come into view within a few seconds share one load,
// and a save shows up everywhere at once — so changes made on one screen still appear on the others.
const FRESH_MS = 10_000;
const shared: { userId: string | null; month: MonthBudget | null; at: number; inflight: Promise<MonthBudget | null> | null; saves: number; subs: Set<(m: MonthBudget | null) => void> } = {
  userId: null,
  month: null,
  at: 0,
  inflight: null,
  saves: 0,
  subs: new Set(),
};

/** The plan was written somewhere else (Setup): load it fresh next time. */
export function forgetMonth() {
  shared.at = 0;
  shared.month = null;
  shared.saves++;
}

function loadMonth(userId: string): Promise<MonthBudget | null> {
  if (shared.userId === userId && shared.month && Date.now() - shared.at < FRESH_MS) return Promise.resolve(shared.month);
  if (shared.inflight && shared.userId === userId) return shared.inflight;
  const savesAtStart = shared.saves;
  shared.userId = userId;
  const p = (async () => {
    const { data, error } = await supabase.from('profiles').select('budget').eq('id', userId).single();
    if (error) throw error;
    const saved = data?.budget as MonthBudget | null;
    const next = saved?.v === 2 ? saved : await buildFromProfile(userId);
    // A save made while this was loading wins over the slower load.
    if (shared.saves === savesAtStart && shared.userId === userId) {
      shared.month = next;
      shared.at = Date.now();
      shared.subs.forEach((f) => f(next));
    }
    return shared.month;
  })().finally(() => {
    if (shared.inflight === p) shared.inflight = null;
  });
  shared.inflight = p;
  return p;
}

export function useMonth() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [month, setMonth] = useState<MonthBudget | null>(() => (shared.userId === userId ? shared.month : null));
  const [loading, setLoading] = useState(!(shared.userId === userId && shared.month));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = (m: MonthBudget | null) => {
      setMonth(m);
      setLoading(false);
    };
    shared.subs.add(sub);
    return () => {
      shared.subs.delete(sub);
    };
  }, []);

  // Whenever the screen comes into view (shared, so several screens don't each load it).
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      loadMonth(userId).then(
        (m) => {
          setMonth(m);
          setLoading(false);
        },
        (e) => {
          setError(e?.message ?? String(e));
          setLoading(false);
        },
      );
    }, [userId]),
  );

  /** Update on every screen straight away, then save in the background. */
  const save = useCallback(
    async (next: MonthBudget) => {
      shared.saves++;
      shared.month = next;
      shared.at = Date.now();
      shared.subs.forEach((f) => f(next));
      if (!userId) return;
      const { error: e } = await supabase.from('profiles').update({ budget: next, budget_style: next.style }).eq('id', userId);
      setError(e ? t('Couldn’t save: {msg}', { msg: e.message }) : null);
    },
    [userId],
  );

  return { month, loading, error, save };
}
