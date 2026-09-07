const fs = require('fs');
const path = require('path');

const bible = JSON.parse(fs.readFileSync('bible.json', 'utf8'));
const worklist = JSON.parse(fs.readFileSync('commentary-worklist.json', 'utf8'));
const requiredLines = ['academic', 'theological', 'deep', 'applied'];
const requireComplete = process.argv.includes('--require-complete');
const approved = new Map();
const duplicates = [];
const invalidApproved = [];

function approvedDirectories() {
  const directories = [];
  const approvedRoot = path.join('sources', 'commentaries', 'approved');
  if (fs.existsSync(approvedRoot)) {
    for (const name of fs.readdirSync(approvedRoot)) {
      const directory = path.join(approvedRoot, name);
      if (fs.statSync(directory).isDirectory()) directories.push(directory);
    }
  }
  const legacyNumbers = path.join('sources', 'commentaries', 'numbers');
  if (fs.existsSync(legacyNumbers)) directories.push(legacyNumbers);
  return directories;
}

for (const directory of approvedDirectories()) {
  const files = fs.readdirSync(directory).filter((file) => /^approved-.*\.json$/.test(file));
  for (const file of files) {
    const relativeFile = path.join(directory, file).replace(/\\/g, '/');
    const data = JSON.parse(fs.readFileSync(relativeFile, 'utf8'));
    for (const [chapterVerse, entry] of Object.entries(data.verses || {})) {
      const key = `${data.book}:${chapterVerse}`;
      if (approved.has(key)) duplicates.push({ key, files: [approved.get(key).file, relativeFile] });
      approved.set(key, { entry, file: relativeFile });
      const lines = entry.explanation_lines || {};
      const validLines = requiredLines.every((line) => String(lines[line] || '').trim());
      const validSources = entry.sources?.length && entry.sources.every((source) => source.locators?.length);
      const validNames = entry.interpreter_names?.length === entry.sources?.length;
      if (!validLines || !validSources || !validNames) invalidApproved.push({ key, file: relativeFile });
    }
  }
}

const display = new Map();
const commentaryRoot = 'commentary-data';
if (fs.existsSync(commentaryRoot)) {
  for (const file of fs.readdirSync(commentaryRoot).filter((name) => name.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(commentaryRoot, file), 'utf8'));
    for (const [key, entry] of Object.entries(data.verses || {})) display.set(key, entry);
  }
}

function validDisplayEntry(entry) {
  const record = entry?.commentators?.academic_synthesis;
  const lines = record?.explanation_lines || {};
  return requiredLines.every((line) => String(lines[line] || '').trim()) && Boolean(record?.interpreter_names?.length);
}

const books = {};
const inconsistencies = [];
for (const verse of bible) {
  const key = `${verse.book}:${verse.chapter}:${verse.verse}`;
  const chapterKey = String(verse.chapter);
  books[verse.book] ??= { total: 0, approved: 0, displayed: 0, pending: 0, chapters: {} };
  const book = books[verse.book];
  book.chapters[chapterKey] ??= { total: 0, approved: 0, displayed: 0, missing_approved: [], missing_display: [] };
  const chapter = book.chapters[chapterKey];
  book.total += 1;
  chapter.total += 1;

  const approvedRecord = approved.get(key);
  const isDisplayed = validDisplayEntry(display.get(key));
  const isWorkApproved = worklist.verses[key]?.status === 'approved_four_line_commentary';
  if (approvedRecord) {
    book.approved += 1;
    chapter.approved += 1;
  } else {
    book.pending += 1;
    chapter.missing_approved.push(verse.verse);
  }
  if (isDisplayed) {
    book.displayed += 1;
    chapter.displayed += 1;
  } else {
    chapter.missing_display.push(verse.verse);
  }
  if (isWorkApproved !== Boolean(approvedRecord)) {
    inconsistencies.push({ key, type: isWorkApproved ? 'worklist_approved_without_file' : 'approved_file_not_in_worklist' });
  }
  if (approvedRecord && !isDisplayed) inconsistencies.push({ key, type: 'approved_missing_from_display' });
  if (!approvedRecord && isDisplayed) inconsistencies.push({ key, type: 'display_without_approved_file' });
}

const report = {
  generated_at: new Date().toISOString(),
  bible_verses: bible.length,
  approved_verses: approved.size,
  displayed_verses: display.size,
  pending_verses: bible.length - approved.size,
  duplicate_approved_keys: duplicates,
  invalid_approved_entries: invalidApproved,
  inconsistencies,
  books
};

fs.writeFileSync('commentary-coverage-audit-report.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
const genesis = books['01-gen'];
console.log(JSON.stringify({
  bible_verses: report.bible_verses,
  approved_verses: report.approved_verses,
  displayed_verses: report.displayed_verses,
  pending_verses: report.pending_verses,
  inconsistencies: inconsistencies.length,
  invalid_approved_entries: invalidApproved.length,
  duplicate_approved_keys: duplicates.length,
  genesis: genesis && {
    total: genesis.total,
    approved: genesis.approved,
    displayed: genesis.displayed,
    problem_chapters: Object.entries(genesis.chapters)
      .filter(([, chapter]) => chapter.approved !== chapter.total || chapter.displayed !== chapter.total)
      .map(([chapter, details]) => ({ chapter: Number(chapter), ...details }))
  }
}, null, 2));

if (duplicates.length || invalidApproved.length || inconsistencies.length || (requireComplete && report.pending_verses)) process.exitCode = 1;