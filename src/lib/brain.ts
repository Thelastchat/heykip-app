// Kip's money brain — v2. Realistic first, goal-first second.
//
// The order money is planned in, every month:
//   1. Fixed costs you told Kip about: rent + other bills (phone, internet, electricity, instalments).
//   2. Living costs nobody can skip: food, getting around, health & personal, household bits.
//      Kip never plans these below a realistic floor for one person in Thailand.
//   3. A safety net: always something (5% of income, at least ฿500) until it holds 3 months of 1 + 2.
//      Thai banks advise 3–6 months; 3 is the first milestone.
//   4. Your goal.
//   5. Fun money: shopping, going out, treats. Kip keeps some, always — a plan you hate is a plan you quit.
//
// If a goal can't fit by its date, Kip never shows an impossible plan. It says so and works out
// what is possible: a later date, or how much you'd have by your date.

export type GoalType = 'trip' | 'gadget' | 'car' | 'home' | 'emergency' | 'monthly';
export type Style = 'kip' | '503020' | 'jars' | 'savefirst';

export type Inputs = {
  income: number; // per month (salary, or a slow month for changing income)
  rent: number;
  bills: number; // other fixed bills
  goal: { type: GoalType; title: string; target: number; saved: number; months: number | null; monthly: number | null };
  living?: Partial<Living>; // the person's own numbers, when they change Kip's
};

export type Living = { food: number; transport: number; health: number; household: number };

const r10 = (n: number) => Math.round(n / 10) * 10;
const r100 = (n: number) => Math.round(n / 100) * 100;
const f100 = (n: number) => Math.max(0, Math.floor(n / 100) * 100);

/** Realistic monthly living costs for one person. Floors from what things actually cost in Thailand;
 *  above the floor, people with more income spend a bit more (shares from the Commerce Ministry household survey). */
export function living(income: number): Living {
  return {
    food: r100(Math.max(4500, income * 0.18)), // ฿150/day minimum — two cheap meals and a drink
    transport: r100(Math.max(1000, income * 0.06)), // BTS/MRT/bus or motorbike fuel
    health: r100(Math.max(500, income * 0.03)), // pharmacy, toiletries, haircut
    household: r100(Math.max(500, income * 0.02)), // laundry, cleaning, small things for the room
  };
}
export const livingTotal = (l: Living) => l.food + l.transport + l.health + l.household;

/** Kip's realistic numbers, with anything the person changed on top. */
export const livingFor = (i: Inputs): Living => ({ ...living(i.income), ...i.living });

/** Below these, a month isn't really liveable — Kip warns. */
export const LIVING_FLOOR: Living = { food: 4500, transport: 1000, health: 500, household: 500 };

/** Kip's guess for other bills (phone, internet, electricity, water) until it learns the real ones. */
export const billsGuess = (income: number) => r100(Math.max(1000, income * 0.05));

export function safetyNet(i: Inputs) {
  const monthlyCosts = i.rent + i.bills + livingTotal(livingFor(i));
  return {
    monthly: Math.max(500, r100(i.income * 0.05)),
    target: Math.max(10000, Math.round((3 * monthlyCosts) / 5000) * 5000), // 3 months of costs
  };
}

/** How much can go to the goal each month. comfortable = Kip's pick; most = the tightest Kip will plan. */
export function room(i: Inputs) {
  const costs = i.rent + i.bills + livingTotal(livingFor(i));
  const net = i.goal.type === 'emergency' ? 0 : safetyNet(i).monthly;
  const left = i.income - costs - net;
  const funComfy = Math.max(1500, i.income * 0.1);
  const funMin = Math.max(1000, i.income * 0.05);
  return { costs, net, left, comfortable: f100(left - funComfy), most: f100(left - funMin) };
}

export type Verdict =
  | { kind: 'doable'; perMonth: number; months: number } // fits comfortably
  | { kind: 'tight'; perMonth: number; months: number; funLeft: number } // fits, but fun money gets small
  | { kind: 'notByThen'; need: number; months: number; laterComfy: number; laterTight: number; byThen: number; perMonth: number }
  | { kind: 'noRoom'; short: number }; // costs already use up income

export function verdict(i: Inputs): Verdict {
  const R = room(i);
  if (R.most <= 0) return { kind: 'noRoom', short: -R.left + Math.max(1000, i.income * 0.05) };
  if (i.goal.type === 'monthly') {
    const m = i.goal.monthly ?? 0;
    if (m <= R.comfortable) return { kind: 'doable', perMonth: m, months: 12 };
    if (m <= R.most) return { kind: 'tight', perMonth: m, months: 12, funLeft: R.left - m };
    return { kind: 'notByThen', need: m, months: 12, laterComfy: 0, laterTight: 0, byThen: R.comfortable * 12, perMonth: R.comfortable };
  }
  const need = Math.max(0, i.goal.target - i.goal.saved);
  const months = i.goal.months ?? Math.ceil(need / Math.max(R.comfortable, 100));
  const per = Math.ceil(need / months / 100) * 100;
  if (per <= R.comfortable) return { kind: 'doable', perMonth: per, months };
  if (per <= R.most) return { kind: 'tight', perMonth: per, months, funLeft: R.left - per };
  return {
    kind: 'notByThen',
    need: per,
    months,
    laterComfy: Math.ceil(need / Math.max(R.comfortable, 100)),
    laterTight: Math.ceil(need / R.most),
    byThen: Math.min(need, R.comfortable * months),
    perMonth: R.comfortable,
  };
}

