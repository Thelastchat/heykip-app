// Slip reading: each picked slip is read on the server (one request each, so ✓s arrive one by one),
// cleaned up here, checked against slips already saved, and only saved after the person checks it.
import type { DbCat, InCat } from '@/lib/kip';
import { supabase } from '@/lib/supabase';

export type SlipRead = {
  is_slip: boolean;
  money?: 'in' | 'out';
  amount?: number;
  name?: string;
  when?: string; // YYYY-MM-DDTHH:mm, Thai local time
  ref?: string;
  bank?: string;
  category?: string;
};

export type Slip = {
  id: string; // local id
  uri: string; // the picked image, for the thumbnail
  state: 'reading' | 'done' | 'notslip' | 'failed';
  money: 'in' | 'out';
  amount: number;
  name: string;
  at: Date;
  ref: string | null;
  category: DbCat | InCat;
  already: boolean; // saved before, or the same slip twice in this batch
};

const SPEND: DbCat[] = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'home_bills', 'travel', 'family_pets', 'giving', 'learning', 'installments', 'other'];
const INCOME: InCat[] = ['pay', 'side_gigs', 'gifts', 'other'];

/** "2026-11-01T12:40" in Thai time → a real moment. Anything odd → now. Never in the future. */
export function thaiTime(when: string | undefined, now = new Date()): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(when ?? '');
  if (!m) return now;
  let year = Number(m[1]);
  if (year > 2400) year -= 543; // a Buddhist year slipped through
  const d = new Date(`${year}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+07:00`);
  if (isNaN(d.getTime()) || d.getTime() > now.getTime() + 5 * 60_000) return now;
  return d;
}

/** Turn what the server read into a clean slip (or a skipped one). */
export function cleanSlip(id: string, uri: string, r: SlipRead | null): Slip {
  const base = { id, uri, money: 'out' as const, amount: 0, name: '', at: new Date(), ref: null, category: 'other' as DbCat, already: false };
  if (!r) return { ...base, state: 'failed' };
  const amount = Math.round(Math.abs(Number(r.amount) || 0) * 100) / 100;
  if (!r.is_slip || amount <= 0) return { ...base, state: 'notslip' };
  const money = r.money === 'in' ? 'in' : 'out';
  const category = money === 'in' ? (INCOME.includes(r.category as InCat) ? (r.category as InCat) : 'other') : SPEND.includes(r.category as DbCat) ? (r.category as DbCat) : 'other';
  return { ...base, state: 'done', money, amount, name: (r.name ?? '').trim().slice(0, 80), at: thaiTime(r.when), ref: r.ref?.replace(/\s+/g, '').slice(0, 64) || null, category };
}

/** What the slip is known by: its reference number, or amount + minute when it has none. */
export const slipKey = (s: Pick<Slip, 'ref' | 'amount' | 'at'>) => s.ref ?? `${s.amount}@${s.at.toISOString().slice(0, 16)}`;

/** Mark slips already saved before, and repeats within this batch (the first one stays). */
export function markAlready(slips: Slip[], saved: Set<string>): Slip[] {
  const seen = new Set<string>();
  return slips.map((s) => {
    if (s.state !== 'done') return s;
    const k = slipKey(s);
    const already = saved.has(k) || seen.has(k);
    seen.add(k);
    return { ...s, already };
  });
}

/** Keys of slips this person already saved (only the ones in this batch are asked for). */
export async function savedKeys(userId: string, keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const { data } = await supabase.from('transactions').select('slip_ref').eq('user_id', userId).in('slip_ref', keys);
  return new Set((data ?? []).map((r) => r.slip_ref as string));
}

export async function readSlip(image: string, mediaType: string): Promise<{ ok: true; read: SlipRead } | { ok: false; reason: 'plus' | 'nokey' | 'busy' | 'offline' }> {
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10); // Thai date
  const { data, error } = await supabase.functions.invoke('read-slip', { body: { image, mediaType, today } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 402) return { ok: false, reason: 'plus' };
    if (status === 503) return { ok: false, reason: 'nokey' };
    if (status === undefined) return { ok: false, reason: 'offline' };
    return { ok: false, reason: 'busy' };
  }
  if (!data || typeof data !== 'object' || !('is_slip' in data)) return { ok: false, reason: 'busy' };
  return { ok: true, read: data as SlipRead };
}
