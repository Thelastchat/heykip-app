import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Muted, T } from '@/components/ui';
import { colors } from '@/theme';

// Goals — placeholder for Step 4.
export default function Goals() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 18, gap: 14 }}>
      <T variant="greeting">Goals</T>
      <Card>
        <T variant="bodyStrong">Your board is on its way</T>
        <Muted style={{ marginTop: 4 }}>Polaroids, pins and “Add a goal” arrive in Step 4.</Muted>
      </Card>
    </ScrollView>
  );
}
