import Stack from 'expo-router/stack';

import { colors } from '@/theme';

// Setup: intro → basics → money style → first goal → Kip's plan → promise → (account) → paywall.
export default function SetupLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
