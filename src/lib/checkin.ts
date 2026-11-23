// Evening check-in (approved mockup): one nudge a night to log what you spent, at the time chosen in You. Off until
// they switch it on (Apple, DPLA Attachment 1: a reminder to use the app needs a clear yes). Made on the phone with
// local notifications, like bill reminders: the next two weeks of nights are set ahead, and tonight's is dropped as
// soon as something is logged today. Opening HeyKip sets them again, so someone away for two weeks stops getting them.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { t } from '@/lib/i18n';
import { nightsAhead, ymd } from '@/lib/checkinDays';
import { notifications, askPhone } from '@/lib/reminders';

const ON_KEY = 'heykip.checkin';
const TIME_KEY = 'heykip.checkin.time';
const LOGGED_KEY = 'heykip.checkin.logged';
const PREFIX = 'checkin:';

export async function checkinOn(): Promise<boolean> {
  return (await AsyncStorage.getItem(ON_KEY).catch(() => null)) === 'on';
}

/** Turn the check-in on (asks the iPhone the first time) or off (clears the waiting ones). True when it's on. */
export async function setCheckin(on: boolean, time: string): Promise<boolean> {
  await AsyncStorage.multiSet([
    [ON_KEY, on ? 'on' : 'off'],
    [TIME_KEY, time],
  ]).catch(() => {});
  if (on) await askPhone();
  await syncCheckin();
  return on;
}

/** A new time for the check-in (from the sheet in You). */
export async function setCheckinTime(time: string) {
  await AsyncStorage.setItem(TIME_KEY, time).catch(() => {});
  await syncCheckin();
}

/** Something was logged: no nudge tonight. */
export async function loggedToday() {
  await AsyncStorage.setItem(LOGGED_KEY, ymd(new Date())).catch(() => {});
  const N = notifications();
  if (N) await N.cancelScheduledNotificationAsync(PREFIX + ymd(new Date())).catch(() => {});
}

/** Make the phone's waiting check-ins match the switch and time. Quiet: never asks, never throws. */
export async function syncCheckin() {
  const N = notifications();
  if (!N) return;
  try {
    for (const n of await N.getAllScheduledNotificationsAsync()) if (n.identifier.startsWith(PREFIX)) await N.cancelScheduledNotificationAsync(n.identifier);
    if (!(await checkinOn()) || !(await N.getPermissionsAsync()).granted) return;
    const [[, time], [, logged]] = await AsyncStorage.multiGet([TIME_KEY, LOGGED_KEY]);
    for (const at of nightsAhead(new Date(), time ?? '21:00', logged)) {
      await N.scheduleNotificationAsync({
        identifier: PREFIX + ymd(at),
        content: { title: 'HeyKip', body: t('Anything to log today? Tap to add it — takes a few seconds.'), data: { url: '/add' } },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
  } catch {
    // Not worth breaking anything for; the next time HeyKip opens tries again.
  }
}

/** In the root layout: tapping a check-in opens Add (also when it started HeyKip), and opening HeyKip sets the next nights. */
export function useCheckinTaps() {
  useEffect(() => {
    const N = notifications();
    if (!N) return;
    syncCheckin();
    const go = (r: { notification: { request: { content: { data?: Record<string, unknown> } } } } | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === 'string') setTimeout(() => router.push(url as never), 0);
    };
    go(N.getLastNotificationResponse());
    N.clearLastNotificationResponse(); // once: not again the next time HeyKip opens
    const sub = N.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, []);
}
