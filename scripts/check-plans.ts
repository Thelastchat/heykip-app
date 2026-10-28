// Sanity checks for Kip's money engine: run `npx tsx scripts/check-plans.ts`.
// Thousands of random people × every goal kind × every money style; any broken rule is printed.
import { applyEdit, funMinimum, livingFor, livingTotal, plan, room, verdict, type Inputs, type Style } from '../src/lib/brain';

const STYLES: Style[] = ['kip', 'savefirst', '503020', 'jars'];
const rnd = (a: number, b: number) => Math.round((a + Math.random() * (b - a)) / 100) * 100;
let fails = 0, cases = 0;
const fail = (msg: string, i: Inputs, extra: unknown) => {
  if (fails++ < 15) console.log('✗', msg, JSON.stringify(i), JSON.stringify(extra));
};

for (let n = 0; n < 4000; n++) {
  const income = rnd(9000, 120000);
  const rent = rnd(0, income * 0.45);
  const bills = rnd(500, income * 0.1);
  const kind = (['trip', 'emergency', 'monthly'] as const)[n % 3];
  const goal =
    kind === 'monthly'
      ? { type: 'monthly' as const, title: 'g', target: 0, saved: 0, months: null, monthly: rnd(500, income * 0.2) }
      : { type: kind, title: 'g', target: rnd(3000, income * 6), saved: 0, months: n % 2 ? null : 1 + (n % 30), monthly: null };
  const i: Inputs = { income, rent, bills, goal };
  const R = room(i);
  const v = verdict(i);
  if (v.kind === 'noRoom') continue;
  cases++;
  const L = livingTotal(livingFor(i));
  const res = Object.fromEntries(STYLES.map((s) => [s, plan(i, s)])) as Record<Style, ReturnType<typeof plan>>;
  for (const s of STYLES) {
    const r = res[s];
    const sum = r.fixed + r.living + r.goal + r.net + r.invest + r.fun + r.learn + r.give;
    if (Math.abs(sum - income) > 10) fail(`${s}: money doesn't add up (${sum} vs ${income})`, i, r);
    if (r.fun < 0 || r.goal < 0 || r.net < 0) fail(`${s}: negative pot`, i, r);
    if (r.living !== L) fail(`${s}: living costs changed`, i, r);
    if (r.fun + 10 < funMinimum(income) && R.most > 0) fail(`${s}: fun below minimum`, i, r);
    if (kind === 'monthly' && v.kind === 'doable' && r.goal !== goal.monthly && !r.notes.some((x) => x.includes('not ฿'))) fail(`${s}: monthly goal not kept`, i, r);
  }
  // Save first always saves the most (within ฿100 a month of rounding), and never later than Kip's plan.
  for (const s of STYLES) if (res.savefirst.savedIn12 + 1200 < res[s].savedIn12) fail(`savefirst saves less than ${s}`, i, { a: res.savefirst.savedIn12, b: res[s].savedIn12 });
  if (res.kip.goalMonths && res.savefirst.goalMonths && res.savefirst.goalMonths > res.kip.goalMonths) fail('savefirst later than kip', i, {});
  // Kip's plan honours a doable date.
  if (kind !== 'monthly' && goal.months && v.kind === 'doable' && res.kip.goalMonths && res.kip.goalMonths > goal.months) fail('kip misses a doable date', i, res.kip);
  // A custom monthly amount (Make it yours) is used as given when it fits.
  const custom = Math.min(R.most, 1000);
  if (custom > 0 && kind !== 'monthly') {
    const c = plan(i, 'kip', custom);
    if (c.goal !== Math.min(custom, Math.max(0, goal.target - goal.saved))) fail('custom amount not used', i, c);
  }
}
// Locks on "Make it yours": a locked goal or fun amount never moves; if Kip can't find the money, nothing changes.
for (let n = 0; n < 3000; n++) {
  const income = rnd(12000, 80000);
  const i: Inputs = { income, rent: rnd(0, income * 0.35), bills: rnd(500, income * 0.08), goal: { type: 'trip', title: 'g', target: rnd(5000, income * 4), saved: 0, months: null, monthly: null } };
  if (verdict(i).kind === 'noRoom') continue;
  const now = plan(i, 'kip');
  if (now.goal <= 0) continue;
  const key = (['food', 'transport', 'rent', 'bills'] as const)[n % 4];
  const L = livingFor(i);
  const cur = key === 'rent' ? i.rent : key === 'bills' ? i.bills : L[key];
  const to = cur + rnd(-cur * 0.5, income * 0.15);
  for (const locks of [{ goal: true, fun: false }, { goal: false, fun: true }, { goal: true, fun: true }]) {
    const res = applyEdit(i, 'kip', now.goal, { kind: 'cost', key, to }, locks);
    cases++;
    if (res.blocked > 0) {
      if (res.inputs !== i || res.goal !== now.goal) fail('blocked edit still changed something', i, { locks, res });
      continue;
    }
    const after = plan(res.inputs, 'kip', res.goal);
    if (locks.goal && res.goal !== now.goal) fail('locked goal moved', i, { locks, to, key, res });
    if (locks.fun && Math.abs(after.fun - now.fun) > 10 && !(to < cur)) fail('locked fun moved', i, { locks, to, key, before: now.fun, after: after.fun });
  }
}

console.log(fails ? `${fails} problems in ${cases} cases` : `All good — ${cases} cases × ${STYLES.length} styles`);
process.exit(fails ? 1 : 0);
