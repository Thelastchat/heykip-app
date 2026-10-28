import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Living } from '@/lib/brain';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

// Everything the person tells Kip during Setup. It lives on the phone until they
// create their account (after signing the promise), then it is saved in one go.

export type IncomeType = 'regular' | 'changes';
export type MoneyStyle = 'treat' | 'bills' | 'save' | 'disappears';
export type Leak = 'delivery' | 'grab' | 'shopping' | 'coffee' | 'goingOut' | 'beauty';
/** safety_net is shown as "Emergency fund"; monthly = "Save every month" (no target or date). */
export type GoalKind = 'trip' | 'gadget' | 'car' | 'home' | 'safety_net' | 'monthly';
/** How Kip splits what's left after the goal, the safety net and bills. */
export type BudgetStyle = 'kip' | '503020' | 'jars' | 'savefirst';

export type SetupDraft = {
  incomeType: IncomeType;
  monthlyIncome: number | null;
  slowMonth: number | null;
  goodMonth: number | null;
  payday: number | null; // day of the month, 1–31
  monthStartsOnPayday: boolean;
  splitWhenPaid: boolean;
  rent: number | null;
  bills: number | null; // other fixed bills; null = Kip's guess

  moneyStyle: MoneyStyle | null;
  leaks: Leak[];

  goalTitle: string;
  goalKind: GoalKind;
  goalTarget: number | null;
  goalSaved: number | null;
  goalDue: string | null; // yyyy-mm-dd
  goalPhoto: string | null; // local file uri until saved
  goalMonthly: number | null; // "Save every month": how much
  budgetStyle: BudgetStyle;
  goalPerMonth: number | null; // set on "Make it yours"; null = Kip's pick
  living: Partial<Living>; // the person's own living costs, when they change Kip's

  promiseMain: string | null; // null = Kip's wording
  promiseBackup: string | null;
  signature: string | null; // PNG, base64
  signedAt: string | null; // ISO time
};

export const EMPTY_DRAFT: SetupDraft = {
  incomeType: 'regular',
  monthlyIncome: null,
  slowMonth: null,
  goodMonth: null,
  payday: null,
  monthStartsOnPayday: true,
  splitWhenPaid: true,
  rent: null,
  bills: null,
  moneyStyle: null,
  leaks: [],
  goalTitle: '',
  goalKind: 'trip',
  goalTarget: null,
  goalSaved: null,
  goalDue: null,
  goalPhoto: null,
  goalMonthly: null,
  budgetStyle: 'kip',
  goalPerMonth: null,
  living: {},
  promiseMain: null,
  promiseBackup: null,
  signature: null,
  signedAt: null,
};

const KEY = 'heykip.setup.v2';

type SetupState = {
  draft: SetupDraft;
  ready: boolean;
  update: (patch: Partial<SetupDraft>) => void;
  reset: () => void;
};

const SetupContext = createContext<SetupState | null>(null);

export function SetupProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SetupDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  // Restore an unfinished Setup (for example after checking email for the sign-in code).
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setDraft({ ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<SetupDraft>) });
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY, JSON.stringify(draft)).catch(() => {});
  }, [draft]);

  const update = useCallback((patch: Partial<SetupDraft>) => setDraft((d) => ({ ...d, ...patch })), []);
  const reset = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  const value = useMemo(() => ({ draft, ready, update, reset }), [draft, ready, update, reset]);
  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup() {
  const ctx = useContext(SetupContext);
  if (!ctx) throw new Error('useSetup must be used inside <SetupProvider>');
  return ctx;
}

/** Monthly income Kip plans around: the salary, or a slow month for changing income. */
export function plannedIncome(d: SetupDraft): number {
  return (d.incomeType === 'regular' ? d.monthlyIncome : d.slowMonth) ?? 0;
}

export const basicsDone = (d: SetupDraft) =>
  d.incomeType === 'regular' ? Boolean(d.monthlyIncome && d.payday) : Boolean(d.slowMonth);

export const goalDone = (d: SetupDraft) =>
  d.goalKind === 'monthly'
    ? Boolean(d.goalTitle.trim() && d.goalMonthly)
    : Boolean(d.goalTitle.trim() && d.goalTarget && (d.goalDue || d.goalKind === 'safety_net') && (d.goalSaved ?? 0) < (d.goalTarget ?? 0));
