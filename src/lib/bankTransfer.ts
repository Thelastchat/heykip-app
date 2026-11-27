// Payday made real (approved 27 Nov, from the money-styles research): saving works when it happens without a
// decision, in money that sits apart. HeyKip can't move money, so Kip helps the person set a scheduled transfer in
// their own bank app — into a separate pocket or account — then checks on payday that it went through.
// Menu names are only the ones we found in a bank's or a reliable guide's own steps (27 Nov 2026): MAKE (Cloud Pocket
// + Schedule Transfer), and K PLUS, SCB EASY, Krungthai NEXT, Bangkok Bank and krungsri app (monthly scheduled
// transfers, per StashAway's Feb 2026 bank-by-bank guide and the banks' pages). ttb touch and others get general
// steps until their monthly option is confirmed.
import { supabase } from '@/lib/supabase';

export type BankTransfer = {
  /** what the bank moves each payday */
  amount: number;
  /** day of the month, as the plan's payday */
  day: number | null;
  bank: BankKey;
  /** when it was set up */
  at: string;
  /** the last pay month (period key) they confirmed it went through */
  ok?: string;
};

export type BankKey = 'make' | 'kplus' | 'scb' | 'ktb' | 'bbl' | 'krungsri' | 'ttb' | 'other';

export const BANKS: { key: BankKey; name: string }[] = [
  { key: 'make', name: 'MAKE by KBank' },
  { key: 'kplus', name: 'K PLUS' },
  { key: 'scb', name: 'SCB EASY' },
  { key: 'ktb', name: 'Krungthai NEXT' },
  { key: 'bbl', name: 'Bangkok Bank' },
  { key: 'krungsri', name: 'krungsri' },
  { key: 'ttb', name: 'ttb touch' },
  { key: 'other', name: 'Other' },
];

/** Bangkok Bank repeats a scheduled transfer 12 times at most (up to a year ahead), so it has to be set again. */
export const RENEWS_YEARLY: BankKey[] = ['bbl'];
/** From the 11th month after it was set, Kip reminds them to set it again. */
export function needsRenew(b: BankTransfer | null, now = new Date()): boolean {
  if (!b || !RENEWS_YEARLY.includes(b.bank)) return false;
  const at = new Date(b.at);
  const due = new Date(at.getFullYear(), at.getMonth() + 11, at.getDate());
  return now >= due;
}

export async function saveBankTransfer(uid: string, b: BankTransfer | null) {
  const { error } = await supabase.from('profiles').update({ bank_transfer: b }).eq('id', uid);
  return error?.message ?? null;
}
