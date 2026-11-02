// The app's `react-native`: the same parts as usual, except Text and TextInput, which switch Thai words to
// IBM Plex Sans Thai (see thaiText.tsx). metro.config.js points the app's `react-native` imports here.
// Listed one by one on purpose: `export *` would load every part of React Native (some aren't in Expo Go).
// Using a new part of React Native in the app? Add it here.
// It asks for '@real/react-native' (never redirected), so this file can't end up importing itself.
export {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  useWindowDimensions,
} from '@real/react-native';
export type { ImageSourcePropType, PressableProps, StyleProp, TextInputProps, TextProps, TextStyle, ViewStyle } from '@real/react-native';
export { Text, TextInput } from './thaiText';
