// The maths of HeyKip's text steps (pure, so the logic tests can run it). How they're used: textSize.tsx.
import type { TextStyle } from 'react-native';

export type TextStep = 0 | 1 | 2;

/** iOS Text Size → step. Default (Large) is 1.0; xLarge ≈ 1.12 and xxLarge ≈ 1.24 are Large; xxxLarge ≈ 1.35 and up is Larger. */
export function stepFor(fontScale: number): TextStep {
  if (fontScale < 1.1) return 0;
  if (fontScale < 1.3) return 1;
  return 2;
}

/** How much more room each step gives the smallest text (13pt and under): +15% at Large, +30% at Larger. */
const GROW = [0, 0.15, 0.3] as const;
/** From 13pt the growth fades out, and at 40pt and up text keeps its size. */
const FULL = 13;
const NONE = 40;

/** The size a design size shows at, on this step. */
export function grown(size: number, step: TextStep): number {
  if (!step) return size;
  const w = Math.min(1, Math.max(0, (NONE - size) / (NONE - FULL)));
  return Math.round(size * (1 + GROW[step] * w) * 2) / 2;
}

/** A text style at this step: the size grows, and the line height with it. */
export function grownStyle(flat: TextStyle | undefined, step: TextStep, inherits: boolean): TextStyle | null {
  if (!step) return null;
  const size = flat?.fontSize;
  // A nested Text with no size of its own takes the (already grown) size of the Text around it.
  if (size === undefined && inherits) return null;
  const base = size ?? 14;
  const to = grown(base, step);
  return { fontSize: to, ...(flat?.lineHeight !== undefined ? { lineHeight: Math.ceil(flat.lineHeight * (to / base)) } : null) };
}
