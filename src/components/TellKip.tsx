// "Or tell Kip…" (approved mockups): a box inside a sheet where someone types or says what they want, in their own
// words. Kip answers right there with the change it would make; nothing happens until "Do it". Kip never leaves the
// sheet or chats about anything else. Plus only, and only with the AI permission (asked here the first time).
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowUp, Microphone, Stop } from 'phosphor-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAiConsent } from '@/components/AiConsent';
import { Kip } from '@/components/Kip';
import { Glass } from '@/components/glow/Glass';
import { Squish } from '@/components/glow/motion';
import { SaveButton } from '@/components/profile/Sheet';
import { getLang, rich, t } from '@/lib/i18n';
import { ICON3D, type Icon3D } from '@/lib/icons3d';
import { supabase } from '@/lib/supabase';
import { defaultVoiceLang, savedVoiceLang, useVoice, voiceModule } from '@/lib/voice';
import { colors, fonts, inkA, themed } from '@/theme';

export type KipTask = 'extra' | 'over' | 'month';
type Reason = 'plus' | 'consent' | 'nokey' | 'busy' | 'offline' | 'limit';

/** Ask Kip to turn what was said into a change for this sheet. The app checks the answer before showing it. */
export async function askKipDo<T>(task: KipTask, text: string, context: object): Promise<{ ok: true; out: T & { ok: boolean; reply: string } } | { ok: false; reason: Reason }> {
  const timeout = new Promise<{ data: null; error: { context: { status: number } } }>((res) => setTimeout(() => res({ data: null, error: { context: { status: 504 } } }), 40_000));
  const { data, error } = await Promise.race([supabase.functions.invoke('kip-do', { body: { task, text, context: { ...context, language: getLang() } } }), timeout]);
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 402) return { ok: false, reason: 'plus' };
    if (status === 429) return { ok: false, reason: 'limit' };
    if (status === 403) return { ok: false, reason: 'consent' };
    if (status === undefined) return { ok: false, reason: 'offline' };
    return { ok: false, reason: 'busy' };
  }
  if (!data || typeof data !== 'object' || !('reply' in data)) return { ok: false, reason: 'busy' };
  return { ok: true, out: data as T & { ok: boolean; reply: string } };
}

export type ChangeRow = { icon: Icon3D | null; title: string; sub?: string; from?: string; to: string; warn?: boolean };

/** The box. `onAsk` sends the words to Kip and returns what to show (or null when Kip couldn't do it). */
export function TellKipBox({ placeholder, onAsk, disabled }: { placeholder: string; onAsk: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState('');
  const input = useRef<{ focus: () => void } | null>(null);
  const voice = useVoice((heard) => heard && setText(heard));
  const canTalk = !!voiceModule();
  const listening = voice.state !== 'idle';

  async function mic() {
    if (listening) {
      const heard = await voice.finish();
      if (heard) setText(heard);
      return;
    }
    // In Expo Go (no speech module) the keyboard's own mic does the job.
    if (!canTalk) return input.current?.focus();
    const lang = (await savedVoiceLang()) ?? defaultVoiceLang();
    if (await voice.start(lang)) input.current?.focus();
  }

  function send() {
    const s = text.trim();
    if (!s || disabled) return;
    setText('');
    onAsk(s);
  }

  return (
    <Glass radius={22} innerStyle={styles.box}>
      <TextInput
        ref={input as never}
        value={listening ? voice.text : text}
        onChangeText={setText}
        placeholder={listening ? t('Listening…') : placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, { outlineStyle: 'none' } as never]}
        returnKeyType="send"
        onSubmitEditing={send}
        editable={!disabled && !listening}
        multiline={false}
        accessibilityLabel={placeholder}
      />
      {text.trim() && !listening ? (
        <Squish onPress={send} style={styles.round} accessibilityRole="button" accessibilityLabel={t('Send to Kip')}>
          {disabled ? <ActivityIndicator color={colors.paper} size="small" /> : <ArrowUp size={17} color={colors.paper} weight="bold" />}
        </Squish>
      ) : (
        <Squish onPress={mic} style={styles.round} accessibilityRole="button" accessibilityLabel={listening ? t('Stop listening') : t('Talk to Kip')}>
          {disabled ? (
            <ActivityIndicator color={colors.paper} size="small" />
          ) : listening ? (
            <Stop size={15} color={colors.paper} weight="fill" />
          ) : (
            <Microphone size={17} color={colors.paper} weight="fill" />
          )}
        </Squish>
      )}
    </Glass>
  );
}

