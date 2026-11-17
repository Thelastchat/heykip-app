// Everyday use after setup: log spending, go over, get paid, pay bills, fix History, put money in a goal, edit a goal,
// add a second goal (Plus), change pay, change a budget, switch language. After each step: the database changed the
// right way, every baht still has a job, and Home, Goals, History and the category sheet agree with each other.
const { check, scenario, open, tap, type, go, screenText, money, sane, visible } = require('./kit.cjs');
const { person } = require('./seed.cjs');
const X = require(process.env.EXPECT || '/tmp/heykip-expect.cjs');

const jobs = (m) => X.billsTotal(m) + X.savingTotal(m) + X.spendingTotal(m);
const fmt = (n) => '฿' + Math.round(n).toLocaleString('en-US');
const spentSoFar = (db) =>
  db.transactions
    .filter((t) => t.kind === 'spend' && t.category_id !== 'spend-home_bills' && new Date(t.occurred_at) >= X.period(db.profiles[0].budget.payday, new Date()).start)
    .reduce((a, t) => a + Number(t.amount), 0);
const spentToday = (db) => db.transactions.filter((t) => t.kind === 'spend' && new Date(t.occurred_at).toDateString() === new Date().toDateString()).reduce((a, t) => a + Number(t.amount), 0);
const catLeft = (db, key) =>
  (db.profiles[0].budget.spend.find((s) => s.key === key)?.amount ?? 0) -
  db.transactions.filter((t) => t.kind === 'spend' && t.category_id === 'spend-' + key).reduce((a, t) => a + Number(t.amount), 0);

