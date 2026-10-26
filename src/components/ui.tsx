// Small shared building blocks so every screen uses the same type, buttons and cards.
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadow, type } from '@/theme';

type Variant = keyof typeof type;

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[{ color: colors.ink }, type[variant] as TextStyle, style]} />;
}

export function Muted(props: TextProps & { variant?: Variant }) {
  return <T variant={props.variant ?? 'label'} {...props} style={[{ color: colors.muted }, props.style]} />;
}

type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  kind?: 'primary' | 'secondary';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, kind = 'primary', loading, style, disabled, ...rest }: ButtonProps) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      {...rest}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        (pressed || disabled) && { opacity: 0.7 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? '#FFFFFF' : colors.ink} />
      ) : (
        <T variant="button" style={{ color: primary ? '#FFFFFF' : colors.ink }}>
          {label}
        </T>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  button: { height: 58, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  primary: { backgroundColor: colors.ink },
  secondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: '#FFFFFF', borderRadius: radius.card, padding: 16, ...shadow.card },
});
