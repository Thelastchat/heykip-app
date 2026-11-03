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
    await tap(page, visible(page.getByRole('button').filter({ hasText: fmt(N.overToday) })).first(), { wait: 1500 }).catch(() => {});
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
};
