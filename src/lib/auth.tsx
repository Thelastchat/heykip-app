import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  onboarded: boolean;
  plan: 'free' | 'trial' | 'yearly' | 'monthly' | 'student';
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
      .select('id, display_name, avatar_url, onboarded, plan')
      .eq('id', s.user.id)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
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
