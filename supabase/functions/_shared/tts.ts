// Kip's voice, shared by kip (answers and speaks in one call) and kip-voice (older app builds).
// Google Chirp 3 HD, voice Fenrir, a little faster than normal (approved 27 Nov: about 1 s to make, vs 3–5 s for
// Gemini TTS). Only the words Kip is about to say go to Google — nothing else about the person.
// Google sign-in: a service account (GOOGLE_TTS_SA, its JSON key) or an API key (GOOGLE_TTS_KEY), both only in secrets.

const VOICE = 'Chirp3-HD-Fenrir';
const RATE = 1.15;

let token: { value: string; until: number } | null = null;
const b64url = (b: ArrayBuffer | string) =>
  btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b)))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

/** A Google access token from the service account's JSON key (signed here, kept for 50 minutes). */
async function googleToken(sa: { client_email: string; private_key: string }): Promise<string> {
  if (token && token.until > Date.now()) return token.value;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', k, new TextEncoder().encode(`${head}.${claim}`)));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
  });
  const out = await r.json();
  if (!out.access_token) throw new Error(`google token ${r.status} ${JSON.stringify(out).slice(0, 200)}`);
  token = { value: out.access_token, until: Date.now() + 50 * 60_000 };
  return token.value;
}

export const hasVoice = () => !!(Deno.env.get('GOOGLE_TTS_SA') || Deno.env.get('GOOGLE_TTS_KEY'));

/** Sign in ahead of time (runs while Kip is still thinking), so speaking doesn't wait for it. */
export function warmVoice() {
  const raw = Deno.env.get('GOOGLE_TTS_SA');
  if (raw) googleToken(JSON.parse(raw)).catch(() => {});
}

/** Thai or English, from the words (any Thai letter → Thai). */
export const langOf = (text: string): 'th-TH' | 'en-US' => (/[฀-๿]/.test(text) ? 'th-TH' : 'en-US');

/** As it should sound: "฿1,250" → "1,250 บาท" / "1,250 baht", no emoji or quote marks read aloud. */
export function forSpeaking(text: string, lang: 'th-TH' | 'en-US') {
  const unit = lang === 'th-TH' ? 'บาท' : 'baht';
  return text
    .replace(/฿\s?([\d,]+(?:\.\d+)?)/g, `$1 ${unit}`)
    .replace(/([\d,]+(?:\.\d+)?)\s?฿/g, `$1 ${unit}`)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[“”"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

/** Kip saying it: MP3 as base64, or null if Google couldn't (the app then answers in text). */
export async function speak(text: string, lang: 'th-TH' | 'en-US' = langOf(text)): Promise<string | null> {
  const words = forSpeaking(text, lang);
  if (!words) return null;
  const raw = Deno.env.get('GOOGLE_TTS_SA');
  const key = Deno.env.get('GOOGLE_TTS_KEY');
  const sa = raw ? JSON.parse(raw) : null;
  if (!sa && !key) return null;
  const t0 = Date.now();
  const r = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize' + (sa ? '' : `?key=${encodeURIComponent(key!)}`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(sa ? { authorization: `Bearer ${await googleToken(sa)}` } : {}) },
    signal: AbortSignal.timeout(8_000),
    body: JSON.stringify({
      input: { text: words },
      voice: { languageCode: lang, name: `${lang}-${VOICE}` },
      audioConfig: { audioEncoding: 'MP3', speakingRate: RATE },
    }),
  });
  if (!r.ok) {
    console.error('google tts', r.status, (await r.text()).slice(0, 300));
    return null;
  }
  const out = await r.json();
  console.log('tts ms', Date.now() - t0, lang, words.length);
  return typeof out?.audioContent === 'string' ? out.audioContent : null;
}
