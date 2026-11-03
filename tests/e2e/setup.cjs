// Setup, start to finish, the way a new person does it: intro → basics → habits → goal → (Kip's check) → thinking →
// "Your plan is ready" → promise → sign in → Home. Then the saved plan is checked against Kip's own maths.
const { check, scenario, open, tap, type, screenText, money, sane, visible } = require('./kit.cjs');
const { makeDb } = require('./mock.cjs');
const X = require(process.env.EXPECT || '/tmp/heykip-expect.cjs');

/** Every baht has a job: rent and bills + saving + spending = pay. */
const jobs = (m) => X.billsTotal(m) + X.savingTotal(m) + X.spendingTotal(m);

const SCENARIOS = [
  {
    name: 'Same pay every month · trip that fits · payday 25th',
    basics: { type: 'regular', income: 25000, payday: 25, rent: 7000, bills: 1500 },
    habit: /disappears/,
    leaks: ['Food delivery', 'Bubble tea'],
    goal: { type: 'Trip', name: 'Japan trip', amount: 60000, saved: 5000, due: '2027-12-25' },
  },
  {
    name: 'Payday on the 31st · phone that doesn’t fit by its date → Kip’s later date',
    basics: { type: 'regular', income: 18000, payday: 31, rent: 6000, bills: 1500 },
    habit: /Treat myself/,
    leaks: [],
    goal: { type: 'Gadget', name: 'New phone', amount: 40000, saved: 0, due: '2027-03-25' },
    check: 'Go with',
  },
  {
    name: 'Pay that changes · monthly goal for Mum',
    basics: { type: 'changes', slow: 15000, good: 30000, rent: 5000, bills: 1000 },
    habit: /Pay the bills/,
    leaks: ['Coffee'],
    goal: { type: 'Monthly', name: 'Mum', monthly: 2000 },
    check: /Go with/, // a ฿15,000 slow month can't spare ฿2,000 — Kip offers what fits
  },
  {
    name: 'Nothing spare after rent and basics → “Pin it anyway”',
    basics: { type: 'regular', income: 12000, payday: 1, rent: 7000, bills: 1000 },
    habit: /Save some/,
    leaks: [],
    goal: { type: 'Car', name: 'Car', amount: 300000, saved: 0, due: '2028-06-01' },
    check: /anyway/,
  },
  {
    name: 'Picks Kip’s idea: Emergency fund (Thai, Dark)',
    lang: 'th',
    look: 'dark',
    basics: { type: 'regular', income: 30000, payday: 25, rent: 8000, bills: 2000 },
    habit: /disappears|หาย/,
    leaks: [],
    goal: { idea: 'Emergency fund' },
  },
  {
    name: 'Monthly goal bigger than the month can give → Kip’s amount',
    basics: { type: 'regular', income: 18000, payday: 25, rent: 6000, bills: 1500 },
    habit: /disappears/,
    leaks: [],
    goal: { type: 'Monthly', name: 'Mum', monthly: 6000 },
    check: /Go with/,
  },
];

