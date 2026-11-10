import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  onboarded: boolean;
  plan: Plan;
  split_when_paid: boolean; // Plus: Kip moves the saving on payday
  safety_saved: number; // what's in the safety net pot
  ai_consent_at: string | null; // when they tapped Allow on "Before Kip reads for you"
  ai_off: boolean; // Privacy & data → Kip's AI turned off
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    // The profiles row is created by a database trigger on sign-up (see the migration).
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, onboarded, plan, trial_ends_at, split_when_paid, ai_consent_at, ai_off, safety_saved')
      .eq('id', s.user.id)
      .maybeSingle();
    setProfile(data ? ({ ...data, plan: planNow(data.plan, data.trial_ends_at) } as Profile) : null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      let s = data.session;
      // A session saved on the phone can belong to an account that was deleted: check it with the server.
      if (s) {
        const { error } = await supabase.auth.getUser();
        if (error && error.status && error.status >= 400 && error.status < 500) {
          await supabase.auth.signOut({ scope: 'local' });
          s = null;
        }
      }
      setSession(s);
      await loadProfile(s);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      loadProfile(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value: AuthState = {
    session,
    profile,
    loading,
    refreshProfile: () => loadProfile(session),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export type Plan = 'free' | 'trial' | 'yearly' | 'monthly' | 'student';

/** The plan as it is right now: a trial whose week is over is Free (the server's is_plus() decides the same way). */
export function planNow(plan: Plan | null | undefined, trialEndsAt: string | null | undefined): Plan {
  if (plan === 'trial') return trialEndsAt && new Date(trialEndsAt).getTime() > Date.now() ? 'trial' : 'free';
  return plan ?? 'free';
}
