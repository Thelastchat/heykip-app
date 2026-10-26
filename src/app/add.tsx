import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, Muted, T } from '@/components/ui';
import { colors } from '@/theme';

// "Add it yourself" — placeholder for Step 5 (keypad, categories, Spent / Got paid).
export default function Add() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 16 }}>
      <ScreenHeader title="Add it yourself" />
      <Card>
        <T variant="bodyStrong">The keypad is on its way</T>
        <Muted style={{ marginTop: 4 }}>Spent / Got paid, categories and the keypad arrive in Step 5.</Muted>
      </Card>
    </View>
  );
}
