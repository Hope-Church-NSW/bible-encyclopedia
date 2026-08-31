const fs = require('fs');

const bible = JSON.parse(fs.readFileSync('bible.json', 'utf8'));
const canonicalChapters = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8,
  66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28,
  16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22
];
const books = [...new Set(bible.map(verse => verse.book))].sort((left, right) => Number(left.split('-')[0]) - Number(right.split('-')[0]));
const anomalies = [];

for (let index = 0; index < books.length; index += 1) {
  const book = books[index];
  const rows = bible.filter(verse => verse.book === book);
  const actual = Math.max(...rows.map(verse => Number(verse.chapter)));
  const expected = canonicalChapters[index];
  if (actual !== expected) anomalies.push({ book, expected_chapters: expected, actual_chapters: actual });
}

const textOwners = new Map();
for (const verse of bible) {
  const normalized = verse.text.replace(/[\s\p{P}\p{M}]/gu, ' ').trim();
  textOwners.set(normalized, [...(textOwners.get(normalized) || []), `${verse.book}:${verse.chapter}:${verse.verse}`]);
}
const matthew29 = bible
  .filter(verse => verse.book === '40-Matthew' && Number(verse.chapter) === 29)
  .map(verse => {
    const normalized = verse.text.replace(/[\s\p{P}\p{M}]/gu, ' ').trim();
    return {
      key: `40-Matthew:29:${verse.verse}`,
      text: verse.text,
      exact_duplicates: (textOwners.get(normalized) || []).filter(key => !key.startsWith('40-Matthew:29:'))
    };
  });

function wordSet(value) {
  return new Set(value.replace(/[\s\p{P}\p{M}]+/gu, ' ').trim().split(' ').filter(Boolean));
}

const matthew28 = bible.filter(verse => verse.book === '40-Matthew' && Number(verse.chapter) === 28);
const matthewComparison = matthew29.map(entry => {
  const candidate = matthew28.find(verse => Number(verse.verse) === Number(entry.key.split(':').at(-1)));
  if (!candidate) return { chapter_29_key: entry.key, chapter_28_key: null, similarity: 0 };
  const left = wordSet(entry.text);
  const right = wordSet(candidate.text);
  const overlap = [...left].filter(word => right.has(word)).length;
  return {
    chapter_29_key: entry.key,
    chapter_28_key: `40-Matthew:28:${candidate.verse}`,
    similarity: Number((overlap / (left.size + right.size - overlap)).toFixed(4)),
    chapter_28_text: candidate.text
  };
});

const matthewEndStructure = [26, 27, 28, 29].map(chapter => {
  const rows = bible.filter(verse => verse.book === '40-Matthew' && Number(verse.chapter) === chapter);
  return {
    chapter,
    verse_count: rows.length,
    first_verse: rows[0]?.text,
    last_verse: rows.at(-1)?.text
  };
});
const canonicalMatthewVerseCounts = [25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35, 30, 34, 46, 46, 39, 51, 46, 75, 66, 20];
const matthewChapterCounts = Array.from({ length: 29 }, (_, index) => {
  const chapter = index + 1;
  return {
    chapter,
    local_verse_count: bible.filter(verse => verse.book === '40-Matthew' && Number(verse.chapter) === chapter).length,
    canonical_verse_count: canonicalMatthewVerseCounts[index] ?? null
  };
});
const report = { verse_count: bible.length, book_count: books.length, anomalies, matthew_chapter_counts: matthewChapterCounts, matthew_end_structure: matthewEndStructure, matthew_29: matthew29, matthew_28_29_comparison: matthewComparison };
fs.writeFileSync('bible-canon-audit-report.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ verse_count: report.verse_count, book_count: report.book_count, anomalies, matthew_29_verses: matthew29.length, duplicated_matthew_29_verses: matthew29.filter(verse => verse.exact_duplicates.length).length, same_number_similarity: matthewComparison.map(row => row.similarity) }, null, 2));
if (anomalies.length) process.exitCode = 1;