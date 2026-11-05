// Every screen or sheet with a text box sits in this, so the keyboard never covers what you're typing.
// It follows the real keyboard frame by frame (react-native-keyboard-controller, in Expo Go) on iPhone and on
// edge-to-edge Android, where the window no longer resizes for the keyboard by itself.
import type { ComponentProps } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

export function KeyboardSafe({ behavior = 'padding', style, ...rest }: ComponentProps<typeof KeyboardAvoidingView>) {
  return <KeyboardAvoidingView behavior={behavior} style={style ?? { flex: 1 }} {...rest} />;
}
