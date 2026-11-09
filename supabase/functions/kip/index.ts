// Kip's brain on the server (agent Kip, approved mockup): turns what someone typed (Thai or English) into structured
// data — something to log, a question, a change to their plan, or a fix to something already logged. It never decides
// money: the app does the maths from the person's real plan, shows every number, and only saves on "Do it".
// It remembers the conversation (the last few turns, sent by the app). Plus only.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CATS = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'home_bills', 'travel', 'family_pets', 'giving', 'learning', 'installments', 'other'];
const IN_CATS = ['pay', 'side_gigs', 'gifts', 'other'];
const BUDGET_CATS = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'learning', 'giving', 'other', 'spend_freely'];
const BILL_TYPES = ['rent', 'utilities', 'phone', 'internet', 'streaming', 'fitness', 'insurance', 'loan', 'family', 'other'];
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
      kind: {
        type: 'string',
        enum: ['log', 'buy', 'answer', 'change', 'fix'],
        description:
          'log = they are telling you money they spent and/or money they got (pay, side gigs, gifts); buy = they ask if they can afford something; change = they want to change their plan (move money between budgets, set a budget, add/remove/pay a bill, put fun money toward the goal this month, take money out of the goal, switch money style); fix = they want to delete or correct something already logged (context.recent); answer = any other question. A follow-up like "actually make it 279" refers to the conversation so far: repeat the earlier change or log with the new number.',
      },
      items: {
        type: 'array',
        description: 'kind=log: each amount of money that went out or came in',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'short name in the language they used, e.g. "Chicken rice", "ข้าวมันไก่", "เงินเดือน"' },
            amount: { type: 'number', description: 'always positive' },
            money: { type: 'string', enum: ['out', 'in'], description: 'out = they spent it; in = they received it (salary, freelance, gift, refund, sold something)' },
            category: {
              type: 'string',
              enum: [...new Set([...CATS, ...IN_CATS])],
              description: `money=out: one of ${CATS.join(', ')}. money=in: pay (salary, wages, เงินเดือน), side_gigs (freelance, jobs, งานเสริม, ขายของ), gifts (gift, อั่งเปา, money from family), other (refund, anything else).`,
            },
          },
          required: ['name', 'amount', 'money', 'category'],
        },
      },
      buy: {
        type: 'object',
        description: 'kind=buy',
        properties: { name: { type: 'string' }, amount: { type: 'number' }, category: { type: 'string', enum: CATS } },
        required: ['name', 'amount', 'category'],
      },
      ops: {
        type: 'array',
        description: 'kind=change: the changes, in order',
        items: {
          type: 'object',
          properties: {
            op: {
              type: 'string',
              enum: ['move', 'set', 'add_bill', 'remove_bill', 'pay_bill', 'to_goal', 'take_goal', 'style'],
              description:
                'move = amount from one budget category to another this month; set = a category budget to a new amount; add_bill = a new bill every month (or every year with due_month); remove_bill = delete a bill they added; pay_bill = mark a bill paid this month (rent or one in context.bills); to_goal = move amount from a category (usually fun) to the goal saving this month; take_goal = take money out of the goal’s savings; style = switch money style',
            },
            from: { type: 'string', enum: BUDGET_CATS },
            to: { type: 'string', enum: BUDGET_CATS },
            category: { type: 'string', enum: BUDGET_CATS },
            amount: { type: 'number', description: 'always positive; for a yearly bill, the whole year' },
            name: { type: 'string', description: 'bill name as they said it, e.g. "Netflix", "AIA insurance"' },
            bill_type: { type: 'string', enum: BILL_TYPES },
            due_month: { type: 'number', description: 'add_bill once a year: the month it is due, 1–12 (e.g. "every February" = 2). Leave out for monthly bills.' },
            style: { type: 'string', enum: ['kip', '503020', 'jars', 'savefirst'], description: 'kip = Kip’s plan, 503020 = 50/30/20, jars = jars, savefirst = save first' },
          },
          required: ['op'],
        },
      },
      fixes: {
        type: 'array',
        description: 'kind=fix: which logged items (by ref from context.recent) and what to do',
        items: {
          type: 'object',
          properties: {
            ref: { type: 'string', description: 'the ref of the item in context.recent, e.g. "r3"' },
            op: { type: 'string', enum: ['delete', 'category', 'amount'] },
            category: { type: 'string', enum: CATS },
            amount: { type: 'number' },
          },
          required: ['ref', 'op'],
        },
      },
      reply: {
        type: 'string',
        description:
          'kind=answer: 1–3 short, warm sentences, in their language, using only numbers from the context. Never invent numbers. kind=log/buy: one short friendly line. kind=change/fix: one short line saying what you’ll change ("Here’s what changes:") — the app shows the numbers. If you can’t do what they ask (send or pay money, anything outside this app), use kind=answer and say kindly what you can do.',
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
    const { data: p } = await sb.from('profiles').select('plan, display_name, ai_consent_at, ai_off').eq('id', u.user.id).single();
    if (!p || p.plan === 'free') return json({ error: 'plus' }, 402);
    // Nothing goes to the AI without the person's Allow (PDPA, App Store 5.1.2(i)) or after they turn it off.
    if (!p.ai_consent_at || p.ai_off) return json({ error: 'consent' }, 403);

    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'no key' }, 503);

    const { text, context, history } = await req.json();
    const said = String(text ?? '')
      .slice(0, 500)
      .trim();
    if (!said) return json({ error: 'empty' }, 400);

    // The conversation so far (oldest first), so follow-ups work: at most 6 turns, short.
    const past = (Array.isArray(history) ? history : []).slice(-6).flatMap((h: { me?: unknown; kip?: unknown }) => [
      { role: 'user', content: String(h.me ?? '').slice(0, 300) || '…' },
      { role: 'assistant', content: String(h.kip ?? '').slice(0, 300) || '…' },
    ]);

    const system = [
      'You are Kip, a friendly money buddy in HeyKip, a saving app for young Thais. Short, warm, honest. Never preachy.',
      'Reply in the language the person used (Thai or English); if it is mixed or unclear, use the app language. Amounts are Thai baht.',
      `The app is set to ${(context as { language?: string } | undefined)?.language === 'th' ? 'Thai' : 'English'}. In Thai, sound like a friend texting (casual: ได้เลย, นะ, ไหวมั้ย), never formal (no ท่าน, กรุณา). Kip and HeyKip stay in English letters.`,
      'You only understand what they mean; the app does all money maths. In answers, only use numbers given in the context.',
      'You can change their plan in HeyKip (kind=change) and fix what they logged (kind=fix). You cannot send, transfer or pay real money, or touch their bank: say so kindly if asked.',
      'Thai hints: ข้าว/อาหาร/ชา/กาแฟ → food, วิน/แกร็บ/BTS/รถ → transport, เสื้อ/ช้อปปี้/ลาซาด้า → shopping, หนัง/ปาร์ตี้/เกม → fun. ได้เงิน/เงินเข้า/เงินเดือนออก/รับงาน → money in.',
      `The person's month right now (JSON): ${JSON.stringify(context ?? {}).slice(0, 5000)}`,
    ].join('\n');

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ model: MODEL, max_tokens: 900, system, tools: [tool], tool_choice: { type: 'tool', name: 'kip_reply' }, messages: [...past, { role: 'user', content: said }] }),
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
