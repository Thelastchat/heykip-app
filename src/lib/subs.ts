// Subscription detective (approved mockup): Kip finds subscriptions in what you log, and keeps watching the ones in
// Every month. All of it is the app's own maths on what's already loaded (the last ~4 months): free, no AI.
//
//   repeat — the same name, within 10% of the same amount, within 3 days of the same day of the month, 3 times
//            about a month apart, and not already a bill. Never from one or two payments.
//   price  — a monthly bill whose last 2 logged payments were both a new price (more than 3% away).
//   stopped — a monthly bill with a due day that was paid in what you logged before, and then not for 2 due dates.
//   streaming — 2 or more streaming bills: the year's total, said once ("just so you see it").
import type { BillItem, MonthBudget } from '@/lib/budget';
import { dateIn } from '@/lib/billdue';
import { guessType } from '@/lib/everymonth';

export type LoggedTx = { amount: number; kind: string; occurred_at: string; note: string | null; cat?: string };

/** Names people know, from what bank slips and app stores print ("SPOTIFY P1A2B3 BKK" → Spotify). */
const KNOWN: [RegExp, string][] = [
  [/spotify/, 'Spotify'],
  [/netflix/, 'Netflix'],
  [/youtube|yt ?premium/, 'YouTube Premium'],
  [/disney/, 'Disney+'],
  [/icloud/, 'iCloud+'],
  [/apple ?music/, 'Apple Music'],
  [/apple ?one/, 'Apple One'],
  [/apple ?tv/, 'Apple TV+'],
  [/\bviu\b/, 'Viu'],
  [/wetv/, 'WeTV'],
  [/iqiyi/, 'iQIYI'],
  [/joox/, 'JOOX'],
  [/true ?id/, 'TrueID'],
  [/\bhbo\b|\bmax\b/, 'Max'],
  [/prime ?video|amazon ?prime/, 'Prime Video'],
  [/line ?(music|melody|stickers? premium)/, 'LINE MUSIC'],
  [/google ?one/, 'Google One'],
  [/chat ?gpt|openai/, 'ChatGPT'],
  [/claude|anthropic/, 'Claude'],
  [/canva/, 'Canva'],
  [/duolingo/, 'Duolingo'],
  [/adobe/, 'Adobe'],
  [/microsoft|office ?365|xbox/, 'Microsoft'],
  [/playstation|psn/, 'PlayStation Plus'],
  [/nintendo/, 'Nintendo'],
  [/tinder/, 'Tinder'],
  [/bumble/, 'Bumble'],
  [/grab ?unlimited/, 'GrabUnlimited'],
  [/lineman|line man/, 'LINE MAN'],
  [/jetts/, 'Jetts Fitness'],
];

