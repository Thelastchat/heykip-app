// Finds every t('…') / rich('…') sentence in the app and lists the ones with no Thai line yet.
// Run: npx tsx scripts/check-i18n.ts            (all areas)
//      npx tsx scripts/check-i18n.ts src/app/add.tsx src/components/MonthScreen.tsx   (just these files)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { TH } from '../src/i18n/th';

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.tsx?$/.test(f) ? [join(d, f)] : []));
const files = process.argv.slice(2).length ? process.argv.slice(2) : walk('src').filter((f) => !f.includes('src/i18n/') && !f.endsWith('lib/i18n.tsx'));
const call = /\b(?:t|rich)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/gs;
let missing = 0,
  total = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(call)) {
    if (m[1] === '`' && m[2].includes('${')) {
      console.log(`✗ ${f}: template with \${} — use {name} vars instead: ${m[2].slice(0, 60)}`);
      missing++;
      continue;
    }
    const key = m[2].replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
    total++;
    if (!(key in TH)) {
      missing++;
      console.log(`✗ ${f}: ${key}`);
    }
  }
}
console.log(`\n${total} sentences, ${missing} without Thai.`);
process.exit(missing ? 1 : 0);
