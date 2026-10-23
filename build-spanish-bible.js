const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SOURCE_URL = 'https://ebible.org/Scriptures/spaRV1909_vpl.zip';
const TEMP_ROOT = path.join(ROOT, '.spanish-bible-build');
const ARCHIVE = path.join(TEMP_ROOT, 'spaRV1909_vpl.zip');
const EXTRACTED = path.join(TEMP_ROOT, 'vpl');
const OUTPUT = path.join(ROOT, 'bible-es.json');
const REPORT = path.join(ROOT, 'spanish-bible-report.json');
const SOURCE_NOTE = path.join(ROOT, 'sources', 'bible', 'spa-rv1909-ebible', 'SOURCE.md');
const BOOK_KEYS = [
  '01-gen','02-Exodus','03-Leviticus','04-Numbers','05-Deut','06-Joshua','07-Judges','08-Ruth','09-1-Samuel','10-2-Samuel',
  '11-1-Kings','12-2-Kings','13-1-Chronicles','14-2-Chronicles','15-Ezra','16-Nehmiah','17-Esther','18-Job','19-Psalms',
  '20-Proverbs','21-Ecclesiastes','22-Sos','23-Isiah','24-Jeremiah','25-Lamentations','26-Ezekiel','27-Daniel','28-Hosea',
  '29-Joel','30-Amos','31-Obadiah','32-Jonah','33-Micah','34-Nahum','35-Habakuk','36-Zephaniah','37-Haggai',
  '38-Zechariah','39-Malachi','40-Matthew','41-Mark','42-Luke','43-John','44-Acts','45-Romans','46-1-Corinthians',
  '47-2-Corinthians','48-Galatians','49-Ephesians','50-Philipians','51-Colossians','52-1-thessalonians','53-2-thessalonians',
  '54-1-Timothy','55-2-Timothy','56-Titus','57-Phillemon','58-Hebrews','59-James','60-1-peter','61-2pet','62-1-John',
  '63-2-John','64-3-John','65-Jude','66-Revelation'
];
const SOURCE_CODES = [
  'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA',
  'PRO','ECC','SOL','ISA','JER','LAM','EZE','DAN','HOS','JOE','AMO','OBA','JON','MIC','NAH','HAB','ZEP','HAG','ZEC',
  'MAL','MAT','MAR','LUK','JOH','ACT','ROM','1CO','2CO','GAL','EPH','PHI','COL','1TH','2TH','1TI','2TI','TIT','PHM',
  'HEB','JAM','1PE','2PE','1JO','2JO','3JO','JUD','REV'
];
const CODE_TO_BOOK = Object.fromEntries(SOURCE_CODES.map((code, index) => [code, BOOK_KEYS[index]]));

function download(url, destination) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'BibleEncyclopediaResearch/1.0' } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        download(new URL(response.headers.location, url).toString(), destination).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

function parseSource() {
  const sourceFile = path.join(EXTRACTED, 'spaRV1909_vpl.txt');
  if (!fs.existsSync(sourceFile)) throw new Error('The eBible archive does not contain spaRV1909_vpl.txt.');
  const verses = [];
  const emptyRecords = [];
  let recordCount = 0;
  const content = fs.readFileSync(sourceFile, 'utf8').replace(/\r\n/g, '\n');
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    const match = line.match(/^([A-Z0-9]{3})\s+(\d+):(\d+)(?:\s+(.*))?$/);
    if (!match || !CODE_TO_BOOK[match[1]]) throw new Error(`Unrecognized VPL record: ${line}`);
    recordCount += 1;
    const key = `${CODE_TO_BOOK[match[1]]}:${Number(match[2])}:${Number(match[3])}`;
    const text = (match[4] || '').replace(/\s+/g, ' ').trim();
    if (!text) {
      emptyRecords.push(key);
      continue;
    }
    verses.push({
      book: CODE_TO_BOOK[match[1]],
      chapter: Number(match[2]),
      verse: Number(match[3]),
      text
    });
  }
  return { verses, emptyRecords, recordCount };
}

