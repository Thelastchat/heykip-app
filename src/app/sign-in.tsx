import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { Button, Muted, T } from '@/components/ui';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { colors, fonts, radius } from '@/theme';

// Email + 6-digit code. It works everywhere, including Expo Go, with no deep links.
// Apple and Google sign-in are added once their keys are set up in Supabase.
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(error.message);
    else setStep('code');
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError('That code didn’t work. Check the newest email and try again.');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.top}>
          <Kip size={150} />
          <T variant="hero" style={{ textAlign: 'center' }}>
            Hi, I’m Kip.
          </T>
          <Muted variant="body" style={{ textAlign: 'center' }}>
            {step === 'email' ? 'Sign in with your email. I’ll send you a 6-digit code.' : `I sent a code to ${email.trim()}.`}
          </Muted>
        </View>

        {!supabaseConfigured && (
          <Muted style={{ textAlign: 'center', color: colors.orange }}>
            Supabase isn’t connected yet. Add the keys in .env and restart.
          </Muted>
        )}

        <View style={{ gap: 12 }}>
          {step === 'email' ? (
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={styles.input}
              accessibilityLabel="Email"
            />
          ) : (
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={colors.faint}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={10}
              style={[styles.input, { letterSpacing: 6, textAlign: 'center' }]}
              accessibilityLabel="6-digit code"
            />
          )}
          {error && <Muted style={{ color: colors.orange }}>{error}</Muted>}
          {step === 'email' ? (
            <Button label="Send my code" onPress={sendCode} loading={busy} disabled={!email.includes('@')} />
          ) : (
            <>
              <Button label="Sign in" onPress={verify} loading={busy} disabled={code.trim().length < 6} />
              <Button label="Use a different email" kind="secondary" onPress={() => setStep('email')} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, paddingHorizontal: 20, paddingBottom: 24, justifyContent: 'space-between' },
  top: { alignItems: 'center', gap: 10, marginTop: 40 },
  input: {
    height: 58,
    borderRadius: radius.field,
    backgroundColor: colors.grey,
    paddingHorizontal: 18,
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.ink,
  },
});
