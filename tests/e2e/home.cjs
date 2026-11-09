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
    await check(page, 'This month’s spends are listed for today', cal.includes('Bubble tea'), () => cal.slice(-500));
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
    const card = day.slice(day.lastIndexOf('Payday'));
    await check(page, 'Tapping the day lists the dinner, and says how far over the daily budget', card.includes('Big dinner') && /฿[\d,]+ over/.test(card) && !card.includes('Rent'), () => card);
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
    await page.close();
  });
};
