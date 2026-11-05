// Goal types (Trip, Family, Beauty…) and Kip's suggested goals, sized to the person's own month.
import { safetyNet, verdict, type Inputs } from '@/lib/brain';
import type { IconKey } from '@/lib/budget';
import { t } from '@/lib/i18n';
import { colors } from '@/theme';

import type { GoalKind, SetupDraft } from './draft';
import { inputsFrom, isoDay, monthsFromNow } from './plan';

export type GoalTypeKey = 'trip' | 'family' | 'gift' | 'emergency' | 'monthly' | 'gadget' | 'learning' | 'beauty' | 'clothes' | 'health' | 'concert' | 'car' | 'home' | 'wedding' | 'card' | 'other';

/** kind = how Kip plans it: an amount by a date, an emergency fund, or an amount every month. */
export type GoalTypeInfo = { key: GoalTypeKey; label: string; icon: IconKey; color: string; kind: GoalKind; example: string };

export const GOAL_TYPES: GoalTypeInfo[] = [
  {
    key: 'trip',
    get label() {
      return t('Trip');
    },
    icon: 'plane',
    color: colors.lime,
    kind: 'trip',
    get example() {
      return t('Trip to Japan');
    },
  },
  {
    key: 'family',
    get label() {
      return t('Family');
    },
    icon: 'family',
    color: colors.peach,
    // Money sent to family each month leaves your account — it lives in Every month, not in goals.
    // A Family goal is saving for something together, like a trip.
    kind: 'trip',
    get example() {
      return t('Family trip to Hua Hin');
    },
  },
  {
    key: 'gift',
    get label() {
      return t('Gift');
    },
    icon: 'gift',
    color: colors.pink,
    kind: 'gadget',
    get example() {
      return t('Sister’s birthday');
    },
  },
  {
    key: 'emergency',
    get label() {
      return t('Emergency');
    },
    icon: 'shield',
    color: colors.sage,
    kind: 'safety_net',
    get example() {
      return t('Emergency fund');
    },
  },
  {
    key: 'monthly',
    get label() {
      return t('Monthly');
    },
    icon: 'cash',
    color: colors.orange,
    kind: 'monthly',
    get example() {
      return t('My savings');
    },
  },
  {
    key: 'gadget',
    get label() {
      return t('Gadget');
    },
    icon: 'phone',
    color: colors.lavender,
    kind: 'gadget',
    get example() {
      return t('New iPhone');
    },
  },
  {
    key: 'learning',
    get label() {
      return t('Learning');
    },
    icon: 'book',
    color: colors.clay,
    kind: 'gadget',
    get example() {
      return t('A course for my career');
    },
  },
  {
    key: 'beauty',
    get label() {
      return t('Beauty');
    },
    icon: 'lipstick',
    color: colors.pink,
    kind: 'gadget',
    get example() {
      return t('Skincare restock');
    },
  },
  {
    key: 'clothes',
    get label() {
      return t('Clothes');
    },
    icon: 'shirt',
    color: colors.sky,
    kind: 'gadget',
    get example() {
      return t('A new outfit');
    },
  },
  {
    key: 'health',
    get label() {
      return t('Health');
    },
    icon: 'health',
    color: colors.lavender,
    kind: 'gadget',
    get example() {
      return t('Dental work');
    },
  },
  {
    key: 'concert',
    get label() {
      return t('Concerts');
    },
    icon: 'note',
    color: colors.orange,
    kind: 'gadget',
    get example() {
      return t('Concert ticket');
    },
  },
  {
    key: 'car',
    get label() {
      return t('Car');
    },
    icon: 'travel',
    color: colors.sky,
    kind: 'car',
    get example() {
      return t('My first car');
    },
  },
  {
    key: 'home',
    get label() {
      return t('Home');
    },
    icon: 'rent',
    color: colors.clay,
    kind: 'home',
    get example() {
      return t('Condo down payment');
    },
  },
  {
    key: 'wedding',
    get label() {
      return t('Wedding');
    },
    icon: 'ring',
    color: colors.pink,
    kind: 'gadget',
    get example() {
      return t('Our wedding');
    },
  },
  {
    key: 'card',
    get label() {
      return t('Pay off card');
    },
    icon: 'bill',
    color: colors.sand,
    kind: 'gadget',
    get example() {
      return t('Pay off my card');
    },
  },
  {
    key: 'other',
    get label() {
      return t('Other');
    },
    icon: 'plus',
    color: colors.lime,
    kind: 'gadget',
    get example() {
      return t('Name your goal');
    },
  },
];

export const typeInfo = (key: string | null | undefined, kind?: GoalKind): GoalTypeInfo =>
  GOAL_TYPES.find((t) => t.key === key) ?? GOAL_TYPES.find((t) => t.kind === kind && t.key !== 'family') ?? GOAL_TYPES[GOAL_TYPES.length - 1];

// ---------- Kip's suggestions ----------

export type Idea = {
  id: string;
  type: GoalTypeKey;
  title: string;
  /** a one-off amount, or null for a monthly goal */
  target: number | null;
  monthly: number | null;
  months: number | null; // at a comfortable pace
  why: string;
  kipsPick?: boolean;
};

type Seed = { id: string; type: GoalTypeKey; title: string; why: string; target?: (i: Inputs) => number; monthly?: (i: Inputs) => number };

const r500 = (n: number) => Math.max(500, Math.round(n / 500) * 500);

