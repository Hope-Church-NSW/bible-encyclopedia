const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, 'offline-assets.json');
const runtimeData = new Set([
  'bible.json',
  'bible-en.json',
  'cross-references.json',
  'original-language-bible.json',
  'verse-geography.json',
  'encyclopedia_ar.json',
  'encyclopedia_en.json',
  'encyclopedia_b.json',
  'encyclopedia_n.json',
  'commentary.json'
]);

function filesIn(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(absolute, predicate);
    return predicate(absolute) ? [absolute] : [];
  });
}

const files = [
  ...filesIn(ROOT, (file) => path.dirname(file) === ROOT && path.extname(file) === '.html'),
  ...filesIn(path.join(ROOT, 'assets')),
  ...filesIn(path.join(ROOT, 'commentary-data'), (file) => path.extname(file) === '.json'),
  ...filesIn(path.join(ROOT, 'commentary-data-en'), (file) => path.extname(file) === '.json'),
  ...filesIn(ROOT, (file) => path.dirname(file) === ROOT && runtimeData.has(path.basename(file))),
  ...filesIn(ROOT, (file) => path.dirname(file) === ROOT && /-study(?:-en)?\.txt$/.test(path.basename(file))),
  path.join(ROOT, 'manifest.webmanifest'),
  path.join(ROOT, 'service-worker.js')
].filter((file) => fs.existsSync(file));

const assets = [...new Set(files.map((file) => path.relative(ROOT, file).replace(/\\/g, '/')))].sort();
const version = crypto.createHash('sha256').update(assets.map((asset) => {
  const file = path.join(ROOT, asset);
  return `${asset}:${fs.statSync(file).size}:${fs.statSync(file).mtimeMs}`;
}).join('\n')).digest('hex').slice(0, 16);
fs.writeFileSync(OUTPUT, `${JSON.stringify({ version, assets }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ assets: assets.length, output: path.basename(OUTPUT) }));