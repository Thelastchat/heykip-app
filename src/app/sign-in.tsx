import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Kip } from '@/components/Kip';
import { BackButton } from '@/components/setup/kit';
import { Button, Muted, T } from '@/components/ui';
import { useSetup } from '@/lib/setup/draft';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { colors, fonts, radius } from '@/theme';
import { GlowBackground } from '@/components/glow/GlowBackground';

// Email + 6-digit code. It works everywhere, including Expo Go, with no deep links.
// Apple and Google sign-in are added once their keys are set up in Supabase.
export default function SignIn() {
  // Arriving from a signed promise: this is "save your plan", not a cold sign-in.
  const saving = Boolean(useSetup().draft.signature);
  // Read once after mount — asking the navigator during render gives a stale answer.
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => setCanGoBack(router.canGoBack()), []);
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
      <GlowBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={{ minHeight: 46 }}>{canGoBack && <BackButton size={46} />}</View>
        <View style={styles.top}>
          <Kip mood={saving ? 'happy' : 'idle'} size={150} />
          <T variant="hero" style={{ textAlign: 'center' }}>
            {saving ? 'Save your plan' : 'Welcome back'}
          </T>
          <Muted variant="body" style={{ textAlign: 'center' }}>
            {step === 'code'
              ? `I sent a code to ${email.trim()}.`
              : saving
                ? 'So your board and your promise stay safe. I’ll email you a 6-digit code.'
                : 'Log in with your email. I’ll send you a 6-digit code.'}
          </Muted>
        </View>

        {!supabaseConfigured && <Muted style={{ textAlign: 'center', color: colors.orange }}>Supabase isn’t connected yet. Add the keys in .env and restart.</Muted>}

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
  safe: { flex: 1 },
  wrap: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, justifyContent: 'space-between' },
  top: { alignItems: 'center', gap: 10 },
  input: {
    height: 58,
    borderRadius: radius.field,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 18,
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.ink,
  },
});
