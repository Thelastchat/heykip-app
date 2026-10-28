// Goal types (Trip, Family, Beauty…) and Kip's suggested goals, sized to the person's own month.
import { safetyNet, verdict, type Inputs } from '@/lib/brain';
import type { IconKey } from '@/lib/budget';
import { colors } from '@/theme';

import type { GoalKind, SetupDraft } from './draft';
import { inputsFrom, isoDay, monthsFromNow } from './plan';

export type GoalTypeKey =
  | 'trip' | 'family' | 'gift' | 'emergency' | 'monthly' | 'gadget' | 'learning' | 'beauty'
  | 'clothes' | 'health' | 'concert' | 'car' | 'home' | 'wedding' | 'card' | 'other';

/** kind = how Kip plans it: an amount by a date, an emergency fund, or an amount every month. */
export type GoalTypeInfo = { key: GoalTypeKey; label: string; icon: IconKey; color: string; kind: GoalKind; example: string };

export const GOAL_TYPES: GoalTypeInfo[] = [
  { key: 'trip', label: 'Trip', icon: 'plane', color: colors.lime, kind: 'trip', example: 'Trip to Japan' },
  { key: 'family', label: 'Family', icon: 'family', color: colors.peach, kind: 'monthly', example: 'Help Mom & Dad' },
  { key: 'gift', label: 'Gift', icon: 'gift', color: colors.pink, kind: 'gadget', example: 'Sister’s birthday' },
  { key: 'emergency', label: 'Emergency', icon: 'shield', color: colors.sage, kind: 'safety_net', example: 'Emergency fund' },
  { key: 'monthly', label: 'Monthly', icon: 'cash', color: colors.orange, kind: 'monthly', example: 'My savings' },
  { key: 'gadget', label: 'Gadget', icon: 'phone', color: colors.lavender, kind: 'gadget', example: 'New iPhone' },
  { key: 'learning', label: 'Learning', icon: 'book', color: colors.clay, kind: 'gadget', example: 'A course for my career' },
  { key: 'beauty', label: 'Beauty', icon: 'lipstick', color: colors.pink, kind: 'gadget', example: 'Skincare restock' },
  { key: 'clothes', label: 'Clothes', icon: 'shirt', color: colors.sky, kind: 'gadget', example: 'A new outfit' },
  { key: 'health', label: 'Health', icon: 'health', color: colors.lavender, kind: 'gadget', example: 'Dental work' },
  { key: 'concert', label: 'Concerts', icon: 'note', color: colors.orange, kind: 'gadget', example: 'Concert ticket' },
  { key: 'car', label: 'Car', icon: 'travel', color: colors.sky, kind: 'car', example: 'My first car' },
  { key: 'home', label: 'Home', icon: 'rent', color: colors.clay, kind: 'home', example: 'Condo down payment' },
  { key: 'wedding', label: 'Wedding', icon: 'ring', color: colors.pink, kind: 'gadget', example: 'Our wedding' },
  { key: 'card', label: 'Pay off card', icon: 'bill', color: colors.sand, kind: 'gadget', example: 'Pay off my card' },
  { key: 'other', label: 'Other', icon: 'plus', color: colors.lime, kind: 'gadget', example: 'Name your goal' },
];

export const typeInfo = (key: string | null | undefined, kind?: GoalKind): GoalTypeInfo =>
  GOAL_TYPES.find((t) => t.key === key) ??
  GOAL_TYPES.find((t) => t.kind === kind && t.key !== 'family') ??
  GOAL_TYPES[GOAL_TYPES.length - 1];

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
  { id: 'mom', type: 'family', title: 'Help Mom & Dad', why: 'A steady amount each payday — the kind of help that adds up.', monthly: (i) => r500(Math.min(3000, i.income * 0.05)) },
  { id: 'bday', type: 'gift', title: 'Sister’s birthday', why: 'Small and soon — a gift with no guilt and no card.', target: (i) => r500(Math.min(3000, i.income * 0.1)) },
  { id: 'japan', type: 'trip', title: 'Trip to Japan', why: 'Five days, a budget hotel and a JR pass, paid in full.', target: () => 45000 },
  { id: 'cnx', type: 'trip', title: 'Weekend in Chiang Mai', why: 'Flights, a nice guesthouse and khao soi — a real break.', target: () => 8000 },
  { id: 'korea', type: 'trip', title: 'Trip to Seoul', why: 'Cafés, shopping and street food for a week.', target: () => 35000 },
  { id: 'concert', type: 'concert', title: 'Concert ticket', why: 'One good seat, bought on day one, no credit card.', target: () => 5500 },
  { id: 'course', type: 'learning', title: 'A course for my career', why: 'The goal that pays you back — more skills, better pay.', target: () => 5000 },
  { id: 'iphone', type: 'gadget', title: 'New iPhone', why: 'Paid in full instead of a 10-month instalment.', target: () => 35000 },
  { id: 'skin', type: 'beauty', title: 'Skincare restock', why: 'Your routine for months, bought without dipping into food money.', target: () => 2500 },
  { id: 'outfit', type: 'clothes', title: 'A new outfit', why: 'For the wedding, the interview, or just because.', target: () => 3000 },
  { id: 'dental', type: 'health', title: 'Dental check & cleaning', why: 'Boring, important, and cheaper before it hurts.', target: () => 2000 },
  { id: 'habit', type: 'monthly', title: 'Save every month', why: 'No target — just the habit. The money is there when life happens.', monthly: (i) => r500(Math.min(5000, i.income * 0.08)) },
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
  return { id: 'emergency', type: 'emergency', title: 'Emergency fund', target, monthly: null, months: v.months, why: 'Three months of your costs. Start here — it keeps every other goal safe.', kipsPick: true };
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
