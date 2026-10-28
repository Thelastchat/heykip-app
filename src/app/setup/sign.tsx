import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { SetupScreen, Title } from '@/components/setup/kit';
import { SignaturePad } from '@/components/setup/SignaturePad';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useSetup } from '@/lib/setup/draft';
import { fullDate, makePlan } from '@/lib/setup/plan';
import { colors, fonts } from '@/theme';

// Setup 6/6 · Your promise to yourself, signed with your finger.
export default function SetupSign() {
  const { session } = useAuth();
  const { draft, update } = useSetup();
  const plan = makePlan(draft);
  const [editing, setEditing] = useState(false);
  const [pad, setPad] = useState(0);

  const main = draft.promiseMain ?? plan.promiseMain;
  const backup = draft.promiseBackup ?? plan.promiseBackup;

  function commit() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    update({ signedAt: new Date().toISOString(), promiseMain: main.trim(), promiseBackup: backup.trim() });
    router.push(session ? '/setup/paywall' : '/sign-in');
  }

  return (
    <SetupScreen
      step={6}
      footer={
        <>
          <Button label="Sign and commit" disabled={!draft.signature || !main.trim()} onPress={commit} />
          <Text style={styles.note}>Kip will remind you of this on the days you’re about to give in.</Text>
        </>
      }>
      <View style={{ gap: 6 }}>
        <Title>Your promise to yourself</Title>
        <Text style={styles.sub}>Kip wrote it from your own words. Change anything, then sign.</Text>
      </View>

      <View style={styles.note2}>
        <View style={styles.tape} />
        <Text style={styles.kicker}>MY PROMISE</Text>
        {editing ? (
          <>
            <TextInput value={main} onChangeText={(t) => update({ promiseMain: t })} multiline style={[styles.main, styles.input]} autoFocus accessibilityLabel="Your promise" />
            <TextInput value={backup} onChangeText={(t) => update({ promiseBackup: t })} multiline style={[styles.backup, styles.input]} accessibilityLabel="If money gets tight" />
          </>
        ) : (
          <>
            <Text style={styles.main}>{main}</Text>
            <Text style={styles.backup}>{backup}</Text>
          </>
        )}

        <View style={styles.signArea}>
          <Svg height={1} width="100%">
            <Line x1="0" y1="0.5" x2="100%" y2="0.5" stroke="rgba(17,17,17,0.3)" strokeWidth={1} strokeDasharray="4 3" />
          </Svg>
          <SignaturePad key={pad} value={draft.signature} onChange={(signature) => update({ signature })} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.signedWith}>Signed with your finger · {fullDate(new Date())}</Text>
            {draft.signature && (
              <Pressable
                hitSlop={10}
                onPress={() => {
                  update({ signature: null });
                  setPad((n) => n + 1);
                }}>
                <Text style={styles.redo}>Redo</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <View style={{ alignItems: 'flex-end', paddingHorizontal: 4 }}>
        <Pressable hitSlop={10} onPress={() => setEditing((e) => !e)}>
          <Text style={styles.edit}>{editing ? 'Done editing' : 'Edit the words'}</Text>
        </Pressable>
      </View>
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  note2: {
    marginTop: 14,
    marginHorizontal: 4,
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.lime,
    transform: [{ rotate: '-1.2deg' }],
    boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
    gap: 10,
  },
  tape: { position: 'absolute', top: -9, left: '50%', marginLeft: -32, width: 64, height: 18, backgroundColor: 'rgba(255,255,255,0.65)', transform: [{ rotate: '-3deg' }] },
  kicker: { fontFamily: fonts.regular, fontSize: 10, letterSpacing: 1.2, color: 'rgba(17,17,17,0.55)' },
  main: { fontFamily: fonts.hand, fontSize: 27, lineHeight: 31, color: colors.ink },
  backup: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 25, color: 'rgba(17,17,17,0.75)' },
  input: { padding: 0, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 6 },
  signArea: { marginTop: 6 },
  signedWith: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(17,17,17,0.55)' },
  redo: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink, textDecorationLine: 'underline' },
  edit: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textDecorationLine: 'underline' },
  note: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
});
