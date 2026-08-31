const fs = require('fs');
const https = require('https');
const path = require('path');
const { execFileSync } = require('child_process');

const sourceDir = path.join('sources', 'bible', 'arb-vd-ebible');
const zipFile = path.join(sourceDir, 'arb-vd_usfm.zip');
const extractedDir = path.join(sourceDir, 'usfm');
const sourceUrl = 'https://ebible.org/Scriptures/arb-vd_usfm.zip';
const bookKeys = [
  '01-gen', '02-Exodus', '03-Leviticus', '04-Numbers', '05-Deut', '06-Joshua', '07-Judges', '08-Ruth',
  '09-1-Samuel', '10-2-Samuel', '11-1-Kings', '12-2-Kings', '13-1-Chronicles', '14-2-Chronicles',
  '15-Ezra', '16-Nehmiah', '17-Esther', '18-Job', '19-Psalms', '20-Proverbs', '21-Ecclesiastes', '22-Sos',
  '23-Isiah', '24-Jeremiah', '25-Lamentations', '26-Ezekiel', '27-Daniel', '28-Hosea', '29-Joel', '30-Amos',
  '31-Obadiah', '32-Jonah', '33-Micah', '34-Nahum', '35-Habakuk', '36-Zephaniah', '37-Haggai',
  '38-Zechariah', '39-Malachi', '40-Matthew', '41-Mark', '42-Luke', '43-John', '44-Acts', '45-Romans',
  '46-1-Corinthians', '47-2-Corinthians', '48-Galatians', '49-Ephesians', '50-Philipians', '51-Colossians',
  '52-1-thessalonians', '53-2-thessalonians', '54-1-Timothy', '55-2-Timothy', '56-Titus', '57-Phillemon',
  '58-Hebrews', '59-James', '60-1-peter', '61-2pet', '62-1-John', '63-2-John', '64-3-John', '65-Jude',
  '66-Revelation'
];
const usfmCodes = ['GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL','MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV'];
const codeToBook = Object.fromEntries(usfmCodes.map((code, index) => [code, bookKeys[index]]));