const SEEDS: Seed[] = [
  {
    id: 'bday',
    type: 'gift',
    get title() {
      return t('Sister’s birthday');
    },
    get why() {
      return t('Small and soon — a gift with no guilt and no card.');
    },
    target: (i) => r500(Math.min(3000, i.income * 0.1)),
  },
  {
    id: 'japan',
    type: 'trip',
    get title() {
      return t('Trip to Japan');
    },
    get why() {
      return t('Five days, a budget hotel and a JR pass, paid in full.');
    },
    target: () => 45000,
  },
  {
    id: 'cnx',
    type: 'trip',
    get title() {
      return t('Weekend in Chiang Mai');
    },
    get why() {
      return t('Flights, a nice guesthouse and khao soi — a real break.');
    },
    target: () => 8000,
  },
  {
    id: 'korea',
    type: 'trip',
    get title() {
      return t('Trip to Seoul');
    },
    get why() {
      return t('Cafés, shopping and street food for a week.');
    },
    target: () => 35000,
  },
  {
    id: 'concert',
    type: 'concert',
    get title() {
      return t('Concert ticket');
    },
    get why() {
      return t('One good seat, bought on day one, no credit card.');
    },
    target: () => 5500,
  },
  {
    id: 'course',
    type: 'learning',
    get title() {
      return t('A course for my career');
    },
    get why() {
      return t('The goal that pays you back — more skills, better pay.');
    },
    target: () => 5000,
  },
  {
    id: 'iphone',
    type: 'gadget',
    get title() {
      return t('New iPhone');
    },
    get why() {
      return t('Paid in full instead of a 10-month instalment.');
    },
    target: () => 35000,
  },
  {
    id: 'skin',
    type: 'beauty',
    get title() {
      return t('Skincare restock');
    },
    get why() {
      return t('Your routine for months, bought without dipping into food money.');
    },
    target: () => 2500,
  },
  {
    id: 'outfit',
    type: 'clothes',
    get title() {
      return t('A new outfit');
    },
    get why() {
      return t('For the wedding, the interview, or just because.');
    },
    target: () => 3000,
  },
  {
    id: 'dental',
    type: 'health',
    get title() {
      return t('Dental check & cleaning');
    },
    get why() {
      return t('Boring, important, and cheaper before it hurts.');
    },
    target: () => 2000,
  },
  {
    id: 'habit',
    type: 'monthly',
    get title() {
      return t('Save every month');
    },
    get why() {
      return t('No target — just the habit. The money is there when life happens.');
    },
    monthly: (i) => r500(Math.min(5000, i.income * 0.08)),
  },
];

function sized(d: SetupDraft, s: Seed): Idea | null {
  const base = inputsFrom(d);
  if (s.monthly) {
    const m = s.monthly(base);
    const v = verdict({ ...base, goal: { type: 'monthly', title: s.title, target: 0, saved: 0, months: null, monthly: m } });
    return v.kind === 'doable' ? { id: s.id, type: s.type, title: s.title, target: null, monthly: m, months: null, why: s.why } : null;
  }
  const target = (s.target as (i: Inputs) => number)(base);
  const v = verdict({ ...base, goal: { type: 'gadget', title: s.title, target, saved: 0, months: null, monthly: null } });
  if (v.kind !== 'doable' || v.months > 24) return null; // only ideas that fit comfortably within 2 years
  return { id: s.id, type: s.type, title: s.title, target, monthly: null, months: v.months, why: s.why };
}

/** The emergency fund: 3 months of costs — Kip's pick for anyone without one. */
function emergencyIdea(d: SetupDraft): Idea | null {
  const base = inputsFrom(d);
  const target = safetyNet(base).target;
  const v = verdict({ ...base, goal: { type: 'emergency', title: 'Emergency fund', target, saved: 0, months: null, monthly: null } });
  if (v.kind === 'noRoom') return null;
  return {
    id: 'emergency',
    type: 'emergency',
    title: t('Emergency fund'),
    target,
    monthly: null,
    months: v.months,
    why: t('Three months of your costs. Start here — it keeps every other goal safe.'),
    kipsPick: true,
  };
}

/** Every idea that fits this person's month (deck 0 = Kip's pick + the first five; Shuffle deals more). */
export function ideasFor(d: SetupDraft): Idea[] {
  const e = emergencyIdea(d);
  const rest = SEEDS.map((s) => sized(d, s)).filter((x): x is Idea => x !== null);
  return e ? [e, ...rest] : rest;
}

/** A deck of up to 6: Kip's pick stays first; the others rotate with each shuffle. */
export function deal(all: Idea[], shuffle: number): Idea[] {
  const pick = all.filter((i) => i.kipsPick);
  const rest = all.filter((i) => !i.kipsPick);
  if (rest.length === 0) return pick;
  const n = 6 - pick.length;
  const start = (shuffle * n) % rest.length;
  const out: Idea[] = [];
  for (let k = 0; k < Math.min(n, rest.length); k++) out.push(rest[(start + k) % rest.length]);
  return [...pick, ...out];
}

/** Fill the Setup answers from an idea (everything stays editable). */
export function applyIdea(d: SetupDraft, idea: Idea): Partial<SetupDraft> {
  const t = typeInfo(idea.type);
  if (idea.monthly !== null) return { goalType: t.key, goalKind: 'monthly', goalTitle: idea.title, goalMonthly: idea.monthly, goalTarget: null, goalSaved: 0, goalDue: null, goalPerMonth: null };
  return {
    goalType: t.key,
    goalKind: t.kind,
    goalTitle: idea.title,
    goalTarget: idea.target,
    goalSaved: 0,
    goalMonthly: null,
    goalDue: t.kind === 'safety_net' ? null : isoDay(monthsFromNow(idea.months ?? 12, d)),
    goalPerMonth: null,
  };
}
