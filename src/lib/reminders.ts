// Bill reminders on the phone (approved mockup): made on the phone itself with local notifications — no server, no
// cost, and they work in Expo Go. The waiting list is rebuilt from the month whenever bills, due days or paid marks
// change (only when something changed, so opening Home doesn't redo it). One switch in You turns them all off.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { remindersFor } from '@/lib/billdue';
import type { MonthBudget } from '@/lib/budget';
import { t } from '@/lib/i18n';
import { baht } from '@/lib/money';

const OFF_KEY = 'heykip.billReminders';
const SIG_KEY = 'heykip.billReminders.sig';
const native = Platform.OS === 'ios' || Platform.OS === 'android';

// Loaded only on phones: the web build has no local notifications.
type N = typeof import('expo-notifications');
let mod: N | null = null;
function notifications(): N | null {
  if (!native) return null;
  if (!mod) {
    mod = require('expo-notifications') as N;
    // A reminder that arrives while HeyKip is open still shows.
    mod.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  }
  return mod;
}

export async function remindersOn(): Promise<boolean> {
  return (await AsyncStorage.getItem(OFF_KEY).catch(() => null)) !== 'off';
}

/** Turn all bill reminders on or off (off clears the waiting ones straight away). */
export async function setRemindersOn(on: boolean, month: MonthBudget | null) {
  await AsyncStorage.setItem(OFF_KEY, on ? 'on' : 'off').catch(() => {});
  if (on) await askReminders();
  await syncReminders(month, true);
}

/** Ask the phone once, the first time someone sets a reminder. True when allowed. */
export async function askReminders(): Promise<boolean> {
  const N = notifications();
  if (!N) return false;
  const cur = await N.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await N.requestPermissionsAsync()).granted;
}

/** Make the phone's waiting reminders match the month. Quiet: never asks permission, never throws. */
export async function syncReminders(month: MonthBudget | null, force = false) {
  const N = notifications();
  if (!N || !month) return;
  try {
    const on = await remindersOn();
    const list = on ? remindersFor(month) : [];
    const sig = (on ? 'on|' : 'off|') + list.map((r) => `${r.id}@${r.at.getTime()}|${r.amount}`).join(',');
    if (!force && (await AsyncStorage.getItem(SIG_KEY)) === sig) return;
    if (!(await N.getPermissionsAsync()).granted) return;
    for (const n of await N.getAllScheduledNotificationsAsync()) if (n.identifier.startsWith('bill:')) await N.cancelScheduledNotificationAsync(n.identifier);
    for (const r of list) {
      const name = r.key === 'rent' ? t('Rent') : r.name;
      await N.scheduleNotificationAsync({
        identifier: r.id,
        content: {
          title: r.when === 'tomorrow' ? t('{name} {amount} is due tomorrow', { name, amount: baht(r.amount) }) : t('{name} {amount} is due today', { name, amount: baht(r.amount) }),
          body: t('The money’s already set aside. Tick it when it’s paid.'),
        },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.at },
      });
    }
    await AsyncStorage.setItem(SIG_KEY, sig);
  } catch {
    // A reminder that couldn't be set is not worth breaking Home for; the next change tries again.
  }
}
