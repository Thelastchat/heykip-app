# Kip eval: realistic questions, a made-up person

`person.json` is what the app sends Kip for a made-up person (no real data): ฿22,000 pay, rent ฿5,000, phone bill, Netflix, a cat-food category (a need), saving for Japan. `cases.json` holds ~40 questions the way people really type them (Thai and English, vague ones, follow-ups with history).

To run: deploy `run-function.ts` as a temporary edge function together with a copy of `supabase/functions/kip/brain.ts`, `cases.ts` (`export default` + cases.json) and `ctx.ts` (`export default` + person.json), with JWT verification off; open its URL; read the replies; retire the function right after (it spends API money for anyone who opens it).

What to look for: no log without an amount they said; proposals only from what's left and never from needs unless named; vague requests become one question with options; the reply is in the message's language; "can I buy" never says yes/no (the app decides); Kip owns its own proposals in follow-ups.

27–28 Nov 2026 results: run 1 found 9 problems (English replies in Thai, credit-card question refused, "can I buy" saying yes when it didn't fit, needs offered as options, "cut food" misread, "added" before Do it, rent without a name, yesterday logged as today, "on plan" while ahead of plan). All fixed by run 3.