/** A name to compare by (lower case, no codes or numbers) and a name to show. Empty when there's nothing to go on. */
export function cleanName(raw: string | null | undefined): { key: string; name: string } {
  const s = (raw ?? '').toLowerCase().trim();
  if (!s) return { key: '', name: '' };
  for (const [re, name] of KNOWN) if (re.test(s)) return { key: name.toLowerCase(), name };
  const words = s
    .replace(/[*#_.,/\\|:;()[\]{}'"-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/\d/.test(w) && !/^(bkk|th|tha|thailand|co|ltd|com|www|pte|inc|llc|payment|pay|ref|txn)$/.test(w))
    .slice(0, 3);
  const key = words.join(' ');
  return { key, name: words.map((w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w)).join(' ') };
}

export type Repeat = { key: string; name: string; amount: number; day: number; dates: Date[] };

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
/** How far apart two days of the month are, going round the month end (the 30th and the 2nd are 2 apart). */
const dayGap = (a: number, b: number) => Math.min(Math.abs(a - b), 31 - Math.abs(a - b));

/** Payments that repeat monthly and aren't bills yet. */
export function findRepeats(tx: LoggedTx[], m: MonthBudget | null, now = new Date()): Repeat[] {
  const known = new Set([...(m?.bills.items ?? []).map((b) => cleanName(b.name).key), 'rent']);
  const groups = new Map<string, { name: string; at: Date; amount: number }[]>();
  for (const t of tx) {
    if (t.kind !== 'spend' || t.amount <= 0) continue;
    const c = cleanName(t.note);
    if (!c.key || known.has(c.key)) continue;
    const at = new Date(t.occurred_at);
    if (at > now) continue;
    (groups.get(c.key) ?? groups.set(c.key, []).get(c.key)!).push({ name: c.name, at, amount: t.amount });
  }
  const out: Repeat[] = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => b.at.getTime() - a.at.getTime());
    const latest = list[0];
    // Walk back from the latest: each one about a month (24–38 days) before the last, 3 in a row — so a charge on
    // the 30th that lands on the 1st one month still counts.
    const run = [latest];
    for (let k = 1; k < 3; k++) {
      const prev = run[run.length - 1];
      const hit = list.find((x) => {
        const gap = (prev.at.getTime() - x.at.getTime()) / 86_400_000;
        return gap >= 24 && gap <= 38 && Math.abs(x.amount - latest.amount) <= latest.amount * 0.1 && dayGap(x.at.getDate(), latest.at.getDate()) <= 3;
      });
      if (!hit) break;
      run.push(hit);
    }
    if (run.length < 3) continue;
    // Stale: the last one is more than ~6 weeks old — it may have stopped.
    if (now.getTime() - latest.at.getTime() > 45 * 86_400_000) continue;
    const days = run.map((x) => x.at.getDate()).sort((a, b) => a - b);
    out.push({ key, name: latest.name, amount: Math.round(latest.amount), day: days[1], dates: run.map((x) => x.at).reverse() });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export type PriceUp = { index: number; name: string; was: number; now: number };

/** A monthly bill paid twice running at a new price. */
export function findPriceChanges(tx: LoggedTx[], m: MonthBudget | null): PriceUp[] {
  const out: PriceUp[] = [];
  (m?.bills.items ?? []).forEach((b, index) => {
    if (b.yearly) return;
    const key = cleanName(b.name).key;
    const paid = tx
      .filter((t) => t.kind === 'spend' && cleanName(t.note).key === key)
      .sort((a, c) => c.occurred_at.localeCompare(a.occurred_at))
      .slice(0, 2);
    if (paid.length < 2) return;
    const [a, c] = paid.map((x) => Math.round(x.amount));
    if (a !== c || Math.abs(a - b.amount) <= b.amount * 0.03) return;
    // Two different months (not one payment logged twice).
    if (monthIndex(new Date(paid[0].occurred_at)) === monthIndex(new Date(paid[1].occurred_at))) return;
    out.push({ index, name: b.name, was: b.amount, now: a });
  });
  return out;
}

export type Stopped = { index: number; name: string; amount: number; last: Date };

/** A monthly bill with a due day that showed up in what you logged, then missed its last 2 due dates. */
export function findStopped(tx: LoggedTx[], m: MonthBudget | null, now = new Date()): Stopped[] {
  const out: Stopped[] = [];
  (m?.bills.items ?? []).forEach((b: BillItem, index) => {
    if (b.yearly || !b.day) return;
    const key = cleanName(b.name).key;
    const paid = tx.filter((t) => t.kind === 'spend' && cleanName(t.note).key === key).map((t) => new Date(t.occurred_at));
    if (!paid.length) return; // never logged: Kip can't tell, so it says nothing
    const last = new Date(Math.max(...paid.map((d) => d.getTime())));
    // The last 2 due dates (3 days' grace each) that have passed.
    const dues: Date[] = [];
    for (let k = 0; dues.length < 2 && k < 4; k++) {
      const d = dateIn(now.getFullYear(), now.getMonth() - k, b.day!);
      if (d.getTime() + 3 * 86_400_000 < now.getTime()) dues.push(d);
    }
    if (dues.length < 2) return;
    if (last.getTime() < dues[1].getTime() - 5 * 86_400_000) out.push({ index, name: b.name, amount: b.amount, last });
  });
  return out;
}

/** Two or more streaming bills: what they come to in a year. */
export function streamingTotal(m: MonthBudget | null): { names: string[]; perMonth: number; perYear: number } | null {
  const s = (m?.bills.items ?? []).filter((b) => !b.yearly && (b.type ?? guessType(b.name)) === 'streaming');
  if (s.length < 2) return null;
  const perMonth = s.reduce((a, b) => a + b.amount, 0);
  return { names: s.map((b) => b.name), perMonth, perYear: perMonth * 12 };
}

// ---------- "Show Kip your subscriptions": what was read, ready to add ----------

export type FoundSub = {
  key: string;
  name: string;
  /** the price as shown, and how often */
  price: number;
  period: 'month' | 'year' | 'week';
  /** what Every month carries for it (a yearly one: set aside over the months to its renewal) */
  perMonth: number;
  day: number | null;
  /** a yearly one's renewal month, "YYYY-MM" */
  due: string | null;
  already: boolean;
};

/** Everything read off the screenshots, once each (the same name twice is one), marked if it's already a bill. */
export function foundSubs(
  reads: { name: string; amount: number; period: 'month' | 'year' | 'week'; renews?: string }[],
  m: MonthBudget | null,
  setAside: (total: number, due: string) => number,
): FoundSub[] {
  const have = new Set((m?.bills.items ?? []).map((b) => cleanName(b.name).key));
  const out = new Map<string, FoundSub>();
  for (const r of reads) {
    const amount = Math.round(Number(r.amount) || 0);
    const c = cleanName(r.name);
    const name = (r.name ?? '').trim().slice(0, 40) || c.name;
    if (!c.key || amount <= 0) continue;
    const renews = /^\d{4}-\d{2}-\d{2}$/.test(r.renews ?? '') ? r.renews! : null;
    const day = renews ? Number(renews.slice(8, 10)) : null;
    const period = r.period === 'year' || r.period === 'week' ? r.period : 'month';
    const due = period === 'year' && renews ? renews.slice(0, 7) : null;
    const perMonth = period === 'week' ? Math.round((amount * 52) / 12) : period === 'year' ? (due ? setAside(amount, due) : Math.ceil(amount / 12)) : amount;
    out.set(c.key, { key: c.key, name, price: amount, period, perMonth, day, due, already: have.has(c.key) });
  }
  return [...out.values()].sort((a, b) => Number(a.already) - Number(b.already) || b.perMonth - a.perMonth);
}
