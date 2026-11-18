// Kip and the 3D icons are loaded before the splash screen goes, so they are never missing from the first screen.
// In Expo Go every image is fetched from the dev server, and one slow fetch used to leave a blank circle where Kip
// should be; a built app reads them from the bundle, where this is instant. A fetch that fails is tried again
// (3 times), and the app opens anyway after that — a missing icon is better than a stuck splash.
// Done with expo-image's own cache (the same one that shows them), not expo-asset: some Expo Go builds don't carry
// expo-asset's native part, and importing it stopped the app from opening ("Cannot find native module 'ExpoAsset'").
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Platform, Image as RNImage } from 'react-native';

import { ICON3D } from '@/lib/icons3d';

const ASSETS = [require('../../assets/kip/kip-body.png'), require('../../assets/kip/kip-with-eyes.png'), ...Object.values(ICON3D)];

let done: Promise<void> | null = null;

export function preloadImages(): Promise<void> {
  if (!done) {
    done = (async () => {
      if (Platform.OS === 'web') return; // the browser loads them with the page
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const uris = ASSETS.map((a) => RNImage.resolveAssetSource(a)?.uri).filter((u): u is string => Boolean(u));
          // Never hold the splash longer than ~6 seconds for this.
          const ok = await Promise.race([Image.prefetch(uris, 'memory-disk'), new Promise<boolean>((r) => setTimeout(() => r(true), 6000))]);
          if (ok) return;
          throw new Error('not all loaded');
        } catch {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    })();
  }
  return done;
}

/** true once Kip and the icons are on the device (or we stopped trying). */
export function useImagesReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let on = true;
    preloadImages().then(() => on && setReady(true));
    return () => {
      on = false;
    };
  }, []);
  return ready;
}
