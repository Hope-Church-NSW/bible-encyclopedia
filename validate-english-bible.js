const fs = require('fs');

const verses = JSON.parse(fs.readFileSync('bible-en.json', 'utf8'));
const report = JSON.parse(fs.readFileSync('english-bible-report.json', 'utf8'));
const keys = verses.map((verse) => `${verse.book}:${verse.chapter}:${verse.verse}`);
const byKey = new Map(verses.map((verse) => [`${verse.book}:${verse.chapter}:${verse.verse}`, verse]));
const expected = new Map([
  ['01-gen:1:1', 'In the beginning God created the heaven and the earth.'],
  ['19-Psalms:23:1', 'A Psalm of David. The LORD [is] my shepherd; I shall not want.'],
  ['43-John:3:16', '¶ For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'],
  ['66-Revelation:22:21', 'The grace of our Lord Jesus Christ [be] with you all. Amen.']
]);

if (verses.length !== 31104) throw new Error(`Expected 31104 aligned verses, found ${verses.length}.`);
if (new Set(keys).size !== keys.length) throw new Error('Duplicate English Bible verse keys found.');
if (new Set(verses.map((verse) => verse.book)).size !== 66) throw new Error('Expected all 66 KJV books.');
if (verses.some((verse) => /\\\+?[a-z0-9]+/i.test(verse.text))) throw new Error('USFM markers remain in English Bible text.');
if (report.title !== 'King James (Authorized) Version' || !report.source.includes('eng-kjv2006')) {
  throw new Error('English Bible report does not identify the approved KJV source.');
}
for (const [key, text] of expected) {
  if (byKey.get(key)?.text !== text) throw new Error(`KJV sample mismatch at ${key}.`);
}

console.log(`PASS: ${verses.length} aligned KJV verses, 66 books, unique keys, clean text, and canonical samples.`);