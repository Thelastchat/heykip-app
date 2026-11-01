// The app's `react-native`: the same parts as usual, except Text and TextInput, which switch Thai words to
// IBM Plex Sans Thai (see thaiText.tsx). metro.config.js points the app's `react-native` imports here.
// Listed one by one on purpose: `export *` would load every part of React Native (some aren't in Expo Go).
// Using a new part of React Native in the app? Add it here.
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
} from 'react-native';
export type { ImageSourcePropType, PressableProps, StyleProp, TextInputProps, TextProps, TextStyle, ViewStyle } from 'react-native';
export { Text, TextInput } from './thaiText';
