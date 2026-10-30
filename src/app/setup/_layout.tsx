import Stack from 'expo-router/stack';

import { colors } from '@/theme';

// Setup: intro → basics → payday habits → goal (→ is it realistic?) → Kip thinking → yay (→ see what I used) → promise → (account) → finish → Home.
export default function SetupLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
