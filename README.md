# HeyKip

A goal-first money app for Thai Gen Z. Kip, a chrome jelly friend, helps you save for the things you actually want.

## Stack

- Expo SDK 58 (React Native, TypeScript), Expo Router
- Supabase (Auth, Postgres with Row Level Security, Storage)
- Skia + Reanimated for Kip's jelly motion (Step 2)

## Build plan

| Step | What | Status |
| --- | --- | --- |
| 1 | Foundation: design tokens, 3-item tab bar with floating +, Supabase schema, email sign-in | Done |
| 2 | Kip: jelly body, eyes in code, 7 moods | |
| 3 | Setup: intro to paywall | |
| 4 | Home, Over time, Category detail, Goals, Profile | |
| 5 | Logging: Talk, Check, Saved, Slips, Add it yourself, Can I buy? | |
| 6 | Kip's brain: Supabase edge function on Claude Haiku 5.5, plans and limits | |

## Run it

1. `.env` already points at the HeyKip Supabase project (public values only).
2. `supabase/migrations/` is applied to that project.
3. `npm install`, then `npx expo start` and scan the QR code with Expo Go.

## Layout

- `src/app/` screens (Expo Router). `(tabs)` holds Home and Goals; `talk`, `add` and `profile` open on top.
- `src/theme.ts` the only place colours, fonts and shadows are defined.
- `src/lib/` Supabase client, auth, money formatting.
- `assets/kip/` Kip's body (no eyes) and Kip with eyes.
