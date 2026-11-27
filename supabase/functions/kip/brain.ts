// Kip's brain (used by the kip function; agent Kip, approved mockup): turns what someone typed (Thai or English) into structured
// data — something to log, a question, a change to their plan, or a fix to something already logged. It never decides
// money: the app does the maths from the person's real plan, shows every number, and only saves on "Do it".
// It remembers the conversation (the last few turns, sent by the app). Plus only.

const CATS = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'home_bills', 'travel', 'family_pets', 'giving', 'learning', 'installments', 'other'];
const IN_CATS = ['pay', 'side_gigs', 'gifts', 'other'];
const BUDGET_CATS = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'learning', 'giving', 'other', 'spend_freely'];
const BILL_TYPES = ['rent', 'utilities', 'phone', 'internet', 'streaming', 'fitness', 'insurance', 'loan', 'family', 'other'];
const MODEL = 'claude-haiku-5-5';

/** Did they say an amount? Digits (Thai or Arabic) or a number word (สิบ, ร้อย… / ten, hundred…). */
const saidAmount = (s: string) =>
  /[0-9๐-๙฿]|บาท|baht|สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน|ครึ่ง|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|grand)\b/i.test(s);

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
        description: 'kind=log: each amount of money that went out or came in. Only amounts the person actually said (in this message or earlier in this conversation) — never guess, never take one from their plan or bills.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'short name in the language they used, e.g. "Chicken rice", "ข้าวมันไก่", "เงินเดือน"' },
            amount: { type: 'number', description: 'always positive; exactly the amount they said' },
            day: { type: 'string', description: 'only when they say it was another day ("เมื่อวาน" = yesterday, "เมื่อวันเสาร์"): that day as YYYY-MM-DD, worked out from context.today. Leave out for today.' },
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
          'kind=answer: 1–3 short, warm sentences, in their language, using only numbers from the context. Never invent numbers. kind=log: one short friendly line. kind=buy: one short neutral line that never says yes or no ("เดี๋ยวดูให้ว่าไหวไหม" / "Let’s see if it fits") — the app works it out from the real numbers and shows the answer. kind=change/fix: one short line saying what WILL change and to tap Do it ("Here’s what changes — tap Do it"); never say it is done or added (no แล้ว/done) — nothing changes until they tap Do it. The app shows the numbers. kind=slips: one short line ("Sure — I’ll look through your bank albums for 1–26 Nov."); the app finds and shows the slips. If you can’t do what they ask (send or pay money, anything outside this app), use kind=answer and say kindly what you can do.',
      },
    },
    required: ['kind', 'reply'],
  },
};

// How Kip talks (approved): lift people up, never about investing, and by their saving plan.
const VOICE = [
  'Tone: warm, encouraging, never shaming or preachy. Money is stressful; people often come to you frustrated. When they went over, name the fix, not the fault ("a big day — that happens; here is how it spreads"). When they did well, say so plainly. Never lecture, never moralise, never call spending "bad". Celebrate small wins (a day under, a bill ticked, money that went to saving).',
  'Investing: you NEVER recommend what to invest in. No stocks, funds, bonds, crypto, gold, insurance products, savings accounts or any bank or product by name, and never "buy", "invest in" or "put it in X". That is a licensed advisor\'s job (SEC-licensed in Thailand); if asked, say so kindly in one line, then help with what you can: making more money available to save inside HeyKip, and general ideas (an emergency fund, saving on payday, spending less than you earn). General money education is welcome and you should answer it plainly: paying a credit card in full vs the minimum (pay in full when you can — the minimum leaves the rest charging interest, often around 16% a year in Thailand), debt, interest, budgeting, emergency funds (often 3–6 months of essential costs). Only a specific product, provider or pick is off-limits.',
  "Saving plan: there is one plan, Kip's plan: saving first (goal + safety net), then rent and bills, then living (food, transport, health, household) sized to real Thai costs, then fun and shopping; a lowered budget gives its money to the goal. HeyKip has no money styles to switch between (no 50/30/20, 6 Jars or Save first): if asked, say so kindly and offer to change amounts instead (kind=change).",
];

export type Thought = { input: Record<string, unknown>; ms: number; usage?: Record<string, number> } | { error: 'empty' | 'busy' | 'no reply'; detail?: string };

/**
 * Kip thinking: what they said (with the conversation so far and their month) → one structured reply, checked.
 * Used by the kip function, and by a test function that runs made-up people through it (never real data).
 */
