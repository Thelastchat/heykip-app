// Kip's brain on the server (agent Kip, approved mockup): turns what someone typed (Thai or English) into structured
// data — something to log, a question, a change to their plan, or a fix to something already logged. It never decides
// money: the app does the maths from the person's real plan, shows every number, and only saves on "Do it".
// It remembers the conversation (the last few turns, sent by the app). Plus only. The thinking itself is in brain.ts.
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { think } from './brain.ts';
import { hasVoice, langOf, speak, warmVoice } from './tts.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: 'not signed in' }, 401);
    // Plus (a trial that has ended is Free), the person's Allow (PDPA, App Store 5.1.2(i)), and today's cap — all
    // decided by the database (kip_allow), which also counts this call. The app can't set any of these itself.
    const gate = await sb.rpc('kip_allow');
    if (gate.error) return json({ error: 'busy' }, 503);
    if (gate.data === 'plus') return json({ error: 'plus' }, 402);
    if (gate.data === 'consent') return json({ error: 'consent' }, 403);
    if (gate.data === 'limit') return json({ error: 'limit' }, 429);

    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'no key' }, 503);

    // speak: newer builds want the answer spoken in this same call (older builds still call kip-voice after).
    const { text, context, history, voice, speak: wantsVoice } = await req.json();
    const thought = await think({ text, context, history, voice: !!voice, key });
    if ('error' in thought) return json({ error: thought.error, detail: thought.detail }, thought.error === 'empty' ? 400 : 502);
    const use = { input: thought.input };

    // Talking out loud (voice=true): this call also speaks the answer, so the app makes one trip, not two (27 Nov).
    // The voice allowance (Plus, 15 a day) is checked and Google is signed in to while Kip is still thinking.
    const speaking = !!voice && !!wantsVoice && hasVoice();
    const voiceGate = speaking ? sb.rpc('voice_allow') : null;
    if (speaking) warmVoice();

    // Speak while the count below is read. voice: audio (base64 MP3) + spoken replies left · limit · off.
    const reply = String((use.input as { reply?: string }).reply ?? '');
    const spoken = (async () => {
      if (!voiceGate || !reply) return undefined;
      const gate = await voiceGate;
      const g = String(gate.data ?? '');
      if (gate.error || !g.startsWith('ok')) return { said: g === 'limit' ? 'limit' : 'off' };
      const audio = await speak(reply, langOf(reply)).catch(() => null);
      return audio ? { audio, left: Number(g.split(':')[1] ?? 0) } : { said: 'off' };
    })();
    // How many Kip messages are left today (Thai time), so the app can say so near the end — never a surprise.
    const [{ data: me }, said2] = await Promise.all([sb.from('profiles').select('ai_day, ai_count').eq('id', u.user.id).single(), spoken]);
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const left = me && me.ai_day === today ? Math.max(0, 50 - Number(me.ai_count)) : 50;
    return json({ ...use.input, left, ...(said2 ? { voice: said2 } : {}) });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
});
