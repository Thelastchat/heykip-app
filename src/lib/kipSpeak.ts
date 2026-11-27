// Kip talking back out loud, in his own voice (approved 27 Nov): Google's Chirp 3 HD, voice Fenrir. The kip call
// itself returns the spoken answer (one trip); kip-voice is only used when the server didn't send it (older server).
// Plus only, 15 spoken replies a day. Only the words Kip is about to say go to Google.
// When the voice is used up or can't be reached, Kip simply answers in text (never a robot fallback voice).
import { requireOptionalNativeModule } from 'expo';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { Spoken } from '@/lib/kip';
import { supabase } from '@/lib/supabase';

type AudioLib = typeof import('expo-audio');
type Player = ReturnType<AudioLib['createAudioPlayer']>;

let cached: AudioLib | null | undefined;
function audio(): AudioLib | null {
  if (cached !== undefined) return cached;
  if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoAudio')) return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-audio') as AudioLib;
  } catch {
    cached = null;
  }
  return cached;
}

/** Can this phone play Kip's voice? (No in an older build without the audio part.) */
export const canSpeak = () => audio() != null;

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

/** spoke = Kip said it · limit = today's 15 are used (back at midnight) · off = no voice this time (offline, older build…) */
export type Said = { said: 'spoke' | 'limit' | 'off'; left?: number };

let current: { player: Player; done: () => void } | null = null;
let turn = 0;

/** Say it in Kip's voice. Resolves when he has finished, was cut off, or couldn't speak. */
export async function say(text: string, ready?: Spoken): Promise<Said> {
  const A = audio();
  const lang = langOf(text);
  const words = forSpeaking(text, lang);
  if (!A || !words) return { said: 'off' };
  const mine = ++turn;

  let b64: string | undefined;
  let left: number | undefined;
  if (ready) {
    // Already spoken by the kip call. No audio means used up today, or Google couldn't — then text only.
    if (!ready.audio) return { said: ready.said ?? 'off' };
    b64 = ready.audio;
    left = ready.left;
  } else {
    const { data, error } = await supabase.functions.invoke('kip-voice', { body: { text: words, lang } });
    if (error) return { said: (error as { context?: { status?: number } }).context?.status === 429 ? 'limit' : 'off' };
    b64 = (data as { audio?: string } | null)?.audio;
    left = (data as { left?: number } | null)?.left;
  }
  if (!b64 || mine !== turn) return { said: 'off', left }; // cut off while the voice was being made

  let uri = `data:audio/mpeg;base64,${b64}`;
  let file: { delete: () => void } | null = null;
  if (Platform.OS !== 'web') {
    // iPhone's player wants a real file: a throwaway one in the cache.
    const f = new File(Paths.cache, `kip-${mine}.mp3`);
    f.create({ overwrite: true });
    await f.write(b64, { encoding: 'base64' });
    uri = f.uri;
    file = f;
  }

  // Loud through the speaker even right after the mic was listening; other audio ducks while Kip talks.
  await A.setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'duckOthers' }).catch(() => {});
  await new Promise<void>((resolve) => {
    const player = A.createAudioPlayer({ uri });
    let ended = false;
    const done = () => {
      if (ended) return;
      ended = true;
      sub.remove();
      try {
        player.remove();
      } catch {}
      try {
        file?.delete();
      } catch {}
      if (current?.player === player) current = null;
      resolve();
    };
    const sub = player.addListener('playbackStatusUpdate', (s) => s.didJustFinish && done());
    current = { player, done };
    player.play();
    setTimeout(done, 30_000); // never wait forever
  });
  return { said: 'spoke', left };
}

/** Stop Kip mid-sentence (they tapped him, or left). */
export function hush() {
  turn++;
  const c = current;
  if (!c) return;
  try {
    c.player.pause();
  } catch {}
  c.done();
}
