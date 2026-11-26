// Kip talking back out loud: the phone's own voices (Apple's on iPhone), Thai or English. Free, instant, and nothing
// Kip says leaves the phone to be spoken. Kip picks the best voice the phone has for the language (Enhanced when the
// person has downloaded one in Settings → Accessibility → Spoken Content).
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type SpeechModule = typeof import('expo-speech');

let cached: SpeechModule | null | undefined;
function speech(): SpeechModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeech')) return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-speech') as SpeechModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** Can this phone speak? (No in an older build without the voice part.) */
export const canSpeak = () => speech() != null;

const best: Partial<Record<string, string | null>> = {};
async function voiceFor(lang: string): Promise<string | undefined> {
  if (lang in best) return best[lang] ?? undefined;
  const s = speech();
  try {
    const all = (await s?.getAvailableVoicesAsync()) ?? [];
    const mine = all.filter((v) => v.language?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    const exact = mine.filter((v) => v.language === lang);
    const pool = exact.length ? exact : mine;
    best[lang] = (pool.find((v) => v.quality === 'Enhanced') ?? pool[0])?.identifier ?? null;
  } catch {
    best[lang] = null;
  }
  return best[lang] ?? undefined;
}

/** Thai or English, from what Kip wrote (any Thai letter → Thai). */
export function langOf(text: string): 'th-TH' | 'en-US' {
  return /[฀-๿]/.test(text) ? 'th-TH' : 'en-US';
}

/** What Kip wrote, as it should sound: "฿1,250" → "1,250 บาท" / "1,250 baht", no emoji or symbols read aloud. */
export function forSpeaking(text: string, lang: 'th-TH' | 'en-US') {
  const unit = lang === 'th-TH' ? 'บาท' : 'baht';
  return text
    .replace(/฿\s?([\d,]+(?:\.\d+)?)/g, `$1 ${unit}`)
    .replace(/([\d,]+(?:\.\d+)?)\s?฿/g, `$1 ${unit}`)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[“”"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Say it. Resolves when Kip has finished (or was stopped, or the phone couldn't). */
export async function say(text: string): Promise<void> {
  const s = speech();
  const lang = langOf(text);
  const words = forSpeaking(text, lang);
  if (!s || !words) return;
  const voice = await voiceFor(lang);
  await new Promise<void>((done) => {
    // Its own audio session, so Kip is loud through the speaker even right after the mic was listening.
    s.speak(words, { language: lang, voice, rate: lang === 'th-TH' ? 1 : 1.02, pitch: 1.08, useApplicationAudioSession: false, onDone: done, onStopped: done, onError: () => done() });
  });
}

/** Stop Kip mid-sentence (they tapped him, or left). */
export function hush() {
  speech()
    ?.stop()
    .catch(() => {});
}
