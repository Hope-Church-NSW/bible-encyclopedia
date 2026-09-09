const fs = require('fs');

const arabic = JSON.parse(fs.readFileSync('encyclopedia_ar.json', 'utf8'));
const english = JSON.parse(fs.readFileSync('encyclopedia_en.json', 'utf8'));
const errors = [];
const arabicPattern = /[\u0600-\u06ff]/;
const sourceIds = new Set(arabic.entries.map((entry) => entry.id));
const seenIds = new Set();

if (english.language !== 'en') errors.push('language must be en');
if (!Array.isArray(english.entries) || !english.entries.length) errors.push('entries must be a non-empty array');

for (const entry of english.entries || []) {
  if (!sourceIds.has(entry.id)) errors.push(`unknown id: ${entry.id}`);
  if (seenIds.has(entry.id)) errors.push(`duplicate id: ${entry.id}`);
  seenIds.add(entry.id);

  for (const field of ['title', 'category', 'content']) {
    if (!entry[field]) errors.push(`${entry.id}: missing ${field}`);
    if (arabicPattern.test(String(entry[field] || ''))) errors.push(`${entry.id}: Arabic remains in ${field}`);
  }

  if (!/^[A-Z]$/.test(entry.letter)) errors.push(`${entry.id}: invalid English letter`);
  if (entry.originalLanguage) {
    if (arabicPattern.test(entry.originalLanguage.language || '')) errors.push(`${entry.id}: Arabic remains in originalLanguage.language`);
    if (arabicPattern.test(entry.originalLanguage.meaning || '')) errors.push(`${entry.id}: Arabic remains in originalLanguage.meaning`);
  }

  for (const reference of entry.references || []) {
    if (arabicPattern.test(JSON.stringify(reference))) errors.push(`${entry.id}: Arabic remains in references`);
  }
}

if (errors.length) {
  console.error(errors.slice(0, 30).join('\n'));
  console.error(`Validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(JSON.stringify({
  valid: true,
  complete: english.complete,
  entries: english.entries.length,
  sourceEntries: arabic.entries.length,
  coverage: `${((english.entries.length / arabic.entries.length) * 100).toFixed(1)}%`
}));