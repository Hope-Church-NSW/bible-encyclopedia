const fs = require('fs');
const path = require('path');

const roots = [path.join('sources', 'commentaries', 'numbers')];
const approvedRoot = path.join('sources', 'commentaries', 'approved');
if (fs.existsSync(approvedRoot)) {
  for (const directory of fs.readdirSync(approvedRoot)) {
    const fullPath = path.join(approvedRoot, directory);
    if (fs.statSync(fullPath).isDirectory()) roots.push(fullPath);
  }
}
const entries = [];
const problems = [];

for (const root of roots) {
  for (const file of fs.readdirSync(root).filter(name => /^approved-.*\.json$/.test(name)).sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    for (const [reference, entry] of Object.entries(data.verses || {})) {
      entries.push({ key: `${data.book}:${reference}`, file, entry });
    }
  }
}

const keys = entries.map(item => item.key);
if (new Set(keys).size !== keys.length) problems.push('Duplicate approved verse keys');
const phraseOwners = new Map();
const normalizedLines = [];

for (const item of entries) {
  for (const [lineType, line] of Object.entries(item.entry.explanation_lines || {})) {
    const normalized = String(line).replace(/[\s\p{P}\p{M}]+/gu, ' ').trim();
    normalizedLines.push({ key: item.key, lineType, normalized });
    const words = normalized.split(' ').filter(Boolean);
    for (let offset = 0; offset <= words.length - 8; offset += 1) {
      const phrase = words.slice(offset, offset + 8).join(' ');
      phraseOwners.set(phrase, new Set([...(phraseOwners.get(phrase) || []), item.key]));
    }
  }
}

for (const [phrase, owners] of phraseOwners) {
  if (owners.size > 1) problems.push(`Repeated phrase in ${[...owners].join(', ')}: ${phrase}`);
}
for (let left = 0; left < normalizedLines.length; left += 1) {
  for (let right = left + 1; right < normalizedLines.length; right += 1) {
    if (normalizedLines[left].key === normalizedLines[right].key) continue;
    const leftWords = new Set(normalizedLines[left].normalized.split(' '));
    const rightWords = new Set(normalizedLines[right].normalized.split(' '));
    const overlap = [...leftWords].filter(word => rightWords.has(word)).length;
    const similarity = overlap / (leftWords.size + rightWords.size - overlap);
    if (similarity >= 0.72) problems.push(`High line similarity ${normalizedLines[left].key}/${normalizedLines[right].key}: ${similarity.toFixed(2)}`);
  }
}

if (problems.length) {
  console.error(problems.slice(0, 100).join('\n'));
  console.error(`Rejected: ${problems.length} cumulative problem(s)`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${entries.length} approved verses are cumulatively unique`);
}