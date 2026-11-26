// Start fresh (approved mockup): clear everything the person made and send them back to setup. Their login, Plus,
// trial end date and privacy choices stay. The database part runs as one step on the server (start_fresh), so it
// can't stop halfway; photos go first, from their own folders only.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { forgetShops } from '@/lib/shops';
import { supabase } from '@/lib/supabase';

/** Phone settings that are preferences, not things they made — these stay. */
const KEEP = new Set(['heykip.lang', 'heykip.look', 'heykip.textStep', 'heykip.voiceLang', 'heykip.checkin', 'heykip.checkin.time', 'heykip.billReminders']);
const keep = (k: string) => KEEP.has(k) || k.startsWith('heykip.tour.');

/** Clears it all. Returns an error message, or null when done. */
export async function startFresh(uid: string): Promise<string | null> {
  for (const bucket of ['goal-photos', 'signatures']) {
    const { data: files } = await supabase.storage.from(bucket).list(uid, { limit: 1000 });
    if (files?.length) await supabase.storage.from(bucket).remove(files.map((f) => `${uid}/${f.name}`));
  }
  const { error } = await supabase.rpc('start_fresh');
  if (error) return error.message;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('heykip.') && !keep(k));
    if (keys.length) await AsyncStorage.multiRemove(keys);
    forgetShops();
  } catch {
    // The server part is done; leftover phone notes only hide a tip or two.
  }
  return null;
}
