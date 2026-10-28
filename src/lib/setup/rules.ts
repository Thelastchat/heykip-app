// What Kip actually does with the payday-habit answers. These same lines show on the habits step
// ("What I'll do about it") and in the plan ("How Kip runs it"), so the answers are never just decoration.
import { livingFor, type Inputs } from '@/lib/brain';
import type { IconKey } from '@/lib/budget';
import { CATEGORY } from '@/lib/budget';
import { baht } from '@/lib/money';
import { colors, money } from '@/theme';

import type { Leak, MoneyStyle } from './draft';

const r100 = (n: number) => Math.max(100, Math.round(n / 100) * 100);

/** What happens on payday, for each answer to "Payday hits. What happens first?" */
export const PAYDAY: Record<MoneyStyle, { label: string; does: string }> = {
  treat: { label: 'Treat myself — I earned it', does: 'Then your saving still moves first, and your payday treat comes out of fun money — no guilt, it’s planned.' },
  bills: { label: 'Pay the bills, then see', does: 'Then I’ll pay rent and bills first in your plan, and move your saving the same day so nothing is left to “see”.' },
  save: { label: 'Save some straight away', does: 'Love it. I’ll move your saving on payday morning for you, every month.' },
  disappears: { label: 'Honestly? It just… disappears', does: 'Then I’ll move your saving on payday morning, before you can spend it — and show you only what’s left.' },
};

export type LeakRule = { key: Leak; title: string; icon: IconKey; color: string; rule: string };

/** One rule per leak the person picked, with real amounts from their own living costs. */
export function leakRules(leaks: Leak[], i: Inputs): LeakRule[] {
  const L = livingFor(i);
  const deliveryWeek = r100((L.food * 0.6) / 4.33);
  const coffeeWeek = r100(Math.min(600, L.food * 0.08));
  const all: Record<Leak, LeakRule> = {
    delivery: { key: 'delivery', title: 'Food delivery', icon: 'food', color: CATEGORY.food.color, rule: `A delivery budget of ${baht(deliveryWeek)} a week, inside Food. I nudge you at 8 pm if it’s nearly gone.` },
    grab: { key: 'grab', title: 'Grab late at night', icon: 'travel', color: CATEGORY.transport.color, rule: 'Late rides come from Transport. After 10 pm I show what’s left before you book.' },
    shopping: { key: 'shopping', title: 'Online shopping', icon: 'shop', color: CATEGORY.shopping.color, rule: 'Anything over ฿500 goes on a 24-hour wait list first. Still want it tomorrow? Go for it.' },
    coffee: { key: 'coffee', title: 'Coffee', icon: 'food', color: colors.sage, rule: `Café coffee up to ${baht(coffeeWeek)} a week. Coffee at home doesn’t count.` },
    goingOut: { key: 'goingOut', title: 'Going out', icon: 'fun', color: money.fun, rule: 'Nights out come from Fun money. On Friday I tell you what you can spend this weekend.' },
    beauty: { key: 'beauty', title: 'Beauty', icon: 'lipstick', color: CATEGORY.health_beauty.color, rule: 'Beauty buys come from Fun money, and restocks get planned — no surprise hauls.' },
  };
  return leaks.map((k) => all[k]);
}
