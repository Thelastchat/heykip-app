// Plus through Apple's In-App Purchase (DPLA 3.3.1(C), Attachment 2): RevenueCat talks to the App Store, and the
// server turns Plus on only when RevenueCat tells it a purchase is real (supabase/functions/revenuecat). The app
// never sets the plan itself — after a purchase it just waits for the server's answer.
//
// Keys: these are RevenueCat's *public* SDK keys, made to sit inside the app. The secret key never comes here.
// In Expo Go and on the web there's no App Store, so RevenueCat's Test Store stands in (a test purchase, no money).
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesPackage } from 'react-native-purchases';

const APPLE_KEY = 'appl_dYOwmxNYkhqwzcPXTqqUhQJEIag';
const TEST_STORE_KEY = 'test_pcVPtdNWEIfZIspvsiptusiHFzU';
/** The entitlement Plus unlocks, as set up in RevenueCat. */
export const ENTITLEMENT = 'plus';

/** Expo Go or the web: no App Store, so the Test Store. */
const testStore = Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
/** Android isn't set up in RevenueCat yet. */
const supported = Platform.OS === 'ios' || testStore;

let configuredFor: string | null = null;

/** Signed in: purchases belong to this HeyKip account (its id is what the server sees). */
export async function startPurchases(uid: string) {
  if (!supported) return;
  try {
    if (!configuredFor) {
      Purchases.configure({ apiKey: testStore ? TEST_STORE_KEY : APPLE_KEY, appUserID: uid });
    } else if (configuredFor !== uid) {
      await Purchases.logIn(uid);
    }
    configuredFor = uid;
  } catch {
    // Not fatal: buying Plus says so if the store isn't there.
  }
}

/** Signed out: the next person on this phone doesn't inherit these purchases. */
export async function stopPurchases() {
  if (!configuredFor) return;
  configuredFor = null;
  await Purchases.logOut().catch(() => {});
}

/** The monthly Plus package from RevenueCat's current offering (null when there isn't one yet). */
export async function plusPackage(): Promise<PurchasesPackage | null> {
  if (!configuredFor) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current?.monthly ?? offerings.current?.availablePackages[0] ?? null;
}

export type BuyResult = 'bought' | 'cancelled' | 'unavailable' | { error: string };

/** Apple's purchase sheet for Plus. The free week is the subscription's introductory offer, decided by Apple. */
export async function buyPlus(): Promise<BuyResult> {
  if (!supported || !configuredFor) return 'unavailable';
  try {
    const pkg = await plusPackage();
    if (!pkg) return 'unavailable';
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active[ENTITLEMENT] ? 'bought' : { error: 'not active' };
  } catch (e) {
    const err = e as { userCancelled?: boolean; code?: string; message?: string };
    if (err.userCancelled || err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return 'cancelled';
    return { error: err.message ?? String(e) };
  }
}

/** "Restore purchases" (App Review 3.1.1): finds a Plus bought on this Apple ID before. True when Plus is active. */
export async function restorePlus(): Promise<boolean> {
  if (!supported || !configuredFor) return false;
  const info = await Purchases.restorePurchases();
  return !!info.entitlements.active[ENTITLEMENT];
}

/** Apple's own subscription page (cancel, change) — iOS only. */
export async function manageSubscription() {
  if (Platform.OS === 'ios' && !testStore) await Purchases.showManageSubscriptions().catch(() => {});
}

/**
 * After a purchase: the server turns Plus on when RevenueCat's notice arrives (usually a few seconds). Asks the
 * profile again until it says Plus, or gives up after `seconds` (the purchase is still safe — Plus turns on later).
 */
export async function waitForPlus(isPlusNow: () => Promise<boolean>, seconds = 15): Promise<boolean> {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    if (await isPlusNow()) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}
