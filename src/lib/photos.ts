// Photos are made small on the phone before they're uploaded: a goal photo fills a phone screen at 1080px wide,
// a profile photo needs 400px. A 4 MB camera photo becomes ~150 KB, so storage and every later download cost
// a fraction (Supabase charges for what's stored and what's downloaded).
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

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
