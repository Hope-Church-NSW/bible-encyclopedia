const fs = require('fs');
const vm = require('vm');

const bible = JSON.parse(fs.readFileSync('bible.json', 'utf8'));
const verseKeys = new Set(bible.map(verse => `${verse.book}:${verse.chapter}:${verse.verse}`));
const chapterVerses = new Map();
const bookChapters = new Map();
for (const verse of bible) {
  const key = `${verse.book}:${verse.chapter}`;
  chapterVerses.set(key, Math.max(chapterVerses.get(key) || 0, Number(verse.verse)));
  bookChapters.set(verse.book, Math.max(bookChapters.get(verse.book) || 0, Number(verse.chapter)));
}

const books = {
  'تكوين': '01-gen', 'الخروج': '02-Exodus', 'خروج': '02-Exodus',
  'اللاويين': '03-Leviticus', 'لاويين': '03-Leviticus', 'العدد': '04-Numbers', 'عدد': '04-Numbers',
  'التثنية': '05-Deut', 'تثنية': '05-Deut', 'يشوع': '06-Joshua', 'القضاة': '07-Judges', 'قضاة': '07-Judges',
  'راعوث': '08-Ruth', '1 صموئيل': '09-1-Samuel', '2 صموئيل': '10-2-Samuel',
  '1 ملوك': '11-1-Kings', '2 ملوك': '12-2-Kings', '1 أخبار': '13-1-Chronicles', '2 أخبار': '14-2-Chronicles',
  'عزرا': '15-Ezra', 'نحميا': '16-Nehmiah', 'أستير': '17-Esther', 'أيوب': '18-Job',
  'المزامير': '19-Psalms', 'مزامير': '19-Psalms', 'مزمور': '19-Psalms', 'الأمثال': '20-Proverbs', 'أمثال': '20-Proverbs',
  'الجامعة': '21-Ecclesiastes', 'جامعة': '21-Ecclesiastes', 'نشيد الأنشاد': '22-Sos',
  'إشعياء': '23-Isiah', 'إرميا': '24-Jeremiah', 'مراثي إرميا': '25-Lamentations', 'مراثي': '25-Lamentations',
  'حزقيال': '26-Ezekiel', 'دانيال': '27-Daniel', 'هوشع': '28-Hosea', 'يوئيل': '29-Joel', 'عاموس': '30-Amos',
  'عوبديا': '31-Obadiah', 'يونان': '32-Jonah', 'ميخا': '33-Micah', 'ناحوم': '34-Nahum', 'حبقوق': '35-Habakuk',
  'صفنيا': '36-Zephaniah', 'حجي': '37-Haggai', 'زكريا': '38-Zechariah', 'ملاخي': '39-Malachi',
  'متى': '40-Matthew', 'مرقس': '41-Mark', 'لوقا': '42-Luke', 'يوحنا': '43-John', 'أعمال الرسل': '44-Acts', 'أعمال': '44-Acts',
  'رومية': '45-Romans', '1 كورنثوس': '46-1-Corinthians', '2 كورنثوس': '47-2-Corinthians',
  'غلاطية': '48-Galatians', 'أفسس': '49-Ephesians', 'فيلبي': '50-Philipians', 'كولوسي': '51-Colossians',
  '1 تسالونيكي': '52-1-thessalonians', '2 تسالونيكي': '53-2-thessalonians',
  '1 تيموثاوس': '54-1-Timothy', '2 تيموثاوس': '55-2-Timothy', 'تيطس': '56-Titus', 'فليمون': '57-Phillemon',
  'العبرانيين': '58-Hebrews', 'عبرانيين': '58-Hebrews', 'يعقوب': '59-James',
  '1 بطرس': '60-1-peter', '2 بطرس': '61-2pet', '1 يوحنا': '62-1-John', '2 يوحنا': '63-2-John', '3 يوحنا': '64-3-John',
  'يهوذا': '65-Jude', 'الرؤيا': '66-Revelation', 'رؤيا': '66-Revelation'
};
const bookPattern = Object.keys(books).sort((a, b) => b.length - a.length).map(escapeRegex).join('|');
const records = {};
const verseIndex = {};
const rejectedReferences = new Map();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeDigits(value) {
  return value.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function addRange(keys, scopes, book, chapter, startVerse, endVerse, raw, scope) {
  const maximum = chapterVerses.get(`${book}:${chapter}`);
  if (!maximum) {
    rejectedReferences.set(`${raw}:unknown chapter`, { raw, reason: 'unknown chapter' });
    return;
  }
  const start = Math.max(1, startVerse || 1);
  const end = Math.min(maximum, endVerse || maximum);
  for (let verse = start; verse <= end; verse += 1) {
    const key = `${book}:${chapter}:${verse}`;
    keys.add(key);
    if (scope === 'verse_or_passage' || !scopes.has(key)) scopes.set(key, scope);
  }
}

function parseReferenceBlob(value) {
  const text = normalizeDigits(String(value).replace(/[–—]/g, '-'));
  const keys = new Set();
  const scopes = new Map();
  const matcher = new RegExp(`(${bookPattern})\\s+([0-9][0-9:،,;؛\\-\\s]*)`, 'g');
  for (const match of text.matchAll(matcher)) {
    const book = books[match[1]];
    const expression = match[2].trim().replace(/[؛;]+$/, '');
    let currentChapter = null;
    let verseContext = false;
    for (const rawPart of expression.split(/[؛;]/).map(part => part.trim()).filter(Boolean)) {
      const part = rawPart.replace(/\s+/g, '');
      const verseRange = part.match(/^(\d+):(\d+)(?:-(\d+))?(?:[،,](.*))?$/);
      if (verseRange) {
        currentChapter = Number(verseRange[1]);
        verseContext = true;
        addRange(keys, scopes, book, currentChapter, Number(verseRange[2]), Number(verseRange[3] || verseRange[2]), `${match[1]} ${rawPart}`, 'verse_or_passage');
        if (verseRange[4]) {
          for (const continuation of verseRange[4].split(/[،,]/)) {
            const range = continuation.match(/^(\d+)(?:-(\d+))?$/);
            if (range) addRange(keys, scopes, book, currentChapter, Number(range[1]), Number(range[2] || range[1]), `${match[1]} ${rawPart}`, 'verse_or_passage');
          }
        }
        continue;
      }
      const chapterRange = part.match(/^(\d+)(?:-(\d+))?$/);
      if (chapterRange) {
        const startChapter = Number(chapterRange[1]);
        const endChapter = Number(chapterRange[2] || chapterRange[1]);
        if (verseContext && currentChapter) {
          addRange(keys, scopes, book, currentChapter, startChapter, endChapter, `${match[1]} ${rawPart}`, 'verse_or_passage');
          continue;
        }
        if (bookChapters.get(book) === 1 && endChapter > 1) {
          addRange(keys, scopes, book, 1, startChapter, endChapter, `${match[1]} ${rawPart}`, 'verse_or_passage');
          currentChapter = 1;
          continue;
        }
        for (let chapter = startChapter; chapter <= endChapter; chapter += 1) addRange(keys, scopes, book, chapter, 1, null, `${match[1]} ${rawPart}`, 'chapter_context');
        currentChapter = endChapter;
        verseContext = false;
      }
    }
  }
  const validKeys = [...keys].filter(key => verseKeys.has(key));
  return { keys: validKeys, scopes: new Map(validKeys.map(key => [key, scopes.get(key)])) };
}

function extractArray(file, variable, context = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const marker = `const ${variable}`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`${variable} was not found in ${file}`);
  const start = source.indexOf('[', markerIndex);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '[') depth += 1;
    if (character === ']') {
      depth -= 1;
      if (depth === 0) return vm.runInNewContext(`(${source.slice(start, index + 1)})`, context);
    }
  }
  throw new Error(`Unclosed ${variable} array in ${file}`);
}

