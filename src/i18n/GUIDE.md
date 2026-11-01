# HeyKip in Thai — how to translate

ก้อย approved this voice from real screens (Nov 2026). Follow it everywhere.

## The voice
- Casual and warm, like texting a friend (เพื่อนคู่คิดเรื่องเงิน). Short. Never stiff app-speak, never preachy.
- Use: ได้เลย, นะ, แล้ว, ไหวมั้ย, เดี๋ยว, เลย, อีกนิด. Avoid: ท่าน, กรุณา, ดำเนินการ, ระบบ, ทำรายการ, คุณ (only where really needed).
- Write it fresh in Thai — natural word order, not word-for-word. Keep the meaning and every number exact.
- Kip talks in first person casually: "เดี๋ยว Kip เกลี่ยให้", "Kip จดให้แล้ว".

## Approved lines (use these exact words)
| English | Thai |
|---|---|
| Hello, | หวัดดี |
| Today’s money | เงินของวันนี้ |
| Left today | ใช้ได้อีกวันนี้ |
| Left this month | เหลือทั้งเดือน |
| Your money buddy | เพื่อนคู่คิดเรื่องเงิน |
| Spent today | ใช้ไปวันนี้ |
| Ask Kip anything | ถาม Kip ได้ทุกเรื่อง |
| Your goal | เป้าหมาย |
| Add a goal | เพิ่มเป้าหมาย |
| Left to spend | เหลือให้ใช้ |
| Your month | แผนเดือนนี้ |
| Do more with Kip | ทำได้มากกว่านี้กับ Kip |
| Money styles / Money style | สไตล์การเก็บเงิน |
| Talk to Kip | คุยกับ Kip |
| Bills this month | บิลเดือนนี้ |
| Rent | ค่าห้อง |
| Add a bill | เพิ่มบิล |
| Slide to mark paid | จ่ายแล้วเลื่อนเลย |
| Add it yourself | จดเอง |
| Slip | สลิป |
| Spent (switch) / Got paid | จ่ายไป / ได้เงิน |
| Note / When / Save | โน้ต / เมื่อไหร่ / บันทึก |
| Today / Yesterday | วันนี้ / เมื่อวาน |
| What did you spend today? | วันนี้ใช้อะไรไปบ้าง? |
| Can I buy …? | ซื้อ … ไหวมั้ย? |
| Buy it — move the money | ซื้อเลย ย้ายเงินให้ที |
| Not now | ไว้ก่อน |
| Your savings aren’t used for this | ไม่แตะเงินเก็บเลย |
| KIP’S PLAN | แผนของ KIP |
| Money in / Spent (sections) | เงินเข้า / จ่ายไป |
| Safety net | เงินสำรอง |
| Plus / HeyKip Plus | Plus / HeyKip Plus (keep in English) |

## Words
- Categories: Food & drinks → อาหารและเครื่องดื่ม · Food → อาหาร · Transport → เดินทาง · Shopping → ช้อปปิ้ง · Fun → เที่ยวเล่น · Health & beauty → สุขภาพและความงาม · Health → สุขภาพ · Household / Household & other → ของใช้ / ของใช้และอื่นๆ · Learning → เรียนรู้ · Giving → ให้คนอื่น · Home & bills → บ้านและบิล · Travel → เที่ยว · Family & pets → ครอบครัวและสัตว์เลี้ยง · Installments → ผ่อน · Other → อื่นๆ · Spend freely → ใช้ได้อิสระ
- Income: Pay → เงินเดือน · Side gig(s) → งานเสริม · Gift(s) → ของขวัญ/เงินให้ · Usual pay → เงินเดือนปกติ · payday → วันเงินเดือนออก
- Goal / goals → เป้าหมาย · saving → เก็บเงิน · budget → งบ · bill → บิล · rent → ค่าห้อง · plan → แผน · on track → ทันตามแผน · sooner → เร็วขึ้น · pace → แผน (e.g. "faster than plan" → "เร็วกว่าแผน")
- Money styles: Kip’s plan → แผนของ Kip · Save first → เก็บก่อน · 50 / 30 / 20 → 50 / 30 / 20 · 6 Jars → 6 โหล
- Kip and HeyKip stay in English letters. Brand/app names (Grab, Shopee, LINE, K PLUS, BTS) stay as they are.
- Numbers, ฿ amounts and {vars} stay exactly as given; move them wherever Thai word order wants them.

## Dates
Never write month or day names yourself. Use the helpers from `@/lib/i18n`: `monthShort(m)` (ธ.ค.), `monthLong(m)` (ธันวาคม), `dayShort(d)` (อ.), `shownYear(date)` (2570 in Thai). Day before month in both languages is fine ("25 ธ.ค.").

## How to wrap text in code
- `import { t, rich } from '@/lib/i18n';`
- Plain text: `t('Left today')`. With values: `t('{n} days left', { n })` — **never** `${}` inside t(). The English must read exactly as before.
- Bold or styled parts inside one sentence: `rich('That moves {goal} **{when}**.', { goal, when }, (s) => <Text style={styles.bold}>{s}</Text>)` — keeps Thai word order free. Don't split one sentence into several t() calls.
- Plurals: pick in code, translate both: `n === 1 ? t('{n} day') : t('{n} days', { n })` (Thai lines can be the same).
- **Never call t() at the top level of a file** (module constants run before the language is loaded). Move it into the component/function, or use a getter: `{ key: 'food', get name() { return t('Food & drinks'); } }`. For arrays of labels at top level, keep the English there and call `t(item.label)` where it is shown — but then the English literal must also appear in a `t('...')` somewhere the checker can see, so prefer getters.
- accessibilityLabel text should be translated too.
- Don't translate: console logs, error codes, database values/keys, route names, the `kip-moods` debug screen.
- Text coming from the database or the person (goal names, notes) is shown as-is.

## Your Thai dictionary file
Add every line to your area's file in `src/i18n/th/<area>.ts`, keyed by the exact English string passed to t()/rich() (same {vars}, same **bold** markers, same curly quotes ’ “ ”). Group by screen with comments. Then run:
`npx tsx scripts/check-i18n.ts <your files…>` — must print 0 without Thai — and `npx tsc --noEmit`.
