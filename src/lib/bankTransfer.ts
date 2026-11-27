// Payday made real (approved 27 Nov, from the money-styles research): saving works when it happens without a
// decision, in money that sits apart. HeyKip can't move money, so Kip helps the person set a scheduled transfer in
// their own bank app — into a separate pocket or account — then checks on payday that it went through.
// Only MAKE by KBank's steps are named (Cloud Pocket + Schedule Transfer, confirmed); every other bank gets the
// general steps, never menu names we haven't checked.
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

export async function saveBankTransfer(uid: string, b: BankTransfer | null) {
  const { error } = await supabase.from('profiles').update({ bank_transfer: b }).eq('id', uid);
  return error?.message ?? null;
}
