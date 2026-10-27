// The goal board: a cork-ish board, push pins, polaroids and post-its. Used in Setup, Home and Goals.
import { Image } from 'expo-image';
import { Image as ImageIcon } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/theme';

/** A glossy push pin. Goal 1 is always orange, 2 lavender, 3 sky. */
export function Pin({ color, size = 18, style }: { color: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const id = `pin-${color.replace('#', '')}`;
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, boxShadow: '0 3px 4px rgba(0,0,0,0.22)' }, style]} pointerEvents="none">
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`${id}-shine`} cx="34%" cy="30%" r="24%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.95} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.55" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.18} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={color} />
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id}-shade)`} />
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id}-shine)`} />
      </Svg>
    </View>
  );
}

/** A pinned photo with a white border and a caption area. */
export function Polaroid({
  photo,
  width,
  photoHeight,
  rotate = -3,
  pin,
  padding = 7,
  bottom = 10,
  children,
  style,
}: {
  photo: string | null;
  width: number;
  photoHeight: number;
  rotate?: number;
  pin?: string;
  padding?: number;
  bottom?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      <View style={[styles.polaroid, { padding, paddingBottom: bottom }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ height: photoHeight, borderRadius: 2 }} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.noPhoto, { height: photoHeight }]}>
            <ImageIcon size={28} color="rgba(122,84,48,0.45)" />
          </View>
        )}
        {children}
      </View>
      {pin && <Pin color={pin} style={{ position: 'absolute', top: -8, left: width / 2 - 9, zIndex: 2 }} />}
    </View>
  );
}

/** A lime sticky note with a strip of tape. */
export function PostIt({ width, rotate = -3, children, style }: { width: number; rotate?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.postIt, { width, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      <View style={styles.tape} />
      {children}
    </View>
  );
}

/** The board surface: warm beige with a fine two-tone dot texture. */
export function CorkBoard({ height, children, style }: { height: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.board, { height }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id="dots-a" width={9} height={9} patternUnits="userSpaceOnUse">
            <Circle cx={1.2} cy={1.2} r={1.1} fill="rgba(122,84,48,0.09)" />
          </Pattern>
          <Pattern id="dots-b" x={5} y={7} width={13} height={13} patternUnits="userSpaceOnUse">
            <Circle cx={1.2} cy={1.2} r={1.1} fill="rgba(255,255,255,0.45)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dots-a)" />
        <Rect width="100%" height="100%" fill="url(#dots-b)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  polaroid: { backgroundColor: '#FFFFFF', borderRadius: 5, boxShadow: '0 1px 2px rgba(0,0,0,0.10), 0 10px 22px rgba(60,40,20,0.18)' },
  noPhoto: { borderRadius: 2, backgroundColor: '#EFE6DA', alignItems: 'center', justifyContent: 'center' },
  postIt: { backgroundColor: colors.lime, paddingTop: 16, paddingHorizontal: 10, paddingBottom: 10, gap: 3, boxShadow: '0 8px 16px rgba(60,40,20,0.16)' },
  tape: { position: 'absolute', top: -7, left: '50%', marginLeft: -20, width: 40, height: 14, backgroundColor: 'rgba(255,255,255,0.6)', transform: [{ rotate: '-5deg' }] },
  board: { borderRadius: 26, overflow: 'hidden', backgroundColor: '#E9DCC9', boxShadow: 'inset 0 0 0 1px rgba(122,84,48,0.10)' },
});
