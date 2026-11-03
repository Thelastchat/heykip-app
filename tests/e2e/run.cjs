// The screen tests: run with `npm run test:e2e` (builds the web version, serves it, and taps through the app).
// Prints every rule as ✓/✗ and writes tests/e2e/out/report.json (+ a screenshot for every failure).
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { results, OUT } = require('./kit.cjs');

(async () => {
  const root = path.join(__dirname, '../..');
  process.env.EXPECT = path.join(require('os').tmpdir(), 'heykip-expect.cjs');
  execSync(`node tests/bundle.cjs tests/e2e/expect.ts ${process.env.EXPECT}`, { cwd: root, stdio: 'inherit' });
  if (!process.env.SKIP_BUILD) execSync('npx expo export -p web', { cwd: root, stdio: 'ignore' });
  const server = process.env.BASE ? null : spawn('node', [path.join(__dirname, 'serve.cjs'), path.join(root, 'dist'), '8765'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const { chromium } = require('playwright');
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const only = process.argv[2];
  try {
    for (const part of ['setup', 'home', 'screens']) {
      if (only && only !== part) continue;
      const file = path.join(__dirname, part + '.cjs');
      if (fs.existsSync(file)) await require(file)(browser);
    }
  } finally {
    await browser.close();
    server?.kill();
  }
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 1));
  console.log(`\n${results.length} checks, ${failed.length} failed.`);
  process.exit(failed.length ? 1 : 0);
})();
