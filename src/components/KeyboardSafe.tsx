// Every screen or sheet with a text box sits in this, so the keyboard never covers what you're typing.
// It follows the real keyboard frame by frame (react-native-keyboard-controller, in Expo Go) on iPhone and on
// edge-to-edge Android, where the window no longer resizes for the keyboard by itself.
// While the keyboard is up, a small "Done" sits just above it: the number pad has no key to close it.
import type { ComponentProps } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { KeyboardAvoidingView, KeyboardController, useKeyboardAnimation, useKeyboardState } from 'react-native-keyboard-controller';

import { t } from '@/lib/i18n';
import { colors, fonts, inkA, themed } from '@/theme';

export function KeyboardSafe({ behavior = 'padding', style, done = true, children, ...rest }: ComponentProps<typeof KeyboardAvoidingView> & { done?: boolean }) {
  return (
    <KeyboardAvoidingView behavior={behavior} style={style ?? { flex: 1 }} {...rest}>
      {children}
      {done && <DoneKey />}
    </KeyboardAvoidingView>
  );
}

function DoneKey() {
  const { height } = useKeyboardAnimation();
  const up = useKeyboardState((s) => s.isVisible);
  if (!up) return null;
  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: height }] }]} pointerEvents="box-none">
      <Pressable onPress={() => KeyboardController.dismiss()} style={styles.key} accessibilityRole="button" accessibilityLabel={t('Done')} hitSlop={8}>
        <Text style={styles.keyT}>{t('Done')}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    // Pinned to the bottom (a pinned view ignores the padding above), then lifted by the keyboard's height.
    wrap: { position: 'absolute', right: 12, bottom: 6 },
    key: {
      height: 32,
      paddingHorizontal: 14,
      borderRadius: 999,
      justifyContent: 'center',
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: inkA(0.1),
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    },
    keyT: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  }),
);
