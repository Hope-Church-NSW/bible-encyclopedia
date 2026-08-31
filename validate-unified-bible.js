const fs = require('fs');

const manifest = JSON.parse(fs.readFileSync('bible-data-manifest.json', 'utf8'));
const bible = JSON.parse(fs.readFileSync(manifest.canonical_file, 'utf8'));
const expectedKeys = JSON.parse(fs.readFileSync(manifest.structural_source.key_baseline, 'utf8'));
const keys = bible.map(verse => `${verse.book}:${verse.chapter}:${verse.verse}`);
const keySet = new Set(keys);
const expectedSet = new Set(expectedKeys);
const books = new Set(bible.map(verse => verse.book));
const problems = [];

if (!Array.isArray(bible)) problems.push('bible.json must contain one array');
if (bible.length !== manifest.verse_count) problems.push(`Expected ${manifest.verse_count} verses, found ${bible.length}`);
if (books.size !== manifest.book_count) problems.push(`Expected ${manifest.book_count} books, found ${books.size}`);
if (keySet.size !== keys.length) problems.push(`${keys.length - keySet.size} duplicate verse key(s)`);
if (!bible.some(verse => verse.book === '61-2pet')) problems.push('2 Peter is missing from bible.json');
if (fs.existsSync('2pet.json')) problems.push('Separate 2pet.json must not exist');

const missing = [...expectedSet].filter(key => !keySet.has(key));
const extra = [...keySet].filter(key => !expectedSet.has(key));
if (missing.length) problems.push(`Missing official keys: ${missing.slice(0, 20).join(', ')}`);
if (extra.length) problems.push(`Unexpected keys: ${extra.slice(0, 20).join(', ')}`);

for (const verse of bible) {
  if (!verse.book || !Number.isInteger(Number(verse.chapter)) || !Number.isInteger(Number(verse.verse)) || !String(verse.text || '').trim()) {
    problems.push(`Malformed verse: ${JSON.stringify(verse)}`);
    break;
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${bible.length} verses, ${books.size} books, one canonical bible.json`);
}