const fs = require('fs');
const path = require('path');

const sourceDir = path.join('sources', 'commentaries', 'numbers');
const files = fs.readdirSync(sourceDir)
  .filter(file => /^draft-chapter-\d{2}\.json$/.test(file))
  .sort();
const verses = {};

for (const file of files) {
  const draft = JSON.parse(fs.readFileSync(path.join(sourceDir, file), 'utf8'));
  for (const [key, entry] of Object.entries(draft.verses)) {
    if (verses[key]) throw new Error(`Duplicate verse key ${key}`);
    verses[key] = entry;
  }
}

const entries = Object.entries(verses);
const problems = [];
const normalized = entries.map(([, entry]) => entry.summary.replace(/[\s\p{P}]+/gu, ' ').trim());
if (new Set(normalized).size !== normalized.length) problems.push('Duplicate summaries across chapters');

const phraseOwners = new Map();
for (const [key, entry] of entries) {
  const words = entry.summary.replace(/[\p{P}\p{M}]/gu, '').split(/\s+/).filter(Boolean);
  for (let index = 0; index <= words.length - 8; index += 1) {
    const phrase = words.slice(index, index + 8).join(' ');
    phraseOwners.set(phrase, new Set([...(phraseOwners.get(phrase) || []), key]));
  }
}
for (const [phrase, owners] of phraseOwners) {
  if (owners.size > 1) problems.push(`Repeated eight-word phrase in ${[...owners].join(', ')}: ${phrase}`);
}

for (let left = 0; left < entries.length; left += 1) {
  for (let right = left + 1; right < entries.length; right += 1) {
    const leftWords = new Set(normalized[left].split(' '));
    const rightWords = new Set(normalized[right].split(' '));
    const overlap = [...leftWords].filter(word => rightWords.has(word)).length;
    const similarity = overlap / (leftWords.size + rightWords.size - overlap);
    if (similarity >= 0.58) problems.push(`High similarity ${entries[left][0]}/${entries[right][0]}: ${similarity.toFixed(2)}`);
  }
}

if (problems.length) throw new Error(problems.slice(0, 30).join('\n'));

const output = {
  book: '04-Numbers',
  status: 'research_draft',
  completed_chapters: files.map(file => Number(file.match(/(\d{2})/)[1])),
  verse_count: entries.length,
  verses
};
fs.writeFileSync(path.join(sourceDir, 'draft-book.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Numbers cumulative draft validated: ${files.length} chapters, ${entries.length} verses`);