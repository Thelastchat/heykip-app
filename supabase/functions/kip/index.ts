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

const CAT_NAMES =
  'Category names: each key is a row the person sees on screen (English / Thai), and they may say any part of its name, in either language, with or without "&", plural or misspelt: food = "Food & drinks" / "อาหารและเครื่องดื่ม" (food, drinks, eating, meals, coffee, ข้าว, กิน); transport = "Transport" / "เดินทาง" (getting around, BTS, MRT, Grab, bike taxi, รถ, วิน); shopping = "Shopping" / "ช้อปปิ้ง" (clothes, gadgets, online, ช้อป); fun = "Fun" / "เที่ยวเล่น" (going out, movies, parties, เที่ยว); health_beauty = "Health & beauty" / "สุขภาพและความงาม" (health, beauty, pharmacy, haircut, skincare, สุขภาพ, ความงาม); learning = "Learning" / "เรียนรู้" (courses, books, เรียน); giving = "Giving" / "ให้คนอื่น" (gifts, donations, ทำบุญ); other = "Household & other" / "ของใช้ในบ้านและอื่นๆ" (household, home, laundry, small things, other, ของใช้, ในบ้าน, อื่นๆ); spend_freely = "Spend freely" / "ใช้ได้อิสระ". Match what they said to the key yourself. Never say a category does not exist or is not in the plan when what they said fits one of these names. Only when it truly fits none (or two equally), ask which one, naming the categories the way the app shows them (never keys like health_beauty or spend_freely).';

// The person's own categories ("Create your own"), sent by the app. Only `c_` keys with a name are used, at most 8.
type Own = { key: string; name: string; need: boolean };
function ownCats(...lists: unknown[]): Own[] {
  const seen = new Map<string, Own>();
  for (const list of lists)
    for (const c of Array.isArray(list) ? list : []) {
      const k = (c as { key?: unknown })?.key;
      const n = (c as { name?: unknown })?.name;
      if (typeof k === 'string' && /^c_[a-z0-9]{2,12}$/.test(k) && typeof n === 'string' && n.trim() && !seen.has(k))
        seen.set(k, { key: k, name: n.trim().slice(0, 24), need: !!(c as { need?: unknown }).need });
    }
  return [...seen.values()].slice(0, 8);
}
const ownLine = (own: Own[]) =>
  own.length
    ? `The person's own categories (they made these; use the key when what they said or paid for fits one, and prefer it over a built-in category that fits less well — e.g. an album for an own "K-pop"): ${own.map((o) => `${o.key} = ${JSON.stringify(o.name)} (${o.need ? 'a need' : 'a want'})`).join('; ')}.`
    : '';
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
        enum: ['log', 'buy', 'answer', 'change', 'fix', 'slips'],
        description:
          'log = they are telling you money they spent and/or money they got (pay, side gigs, gifts); buy = they ask if they can afford something; change = they want to change their plan (move money between budgets, set a budget, add/remove/pay a bill, put fun money toward the goal this month, take money out of the goal); fix = they want to delete or correct something already logged (context.recent); slips = they ask you to read, find, check or log their bank slips / สลิป for some days; answer = any other question. A follow-up like "actually make it 279" refers to the conversation so far: repeat the earlier change or log with the new number.',
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
              enum: ['move', 'set', 'add_bill', 'remove_bill', 'pay_bill', 'to_goal', 'take_goal', 'set_due'],
              description:
                'move = amount from one budget category to another this month; set = a category budget to a new amount; add_bill = a new bill every month (or every year with due_month); remove_bill = delete a bill they added; pay_bill = mark a bill paid this month (rent or one in context.bills); to_goal = move amount from a category (usually fun) to the goal saving this month; take_goal = take money out of the goal’s savings; set_due = set the day of the month a bill (or rent) is due, e.g. "Netflix is on the 18th"',
            },
            from: { type: 'string', enum: BUDGET_CATS },
            to: { type: 'string', enum: BUDGET_CATS },
            category: { type: 'string', enum: BUDGET_CATS },
            amount: { type: 'number', description: 'always positive; for a yearly bill, the whole year' },
            name: { type: 'string', description: 'bill name as they said it, e.g. "Netflix", "AIA insurance"' },
            bill_type: { type: 'string', enum: BILL_TYPES },
            due_month: { type: 'number', description: 'add_bill once a year: the month it is due, 1–12 (e.g. "every February" = 2). Leave out for monthly bills.' },
            day: { type: 'number', description: 'set_due, or add_bill when they say it: the day of the month it is due, 1–31' },
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
      slips: {
        type: 'object',
        description:
          'kind=slips: which days, as YYYY-MM-DD in Thai time, both included. "this month" = context.payMonthStart to context.today; "November" = 1–30 Nov (never after today); "since payday" = context.payMonthStart; "last week" = the 7 days before today; nothing said = context.payMonthStart to today.',
        properties: { from: { type: 'string' }, to: { type: 'string' } },
        required: ['from', 'to'],
      },
      reply: {
        type: 'string',
        description:
          'kind=answer: 1–3 short, warm sentences, in their language, using only numbers from the context. Never invent numbers. kind=log/buy: one short friendly line. kind=change/fix: one short line saying what you’ll change ("Here’s what changes:") — the app shows the numbers. kind=slips: one short line ("Sure — I’ll look through your bank albums for 1–26 Nov."); the app finds and shows the slips. If you can’t do what they ask (send or pay money, anything outside this app), use kind=answer and say kindly what you can do.',
      },
    },
    required: ['kind', 'reply'],
  },
};

