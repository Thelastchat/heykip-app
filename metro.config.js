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

// Compare paths loosely (case, slashes, symlinks): if rn.ts ever failed to recognise itself, it would import itself
// forever ("Maximum call stack size exceeded" in rn.ts).
const same = (a, b) => path.normalize(a).toLowerCase() === path.normalize(b).toLowerCase();
const isShimFile = (f) => same(f, SHIM) || same(f, THAI_TEXT) || /[\\/]src[\\/]lib[\\/](rn\.ts|thaiText\.tsx)$/i.test(f);

const REAL = '@real/react-native';
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const from = context.originModulePath;
  // The shim files ask for the real thing by its own name, which is never redirected.
  if (moduleName === REAL) return (upstream ?? context.resolveRequest)(context, 'react-native', platform);
  const ours = from.toLowerCase().startsWith(SRC.toLowerCase()) && !isShimFile(from);
  // Phones: `import { Text } from 'react-native'` → src/lib/rn.ts.
  if (ours && moduleName === 'react-native') return { type: 'sourceFile', filePath: SHIM };
  // Web: react-native-web's babel plugin imports each part on its own (…/exports/Text).
  if (ours && WEB[moduleName]) return { type: 'sourceFile', filePath: WEB[moduleName] };
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
