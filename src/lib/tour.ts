// The first-use tour (approved mockup): spots on screen register themselves here by name, and the tour measures
// each one in the window when it's its turn — so the bright cut-out sits exactly on the real button, wherever the
// layout puts it. Shown once per person (remembered on this phone).
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TourSpot = 'today' | 'month' | 'week' | 'plus' | 'kip' | 'plan' | 'goals' | 'you';
export type Rect = { x: number; y: number; width: number; height: number };

type Measurable = { measureInWindow?: (cb: (x: number, y: number, width: number, height: number) => void) => void };
const spots = new Map<TourSpot, Measurable>();

/** `ref={tourSpot('plus')}` on the view the tour should point at. */
export const tourSpot = (id: TourSpot) => (node: unknown) => {
  if (node) spots.set(id, node as Measurable);
  else spots.delete(id);
};

/** Where a spot is on screen right now (null if it isn't there). */
export function measureSpot(id: TourSpot): Promise<Rect | null> {
  const node = spots.get(id);
  const measure = node?.measureInWindow;
  if (!node || !measure) return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    measure.call(node, (x, y, width, height) => {
      done = true;
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
    setTimeout(() => !done && resolve(null), 500);
  });
}

const key = (uid: string) => `heykip.tour.v1.${uid}`;
export const tourSeen = async (uid: string) => (await AsyncStorage.getItem(key(uid)).catch(() => null)) === 'done';
export const markTourSeen = (uid: string) => AsyncStorage.setItem(key(uid), 'done').catch(() => {});
