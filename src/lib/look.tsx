// Light / Dark / Follow my phone (approved: keep only Dark). The choice is saved on this phone only — nothing is
// sent to Supabase. Switching swaps the palette (theme.ts) and redraws the app, then returns to the same screen.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, Fragment, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { setReturnTo } from '@/lib/i18n';
import { applyScheme, type Scheme } from '@/theme';

export type Look = 'light' | 'dark' | 'system';
const KEY = 'heykip.look';

const LookContext = createContext<{ look: Look; scheme: Scheme; setLook: (l: Look, stayOn?: string) => void }>({ look: 'system', scheme: 'light', setLook: () => {} });
export const useLook = () => useContext(LookContext);

export function LookProvider({ children }: { children: ReactNode }) {
  const phone = useColorScheme();
  const [look, setState] = useState<Look | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .catch(() => null)
      .then((v) => setState(v === 'light' || v === 'dark' || v === 'system' ? v : 'light'));
  }, []);
  const setLook = useCallback((l: Look, stayOn?: string) => {
    setReturnTo(stayOn ?? null);
    AsyncStorage.setItem(KEY, l).catch(() => {});
    setState(l);
  }, []);
  if (!look) return null;
  const scheme: Scheme = look === 'system' ? (phone === 'dark' ? 'dark' : 'light') : look;
  // Swap the colours before anything draws, then redraw everything under a new key.
  applyScheme(scheme);
  return (
    <LookContext.Provider value={{ look, scheme, setLook }}>
      <Fragment key={scheme}>{children}</Fragment>
    </LookContext.Provider>
  );
}
