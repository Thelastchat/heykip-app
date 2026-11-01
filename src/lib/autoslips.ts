// Kip finds new slips (approved mockup, Plus): with permission, Kip looks ONLY in the bank albums the person picked
// (K PLUS, SCB EASY…), only at photos added since it last checked, each time the app opens. Nothing is read or sent
// until they tap "Read them" — then the slips go to the same Slips screen as picking by hand.
// The settings live on this phone (albums are this phone's), never on the server.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';

import { MAX_SLIPS, setPickedSlips, type PickedSlip } from '@/lib/slips';

const KEY = 'heykip.autoSlips.v1';

export type AutoSlips = { on: boolean; albums: { id: string; title: string }[]; since: number; dismissed?: boolean };
export type FoundAlbum = { id: string; title: string; count: number; bank: boolean; thumb: string | null };
export type NewSlips = { assets: MediaLibrary.Asset[]; albums: string[]; since: number };

/** Bank and wallet apps that save their slips into an album of their own (Thai and English names). */
const BANK = [
  /k\s?plus/i,
  /make by kbank/i,
  /kasikorn|กสิกร/i,
  /\bscb\b|scb easy|ไทยพาณิชย์/i,
  /krungthai|\bktb\b|กรุงไทย/i,
  /\bnext\b.*krungthai|krungthai.*\bnext\b/i,
  /bualuang|bangkok bank|กรุงเทพ/i,
  /krungsri|\bkma\b|กรุงศรี/i,
  /\bttb\b|ttb touch|ทีทีบี/i,
  /mymo|\bgsb\b|ออมสิน/i,
  /\bbaac\b|ธ\.ก\.ส/i,
  /\buob\b|\bcimb\b|lh bank|kkp|kiatnakin|tisco|icbc/i,
  /truemoney|ทรูมันนี่/i,
  /paotang|เป๋าตัง/i,
  /shopeepay|linepay|line pay|rabbit/i,
  /\bslip|สลิป/i,
];
export const isBankAlbum = (title: string) => BANK.some((r) => r.test(title));

/** Photo library access exists on phones only (not on the web version). */
export const autoSlipsAvailable = Platform.OS !== 'web';

export async function loadAuto(): Promise<AutoSlips | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? (JSON.parse(v) as AutoSlips) : null;
  } catch {
    return null;
  }
}
export async function saveAuto(a: AutoSlips) {
  await AsyncStorage.setItem(KEY, JSON.stringify(a)).catch(() => {});
}

/** Ask iPhone/Android for Photos. 'limited' = they picked only some photos (still works for those). */
/**
 * Ask iPhone/Android for Photos. Finding slips needs Full Access: with "Limited" (only some photos picked)
 * the phone won't let Kip look inside albums. Kip still only ever looks in the albums the person turns on.
 */
export async function askPhotos(): Promise<'all' | 'limited' | 'denied'> {
  try {
    const r = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
    if (!r.granted) return 'denied';
    return r.accessPrivileges === 'limited' ? 'limited' : 'all';
  } catch {
    return 'denied';
  }
}

/** True when the error is the phone saying "no Photos access". */
export const isPhotosDenied = (e: unknown) => /permission|E_NO_PERMISSIONS|not authorized|authoriz/i.test(String((e as Error)?.message ?? e));

/** Albums to offer: every bank album found (on), plus Screenshots (off — it holds everything else too). */
export async function findAlbums(): Promise<FoundAlbum[]> {
  const all = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
  const out: FoundAlbum[] = [];
  for (const a of all) {
    const bank = isBankAlbum(a.title);
    const shots = /screenshot|ภาพหน้าจอ|ภาพถ่ายหน้าจอ/i.test(a.title);
    if (!bank && !shots) continue;
    if (!a.assetCount) continue;
    const first = await MediaLibrary.getAssetsAsync({ album: a, first: 1, mediaType: MediaLibrary.MediaType.photo, sortBy: [[MediaLibrary.SortBy.creationTime, false]] }).catch(() => null);
    out.push({ id: a.id, title: a.title, count: a.assetCount, bank, thumb: first?.assets[0]?.uri ?? null });
  }
  return out.sort((x, y) => Number(y.bank) - Number(x.bank) || y.count - x.count);
}

/** Photos added to the chosen albums since the last check (newest first, at most MAX_SLIPS). */
export async function checkNew(a: AutoSlips): Promise<NewSlips | null> {
  if (!a.on || !a.albums.length) return null;
  const perm = await MediaLibrary.getPermissionsAsync(false, ['photo']).catch(() => null);
  if (!perm?.granted || perm.accessPrivileges === 'limited') return null;
  const found: { asset: MediaLibrary.Asset; album: string }[] = [];
  for (const al of a.albums) {
    const page = await MediaLibrary.getAssetsAsync({
      album: al.id,
      createdAfter: a.since,
      first: MAX_SLIPS,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    }).catch(() => null);
    for (const asset of page?.assets ?? []) if (asset.creationTime > a.since) found.push({ asset, album: al.title });
  }
  // The same photo can sit in two albums (a bank album and Screenshots): count it once.
  const seen = new Set<string>();
  const unique = found.filter((f) => (seen.has(f.asset.id) ? false : (seen.add(f.asset.id), true))).sort((x, y) => y.asset.creationTime - x.asset.creationTime);
  if (!unique.length) return null;
  return { assets: unique.slice(0, MAX_SLIPS).map((f) => f.asset), albums: [...new Set(unique.map((f) => f.album))], since: a.since };
}

/** Make each photo small enough to send (a slip reads fine at 1000px wide), then hand them to the Slips screen. */
export async function prepareForKip(assets: MediaLibrary.Asset[]): Promise<number> {
  const picked: PickedSlip[] = [];
  for (const asset of assets) {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      const src = info.localUri ?? asset.uri;
      const ref = await ImageManipulator.manipulate(src)
        .resize({ width: Math.min(1000, asset.width || 1000) })
        .renderAsync();
      const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      if (out.base64) picked.push({ uri: out.uri, base64: out.base64, mimeType: 'image/jpeg' });
    } catch {
      // A photo that can't be opened (e.g. still in iCloud) is skipped; the rest still go.
    }
  }
  setPickedSlips(picked);
  return picked.length;
}

/** After handing slips to Kip: next time, only look at photos newer than these. */
export async function markChecked(a: AutoSlips, assets: MediaLibrary.Asset[]) {
  const newest = Math.max(a.since, ...assets.map((x) => x.creationTime));
  await saveAuto({ ...a, since: newest });
}
