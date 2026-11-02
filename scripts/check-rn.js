// Every part of React Native the app imports must be listed in src/lib/rn.ts, or it is undefined on phones
// (web loads the parts another way, so it won't show there). Run: npm run check:rn
const fs = require('fs');
const path = require('path');

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name) && !/(rn\.ts|thaiText\.tsx|\.d\.ts)$/.test(e.name)) files.push(p);
  }
})(path.join(__dirname, '..', 'src'));

const used = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+'react-native'/g)) {
    for (const part of m[2].split(',').map((x) => x.trim()).filter(Boolean)) {
      if (m[1] || part.startsWith('type ')) continue;
      used.add(part.split(' as ')[0].trim());
    }
  }
}
const rn = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'rn.ts'), 'utf8');
const listed = new Set([...rn.match(/export \{([^}]*)\} from '@real\/react-native'/)[1].split(',').map((x) => x.trim()).filter(Boolean), 'Text', 'TextInput']);
const missing = [...used].filter((n) => !listed.has(n));
if (missing.length) {
  console.error('Add to src/lib/rn.ts:', missing.join(', '));
  process.exit(1);
}
console.log(`rn.ts lists all ${used.size} React Native parts the app uses.`);