/** What was said, Kip's answer, and (when Kip could do it) the change with "Do it". */
export function KipAnswer({
  said,
  reply,
  rows,
  onDo,
  onBack,
  doing,
  doLabel,
  backLabel,
}: {
  said: string;
  reply: string;
  rows: ChangeRow[] | null;
  onDo: () => void;
  onBack: () => void;
  doing?: boolean;
  doLabel?: string;
  backLabel?: string;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.me}>
        <Text style={styles.meText}>{said}</Text>
      </View>
      <View style={styles.kipRow}>
        <Kip mood={rows ? 'happy' : 'careful'} size={52} />
        <Glass radius={22} style={{ flex: 1 }} innerStyle={styles.bub}>
          <Text style={styles.say}>{reply}</Text>
        </Glass>
      </View>
      {rows && rows.length > 0 && (
        <Glass radius={22} innerStyle={{ paddingHorizontal: 14 }}>
          {rows.map((r, i) => (
            <View key={i} style={[styles.row, i > 0 && styles.line]}>
              {r.icon ? <Image source={ICON3D[r.icon]} style={{ width: 36, height: 36 }} contentFit="contain" /> : <View style={{ width: 36 }} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{r.title}</Text>
                {r.sub ? <Text style={styles.sub}>{r.sub}</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                {r.from ? <Text style={styles.from}>{r.from}</Text> : null}
                <Text style={[styles.to, r.warn && { color: colors.orangeText }]}>{r.to}</Text>
              </View>
            </View>
          ))}
        </Glass>
      )}
      {rows && rows.length > 0 && <SaveButton label={doing ? t('Saving…') : (doLabel ?? t('Do it'))} disabled={doing} onPress={onDo} />}
      <Pressable onPress={onBack} style={{ alignSelf: 'center', padding: 4 }} accessibilityRole="button">
        <Text style={styles.back}>{backLabel ?? (rows ? t('Back to the choices') : t('Back'))}</Text>
      </Pressable>
    </View>
  );
}

/** What to say when Kip can't be reached. */
export function kipProblem(reason: Reason): string {
  if (reason === 'offline') return t('I can’t reach the internet right now. Try again in a moment?');
  if (reason === 'plus') return t('Telling Kip what to do is a Plus feature.');
  if (reason === 'consent') return t('Kip’s reading is turned off — turn it on in Profile → Privacy & data.');
  if (reason === 'limit') return t('That’s a lot of Kip for one day — I’ll be back tomorrow. You can still log by hand.');
  return t('Kip is busy right now — try again in a moment, or pick one of the choices.');
}

/**
 * Everything a sheet needs for "Tell Kip": the AI permission check, the asking state, and Kip's answer.
 * `run` asks Kip and turns the answer into rows (or returns a reason it can't).
 */
export function useTellKip<P>(run: (text: string) => Promise<{ reply: string; plan: P | null; rows: ChangeRow[] | null } | { error: string }>) {
  const ai = useAiConsent(() => router.push('/privacy-policy'));
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ said: string; reply: string; plan: P | null; rows: ChangeRow[] | null } | null>(null);

  async function ask(text: string) {
    if (!(await ai.ensure())) return;
    setBusy(true);
    const r = await run(text);
    setBusy(false);
    if ('error' in r) return setAnswer({ said: text, reply: r.error, plan: null, rows: null });
    setAnswer({ said: text, ...r });
  }
  return { ask, busy, answer, clear: () => setAnswer(null), consentSheet: ai.sheet };
}

/** "Plus" note under the choices for free users, in place of the box. */
export function TellKipPlus({ onPlus }: { onPlus: () => void }) {
  return (
    <Pressable onPress={onPlus} accessibilityRole="button">
      <Glass radius={22} innerStyle={[styles.box, { paddingVertical: 14 }]}>
        <Text style={[styles.input, { color: colors.muted }]}>
          {rich('Or tell Kip in your own words — **Plus**', undefined, (s) => (
            <Text style={{ color: colors.ink, fontFamily: fonts.semibold }}>{s}</Text>
          ))}
        </Text>
      </Glass>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    box: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 8, paddingVertical: 8 },
    input: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, paddingVertical: 6 },
    round: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    me: { alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: colors.ink, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
    meText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.paper },
    kipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    bub: { padding: 12, paddingHorizontal: 14 },
    say: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
    line: { borderTopWidth: 1, borderTopColor: inkA(0.07) },
    title: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
    from: { fontFamily: fonts.regular, fontSize: 13, color: colors.faint, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
    to: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
    back: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textDecorationLine: 'underline' },
  }),
);
