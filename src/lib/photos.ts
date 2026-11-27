// Photos are made small on the phone before they're uploaded: a goal photo fills a phone screen at 1080px wide,
// a profile photo needs 400px. A 4 MB camera photo becomes ~150 KB, so storage and every later download cost
// a fraction (Supabase charges for what's stored and what's downloaded).
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

async function bytesOf(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web' || uri.startsWith('data:') || uri.startsWith('blob:')) return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

/** A small JPEG of the photo, ready to upload. Falls back to the original if it can't be resized. */
export async function smallPhoto(uri: string, width: number): Promise<{ bytes: ArrayBuffer; ext: 'jpg'; contentType: 'image/jpeg' } | { bytes: ArrayBuffer; ext: string; contentType: string }> {
  try {
    const ref = await ImageManipulator.manipulate(uri).resize({ width }).renderAsync();
    const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.72 });
    return { bytes: await bytesOf(out.uri), ext: 'jpg', contentType: 'image/jpeg' };
  } catch {
    const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
    return { bytes: await bytesOf(uri), ext, contentType: ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : ext === 'webp' ? 'image/webp' : 'image/jpeg' };
  }
}

/** Where a profile photo is kept: avatars/<account>/<file>. Older rows hold the full public address; both work. */
export function avatarPath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const m = stored.match(/\/object\/(?:public|sign)\/avatars\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  return stored.startsWith('avatars/') ? stored.slice('avatars/'.length) : null;
}

/**
 * The profile photo, ready to show. The avatars bucket is private (28 Nov): only the person can read their own
 * photo, through a link that stops working after a week. Null if there's none or it can't be signed.
 */
export async function avatarSrc(stored: string | null | undefined): Promise<string | null> {
  const path = avatarPath(stored);
  if (!path) return null;
  const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 7 * 24 * 3600);
  return data?.signedUrl ?? null;
}
