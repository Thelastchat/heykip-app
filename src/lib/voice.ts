// Talking to Kip out loud: Apple's / Google's own speech recognition, on the phone, Thai or English.
// The native piece isn't inside Expo Go, so it's loaded carefully: in Expo Go `voiceModule()` is null and
// the app falls back to typing (the keyboard's own mic still works there).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;
export type VoiceLang = 'th-TH' | 'en-US';

let cached: SpeechModule | null | undefined;
export function voiceModule(): SpeechModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-speech-recognition').ExpoSpeechRecognitionModule as SpeechModule;
    cached = m && m.isRecognitionAvailable() ? m : null;
  } catch {
    cached = null; // Expo Go: the native module isn't there
  }
  return cached;
}

/** Thai phone → listen in Thai first; anything else → English. They can switch on the listening screen. */
export function defaultVoiceLang(): VoiceLang {
  try {
    return getLocales()[0]?.languageCode === 'th' ? 'th-TH' : 'en-US';
  } catch {
    return 'en-US';
  }
}

const LANG_KEY = 'heykip.voiceLang';
/** The language they last talked in wins over the phone's language. */
export async function savedVoiceLang(): Promise<VoiceLang | null> {
  try {
    const v = await AsyncStorage.getItem(LANG_KEY);
    return v === 'th-TH' || v === 'en-US' ? v : null;
  } catch {
    return null;
  }
}
export function saveVoiceLang(l: VoiceLang) {
  AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
}

export type VoiceState = 'idle' | 'starting' | 'listening' | 'finishing';
export type VoiceProblem = 'denied' | 'unavailable' | 'nothing' | 'failed';

/**
 * One listening session. `text` updates live while they speak; `finish()` stops listening and resolves with
 * everything heard. `cancel()` throws it away. If the phone stops listening by itself (silence, an error),
 * `onStoppedByItself` gets whatever was heard.
 */
export function useVoice(onStoppedByItself: (heard: string) => void) {
  const stoppedByItself = useRef(onStoppedByItself);
  useEffect(() => {
    stoppedByItself.current = onStoppedByItself;
  }, [onStoppedByItself]);
  const [state, setState] = useState<VoiceState>('idle');
  const [text, setText] = useState('');
  const [level, setLevel] = useState(0); // 0–1, how loud right now
  const heard = useRef('');
  const done = useRef<((t: string) => void) | null>(null);
  const subs = useRef<{ remove: () => void }[]>([]);

  const clear = useCallback(() => {
    subs.current.forEach((s) => s.remove());
    subs.current = [];
  }, []);
  useEffect(
    () => () => {
      clear();
      voiceModule()?.abort();
    },
    [clear],
  );

  const settle = useCallback(() => {
    clear();
    setState('idle');
    setLevel(0);
    const r = done.current;
    done.current = null;
    if (r) r(heard.current.trim());
    else stoppedByItself.current(heard.current.trim());
  }, [clear]);

  /** Start listening. Returns a problem if it can't. */
  const start = useCallback(
    async (lang: VoiceLang): Promise<VoiceProblem | null> => {
      const m = voiceModule();
      if (!m) return 'unavailable';
      const perm = await m.requestPermissionsAsync();
      if (!perm.granted) return 'denied';
      clear();
      heard.current = '';
      setText('');
      setState('starting');
      subs.current = [
        m.addListener('start', () => setState('listening')),
        m.addListener('result', (e) => {
          const t = e.results[0]?.transcript ?? '';
          heard.current = t;
          setText(t);
        }),
        m.addListener('volumechange', (e) => setLevel(Math.max(0, Math.min(1, e.value / 10)))),
        m.addListener('error', () => settle()),
        m.addListener('end', () => settle()),
      ];
      m.start({ lang, interimResults: true, continuous: true, addsPunctuation: false, volumeChangeEventOptions: { enabled: true, intervalMillis: 120 } });
      return null;
    },
    [clear, settle],
  );

  /** Stop and get what was said. */
  const finish = useCallback(() => {
    const m = voiceModule();
    if (!m || state === 'idle') return Promise.resolve(heard.current.trim());
    setState('finishing');
    return new Promise<string>((resolve) => {
      done.current = resolve;
      m.stop();
      setTimeout(() => done.current && settle(), 2500); // never hang if the phone doesn't answer
    });
  }, [state, settle]);

  const cancel = useCallback(() => {
    done.current = null;
    clear();
    voiceModule()?.abort();
    heard.current = '';
    setText('');
    setLevel(0);
    setState('idle');
  }, [clear]);

  return { state, text, level, start, finish, cancel };
}
