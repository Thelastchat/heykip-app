// Loads and saves "Your month" for the signed-in person.
// Setup saves a starting month; anyone without one gets it rebuilt from their profile and first goal.
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { safetyNet } from '@/lib/brain';
import { monthFrom, type MonthBudget } from '@/lib/budget';
import { useAuth } from '@/lib/auth';
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

export function useMonth() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [month, setMonth] = useState<MonthBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load whenever the screen comes into view, so a change made on another screen (Profile, Your month)
  // shows up everywhere. A save made here is never overwritten by a slower load.
  const saving = useRef(0);
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      const at = saving.current;
      (async () => {
        const { data, error: e } = await supabase.from('profiles').select('budget').eq('id', userId).single();
        if (e) setError(e.message);
        const saved = data?.budget as MonthBudget | null;
        const next = saved?.v === 2 ? saved : await buildFromProfile(userId);
        if (saving.current === at) setMonth(next);
        setLoading(false);
      })();
    }, [userId]),
  );

  /** Update on screen straight away, then save in the background. */
  const save = useCallback(
    async (next: MonthBudget) => {
      saving.current++;
      setMonth(next);
      if (!userId) return;
      const { error: e } = await supabase.from('profiles').update({ budget: next, budget_style: next.style }).eq('id', userId);
      setError(e ? `Couldn’t save: ${e.message}` : null);
    },
    [userId],
  );

  return { month, loading, error, save };
}
