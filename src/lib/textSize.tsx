// iPhone's Text Size, turned into three steps HeyKip is designed and tested for (approved direction): Default, Large
// and Larger. Smaller iPhone sizes stay at Default (HeyKip's sizes are already the smallest that read well), and
// anything past Larger — the Accessibility sizes too — stays at Larger, so a screen never falls apart.
// Text grows by its size, not all alike: small text (body, labels, notes) grows the most, section titles a little,
// and the big numbers and headlines (already big) barely move. Line spacing grows with it, so Thai marks keep room.
import { createContext, useContext, type ReactNode } from 'react';
import { Platform, useWindowDimensions } from '@real/react-native';

import { grown, grownStyle, stepFor, type TextStep } from '@/lib/textScale';

export { grown, grownStyle, stepFor, type TextStep };

const Step = createContext<TextStep>(0);

/** The step for the whole app, from iPhone's Text Size (it follows when they change it, even with HeyKip open). */
export function TextSizeProvider({ children }: { children: ReactNode }) {
  const { fontScale } = useWindowDimensions();
  return <Step.Provider value={override() ?? stepFor(fontScale)}>{children}</Step.Provider>;
}

/** For a layout that needs to change at a bigger step (two side by side → one under the other at Larger). */
export const useTextStep = () => useContext(Step);

/** On the web (tests and mockups) the step can be set with localStorage `heykip.textStep` (0, 1 or 2). */
function override(): TextStep | null {
  if (Platform.OS !== 'web') return null;
  try {
    const v = Number(globalThis.localStorage?.getItem('heykip.textStep'));
    return v === 1 || v === 2 ? v : null;
  } catch {
    return null;
  }
}
