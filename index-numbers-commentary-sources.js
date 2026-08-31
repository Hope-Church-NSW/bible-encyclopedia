const fs = require('fs');
const path = require('path');

const sourceDir = path.join('sources', 'commentaries', 'numbers');
const bible = JSON.parse(fs.readFileSync('bible.json', 'utf8'));
const verses = bible.filter(verse => verse.book === '04-Numbers');
const index = Object.fromEntries(
  verses.map(verse => [`${verse.chapter}:${verse.verse}`, { text: verse.text, sources: {} }])
);

function decodeHtml(value) {
  const entities = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '-', ndash: '-', hellip: '...'
  };
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
      if (entity[0] === '#') {
        const hexadecimal = entity[1].toLowerCase() === 'x';
        return String.fromCodePoint(parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10));
      }
      return entities[entity.toLowerCase()] ?? `&${entity};`;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function assign(sourceId, chapter, startVerse, endVerse, record) {
  for (let verse = startVerse; verse <= endVerse; verse += 1) {
    const key = `${chapter}:${verse}`;
    if (!index[key]) continue;
    index[key].sources[sourceId] ??= [];
    index[key].sources[sourceId].push(record);
  }
}

function indexMatthewHenry() {
  const directory = path.join(sourceDir, 'mhc1', 'OEBPS');
  const files = fs.readdirSync(directory).filter(file => /^mhc1\.Num\.[ivxlcdm]+\.html$/i.test(file));
  let sections = 0;
  for (const file of files) {
    const html = fs.readFileSync(path.join(directory, file), 'utf8');
    const pattern = /<div class="Commentary" id="Bible_Num\.(\d+)\.(\d+)-Num\.\d+\.(\d+)">([\s\S]*?)<\/div>/g;
    for (const match of html.matchAll(pattern)) {
      const chapter = Number(match[1]);
      const startVerse = Number(match[2]);
      const endVerse = Number(match[3]);
      const text = decodeHtml(match[4]);
      assign('matthew_henry', chapter, startVerse, endVerse, {
        range: `Numbers ${chapter}:${startVerse}-${endVerse}`,
        locator: `${file}#Bible_Num.${chapter}.${startVerse}-Num.${chapter}.${endVerse}`,
        text
      });
      sections += 1;
    }
  }
  return sections;
}

function parseVerseRange(label) {
  const numbers = [...label.matchAll(/\d+/g)].map(match => Number(match[0]));
  if (!numbers.length) return null;
  return [numbers[0], numbers[numbers.length - 1]];
}

function indexJfb() {
  const text = fs.readFileSync(path.join(sourceDir, 'jfb-numbers.txt'), 'utf8');
  const chapters = [...text.matchAll(/^   CHAPTER (\d+)\s*$/gm)];
  let sections = 0;
  for (let position = 0; position < chapters.length; position += 1) {
    const chapter = Number(chapters[position][1]);
    const start = chapters[position].index + chapters[position][0].length;
    const end = chapters[position + 1]?.index ?? text.length;
    const body = text.slice(start, end);
    const notes = [...body.matchAll(/^   (\d+(?:\s*[-,]\s*\d+)*)(?:\.)\s+([\s\S]*?)(?=^   \d+(?:\s*[-,]\s*\d+)*\.\s+|\n     _{20,}|$)/gm)];
    for (const note of notes) {
      const range = parseVerseRange(note[1]);
      if (!range) continue;
      const noteText = note[2].replace(/\s+/g, ' ').trim();
      assign('jfb', chapter, range[0], range[1], {
        range: `Numbers ${chapter}:${range[0]}-${range[1]}`,
        locator: `jfb-numbers.txt; chapter ${chapter}; verses ${note[1]}`,
        text: noteText
      });
      sections += 1;
    }
  }
  return sections;
}

function indexKeilDelitzsch() {
  const payload = JSON.parse(fs.readFileSync(path.join(sourceDir, 'keil-delitzsch-numbers.json'), 'utf8'));
  const html = payload.parse?.text;
  if (!html) throw new Error('Keil & Delitzsch HTML is unavailable');

  const headings = [...html.matchAll(/<h([12])[^>]*>([\s\S]*?)<\/h\1>/g)].map(match => ({
    level: Number(match[1]),
    title: decodeHtml(match[2]).replace(/[\u200b-\u200d\ufeff]/g, ''),
    index: match.index,
    end: match.index + match[0].length
  }));
  let chapter = 1;
  let sections = 0;
  for (let position = 0; position < headings.length; position += 1) {
    const heading = headings[position];
    const chapterMatch = heading.title.match(/^Chap\.\s*(\d+)$/i);
    if (chapterMatch) {
      chapter = Number(chapterMatch[1]);
      continue;
    }
    if (heading.level !== 2) continue;
    const verseMatch = heading.title.match(/^vers?e?s?\s+(\d+)(?:\s*-\s*(\d+))?$/i);
    if (!verseMatch) continue;

    const startVerse = Number(verseMatch[1]);
    const endVerse = Number(verseMatch[2] || verseMatch[1]);
    const nextHeading = headings.slice(position + 1).find(item => item.level <= heading.level);
    const text = decodeHtml(html.slice(heading.end, nextHeading?.index ?? html.length));
    assign('keil_delitzsch', chapter, startVerse, endVerse, {
      range: `Numbers ${chapter}:${startVerse}-${endVerse}`,
      locator: `keil-delitzsch-numbers.json; HTML offset ${heading.index}; ${heading.title}`,
      text
    });
    sections += 1;
  }
  return sections;
}

const sectionCounts = {
  matthew_henry: indexMatthewHenry(),
  jfb: indexJfb(),
  keil_delitzsch: indexKeilDelitzsch()
};
const coverage = Object.fromEntries(
  ['matthew_henry', 'jfb', 'keil_delitzsch'].map(sourceId => [
    sourceId,
    verses.filter(verse => index[`${verse.chapter}:${verse.verse}`].sources[sourceId]?.length).length
  ])
);
const report = {
  book: 'Numbers',
  verse_count: verses.length,
  section_counts: sectionCounts,
  covered_verses: coverage,
  coverage_by_source_count: Object.fromEntries(
    [1, 2, 3].map(count => [
      count,
      verses.filter(verse => Object.keys(index[`${verse.chapter}:${verse.verse}`].sources).length === count).length
    ])
  ),
  uncovered: Object.fromEntries(
    ['matthew_henry', 'jfb', 'keil_delitzsch'].map(sourceId => [
      sourceId,
      verses
        .filter(verse => !index[`${verse.chapter}:${verse.verse}`].sources[sourceId]?.length)
        .map(verse => `${verse.chapter}:${verse.verse}`)
    ])
  )
};

fs.writeFileSync(path.join(sourceDir, 'source-index.json'), `${JSON.stringify({ verses: index }, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(sourceDir, 'coverage-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));