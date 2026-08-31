const fs = require('fs');
const path = require('path');

const root = path.join('sources', 'commentaries', 'whole-bible');
const bible = JSON.parse(fs.readFileSync('bible.json', 'utf8'));
const bookCodes = {
  Gen: '01-gen', Ex: '02-Exodus', Exod: '02-Exodus', Lev: '03-Leviticus', Num: '04-Numbers', Deu: '05-Deut', Deut: '05-Deut',
  Josh: '06-Joshua', Jos: '06-Joshua', Judg: '07-Judges', Ju: '07-Judges', Ruth: '08-Ruth', Ru: '08-Ruth', iSam: '09-1-Samuel', '1Sam': '09-1-Samuel', iiSam: '10-2-Samuel', '2Sam': '10-2-Samuel',
  iKi: '11-1-Kings', '1Kgs': '11-1-Kings', iiKi: '12-2-Kings', '2Kgs': '12-2-Kings', iChr: '13-1-Chronicles', iCh: '13-1-Chronicles', '1Chr': '13-1-Chronicles', iiChr: '14-2-Chronicles', iiCh: '14-2-Chronicles', '2Chr': '14-2-Chronicles',
  Ezra: '15-Ezra', Neh: '16-Nehmiah', Esth: '17-Esther', Job: '18-Job', Ps: '19-Psalms',
  Prov: '20-Proverbs', Eccl: '21-Ecclesiastes', Ec: '21-Ecclesiastes', Song: '22-Sos', Isa: '23-Isiah', Is: '23-Isiah', Jer: '24-Jeremiah',
  Lam: '25-Lamentations', Ezek: '26-Ezekiel', Ez: '26-Ezekiel', Dan: '27-Daniel', Hos: '28-Hosea', Joel: '29-Joel',
  Amos: '30-Amos', Obad: '31-Obadiah', Jonah: '32-Jonah', Mic: '33-Micah', Nah: '34-Nahum',
  Hab: '35-Habakuk', Zeph: '36-Zephaniah', Hag: '37-Haggai', Zech: '38-Zechariah', Mal: '39-Malachi',
  Matt: '40-Matthew', Mark: '41-Mark', Luke: '42-Luke', John: '43-John', Acts: '44-Acts',
  Rom: '45-Romans', iCor: '46-1-Corinthians', '1Cor': '46-1-Corinthians', iiCor: '47-2-Corinthians', '2Cor': '47-2-Corinthians', Gal: '48-Galatians',
  Eph: '49-Ephesians', Phil: '50-Philipians', Phi: '50-Philipians', Col: '51-Colossians', iThess: '52-1-thessalonians', iTh: '52-1-thessalonians', '1Thess': '52-1-thessalonians',
  iiThess: '53-2-thessalonians', iiTh: '53-2-thessalonians', '2Thess': '53-2-thessalonians', iTim: '54-1-Timothy', '1Tim': '54-1-Timothy', iiTim: '55-2-Timothy', '2Tim': '55-2-Timothy', Tit: '56-Titus', Titus: '56-Titus',
  Phlm: '57-Phillemon', Phm: '57-Phillemon', Heb: '58-Hebrews', Jas: '59-James', Jam: '59-James', iPet: '60-1-peter', '1Pet': '60-1-peter', iiPet: '61-2pet', '2Pet': '61-2pet',
  iJohn: '62-1-John', iJo: '62-1-John', '1John': '62-1-John', iiJohn: '63-2-John', iiJo: '63-2-John', '2John': '63-2-John', iiiJohn: '64-3-John', iiiJo: '64-3-John', '3John': '64-3-John', Jude: '65-Jude', Jud: '65-Jude', Rev: '66-Revelation'
};
const verseKeys = new Set(bible.map(verse => `${verse.book}:${verse.chapter}:${verse.verse}`));
const records = {};
const verses = {};
const observedCodes = new Set();
const rejectedRanges = [];
const correctedRangeMetadata = [];

function decodeHtml(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '-', ndash: '-' };
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
      if (entity[0] === '#') {
        const hexadecimal = entity[1].toLowerCase() === 'x';
        return String.fromCodePoint(parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10));
      }
      return named[entity.toLowerCase()] ?? ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function linkRange(recordId, book, chapter, startVerse, endVerse, locator) {
  let linked = 0;
  for (let verse = startVerse; verse <= endVerse; verse += 1) {
    const key = `${book}:${chapter}:${verse}`;
    if (!verseKeys.has(key)) continue;
    verses[key] ??= [];
    verses[key].push(recordId);
    linked += 1;
  }
  if (!linked) rejectedRanges.push({ locator, book, chapter, startVerse, endVerse });
  return linked;
}

