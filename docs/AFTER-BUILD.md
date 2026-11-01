# To do once the real HeyKip app is built

These need the HeyKip app build (EAS development build, after ก้อย's Apple Developer enrollment). Expo Go can't do them.

## 1. Kip reads slips on open (agreed 2 Nov 2026)
Today (built): opening HeyKip checks the bank albums ก้อย picked and shows "Kip found N new slips · Read them".
Reading waits for that tap, then Save is a second tap.

To add:
- A new switch in Privacy & data and on the "Let Kip find your slips" card: **"Kip reads and saves new slips by itself"**. Off until the person turns it on (it sends slips to the AI without asking each time).
- When it's on: on open, Kip finds, reads and saves new slips with no taps (same duplicate check as now).
- Home card: **"Kip saved N slips from K PLUS · ฿1,028"** with **Undo** (deletes exactly those entries) and **Check** (opens them in History).
- Money-in slips still open the "give it a job" sheet.
- Code: src/lib/autoslips.ts (checkNew, prepareForKip), src/components/home/SlipFinder.tsx, src/app/slips.tsx (reading + saving logic to share).

## 2. Share from the bank app (agreed 2 Nov 2026)
On the bank's "transfer successful" screen: Share → HeyKip → read and saved in a second, without opening HeyKip.
Needs a share extension (config plugin) in the app build.

## 3. Later, only if people ask
Background check a few times a day with a notification ("Kip saved 2 slips"). iOS decides when it runs, so it's not reliable.

## Also waiting for the build
- Kip's own voice (expo-speech-recognition) — already in the code, falls back to keyboard dictation in Expo Go.
- Kip finding slips (needs Full Access to Photos).
- Notifications at the check-in time ก้อย set.
- Real payments for Plus (move the plan switch to the server).
