// Metro: the app's own files get Thai-aware Text and TextInput (src/lib/thaiText.tsx) when they import from
// 'react-native'. Libraries, and the two files that make that happen, still get the real react-native.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const SRC = path.join(__dirname, 'src') + path.sep;
const SHIM = path.join(__dirname, 'src', 'lib', 'rn.ts');
const THAI_TEXT = path.join(__dirname, 'src', 'lib', 'thaiText.tsx');

const WEB = {
  'react-native-web/dist/exports/Text': path.join(__dirname, 'src', 'lib', 'web', 'Text.ts'),
  'react-native-web/dist/exports/TextInput': path.join(__dirname, 'src', 'lib', 'web', 'TextInput.ts'),
};

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const from = context.originModulePath;
  const ours = from.startsWith(SRC) && from !== SHIM && from !== THAI_TEXT;
  // Phones: `import { Text } from 'react-native'` → src/lib/rn.ts.
  if (ours && moduleName === 'react-native') return { type: 'sourceFile', filePath: SHIM };
  // Web: react-native-web's babel plugin imports each part on its own (…/exports/Text).
  if (ours && WEB[moduleName]) return { type: 'sourceFile', filePath: WEB[moduleName] };
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
