// Reads one bank transfer slip (a screenshot from any Thai bank app) and returns its numbers.
// The image is only passed to the model and never stored. The app shows everything for the person to check before saving.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const OUT = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'home_bills', 'travel', 'family_pets', 'giving', 'learning', 'installments', 'other'];
const IN = ['pay', 'side_gigs', 'gifts', 'other'];
const MODEL = 'claude-haiku-5-5';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const tool = {
  name: 'slip',
  description: 'What the slip says. If the image is not a money transfer / payment slip or receipt, set is_slip=false and leave the rest empty.',
  input_schema: {
    type: 'object',
    properties: {
      is_slip: { type: 'boolean' },
      money: {
        type: 'string',
        enum: ['out', 'in'],
        description: 'out = the phone owner paid/transferred money; in = the phone owner received it. Use the owner hint if given; otherwise a normal transfer slip from the owner’s app is "out".',
      },
      amount: { type: 'number', description: 'the transferred amount in baht (not the fee, not the balance)' },
      name: { type: 'string', description: 'for out: who was paid (shop or person name exactly as on the slip, e.g. "ร้านข้าวมันไก่ป้าแดง", "Shopee"); for in: who sent it' },
      when: {
        type: 'string',
        description: 'date and time on the slip as YYYY-MM-DDTHH:mm in Thai local time, Gregorian year. Thai slips often use Buddhist years: 2569 or 69 means 2026 (subtract 543).',
      },
      ref: { type: 'string', description: 'the transaction reference / เลขที่รายการ / รหัสอ้างอิง exactly as printed; empty if none' },
      bank: { type: 'string', description: 'the bank or wallet app name if visible, e.g. "K PLUS", "SCB", "TrueMoney"' },
      category: {
        type: 'string',
        enum: [...new Set([...OUT, ...IN])],
        description: `money=out: one of ${OUT.join(', ')} (guess from the payee: restaurants/cafés/7-Eleven food → food, Grab/Bolt/BTS/fuel → transport, Shopee/Lazada/clothes → shopping, cinema/games/bars → fun, pharmacy/salon → health_beauty, rent/electricity/water/phone/internet → home_bills, a person’s name with no clue → other). money=in: pay, side_gigs, gifts or other.`,
      },
    },
    required: ['is_slip'],
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: 'not signed in' }, 401);
    const { data: p } = await sb.from('profiles').select('plan, display_name, ai_consent_at, ai_off').eq('id', u.user.id).single();
    if (!p || p.plan === 'free') return json({ error: 'plus' }, 402);
    // Nothing goes to the AI without the person's Allow (PDPA, App Store 5.1.2(i)) or after they turn it off.
    if (!p.ai_consent_at || p.ai_off) return json({ error: 'consent' }, 403);
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'no key' }, 503);

    const { image, mediaType, today } = await req.json();
    if (typeof image !== 'string' || image.length < 100) return json({ error: 'no image' }, 400);
    if (image.length > 7_000_000) return json({ error: 'too big' }, 413);
    const type = ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg';

    const owner = p.display_name ? `The phone owner is called "${p.display_name}" — if the slip shows money going TO this name, it is money in.` : '';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: `You read Thai bank transfer slips and payment receipts exactly. Never guess numbers you cannot see. Today is ${String(today ?? '').slice(0, 10)} in Thailand. ${owner}`,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'slip' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: type, data: image } },
              { type: 'text', text: 'Read this slip.' },
            ],
          },
        ],
      }),
    });
    if (!r.ok) return json({ error: 'busy', detail: (await r.text()).slice(0, 300) }, 502);
    const out = await r.json();
    const use = (out.content ?? []).find((c: { type: string }) => c.type === 'tool_use');
    if (!use) return json({ error: 'no reply' }, 502);
    return json(use.input);
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
});
