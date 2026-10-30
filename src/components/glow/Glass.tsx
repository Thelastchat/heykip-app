// A frosted, see-through card: the glow behind shows through, softened.
// Shadow sits on the outer view; the blur is clipped to the rounded inner view.
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { glow } from '@/theme';

export function Glass({
  children,
  radius = 28,
  style,
  innerStyle,
  tint = glow.glass,
  shadow = true,
}: {
  children?: ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  tint?: string;
  shadow?: boolean;
}) {
  return (
    <View style={[{ borderRadius: radius }, shadow && styles.shadow, style]}>
      <View style={[{ borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: glow.glassEdge }, innerStyle]}>
        <BlurView intensity={Platform.OS === 'ios' ? 28 : 40} tint="light" blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined} style={StyleSheet.absoluteFill} />
        {/* Android without blur falls back to a slightly denser white so text stays readable */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.62)' : tint }]} />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { boxShadow: '0 1px 2px rgba(17,17,17,0.03), 0 16px 36px rgba(17,17,17,0.06)' },
});
