// Thai text in IBM Plex Sans Thai. Geist has no Thai letters, so any Text (or TextInput) whose words contain Thai
// gets the Plex Thai weight that matches its Geist weight. English stays in Geist; Caveat (handwriting) and the
// signature font are left alone. The app's `react-native` imports point here through metro.config.js, so every
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
};

/** The font a nested Text inherits from the Text around it. */
const Inherited = createContext<string | undefined>(undefined);

function hasThai(node: ReactNode): boolean {
  if (typeof node === 'string') return THAI.test(node);
  if (Array.isArray(node)) return node.some(hasThai);
  return false;
}

/** The Thai version of a Geist font; anything else (handwriting, already Thai) stays as it is. */
const thaiFor = (family: string | undefined) => (family ? (TO_THAI[family] ?? family) : fonts.thai);

// React 19: `ref` arrives as an ordinary prop and is passed straight through.
export function Text(props: ComponentProps<typeof RNText>) {
  const parent = useContext(Inherited);
  const accent = useContext(OnAccent);
  const flat = StyleSheet.flatten(props.style) as TextStyle | undefined;
  const own = flat?.fontFamily;
  const family = own ?? parent;
  const thai = hasThai(props.children);
  const shown = thai ? thaiFor(family) : family;
  // On lime / pastel / photo surfaces the text stays dark, in Light and in Dark.
  const c = flat?.color;
  const accentColor = accent && (c === undefined || c === colors.ink || c === colors.muted) ? (c === colors.muted ? colors.onAccentMuted : colors.onAccent) : undefined;
  const style = (thai && shown !== own) || accentColor ? [props.style, thai && shown !== own ? { fontFamily: shown } : null, accentColor ? { color: accentColor } : null] : props.style;
  return (
    <Inherited.Provider value={family}>
      <RNText {...props} style={style} />
    </Inherited.Provider>
  );
}

export function TextInput(props: ComponentProps<typeof RNTextInput>) {
  const thai = THAI.test(props.value ?? props.defaultValue ?? '') || (!props.value && THAI.test(props.placeholder ?? ''));
  if (!thai) return <RNTextInput {...props} />;
  const own = (StyleSheet.flatten(props.style) as TextStyle | undefined)?.fontFamily;
  return <RNTextInput {...props} style={[props.style, { fontFamily: thaiFor(own) }]} />;
}
