// "Tell Kip…" inside a sheet: turns what someone says (Thai or English) into ONE change to their plan, for one of
// three jobs — giving extra money a job, covering a day that ran over, or changing the month. Kip only proposes;
// the app checks every number and the person taps "Do it". Anything off-topic gets ok=false and a short reply.
// Plus only, and only with the person's AI permission.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MODEL = 'claude-haiku-5-5';
const CATS = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'learning', 'giving', 'other', 'spend_freely'];

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

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ok = { type: 'boolean', description: 'false when the request is not about this job (or impossible) — then explain what you can do in reply' };
const reply = { type: 'string', description: '1–2 short, warm sentences in their language: what the change does. No numbers that are not in the context or the change.' };

const TOOLS: Record<string, object> = {
  extra: {
    name: 'split',
    description: 'Split the extra money between the allowed jobs. Amounts must add up to exactly the extra amount.',
    input_schema: {
      type: 'object',
      properties: {
        ok,
        reply,
        parts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              to: {
                type: 'string',
                enum: ['goal', 'safety', 'spend', 'category'],
                description: 'goal = one of their goals; safety = safety net; spend = this month’s spending money in general; category = this month’s budget for one category',
              },
              goal_id: { type: 'string', description: 'to=goal: the id from context.goals' },
              category: { type: 'string', enum: CATS, description: 'to=category: which one (e.g. shabu, movies, bars → fun; clothes → shopping; meals → food)' },
              amount: { type: 'number' },
            },
            required: ['to', 'amount'],
          },
        },
      },
      required: ['ok', 'reply'],
    },
  },
  over: {
    name: 'cover',
    description: 'How to pay for the amount over today. days + goal + safety must add up to exactly context.over.',
    input_schema: {
      type: 'object',
      properties: {
        ok,
        reply,
        days: { type: 'number', description: 'spread over the days left until payday (each day gets a little less)' },
        goal: { type: 'number', description: 'take from this month’s goal saving (every day stays the same; the goal may arrive a bit later)' },
        safety: { type: 'number', description: 'take from the safety net' },
      },
      required: ['ok', 'reply'],
    },
  },
  recap: {
    name: 'recap',
    description: 'The payday recap: what you noticed, and which of the given suggestions to show.',
    input_schema: {
      type: 'object',
      properties: {
        ok,
        reply: {
          type: 'string',
          description:
            '“Kip noticed”: 2–3 short, warm sentences in their language about a pattern in last month — e.g. weekdays vs weekends, what they bought most often, which budget had room. Only numbers from the context. Do not repeat the totals already shown (spent, plan, left).',
        },
        picks: {
          type: 'array',
          description: 'Up to 3 of context.suggestions, most useful first. Use their ids exactly; never make one up.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string', description: 'a short friendly title, max 40 characters, e.g. “Give lunches what they really cost”' },
              why: { type: 'string', description: 'one short reason, max 80 characters, numbers only from the context' },
            },
            required: ['id', 'title', 'why'],
          },
        },
      },
      required: ['ok', 'reply'],
    },
  },
  month: {
    name: 'change',
    description: 'Changes to this month’s plan. Only categories and bills in the context.',
    input_schema: {
      type: 'object',
      properties: {
        ok,
        reply,
        ops: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              op: {
                type: 'string',
                enum: ['move', 'set', 'add_bill', 'remove_bill'],
                description: 'move = amount from one category to another; set = a category budget to a new amount; add_bill = a new monthly bill; remove_bill = delete a bill they added',
              },
              from: { type: 'string', enum: CATS },
              to: { type: 'string', enum: CATS },
              category: { type: 'string', enum: CATS },
              amount: { type: 'number' },
              name: { type: 'string', description: 'bill name as they said it, e.g. "Netflix"' },
            },
            required: ['op'],
          },
        },
      },
      required: ['ok', 'reply'],
    },
  },
  sort: {
    name: 'sort',
    description: 'Which of context.items belong in the person’s new category (context.category). Only items that clearly fit; none is fine.',
    input_schema: {
      type: 'object',
      properties: {
        ok,
        reply,
        refs: { type: 'array', items: { type: 'string' }, description: 'the refs (e.g. "r3") of the items that fit, from context.items only' },
      },
      required: ['ok', 'reply'],
    },
  },
};

