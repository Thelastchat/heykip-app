// Every screen, for every kind of person: nothing broken on screen, no crash, nothing wider than the phone.
// Then Thai + Dark, and a small phone (320 px wide, like an iPhone SE).
const { check, scenario, open, go, sane } = require('./kit.cjs');
const { person } = require('./seed.cjs');

const ROUTES = ['/', '/goals', '/add', '/history', '/month', '/profile', '/safety', '/slips', '/talk', '/privacy', '/privacy-policy', '/kip-moods', '/goal-edit?id=g1', '/goal-new', '/styles'];
const days = (n) => n;

const PEOPLE = {
  'Kip’s plan, free, a few spends': () =>
    person({
      spends: [
        ['food', 120, 0, 'Lunch'],
        ['transport', 42, days(1), 'BTS'],
        ['shopping', 890, days(3), 'Uniqlo'],
      ],
    }),
  'Plus with 3 goals (trip, phone, Mum) and a safety net': () =>
    person({
      plan: 'trial',
      safety: 10000,
      spends: [
        ['food', 300, 0, 'Hotpot'],
        ['fun', 450, days(2), 'Movie'],
      ],
      extraGoals: [
        { title: 'New phone', kind: 'gadget', target_amount: 30000, due_date: '2027-08-25' },
        { title: 'Mum', kind: 'monthly', target_amount: null, monthly_amount: 1000, due_date: null },
      ],
    }),
  'Save first, payday on the 31st': () => person({ style: 'savefirst', payday: 31, spends: [['food', 200, 0]] }),
  'Only a monthly goal (Mum ฿2,000)': () => person({ goal: { title: 'Mum', kind: 'monthly', monthly: 2000 } }),
  'Saving for an emergency fund': () => person({ goal: { title: 'Safety net', kind: 'safety_net', target: 45000, saved: 0, due: null } }),
  'Went over the whole month': () =>
    person({
      spends: [
        ['shopping', 9000, 1, 'iPad'],
        ['food', 2500, 0, 'Party'],
      ],
    }),
  'Goal already reached': () => person({ goal: { title: 'Japan trip', kind: 'trip', target: 60000, saved: 60000, due: '2027-12-25' } }),
  'Brand new, nothing logged, 6 Jars': () => person({ style: 'jars', payday: 1 }),
};

module.exports = async function screenTests(browser) {
  for (const [who, make] of Object.entries(PEOPLE)) {
    scenario('Every screen · ' + who);
    const { db } = make();
    const page = await open(browser, { db });
    for (const r of ROUTES) {
      await go(page, r, 1800);
      await sane(page, r);
    }
    await page.close();
  }
  for (const [label, opts] of [
    ['Thai + Dark', { lang: 'th', look: 'dark' }],
    ['Small phone (320 px)', { width: 320 }],
  ]) {
    scenario('Every screen · ' + label);
    const { db } = PEOPLE['Plus with 3 goals (trip, phone, Mum) and a safety net']();
    const page = await open(browser, { db, ...opts });
    for (const r of ROUTES) {
      await go(page, r, 1800);
      await sane(page, r);
      const wide = await page.evaluate(() => {
        const W = innerWidth;
        return [...document.querySelectorAll('div,span')]
          .filter((e) => {
            const b = e.getBoundingClientRect();
            const s = getComputedStyle(e);
            // Visible text sticking out past the right edge (horizontal swipe rows are allowed to).
            return (
              b.width &&
              b.right > W + 2 &&
              e.childNodes.length &&
              [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) &&
              !e.closest('[style*="overflow-x"], [data-testid=row]') &&
              s.visibility !== 'hidden'
            );
          })
          .filter((e) => !e.closest('div[class*="r-150rngu"]'))
          .slice(0, 3)
          .map((e) => e.textContent.trim().slice(0, 40));
      });
      if (opts.width) await check(page, `${r}: no text cut off at the right edge`, !wide.length, () => wide);
    }
    await page.close();
  }
};