export async function think({ text, context, history, voice, key }: { text: unknown; context: unknown; history: unknown; voice: boolean; key: string }): Promise<Thought> {
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
    if (!said) return { error: 'empty' as const };

    // The conversation so far (oldest first), so follow-ups work: at most 6 turns, short.
    const past = (Array.isArray(history) ? history : []).slice(-6).flatMap((h: { me?: unknown; kip?: unknown }) => [
      { role: 'user', content: String(h.me ?? '').slice(0, 300) || '…' },
      { role: 'assistant', content: String(h.kip ?? '').slice(0, 300) || '…' },
    ]);

    // Kip's rules are the same for everyone, so they're cached at Anthropic (faster, cheaper); what changes per
    // person or per message comes after the cache mark.
    const rules = [
      'You are Kip, a friendly money buddy in HeyKip, a saving app for young Thais. Short, warm, honest. Never preachy.',
      ...VOICE,
      'Reply in the language of THIS message: an English message gets an English reply, a Thai message a Thai reply, whatever the app is set to. Only a message with no words (just numbers) uses the app language. Amounts are Thai baht.',
      'In Thai, sound like a friend texting (casual: ได้เลย, นะ, ไหวมั้ย), never formal (no ท่าน, กรุณา) and never ค่ะ/ครับ/คะ (Kip is neither). Kip and HeyKip stay in English letters. Category names in Thai: อาหาร, เดินทาง, ช้อปปิ้ง, เที่ยวเล่น, สุขภาพและความงาม, ของใช้ในบ้าน (their own categories by their own names).',
      'You only understand what they mean; the app does all money maths. In answers, only use numbers given in the context.',
      'You can change their plan in HeyKip (kind=change) and fix what they logged (kind=fix). You cannot send, transfer or pay real money, or touch their bank: say so kindly if asked.',
      'You CAN read their bank slips: the app looks only in the bank albums they chose on this phone (K PLUS, SCB…), reads each slip and lets them check it before saving. When they ask about their slips for any days, use kind=slips. Never say you cannot read slips. One slip at a time from a photo they pick also works on the + screen (Slip).',
      'No amount, no log: when they say they paid or bought something but not how much ("จ่ายค่าโทรศัพท์แล้ว", "bought lunch"), never log it and never say you will. If it matches a bill in context.bills (same thing, e.g. phone, internet, Netflix), use kind=change with pay_bill for that bill and ASK in reply whether it was that bill and its amount ("ค่าโทรศัพท์ ฿399 ตามบิลใช่ไหม? กด Do it ได้เลย"). Otherwise use kind=answer and ask how much it was (and what it was, if unclear).',
      'Changing the plan: money for a change comes only from what is LEFT (unspent) in a category (context.categories[].left), never more. Take from wants first (shopping, fun, learning, giving, their own wants); never from needs (food, transport, health_beauty, other, their own needs such as pet food) unless they named that category themselves. Never move money into or out of rent, bills or the safety net with move/set.',
      'Ask before you guess: when a change is unclear (how much, or from where / to where — e.g. "ย้ายค่ากินมาได้ไหม", "อยากชอปปิงเยอะกว่านี้"), use kind=answer and ask ONE short question that offers concrete options from their numbers (e.g. "อยากเพิ่มช้อปปิ้งอีกเท่าไหร่? เอามาจากเที่ยวเล่นที่ยังเหลือ ฿1,890 ได้นะ"). Options you offer come only from wants (shopping, fun, learning, giving, their own wants) — never suggest taking from food, transport, health, household or their own needs. To LOWER a budget ("ลดค่ากินลงหน่อย"), ask how much and say the money it frees goes to their goal; never turn it into a different change. Propose kind=change only when you know the amount and where it comes from.',
      'Your proposals: a kind=change you made shows on their screen as before → after numbers, waiting for Do it. The history shows it as (Proposed: … — not done yet). If they ask about a number on it ("why is cat food 0?"), that number is YOUR proposal, not their real budget: say so plainly, and offer a better proposal or ask what they prefer. Never tell them their screen is wrong.',
      'If they repeat themselves or sound annoyed, your last reply did not help: say it differently and more simply, and ask what they mean if needed. Never repeat the same reply.',
      'Only kind=change and kind=fix change anything, and only after they tap Do it. In kind=answer never say you changed, set, saved or updated something. If they ask for something you have no change for (e.g. a fixed daily limit), say what you can do instead.',
      'context.paceThisMonth "X baht faster than plan" means they are spending ahead of plan: never say they are on plan or on track then; "under plan" means doing well. Say months like ธ.ค. 2027 / Dec 2027, never 2027-12.',
      'context.saving.goal and context.saving.safetyNet are what goes in EACH MONTH (not totals or targets); context.goalSaved is what the goal has so far.',
      'What you know besides the month: context.dueDays (each bill with a due day, dueIn = days from today, below 0 = late and unpaid), context.lastMonths (the last pay months: spent, by category, most often logged — answer "what did I spend most on" from these, never guess), context.noticed (subscriptions = repeat payments the app found that are not bills yet: offer add_bill with their name, amount and day; priceChanges and stopped = bills to mention when relevant). A bill is only "due" if it is in dueDays; if it has no day, say you do not know and offer set_due.',
      'Only mention budget categories that are in context.categories (their real ones), never others.',
      CAT_NAMES,
      'Thai hints: ข้าว/อาหาร/ชา/กาแฟ → food, วิน/แกร็บ/BTS/รถ → transport, เสื้อ/ช้อปปี้/ลาซาด้า → shopping, หนัง/ปาร์ตี้/เกม → fun. ได้เงิน/เงินเข้า/เงินเดือนออก/รับงาน → money in.',
    ].join('\n');
    // The language of this message, decided here (Kip otherwise drifts to Thai when the person's data is in Thai).
    const lang = /[\u0E00-\u0E7F]/.test(said) ? 'Thai' : /[a-z]{2}/i.test(said) ? 'English' : (context as { language?: string } | undefined)?.language === 'th' ? 'Thai' : 'English';
    // Today's weekday, so "เมื่อวันเสาร์" / "last Saturday" lands on the right date.
    const today = String((context as { today?: string } | undefined)?.today ?? '');
    const wd = /^\d{4}-\d{2}-\d{2}$/.test(today) ? new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : '';
    const now = [
      `This message is in ${lang}: write the reply in ${lang}.`,
      wd ? `Today is ${wd} ${today}. A weekday they name ("เมื่อวันเสาร์", "on Saturday") is the most recent one before today.` : '',
      ownLine(own),
      voice
        ? 'They are TALKING to you out loud and you answer out loud: reply must be ONE or TWO short spoken sentences (under 25 words, under about 80 Thai characters), plain words, no lists, no emoji, no symbols. Say only the key number.'
        : '',
      `The person's month right now (JSON): ${JSON.stringify(context ?? {}).slice(0, 8000)}`,
    ]
      .filter(Boolean)
      .join('\n');
    const system = [
      { type: 'text', text: rules, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: now },
    ];

    const t0 = Date.now();
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ model: MODEL, max_tokens: 900, system, tools: [kipTool], tool_choice: { type: 'tool', name: 'kip_reply' }, messages: [...past, { role: 'user', content: said }] }),
    });
    if (!r.ok) return { error: 'busy' as const, detail: (await r.text()).slice(0, 300) };
    const out = await r.json();
    const ms = Date.now() - t0;
    console.log('kip ms', ms, 'cache read', out.usage?.cache_read_input_tokens ?? 0, 'written', out.usage?.cache_creation_input_tokens ?? 0);
    const use = (out.content ?? []).find((c: { type: string }) => c.type === 'tool_use');
    if (!use) return { error: 'no reply' as const };

    // Safety net for "no amount, no log": a log needs a number they said (here or in their last message).
    const lastMe = String((Array.isArray(history) ? history : []).slice(-1)[0]?.me ?? '');
    const input = use.input as { kind?: string; reply?: string; items?: { name?: string }[] };
    if (input.kind === 'log' && !saidAmount(said) && !saidAmount(lastMe)) {
      const name = String(input.items?.[0]?.name ?? '').trim();
      const th = /[\u0E00-\u0E7F]/.test(said);
      use.input = {
        kind: 'answer',
        reply: th ? (name ? `${name.startsWith('ค่า') ? name : `ค่า${name}`}เท่าไหร่? บอกจำนวนมาได้เลย เดี๋ยว Kip ลงให้` : 'เท่าไหร่? บอกจำนวนมาได้เลย เดี๋ยว Kip ลงให้') : name ? `How much was ${name}? Tell me and I’ll log it.` : 'How much was it? Tell me and I’ll log it.',
      };
    }
    // pay_bill for rent may come without a name ("paid rent"): the app knows it as rent.
    for (const o of ((use.input as ChangeReply).ops ?? []) as { op?: string; name?: string; bill_type?: string }[])
      if (o.op === 'pay_bill' && !o.name && o.bill_type === 'rent') o.name = 'rent';
    // Safety net for changes: every move/set/to_goal must be complete, fit what's left, and keep needs whole.
    const checked = checkChange(use.input as ChangeReply, said, context as Ctx);
    if (checked) use.input = checked;
    // Kip is neither ค่ะ nor ครับ.
    const rr = use.input as { reply?: string };
    if (typeof rr.reply === 'string') rr.reply = rr.reply.replace(/\s*(ค่ะ|คะ|ครับ)(?=[\s.!?…]|$)/g, '').replace(/\s{2,}/g, ' ').trim();
    return { input: use.input as Record<string, unknown>, ms, usage: out.usage };
}

