// Evening check-in (approved mockup): one nudge a night to log what you spent, at the time chosen in You. Off until
// they switch it on (Apple, DPLA Attachment 1: a reminder to use the app needs a clear yes). Made on the phone with
// local notifications, like bill reminders: the next two weeks of nights are set ahead, and tonight's is dropped as
// soon as something is logged today. Opening HeyKip sets them again, so someone away for two weeks stops getting them.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { nightsAhead, ymd } from '@/lib/checkinDays';
import { notifications, askPhone } from '@/lib/reminders';

const ON_KEY = 'heykip.checkin';
const TIME_KEY = 'heykip.checkin.time';
const LOGGED_KEY = 'heykip.checkin.logged';
const TODAY_KEY = 'heykip.checkin.today'; // today's money, as Home last worked it out
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

/**
 * Home tells the check-in how much today has, so tonight's nudge can say it ("฿360 for today and nothing logged
 * yet"). Worked out on the phone — no AI. Only tonight's uses it; nights further ahead keep the plain line.
 */
export async function noteToday(amount: number) {
  const v = JSON.stringify({ day: ymd(new Date()), amount: Math.round(amount) });
  if ((await AsyncStorage.getItem(TODAY_KEY).catch(() => null)) === v) return;
  await AsyncStorage.setItem(TODAY_KEY, v).catch(() => {});
  await syncCheckin();
}

/** Make the phone's waiting check-ins match the switch and time. Quiet: never asks, never throws. */
export async function syncCheckin() {
  const N = notifications();
  if (!N) return;
  try {
    for (const n of await N.getAllScheduledNotificationsAsync()) if (n.identifier.startsWith(PREFIX)) await N.cancelScheduledNotificationAsync(n.identifier);
    if (!(await checkinOn()) || !(await N.getPermissionsAsync()).granted) return;
    const [[, time], [, logged], [, todayRaw]] = await AsyncStorage.multiGet([TIME_KEY, LOGGED_KEY, TODAY_KEY]);
    let today: { day: string; amount: number } | null = null;
    try {
      today = todayRaw ? JSON.parse(todayRaw) : null;
    } catch {
      today = null;
    }
    for (const at of nightsAhead(new Date(), time ?? '21:00', logged)) {
      const mine = today && today.day === ymd(at) && today.amount > 0;
      await N.scheduleNotificationAsync({
        identifier: PREFIX + ymd(at),
        content: {
          title: 'HeyKip',
          body: mine ? t('{amount} for today and nothing logged yet. Spent anything?', { amount: baht(today!.amount) }) : t('Anything to log today? Tap to add it — takes a few seconds.'),
          data: { url: '/add' },
        },
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
