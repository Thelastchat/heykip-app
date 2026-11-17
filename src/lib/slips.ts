// Slip reading: each picked slip is read on the server (one request each, so ✓s arrive one by one),
// cleaned up here, checked against slips already saved, and only saved after the person checks it.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

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

export async function readSlip(image: string, mediaType: string): Promise<{ ok: true; read: SlipRead } | { ok: false; reason: 'plus' | 'consent' | 'nokey' | 'busy' | 'offline' | 'limit' }> {
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10); // Thai date
  // A slip takes a few seconds; if the network stalls, give up on this one instead of "Reading…" forever.
  const timeout = new Promise<{ data: null; error: { context: { status: number } } }>((res) => setTimeout(() => res({ data: null, error: { context: { status: 504 } } }), 60_000));
  const { data, error } = await Promise.race([supabase.functions.invoke('read-slip', { body: { image, mediaType, today } }), timeout]);
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 402) return { ok: false, reason: 'plus' };
    if (status === 429) return { ok: false, reason: 'limit' };
    if (status === 403) return { ok: false, reason: 'consent' };
    // 503 is also what the gateway says when a request hangs; only "no key" from our server means the key is missing.
    if (status === 503) {
      const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.().catch(() => null);
      return { ok: false, reason: body?.error === 'no key' ? 'nokey' : 'busy' };
    }
    if (status === undefined) return { ok: false, reason: 'offline' };
    return { ok: false, reason: 'busy' };
  }
  if (!data || typeof data !== 'object' || !('is_slip' in data)) return { ok: false, reason: 'busy' };
  return { ok: true, read: data as SlipRead };
}

/** "Show Kip your subscriptions": one screenshot of the phone's subscriptions list, read by the same reader. */
export type SubsRead = { is_list: boolean; items?: { name: string; amount: number; period: 'month' | 'year' | 'week'; renews?: string }[] };
export async function readSubs(image: string, mediaType: string): Promise<{ ok: true; read: SubsRead } | { ok: false; reason: 'plus' | 'consent' | 'nokey' | 'busy' | 'offline' | 'limit' }> {
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const timeout = new Promise<{ data: null; error: { context: { status: number } } }>((res) => setTimeout(() => res({ data: null, error: { context: { status: 504 } } }), 60_000));
  const { data, error } = await Promise.race([supabase.functions.invoke('read-slip', { body: { image, mediaType, today, kind: 'subs' } }), timeout]);
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 402) return { ok: false, reason: 'plus' };
    if (status === 429) return { ok: false, reason: 'limit' };
    if (status === 403) return { ok: false, reason: 'consent' };
    if (status === 503) {
      const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.().catch(() => null);
      return { ok: false, reason: body?.error === 'no key' ? 'nokey' : 'busy' };
    }
    if (status === undefined) return { ok: false, reason: 'offline' };
    return { ok: false, reason: 'busy' };
  }
  if (!data || typeof data !== 'object' || !('is_list' in data)) return { ok: false, reason: 'busy' };
  return { ok: true, read: data as SubsRead };
}

/** Open Photos for subscription screenshots (up to 5), ready for Kip. Empty if nothing was picked. */
export async function pickSubsShots(): Promise<PickedSlip[]> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5, quality: 1 }).catch(() => null);
  if (!r || r.canceled || !r.assets?.length) return [];
  const out: PickedSlip[] = [];
  for (const a of r.assets.slice(0, 5)) {
    const s = await shrinkSlip(a.uri, a.width);
    if (s) out.push(s);
  }
  return out;
}

// ---------- picking ----------
// Photos opens from the + screen (never while a screen is still sliding in — on iPhone that can close
// the new screen together with Photos), then the picked slips are handed to the Slips screen.
export const MAX_SLIPS = 10;
/** A slip picture ready for Kip: where it is (for the thumbnail) and its data. */
export type PickedSlip = { uri: string; base64?: string | null; mimeType?: string; width?: number; /** straight from Photos, not shrunk yet */ raw?: boolean };
let pending: PickedSlip[] | null = null;

/** Hand slips to the Slips screen (used by Kip finding slips). */
export function setPickedSlips(p: PickedSlip[]) {
  pending = p.slice(0, MAX_SLIPS);
}

/**
 * Open Photos for slips. Returns false if nothing was picked. The photos are handed over as they are; the Slips
 * screen shrinks them (an iCloud photo downloads first, which can take seconds) while showing "Getting your photos…"
 * — before, that happened here with nothing on screen, so the button looked broken.
 */
export async function pickSlips(onError?: (msg: string) => void): Promise<boolean> {
  // A failure used to be swallowed (the button just did nothing); now it's said on screen so it can be fixed.
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_SLIPS, quality: 1 }).catch((e: unknown) => {
    onError?.(String((e as Error)?.message ?? e).slice(0, 140));
    return null;
  });
  if (!r || r.canceled || !r.assets?.length) return false;
  pending = r.assets.slice(0, MAX_SLIPS).map((a) => ({ uri: a.uri, width: a.width, raw: true }));
  return true;
}

/** A picked photo made small enough to send (done once, on the Slips screen). */
export async function prepareSlip(p: PickedSlip): Promise<PickedSlip> {
  if (!p.raw) return p;
  return (await shrinkSlip(p.uri, p.width)) ?? { uri: p.uri };
}

/**
 * A phone photo can be 5 MB+ as text, which stalls on a slow connection. A slip reads perfectly at 1000px wide
 * as a JPEG (~150 KB), so every slip is made that small on the phone before it's sent.
 */
export async function shrinkSlip(uri: string, width?: number): Promise<PickedSlip | null> {
  try {
    const ref = await ImageManipulator.manipulate(uri)
      .resize({ width: Math.min(1000, width || 1000) })
      .renderAsync();
    const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
    return out.base64 ? { uri: out.uri, base64: out.base64, mimeType: 'image/jpeg' } : null;
  } catch {
    return null;
  }
}

/** The slips just picked (read once). */
export function takePickedSlips() {
  const p = pending;
  pending = null;
  return p;
}