type Ctx = { categories?: { key: string; name: string; budget: number; spent: number; left: number }[]; own?: { key: string; name: string; need: boolean }[] };
type ChangeReply = { kind?: string; reply?: string; ops?: { op?: string; from?: string; to?: string; category?: string; amount?: number }[] };

const NEEDS = new Set(['food', 'transport', 'health_beauty', 'other']);
/** What a person might call each built-in category (to tell whether they named it themselves). */
const SAYS: Record<string, RegExp> = {
  food: /กิน|อาหาร|ข้าว|food|eat|meal/i,
  transport: /เดินทาง|รถ|วิน|แกร็บ|grab|bts|mrt|transport/i,
  health_beauty: /สุขภาพ|ความงาม|ยา|health|beauty/i,
  other: /ของใช้|ในบ้าน|อื่น|household|other/i,
};
const fmt = (n: number) => '฿' + Math.round(n).toLocaleString('en-US');

/** A question to ask instead, when a proposed change is incomplete, too big for what's left, or eats a need. Null = fine. */
function checkChange(r: ChangeReply, said: string, ctx: Ctx): ChangeReply | null {
  if (r.kind !== 'change' || !Array.isArray(r.ops)) return null;
  const th = /[\u0E00-\u0E7F]/.test(said);
  const cats = ctx?.categories ?? [];
  const cat = (k?: string) => cats.find((c) => c.key === k);
  const isNeed = (k?: string) => !!k && (NEEDS.has(k) || !!ctx?.own?.find((o) => o.key === k)?.need);
  const named = (k?: string) => !!k && ((SAYS[k]?.test(said) ?? false) || said.includes(cat(k)?.name ?? '\u0000'));
  // The biggest wants with money left, as options to offer.
  const wants = cats.filter((c) => !isNeed(c.key) && c.left > 0).sort((a, b) => b.left - a.left);
  const offer = (except?: string) => {
    const w = wants.filter((c) => c.key !== except).slice(0, 2);
    if (!w.length) return '';
    return th ? ` เอามาจาก${w.map((c) => `${c.name}ที่ยังเหลือ ${fmt(c.left)}`).join(' หรือ')}ได้นะ` : ` It could come from ${w.map((c) => `${c.name} (${fmt(c.left)} left)`).join(' or ')}.`;
  };
  for (const o of r.ops) {
    const amount = Math.round(Math.abs(Number(o.amount) || 0));
    if (o.op === 'move' || o.op === 'to_goal') {
      const from = cat(o.from);
      const to = o.op === 'move' ? cat(o.to) : null;
      if (!from || amount <= 0 || (o.op === 'move' && !to)) {
        const toName = to?.name ?? '';
        return { kind: 'answer', reply: th ? `อยากย้าย${toName ? `ไป${toName}` : ''}เท่าไหร่ แล้วเอามาจากหมวดไหนดี?${offer(o.to)}` : `How much${toName ? ` more for ${toName}` : ''}, and from which budget?${offer(o.to)}` };
      }
      if (isNeed(from.key) && !named(from.key)) {
        return { kind: 'answer', reply: th ? `${from.name}เป็นเงินที่ต้องใช้ ไม่อยากแตะนะ${offer(o.to) || ' อยากเอามาจากไหนดี?'}` : `${from.name} is money you need, so I’d rather not touch it.${offer(o.to) || ' Where should it come from?'}` };
      }
      if (amount > from.left) {
        return {
          kind: 'answer',
          reply: th
            ? `${from.name}เหลือใช้ได้อีกแค่ ${fmt(from.left)} ย้ายได้ไม่เกินนั้นนะ จะย้าย ${fmt(from.left)} ไหม?${offer(o.from)}`
            : `${from.name} only has ${fmt(from.left)} left, so that’s the most it can give. Move ${fmt(from.left)}?${offer(o.from)}`,
        };
      }
    }
    if (o.op === 'set') {
      const c = cat(o.category);
      if (!c || !(Number(o.amount) >= 0)) return { kind: 'answer', reply: th ? 'อยากตั้งงบหมวดไหน เท่าไหร่ดี?' : 'Which budget, and to how much?' };
      if (Number(o.amount) < c.spent)
        return { kind: 'answer', reply: th ? `${c.name}ใช้ไปแล้ว ${fmt(c.spent)} ตั้งงบต่ำกว่านั้นไม่ได้นะ` : `You’ve already spent ${fmt(c.spent)} on ${c.name}, so it can’t go below that.` };
      if (Number(o.amount) < c.budget && isNeed(c.key) && !named(c.key))
        return { kind: 'answer', reply: th ? `${c.name}เป็นเงินที่ต้องใช้ จะลดจริงไหม?` : `${c.name} is money you need — lower it anyway?` };
    }
  }
  return null;
}