/** Drag like a finger: press, move slowly, let go. */
async function drag(page, loc, dx, from = 30) {
  const box = await loc.boundingBox();
  const y = box.y + box.height / 2;
  const x = box.x + Math.min(from, box.width - 10);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let k = 1; k <= 30; k++) {
    await page.mouse.move(x + (dx * k) / 30, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(1500);
}

async function addSpend(page, amount, cat, note) {
  await go(page, '/add');
  for (const d of String(amount)) await tap(page, page.getByRole('button', { name: d, exact: true }), { wait: 60 });
  await tap(page, visible(page.getByRole('radio', { name: cat, exact: true })), { wait: 200 });
  if (note) await visible(page.locator('input')).fill(note);
  await tap(page, visible(page.getByRole('button').filter({ hasText: /^Save/ })), { wait: 2200 });
}

module.exports = async function homeTests(browser) {
  // One scenario failing (a button that never appeared) is recorded and the rest still run.
  const safely = async (fn) => {
    try {
      await fn();
    } catch (e) {
      await check(null, 'Scenario runs to the end', false, () => e.message.split('\n')[0]);
    }
  };
  // ---------- 1. Logging spending ----------
  scenario('Everyday · log spending');
  await safely(async () => {
    const { db } = person({
      spends: [
        ['food', 120, 0, 'Lunch'],
        ['transport', 42, 1, 'BTS'],
      ],
    });
    const page = await open(browser, { db });
    const m = db.profiles[0].budget;
    const before = await sane(page, 'Home');
    await check(page, `Home: left this month = plan − spent (${fmt(X.spendingTotal(m) - 162)})`, before.includes(fmt(X.spendingTotal(m) - 162)), () => before.slice(0, 200));
    await addSpend(page, 250, 'Food', 'Noodles');
    const t = db.transactions.find((x) => x.note === 'Noodles');
    await check(page, 'Add: the spend is saved with its amount and category', t && Number(t.amount) === 250 && t.category_id === 'spend-food', () => db.transactions);
    await go(page, '/');
    const home = await sane(page, 'Home after adding');
    await check(page, `Home: left this month went down by ฿250 (${fmt(X.spendingTotal(m) - 412)})`, home.includes(fmt(X.spendingTotal(m) - 412)), () => home.slice(0, 300));
    await check(page, `Home: the Food tile shows ${fmt(catLeft(db, 'food'))} left`, home.includes(fmt(catLeft(db, 'food'))), () => home.slice(0, 600));
    // Category sheet agrees.
    await tap(page, visible(page.getByRole('button', { name: /^Food & drinks:/ })), { wait: 1200 });
    const sheet = await sane(page, 'Food sheet');
    await check(page, 'Food sheet: same “left” as the tile, and the new spend is listed first', sheet.includes(fmt(catLeft(db, 'food'))) && /Noodles.*Lunch/.test(sheet), () => sheet.slice(0, 400));
    await check(page, 'Food sheet: “of ฿4,500 · ฿370 spent”', sheet.includes(`of ${fmt(4500)} · ${fmt(370)} spent`), () => sheet.slice(0, 300));
    await tap(page, visible(page.getByRole('button').filter({ hasText: 'See all in History' })), { wait: 2500 });
    const hist = await sane(page, 'History from the Food sheet');
    await check(page, 'History opens filtered to Food (no BTS)', hist.includes('Noodles') && !hist.includes('BTS'), () => hist.slice(0, 400));
    await page.close();
  });

  // ---------- 2. Going over today ----------
  scenario('Everyday · going over today');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db });
    await addSpend(page, 1500, 'Fun', 'Concert');
    await go(page, '/');
    const m = db.profiles[0].budget;
    const N = X.monthNumbers(m, { total: spentSoFar(db), today: spentToday(db), bills: 0, byCat: {}, byDay: {} }, new Date());
    const home = await sane(page, 'Home after a big day');
    await check(page, `Home shows ${fmt(N.overToday)} over today`, N.overToday > 0 && home.includes(fmt(N.overToday)), () => ({ over: N.overToday, home: home.slice(0, 300) }));
    await tap(page, visible(page.getByRole('button', { name: /over today — see what it changes/ })).first(), { wait: 1500 }).catch(() => {});
    const sheet = await sane(page, 'Over-today sheet');
    await check(page, `Over-today sheet: the days ahead carry it (${fmt(N.dailyAfter)} a day for ${N.daysAfter} days)`, sheet.includes(fmt(N.dailyAfter)), () => ({ N, sheet: sheet.slice(0, 500) }));
    await page.close();
  });

  // ---------- 3. Payday ----------
  scenario('Everyday · got paid → saving moves');
  await safely(async () => {
    const { db } = person({ plan: 'trial' });
    const page = await open(browser, { db, path: '/add' });
    const m = db.profiles[0].budget;
    await tap(page, page.getByRole('tab').nth(1));
    for (const d of '25000') await tap(page, page.getByRole('button', { name: d, exact: true }), { wait: 60 });
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^Save/ })), { wait: 2000 });
    await sane(page, 'Money-in sheet');
    const moveBtn = visible(page.getByRole('button').filter({ hasText: /^Move ฿/ }));
    const label = await moveBtn.innerText().catch(() => '');
    await check(page, `Money in: offers to move this month’s saving (${fmt(X.savingTotal(m))})`, money(label) === X.savingTotal(m), () => label);
    await tap(page, moveBtn, { wait: 2500 }).catch(() => {});
    const g = db.goals[0];
    await check(page, `Payday: ${fmt(m.goal.amount)} moved into Japan`, Number(g.saved_amount) === 5000 + m.goal.amount, () => ({ saved: g.saved_amount, writes: db.writes }));
    await check(page, `Payday: ${fmt(m.safety.amount)} moved into the safety net`, Number(db.profiles[0].safety_saved) === m.safety.amount, () => db.profiles[0].safety_saved);
    await check(page, 'Payday: marked as moved, so it can’t happen twice this cycle', !!db.profiles[0].budget.payMoved, () => db.profiles[0].budget);
    await go(page, '/goals');
    const goals = await sane(page, 'Goals after payday');
    await check(page, `Goals shows ${fmt(5000 + m.goal.amount)} saved`, goals.includes(fmt(5000 + m.goal.amount)), () => goals.slice(0, 300));
    await page.close();
  });

  // ---------- 4. Bills ----------
  scenario('Everyday · mark rent paid');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db });
    const slider = page.getByRole('slider', { name: 'Slide to mark paid' }).first();
    await slider.scrollIntoViewIfNeeded();
    await drag(page, slider, 300);
    const home = await sane(page, 'Home after paying rent');
    await check(page, 'Bills: rent is saved as paid for this cycle', (db.profiles[0].budget.paid?.keys ?? []).includes('rent'), () => db.profiles[0].budget.paid);
    await check(page, 'Bills: the header says 1 of 2 paid', home.includes('1 of 2 paid'), () => home.slice(-300));
    await page.close();
  });

  // ---------- 5. History ----------
  scenario('Everyday · delete a spend in History');
  await safely(async () => {
    const { db } = person({
      spends: [
        ['transport', 42, 0, 'BTS'],
        ['food', 120, 0, 'Lunch'],
      ],
    });
    const page = await open(browser, { db, path: '/history' });
    await sane(page, 'History');
    // Swipe the BTS row left, then tap Delete.
    // (In a browser, letting go after a swipe also counts as a tap and opens “What was it for?” — close it first.
    // On a phone the swipe cancels the tap; that part is on the phone checklist.)
    const row = visible(page.getByRole('button').filter({ hasText: /^BTS/ }));
    const box = await row.boundingBox();
    await drag(page, row, -150, box.width - 40);
    await page.keyboard.press('Escape');
    await page.mouse.click(195, 60);
    await page.waitForTimeout(800);
    const del = await page.evaluate((y) => [...document.querySelectorAll('[aria-label=Delete]')].map((e) => e.getBoundingClientRect()).find((r) => Math.abs(r.y - y) < 5), box.y);
    if (del) await page.mouse.click(del.x + del.width / 2, del.y + del.height / 2);
    await page.waitForTimeout(1500);
    await check(page, 'History: the spend is deleted', db.transactions.length === 1 && db.transactions[0].note === 'Lunch', () => db.transactions.map((t) => t.note));
    await go(page, '/');
    const home = await sane(page, 'Home after deleting');
    const left = X.spendingTotal(db.profiles[0].budget) - spentSoFar(db);
    await check(page, `Home: left this month comes back (${fmt(left)})`, home.includes(fmt(left)), () => home.slice(0, 200));
    await page.close();
  });

  // ---------- 6. Goals ----------
  scenario('Goals · put money in, edit the goal');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db, path: '/goals' });
    await sane(page, 'Goals');
    await tap(page, visible(page.getByRole('button', { name: 'Put money in' })).first(), { wait: 1000 });
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^Put ฿1,000 in$/ })), { wait: 2000 });
    await check(page, 'Put money in: Japan goes from ฿5,000 to ฿6,000', Number(db.goals[0].saved_amount) === 6000, () => db.goals[0]);
    const after = await sane(page, 'Goals after putting money in');
    await check(page, 'Goals shows ฿6,000 saved', after.includes('฿6,000'), () => after.slice(0, 300));
    // Edit: bigger goal, keep the date.
    await go(page, '/goal-edit?id=g1');
    await type(page, 'How much', 80000);
    await page.waitForTimeout(800);
    const edit = await sane(page, 'Goal editor');
    const keep = visible(page.getByRole('radio').filter({ hasText: /date/i })).first();
    if (await keep.count()) await tap(page, keep, { wait: 400 });
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^Save/ })), { wait: 2500 });
    const m = db.profiles[0].budget;
    await check(page, 'Edit goal: the new amount is saved', Number(db.goals[0].target_amount) === 80000, () => db.goals[0]);
    await check(page, 'Edit goal: every baht still has a job', Math.abs(jobs(m) - m.income) <= 10, () => ({ jobs: jobs(m), income: m.income }));
    const left = 80000 - 6000;
    const months = (d) => (d.getFullYear() - new Date().getFullYear()) * 12 + d.getMonth() - new Date().getMonth();
    const due = new Date(db.goals[0].due_date);
    await check(page, 'Edit goal (keep date): the monthly amount gets there by the date', m.goal.amount * months(due) >= left - m.goal.amount || m.goal.amount === 0, () => ({
      per: m.goal.amount,
      months: months(due),
      left,
      edit: edit.slice(0, 300),
    }));
    await go(page, '/');
    const home = await sane(page, 'Home after editing the goal');
    const N = X.monthNumbers(m, { total: 0, today: 0, bills: 0, byCat: {}, byDay: {} }, new Date());
    await check(page, `Home: today’s money matches the new plan (${fmt(N.dailyToday)})`, home.includes(fmt(N.dailyToday)), () => home.slice(0, 200));
    await page.close();
  });

  scenario('Goals · Plus: pin a second goal');
  await safely(async () => {
    const { db } = person({ plan: 'trial' });
    const page = await open(browser, { db, path: '/goal-new' });
    await tap(page, visible(page.getByRole('radio', { name: 'Gadget', exact: true })), { wait: 300 });
    await type(page, 'Name', 'New phone');
    await type(page, 'How much', 30000);
    await type(page, 'By when', '2027-08-25');
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^Next$/ })), { wait: 2000 });
    const plan = await sane(page, 'New goal: Kip’s plan');
    const pin = visible(page.getByRole('button').filter({ hasText: /^Pin / })).first();
    await tap(page, pin, { wait: 3000 }).catch(() => {});
    const active = db.goals.filter((g) => g.status === 'active');
    const m = db.profiles[0].budget;
    await check(page, 'Second goal is saved as goal 2', active.length === 2 && active.some((g) => g.title === 'New phone' && g.position === 2), () =>
      db.goals.map((g) => [g.title, g.position, g.status]),
    );
    await check(page, 'The month’s goal saving is split between both goals', (m.goals ?? []).length === 2 && !(m.goals ?? []).some((x) => x.id === 'new'), () => m.goals);
    await check(page, 'Every baht still has a job', Math.abs(jobs(m) - m.income) <= 10, () => ({ jobs: jobs(m), income: m.income }));
    const lites = active
      .sort((a, b) => a.position - b.position)
      .map((g) => ({ id: g.id, kind: g.kind, target: Number(g.target_amount ?? 0), saved: Number(g.saved_amount), due: g.due_date, monthly: g.monthly_amount }));
    const split = X.splitOf(m, lites);
    const arrive = X.arrivals(lites, split, m.payday, new Date());
    await go(page, '/goals');
    const goals = await sane(page, 'Goals with two goals');
    const phone = arrive.get(lites[1].id);
    await check(
      page,
      `Goals: the phone’s card shows ${fmt(split.get(lites[1].id))}/mo · ${phone ? X.monthYear(phone) : '—'}`,
      goals.includes(`${fmt(split.get(lites[1].id))}/mo`) && (!phone || goals.includes(X.monthYear(phone))),
      () => ({ split: [...split], goals: goals.slice(0, 600), plan: plan.slice(0, 300) }),
    );
    await page.close();
  });

  // ---------- 7. Profile and the month ----------
  scenario('Profile · change usual pay');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db, path: '/profile' });
    await tap(page, visible(page.getByRole('button', { name: /^Usual pay/ })), { wait: 1000 });
    await type(page, 'Usual pay', 30000);
    await page.waitForTimeout(600);
    await sane(page, 'Pay sheet');
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^Save/ })), { wait: 2500 });
    const m = db.profiles[0].budget;
    await check(page, 'New pay is planned on (฿30,000)', m.income === 30000, () => m.income);
    await check(page, 'Every baht has a job at the new pay', Math.abs(jobs(m) - m.income) <= 10, () => ({ jobs: jobs(m), income: m.income }));
    await go(page, '/');
    const home = await sane(page, 'Home at the new pay');
    await check(page, `Home: left this month is the new spending money (${fmt(X.spendingTotal(m))})`, home.includes(fmt(X.spendingTotal(m))), () => home.slice(0, 200));
    await page.close();
  });

  scenario('Your month · raise the food budget');
  await safely(async () => {
    const { db } = person({ plan: 'trial' });
    const page = await open(browser, { db, path: '/month' });
    const before = JSON.parse(JSON.stringify(db.profiles[0].budget));
    await tap(page, visible(page.getByRole('button', { name: /^Food & drinks,/ })), { wait: 1000 });
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^\+500$/ })), { wait: 300 });
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^Set to ฿5,000$/ })), { wait: 1500 });
    await sane(page, 'Where the ฿500 comes from');
    // Kip shows where the money comes from; confirm if it asks.
    const conf = visible(page.getByRole('button').filter({ hasText: /^(Okay|Do it|Yes|Save|Confirm|Looks good)/ }));
    if (await conf.count()) await tap(page, conf, { wait: 1500 });
    const m = db.profiles[0].budget;
    const food = (b) => b.spend.find((s) => s.key === 'food').amount;
    await check(page, 'Food budget went up by ฿500', food(m) === food(before) + 500, () => ({ before: food(before), after: food(m), writes: db.writes }));
    await check(
      page,
      'Taken from shopping/fun, never bills or saving',
      X.billsTotal(m) === X.billsTotal(before) && X.savingTotal(m) === X.savingTotal(before) && Math.abs(jobs(m) - m.income) <= 10,
      () => ({ spend: m.spend }),
    );
    await sane(page, 'Your month after the change');
    await page.close();
  });

  scenario('Language · switch to Thai and back');
  await safely(async () => {
    const { db } = person({ spends: [['food', 120, 0, 'Lunch']] });
    const page = await open(browser, { db, path: '/profile' });
    await tap(page, visible(page.getByRole('button', { name: 'ไทย' })), { wait: 2500 });
    for (const p of ['/', '/goals', '/history', '/month', '/profile']) {
      await go(page, p);
      const text = await sane(page, `Thai ${p}`);
      const english = (text.match(/\b(the|and|your|left|spent|month|goal|money|today)\b/gi) || []).length;
      await check(page, `Thai ${p}: no English sentences left`, english <= 2, () => text.slice(0, 400));
    }
    await page.close();
  });

  scenario('Plus · Money styles: switch to Save first');
  await safely(async () => {
    const { db } = person({ plan: 'trial' });
    db.profiles[0].budget.bills.items = [{ name: 'Netflix', amount: 419 }];
    db.profiles[0].budget.bills.guess -= 419;
    const page = await open(browser, { db });
    await tap(page, visible(page.getByRole('button', { name: /^Money styles/ })), { wait: 2000 }).catch(() => go(page, '/styles'));
    if (!page.url().includes('/styles')) await go(page, '/styles');
    await sane(page, 'Money styles');
    const row = visible(page.getByRole('radio', { name: /^Save first:/ }));
    const promised = ((await row.getAttribute('aria-label')) || '').match(/: ([A-Z][a-z]{2} \d{4}),/)?.[1];
    await tap(page, row, { wait: 1200 });
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^Switch to Save first$/ })), { wait: 2500 });
    const m = db.profiles[0].budget;
    await check(page, 'Money styles: the month is now Save first', m.style === 'savefirst', () => m.style);
    await check(
      page,
      'Money styles: Netflix is still a bill',
      (m.bills.items ?? []).some((b) => b.name === 'Netflix'),
      () => m.bills,
    );
    await check(page, 'Money styles: every baht has a job', Math.abs(jobs(m) - m.income) <= 10, () => ({ jobs: jobs(m), income: m.income }));
    await go(page, '/goals');
    const goals = await sane(page, 'Goals after switching');
    await check(page, `Goals shows the date the picker promised (${promised})`, !!promised && goals.includes(promised), () => ({ promised, goals: goals.slice(0, 300) }));
    await go(page, '/');
    const home = await sane(page, 'Home after switching');
    await check(page, `Home: left this month is the new spending money (${fmt(X.spendingTotal(m))})`, home.includes(fmt(X.spendingTotal(m))), () => home.slice(0, 200));
    await page.close();
  });

  scenario('Bills · a big new bill slows the goal — Home and Goals agree');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db, path: '/month' });
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^Add a bill/ })), { wait: 1000 });
    await type(page, 'Bill name', 'Car loan');
    await type(page, 'Amount a month', 8000);
    await page.waitForTimeout(500);
    await sane(page, 'Add a bill');
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^Add (Car loan|it|bill)/ })), { wait: 2000 });
    const m = db.profiles[0].budget;
    await check(
      page,
      'The bill is in the plan',
      (m.bills.items ?? []).some((b) => b.name === 'Car loan' && b.amount === 8000),
      () => m.bills,
    );
    await check(page, 'Every baht still has a job', Math.abs(jobs(m) - m.income) <= 10, () => ({ jobs: jobs(m), income: m.income }));
    await go(page, '/goals');
    const goals = await sane(page, 'Goals after the bill');
    const arr = goals.match(/Arrives \| ([A-Z][a-z]{2} \d{4})/)?.[1];
    await go(page, '/');
    await sane(page, 'Home after the bill');
    await tap(page, visible(page.getByRole('button', { name: /^Kip says:/ })), { wait: 1200 });
    const kip = await sane(page, 'Kip’s note');
    await check(page, `Kip’s note on Home uses the same date as Goals (${arr})`, !!arr && kip.includes(arr), () => ({ arr, kip: kip.slice(-500) }));
    await check(page, 'The bill really slowed the goal (it’s later than Dec 2027)', !!arr && arr !== 'Dec 2027', () => arr);
    await page.close();
  });

  scenario('Every month · add a yearly insurance from Home');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db });
    const home0 = await sane(page, 'Home');
    const m0 = db.profiles[0].budget;
    const N0 = X.monthNumbers(m0, { total: 0, today: 0, bills: 0, byCat: {}, byDay: {} }, new Date());
    await check(page, `Home shows today’s budget even before spending (“of ${fmt(N0.dailyToday)}”)`, home0.includes(`of ${fmt(N0.dailyToday)}`), () => home0.slice(0, 200));
    await check(page, 'Home’s section is called “Every month”', home0.includes('Every month'), () => home0.slice(-400));
    await tap(page, visible(page.getByRole('button', { name: 'Add to every month' })), { wait: 2000 });
    await sane(page, 'Add to every month');
    await tap(page, visible(page.getByRole('radio', { name: 'Insurance' })), { wait: 200 });
    await type(page, 'Bill name', 'Car insurance');
    await tap(page, visible(page.getByRole('radio').filter({ hasText: /^Every year$/ })), { wait: 300 });
    await type(page, 'Amount a year', 12000);
    await page.waitForTimeout(500);
    const sheet = await sane(page, 'Yearly bill');
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^Add Car insurance · ฿12,000 a year$/ })), { wait: 2000 });
    const m = db.profiles[0].budget;
    const it = (m.bills.items ?? []).find((b) => b.name === 'Car insurance');
    await check(page, 'Saved as a yearly insurance (฿12,000, with a due month)', it && it.type === 'insurance' && it.yearly && it.yearly.total === 12000, () => it);
    const months = it ? Math.max(1, (Number(it.yearly.due.slice(0, 4)) - new Date().getFullYear()) * 12 + Number(it.yearly.due.slice(5)) - 1 - new Date().getMonth()) : 0;
    await check(page, `It sets aside enough each month to be ready by then (${it && it.amount} × ${months} ≥ ฿12,000)`, it && it.amount * months >= 12000, () => ({ it, months }));
    await check(page, 'Kip explained the catch-up in the sheet', /months away\. I’ll set aside/.test(sheet), () => sheet.slice(-500));
    await check(page, 'Every baht still has a job', Math.abs(jobs(m) - m.income) <= 10, () => ({ jobs: jobs(m), income: m.income }));
    await go(page, '/');
    const home = await sane(page, 'Home with the insurance');
    await check(page, 'Home shows it as “Every year · due …” with how much is ready', /Car insurance \| Every year · due [A-Z][a-z]{2}/.test(home) && home.includes('of ฿12,000 ready'), () =>
      home.slice(-700),
    );
    await page.close();
  });

  scenario('Full calendar · this month, a month back, the one-year limit');
  await safely(async () => {
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const ago = (n) => new Date(Date.now() - n * 86400000);
    const { db } = person({
      spends: [
        ['food', 120, 0, 'Bubble tea'],
        ['food', 2000, 40, 'Big dinner'],
        ['home_bills', 7000, 40, 'Rent'],
        ['transport', 90, 400, 'Old Grab'],
      ],
    });
    const page = await open(browser, { db });
    await sane(page, 'Home');
    await tap(page, visible(page.getByRole('button', { name: 'Full calendar' })), { wait: 2000 });
    const now = new Date();
    const cal = await sane(page, 'Full calendar');
    await check(page, `Opens on this month (${MONTHS[now.getMonth()]} ${now.getFullYear()})`, cal.includes(`${MONTHS[now.getMonth()]} ${now.getFullYear()}`), () => cal.slice(0, 300));
    const todayCell = page.getByRole('button', { name: new RegExp(`^[A-Z][a-z]{2} ${now.getDate()}, spent 120$`) });
    await check(page, 'Today shows the ฿120 spent', (await todayCell.count()) === 1, () => cal.slice(0, 600));
    await tap(page, todayCell, { wait: 800 });
    const todaySheet = await sane(page, 'Today’s day sheet');
    await check(page, 'Tapping today opens it: today’s spends are listed', todaySheet.includes('Bubble tea') && todaySheet.includes('Add to this day'), () => todaySheet.slice(-500));
    await page.keyboard.press('Escape');
    await page.mouse.click(195, 60);
    await page.waitForTimeout(600);
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const cells = await page.getByRole('button', { name: /^[A-Z][a-z]{2} \d+(, spent \d+)?$/ }).count();
    await check(page, `The month has its real ${days} days`, cells === days, () => cells);

    // Back to the month of the ฿2,000 dinner.
    const d40 = ago(40);
    const back = (now.getFullYear() - d40.getFullYear()) * 12 + now.getMonth() - d40.getMonth();
    for (let i = 0; i < back; i++) await tap(page, visible(page.getByRole('button', { name: 'Previous month' })), { wait: 1200 });
    const before = await sane(page, 'A month back');
    await check(page, `Arrows go back to ${MONTHS[d40.getMonth()]}`, before.includes(`${MONTHS[d40.getMonth()]} ${d40.getFullYear()}`), () => before.slice(0, 300));
    const cell = page.getByRole('button', { name: new RegExp(`^[A-Z][a-z]{2} ${d40.getDate()}, spent (\\d+)$`) });
    const label = (await cell.count()) ? await cell.getAttribute('aria-label') : '';
    await check(page, 'That day shows ฿2,000 — the ฿7,000 rent is planned money, left out like on Home', /spent 2000$/.test(label || ''), () => label);
    // the calendar is a tab now: the bar floats over the last week, so bring the day to the middle first (as a thumb would)
    await cell.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await tap(page, cell, { wait: 600 });
    const day = await sane(page, 'Day card');
    // only the day card (under the legend): Home stays mounted behind the calendar tab on the web, and its text would count too
    const card = day.slice(day.lastIndexOf('Tap a day to see what you spent'));
    await check(page, 'Tapping the day lists the dinner, and how far over the daily budget (rent is listed but never counted)', card.includes('Big dinner') && /฿1,6\d\d over/.test(card), () => card);
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^See all in History$/ })), { wait: 2500 });
    const hist = await sane(page, 'History from the calendar');
    await check(page, 'See all in History opens the pay cycle with that day', hist.includes('Big dinner'), () => hist.slice(0, 500));
    await page.goBack();
    await page.waitForTimeout(1500);

    // The limit: 12 months back, then the arrow stops.
    for (let i = back; i < 12; i++) await tap(page, visible(page.getByRole('button', { name: 'Previous month' })), { wait: 900 });
    const last = await sane(page, 'Oldest month');
    const old = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    await check(
      page,
      `Stops at ${MONTHS[old.getMonth()]} ${old.getFullYear()}, with the one-year note`,
      last.includes(`${MONTHS[old.getMonth()]} ${old.getFullYear()}`) && last.includes('goes back one year'),
      () => last.slice(-400),
    );
    const prev = page.getByRole('button', { name: 'Previous month' });
    await check(page, 'The back arrow is off', (await prev.getAttribute('aria-disabled')) === 'true', () => prev.getAttribute('aria-disabled'));
    await check(page, 'Nothing from over a year ago shows', !last.includes('Old Grab'), () => last.slice(-400));
    await page.close();
  });

  scenario('Agent Kip · log, change, remember, fix, take from the goal');
  await safely(async () => {
    const { db } = person({
      plan: 'plus',
      spends: [
        ['food', 55, 0, 'Coffee'],
        ['food', 500, 1, 'Shopee'],
      ],
    });
    db.profiles[0].ai_consent_at = new Date().toISOString();
    db.goals[0].saved_amount = 12400;
    db.kip = [
      {
        kind: 'log',
        reply: 'Logged 3.',
        items: [
          { name: 'ข้าวมันไก่', amount: 60, money: 'out', category: 'food' },
          { name: 'Grab', amount: 120, money: 'out', category: 'transport' },
          { name: 'ชานม', amount: 45, money: 'out', category: 'food' },
        ],
      },
      { kind: 'change', reply: 'Here’s what changes:', ops: [{ op: 'add_bill', name: 'Netflix', amount: 419, bill_type: 'streaming' }] },
      { kind: 'change', reply: 'Here’s what changes:', ops: [{ op: 'add_bill', name: 'Netflix', amount: 279, bill_type: 'streaming' }] },
      { kind: 'fix', reply: 'Here’s what changes:', fixes: [{ ref: 'r1', op: 'delete' }] },
      { kind: 'change', reply: 'Here’s what changes:', ops: [{ op: 'take_goal', amount: 2000 }] },
      { kind: 'change', reply: 'Here’s what changes:', ops: [{ op: 'remove_bill', name: 'Spotify' }] },
      { kind: 'log', reply: 'Logged.', items: [{ name: 'ข้าวผัด', amount: 70, money: 'out', category: 'food' }] },
      { kind: 'log', reply: 'Logged.', items: [{ name: 'ข้าวผัด', amount: 70, money: 'out', category: 'food' }] },
      { kind: 'change', reply: 'Here’s what changes:', ops: [{ op: 'add_bill', name: 'Netflix', amount: 419, bill_type: 'streaming', day: 18 }] },
      { kind: 'change', reply: 'Here’s what changes:', ops: [{ op: 'set_due', name: 'Netflix', day: 5 }] },
    ];
    const page = await open(browser, { db, path: '/talk' });
    const say = async (text) => {
      await type(page, 'Message Kip', text);
      await tap(page, visible(page.getByRole('button', { name: 'Send' })), { wait: 1800 });
    };
    const before = db.transactions.length;
    await say('ข้าวมันไก่ 60, Grab 120, ชานม 45');
    let txt = await sane(page, 'Kip logged three');
    await check(page, 'Logging saves straight away: 3 new spends, with Undo', db.transactions.length === before + 3 && /Saved all 3/.test(txt), () => ({
      n: db.transactions.length - before,
      txt: txt.slice(-300),
    }));
    await tap(page, visible(page.getByRole('button', { name: 'Undo' })).last(), { wait: 1200 });
    await check(page, 'Undo takes the 3 back', db.transactions.length === before, () => db.transactions.length - before);

    await say('add Netflix 419 every month');
    txt = await sane(page, 'Netflix preview');
    await check(
      page,
      'A change shows a preview card first — nothing saved yet',
      /Netflix/.test(txt) && /Preview/.test(txt) && !(db.profiles[0].budget.bills.items ?? []).some((b) => b.name === 'Netflix'),
      () => txt.slice(-400),
    );
    await say('actually it’s the ฿279 plan');
    const sent = db.kipSent[db.kipSent.length - 1];
    await check(page, 'Kip remembers: the follow-up is sent with the conversation so far', Array.isArray(sent.history) && sent.history.some((h) => /Netflix/.test(h.me)), () => sent.history);
    await tap(page, visible(page.getByRole('button', { name: 'Do it' })).last(), { wait: 1500 });
    const nf = (db.profiles[0].budget.bills.items ?? []).find((b) => b.name === 'Netflix');
    await check(
      page,
      '“Do it” adds Netflix at ฿279 a month, and every baht still has a job',
      !!nf && nf.amount === 279 && Math.abs(jobs(db.profiles[0].budget) - db.profiles[0].budget.income) <= 10,
      () => db.profiles[0].budget.bills,
    );
    await tap(page, visible(page.getByRole('button', { name: 'Undo' })).last(), { wait: 1500 });
    await check(page, 'Undo puts the month back', !(db.profiles[0].budget.bills.items ?? []).some((b) => b.name === 'Netflix'), () => db.profiles[0].budget.bills);

    const coffee = db.transactions.find((x) => x.note === 'Coffee');
    await say('delete the coffee');
    await tap(page, visible(page.getByRole('button', { name: 'Do it' })).last(), { wait: 1500 });
    await check(
      page,
      'A fix (“delete the coffee”) deletes that one, only on Do it',
      !!coffee && !db.transactions.some((x) => x.id === coffee.id) && db.transactions.some((x) => x.note === 'Shopee'),
      () => db.transactions.map((x) => x.note),
    );

    await say('take 2000 from Japan');
    txt = await sane(page, 'Take from goal preview');
    await check(page, 'Taking from the goal shows saved ฿12,400 → ฿10,400 first', /฿12,400/.test(txt) && /฿10,400/.test(txt), () => txt.slice(-400));
    await tap(page, visible(page.getByRole('button', { name: 'Do it' })).last(), { wait: 1500 });
    await check(
      page,
      '…and Do it takes it out of the goal',
      db.writes.some((w) => w === 'rpc take_from_goal 2000'),
      () => db.writes.filter((w) => w.startsWith('rpc')),
    );

    await say('remove Spotify');
    txt = await sane(page, 'Refused change');
    await check(page, 'Something that isn’t there is refused — no card, no Do it', /doesn’t fit your plan/.test(txt), () => txt.slice(-300));

    const n0 = db.transactions.length;
    await say('ข้าวผัด 70');
    txt = await sane(page, 'Logged once');
    await check(page, 'After logging, Kip says what’s left (or over) for today', /฿[\d,]+ (left|over) today/.test(txt.slice(-200)), () => txt.slice(-200));
    await say('ข้าวผัด 70');
    txt = await sane(page, 'Said twice');
    await check(page, 'Saying the same thing twice asks first — nothing saved twice', db.transactions.length === n0 + 1 && /already logged ข้าวผัด today/.test(txt), () => ({
      n: db.transactions.length - n0,
      txt: txt.slice(-300),
    }));

    // Step 3: what Kip is told, and the due day it can set.
    const told = db.kipSent[db.kipSent.length - 1].context;
    await check(
      page,
      'Kip is told the last months, due days and what the detective found',
      Array.isArray(told.lastMonths) && Array.isArray(told.dueDays) && told.noticed && Array.isArray(told.noticed.subscriptions),
      () => Object.keys(told),
    );
    await say('add Netflix 419 on the 18th');
    await tap(page, visible(page.getByRole('button', { name: 'Do it' })).last(), { wait: 1500 });
    const nd = (db.profiles[0].budget.bills.items ?? []).find((b) => b.name === 'Netflix');
    await check(page, 'A bill added with its day gets the day and a reminder the day before', !!nd && nd.day === 18 && nd.remind === 'before', () => nd);
    await say('actually Netflix is on the 5th');
    txt = await sane(page, 'Due day preview');
    await check(page, 'Changing a due day previews 18th → 5th', /18th/.test(txt) && /5th/.test(txt), () => txt.slice(-300));
    await tap(page, visible(page.getByRole('button', { name: 'Do it' })).last(), { wait: 1500 });
    await check(page, '…and Do it moves it to the 5th', (db.profiles[0].budget.bills.items ?? []).find((b) => b.name === 'Netflix')?.day === 5, () => db.profiles[0].budget.bills.items);
    await tap(page, visible(page.getByRole('button', { name: 'Save anyway' })), { wait: 1500 });
    await check(page, '“Save anyway” saves it', db.transactions.length === n0 + 2, () => db.transactions.length - n0);
    await page.close();
  });

  scenario('Every month · edit a bill, rent and delete; days open with Add to this day');
  await safely(async () => {
    const { db } = person({
      spends: [
        ['food', 120, 1, 'Lunch'],
        ['transport', 40, 1, 'วิน'],
      ],
    });
    // A bill added the way the app adds one (out of Kip's guess), so every baht has a job from the start.
    db.profiles[0].budget.bills.items = [{ name: 'Aia', amount: 300, type: 'insurance' }];
    db.profiles[0].budget.bills.guess -= 300;
    db.transactions.push({ ...db.transactions[0], id: 'inc1', kind: 'income', amount: 18000, note: 'เงินเดือน', category_id: null, occurred_at: new Date(Date.now() - 86400000).toISOString() });
    const B = () => db.profiles[0].budget;
    const page = await open(browser, { db, path: '/month' });
    await tap(page, visible(page.getByRole('button', { name: 'Edit Aia' })), { wait: 800 });
    const sheet = await sane(page, 'Edit sheet');
    await check(page, 'Tapping a bill opens it filled in: name and amount', /Edit bill/.test(sheet) && (await page.getByLabel('Bill name').inputValue()) === 'Aia', () => sheet.slice(-400));
    await page.getByLabel('Bill name').fill('AIA health');
    await page.getByLabel('Amount a month').fill('500');
    await page.waitForTimeout(300);
    const goalBefore = B().goal.amount + B().goalExtra;
    await tap(page, visible(page.getByRole('button', { name: 'Save changes' })), { wait: 800 });
    const aia = (B().bills.items ?? [])[0];
    await check(
      page,
      'Save changes: renamed and ฿500 a month, still one bill, every baht has a job',
      aia?.name === 'AIA health' && aia.amount === 500 && B().bills.items.length === 1 && Math.abs(jobs(B()) - B().income) <= 10,
      () => B().bills,
    );
    const rentWas = B().bills.rent;
    await tap(page, visible(page.getByRole('button', { name: 'Edit Rent' })), { wait: 800 });
    await page.getByLabel('Amount a month').fill(String(rentWas - 1000));
    await page.waitForTimeout(300);
    await tap(page, visible(page.getByRole('button', { name: 'Save changes' })), { wait: 800 });
    await check(
      page,
      'Rent can be changed: ฿1,000 less rent goes to the goal',
      B().bills.rent === rentWas - 1000 && B().goal.amount + B().goalExtra >= goalBefore && Math.abs(jobs(B()) - B().income) <= 10,
      () => ({ rent: B().bills.rent, goal: B().goal.amount + B().goalExtra }),
    );
    await tap(page, visible(page.getByRole('button', { name: 'Edit AIA health' })), { wait: 800 });
    await tap(page, visible(page.getByRole('button', { name: 'Delete this bill' })), { wait: 400 });
    await check(page, 'Delete asks once first', (B().bills.items ?? []).length === 1, () => B().bills.items);
    await tap(page, visible(page.getByRole('button', { name: /Delete AIA health\? Tap again/ })), { wait: 800 });
    await check(page, '…then deletes it', (B().bills.items ?? []).length === 0 && Math.abs(jobs(B()) - B().income) <= 10, () => B().bills.items);
    await page.close();

    // A day on Home's week opens that day.
    const home = await open(browser, { db });
    const y = new Date(Date.now() - 86400000);
    const day = home.getByRole('button', { name: new RegExp(`^[A-Z][a-z]{2} ${y.getDate()}, spent`) }).first();
    if (await day.count()) {
      await tap(home, day, { wait: 1000 });
      const txt = await sane(home, 'Day sheet');
      await check(home, 'Tapping yesterday shows its spends and money in', /Lunch/.test(txt) && /วิน/.test(txt) && /เงินเดือน/.test(txt) && /Add to this day/.test(txt), () => txt.slice(-500));
      await tap(home, visible(home.getByRole('button', { name: 'Add to this day' })), { wait: 1500 });
      await check(home, '“Add to this day” opens Add on that day', /\/add\?at=/.test(home.url()), () => home.url());
    }
    await home.close();
  });

  scenario('Home · tap the graph: This pay month');
  await safely(async () => {
    const { db } = person({
      spends: [
        ['food', 300, 0, 'Lunch'],
        ['shopping', 2600, 2, 'Shoes'],
        ['transport', 200, 1, 'Grab'],
      ],
    });
    const page = await open(browser, { db });
    await tap(page, visible(page.getByRole('button', { name: 'This pay month — see the details' })), { wait: 1000 });
    const txt = await sane(page, 'This pay month');
    const N = X.monthNumbers(db.profiles[0].budget, { total: spentSoFar(db), today: spentToday(db), bills: 0, byCat: {}, byDay: {} }, new Date());
    const per = N.P.daysLeft > 1 ? Math.floor(N.leftMonth / (N.P.daysLeft - 1) / 10) * 10 : 0;
    await check(page, `It says what each day can be from here (฿${per.toLocaleString('en-US')})`, N.P.daysLeft <= 1 || txt.includes(`Keep days under ฿${per.toLocaleString('en-US')}`), () =>
      txt.slice(-600),
    );
    await check(
      page,
      'It explains why, and lists what’s pushing the line up — biggest first',
      /Why:/.test(txt) && txt.indexOf('Shopping') < txt.indexOf('Food') && /What’s pushing the line up/.test(txt),
      () => txt.slice(-600),
    );
    await tap(page, visible(page.getByRole('button', { name: /^Shopping:/ })), { wait: 1000 });
    const cat = await sane(page, 'Shopping from the graph');
    await check(page, 'A category opens its sheet', /Shoes/.test(cat), () => cat.slice(-400));
    await page.close();
  });

  // ---------- Kip notices first ----------
  // Pay months that started 15 days ago (for "runs out") and 3 days ago (for "left over"), whatever today is.
  const dayAgo = (n) => Math.min(28, new Date(Date.now() - n * 86_400_000).getDate());
  scenario('Kip notices · food won’t last to payday');
  await safely(async () => {
    const first = person({ payday: dayAgo(15) });
    const food = first.budget.spend.find((x) => x.key === 'food').amount;
    const days = (() => {
      const t = new Date();
      const pd = dayAgo(15);
      const start = new Date(t.getFullYear(), t.getMonth() - (t.getDate() >= pd ? 0 : 1), pd);
      return Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - start) / 86_400_000);
    })();
    // Food spent at a pace that runs out well before payday: 85% of the month's food in the first half.
    const per = Math.round((food * 0.85) / days);
    const spends = Array.from({ length: days }, (_, i) => ['food', per, i + 1, 'Lunch']);
    const { db } = person({ payday: dayAgo(15), spends });
    const before = JSON.parse(JSON.stringify(db.profiles[0].budget));
    const page = await open(browser, { db });
    const txt = await screenText(page);
    await check(page, 'Kip’s line becomes a card: Food won’t last to payday', /Food & drinks won’t last to payday/.test(txt) && /Kip noticed/.test(txt), () => txt.slice(0, 600));
    await check(page, 'The card says when it runs out and shows the change', /runs out on/.test(txt) && /Then Food & drinks lasts to payday/.test(txt), () => txt.slice(0, 600));
    await tap(page, visible(page.getByRole('button', { name: 'Do it' })), { wait: 1500 });
    const after = db.profiles[0].budget;
    const sum = (b) => b.spend.reduce((a, x) => a + x.amount, 0);
    const amt = (b, k) => b.spend.find((x) => x.key === k)?.amount ?? 0;
    await check(page, 'Do it moves money into Food from budgets with room', amt(after, 'food') > amt(before, 'food'), () => ({ before: before.spend, after: after.spend }));
    await check(
      page,
      'Only budgets move: spending money, bills and saving stay the same',
      sum(after) === sum(before) && after.goal.amount === before.goal.amount && after.bills.rent === before.bills.rent,
      () => after,
    );
    const done = await screenText(page);
    await check(page, 'A Done line with Undo replaces the card', /Done/.test(done) && (await page.getByRole('button', { name: 'Undo' }).count()) > 0 && !/won’t last to payday/.test(done), () =>
      done.slice(0, 500),
    );
    await tap(page, visible(page.getByRole('button', { name: 'Undo' })), { wait: 1500 });
    await check(page, 'Undo puts the plan back exactly', JSON.stringify(db.profiles[0].budget.spend) === JSON.stringify(before.spend), () => db.profiles[0].budget.spend);
    await check(page, 'After Undo the card is back', /won’t last to payday/.test(await screenText(page)), () => '');
    await tap(page, visible(page.getByRole('button', { name: 'Not now' })), { wait: 1200 });
    const later = await screenText(page);
    await check(page, 'Not now puts it away; Kip’s line is back', !/won’t last to payday/.test(later) && (await page.getByRole('button', { name: /^Kip says:/ }).count()) > 0, () =>
      later.slice(0, 500),
    );
    await go(page, '/goals');
    await go(page, '/');
    await check(page, 'Still put away after coming back to Home', !/won’t last to payday/.test(await screenText(page)), () => '');
    await page.close();
  });

  scenario('Kip notices · on pace, Kip just talks');
  await safely(async () => {
    const { db } = person({ payday: dayAgo(15), spends: Array.from({ length: 10 }, (_, i) => ['food', 60, i + 1, 'Coffee']) });
    const page = await open(browser, { db });
    await check(page, 'No card when nothing needs a decision', !/Kip noticed/.test(await screenText(page)) && (await page.getByRole('button', { name: /^Kip says:/ }).count()) > 0, () => '');
    await page.close();
  });

  scenario('Kip notices · money left over last month');
  await safely(async () => {
    // Last pay month logged from its first days on, little spent; the new month started 6 days ago (after the
    // payday recap's days, which carry this card while they last).
    const spends = Array.from({ length: 29 }, (_, i) => ['food', 120, i + 7, 'Lunch']);
    const { db } = person({ payday: dayAgo(6), spends });
    const saved = db.goals[0].saved_amount;
    const page = await open(browser, { db });
    const txt = await screenText(page);
    await check(page, 'Kip asks about last month’s leftover money', /left over last month/.test(txt) && /If it’s still in your account/.test(txt), () => txt.slice(0, 600));
    const amount = Number((txt.match(/฿([\d,]+) left over last month/) ?? [])[1]?.replace(/,/g, '') ?? 0);
    await check(page, 'In whole hundreds', amount > 0 && amount % 100 === 0, () => amount);
    await tap(page, visible(page.getByRole('button', { name: 'Do it' })), { wait: 1800 });
    await check(page, 'Do it puts it toward the goal', db.goals[0].saved_amount === saved + amount && db.writes.includes('rpc put_in_goal ' + amount), () => ({
      saved: db.goals[0].saved_amount,
      writes: db.writes.slice(-3),
    }));
    await tap(page, visible(page.getByRole('button', { name: 'Undo' })), { wait: 1800 });
    await check(page, 'Undo takes it back out', db.goals[0].saved_amount === saved, () => db.goals[0].saved_amount);
    await tap(page, visible(page.getByRole('button', { name: 'Keep it' })), { wait: 1200 });
    await check(page, 'Keep it puts the card away', !/left over last month/.test(await screenText(page)), () => '');
    await page.close();
  });

  scenario('Kip notices · Thai');
  await safely(async () => {
    const first = person({ payday: dayAgo(15) });
    const food = first.budget.spend.find((x) => x.key === 'food').amount;
    const spends = Array.from({ length: 14 }, (_, i) => ['food', Math.round((food * 0.85) / 14), i + 1, 'ข้าว']);
    const { db } = person({ payday: dayAgo(15), spends });
    const page = await open(browser, { db, lang: 'th' });
    const txt = await screenText(page);
    await check(page, 'The card reads in Thai', /ไม่พอใช้ถึงวันเงินเดือนออก/.test(txt) && /Kip เห็นว่า/.test(txt), () => txt.slice(0, 500));
    await page.close();
  });

  // ---------- Bills: due days and reminders ----------
  scenario('Bills · a due day when adding, shown on Home');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db, path: '/month?add=1' });
    await tap(page, visible(page.getByRole('radio', { name: 'Streaming' })), { wait: 200 });
    await type(page, 'Bill name', 'Netflix');
    await type(page, 'Amount a month', 179);
    const before = await screenText(page);
    await check(
      page,
      'The day row is there; no reminder row until a day is picked',
      /Due every month on/.test(before) && !/Remind me/.test(before) && /Pick a day to get a reminder/.test(before),
      () => before.slice(-500),
    );
    const d = new Date(Date.now() + 3 * 86_400_000).getDate();
    await tap(page, visible(page.getByRole('radio', { name: d === 31 ? 'Last day of the month' : `Day ${d}` })), { wait: 300 });
    const after = await screenText(page);
    await check(page, 'Picking a day shows Remind me (Day before by default) and when it goes off', /Remind me/.test(after) && /9:00 on \d+ [A-Z][a-z]{2}, then every month/.test(after), () =>
      after.slice(-500),
    );
    await tap(page, visible(page.getByRole('button').filter({ hasText: /^Add Netflix · ฿179 a month$/ })), { wait: 2000 });
    const it = (db.profiles[0].budget.bills.items ?? []).find((b) => b.name === 'Netflix');
    await check(page, 'Saved with its day and a day-before reminder', it && it.day === d && it.remind === 'before', () => it);
    await go(page, '/');
    const home = await screenText(page);
    const label = d === new Date(Date.now() + 3 * 86_400_000).getDate() ? 'in 3 days' : '';
    await check(page, 'Home: “Due … · in 3 days”, and Netflix is next', new RegExp(`Netflix \\| Due \\d+ [A-Z][a-z]{2} · ${label}`).test(home) && /Next: \| Netflix in 3 days/.test(home), () =>
      home.slice(-700),
    );
    await page.close();
  });

  scenario('Bills · due today and not ticked: Kip asks');
  await safely(async () => {
    const { db } = person();
    const m = db.profiles[0].budget;
    const today = new Date().getDate();
    m.bills.items = [{ name: 'AIS Fibre', amount: 599, type: 'internet', day: today, remind: 'before' }];
    m.bills.guess -= 599;
    const page = await open(browser, { db });
    const txt = await screenText(page);
    await check(page, 'Kip’s card: AIS Fibre is due today, ฿599 set aside', /AIS Fibre is due today/.test(txt) && /฿599 \| is set aside for it\. Paid already\?/.test(txt), () => txt.slice(0, 900));
    await tap(page, visible(page.getByRole('button', { name: 'Paid' })), { wait: 1500 });
    const paid = db.profiles[0].budget.paid;
    await check(page, 'Paid ticks it off on Home', paid && paid.keys.includes('item:AIS Fibre'), () => paid);
    await check(page, 'A Done line with Undo', /AIS Fibre marked paid/.test(await screenText(page)), () => '');
    await tap(page, visible(page.getByRole('button', { name: 'Undo' })), { wait: 1500 });
    await check(
      page,
      'Undo unticks it, and the card is back',
      !(db.profiles[0].budget.paid?.keys ?? []).includes('item:AIS Fibre') && /AIS Fibre is due today/.test(await screenText(page)),
      () => db.profiles[0].budget.paid,
    );
    await tap(page, visible(page.getByRole('button', { name: 'Not yet' })), { wait: 1200 });
    await check(page, 'Not yet puts it away for today', !/is due today/.test(await screenText(page)), () => '');
    await page.close();
  });

  scenario('Bills · reminders switch in You');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db, path: '/profile' });
    const txt = await screenText(page);
    await check(
      page,
      'You has Bill reminders, on by default',
      /Bill reminders/.test(txt) &&
        (await page
          .getByRole('button', { name: 'Bill reminders on' })
          .locator('div')
          .first()
          .evaluate((e) => getComputedStyle(e).color)) === 'rgb(255, 255, 255)',
      () => txt.slice(0, 600),
    );
    await tap(page, visible(page.getByRole('button', { name: 'Bill reminders off' })), { wait: 600 });
    await check(page, 'Turned off, and remembered', (await page.evaluate(() => localStorage.getItem('heykip.billReminders'))) === 'off', () => 0);
    await page.close();
  });

  // ---------- Subscription detective ----------
  scenario('Detective · Spotify 3 months running, not a bill yet');
  await safely(async () => {
    const spends = [2, 32, 62].map((d) => ['other', 129, d, 'SPOTIFY P1A2B3 BKK']);
    const { db } = person({ spends });
    const before = JSON.stringify(db.profiles[0].budget.bills);
    const page = await open(browser, { db });
    const txt = await screenText(page);
    await check(page, 'Kip’s card: Spotify looks like a subscription, with the 3 payments', /Spotify looks like a subscription/.test(txt) && (txt.match(/฿129/g) ?? []).length >= 4, () =>
      txt.slice(0, 900),
    );
    await tap(page, visible(page.getByRole('button', { name: 'Add it', exact: true })), { wait: 1500 });
    const it = (db.profiles[0].budget.bills.items ?? []).find((b) => b.name === 'Spotify');
    const day = new Date(Date.now() - 32 * 86_400_000).getDate();
    await check(page, 'Add it: Spotify ฿129 in Every month, with its day and a reminder', it && it.amount === 129 && Math.abs(it.day - day) <= 3 && it.remind === 'before', () => it);
    await check(page, 'Done line says so', /Spotify added · ฿129 a month/.test(await screenText(page)), () => '');
    await tap(page, visible(page.getByRole('button', { name: 'Undo' })), { wait: 1500 });
    await check(page, 'Undo puts Every month back exactly', JSON.stringify(db.profiles[0].budget.bills) === before, () => db.profiles[0].budget.bills);
    await tap(page, visible(page.getByRole('button', { name: 'Not a bill' })), { wait: 1200 });
    await check(page, 'Not a bill: the card goes away', !/looks like a subscription/.test(await screenText(page)), () => '');
    await page.close();
  });

  scenario('Detective · show Kip your subscriptions screen');
  await safely(async () => {
    const { db } = person({ plan: 'trial' });
    db.readSlip = [
      {
        is_list: true,
        items: [
          { name: 'YouTube Premium', amount: 179, period: 'month', renews: '2026-12-18' },
          { name: 'iCloud+', amount: 35, period: 'month', renews: '2026-12-03' },
          { name: 'Duolingo', amount: 1290, period: 'year', renews: '2027-03-09' },
        ],
      },
    ];
    const page = await open(browser, { db, path: '/month?subs=1' });
    const how = await screenText(page);
    await check(page, 'The sheet says where to find the list and what Kip reads', /Show Kip your subscriptions/.test(how) && /Settings → tap your name → Subscriptions/.test(how), () =>
      how.slice(-700),
    );
    const png = require('path').join(__dirname, 'out', 'shot.png');
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width: 200, height: 300 } });
    const chooser = page.waitForEvent('filechooser', { timeout: 8000 });
    await tap(page, visible(page.getByRole('button', { name: /^Choose screenshots/ })), { wait: 100 });
    await (await chooser).setFiles(png);
    await page.waitForTimeout(4000);
    const found = await screenText(page);
    await check(page, 'Kip lists what it read, ticked', /Kip found 3 subscriptions/.test(found) && /YouTube Premium/.test(found) && /Duolingo/.test(found), () => found.slice(-900));
    await check(page, 'It says what adding them does', /Adds ฿[\d,]+ a month to Every month/.test(found), () => found.slice(-500));
    await tap(page, visible(page.getByRole('button', { name: /^Add 3 subscriptions$/ })), { wait: 1500 });
    const items = db.profiles[0].budget.bills.items ?? [];
    const yt = items.find((b) => b.name === 'YouTube Premium');
    const duo = items.find((b) => b.name === 'Duolingo');
    await check(
      page,
      'All 3 added: days, reminders, Duolingo as a yearly bill',
      yt && yt.day === 18 && yt.remind === 'before' && duo && duo.yearly && duo.yearly.total === 1290 && duo.yearly.due === '2027-03',
      () => items,
    );
    await check(page, 'The read asked for a subscriptions list', db.readSent && db.readSent[0].kind === 'subs', () => db.readSent);
    await page.close();
  });

  // ---------- Payday recap ----------
  // The new pay month started 2 days ago; last month logged on most days, food well over, shopping barely used.
  const recapSeed = (plan) => {
    const pd = dayAgo(2);
    const first = person({ payday: pd, plan });
    const food = first.budget.spend.find((x) => x.key === 'food').amount;
    const spends = [];
    for (let d = 3; d < 31; d++) spends.push(['food', Math.round((food * 1.25) / 28), d, 'Lunch']);
    spends.push(['shopping', 200, 10, 'Shopee']);
    return person({ payday: pd, plan, spends });
  };
  scenario('Recap · payday, Plus');
  await safely(async () => {
    const { db } = recapSeed('trial');
    const before = JSON.parse(JSON.stringify(db.profiles[0].budget.spend));
    db.kipDo = [{ ok: true, reply: 'Most of the food money went on weekday lunches. Shopping hardly moved.', picks: [] }];
    const page = await open(browser, { db });
    const card = await screenText(page);
    await check(page, 'The recap card leads Home on payday', /Payday recap/.test(card) && /in a minute/.test(card) && /Kip suggests/.test(card), () => card.slice(0, 900));
    await tap(page, visible(page.getByRole('button', { name: 'Read the recap' })), { wait: 2500 });
    const sheet = await screenText(page);
    await check(page, 'The recap: how it went, saving, what Kip noticed', /How it went/.test(sheet) && /Food & drinks/.test(sheet) && /weekday lunches/.test(sheet), () => sheet.slice(-1200));
    await check(
      page,
      'Kip was asked once, with numbers and suggestion ids',
      db.kipDoSent?.length === 1 && db.kipDoSent[0].task === 'recap' && db.kipDoSent[0].context.suggestions.length > 0,
      () => db.kipDoSent,
    );
    await check(page, 'It suggests moving money to Food from a budget that stayed under', /Move ฿[\d,]+ from [A-Za-z &]+ to Food & drinks/.test(sheet), () => sheet.slice(-900));
    await tap(page, visible(page.getByRole('button', { name: /^Do it: Move/ })), { wait: 1200 });
    const after = db.profiles[0].budget.spend;
    const amt = (sp, k) => sp.find((x) => x.key === k).amount;
    await check(
      page,
      'Do it: Food up, another budget down by the same amount',
      amt(after, 'food') > amt(before, 'food') && after.reduce((a, x) => a + x.amount, 0) === before.reduce((a, x) => a + x.amount, 0),
      () => ({ before, after }),
    );
    await tap(page, visible(page.getByRole('button', { name: 'Undo' })), { wait: 1200 });
    await check(page, 'Undo puts the month back', JSON.stringify(db.profiles[0].budget.spend) === JSON.stringify(before), () => db.profiles[0].budget.spend);
    await page.close();
  });

  scenario('Recap · Free sees the numbers');
  await safely(async () => {
    const { db } = recapSeed('free');
    const page = await open(browser, { db });
    const card = await screenText(page);
    await check(page, 'Free: the numbers and what went most over, Kip’s part is Plus', /in a minute/.test(card) && /Most over: /.test(card) && /What Kip noticed \+ changes/.test(card), () =>
      card.slice(0, 900),
    );
    await check(page, 'Free: Kip is not asked', !(db.writes ?? []).some((w) => /kip-do/.test(w)), () => db.writes);
    await page.close();
  });

  scenario('Recap · stays in History');
  await safely(async () => {
    const { db } = recapSeed('trial');
    db.kipDo = [{ ok: true, reply: 'Lunches again.', picks: [] }];
    const page = await open(browser, { db, path: '/history' });
    const txt = await screenText(page);
    await check(page, 'History has last month’s recap at the top', / recap/.test(txt), () => txt.slice(0, 500));
    await tap(page, visible(page.getByRole('button', { name: / recap$/ })), { wait: 3000 });
    await check(page, 'Opening it shows the recap', /How it went/.test(await screenText(page)), () => '');
    await page.close();
  });

  // ---------- Saving first: a calmer goal card ----------
  scenario('Saving first · no day counts, the photo card stays');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db });
    const home = await screenText(page);
    await check(
      page,
      'A real goal shows its name and “on track for <month>”, never a day count',
      /Japan \| My promise/.test(home) && /On track for [A-Z][a-z]{2} 20\d\d/.test(home) && !/\d+ days \|/.test(home.split('Your goal')[1] ?? ''),
      () => home.slice(home.indexOf('Your goal'), home.indexOf('Your goal') + 400),
    );
    await go(page, '/goals');
    const tab = await screenText(page);
    await check(page, 'The tab is called Your goals and offers + Add a goal', /^Your goals \| and why you save/.test(tab) && /Add a goal/.test(tab), () => tab.slice(0, 300));
    await page.close();
  });
  await safely(async () => {
    const { db } = person({ goal: { title: 'Rainy day', kind: 'monthly', monthly: 3000, saved: 9300 } });
    const page = await open(browser, { db });
    const home = await screenText(page);
    await check(
      page,
      'A monthly saver’s card: name, “Why I save”, this month and saved so far',
      /Your saving \| Rainy day \| Why I save/.test(home) && /฿3,000 this month/.test(home) && /฿9,300 saved so far/.test(home),
      () => home.slice(home.indexOf('Your goal'), home.indexOf('Your goal') + 400),
    );
    await page.close();
  });

  // ---------- Sheets close with a drag ----------
  scenario('Sheets · drag down to close');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db });
    const dragDown = async (loc, dy) => {
      const box = await loc.boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let k = 1; k <= 20; k++) {
        await page.mouse.move(x, y + (dy * k) / 20);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      await page.waitForTimeout(900);
    };
    const ask = () => page.getByRole('button', { name: /^Ask Kip anything/ });
    await tap(page, visible(page.getByRole('button', { name: /^Kip says:/ })), { wait: 1200 });
    await check(page, 'Kip’s note opens', (await ask().count()) > 0, () => '');
    await dragDown(visible(page.getByText('Kip', { exact: true })), 40);
    await check(page, 'A small drag springs back — the sheet stays', (await ask().count()) > 0, () => '');
    await dragDown(visible(page.getByText('Kip', { exact: true })), 260);
    await check(page, 'Dragging it down closes it', (await ask().count()) === 0, () => '');
    const why = () => page.getByText(/^Why:/);
    await tap(page, visible(page.getByRole('button', { name: 'This pay month — see the details' })), { wait: 1000 });
    const opened = await why().count();
    await dragDown(visible(page.getByText('This pay month', { exact: true })), 260);
    await check(page, 'The pay-month sheet closes with a drag too', opened > 0 && (await why().count()) === 0, () => opened);
    await page.close();
  });

  // ---------- Plus can't be faked ----------
  // The database refuses plan writes from the app (guard_plan); the mock does the same and keeps each try as "refused …".
  scenario('Plus · the free week is started by the server');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db, path: '/talk' });
    await check(page, 'Free: Talk to Kip is locked', (await page.getByPlaceholder('Talk to Kip is a Plus feature').count()) > 0, () => db.profiles[0].plan);
    await tap(page, visible(page.getByRole('button', { name: 'Try free for 7 days' })), { wait: 2500 });
    await check(page, 'The trial is asked of the server (start_trial), not written by the app', db.writes.includes('rpc start_trial'), () => db.writes);
    await check(page, 'The app never tried to write its own plan', !db.writes.some((w) => w.startsWith('refused')), () => db.writes);
    await check(page, 'The trial ends in 7 days', Math.abs(new Date(db.profiles[0].trial_ends_at).getTime() - Date.now() - 7 * 86_400_000) < 60_000, () => db.profiles[0]);
    await check(page, 'Talk to Kip opens', (await page.getByPlaceholder('Message Kip').count()) > 0, () => db.profiles[0].plan);
    await page.close();
  });

  scenario('Plus · an ended trial is Free, and can’t start again');
  await safely(async () => {
    const { db } = person({ plan: 'trial' });
    Object.assign(db.profiles[0], { trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(), trial_used: true });
    const page = await open(browser, { db, path: '/talk' });
    await check(page, 'A trial that ended yesterday is locked again', (await page.getByPlaceholder('Talk to Kip is a Plus feature').count()) > 0, () => db.profiles[0]);
    await tap(page, visible(page.getByRole('button', { name: 'Try free for 7 days' })), { wait: 2000 });
    const txt = await screenText(page);
    await check(page, 'A second free week is refused, and it says so', /already used/.test(txt) && !db.writes.includes('rpc start_trial'), () => ({ writes: db.writes, txt: txt.slice(-300) }));
    await check(page, 'Still Free after trying', db.profiles[0].trial_ends_at < new Date().toISOString(), () => db.profiles[0]);
    await page.close();
  });

  scenario('Plus · cheating is refused');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db });
    // What a cheater would send from the app: set their own plan.
    const cheat = await page.evaluate(
      async (url) => {
        const r = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'yearly', trial_ends_at: '2099-01-01' }) });
        return r.status;
      },
      'https://qegkanosplyprrxuikia.supabase.co' + '/rest/v1/profiles?id=eq.' + db.profiles[0].id,
    );
    await check(page, 'Setting your own plan is refused', db.profiles[0].plan === 'free' && db.writes.includes('refused profiles plan,trial_ends_at'), () => ({
      cheat,
      p: db.profiles[0],
      writes: db.writes,
    }));
    await go(page, '/talk');
    await check(page, 'Kip stays locked after the cheat', (await page.getByPlaceholder('Talk to Kip is a Plus feature').count()) > 0, () => db.profiles[0].plan);
    await page.close();
  });

  scenario('First use · the tour points at each spot, once');
  await safely(async () => {
    const { db } = person();
    const page = await open(browser, { db, tour: true });
    await page.waitForTimeout(1500);
    const seen = [];
    for (let k = 0; k < 4; k++) {
      const txt = await screenText(page);
      seen.push((txt.match(/Your number for today|Log what you spent|Ask Kip anything|Your plan, your goals, you/) || ['?'])[0]);
      const btn = page.getByRole('button', { name: k === 3 ? 'Got it' : 'Next' }).last();
      if (!(await btn.count())) break;
      await btn.click({ force: true });
      await page.waitForTimeout(700);
    }
    await check(page, 'Four stops in order: today, +, Kip, the bar', seen.join('|') === 'Your number for today|Log what you spent|Ask Kip anything|Your plan, your goals, you', () => seen);
    const left = await page.evaluate((uid) => localStorage.getItem('heykip.tour.v1.' + uid), db.profiles[0].id);
    await check(page, 'Seen once — remembered on this phone', left === 'done', () => left);
    await page.reload();
    await page.waitForTimeout(3500);
    await check(page, 'It doesn’t come back', !/Your number for today/.test(await screenText(page)), () => 0);
    await page.close();
  });

  scenario('Kip’s bill guess · editable like a bill');
  await safely(async () => {
    const { db } = person();
    const m0 = JSON.parse(JSON.stringify(db.profiles[0].budget));
    const page = await open(browser, { db, path: '/month?guess=1' });
    const txt = await sane(page, 'Guess sheet');
    await check(page, 'Opens on Kip’s guess, with where the money goes', /Other bills · Kip’s guess/.test(txt) && /fun money/.test(txt), () => txt.slice(0, 400));
    const to = m0.bills.guess > 500 ? 500 : m0.bills.guess + 500;
    await tap(page, visible(page.getByRole('radio', { name: '฿' + to.toLocaleString('en-US') })));
    await tap(page, visible(page.getByRole('button', { name: 'Save' })).last(), { wait: 1500 });
    const m = db.profiles[0].budget;
    const sum = (x) =>
      x.bills.rent + x.bills.guess + (x.bills.items || []).reduce((a, b) => a + b.amount, 0) + x.goal.amount + x.goalExtra + (x.safety?.amount || 0) + x.spend.reduce((a, b) => a + b.amount, 0);
    await check(page, `The guess is now ฿${to} and the month still adds up`, m.bills.guess === to && sum(m) === sum(m0), () => ({
      guess: m.bills.guess,
      was: m0.bills.guess,
      sum: sum(m),
      sum0: sum(m0),
    }));
    if (to < m0.bills.guess) await check(page, 'Lowering it gave the difference to the goal', m.goalExtra - m0.goalExtra === m0.bills.guess - to, () => ({ extra: m.goalExtra, was: m0.goalExtra }));
    await page.close();
  });
};
