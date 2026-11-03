// Shared helpers for the screen tests: open the app signed in (or not), tap what a person would tap, read numbers
// off the screen, and check every screen for the things that should never show (NaN, undefined, a crash…).
const fs = require('fs');
const path = require('path');
const { makeDb, install, session } = require('./mock.cjs');

const BASE = process.env.BASE || 'http://localhost:8765';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let current = 'setup';
/** One rule checked in one scenario. Failures keep a screenshot. */
async function check(page, rule, ok, detail) {
  const r = { scenario: current, rule, ok: !!ok, detail: ok ? undefined : typeof detail === 'function' ? detail() : detail };
  if (!ok && page) {
    r.shot = path.join(OUT, `${results.length}-${current.replace(/\W+/g, '_')}.png`.slice(0, 120));
    await page.screenshot({ path: r.shot, fullPage: true }).catch(() => {});
  }
  results.push(r);
  console.log(`${ok ? '  ✓' : '  ✗'} ${rule}${ok ? '' : `  → ${String(JSON.stringify(r.detail)).slice(0, 300)}`}`);
}
const scenario = (name) => {
  current = name;
  console.log(`\n▸ ${name}`);
};

/** A fresh phone: chosen look and language, signed in or not, with this database behind it. */
async function open(browser, { db = makeDb(), look = 'light', lang = 'en', signedIn = true, path: p = '/', width = 390 } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
  // “No handler for tag”: the gesture library on the web, when a swiped row is removed — doesn't happen on phones.
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|503|net::|favicon|No handler for tag/.test(m.text()) && page.errors.push('console: ' + m.text().slice(0, 200)));
  await install(page, db);
  await page.goto(BASE + '/');
  await page.evaluate(
    ({ s, look, lang, signedIn }) => {
      localStorage.clear();
      if (signedIn) localStorage.setItem('sb-qegkanosplyprrxuikia-auth-token', s);
      localStorage.setItem('heykip.look', look);
      localStorage.setItem('heykip.lang', lang);
    },
    { s: JSON.stringify(session), look, lang, signedIn },
  );
  await page.goto(BASE + p);
  await page.waitForTimeout(2500);
  page.db = db;
  return page;
}

const visible = (loc) => loc.locator('visible=true').last();
/** Tap the visible thing with this text (screens behind the current one stay in the page on web). */
async function tap(page, text, { exact = true, wait = 900 } = {}) {
  const loc = typeof text === 'string' ? page.locator(`text=${exact ? `"${text}"` : text} >> visible=true`).last() : visible(text);
  await loc.click({ timeout: 8000 });
  await page.waitForTimeout(wait);
}
async function type(page, label, value) {
  await visible(page.getByLabel(label, { exact: true })).fill(String(value), { force: true });
  await page.waitForTimeout(150);
}
async function go(page, p, wait = 2200) {
  await page.goto(BASE + p);
  await page.waitForTimeout(wait);
}
/** Everything a person can read right now (only what's on screen, not the screens behind). */
async function screenText(page) {
  return page
    .evaluate(() => {
      const out = [];
      const walk = (el) => {
        for (const c of el.childNodes) {
          if (c.nodeType === 3) {
            const p = c.parentElement;
            const r = p.getBoundingClientRect();
            const st = getComputedStyle(p);
            if (r.width && r.height && r.right > 0 && r.left < innerWidth && st.visibility !== 'hidden' && st.opacity !== '0' && c.textContent.trim()) out.push(c.textContent.trim());
          } else if (c.nodeType === 1) walk(c);
        }
      };
      walk(document.body);
      return out.join(' | ');
    })
    .then((t) => t.replace(/฿ \| /g, '฿'));
}
/** "฿8,400" → 8400 for the first number after a label on screen. */
const money = (s) => (s ? Number(String(s).replace(/[^\d-]/g, '')) : NaN);

/** The things that must never show on any screen. */
async function sane(page, where) {
  const text = await screenText(page);
  const bad = [/\bNaN\b/, /\bundefined\b/, /\bnull\b/, /Infinity/, /\{[a-z]+\}/i, /฿-\d/, /\[object/].filter((re) => re.test(text));
  await check(page, `${where}: nothing broken on screen (NaN, undefined, {placeholders}, ฿-…)`, !bad.length, () => ({ bad: bad.map(String), text: text.slice(0, 400) }));
  await check(page, `${where}: no crash or error`, !page.errors.length, () => page.errors.slice(0, 3));
  page.errors = [];
  return text;
}

module.exports = { BASE, OUT, results, check, scenario, open, tap, type, go, screenText, money, sane, visible };