function flatten(value) {
  if (Array.isArray(value)) return value.map(flatten).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(flatten).join(' ');
  return String(value ?? '');
}

function explicitReferenceText(value) {
  const text = flatten(value);
  const markers = [...text.matchAll(/(?:التوثيق|الشواهد الأساسية|الشواهد|الشاهد)\s*:\s*([^.]*)/g)].map(match => match[1]);
  return markers.join('؛ ');
}

function register(record, references) {
  const parsedReferences = references.map(reference => ({
    ...reference,
    parsed: parseReferenceBlob(reference.text)
  }));
  const keys = [...new Set(parsedReferences.flatMap(reference => reference.parsed.keys))];
  if (!keys.length) return false;
  records[record.id] = { ...record, references };
  for (const key of keys) {
    verseIndex[key] ??= [];
    for (const reference of parsedReferences) {
      if (!reference.parsed.keys.includes(key)) continue;
      verseIndex[key].push({ record_id: record.id, relation: reference.relation, scope: reference.parsed.scopes.get(key) });
    }
  }
  return true;
}

function indexEncyclopedia() {
  const entries = JSON.parse(fs.readFileSync('encyclopedia_ar.json', 'utf8')).entries;
  let count = 0;
  for (const entry of entries) {
    const biblical = (entry.references || []).filter(reference => reference.author === 'الكتاب المقدس').map(reference => reference.title);
    const references = biblical.length ? biblical : [explicitReferenceText(entry.content)].filter(Boolean);
    if (register({ id: `encyclopedia:${entry.id}`, type: 'encyclopedia', title: entry.title, content: entry.content, source_file: 'encyclopedia_ar.json', source_status: entry.status }, references.map(text => ({ relation: 'encyclopedia', text })))) count += 1;
  }
  return count;
}

