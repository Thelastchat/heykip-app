// Kip's voice for older app builds: turns one of Kip's replies into speech (the voice is in ../_shared/tts.ts).
// Newer builds get the voice inside the kip call itself, which saves a round trip.
// Plus only, 15 a day (voice_allow, counted on the server).
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { hasVoice, speak } from '../_shared/tts.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (!hasVoice()) return json({ error: 'no key' }, 503);
    const { text, lang } = await req.json();
    const words = String(text ?? '').trim();
    if (!words) return json({ error: 'empty' }, 400);

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

    const audio = await speak(words, lang === 'th-TH' ? 'th-TH' : 'en-US');
    return audio ? json({ audio, left }) : json({ error: 'busy' }, 502);
  } catch (e) {
    console.error('kip-voice', e);
    return json({ error: 'busy' }, 500);
  }
});
