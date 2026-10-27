import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Muted, T } from '@/components/ui';
import { colors } from '@/theme';

// Talk to Kip — placeholder for Step 5. Opened from the centre Kip button.
export default function Talk() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 16 }}>
      <ScreenHeader close />
      <View style={{ alignItems: 'center', gap: 8, marginTop: 24 }}>
        <Muted variant="body">Hey there</Muted>
        <T variant="title" style={{ textAlign: 'center' }}>What did you spend today?</T>
        <Kip mood="listen" size={210} />
        <Muted style={{ textAlign: 'center' }}>Talking to Kip arrives in Step 5.</Muted>
      </View>
    </View>
  );
}
