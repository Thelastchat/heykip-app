// "Before Kip reads for you" (approved mockup): asked once, before anything is sent to Kip's AI
// (Talk to Kip, slips, finding slips). Required by Thailand's PDPA and App Store guideline 5.1.2(i).
// The server checks the same answer, so nothing reaches the AI without it.
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Kip } from '@/components/Kip';
import { SaveButton, Sheet } from '@/components/profile/Sheet';
import { useAuth } from '@/lib/auth';
import { rich, t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { colors, fonts, inkA, themed } from '@/theme';

/** True when Kip may read for this person right now. */
export const aiAllowed = (p: { ai_consent_at: string | null; ai_off: boolean } | null) => !!p?.ai_consent_at && !p.ai_off;

/**
 * `const ai = useAiConsent()` → `if (!(await ai.ensure())) return;` before any AI call, and render `{ai.sheet}`.
 * Already allowed → resolves true at once. Otherwise shows the sheet and resolves with their answer.
 */
export function useAiConsent(onPolicy?: () => void): { ensure: () => Promise<boolean>; sheet: ReactNode } {
  const { session, profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const answer = useRef<((ok: boolean) => void) | null>(null);

  const ensure = useCallback(() => {
    if (aiAllowed(profile)) return Promise.resolve(true);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      answer.current = resolve;
    });
  }, [profile]);

  const close = (ok: boolean) => {
    setOpen(false);
    const r = answer.current;
    answer.current = null;
    // Answer only once the sheet has slid away: on iPhone, Photos, a permission alert or another sheet
    // opened while this one is still closing never shows up.
    if (r) setTimeout(() => r(ok), Platform.OS === 'ios' ? 550 : 0);
  };

  async function allow() {
    if (!session) return close(false);
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ ai_consent_at: new Date().toISOString(), ai_off: false }).eq('id', session.user.id);
    if (!error) await refreshProfile();
    setBusy(false);
    close(!error);
  }

  const b = (s: string) => <Text style={styles.b}>{s}</Text>;
  const sheet = open ? (
    <Sheet open onClose={() => close(false)} title={t('Before Kip reads for you')}>
      <View style={{ alignItems: 'center', marginTop: -4 }}>
        <Kip mood="happy" size={80} />
      </View>
      <Line n={1}>{rich('To read slips and chats, Kip sends them to **Anthropic’s Claude AI**, a company outside Thailand.', undefined, b)}</Line>
      <Line n={2}>{rich('We save **only the numbers** — amount, who, when. Slip pictures stay in your Photos.', undefined, b)}</Line>
      <Line n={3}>{rich('Anthropic deletes it within 30 days and **never trains AI on it**. Nothing is sold, ever.', undefined, b)}</Line>
      <Line n={4}>{rich('Turn this off or delete everything any time in **Profile → Privacy & data**.', undefined, b)}</Line>
      <SaveButton label={busy ? t('Saving…') : t('Allow')} disabled={busy} onPress={allow} />
      <Text style={styles.fine}>
        <Text onPress={() => close(false)} accessibilityRole="button">
          {t('Not now — you can still type it in yourself')}
        </Text>
        {onPolicy ? (
          <>
            {' · '}
            <Text
              style={{ color: colors.ink, textDecorationLine: 'underline' }}
              onPress={() => {
                close(false);
                onPolicy();
              }}
              accessibilityRole="link">
              {t('Privacy policy')}
            </Text>
          </>
        ) : null}
      </Text>
    </Sheet>
  ) : null;

  return { ensure, sheet };
}

function Line({ n, children }: { n: number; children: ReactNode }) {
  return (
    <View style={styles.line}>
      <View style={styles.num}>
        <Text style={styles.numText}>{n}</Text>
      </View>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

export function PrivacyLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
      <Text style={[styles.fine, { textDecorationLine: 'underline' }]}>{t('Privacy policy')}</Text>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    line: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    num: { width: 26, height: 26, borderRadius: 13, backgroundColor: inkA(0.06), alignItems: 'center', justifyContent: 'center' },
    numText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
    text: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
    b: { fontFamily: fonts.medium },
    fine: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, textAlign: 'center', marginBottom: 4 },
  }),
);
