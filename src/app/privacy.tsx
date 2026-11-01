// Privacy & data (approved mockup): Kip's AI switch, see everything saved, the policy, questions,
// and two ways to delete — all spending & slips (keeps the account), or the whole account.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { aiAllowed, useAiConsent } from '@/components/AiConsent';
import { Kip } from '@/components/Kip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Glass } from '@/components/glow/Glass';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { RiseIn, Squish } from '@/components/glow/motion';
import { SaveButton, Sheet } from '@/components/profile/Sheet';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { ICON3D } from '@/lib/icons3d';
import { PRIVACY_EMAIL } from '@/lib/privacy';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme';

export default function Privacy() {
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuth();
  const ai = useAiConsent(() => router.push('/privacy-policy'));
  const [count, setCount] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<null | 'spending' | 'account'>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const uid = session?.user.id;
  const on = aiAllowed(profile);

  const loadCount = useCallback(async () => {
    if (!uid) return;
    const { count: n } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', uid);
    setCount(n ?? 0);
  }, [uid]);
  useFocusEffect(
    useCallback(() => {
      loadCount();
    }, [loadCount]),
  );

  function flash(s: string) {
    setToast(s);
    setTimeout(() => setToast(null), 2600);
  }

  async function toggleAi(next: boolean) {
    if (!uid) return;
    if (next) {
      // Turning on: the first time this asks with the full sheet; after that it just switches back on.
      if (!profile?.ai_consent_at) return void (await ai.ensure());
      await supabase.from('profiles').update({ ai_off: false }).eq('id', uid);
    } else {
      await supabase.from('profiles').update({ ai_off: true }).eq('id', uid);
      flash(t('Kip’s reading is off — nothing is sent to the AI.'));
    }
    Haptics.selectionAsync().catch(() => {});
    refreshProfile();
  }

  async function deleteSpending() {
    if (!uid) return;
    setBusy(true);
    const { error } = await supabase.from('transactions').delete().eq('user_id', uid);
    setBusy(false);
    setConfirm(null);
    if (error) return flash(t('Couldn’t delete: {msg}', { msg: error.message }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCount(0);
    flash(t('All spending and slips are deleted.'));
  }

  async function deleteAccount() {
    setBusy(true);
    const { error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) {
      setBusy(false);
      setConfirm(null);
      return flash(t('Couldn’t delete your account — check your internet and try again.'));
    }
    await supabase.auth.signOut({ scope: 'local' });
  }

  return (
    <View style={{ flex: 1 }}>
      <GlowBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <ScreenHeader title={t('Privacy & data')} />

        <RiseIn>
          <Glass radius={24} innerStyle={styles.hero}>
            <Image source={ICON3D.shield} style={{ width: 44, height: 44 }} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('Your money stays yours')}</Text>
              <Text style={styles.body}>{t('Only your account can see it. Encrypted on the way. Never sold.')}</Text>
            </View>
          </Glass>
        </RiseIn>

        <Text style={styles.cap}>{t('Kip’s AI')}</Text>
        <Glass radius={24} innerStyle={styles.group}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('Let Kip read for me')}</Text>
              <Text style={styles.small}>{t('Talk to Kip, slips and finding slips. Sent to Anthropic, deleted in 30 days.')}</Text>
            </View>
            <Switch
              value={on}
              onValueChange={toggleAi}
              trackColor={{ true: colors.ink, false: 'rgba(17,17,17,0.15)' }}
              thumbColor="#FFFFFF"
              {...({ activeThumbColor: '#FFFFFF', activeTrackColor: colors.ink } as object)}
              accessibilityLabel={t('Let Kip read for me')}
            />
          </View>
        </Glass>

        <Text style={styles.cap}>{t('Your data')}</Text>
        <Glass radius={24} innerStyle={styles.group}>
          <Row title={t('Everything Kip saved')} sub={t('See every entry · swipe to delete one')} value={count === null ? '' : String(count)} onPress={() => router.push('/saved')} />
          <Row title={t('Privacy policy')} sub={t('The full version, in plain words')} line onPress={() => router.push('/privacy-policy')} />
          <Row title={t('Questions')} sub={PRIVACY_EMAIL} line onPress={() => Linking.openURL(`mailto:${PRIVACY_EMAIL}?subject=HeyKip%20privacy`)} />
        </Glass>

        <Glass radius={24} innerStyle={styles.group}>
          <Row title={t('Delete all spending & slips')} sub={t('Keeps your account, goals and plan')} danger onPress={() => setConfirm('spending')} />
          <Row title={t('Delete account')} sub={t('Everything, for good')} danger line onPress={() => setConfirm('account')} />
        </Glass>
      </ScrollView>

      {confirm && (
        <Sheet
          open
          onClose={() => setConfirm(null)}
          title={confirm === 'spending' ? t('Delete all spending & slips?') : t('Delete your account?')}
          sub={
            confirm === 'spending'
              ? t('Every entry you saved — typed, from slips or from Kip — is deleted for good. Your account, goals and plan stay. This can’t be undone.')
              : t('Your goals, spending, photos and promise are deleted for good. This can’t be undone.')
          }>
          <View style={{ alignItems: 'center', marginVertical: 4 }}>
            <Kip mood="careful" size={90} />
          </View>
          <SaveButton label={busy ? t('Deleting…') : t('Delete everything')} danger disabled={busy} onPress={confirm === 'spending' ? deleteSpending : deleteAccount} />
          <Squish onPress={() => setConfirm(null)} accessibilityRole="button">
            <Glass radius={999} innerStyle={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={styles.rowTitle}>{confirm === 'spending' ? t('Keep them') : t('Keep my account')}</Text>
            </Glass>
          </Squish>
        </Sheet>
      )}
      {ai.sheet}
      {toast && (
        <View style={[styles.toast, { bottom: insets.bottom + 24 }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function Row({ title, sub, value, line, danger, onPress }: { title: string; sub: string; value?: string; line?: boolean; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, line && styles.line, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={title}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: colors.orangeText }]}>{title}</Text>
        <Text style={styles.small}>{sub}</Text>
      </View>
      {value ? <Text style={styles.val}>{value}</Text> : null}
      {!danger && <CaretRight size={14} color={colors.faint} weight="bold" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.ink },
  cap: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginLeft: 4, marginBottom: -6 },
  group: { paddingHorizontal: 16, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  line: { borderTopWidth: 1, borderTopColor: 'rgba(17,17,17,0.06)' },
  rowTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 1 },
  val: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'] },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, maxWidth: '90%' },
  toastText: { fontFamily: fonts.regular, fontSize: 13, color: '#FFFFFF', textAlign: 'center' },
});