// ---------- money styles: same person, four ways to split the month ----------

export type Result = {
  style: Style;
  goal: number; // per month to the goal
  net: number; // per month to the safety net
  invest: number; // 6 Jars' freedom jar (after the safety net is full)
  fixed: number; // rent + bills
  living: number; // food, transport, health, household
  fun: number; // shopping, going out, treats
  learn: number;
  give: number;
  daily: number; // living + fun + learn + give, per day
  goalMonths: number | null; // months to reach the goal at this pace
  netMonths: number; // months until the safety net is full
  savedIn12: number; // goal + safety net (+ invest) after 12 months
  notes: string[];
};

export function plan(i: Inputs, style: Style, goalPerMonth?: number | null): Result {
  const L = livingTotal(livingFor(i));
  const fixed = i.rent + i.bills;
  const S = safetyNet(i);
  const R = room(i);
  const isEmergency = i.goal.type === 'emergency';
  const need = i.goal.type === 'monthly' ? Infinity : Math.max(0, i.goal.target - i.goal.saved);
  const notes: string[] = [];
  let goal = 0, net = isEmergency ? 0 : S.monthly, invest = 0, learn = 0, give = 0;

  const v = verdict(i);
  const kipGoal = goalPerMonth ?? (v.kind === 'doable' || v.kind === 'tight' ? v.perMonth : v.kind === 'notByThen' ? v.perMonth : 0);

  switch (style) {
    case 'kip':
      goal = Math.min(kipGoal, Math.max(0, R.most));
      break;
    case 'savefirst':
      // Pay yourself first: the most Kip will plan leaves on payday; everything else is one pot.
      goal = i.goal.type === 'monthly' ? Math.min(kipGoal, Math.max(0, R.most)) : Math.min(Math.max(0, R.most), need);
      notes.push('No categories — one pot for everything else.');
      break;
    case '503020': {
      const save = r100(i.income * 0.2);
      goal = Math.max(0, Math.min(save - net, Math.max(0, R.most)));
      if (fixed + L > i.income * 0.5) notes.push(`Your needs are ${Math.round(((fixed + L) / i.income) * 100)}% of income, not 50% — so the fun part is smaller than “30”.`);
      break;
    }
    case 'jars': {
      // 55 necessities · 10 play · 10 learning · 5 giving · 10 long-term saving (goal) · 10 freedom (safety net, then investing)
      learn = r100(i.income * 0.1);
      give = r100(i.income * 0.05);
      goal = Math.min(r100(i.income * 0.1), Math.max(0, R.most));
      net = isEmergency ? 0 : Math.max(net, r100(i.income * 0.1));
      if (isEmergency) goal = Math.min(r100(i.income * 0.2), Math.max(0, R.most));
      const necessities = i.income * 0.55;
      if (fixed + L > necessities) notes.push(`Rent, bills and living need ${Math.round(((fixed + L) / i.income) * 100)}%, not 55% — taken from play first.`);
      break;
    }
  }
  if (goalPerMonth !== undefined && goalPerMonth !== null) goal = Math.min(goalPerMonth, Math.max(0, i.income - fixed - L - net), need);
  let fun = i.income - fixed - L - goal - net - invest - learn - give;
  // Never below zero: trim learning/giving first, then the extra saving, so life is covered.
  for (const cut of ['learn', 'give', 'net'] as const) {
    if (fun >= 0) break;
    const floor = cut === 'net' && !isEmergency ? S.monthly : 0;
    const have = cut === 'learn' ? learn : cut === 'give' ? give : net;
    const take = Math.min(-fun, have - floor);
    if (cut === 'learn') learn -= take;
    if (cut === 'give') give -= take;
    if (cut === 'net') net -= take;
    fun += take;
  }
  if (fun < 0) { goal = Math.max(0, goal + fun); fun = 0; }
  fun = r10(fun);

  const goalMonths = i.goal.type === 'monthly' ? null : goal > 0 ? Math.ceil(need / goal) : null;
  const netPace = isEmergency ? goal : net;
  const netMonths = netPace > 0 ? Math.ceil((isEmergency ? Math.max(0, i.goal.target - i.goal.saved) : S.target) / netPace) : Infinity;
  const savedIn12 = Math.min(goal * 12, need) + net * 12 + invest * 12;
  return {
    style, goal, net, invest, fixed, living: L, fun, learn, give,
    daily: Math.floor((L + fun + learn + give) / 30 / 10) * 10,
    goalMonths, netMonths, savedIn12, notes,
  };
}
