// Thai text in IBM Plex Sans Thai. Geist has no Thai letters, so any Text (or TextInput) whose words contain Thai
// gets the Plex Thai weight that matches its Geist weight. English stays in Geist. Caveat (handwriting) has no Thai
// either, so Thai handwriting gets Sriracha, a marker-pen font, a little smaller to match Caveat's size. The
// signature font is left alone. The app's `react-native` imports point here through metro.config.js, so every
// screen gets this without changing its imports.
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextStyle } from '@real/react-native';

import { OnAccent } from '@/lib/accent';
import { colors, fonts } from '@/theme';

const THAI = /[\u0E00-\u0E7F]/;

const TO_THAI: Record<string, string> = {
  [fonts.regular]: fonts.thai,
  [fonts.medium]: fonts.thaiMedium,
  [fonts.semibold]: fonts.thaiSemibold,
  [fonts.bold]: fonts.thaiBold,
  [fonts.hand]: fonts.handThai,
};

/** Sriracha draws bigger than Caveat at the same size; this brings it back in line. */
const HAND_SCALE = 0.85;
function handSize(flat: TextStyle | undefined): TextStyle | null {
  if (flat?.fontFamily !== fonts.hand) return null;
  const size = Math.round((flat.fontSize ?? 14) * HAND_SCALE);
  return { fontSize: size, ...(flat.lineHeight !== undefined ? { lineHeight: Math.max(Math.round(flat.lineHeight * HAND_SCALE), Math.ceil(size * 1.5)) } : null) };
}

/** The font a nested Text inherits from the Text around it. */
const Inherited = createContext<{ family?: string; size?: number }>({});

function hasThai(node: ReactNode): boolean {
  if (typeof node === 'string') return THAI.test(node);
  if (Array.isArray(node)) return node.some(hasThai);
  return false;
}

/** The Thai version of a Geist font; anything else (handwriting, already Thai) stays as it is. */
const thaiFor = (family: string | undefined) => (family ? (TO_THAI[family] ?? family) : fonts.thai);

/**
 * Thai headlines (asked, approved samples): a title of 26–29pt set in Regular or Medium shows in SemiBold so it
 * stands out; the big page titles (30pt and up — สวัสดี, เป้าหมายของคุณ) show in Medium, a little tighter (sample B).
 * Smaller text and handwriting keep their weight.
 */
const HEADLINE = 26;
const PAGE_TITLE = 30;
const thaiHeadline = (shown: string | undefined, flat: TextStyle | undefined) => {
  const size = flat?.fontSize ?? 14;
  if (size < HEADLINE || (shown !== fonts.thai && shown !== fonts.thaiMedium)) return shown;
  return size >= PAGE_TITLE ? fonts.thaiMedium : fonts.thaiSemibold;
};
/** Page titles: about −0.4 at 30pt, −0.5 at 34pt — tight enough to feel like a title, not so tight marks touch. */
const titleTracking = (size: number) => -Math.round(size * 0.014 * 10) / 10;

/**
 * Thai needs more height than English: tone marks (เป้า) sit above the letters and vowels hang below, so a line set
 * tight for English cuts them off on iOS. Thai lines get at least 1.5× their size, and no squeezed letter spacing.
 */
function thaiRoom(flat: TextStyle | undefined): TextStyle | null {
  const size = flat?.fontSize ?? 14;
  const lh = flat?.lineHeight;
  const tight = lh !== undefined && lh < size * 1.5;
  const squeezed = (flat?.letterSpacing ?? 0) < 0;
  if (!tight && !squeezed) return null;
  return { ...(tight ? { lineHeight: Math.ceil(size * 1.5) } : null), ...(squeezed ? { letterSpacing: 0 } : null) };
}

/** How far iPhone's Text Size (Settings → Display & Brightness, or Accessibility → Larger Text) may grow HeyKip's
 * text: a little, so it still helps, but never so much that cards, numbers and buttons break apart. */
export const MAX_TEXT_SCALE = 1.2;

// React 19: `ref` arrives as an ordinary prop and is passed straight through.
export function Text(props: ComponentProps<typeof RNText>) {
  const parent = useContext(Inherited);
  const accent = useContext(OnAccent);
  const flat = StyleSheet.flatten(props.style) as TextStyle | undefined;
  const own = flat?.fontFamily;
  const family = own ?? parent.family;
  // A nested Text takes its size from the one around it (so the grey second line of a headline is a headline too).
  const size = flat?.fontSize ?? parent.size;
  const thai = hasThai(props.children);
  const shown = thai ? thaiHeadline(thaiFor(family), { ...flat, fontSize: size }) : family;
  // On lime / pastel / photo surfaces the text stays dark, in Light and in Dark.
  const c = flat?.color;
  const accentColor = accent && (c === undefined || c === colors.ink || c === colors.muted) ? (c === colors.muted ? colors.onAccentMuted : colors.onAccent) : undefined;
  const hand = thai ? handSize(flat) : null;
  const title = thai && !hand && (size ?? 0) >= PAGE_TITLE && shown === fonts.thaiMedium;
  const room = thai ? (hand ?? (title ? { ...thaiRoom(flat), letterSpacing: titleTracking(size!) } : thaiRoom(flat))) : null;
  const style = (thai && shown !== own) || accentColor || room ? [props.style, thai && shown !== own ? { fontFamily: shown } : null, room, accentColor ? { color: accentColor } : null] : props.style;
  return (
    <Inherited.Provider value={{ family, size }}>
      <RNText maxFontSizeMultiplier={MAX_TEXT_SCALE} {...props} style={style} />
    </Inherited.Provider>
  );
}

export function TextInput(props: ComponentProps<typeof RNTextInput>) {
  const thai = THAI.test(props.value ?? props.defaultValue ?? '') || (!props.value && THAI.test(props.placeholder ?? ''));
  if (!thai) return <RNTextInput maxFontSizeMultiplier={MAX_TEXT_SCALE} {...props} />;
  const own = (StyleSheet.flatten(props.style) as TextStyle | undefined)?.fontFamily;
  const flat = StyleSheet.flatten(props.style) as TextStyle | undefined;
  return <RNTextInput maxFontSizeMultiplier={MAX_TEXT_SCALE} {...props} style={[props.style, { fontFamily: thaiFor(own) }, handSize(flat)]} />;
}
