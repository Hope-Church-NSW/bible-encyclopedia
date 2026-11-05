const fs = require('fs');

const french = JSON.parse(fs.readFileSync('bible-fr.json', 'utf8'));
const canonical = JSON.parse(fs.readFileSync('bible.json', 'utf8'));
const report = JSON.parse(fs.readFileSync('french-bible-report.json', 'utf8'));
const keys = french.map((verse) => `${verse.book}:${verse.chapter}:${verse.verse}`);
const canonicalKeys = canonical.map((verse) => `${verse.book}:${verse.chapter}:${verse.verse}`);
const byKey = new Map(french.map((verse) => [`${verse.book}:${verse.chapter}:${verse.verse}`, verse]));
const expected = new Map([
  ['01-gen:1:1', 'Au commencement, Dieu créa les cieux et la terre.'],
  ['43-John:3:16', 'Car Dieu a tant aimé le monde qu’il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu’il ait la vie éternelle.'],
  ['66-Revelation:22:21', 'Que la grâce du Seigneur Jésus soit avec tous!']
]);

if (french.length !== 31170) throw new Error(`Expected 31170 Louis Segond source verses, found ${french.length}.`);
if (new Set(keys).size !== keys.length) throw new Error('Duplicate French Bible verse keys found.');
if (new Set(french.map((verse) => verse.book)).size !== 66) throw new Error('Expected all 66 French Bible books.');
if (new Set(french.map((verse) => `${verse.book}:${verse.chapter}`)).size !== 1189) {
  throw new Error('Expected 1189 canonical chapters.');
}
if (keys.some((key) => !key.split(':').every(Boolean))) throw new Error('Invalid French source verse key.');
if (french.some((verse) => !verse.text || typeof verse.text !== 'string')) throw new Error('Empty French Bible verse text found.');
if (french.some((verse) => /\\\+?[a-z0-9]+/i.test(verse.text))) throw new Error('USFM markers remain in French Bible text.');
if (report.source !== 'https://ebible.org/Scriptures/fraLSG_vpl.zip' ||
    report.source_page !== 'https://ebible.org/details.php?id=fraLSG' ||
    report.source_id !== 'fraLSG' ||
    report.title !== 'Bible Louis Segond 1910' ||
    report.license !== 'Public Domain') {
  throw new Error('French Bible report does not identify the approved public-domain eBible source.');
}
if (report.books !== 66 || report.chapters !== 1189 || report.french_source_verses !== 31170 ||
  report.canonical_verses !== 31170 || report.missing_from_french.length !== 47 || report.french_only.length !== 113 ||
  !Array.isArray(report.unaligned_chapters) || report.unaligned_chapters.length === 0 ||
    !/^[a-f0-9]{64}$/.test(report.archive_sha256)) {
  throw new Error('French Bible report structure counts do not match the imported source.');
}
if (french.some((verse) => verse.source_unavailable) || report.unavailable_canonical_verses !== 0) {
  throw new Error('French source verses must be preserved without placeholders.');
}
for (const [key, text] of expected) {
  if (byKey.get(key)?.text !== text) throw new Error(`Louis Segond 1910 sample mismatch at ${key}.`);
}
if (!byKey.get('19-Psalms:3:1')?.text.startsWith('Psaume de David.')) {
  throw new Error('The French source-native Psalm heading or versification was not preserved.');
}

console.log(`PASS: all 31,170 Louis Segond 1910 source verses are present with source-native references; 66 books, 1,189 chapters, and ${report.unaligned_chapters.length} versification differences are reported without rewriting the text.`);