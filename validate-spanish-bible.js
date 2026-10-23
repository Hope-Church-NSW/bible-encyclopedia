const fs = require('fs');

const spanish = JSON.parse(fs.readFileSync('bible-es.json', 'utf8'));
const canonical = JSON.parse(fs.readFileSync('bible.json', 'utf8'));
const report = JSON.parse(fs.readFileSync('spanish-bible-report.json', 'utf8'));
const keys = spanish.map((verse) => `${verse.book}:${verse.chapter}:${verse.verse}`);
const canonicalKeys = canonical.map((verse) => `${verse.book}:${verse.chapter}:${verse.verse}`);
const byKey = new Map(spanish.map((verse) => [`${verse.book}:${verse.chapter}:${verse.verse}`, verse]));
const expected = new Map([
  ['01-gen:1:1', 'EN el principio crió Dios los cielos y la tierra.'],
  ['19-Psalms:23:1', 'Salmo de David. JEHOVÁ es mi pastor; nada me faltará.'],
  ['43-John:3:16', 'Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.'],
  ['66-Revelation:22:21', 'La gracia de nuestro Señor Jesucristo sea con todos vosotros. Amén.']
]);

if (spanish.length !== 31104) throw new Error(`Expected 31104 canonical verses, found ${spanish.length}.`);
if (new Set(keys).size !== keys.length) throw new Error('Duplicate Spanish Bible verse keys found.');
if (new Set(spanish.map((verse) => verse.book)).size !== 66) throw new Error('Expected all 66 Spanish Bible books.');
if (new Set(spanish.map((verse) => `${verse.book}:${verse.chapter}`)).size !== 1189) {
  throw new Error('Expected 1189 canonical chapters.');
}
if (keys.some((key, index) => key !== canonicalKeys[index])) throw new Error('Spanish Bible keys are not in canonical app order.');
if (spanish.some((verse) => !verse.text || typeof verse.text !== 'string')) throw new Error('Empty Spanish Bible verse text found.');
if (spanish.some((verse) => /\\\+?[a-z0-9]+/i.test(verse.text))) throw new Error('USFM markers remain in Spanish Bible text.');
if (report.source !== 'https://ebible.org/Scriptures/spaRV1909_vpl.zip' ||
    report.source_id !== 'spaRV1909' ||
    report.title !== 'Santa Biblia — Reina Valera 1909' ||
    report.license !== 'Public Domain') {
  throw new Error('Spanish Bible report does not identify the approved public-domain eBible source.');
}
if (report.books !== 66 || report.chapters !== 1189 || report.spanish_source_records !== 31102 ||
    report.spanish_source_verses !== 31084 || report.empty_source_records.length !== 18 ||
    report.canonical_verses !== 31104 || report.missing_from_spanish.length !== 20 ||
    report.spanish_only.length !== 0) {
  throw new Error('Spanish Bible report structure counts do not match the imported source.');
}
if (spanish.filter((verse) => verse.source_unavailable).length !== report.missing_from_spanish.length) {
  throw new Error('Spanish placeholder count does not match the import report.');
}
for (const [key, text] of expected) {
  if (byKey.get(key)?.text !== text) throw new Error(`RV1909 sample mismatch at ${key}.`);
}

console.log('PASS: 31,102 RV1909 records (31,084 with text, 18 empty) aligned to 31,104 canonical keys; 66 books, 1,189 chapters, 20 explicit source placeholders, 0 extra keys.');
