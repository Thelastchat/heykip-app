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
export const ENTITLEMENT = 'heykip_plus';

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

/** One way to pay for Plus, as the store prices it for this person (their currency, their storefront). */
export type PlusPlan = { key: 'yearly' | 'monthly'; pkg: PurchasesPackage; price: string; perMonth: string | null; freeWeek: boolean };

/** Yearly first, then Monthly, from RevenueCat's current offering. Empty when the store can't be reached. */
export async function plusPlans(): Promise<PlusPlan[]> {
  if (!supported || !configuredFor) return [];
  try {
    const current = (await Purchases.getOfferings()).current;
    const pkgs = [current?.annual, current?.monthly].filter((p): p is PurchasesPackage => !!p);
    // The free week is Apple's introductory offer: only for someone who hasn't had one in this group before.
    const free = new Set<string>();
    const withIntro = pkgs.filter((p) => p.product.introPrice?.price === 0).map((p) => p.product.identifier);
    if (withIntro.length && testStore) withIntro.forEach((id) => free.add(id));
    else if (withIntro.length) {
      // Unknown counts as "no free week": never promise one Apple might not give.
      const seen = await Purchases.checkTrialOrIntroductoryPriceEligibility(withIntro).catch(() => ({}) as Record<string, { status: number }>);
      for (const id of withIntro) if (seen[id]?.status === Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE) free.add(id);
    }
    return pkgs.map((pkg) => ({
      key: pkg === current?.annual ? 'yearly' : 'monthly',
      pkg,
      price: pkg.product.priceString,
      perMonth: pkg === current?.annual ? pkg.product.pricePerMonthString : null,
      freeWeek: free.has(pkg.product.identifier),
    }));
  } catch {
    return [];
  }
}

export type BuyResult = 'bought' | 'cancelled' | 'unavailable' | { error: string };

/** Apple's purchase sheet for the plan they picked. The free week, if any, is decided by Apple. */
export async function buyPlus(plan?: PlusPlan): Promise<BuyResult> {
  if (!supported || !configuredFor) return 'unavailable';
  try {
    const pkg = plan?.pkg ?? (await plusPlans())[0]?.pkg;
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