const JOB: Record<string, string> = {
  sort:
    'The person just made their own category (context.category: its name and whether it is a need). Pick which of this month’s spending (context.items: what it was, amount, its current category) clearly belongs in it, by meaning, in Thai or English — e.g. for "K-pop": albums, photocards, lightsticks, fan meetings, Weverse; for "Cat food": Whiskas, cat litter, ทรายแมว. Leave out anything unsure. ok=true with the refs (an empty list is fine).',
  recap:
    'It is payday. You are writing the person’s recap of the pay month that just ended (context: their real numbers, already worked out by the app). Notice one or two useful patterns and pick which suggestions to show. You cannot change anything yourself; the app shows each suggestion with its exact numbers and a Do it button.',
  extra:
    'The person just got extra money (context.extra baht) and is telling you what to do with it. You can ONLY split it between: their goals (context.goals), the safety net (if context.safety is true), this month’s spending money, or one spending category this month. You cannot buy, invest, transfer, pay anyone, or do anything else — for that, ok=false and say what you can do.',
  over: 'The person spent more than today’s money (context.over baht over). They tell you how to pay for it. You can ONLY: spread it over the days left (days), take it from this month’s goal saving (goal, at most context.goal_saving), or from the safety net (safety, at most context.safety_saved). "Take it from fun/shopping" is not possible because today’s money already includes those — say so kindly and suggest spreading it or the goal saving (ok=false).',
  month:
    'The person is changing this month’s plan (context.month: categories with amounts, bills). You can ONLY move money between categories, set a category, add a monthly bill, or remove a bill they added. Saving for the goal and rent are not changed here. Anything else: ok=false.',
};

// How Kip talks (approved): lift people up, never about investing, and by their saving plan.
const VOICE = [
  'Tone: warm, encouraging, never shaming or preachy. Money is stressful; people often come to you frustrated. When they went over, name the fix, not the fault ("a big day — that happens; here is how it spreads"). When they did well, say so plainly. Never lecture, never moralise, never call spending "bad". Celebrate small wins (a day under, a bill ticked, money that went to saving).',
  'Investing: you NEVER recommend what to invest in. No stocks, funds, bonds, crypto, gold, insurance products, savings accounts or any bank or product by name, and never "buy", "invest in" or "put it in X". That is a licensed advisor\'s job (SEC-licensed in Thailand); if asked, say so kindly in one line, then help with what you can: making more money available to save inside HeyKip, and general ideas (an emergency fund, saving on payday, spending less than you earn). General money education is fine; a product or a pick is not.',
  'Saving plan: there is one plan, Kip\'s plan: saving first (goal + safety net), then rent and bills, then living (food, transport, health, household) sized to real Thai costs, then fun and shopping; a lowered budget gives its money to the goal. HeyKip has no money styles to switch between (no 50/30/20, 6 Jars or Save first).',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
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

    const { task, text, context } = await req.json();
    const base = TOOLS[task as string];
    const ctx = (context ?? {}) as { own?: unknown; categories?: unknown; month?: { categories?: unknown } };
    const own = ownCats(ctx.own, ctx.categories, ctx.month?.categories);
    // Their own categories join the lists Kip may pick from.
    const tool = base && own.length ? JSON.parse(JSON.stringify(base)) : base;
    if (base && own.length) {
      const keys = own.map((o) => o.key);
      const P = tool.input_schema.properties;
      if (task === 'extra') P.parts.items.properties.category.enum.push(...keys);
      if (task === 'month') for (const f of ['from', 'to', 'category']) P.ops.items.properties[f].enum.push(...keys);
    }
    if (!tool || typeof text !== 'string' || !text.trim()) return json({ error: 'bad request' }, 400);
    const thai = (context as { language?: string } | undefined)?.language === 'th';

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: [
          'You are Kip, a friendly money buddy inside the HeyKip app. Amounts are Thai baht.',
          ...VOICE,
          JOB[task as string],
          CAT_NAMES,
          ownLine(own),
          'Use only numbers from the context or that the person said. "half" = 50%, "the rest" = whatever is left so the total matches.',
          'Reply in the language the person used; if unclear, the app language.',
          `The app is set to ${thai ? 'Thai' : 'English'}. In Thai, sound like a friend texting (ได้เลย, นะ), never formal. Kip and HeyKip stay in English letters.`,
          `Context: ${JSON.stringify(context).slice(0, 4000)}`,
        ].join('\n'),
        tools: [tool],
        tool_choice: { type: 'tool', name: (tool as { name: string }).name },
        messages: [{ role: 'user', content: text.slice(0, 500) }],
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
