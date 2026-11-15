// Kip and the 3D icons are loaded before the splash screen goes, so they are never missing from the first screen.
// In Expo Go every image is fetched from the dev server, and one slow fetch used to leave a blank circle where Kip
// should be; a built app reads them from the bundle, where this is instant. A fetch that fails is tried again
// (3 times), and the app opens anyway after that — a missing icon is better than a stuck splash.
import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';

import { ICON3D } from '@/lib/icons3d';

const ASSETS = [require('../../assets/kip/kip-body.png'), require('../../assets/kip/kip-with-eyes.png'), ...Object.values(ICON3D)];

let done: Promise<void> | null = null;

export function preloadImages(): Promise<void> {
  if (!done) {
    done = (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await Asset.loadAsync(ASSETS);
          return;
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
