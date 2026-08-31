const fs = require('fs');
const path = require('path');

const bookKeys = [
  '01-gen','02-Exodus','03-Leviticus','04-Numbers','05-Deut','06-Joshua','07-Judges','08-Ruth','09-1-Samuel','10-2-Samuel','11-1-Kings','12-2-Kings','13-1-Chronicles','14-2-Chronicles','15-Ezra','16-Nehmiah','17-Esther','18-Job','19-Psalms','20-Proverbs','21-Ecclesiastes','22-Sos','23-Isiah','24-Jeremiah','25-Lamentations','26-Ezekiel','27-Daniel','28-Hosea','29-Joel','30-Amos','31-Obadiah','32-Jonah','33-Micah','34-Nahum','35-Habakuk','36-Zephaniah','37-Haggai','38-Zechariah','39-Malachi',
  '40-Matthew','41-Mark','42-Luke','43-John','44-Acts','45-Romans','46-1-Corinthians','47-2-Corinthians','48-Galatians','49-Ephesians','50-Philipians','51-Colossians','52-1-thessalonians','53-2-thessalonians','54-1-Timothy','55-2-Timothy','56-Titus','57-Phillemon','58-Hebrews','59-James','60-1-peter','61-2pet','62-1-John','63-2-John','64-3-John','65-Jude','66-Revelation'
];
const codes = ['GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL','MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV'];
const codeToBook = Object.fromEntries(codes.map((code, index) => [code, bookKeys[index]]));

function cleanUsfm(value) {
  return value
    .replace(/\\f\s+[\s\S]*?\\f\*/g, '')
    .replace(/\\x\s+[\s\S]*?\\x\*/g, '')
    .replace(/\\w\s+([^|\\]+)(?:\|[^\\]+)?\\w\*/g, '$1')
    .replace(/\\(?:add|nd|qt|wj|k|tl|dc|bk|pn|ord)\s+([^\\]*?)\\[a-z]+\*/gi, '$1')
    .replace(/\\[a-z][a-z0-9-]*\*?(?:\s+[^\\]*)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDirectory(directory) {
  const result = {};
  const files = fs.readdirSync(directory).filter(file => /\.usfm$/i.test(file));
  for (const file of files) {
    const content = fs.readFileSync(path.join(directory, file), 'utf8').replace(/\r/g, '');
    const code = content.match(/^\\id\s+([A-Z0-9]{3})\b/m)?.[1];
    const book = codeToBook[code];
    if (!book) continue;
    let chapter = 0;
    let current = null;
    const save = () => {
      if (!current) return;
      const text = cleanUsfm(current.text);
      if (text) result[`${book}:${current.chapter}:${current.verse}`] = text;
    };
    for (const line of content.split('\n')) {
      const chapterMatch = line.match(/^\\c\s+(\d+)/);
      if (chapterMatch) {
        save();
        current = null;
        chapter = Number(chapterMatch[1]);
        continue;
      }
      const verseMatch = line.match(/^\\v\s+(\d+)(?:-\d+)?\s*(.*)$/);
      if (verseMatch) {
        save();
        current = { chapter, verse: Number(verseMatch[1]), text: verseMatch[2] };
      } else if (current && line && !/^\\(?:c|s|p|q|m|b|d|r|sp|cl)\b/.test(line)) {
        current.text += ` ${line}`;
      }
    }
    save();
  }
  return result;
}

function inRange(book, chapter, verse) {
  if (book === '01-gen' && chapter === 31 && verse === 47) return 'العبرية والآرامية';
  if (book === '24-Jeremiah' && chapter === 10 && verse === 11) return 'الآرامية';
  if (book === '15-Ezra' && ((chapter === 4 && verse >= 8) || chapter === 5 || chapter === 6 || (chapter === 7 && verse >= 12 && verse <= 26))) return 'الآرامية';
  if (book === '27-Daniel' && ((chapter === 2 && verse >= 4) || (chapter >= 3 && chapter <= 6) || chapter === 7)) return chapter === 2 && verse === 4 ? 'العبرية والآرامية' : 'الآرامية';
  return 'العبرية';
}

const hebrew = parseDirectory(path.join(__dirname, 'sources', 'original-languages', 'hboWLC'));
const greek = parseDirectory(path.join(__dirname, 'sources', 'original-languages', 'grcbyz'));
const greekTraditional = parseDirectory(path.join(__dirname, 'sources', 'original-languages', 'grctr'));
const bible = JSON.parse(fs.readFileSync(path.join(__dirname, 'bible.json'), 'utf8'));
const verses = {};
let missing = 0;
const missingByBook = {};
for (const verse of bible) {
  const key = `${verse.book}:${verse.chapter}:${verse.verse}`;
  const isNewTestament = Number(verse.book.slice(0, 2)) >= 40;
  const text = isNewTestament ? (greek[key] || greekTraditional[key]) : hebrew[key];
  if (!text) {
    missing += 1;
    missingByBook[verse.book] ??= [];
    missingByBook[verse.book].push(`${verse.chapter}:${verse.verse}`);
    continue;
  }
  verses[key] = {
    language: isNewTestament ? 'اليونانية' : inRange(verse.book, verse.chapter, verse.verse),
    direction: isNewTestament ? 'ltr' : 'rtl',
    text
  };
}

const output = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  sources: {
    old_testament: { name: 'Westminster Leningrad Codex Hebrew OT', id: 'hboWLC', license: 'Public Domain', url: 'https://ebible.org/find/details.php?id=hboWLC' },
    new_testament: { name: 'Byzantine Greek New Testament (1904 Patriarchal Text); Textus Receptus fallback', id: 'grcbyz / grctr', license: 'Public Domain', url: 'https://ebible.org/find/details.php?id=grcbyz' }
  },
  verses
};
fs.writeFileSync(path.join(__dirname, 'original-language-bible.json'), `${JSON.stringify(output)}\n`, 'utf8');
fs.writeFileSync(path.join(__dirname, 'original-language-gaps.json'), `${JSON.stringify(missingByBook, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ verses: Object.keys(verses).length, missing, hebrew: Object.keys(hebrew).length, greek: Object.keys(greek).length }));