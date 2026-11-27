// Where the sign-in session lives on the phone: the iOS Keychain (encrypted by the system, never in backups, never
// moved to another phone), not a plain file. Sessions are longer than one Keychain item likes on Android, so they're
// split into parts. A session saved by an older build (in AsyncStorage) is moved over once and the old copy removed,
// so nobody is signed out by the update. The web build (tests) keeps AsyncStorage: there's no Keychain there.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PART = 1800;
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
/** Keychain keys may only use letters, digits, ".", "-" and "_". */
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

async function read(key: string): Promise<string | null> {
  const k = safe(key);
  const n = Number(await SecureStore.getItemAsync(`${k}.n`, opts));
  if (!n) return null;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = await SecureStore.getItemAsync(`${k}.${i}`, opts);
    if (p == null) return null; // half-written: treat as signed out rather than guess
    parts.push(p);
  }
  return parts.join('');
}

async function write(key: string, value: string) {
  const k = safe(key);
  const before = Number(await SecureStore.getItemAsync(`${k}.n`, opts)) || 0;
  const n = Math.max(1, Math.ceil(value.length / PART));
  for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * PART, (i + 1) * PART), opts);
  await SecureStore.setItemAsync(`${k}.n`, String(n), opts);
  for (let i = n; i < before; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, opts);
}

async function remove(key: string) {
  const k = safe(key);
  const n = Number(await SecureStore.getItemAsync(`${k}.n`, opts)) || 0;
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, opts);
  await SecureStore.deleteItemAsync(`${k}.n`, opts);
  await AsyncStorage.removeItem(key);
}

export const sessionStorage =
  Platform.OS === 'web'
    ? AsyncStorage
    : {
        async getItem(key: string) {
          const v = await read(key);
          if (v != null) return v;
          // An older build kept the session in a plain file: move it into the Keychain, then delete the file copy.
          const old = await AsyncStorage.getItem(key);
          if (old != null) {
            await write(key, old);
            await AsyncStorage.removeItem(key);
          }
          return old;
        },
        setItem: write,
        removeItem: remove,
      };
