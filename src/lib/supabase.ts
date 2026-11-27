import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { sessionStorage } from '@/lib/secureSession';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
// Publishable key (sb_publishable_…): safe to ship in the app, Row Level Security protects the data.
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export const supabaseConfigured = Boolean(url && publishableKey);

export const supabase = createClient(url || 'http://localhost', publishableKey || 'missing-key', {
  auth: {
    // The session (it can sign in as this person) is kept in the iOS Keychain, not a plain file.
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Keep the session fresh only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
