const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SOURCE_URL = 'https://ebible.org/Scriptures/fraLSG_vpl.zip';
const SOURCE_PAGE = 'https://ebible.org/details.php?id=fraLSG';
const TEMP_ROOT = path.join(ROOT, '.french-bible-build');
const ARCHIVE = path.join(TEMP_ROOT, 'fraLSG_vpl.zip');
const EXTRACTED = path.join(TEMP_ROOT, 'vpl');
const OUTPUT = path.join(ROOT, 'bible-fr.json');
const REPORT = path.join(ROOT, 'french-bible-report.json');
const SOURCE_NOTE = path.join(ROOT, 'sources', 'bible', 'fra-lsg1910-ebible', 'SOURCE.md');
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
  const files = fs.readdirSync(EXTRACTED, { recursive: true }).filter((file) => /\.txt$|\.vpl$/i.test(file));
  const verses = [];
  for (const relative of files) {
    const content = fs.readFileSync(path.join(EXTRACTED, relative), 'utf8').replace(/\r\n/g, '\n');
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z0-9]{3})\s+(\d+):?(\d+)\s+(.+)$/);
      if (!match || !CODE_TO_BOOK[match[1]]) continue;
      verses.push({
        book: CODE_TO_BOOK[match[1]],
        chapter: Number(match[2]),
        verse: Number(match[3]),
        text: match[4].replace(/\s+/g, ' ').trim()
      });
    }
  }
  return verses.filter((verse) => verse.chapter && verse.text);
}

async function main() {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(EXTRACTED, { recursive: true });
  await download(SOURCE_URL, ARCHIVE);
  const archiveSha256 = crypto.createHash('sha256').update(fs.readFileSync(ARCHIVE)).digest('hex');
  execFileSync('tar.exe', ['-xf', ARCHIVE, '-C', EXTRACTED]);

  const sourceVerses = parseSource();
  const sourceKeys = sourceVerses.map((verse) => `${verse.book}:${verse.chapter}:${verse.verse}`);
  if (new Set(sourceKeys).size !== sourceKeys.length) throw new Error('French source contains duplicate verse keys.');
  if (new Set(sourceVerses.map((verse) => verse.book)).size !== 66 || sourceVerses.length < 30000) {
    throw new Error(`Incomplete French Bible parse: ${sourceVerses.length} verses.`);
  }

  const canonicalBible = JSON.parse(fs.readFileSync(path.join(ROOT, 'bible.json'), 'utf8'));
  const sourceByKey = new Map(sourceVerses.map((verse) => [`${verse.book}:${verse.chapter}:${verse.verse}`, verse]));
  const canonicalKeys = new Set(canonicalBible.map((verse) => `${verse.book}:${verse.chapter}:${verse.verse}`));
  const missingFromFrench = [...canonicalKeys].filter((key) => !sourceByKey.has(key));
  const frenchOnly = sourceKeys.filter((key) => !canonicalKeys.has(key));
  const aligned = sourceVerses;
  const canonicalChapters = new Map();
  const frenchChapters = new Map();
  for (const verse of canonicalBible) {
    const key = `${verse.book}:${verse.chapter}`;
    if (!canonicalChapters.has(key)) canonicalChapters.set(key, new Set());
    canonicalChapters.get(key).add(verse.verse);
  }
  for (const verse of sourceVerses) {
    const key = `${verse.book}:${verse.chapter}`;
    if (!frenchChapters.has(key)) frenchChapters.set(key, new Set());
    frenchChapters.get(key).add(verse.verse);
  }
  const unalignedChapters = [...canonicalChapters.keys()].filter((key) => {
    const canonicalNumbers = [...canonicalChapters.get(key)].sort((a, b) => a - b);
    const frenchNumbers = [...(frenchChapters.get(key) || [])].sort((a, b) => a - b);
    return canonicalNumbers.join(',') !== frenchNumbers.join(',');
  });
  const chapterCount = new Set(sourceVerses.map((verse) => `${verse.book}:${verse.chapter}`)).size;
  const metadata = {
    source: SOURCE_URL,
    source_page: SOURCE_PAGE,
    source_id: 'fraLSG',
    title: 'Bible Louis Segond 1910',
    abbreviation: 'LSG1910',
    language: 'Français',
    translation_by: 'Louis Segond',
    publisher: 'eBible.org',
    license: 'Public Domain',
    archive_sha256: archiveSha256,
    books: 66,
    chapters: chapterCount,
    french_source_verses: sourceVerses.length,
    canonical_verses: canonicalBible.length,
    missing_from_french: missingFromFrench,
    french_only: frenchOnly,
    verse_numbering_policy: 'The French Bible is displayed with the source edition’s original chapter and verse numbering. Its references are not rewritten to match Arabic verse numbering.',
    unaligned_chapters: unalignedChapters,
    unavailable_canonical_verses: 0
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(aligned), 'utf8');
  fs.writeFileSync(REPORT, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(SOURCE_NOTE), { recursive: true });
  fs.writeFileSync(SOURCE_NOTE, `# Louis Segond 1910 source\n\n- Source archive: ${SOURCE_URL}\n- Source details: ${SOURCE_PAGE}\n- eBible ID: fraLSG\n- Title: ${metadata.title}\n- Language: French\n- Translation by: Louis Segond\n- Publisher: eBible.org\n- License: Public Domain (confirmed by the source publisher)\n- Downloaded archive SHA-256: ${archiveSha256}\n- Use: French Bible text aligned to the app's canonical verse keys.\n`, 'utf8');
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  console.log(JSON.stringify({
    source: SOURCE_URL,
    books: 66,
    chapters: chapterCount,
    sourceVerses: sourceVerses.length,
    canonicalVerses: canonicalBible.length,
    frenchSourceVerses: sourceVerses.length,
    missingFromFrench: missingFromFrench.length,
    frenchOnly: frenchOnly.length,
    unalignedChapters: unalignedChapters.length,
    unavailableVerses: 0,
    output: path.basename(OUTPUT)
  }, null, 2));
}

main().catch((error) => {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  console.error(error.stack || error.message);
  process.exitCode = 1;
});