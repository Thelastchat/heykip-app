# HeyKip tests

Two kinds, both run without touching the real Supabase project.

## Money rules — `npm run test:logic`

Thousands of random people (pay ฿9k–120k, any rent, payday, money style, 1–3 goals), checked against rules that
must always hold: every baht has a job, food and bills are never cut for a goal, today's money is never negative,
pay cycles are right for every payday, goal shares add up, payday never over-fills a goal… Takes about a minute.

## Screens — `npm run test:e2e`

Builds the web version and taps through it like a person, with a fake Supabase behind it (`e2e/mock.cjs`):

- `e2e/setup.cjs` — setup start to finish in 6 situations, then checks the saved plan and Home's numbers
- `e2e/home.cjs` — log spending, go over, get paid, pay rent, delete in History, goals, Plus second goal, pay change, budgets, Thai
- `e2e/screens.cjs` — every screen for 8 kinds of people, in Thai + Dark, and on a 320 px phone

Failures keep a screenshot in `e2e/out/`. The first time on a new computer: `npm i -D playwright && npx playwright install chromium`.
Run one part only: `node tests/e2e/run.cjs setup` (or `home`, `screens`).

What these can't check (do it on the phone): the photo picker, the date wheel, the keyboard, haptics,
how a swipe feels, and the real Supabase security rules.
