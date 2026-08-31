const fs = require('fs');

const bible = JSON.parse(fs.readFileSync('bible.json', 'utf8'));
const policy = JSON.parse(fs.readFileSync('commentary-quality-policy.json', 'utf8'));
const primaryIndexFile = 'sources/commentaries/whole-bible/mhc-source-index.json';
const primaryIndex = fs.existsSync(primaryIndexFile)
  ? JSON.parse(fs.readFileSync(primaryIndexFile, 'utf8'))
  : { verses: {} };
const verses = {};
const books = {};

for (const verse of bible) {
  const key = `${verse.book}:${verse.chapter}:${verse.verse}`;
  if (verses[key]) throw new Error(`Duplicate Bible verse key: ${key}`);
  verses[key] = {
    book: verse.book,
    chapter: Number(verse.chapter),
    verse: Number(verse.verse),
    status: primaryIndex.verses[key]?.length ? 'sources_ready_pending_four_line_commentary' : 'missing_primary_source',
    primary_source_records: primaryIndex.verses[key] || [],
    required_lines: policy.required_lines.map(line => line.id),
    required_footer: 'مصادر التفسير: أسماء المفسرين المستخدمين فعليًا'
  };
  books[verse.book] ??= { verse_count: 0, completed: 0, sources_ready: 0, missing_primary_source: 0 };
  books[verse.book].verse_count += 1;
  if (primaryIndex.verses[key]?.length) books[verse.book].sources_ready += 1;
  else books[verse.book].missing_primary_source += 1;
}

const output = {
  schema_version: 1,
  policy_file: 'commentary-quality-policy.json',
  verse_count: Object.keys(verses).length,
  book_count: Object.keys(books).length,
  books,
  verses
};

if (output.verse_count !== bible.length) throw new Error('Worklist does not cover the whole Bible');
fs.writeFileSync('commentary-worklist.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Commentary worklist: ${output.verse_count} verses across ${output.book_count} books`);