function download(url, destination) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'BibleEncyclopediaResearch/1.0' } }, response => {
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

function cleanUsfm(value) {
  return value
    .replace(/\\f\s+[\s\S]*?\\f\*/g, '')
    .replace(/\\x\s+[\s\S]*?\\x\*/g, '')
    .replace(/\\(?:w|add|nd|qt|wj|k|tl|dc|bk|pn|ord)\s+([^\\]*?)\\\w+\*/g, '$1')
    .replace(/\\[a-z0-9]+\*?/gi, ' ')
    .replace(/\|[^\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseUsfmFiles() {
  const verses = [];
  const files = fs.readdirSync(extractedDir, { recursive: true }).filter(file => /\.usfm$|\.sfm$/i.test(file));
  for (const relative of files) {
    const content = fs.readFileSync(path.join(extractedDir, relative), 'utf8').replace(/\r\n/g, '\n');
    const code = content.match(/^\\id\s+([A-Z0-9]{3})\b/m)?.[1];
    const book = codeToBook[code];
    if (!book) continue;
    let chapter = null;
    let current = null;
    for (const line of content.split('\n')) {
      const chapterMatch = line.match(/^\\c\s+(\d+)/);
      if (chapterMatch) {
        if (current) verses.push(current);
        current = null;
        chapter = Number(chapterMatch[1]);
        continue;
      }
      const verseMatch = line.match(/^\\v\s+(\d+)(?:-\d+)?\s*(.*)$/);
      if (verseMatch) {
        if (current) verses.push(current);
        current = { book, chapter, verse: Number(verseMatch[1]), text: verseMatch[2] };
      } else if (current && line && !/^\\[a-z][a-z0-9]*\*?\b/i.test(line)) {
        current.text += ` ${line}`;
      }
    }
    if (current) verses.push(current);
  }
  return verses.map(verse => ({ ...verse, text: cleanUsfm(verse.text) })).filter(verse => verse.chapter && verse.text);
}

async function main() {
  fs.mkdirSync(sourceDir, { recursive: true });
  if (!fs.existsSync(zipFile)) await download(sourceUrl, zipFile);
  fs.rmSync(extractedDir, { recursive: true, force: true });
  fs.mkdirSync(extractedDir, { recursive: true });
  execFileSync('tar.exe', ['-xf', path.resolve(zipFile), '-C', path.resolve(extractedDir)]);

  const source = parseUsfmFiles();
  const sourceMap = new Map(source.map(verse => [`${verse.book}:${verse.chapter}:${verse.verse}`, verse]));
  const bible = JSON.parse(fs.readFileSync('bible.json', 'utf8'));
  const localMap = new Map(bible.map(verse => [`${verse.book}:${verse.chapter}:${verse.verse}`, verse]));
  const missing = [...sourceMap].filter(([key]) => !localMap.has(key)).map(([, verse]) => verse);
  const localOnly = [...localMap.keys()].filter(key => !sourceMap.has(key));
  const importedVerseKeysFile = path.join(sourceDir, 'imported-verse-keys.json');
  const importedVerseKeys = fs.existsSync(importedVerseKeysFile)
    ? JSON.parse(fs.readFileSync(importedVerseKeysFile, 'utf8'))
    : [];
  const removableArtifacts = new Map([
    ['16-Nehmiah:7:74', 'وَلَمَّا اسْتُهِلَّ الشَّهْرُ السَّابعُ وَبَنُو إِسْرَائِيلَ فِي مُدُنِهِمِ']
  ]);
  const removedArtifacts = [];
  for (const key of localOnly) {
    const verse = localMap.get(key);
    const expectedText = removableArtifacts.get(key);
    if (!expectedText || !verse.text.includes(expectedText)) throw new Error(`Unrecognized local-only verse key: ${key}`);
    removedArtifacts.push(key);
  }
  const duplicateKeys = source.length - sourceMap.size;
  if (sourceMap.size < 31000 || duplicateKeys) throw new Error(`Invalid source parse: ${sourceMap.size} unique, ${duplicateKeys} duplicates`);

  const cleanedImported = new Map(importedVerseKeys.map(key => [key, sourceMap.get(key)]).filter(([, verse]) => verse));
  const unified = [...bible.filter(verse => !removedArtifacts.includes(`${verse.book}:${verse.chapter}:${verse.verse}`)).map(verse => {
    const key = `${verse.book}:${verse.chapter}:${verse.verse}`;
    return cleanedImported.get(key) || verse;
  }), ...missing].sort((left, right) => {
    const leftBook = bookKeys.indexOf(left.book);
    const rightBook = bookKeys.indexOf(right.book);
    return leftBook - rightBook || Number(left.chapter) - Number(right.chapter) || Number(left.verse) - Number(right.verse);
  });
  const unifiedKeys = unified.map(verse => `${verse.book}:${verse.chapter}:${verse.verse}`);
  if (new Set(unifiedKeys).size !== unifiedKeys.length) throw new Error('Unified Bible contains duplicate keys');
  const sourceKeys = [...sourceMap.keys()].sort();
  if (unifiedKeys.slice().sort().join('\n') !== sourceKeys.join('\n')) throw new Error('Unified Bible key set does not match the official source');

  const report = {
    source: sourceUrl,
    source_title: 'Arabic Van Dyck Bible',
    source_publisher: 'eBible.org',
    license: 'Public Domain',
    source_verse_count: sourceMap.size,
    previous_local_verse_count: bible.length,
    imported_verse_count: missing.length,
    removed_artifact_count: removedArtifacts.length,
    unified_verse_count: unified.length,
    imported_keys: missing.map(verse => `${verse.book}:${verse.chapter}:${verse.verse}`),
    removed_artifact_keys: removedArtifacts,
    local_only_keys: []
  };

  const temporaryBible = 'bible.json.importing';
  fs.writeFileSync(temporaryBible, JSON.stringify(unified), 'utf8');
  fs.renameSync(temporaryBible, 'bible.json');
  fs.writeFileSync('bible-import-report.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(sourceDir, 'verse-keys.json'), `${JSON.stringify(sourceKeys, null, 2)}\n`, 'utf8');
  fs.writeFileSync(importedVerseKeysFile, `${JSON.stringify([...new Set([...importedVerseKeys, ...missing.map(verse => `${verse.book}:${verse.chapter}:${verse.verse}`)])].sort(), null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(sourceDir, 'SOURCE.md'), `# Arabic Van Dyck Bible source\n\n- Source: ${sourceUrl}\n- Publisher: eBible.org\n- License: Public Domain\n- Use: structural verification and import of missing verses only; existing local verse text was preserved.\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});