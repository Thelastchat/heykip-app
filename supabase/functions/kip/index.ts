// Kip's brain on the server: turns what someone typed (Thai or English) into structured data.
// It never decides money — the app does the maths from the person's real plan. Plus only.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CATS = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'home_bills', 'travel', 'family_pets', 'giving', 'learning', 'installments', 'other'];
const MODEL = 'claude-haiku-5-5';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const tool = {
  name: 'kip_reply',
  description: 'Reply to the person. Pick exactly one kind.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['log', 'buy', 'answer'], description: 'log = they are telling you what they spent; buy = they ask if they can afford something; answer = any other question' },
      items: {
        type: 'array',
        description: 'kind=log: each thing they spent money on',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'short name in the language they used, e.g. "Chicken rice" or "ข้าวมันไก่"' },
            amount: { type: 'number' },
            category: { type: 'string', enum: CATS },
          },
          required: ['name', 'amount', 'category'],
        },
      },
      buy: {
        type: 'object',
        description: 'kind=buy',
        properties: { name: { type: 'string' }, amount: { type: 'number' }, category: { type: 'string', enum: CATS } },
        required: ['name', 'amount', 'category'],
      },
      reply: {
        type: 'string',
        description: 'kind=answer: 1–3 short, warm sentences, in their language, using only numbers from the context. Never invent numbers. kind=log/buy: one short friendly line.',
      },
    },
    required: ['kind', 'reply'],
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: 'not signed in' }, 401);
    const { data: p } = await sb.from('profiles').select('plan, display_name').eq('id', u.user.id).single();
    if (!p || p.plan === 'free') return json({ error: 'plus' }, 402);

    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'no key' }, 503);

    const { text, context } = await req.json();
    const said = String(text ?? '')
      .slice(0, 500)
      .trim();
    if (!said) return json({ error: 'empty' }, 400);

    const system = [
      'You are Kip, a friendly money buddy in HeyKip, a saving app for young Thais. Short, warm, honest. Never preachy.',
      'Reply in the language the person used (Thai or English). Amounts are Thai baht.',
      'You only understand what they mean; the app does all money maths. In answers, only use numbers given in the context.',
      'Thai hints: ข้าว/อาหาร/ชา/กาแฟ → food, วิน/แกร็บ/BTS/รถ → transport, เสื้อ/ช้อปปี้/ลาซาด้า → shopping, หนัง/ปาร์ตี้/เกม → fun.',
      `The person's month right now (JSON): ${JSON.stringify(context ?? {}).slice(0, 3000)}`,
    ].join('\n');

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, system, tools: [tool], tool_choice: { type: 'tool', name: 'kip_reply' }, messages: [{ role: 'user', content: said }] }),
    });
    if (!r.ok) return json({ error: 'kip is busy', detail: (await r.text()).slice(0, 300) }, 502);
    const out = await r.json();
    const use = (out.content ?? []).find((c: { type: string }) => c.type === 'tool_use');
    if (!use) return json({ error: 'no reply' }, 502);
    return json(use.input);
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
});