// How Kip talks (approved): lift people up, never about investing, and by their saving plan.
const VOICE = [
  'Tone: warm, encouraging, never shaming or preachy. Money is stressful; people often come to you frustrated. When they went over, name the fix, not the fault ("a big day — that happens; here is how it spreads"). When they did well, say so plainly. Never lecture, never moralise, never call spending "bad". Celebrate small wins (a day under, a bill ticked, money that went to saving).',
  'Investing: you NEVER recommend what to invest in. No stocks, funds, bonds, crypto, gold, insurance products, savings accounts or any bank or product by name, and never "buy", "invest in" or "put it in X". That is a licensed advisor\'s job (SEC-licensed in Thailand); if asked, say so kindly in one line, then help with what you can: making more money available to save inside HeyKip, and general ideas (an emergency fund, saving on payday, spending less than you earn). General money education is fine; a product or a pick is not.',
  "Saving plan: there is one plan, Kip's plan: saving first (goal + safety net), then rent and bills, then living (food, transport, health, household) sized to real Thai costs, then fun and shopping; a lowered budget gives its money to the goal. HeyKip has no money styles to switch between (no 50/30/20, 6 Jars or Save first): if asked, say so kindly and offer to change amounts instead (kind=change).",
];

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

    const { text, context, history, voice } = await req.json();
    const own = ownCats((context as { own?: unknown } | undefined)?.own, (context as { categories?: unknown } | undefined)?.categories);
    // Their own categories join the lists Kip may pick from.
    const kipTool = JSON.parse(JSON.stringify(tool));
    if (own.length) {
      const P = kipTool.input_schema.properties;
      const keys = own.map((o) => o.key);
      P.items.items.properties.category.enum.push(...keys);
      P.buy.properties.category.enum.push(...keys);
      P.fixes.items.properties.category.enum.push(...keys);
      for (const f of ['from', 'to', 'category']) P.ops.items.properties[f].enum.push(...keys);
    }
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
      ...VOICE,
      'Reply in the language the person used (Thai or English); if it is mixed or unclear, use the app language. Amounts are Thai baht.',
      `The app is set to ${(context as { language?: string } | undefined)?.language === 'th' ? 'Thai' : 'English'}. In Thai, sound like a friend texting (casual: ได้เลย, นะ, ไหวมั้ย), never formal (no ท่าน, กรุณา). Kip and HeyKip stay in English letters.`,
      'You only understand what they mean; the app does all money maths. In answers, only use numbers given in the context.',
      'You can change their plan in HeyKip (kind=change) and fix what they logged (kind=fix). You cannot send, transfer or pay real money, or touch their bank: say so kindly if asked.',
      'You CAN read their bank slips: the app looks only in the bank albums they chose on this phone (K PLUS, SCB…), reads each slip and lets them check it before saving. When they ask about their slips for any days, use kind=slips. Never say you cannot read slips. One slip at a time from a photo they pick also works on the + screen (Slip).',
      'Only kind=change and kind=fix change anything, and only after they tap Do it. In kind=answer never say you changed, set, saved or updated something. If they ask for something you have no change for (e.g. a fixed daily limit), say what you can do instead.',
      'What you know besides the month: context.dueDays (each bill with a due day, dueIn = days from today, below 0 = late and unpaid), context.lastMonths (the last pay months: spent, by category, most often logged — answer "what did I spend most on" from these, never guess), context.noticed (subscriptions = repeat payments the app found that are not bills yet: offer add_bill with their name, amount and day; priceChanges and stopped = bills to mention when relevant). A bill is only "due" if it is in dueDays; if it has no day, say you do not know and offer set_due.',
      CAT_NAMES,
      ownLine(own),
      'Thai hints: ข้าว/อาหาร/ชา/กาแฟ → food, วิน/แกร็บ/BTS/รถ → transport, เสื้อ/ช้อปปี้/ลาซาด้า → shopping, หนัง/ปาร์ตี้/เกม → fun. ได้เงิน/เงินเข้า/เงินเดือนออก/รับงาน → money in.',
      voice
        ? 'They are TALKING to you out loud and you answer out loud: reply must be ONE or TWO short spoken sentences (under 25 words, under about 80 Thai characters), plain words, no lists, no emoji, no symbols. Say only the key number.'
        : '',
      `The person's month right now (JSON): ${JSON.stringify(context ?? {}).slice(0, 8000)}`,
    ].join('\n');

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ model: MODEL, max_tokens: 900, system, tools: [kipTool], tool_choice: { type: 'tool', name: 'kip_reply' }, messages: [...past, { role: 'user', content: said }] }),
    });
    if (!r.ok) return json({ error: 'kip is busy', detail: (await r.text()).slice(0, 300) }, 502);
    const out = await r.json();
    const use = (out.content ?? []).find((c: { type: string }) => c.type === 'tool_use');
    if (!use) return json({ error: 'no reply' }, 502);
    // How many Kip messages are left today (Thai time), so the app can say so near the end — never a surprise.
    const { data: me } = await sb.from('profiles').select('ai_day, ai_count').eq('id', u.user.id).single();
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const left = me && me.ai_day === today ? Math.max(0, 50 - Number(me.ai_count)) : 50;
    return json({ ...use.input, left });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
});
