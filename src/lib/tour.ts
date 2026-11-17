// The first-use tour (approved mockup): spots on screen register themselves here by name, and the tour measures
// each one in the window when it's its turn — so the bright cut-out sits exactly on the real button, wherever the
// layout puts it. Shown once per person (remembered on this phone).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRef } from 'react';

export type TourSpot =
  | 'today'
  | 'month'
  | 'week'
  | 'bills'
  | 'plus'
  | 'kip'
  | 'plan'
  | 'goals'
  | 'you'
  | 'planFlow'
  | 'planSaving'
  | 'planBills'
  | 'planSpend'
  | 'goalTotals'
  | 'goalCard'
  | 'goalPut'
  | 'goalAdd'
  | 'addKind'
  | 'addAmount'
  | 'addCats'
  | 'addSlip';
/** One tour per screen, each shown once. */
export type TourName = 'home' | 'plan' | 'goals' | 'add';
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

// v2: Home's tour grew from 4 stops to 9, so everyone sees it once more.
const VERSION: Record<TourName, number> = { home: 2, plan: 1, goals: 1, add: 1 };
export const tourKey = (name: TourName, uid: string) => `heykip.tour.${name}.v${VERSION[name]}.${uid}`;
export const tourSeen = async (name: TourName, uid: string) => (await AsyncStorage.getItem(tourKey(name, uid)).catch(() => null)) === 'done';
export const markTourSeen = (name: TourName, uid: string) => AsyncStorage.setItem(tourKey(name, uid), 'done').catch(() => {});

/**
 * Lets the tour scroll a screen to a spot below the fold: spread `props` on the screen's ScrollView and pass
 * `scrollBy` to the Tour.
 */
export function useTourScroll() {
  const node = useRef<{ scrollTo?: (o: { y: number; animated?: boolean }) => void } | null>(null);
  const off = useRef(0);
  const props = {
    ref: (n: unknown) => {
      node.current = n as typeof node.current;
    },
    scrollEventThrottle: 16,
    onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      off.current = e.nativeEvent.contentOffset.y;
    },
  };
  const scrollBy = (dy: number) => node.current?.scrollTo?.({ y: Math.max(0, off.current + dy), animated: true });
  return { props, scrollBy };
}
