// "This sits on a coloured surface" (lime, pastel, a photo): text inside stays dark in both looks.
// Glass sets it when tinted with a brand colour; the app's Text (thaiText.tsx) swaps ink → onAccent inside it.
import { createContext } from 'react';

export const OnAccent = createContext(false);

/** Wrap anything drawn on lime / a pastel so its text stays dark in both looks. */
export function Accent({ on = true, children }: { on?: boolean; children: import('react').ReactNode }) {
  return <OnAccent.Provider value={on}>{children}</OnAccent.Provider>;
}
