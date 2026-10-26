import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KipStill } from '@/components/KipStill';
import { Button, Muted, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

// Placeholder for the Setup flow (Step 3). For now it just marks the account as set up.
export default function SetupPlaceholder() {
  const { session, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  async function finish() {
    if (!session) return;
    setBusy(true);
    await supabase.from('profiles').update({ onboarded: true }).eq('id', session.user.id);
    await refreshProfile();
    setBusy(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <KipStill size={170} />
        <T variant="hero">Setup comes next</T>
        <Muted variant="body" style={{ textAlign: 'center' }}>
          In Step 3 this becomes the 5 quick steps, Kip’s plan, your promise and the paywall.
        </Muted>
      </View>
      <Button label="Skip to Home for now" onPress={finish} loading={busy} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
