// The app's `react-native`: everything as usual, except Text and TextInput, which switch Thai words to
// IBM Plex Sans Thai (see thaiText.tsx). metro.config.js points the app's `react-native` imports here.
export * from 'react-native';
export { Text, TextInput } from './thaiText';
