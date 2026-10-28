import Stack from 'expo-router/stack';

import { colors } from '@/theme';

// Setup: intro → basics → payday habits → goal (→ is it realistic?) → Kip thinking → yay → here’s everything → pick your plan → make it yours → promise → (account) → paywall.
export default function SetupLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
