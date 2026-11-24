// iPhone Text Size (approved system, src/lib/textSize.tsx): every screen at Default, Large and Larger, English and
// Thai. At Large and Larger nothing may be cut off that fits at Default (an ellipsis or a clipped line that only
// appears because the text grew), and no text may run past the edge of the phone.
const { check, scenario, open, sane } = require('./kit.cjs');
const { person } = require('./seed.cjs');

const ROUTES = [
  '/',
  '/plan',
  '/goals',
  '/profile',
  '/add',
  '/history',
  '/calendar',
  '/talk',
  '/privacy',
  '/privacy-policy',
  '/safety',
  '/slips',
  '/styles',
  '/goal-new',
  '/goal-edit?id=g1',
  '/kip-moods',
];

/** Every piece of text that is cut off (ellipsis or clipped lines), and every one that runs past the phone's edge. */
async function measure(page) {
  return page.evaluate(() => {
    const cut = [];
    const out = [];
    const W = window.innerWidth;
    const scrollsSideways = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll('div[dir="auto"], span[dir="auto"], input, textarea')) {
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || el.closest('[aria-hidden="true"]')) continue;
      const text = (el.value || el.placeholder || el.textContent || '').trim();
      if (!text) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const clamps = s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none') || s.overflow === 'hidden';
      const oneLine = s.whiteSpace === 'nowrap' || s.whiteSpace === 'pre';
      if (clamps && (el.scrollWidth > el.clientWidth + 1 || (!oneLine && el.scrollHeight > el.clientHeight + 4))) cut.push(text.slice(0, 60));
      if ((r.right > W + 1 || r.left < -1) && !scrollsSideways(el)) out.push(text.slice(0, 60));
    }
    return { cut: [...new Set(cut)], out: [...new Set(out)] };
  });
}

module.exports = async function (browser) {
  for (const lang of ['en', 'th']) {
    scenario(`Text Size · every screen at Default, Large and Larger (${lang === 'th' ? 'Thai' : 'English'})`);
    for (const path of ROUTES) {
      const seen = {};
      for (const step of [0, 1, 2]) {
        const { db } = person({
          plan: 'trial',
          safety: 10000,
          spends: [
            ['food', 120, 0, 'Lunch'],
            ['transport', 42, 1, 'BTS'],
          ],
        });
        const page = await open(browser, { db, path, lang, textStep: step });
        await page.waitForTimeout(1500);
        const where = `${path} · ${['Default', 'Large', 'Larger'][step]} · ${lang}`;
        await sane(page, where);
        // Scroll through the screen so text further down is measured too.
        const found = { cut: new Set(), out: new Set() };
        for (let i = 0; i < 6; i++) {
          const m = await measure(page);
          m.cut.forEach((x) => found.cut.add(x));
          m.out.forEach((x) => found.out.add(x));
          await page.mouse.move(195, 500);
          await page.mouse.wheel(0, 600);
          await page.waitForTimeout(250);
        }
        seen[step] = found;
        await check(page, `${where}: no text past the edge of the phone`, !found.out.size, () => [...found.out]);
        if (step) {
          const newlyCut = [...found.cut].filter((x) => !seen[0].cut.has(x));
          await check(page, `${where}: nothing cut off that fits at Default`, !newlyCut.length, () => newlyCut);
        }
        await page.close();
      }
    }
  }
};