function indexCharacters() {
  const characters = extractArray('study-biblical-characters.html', 'characters');
  let count = 0;
  for (const character of characters) {
    for (let index = 0; index < character.sections.length; index += 1) {
      const [heading, content] = character.sections[index];
      const referenceText = explicitReferenceText(content);
      if (!referenceText) continue;
      if (register({ id: `character:${character.id}:${index}`, type: 'character', title: `${character.name}: ${heading}`, content: flatten(content), source_file: 'study-biblical-characters.html' }, [{ relation: 'character', text: referenceText }])) count += 1;
    }
  }
  return count;
}

function indexMiracles() {
  const miracles = extractArray('study-miracles-christ.html', 'miracles', { commentaries: '' });
  let count = 0;
  for (const miracle of miracles) {
    const sourceSection = miracle.sections.find(section => section[0] === 'التوثيق والمراجع');
    if (!sourceSection || !sourceSection[1] || typeof sourceSection[1] !== 'object') continue;
    const relationMap = { direct: 'direct', old: 'background', messianic: 'messianic' };
    const references = Object.entries(relationMap)
      .filter(([field]) => sourceSection[1][field])
      .map(([field, relation]) => ({ relation, text: sourceSection[1][field] }));
    if (register({ id: `miracle:${miracle.id}`, type: 'miracle', title: miracle.name, content: miracle.sections.filter(section => section[0] !== 'التوثيق والمراجع').map(section => `${section[0]}: ${flatten(section[1])}`).join('\n'), source_file: 'study-miracles-christ.html' }, references)) count += 1;
  }
  return count;
}

function indexRivers() {
  const rivers = extractArray('study-biblical-rivers.html', 'rivers');
  let count = 0;
  for (const river of rivers) {
    for (let index = 0; index < river.sections.length; index += 1) {
      const [heading, content] = river.sections[index];
      const referenceText = explicitReferenceText(content);
      if (!referenceText) continue;
      if (register({ id: `river:${river.id}:${index}`, type: 'river', title: `${river.name}: ${heading}`, content: flatten(content), source_file: 'study-biblical-rivers.html', certainty: river.place }, [{ relation: 'geography', text: referenceText }])) count += 1;
    }
  }
  return count;
}

function indexProphecies() {
  const text = fs.readFileSync('messiah-prophecies-study.txt', 'utf8');
  const sections = text.split(/(?=^\d+\.\s)/gm).filter(section => /^\d+\.\s/.test(section));
  let count = 0;
  for (const section of sections) {
    const heading = section.match(/^\d+\.\s*([^\r\n]+)/)?.[1]?.trim();
    const references = parseReferenceBlob(section).keys;
    if (!heading || !references.length) continue;
    const referenceText = [...section.matchAll(new RegExp(`(?:${bookPattern})\\s+[0-9][0-9:،,;؛\\-\\s]*`, 'g'))].map(match => match[0]).join('؛ ');
    if (register({ id: `prophecy:${String(count + 1).padStart(3, '0')}`, type: 'prophecy', title: heading, content: section.trim(), source_file: 'messiah-prophecies-study.txt' }, [{ relation: 'messianic', text: referenceText }])) count += 1;
  }
  return count;
}

const counts = {
  encyclopedia: indexEncyclopedia(),
  characters: indexCharacters(),
  miracles: indexMiracles(),
  rivers: indexRivers(),
  prophecies: indexProphecies()
};

for (const links of Object.values(verseIndex)) {
  const unique = new Map(links.map(link => [`${link.record_id}:${link.relation}`, link]));
  links.splice(0, links.length, ...unique.values());
}

const output = {
  schema_version: 1,
  policy: 'Supplemental records are linked only by explicit biblical references and never replace primary commentary sources.',
  counts: { records: Object.keys(records).length, linked_verses: Object.keys(verseIndex).length, by_source: counts, rejected_references: rejectedReferences.size },
  records,
  verses: verseIndex,
  rejected_references: [...rejectedReferences.values()]
};
fs.writeFileSync('commentary-support-index.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output.counts, null, 2));