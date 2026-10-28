// Loads and saves "Your month" for the signed-in person.
// Setup saves a starting month; people who finished Setup before that get one built from their profile and first goal.
import { useCallback, useEffect, useState } from 'react';

import { startingMonth, type MonthBudget } from '@/lib/budget';
import { useAuth } from '@/lib/auth';
import { EMPTY_DRAFT, type BudgetStyle, type GoalKind } from '@/lib/setup/draft';
import { makePlan } from '@/lib/setup/plan';
import { supabase } from '@/lib/supabase';

async function buildFromProfile(userId: string): Promise<MonthBudget | null> {
  const [{ data: p }, { data: g }] = await Promise.all([
    supabase
      .from('profiles')
      .select('income_type, monthly_income, slow_month_income, good_month_income, payday, rent, budget_style')
      .eq('id', userId)
      .single(),
    supabase.from('goals').select('title, kind, target_amount, saved_amount, due_date').eq('user_id', userId).eq('position', 1).eq('status', 'active').maybeSingle(),
  ]);
  if (!p) return null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const draft = {
    ...EMPTY_DRAFT,
    incomeType: p.income_type,
    monthlyIncome: num(p.monthly_income),
    slowMonth: num(p.slow_month_income),
    goodMonth: num(p.good_month_income),
    payday: p.payday,
    rent: num(p.rent),
    budgetStyle: (p.budget_style ?? 'kip') as BudgetStyle,
    goalTitle: g?.title ?? '',
    goalKind: (g?.kind ?? 'trip') as GoalKind,
    goalTarget: num(g?.target_amount) ?? 0,
    goalSaved: num(g?.saved_amount) ?? 0,
    goalDue: g?.due_date ?? null,
    noGoal: !g?.due_date,
  };
  const plan = makePlan(draft);
  return startingMonth(draft.budgetStyle, plan, draft.goalTitle, draft.goalKind === 'safety_net', draft.incomeType === 'regular' ? draft.payday : null);
}

export function useMonth() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [month, setMonth] = useState<MonthBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error: e } = await supabase.from('profiles').select('budget').eq('id', userId).single();
      if (e) setError(e.message);
      setMonth((data?.budget as MonthBudget | null) ?? (await buildFromProfile(userId)));
      setLoading(false);
    })();
  }, [userId]);

  /** Update on screen straight away, then save in the background. */
  const save = useCallback(
    async (next: MonthBudget) => {
      setMonth(next);
      if (!userId) return;
      const { error: e } = await supabase.from('profiles').update({ budget: next, budget_style: next.style }).eq('id', userId);
      setError(e ? `Couldn’t save: ${e.message}` : null);
    },
    [userId],
  );

  return { month, loading, error, save };
}
