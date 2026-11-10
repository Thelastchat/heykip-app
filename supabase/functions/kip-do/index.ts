// "Tell Kip…" inside a sheet: turns what someone says (Thai or English) into ONE change to their plan, for one of
// three jobs — giving extra money a job, covering a day that ran over, or changing the month. Kip only proposes;
// the app checks every number and the person taps "Do it". Anything off-topic gets ok=false and a short reply.
// Plus only, and only with the person's AI permission.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MODEL = 'claude-haiku-5-5';
const CATS = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'learning', 'giving', 'other', 'spend_freely'];

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
};

const JOB: Record<string, string> = {
  extra:
    'The person just got extra money (context.extra baht) and is telling you what to do with it. You can ONLY split it between: their goals (context.goals), the safety net (if context.safety is true), this month’s spending money, or one spending category this month. You cannot buy, invest, transfer, pay anyone, or do anything else — for that, ok=false and say what you can do.',
  over: 'The person spent more than today’s money (context.over baht over). They tell you how to pay for it. You can ONLY: spread it over the days left (days), take it from this month’s goal saving (goal, at most context.goal_saving), or from the safety net (safety, at most context.safety_saved). "Take it from fun/shopping" is not possible because today’s money already includes those — say so kindly and suggest spreading it or the goal saving (ok=false).',
  month:
    'The person is changing this month’s plan (context.month: categories with amounts, bills). You can ONLY move money between categories, set a category, add a monthly bill, or remove a bill they added. Saving for the goal and rent are not changed here. Anything else: ok=false.',
};

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
    const tool = TOOLS[task as string];
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
          JOB[task as string],
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
