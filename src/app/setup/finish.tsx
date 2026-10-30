// The end of Setup: the plan is saved on the free plan and the app flips to Home.
// No paywall here — Plus lives inside the app, on the features themselves.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Kip } from '@/components/Kip';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useSetup } from '@/lib/setup/draft';
import { finishSetup } from '@/lib/setup/save';
import { colors, fonts } from '@/theme';

export default function SetupFinish() {
  const { session, refreshProfile } = useAuth();
  const { draft, reset } = useSetup();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function run() {
    if (!session) return router.replace('/sign-in');
    setError(null);
    try {
      await finishSetup(session.user.id, draft, 'free');
      reset();
      await refreshProfile(); // setup_done → the app shows Home
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again?');
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      <Kip mood="happy" size={120} />
      <Text style={styles.title}>{error ? 'Hmm, that didn’t save' : 'Setting up your month…'}</Text>
      <Text style={styles.sub}>{error ?? 'Your plan, your goal and your promise — all yours, free.'}</Text>
      {error && (
        <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
          <Button label="Try again" onPress={run} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  title: { fontFamily: fonts.semibold, fontSize: 24, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' },
});
