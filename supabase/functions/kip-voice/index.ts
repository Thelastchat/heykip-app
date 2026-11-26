// Kip's voice: turns one of Kip's replies into speech with Google's Gemini 2.5 Flash TTS (voice Fenrir, the style
// ก้อย picked). Only the reply text is sent to Google — nothing else about the person. Plus only, 15 a day
// (voice_allow, counted on the server). The Google key lives only in this function's secrets (GOOGLE_TTS_KEY).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MODEL = 'gemini-2.5-flash-tts';
const VOICE = 'Fenrir';
const STYLE = 'Speak fast and upbeat, but calm, warm, and welcoming, a smart friend chatting quickly.';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('GOOGLE_TTS_KEY');
    if (!key) return json({ error: 'no key' }, 503);

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

    const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
