// '@real/react-native' is React Native itself, under a name metro.config.js never redirects (used by rn.ts and thaiText.tsx).
declare module '@real/react-native' {
  export * from 'react-native';
}
