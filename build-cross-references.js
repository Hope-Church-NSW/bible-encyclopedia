const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SOURCE_FILE = path.join(ROOT, 'sources', 'cross-references-openbible', 'cross_references.txt');
const OUTPUT_FILE = path.join(ROOT, 'cross-references.json');
const MAX_REFERENCES = 12;

const BOOK_IDS = {
  Gen: '01-gen', Exod: '02-Exodus', Lev: '03-Leviticus', Num: '04-Numbers', Deut: '05-Deut',
  Josh: '06-Joshua', Judg: '07-Judges', Ruth: '08-Ruth', '1Sam': '09-1-Samuel', '2Sam': '10-2-Samuel',
  '1Kgs': '11-1-Kings', '2Kgs': '12-2-Kings', '1Chr': '13-1-Chronicles', '2Chr': '14-2-Chronicles',
  Ezra: '15-Ezra', Neh: '16-Nehmiah', Esth: '17-Esther', Job: '18-Job', Ps: '19-Psalms',
  Prov: '20-Proverbs', Eccl: '21-Ecclesiastes', Song: '22-Sos', Isa: '23-Isiah', Jer: '24-Jeremiah',
  Lam: '25-Lamentations', Ezek: '26-Ezekiel', Dan: '27-Daniel', Hos: '28-Hosea', Joel: '29-Joel',
  Amos: '30-Amos', Obad: '31-Obadiah', Jonah: '32-Jonah', Mic: '33-Micah', Nah: '34-Nahum',
  Hab: '35-Habakuk', Zeph: '36-Zephaniah', Hag: '37-Haggai', Zech: '38-Zechariah', Mal: '39-Malachi',
  Matt: '40-Matthew', Mark: '41-Mark', Luke: '42-Luke', John: '43-John', Acts: '44-Acts',
  Rom: '45-Romans', '1Cor': '46-1-Corinthians', '2Cor': '47-2-Corinthians', Gal: '48-Galatians',
  Eph: '49-Ephesians', Phil: '50-Philipians', Col: '51-Colossians', '1Thess': '52-1-thessalonians',
  '2Thess': '53-2-thessalonians', '1Tim': '54-1-Timothy', '2Tim': '55-2-Timothy', Titus: '56-Titus',
  Phlm: '57-Phillemon', Heb: '58-Hebrews', Jas: '59-James', '1Pet': '60-1-peter', '2Pet': '61-2pet',
  '1John': '62-1-John', '2John': '63-2-John', '3John': '64-3-John', Jude: '65-Jude', Rev: '66-Revelation'
};

function parseReference(value) {
  const match = String(value).match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/);
  if (!match || !BOOK_IDS[match[1]]) return null;
  return { book: BOOK_IDS[match[1]], chapter: Number(match[2]), verse: Number(match[3]) };
}

function expandTarget(value, bibleOrder, bibleSet) {
  const [startText, endText] = String(value).split('-');
  const start = parseReference(startText);
  const end = parseReference(endText || startText);
  if (!start || !end) return [];

  const startKey = `${start.book}:${start.chapter}:${start.verse}`;
  const endKey = `${end.book}:${end.chapter}:${end.verse}`;
  const startIndex = bibleOrder.get(startKey);
  const endIndex = bibleOrder.get(endKey);
  if (startIndex === undefined || endIndex === undefined || endIndex < startIndex || endIndex - startIndex > 20) return [];

  const result = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const key = bibleSet[index];
    const [book, chapter, verse] = key.split(':');
    result.push([book, Number(chapter), Number(verse)]);
  }
  return result;
}

function selectReferences(candidates) {
  const sorted = [...candidates.values()].sort((left, right) => right[3] - left[3]);
  const oldTestament = sorted.filter(item => Number(item[0].slice(0, 2)) <= 39).slice(0, 6);
  const newTestament = sorted.filter(item => Number(item[0].slice(0, 2)) >= 40).slice(0, 6);
  const selected = [...oldTestament, ...newTestament];
  const selectedKeys = new Set(selected.map(item => item.slice(0, 3).join(':')));
  const remaining = sorted.filter(item => !selectedKeys.has(item.slice(0, 3).join(':')));
  return [...selected, ...remaining]
    .sort((left, right) => right[3] - left[3])
    .slice(0, MAX_REFERENCES);
}

function main() {
  const bible = JSON.parse(fs.readFileSync(path.join(ROOT, 'bible.json'), 'utf8'));
  const bibleKeys = bible.map(item => `${item.book}:${item.chapter}:${item.verse}`);
  const bibleOrder = new Map(bibleKeys.map((key, index) => [key, index]));
  const references = new Map();
  let rejectedRows = 0;

  const lines = fs.readFileSync(SOURCE_FILE, 'utf8').split(/\r?\n/).slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const [fromText, toText, votesText] = line.split('\t');
    const from = parseReference(fromText);
    const votes = Number(votesText);
    if (!from || !Number.isFinite(votes)) {
      rejectedRows += 1;
      continue;
    }

    const fromKey = `${from.book}:${from.chapter}:${from.verse}`;
    if (!bibleOrder.has(fromKey)) {
      rejectedRows += 1;
      continue;
    }

    const targets = expandTarget(toText, bibleOrder, bibleKeys);
    if (!targets.length) {
      rejectedRows += 1;
      continue;
    }

    if (!references.has(fromKey)) references.set(fromKey, new Map());
    const verseReferences = references.get(fromKey);
    for (const target of targets) {
      const targetKey = `${target[0]}:${target[1]}:${target[2]}`;
      if (targetKey === fromKey) continue;
      const existing = verseReferences.get(targetKey);
      if (!existing || votes > existing[3]) verseReferences.set(targetKey, [...target, votes]);
    }
  }

  const compact = {};
  for (const [key, candidates] of references) compact[key] = selectReferences(candidates);

  const output = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: {
      name: 'OpenBible.info Bible Cross References',
      url: 'https://www.openbible.info/labs/cross-references/',
      license: 'CC BY 4.0',
      primary_public_domain_source: 'Treasury of Scripture Knowledge'
    },
    max_references_per_verse: MAX_REFERENCES,
    verses: compact
  };

  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output)}\n`, 'utf8');
  console.log(`Built ${Object.keys(compact).length} verse reference lists; rejected rows: ${rejectedRows}.`);
}

main();