const volumes = fs.readdirSync(root).filter(name => /^mhc\d$/.test(name)).sort();
let recordNumber = 0;
for (const volume of volumes) {
  const directory = path.join(root, volume, 'OEBPS');
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.html'));
  for (const file of files) {
    const html = fs.readFileSync(path.join(directory, file), 'utf8');
    const filePrefix = file.match(/^mhc\d\.([A-Za-z0-9]+)\./)?.[1];
    const fileBook = bookCodes[filePrefix];
    const fileHeading = decodeHtml(html).match(/\bCHAP(?:TER)?\.?\s+([IVXLCDM]+|\d+)\.?/i)?.[1];
    const fileChapter = fileHeading ? romanToNumber(fileHeading) : null;
    const pattern = /<div class="Commentary" id="Bible_([A-Za-z0-9]+)\.(\d+)\.(\d+)-([A-Za-z0-9]+)\.(\d+)\.(\d+)">([\s\S]*?)<\/div>/g;
    for (const match of html.matchAll(pattern)) {
      const [, startCode, startChapterText, startVerseText, endCode, endChapterText, endVerseText, body] = match;
      observedCodes.add(startCode);
      observedCodes.add(endCode);
      const book = bookCodes[startCode];
      if (!book || bookCodes[endCode] !== book || startChapterText !== endChapterText) {
        rejectedRanges.push({ locator: `${volume}/${file}#${match[0].match(/id="([^"]+)/)?.[1]}`, reason: 'unsupported cross-book or cross-chapter range' });
        continue;
      }
      const declaredChapter = Number(startChapterText);
      const chapter = fileBook === book && fileChapter && fileChapter !== declaredChapter ? fileChapter : declaredChapter;
      if (chapter !== declaredChapter) {
        correctedRangeMetadata.push({ volume, file, book, declared_chapter: declaredChapter, printed_chapter: chapter });
      }
      const startVerse = Number(startVerseText);
      const endVerse = Number(endVerseText);
      const id = `mhc:${String(++recordNumber).padStart(5, '0')}`;
      const locator = `${volume}/OEBPS/${file}#Bible_${startCode}.${chapter}.${startVerse}-${endCode}.${chapter}.${endVerse}`;
      records[id] = {
        source_id: 'matthew_henry',
        interpreter_name: 'متى هنري',
        scope: 'verse_or_passage',
        book,
        chapter,
        declared_chapter: declaredChapter,
        start_verse: startVerse,
        end_verse: endVerse,
        locator,
        text: decodeHtml(body)
      };
      linkRange(id, book, chapter, startVerse, endVerse, locator);
    }
  }
}

function romanToNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let total = 0;
  let previous = 0;
  for (const character of value.toUpperCase().split('').reverse()) {
    const current = values[character] || 0;
    total += current < previous ? -current : current;
    previous = Math.max(previous, current);
  }
  return total;
}

for (const volume of volumes) {
  const directory = path.join(root, volume, 'OEBPS');
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.html'));
  for (const file of files) {
    const prefix = file.match(/^mhc\d\.([A-Za-z0-9]+)\./)?.[1];
    const book = bookCodes[prefix];
    if (!book) continue;
    const html = fs.readFileSync(path.join(directory, file), 'utf8');
    const explicitChapter = html.match(/id="Bible_[A-Za-z0-9]+\.(\d+)\./)?.[1];
    const headingChapter = decodeHtml(html).match(/\bCHAP(?:TER)?\.?\s+([IVXLCDM]+|\d+)\.?/i)?.[1];
    const chapter = headingChapter ? romanToNumber(headingChapter) : explicitChapter ? Number(explicitChapter) : null;
    if (!chapter) continue;
    const uncovered = bible.filter(verse => verse.book === book && Number(verse.chapter) === chapter && !verses[`${book}:${chapter}:${verse.verse}`]);
    if (!uncovered.length) continue;
    const id = `mhc:${String(++recordNumber).padStart(5, '0')}`;
    const locator = `${volume}/OEBPS/${file}`;
    records[id] = {
      source_id: 'matthew_henry',
      interpreter_name: 'متى هنري',
      scope: 'chapter_context',
      book,
      chapter,
      start_verse: 1,
      end_verse: Math.max(...uncovered.map(verse => Number(verse.verse))),
      locator,
      text: decodeHtml(html)
    };
    for (const verse of uncovered) {
      const key = `${book}:${chapter}:${verse.verse}`;
      verses[key] ??= [];
      verses[key].push(id);
    }
  }
}

const shamgarKey = '07-Judges:3:31';
if (!verses[shamgarKey]) {
  const jfb = fs.readFileSync(path.join(root, '..', 'jfb.txt'), 'utf8');
  const startMarker = '   31. after him was Shamgar--';
  const start = jfb.indexOf(startMarker);
  const end = jfb.indexOf('\n     __________________________________________________________________', start);
  if (start < 0 || end < 0) throw new Error('JFB Judges 3:31 note was not found');
  const id = 'jfb:judges-3-31';
  records[id] = {
    source_id: 'jfb',
    interpreter_name: 'جاميسون وفوست وبراون',
    scope: 'verse_or_passage',
    book: '07-Judges',
    chapter: 3,
    start_verse: 31,
    end_verse: 31,
    locator: 'sources/commentaries/jfb.txt; Judges 3:31',
    text: jfb.slice(start, end).replace(/\s+/g, ' ').trim()
  };
  verses[shamgarKey] = [id];
}

const unknownCodes = [...observedCodes].filter(code => !bookCodes[code]);
const coverageByBook = {};
for (const verse of bible) {
  coverageByBook[verse.book] ??= { total: 0, covered: 0 };
  coverageByBook[verse.book].total += 1;
  if (verses[`${verse.book}:${verse.chapter}:${verse.verse}`]?.length) coverageByBook[verse.book].covered += 1;
}
const report = {
  source: 'Public-domain primary commentary index: Matthew Henry with JFB gap coverage',
  records: Object.keys(records).length,
  total_verses: bible.length,
  covered_verses: Object.keys(verses).length,
  uncovered_verses: bible.length - Object.keys(verses).length,
  uncovered_keys: bible
    .map(verse => `${verse.book}:${verse.chapter}:${verse.verse}`)
    .filter(key => !verses[key]),
  unknown_codes: unknownCodes,
  rejected_ranges: rejectedRanges.length,
  rejected_range_details: rejectedRanges,
  corrected_range_metadata: correctedRangeMetadata,
  coverage_by_book: coverageByBook
};

function writeJsonAtomic(file, value) {
  const temporary = `${file}.building`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

writeJsonAtomic(path.join(root, 'mhc-source-index.json'), { records, verses });
writeJsonAtomic(path.join(root, 'mhc-coverage-report.json'), report);
console.log(JSON.stringify({ ...report, coverage_by_book: undefined }, null, 2));