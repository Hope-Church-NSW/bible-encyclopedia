const fs = require('fs');
const https = require('https');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SOURCE_URL = 'https://ebible.org/Scriptures/eng-kjv2006_vpl.zip';
const TEMP_ROOT = path.join(ROOT, '.english-bible-build');
const ARCHIVE = path.join(TEMP_ROOT, 'eng-kjv2006_vpl.zip');
const EXTRACTED = path.join(TEMP_ROOT, 'vpl');
const OUTPUT = path.join(ROOT, 'bible-en.json');
const REPORT = path.join(ROOT, 'english-bible-report.json');
const SOURCE_NOTE = path.join(ROOT, 'sources', 'bible', 'eng-kjv-ebible', 'SOURCE.md');
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
const USFM_CODES = ['GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL','MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV'];
const CODE_TO_BOOK = Object.fromEntries(USFM_CODES.map((code, index) => [code, BOOK_KEYS[index]]));
Object.assign(CODE_TO_BOOK, {
  SOL: CODE_TO_BOOK.SNG,
  EZE: CODE_TO_BOOK.EZK,
  JOE: CODE_TO_BOOK.JOL,
  NAH: CODE_TO_BOOK.NAM,
  MAR: CODE_TO_BOOK.MRK,
  JOH: CODE_TO_BOOK.JHN,
  PHI: CODE_TO_BOOK.PHP,
  JAM: CODE_TO_BOOK.JAS,
  '1JO': CODE_TO_BOOK['1JN'],
  '2JO': CODE_TO_BOOK['2JN'],
  '3JO': CODE_TO_BOOK['3JN']
});

function download(url, destination) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'BibleEncyclopediaResearch/1.0' } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        download(new URL(response.headers.location, url).toString(), destination).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}: ${url}`));
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

function parseSource() {
  const verses = [];
  const files = fs.readdirSync(EXTRACTED, { recursive: true }).filter((file) => /\.txt$|\.vpl$/i.test(file));
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
  execFileSync('tar.exe', ['-xf', ARCHIVE, '-C', EXTRACTED]);
  const verses = parseSource();
  const keys = verses.map((verse) => `${verse.book}:${verse.chapter}:${verse.verse}`);
  if (new Set(keys).size !== keys.length) throw new Error('English Bible contains duplicate verse keys.');
  if (new Set(verses.map((verse) => verse.book)).size !== 66 || verses.length < 30000) {
    throw new Error(`Incomplete English Bible parse: ${verses.length} verses.`);
  }
  const arabicBible = JSON.parse(fs.readFileSync(path.join(ROOT, 'bible.json'), 'utf8'));
  const englishByKey = new Map(verses.map((verse) => [`${verse.book}:${verse.chapter}:${verse.verse}`, verse]));
  const englishKeys = new Set(englishByKey.keys());
  const arabicKeys = new Set(arabicBible.map((verse) => `${verse.book}:${verse.chapter}:${verse.verse}`));
  const missingFromEnglish = [...arabicKeys].filter((key) => !englishKeys.has(key));
  const englishOnly = [...englishKeys].filter((key) => !arabicKeys.has(key));
  const unified = arabicBible.map((verse) => {
    const key = `${verse.book}:${verse.chapter}:${verse.verse}`;
    return englishByKey.get(key) || {
      book: verse.book,
      chapter: verse.chapter,
      verse: verse.verse,
      text: '[This verse number is not present as a separate verse in the King James Version source.]',
      source_unavailable: true
    };
  });
  if (unified.length !== arabicBible.length) throw new Error('English Bible key alignment failed.');
  fs.writeFileSync(OUTPUT, JSON.stringify(unified), 'utf8');
  fs.writeFileSync(REPORT, `${JSON.stringify({
    source: SOURCE_URL,
    title: 'King James (Authorized) Version',
    license: 'Public Domain',
    books: 66,
    english_source_verses: verses.length,
    unified_verses: unified.length,
    arabic_verses: arabicBible.length,
    missing_from_english: missingFromEnglish,
    english_only: englishOnly
  }, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(SOURCE_NOTE), { recursive: true });
  fs.writeFileSync(SOURCE_NOTE, `# King James Version source\n\n- Source: ${SOURCE_URL}\n- Publishers: CrossWire Bible Society and eBible.org\n- Edition: King James (Authorized) Version, standardized 1769 text, Protestant canon\n- License: Public Domain outside the United Kingdom; UK printing remains subject to the Crown letters patent\n- Use: English Bible text displayed when the project language is English.\n`, 'utf8');
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  console.log(JSON.stringify({ source: SOURCE_URL, books: 66, sourceVerses: verses.length, unifiedVerses: unified.length, missingFromEnglish: missingFromEnglish.length, englishOnly: englishOnly.length, output: path.basename(OUTPUT) }, null, 2));
}

main().catch((error) => {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  console.error(error.stack || error.message);
  process.exitCode = 1;
});