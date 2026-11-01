// A frosted, see-through card: the glow behind shows through, softened.
// Shadow sits on the outer view; the blur is clipped to the rounded inner view.
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { OnAccent } from '@/lib/accent';
import { colors, scheme, glow, glassA, themed } from '@/theme';

export function Glass({
  children,
  radius = 28,
  style,
  innerStyle,
  tint = glow.glass,
  shadow = true,
  light = false,
}: {
  children?: ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  tint?: string;
  shadow?: boolean;
  /** Stay light in Dark too (cards sitting on a photo or on lime). */
  light?: boolean;
}) {
  const dark = scheme() === 'dark' && !light;
  // Tinted with a brand colour (a picked chip, a lime card): text inside stays dark.
  const accent = light || ACCENTS().includes(tint) || /^rgba\((255,\s*252,\s*154|220,\s*210,\s*247|255,\s*244,\s*122)/.test(tint);
  const edge = light ? 'rgba(255,255,255,0.95)' : glow.glassEdge;
  // On the web the card frosts itself (backdrop-filter), so no extra layers sit on top of icons.
  if (Platform.OS === 'web') {
    return (
      <View style={[{ borderRadius: radius }, shadow && styles.shadow, style]}>
        <View style={[{ borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: edge, backgroundColor: tint, backdropFilter: 'blur(24px) saturate(1.5)' } as ViewStyle, innerStyle]}>
          <OnAccent.Provider value={accent}>{children}</OnAccent.Provider>
        </View>
      </View>
    );
  }
  return (
    <View style={[{ borderRadius: radius }, shadow && styles.shadow, style]}>
      <View style={[{ borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: edge }, innerStyle]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 28 : 40}
          tint={dark ? 'dark' : 'light'}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          style={StyleSheet.absoluteFill}
        />
        {/* Android without blur falls back to a slightly denser white so text stays readable */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: Platform.OS === 'android' ? (dark ? 'rgba(30,29,34,0.85)' : 'rgba(255,255,255,0.62)') : tint }]} />
        <OnAccent.Provider value={accent}>{children}</OnAccent.Provider>
      </View>
    </View>
  );
}

const ACCENTS = () => [colors.lime, colors.limeDeep, colors.lavender, colors.peach, colors.sage, colors.pink, colors.sky, colors.sand, colors.roseBeige];

const styles = themed(() =>
  StyleSheet.create({
    shadow: { boxShadow: '0 1px 2px rgba(17,17,17,0.03), 0 16px 36px rgba(17,17,17,0.06)' },
  }),
);
