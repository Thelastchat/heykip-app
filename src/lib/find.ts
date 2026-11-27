// "When did I pay my phone?" — Kip only sees the last few things logged, so for anything further back he says what
// to look for (kind=find: the ways it could be written, and the days) and the app searches everything they logged
// and every bill they ticked paid, then answers from the real rows. Kip never guesses a date or an amount.
import type { PaidEntry } from '@/lib/budget';
import { t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { shortDate, shownYear } from '@/lib/setup/plan';

export type FindQuery = { words: string[]; from?: string; to?: string };
export type FoundRow = { name: string; amount: number; on: string; money: 'in' | 'out'; from: 'logged' | 'bill' };
type Tx = { note: string | null; amount: number; occurred_at: string; kind: string; cat?: string | null };

const DAY = 86_400_000;
const isDay = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const dayOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Lower case, no spaces or marks — "True Move-H" and "truemoveh", "ค่า โทร" and "ค่าโทร" are the same. */
const squash = (s: string) => s.toLowerCase().replace(/[\s.,'’\-_/()*#:]+/g, '');

/** The days to look through: what Kip said, kept sane (never after today, at most ~13 months back); default 90 days. */
export function findRange(q: FindQuery, now = new Date()): { from: string; to: string; said: boolean } {
  const today = dayOf(now);
  const oldest = dayOf(new Date(now.getTime() - 400 * DAY));
  let from = isDay(q.from) ? q.from! : dayOf(new Date(now.getTime() - 90 * DAY));
  let to = isDay(q.to) ? q.to! : today;
  if (from > to) [from, to] = [to, from];
  if (to > today) to = today;
  if (from < oldest) from = oldest;
  return { from, to, said: isDay(q.from) };
}

/** The words worth matching: Thai 2+ letters, anything else 3+ (so "tv" or "a" can't match everything). */
export function findWords(q: FindQuery): string[] {
  const out = new Set<string>();
  for (const w of Array.isArray(q.words) ? q.words.slice(0, 24) : []) {
    const s = squash(String(w ?? ''));
    if (/[฀-๿]/.test(s) ? s.length >= 2 : s.length >= 3) out.add(s);
  }
  return [...out];
}

/** Bills by type, for a ticked bill whose own name ("AIS") isn't what they asked ("phone"). */
const TYPE_WORDS: Record<string, string[]> = {
  phone: ['phone', 'mobile', 'โทรศัพท์', 'มือถือ', 'ค่าโทร'],
  internet: ['internet', 'wifi', 'เน็ต', 'อินเทอร์เน็ต'],
  utilities: ['electric', 'water', 'ค่าไฟ', 'ค่าน้ำ', 'ไฟฟ้า', 'ประปา'],
  rent: ['rent', 'ค่าเช่า', 'ค่าห้อง', 'ค่าหอ', 'ค่าคอนโด'],
};

/**
 * Everything that matches, newest first: logged money (notes, as typed or as printed on a bank slip) and bills ticked
 * paid. A ticked bill that also has a logged payment of the same amount within a day shows once.
 */
export function findRows(tx: Tx[], paid: PaidEntry[], q: FindQuery, types: Record<string, string> = {}, now = new Date()): FoundRow[] {
  const words = findWords(q);
  if (!words.length) return [];
  const { from, to } = findRange(q, now);
  const hit = (...names: (string | null | undefined)[]) => names.some((n) => !!n && words.some((w) => squash(n).includes(w)));
  const logged: FoundRow[] = [];
  for (const r of tx) {
    const on = dayOf(new Date(r.occurred_at));
    if (on < from || on > to || !hit(r.note)) continue;
    logged.push({ name: (r.note ?? '').trim(), amount: Number(r.amount), on, money: r.kind === 'income' ? 'in' : 'out', from: 'logged' });
  }
  const bills: FoundRow[] = [];
  for (const e of paid) {
    if (e.on < from || e.on > to) continue;
    const type = e.key === 'rent' ? 'rent' : types[e.key];
    if (!hit(e.name, ...(TYPE_WORDS[type ?? ''] ?? []).filter((w) => words.includes(squash(w))))) continue;
    const near = logged.some((l) => l.amount === e.amount && Math.abs(new Date(l.on).getTime() - new Date(e.on).getTime()) <= DAY);
    if (!near) bills.push({ name: e.key === 'rent' ? t('Rent') : e.name, amount: e.amount, on: e.on, money: 'out', from: 'bill' });
  }
  return [...logged, ...bills].sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0));
}

/** "14 Nov", with the year when it isn't this year. */
export function findDay(on: string, now = new Date()) {
  const d = new Date(`${on}T12:00:00`);
  return d.getFullYear() === now.getFullYear() ? shortDate(d) : `${shortDate(d)} ${shownYear(d)}`;
}

/** Kip's answer, from the rows alone: the latest one, and how many and how much when there's more than one. */
export function findAnswer(rows: FoundRow[], q: FindQuery, now = new Date()): string {
  const { from } = findRange(q, now);
  const since = findDay(from, now);
  if (!rows.length) return `${t('I couldn’t find it since {date}.', { date: since })} ${t('If it’s paid but not logged yet, tell me how much and I’ll log it.')}`;
  const last = rows[0];
  const line = t('Last one was {date}: {name}, {amount}.', { date: findDay(last.on, now), name: last.name, amount: baht(last.amount) });
  // Count and add up only the same direction as the latest (money in and money out never mix in one total).
  const same = rows.filter((r) => r.money === last.money);
  if (same.length === 1) return line;
  const total = same.reduce((a, r) => a + r.amount, 0);
  return `${line} ${t('{count} times since {date}, {total} in all.', { count: same.length, date: since, total: baht(total) })}`;
}
