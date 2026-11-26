// Kip remembers shops (approved mockup): when someone sorts a slip from a shop into a category, the next slip from
// that shop goes there by itself — "Kip remembered: Ktown4u goes to K-pop". Kept on the phone (no AI, no requests);
// Start fresh clears it.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'heykip.shops';
let cache: Record<string, string> | null = null;

/** "Ktown4u ", "KTOWN4U" and "ktown 4u" are the same shop. */
export const shopKey = (name: string) => name.toLowerCase().replace(/[\s.,'’"()\-_/]+/g, '').slice(0, 40);

export async function shops(): Promise<Record<string, string>> {
  if (cache) return cache;
  try {
    cache = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as Record<string, string>;
  } catch {
    cache = {};
  }
  return cache!;
}

/** They put a slip from `name` in `category`: remember it (the newest choice wins; at most 300 shops). */
export async function rememberShop(name: string, category: string) {
  const k = shopKey(name);
  if (k.length < 2) return;
  const m = { ...(await shops()) };
  delete m[k];
  m[k] = category;
  const keys = Object.keys(m);
  for (const old of keys.slice(0, Math.max(0, keys.length - 300))) delete m[old];
  cache = m;
  await AsyncStorage.setItem(KEY, JSON.stringify(m)).catch(() => {});
}

/** Where this shop's slips go, if they've sorted one before. */
export async function shopCategory(name: string): Promise<string | null> {
  return (await shops())[shopKey(name)] ?? null;
}

/** Start fresh: forget them all. */
export function forgetShops() {
  cache = null;
}
