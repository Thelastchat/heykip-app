// Kip's voice: turns one of Kip's replies into speech with Google's Gemini 2.5 Flash TTS (voice Fenrir, the style
// ก้อย picked). Only the reply text is sent to Google — nothing else about the person. Plus only, 15 a day
// (voice_allow, counted on the server). Google sign-in: a service account (GOOGLE_TTS_SA, its JSON key) or an API key
// (GOOGLE_TTS_KEY) — both live only in this function's secrets.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MODEL = 'gemini-2.5-flash-tts';
const VOICE = 'Fenrir';
const STYLE = 'Speak fast and upbeat, but calm, warm, and welcoming, a smart friend chatting quickly.';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// A Google access token from the service account's JSON key (signed here, kept for 50 minutes).
let token: { value: string; until: number } | null = null;
const b64url = (b: ArrayBuffer | string) =>
  btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b)))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('GOOGLE_TTS_KEY');
    const saRaw = Deno.env.get('GOOGLE_TTS_SA');
    if (!key && !saRaw) return json({ error: 'no key' }, 503);

    const { text, lang } = await req.json();
    const words = String(text ?? '')
      .slice(0, 400)
      .trim();
    if (!words) return json({ error: 'empty' }, 400);
    const languageCode = lang === 'th-TH' ? 'th-TH' : 'en-US';

    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: 'not signed in' }, 401);
    const gate = await sb.rpc('voice_allow');
    if (gate.error) return json({ error: 'busy' }, 503);
    const g = String(gate.data ?? '');
    if (g === 'plus') return json({ error: 'plus' }, 402);
    if (g === 'consent') return json({ error: 'consent' }, 403);
    if (g === 'limit') return json({ error: 'limit', left: 0 }, 429);
    const left = Number(g.split(':')[1] ?? 0);

    const sa = saRaw ? JSON.parse(saRaw) : null;
    const url = 'https://texttospeech.googleapis.com/v1/text:synthesize' + (sa ? '' : `?key=${encodeURIComponent(key!)}`);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(sa ? { authorization: `Bearer ${await googleToken(sa)}` } : {}) },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        input: { prompt: STYLE, text: words },
        voice: { languageCode, name: VOICE, modelName: MODEL },
        audioConfig: { audioEncoding: 'MP3' },
      }),
    });
    if (!r.ok) {
      console.error('google tts', r.status, (await r.text()).slice(0, 500));
      return json({ error: 'busy' }, 502);
    }
    const out = await r.json();
    if (!out?.audioContent) return json({ error: 'busy' }, 502);
    return json({ audio: out.audioContent, left });
  } catch (e) {
    console.error('kip-voice', e);
    return json({ error: 'busy' }, 500);
  }
});