async function runSetup(page, s) {
  const th = s.lang === 'th';
  await tap(page, th ? 'เริ่มกันเลย' : 'Let’s start', { wait: 1500 });
  // 1 · Basics
  if (s.basics.type === 'changes') {
    await tap(page, visible(page.getByRole('radio').nth(1)));
    await type(page, th ? 'เดือนที่น้อย' : 'In a slow month', s.basics.slow).catch(() => visible(page.locator('input').nth(0)).fill(String(s.basics.slow), { force: true }));
    await type(page, th ? 'เดือนที่ดี' : 'In a good month', s.basics.good).catch(() => visible(page.locator('input').nth(1)).fill(String(s.basics.good), { force: true }));
  } else {
    const inputs = page.locator('input >> visible=true');
    await inputs.nth(0).fill(String(s.basics.income), { force: true });
    await inputs.nth(1).fill(String(s.basics.payday), { force: true });
  }
  const inputs = page.locator('input >> visible=true');
  const n = await inputs.count();
  await inputs.nth(n - 2).fill(String(s.basics.rent), { force: true });
  await inputs.nth(n - 1).fill(String(s.basics.bills), { force: true });
  await sane(page, 'Basics');
  await tap(page, visible(page.getByRole('button').filter({ hasText: th ? /^ต่อไป$/ : /^Next$/ })), { wait: 1500 });
  // 2 · Habits
  await tap(
    page,
    visible(page.getByRole('radio', { name: s.habit }))
      .or(visible(page.getByRole('radio').filter({ hasText: s.habit })))
      .first(),
  );
  for (const l of s.leaks) await tap(page, visible(page.getByRole('checkbox').filter({ hasText: l })), { wait: 200 });
  await sane(page, 'Habits');
  await tap(page, visible(page.getByRole('button').filter({ hasText: th ? /^ต่อไป$/ : /^Next$/ })), { wait: 2000 });
  // 3 · Goal
  if (s.goal.idea) {
    // Kip's pick is the first idea card.
    await page.locator('[role=button][aria-label^="Pick "], [role=button][aria-label^="เลือก "]').first().click();
    await page.waitForTimeout(800);
  } else {
    await tap(page, visible(page.getByRole('radio', { name: s.goal.type, exact: true })), { wait: 500 });
    await type(page, 'Name your goal', s.goal.name);
    if (s.goal.monthly) await type(page, 'Each month', s.goal.monthly);
    else {
      await type(page, 'How much?', s.goal.amount);
      await type(page, 'Saved so far', s.goal.saved);
      await type(page, 'By when?', s.goal.due);
    }
  }
  await page.waitForTimeout(600);
  await sane(page, 'Goal');
  await tap(page, visible(page.getByRole('button').filter({ hasText: th ? /^ต่อไป$/ : /^Next$/ })), { wait: 3000 });
  // 3b · Kip's check (only when it doesn't fit as asked)
  if (page.url().includes('/setup/check')) {
    await sane(page, 'Kip’s check');
    await check(page, 'Kip’s check only appears when Kip said it would', !!s.check, () => s.name);
    const btn = visible(page.getByRole('button').filter({ hasText: s.check instanceof RegExp ? s.check : new RegExp(s.check) }));
    await tap(page, btn, { wait: 3000 });
  } else if (s.check) await check(page, 'Kip’s check appears for a goal that doesn’t fit', false, () => page.url());
  // 4 · Thinking → Yay
  for (let k = 0; k < 10 && page.url().includes('/setup/thinking'); k++) await page.waitForTimeout(1500);
  const yay = await sane(page, '“Your plan is ready”');
  await tap(page, visible(page.getByRole('button').filter({ hasText: th ? /ให้สัญญากับตัวเอง/ : /Make my promise/ })), { wait: 2000 });
  // 5 · Promise: sign with the mouse
  await sane(page, 'Promise');
  const pad = visible(page.getByLabel(th ? 'ช่องเซ็นชื่อ ใช้นิ้วเซ็นได้เลย' : 'Signature pad. Sign with your finger.'));
  const box = await pad.boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  for (let k = 1; k <= 12; k++) await page.mouse.move(box.x + 20 + k * 18, box.y + box.height / 2 + (k % 2 ? -14 : 14), { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await tap(page, visible(page.getByRole('button').filter({ hasText: th ? /เซ็นแล้วลุยเลย/ : /Sign and commit/ })), { wait: 2500 });
  // 6 · Sign in with an email code
  await type(page, th ? 'อีเมล' : 'Email', 'koy@test.dev').catch(() => visible(page.locator('input')).fill('koy@test.dev'));
  await tap(page, visible(page.getByRole('button').filter({ hasText: th ? /ส่งรหัสให้หน่อย/ : /Send my code/ })), { wait: 1200 });
  await type(page, th ? 'รหัส 6 หลัก' : '6-digit code', '123456').catch(() => visible(page.locator('input')).fill('123456'));
  await tap(page, visible(page.getByRole('button').filter({ hasText: th ? /^ล็อกอิน$/ : /^Sign in$/ })), { wait: 6000 });
  return yay;
}

module.exports = async function setupTests(browser) {
  const homes = [];
  for (const s of SCENARIOS) {
    scenario('Setup · ' + s.name);
    const db = makeDb({ profile: { onboarded: false } });
    const page = await open(browser, { db, signedIn: false, path: '/setup', lang: s.lang, look: s.look });
    try {
      await runSetup(page, s);
    } catch (e) {
      await check(page, 'Setup can be completed', false, () => e.message.split('\n')[0] + ' @ ' + page.url());
      await page.close();
      continue;
    }
    const p = db.profiles[0];
    const m = p.budget;
    await check(page, 'Setup can be completed and lands on Home', !!p.onboarded && !page.url().includes('/setup') && !page.url().includes('sign-in'), () => ({
      url: page.url(),
      onboarded: p.onboarded,
    }));
    await check(page, 'The plan is saved', m && m.v === 2, () => p);
    if (!m) {
      await page.close();
      continue;
    }
    const basicsFit = X.billsTotal(m) + 6500 <= m.income;
    await check(page, 'Every baht has a job in the saved plan', Math.abs(jobs(m) - m.income) <= 10 || !basicsFit, () => ({ jobs: jobs(m), income: m.income }));
    const g = page.db.goals.find((x) => x.position === 1);
    await check(page, 'The goal is saved as goal 1', !!g && g.status === 'active', () => page.db.goals);
    await check(page, 'The promise and signature are saved', page.db.promises.length === 1 && page.db.writes.some((w) => w.startsWith('storage signatures')), () => ({
      promises: page.db.promises,
      writes: page.db.writes,
    }));
    // Home shows the saved plan's numbers.
    await page.waitForTimeout(1500);
    const home = await sane(page, 'Home after setup');
    const spend = X.spendingTotal(m);
    const P = X.period(m.payday, new Date());
    const expectToday = Math.round(spend / P.daysLeft / 10) * 10;
    const nums = (home.match(/฿\s?[\d,]+/g) || []).map(money);
    await check(page, `Home: today’s money is ฿${expectToday} (spending ฿${spend} ÷ ${P.daysLeft} days)`, nums.includes(expectToday) || home.includes(expectToday.toLocaleString('en-US')), () => ({
      nums: nums.slice(0, 6),
    }));
    await check(page, `Home: left this month is ฿${spend.toLocaleString('en-US')}`, home.includes(spend.toLocaleString('en-US')), () => home.slice(0, 300));
    homes.push({ name: s.name, db });
    await page.close();
  }
  return homes;
};
module.exports.SCENARIOS = SCENARIOS;
