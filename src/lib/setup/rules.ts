// What Kip actually does with the payday-habit answers. These same lines show on the habits step
// ("What I'll do about it") and in the plan ("How Kip runs it"), so the answers are never just decoration.
import { livingFor, type Inputs } from '@/lib/brain';
import type { IconKey } from '@/lib/budget';
import { CATEGORY } from '@/lib/budget';
import { t } from '@/lib/i18n';
import { baht } from '@/lib/money';
import { colors, money } from '@/theme';

import type { Leak, MoneyStyle } from './draft';

const r100 = (n: number) => Math.max(100, Math.round(n / 100) * 100);

/** What happens on payday, for each answer to "Payday hits. What happens first?" */
export const PAYDAY: Record<MoneyStyle, { label: string; does: string }> = {
  treat: {
    get label() {
      return t('Treat myself — I earned it');
    },
    get does() {
      return t('Then your saving still moves first, and your payday treat comes out of fun money — no guilt, it’s planned.');
    },
  },
  bills: {
    get label() {
      return t('Pay the bills, then see');
    },
    get does() {
      return t('Then I’ll pay rent and bills first in your plan, and move your saving the same day so nothing is left to “see”.');
    },
  },
  save: {
    get label() {
      return t('Save some straight away');
    },
    get does() {
      return t('Love it. I’ll move your saving on payday morning for you, every month.');
    },
  },
  disappears: {
    get label() {
      return t('Honestly? It just… disappears');
    },
    get does() {
      return t('Then I’ll move your saving on payday morning, before you can spend it — and show you only what’s left.');
    },
  },
};

/** A leak's colour is the budget it comes from (Food, Transport, Shopping, Fun, Health & beauty, Bills) — same budget, same colour, on purpose. */
export const LEAK_COLOR: Record<Leak, string> = {
  delivery: CATEGORY.food.color,
  grab: CATEGORY.transport.color,
  shopping: CATEGORY.shopping.color,
  coffee: CATEGORY.food.color,
  goingOut: money.fun,
  beauty: CATEGORY.health_beauty.color,
  snacks: CATEGORY.food.color,
  bubbleTea: money.fun,
  subscriptions: money.fixed,
  games: money.fun,
  treating: money.fun,
  sales: CATEGORY.shopping.color,
};

export type LeakRule = { key: Leak; title: string; icon: IconKey; color: string; rule: string };

/** One rule per leak the person picked, with real amounts from their own living costs. */
export function leakRules(leaks: Leak[], i: Inputs): LeakRule[] {
  const L = livingFor(i);
  const deliveryWeek = r100((L.food * 0.6) / 4.33);
  const coffeeWeek = r100(Math.min(600, L.food * 0.08));
  const snacksWeek = r100(Math.min(400, L.food * 0.06));
  const bubbleWeek = r100(Math.max(100, Math.min(200, i.income * 0.006))) || 100;
  const gamesMonth = r100(Math.max(200, Math.min(1000, i.income * 0.02)));
  const treatMonth = r100(Math.max(300, Math.min(1500, i.income * 0.03)));
  const all: Record<Leak, LeakRule> = {
    delivery: {
      key: 'delivery',
      title: t('Food delivery'),
      icon: 'food',
      color: CATEGORY.food.color,
      rule: t('A delivery budget of {amount} a week, inside Food. I nudge you at 8 pm if it’s nearly gone.', { amount: baht(deliveryWeek) }),
    },
    grab: { key: 'grab', title: t('Grab late at night'), icon: 'travel', color: CATEGORY.transport.color, rule: t('Late rides come from Transport. After 10 pm I show what’s left before you book.') },
    shopping: {
      key: 'shopping',
      title: t('Online shopping'),
      icon: 'shop',
      color: CATEGORY.shopping.color,
      rule: t('Anything over ฿500 goes on a 24-hour wait list first. Still want it tomorrow? Go for it.'),
    },
    coffee: { key: 'coffee', title: t('Coffee'), icon: 'food', color: CATEGORY.food.color, rule: t('Café coffee up to {amount} a week. Coffee at home doesn’t count.', { amount: baht(coffeeWeek) }) },
    goingOut: { key: 'goingOut', title: t('Going out'), icon: 'fun', color: money.fun, rule: t('Nights out come from Fun money. On Friday I tell you what you can spend this weekend.') },
    beauty: { key: 'beauty', title: t('Beauty'), icon: 'lipstick', color: CATEGORY.health_beauty.color, rule: t('Beauty buys come from Fun money, and restocks get planned — no surprise hauls.') },
    snacks: {
      key: 'snacks',
      title: t('7-Eleven snacks'),
      icon: 'shop',
      color: CATEGORY.food.color,
      rule: t('7-Eleven runs up to {amount} a week, inside Food. Every Sunday I show you the tally.', { amount: baht(snacksWeek) }),
    },
    bubbleTea: {
      key: 'bubbleTea',
      title: t('Bubble tea'),
      icon: 'food',
      color: money.fun,
      rule: t('Bubble tea twice a week ({amount}) from Fun money. The third cup waits until next week.', { amount: baht(bubbleWeek) }),
    },
    subscriptions: {
      key: 'subscriptions',
      title: t('Subscriptions'),
      icon: 'bill',
      color: money.fixed,
      rule: t('Every payday I list your subscriptions and ask which ones you still use. One tap to drop one.'),
    },
    games: {
      key: 'games',
      title: t('Games & top-ups'),
      icon: 'fun',
      color: money.fun,
      rule: t('Top-ups up to {amount} a month from Fun money. I ask once before you go over.', { amount: baht(gamesMonth) }),
    },
    treating: {
      key: 'treating',
      title: t('Treating friends'),
      icon: 'gift',
      color: money.fun,
      rule: t('A {amount} “treating” budget inside Fun money — pay for the table without the guilt.', { amount: baht(treatMonth) }),
    },
    sales: {
      key: 'sales',
      title: t('Sale days'),
      icon: 'shop',
      color: CATEGORY.shopping.color,
      rule: t('Before 9.9, 11.11 and 12.12 I remind you of your goal and set a sale budget. Carts wait 24 hours.'),
    },
  };
  return leaks.map((k) => all[k]);
}