async function main() {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(EXTRACTED, { recursive: true });
  await download(SOURCE_URL, ARCHIVE);
  const archiveSha256 = crypto.createHash('sha256').update(fs.readFileSync(ARCHIVE)).digest('hex');
  execFileSync('tar.exe', ['-xf', ARCHIVE, '-C', EXTRACTED]);

  const { verses: sourceVerses, emptyRecords, recordCount } = parseSource();
  const sourceKeys = sourceVerses.map((verse) => `${verse.book}:${verse.chapter}:${verse.verse}`);
  if (new Set(sourceKeys).size !== sourceKeys.length) throw new Error('Spanish source contains duplicate verse keys.');
  if (new Set(sourceVerses.map((verse) => verse.book)).size !== 66) {
    throw new Error(`Expected 66 Spanish source books, found ${new Set(sourceVerses.map((verse) => verse.book)).size}.`);
  }

  const canonicalBible = JSON.parse(fs.readFileSync(path.join(ROOT, 'bible.json'), 'utf8'));
  const sourceByKey = new Map(sourceVerses.map((verse) => [`${verse.book}:${verse.chapter}:${verse.verse}`, verse]));
  const canonicalKeys = new Set(canonicalBible.map((verse) => `${verse.book}:${verse.chapter}:${verse.verse}`));
  const missingFromSpanish = [...canonicalKeys].filter((key) => !sourceByKey.has(key));
  const spanishOnly = sourceKeys.filter((key) => !canonicalKeys.has(key));
  const aligned = canonicalBible.map((verse) => {
    const key = `${verse.book}:${verse.chapter}:${verse.verse}`;
    return sourceByKey.get(key) || {
      book: verse.book,
      chapter: verse.chapter,
      verse: verse.verse,
      text: '[Este número de versículo no aparece como versículo separado en la fuente Reina-Valera 1909.]',
      source_unavailable: true
    };
  });
  const chapterCount = new Set(sourceVerses.map((verse) => `${verse.book}:${verse.chapter}`)).size;

  const metadata = {
    source: SOURCE_URL,
    source_page: 'https://ebible.org/details.php?id=spaRV1909',
    source_id: 'spaRV1909',
    title: 'Santa Biblia — Reina Valera 1909',
    abbreviation: 'RV1909',
    language: 'Español (Spanish)',
    dialect: 'Castellano 1909',
    translation_by: 'Reina y Valera',
    publisher: 'eBible.org',
    license: 'Public Domain',
    source_updated: '2013-12-13',
    archive_sha256: archiveSha256,
    books: 66,
    chapters: chapterCount,
    spanish_source_records: recordCount,
    spanish_source_verses: sourceVerses.length,
    empty_source_records: emptyRecords,
    canonical_verses: aligned.length,
    missing_from_spanish: missingFromSpanish,
    spanish_only: spanishOnly
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(aligned), 'utf8');
  fs.writeFileSync(REPORT, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(SOURCE_NOTE), { recursive: true });
  fs.writeFileSync(SOURCE_NOTE, `# Reina-Valera 1909 source

- Source archive: ${SOURCE_URL}
- Source details: ${metadata.source_page}
- eBible ID: ${metadata.source_id}
- Title: ${metadata.title}
- Abbreviation: ${metadata.abbreviation}
- Language: ${metadata.language}
- Dialect: ${metadata.dialect}
- Translation by: ${metadata.translation_by}
- Publisher: ${metadata.publisher}
- License: ${metadata.license} (Dominio Público)
- Source last updated: ${metadata.source_updated}
- Downloaded archive SHA-256: ${metadata.archive_sha256}
- Use: Spanish Bible data imported from eBible's verse-per-line archive and aligned to the app's canonical verse keys.
`, 'utf8');
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  console.log(JSON.stringify({
    source: SOURCE_URL,
    books: 66,
    chapters: chapterCount,
    sourceRecords: recordCount,
    sourceVerses: sourceVerses.length,
    canonicalVerses: aligned.length,
    missingFromSpanish: missingFromSpanish.length,
    spanishOnly: spanishOnly.length,
    output: path.basename(OUTPUT)
  }, null, 2));
}

main().catch((error) => {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
