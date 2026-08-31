const fs = require('fs');

const [file, book] = process.argv.slice(2);
if (!file || !book) {
  throw new Error('Usage: node validate-commentary-batch.js <commentary-file.json> <book-id>');
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const bible = JSON.parse(fs.readFileSync('bible.json', 'utf8'));
const expectedKeys = bible
  .filter(verse => verse.book === book)
  .map(verse => `${book}:${verse.chapter}:${verse.verse}`);
const errors = [];
const normalizedSummaries = new Map();

for (const key of expectedKeys) {
  const entry = data.verses?.[key];
  if (!entry) {
    errors.push(`${key}: missing entry`);
    continue;
  }

  const references = Array.isArray(entry.references) ? entry.references : [];
  const academicReferences = references.filter(reference =>
    reference.type === 'academic_source' &&
    reference.author &&
    reference.title &&
    reference.publisher &&
    reference.year
  );
  if (academicReferences.length === 0) errors.push(`${key}: missing academic source`);

  for (const [commentator, record] of Object.entries(entry.commentators || {})) {
    const summary = String(record.summary || '').trim();
    if (!summary) {
      errors.push(`${key}/${commentator}: missing summary`);
      continue;
    }
    const normalized = summary.replace(/\s+/g, ' ');
    const previous = normalizedSummaries.get(normalized);
    if (previous) errors.push(`${key}/${commentator}: duplicates ${previous}`);
    else normalizedSummaries.set(normalized, `${key}/${commentator}`);
  }

  if (entry.status?.sources_verified !== true) errors.push(`${key}: sources not verified`);
}

if (errors.length) {
  console.error(errors.slice(0, 50).join('\n'));
  throw new Error(`${book}: ${errors.length} integrity errors`);
}

console.log(`${book}: PASS (${expectedKeys.length} verses, ${normalizedSummaries.size} unique summaries)`);