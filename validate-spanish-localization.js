const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ARABIC = /[\u0600-\u06ff]/;
const errors = [];

function readJson(relativePath) {
  const file = path.join(ROOT, relativePath);
  if (!fs.existsSync(file)) {
    errors.push(`Missing ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`Invalid JSON in ${relativePath}: ${error.message}`);
    return null;
  }
}

const spanishBible = readJson('bible-es.json');
if (spanishBible && (!Array.isArray(spanishBible) || spanishBible.length !== 31104)) {
  errors.push(`bible-es.json must contain 31104 canonical verses`);
}

const sourceEncyclopedia = readJson('encyclopedia_ar.json');
const spanishEncyclopedia = readJson('encyclopedia_es.json');
if (sourceEncyclopedia && spanishEncyclopedia) {
  if (spanishEncyclopedia.language !== 'es' || !spanishEncyclopedia.complete) {
    errors.push('encyclopedia_es.json must be complete and declare language es');
  }
  if (spanishEncyclopedia.entries?.length !== sourceEncyclopedia.entries?.length) {
    errors.push(`Spanish encyclopedia has ${spanishEncyclopedia.entries?.length || 0}/${sourceEncyclopedia.entries?.length || 0} entries`);
  }
  const preservedKeys = new Set(['id', 'letter', 'sourceLetter', 'status', 'url']);
  const containsArabic = (value, key = '') => {
    if (typeof value === 'string') return !preservedKeys.has(key) && ARABIC.test(value);
    if (Array.isArray(value)) return value.some((item) => containsArabic(item, key));
    if (value && typeof value === 'object') {
      return Object.entries(value).some(([childKey, childValue]) => containsArabic(childValue, childKey));
    }
    return false;
  };
  if (containsArabic(spanishEncyclopedia.entries || [])) {
    errors.push('Arabic text remains in encyclopedia_es.json');
  }
}

const translationReport = readJson('project-translation-report-es.json');
if (translationReport) {
  if (translationReport.target_language !== 'es') errors.push('Spanish translation report has the wrong target language');
  if (translationReport.missing_strings !== 0 || translationReport.coverage_percent !== 100) {
    errors.push(`Spanish project translations are ${translationReport.coverage_percent || 0}% complete`);
  }
}

const arabicStudies = fs.readdirSync(ROOT).filter((file) => /-study\.txt$/.test(file));
const spanishStudies = fs.readdirSync(ROOT).filter((file) => /-study-es\.txt$/.test(file));
if (spanishStudies.length !== arabicStudies.length) {
  errors.push(`Spanish study files have ${spanishStudies.length}/${arabicStudies.length} coverage`);
}
for (const file of spanishStudies) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (ARABIC.test(text)) errors.push(`Arabic text remains in ${file}`);
}

const htmlFiles = fs.readdirSync(ROOT).filter((file) => file.endsWith('.html'));
const pageDirectory = path.join(ROOT, 'assets', 'project-translations-pages-es');
const pageBundles = fs.existsSync(pageDirectory)
  ? fs.readdirSync(pageDirectory).filter((file) => file.endsWith('.json'))
  : [];
if (pageBundles.length !== htmlFiles.length) {
  errors.push(`Spanish page bundles have ${pageBundles.length}/${htmlFiles.length} coverage`);
}

const sourceCommentaryDirectory = path.join(ROOT, 'commentary-data-en');
const spanishCommentaryDirectory = path.join(ROOT, 'commentary-data-es');
const commentaryFiles = fs.readdirSync(sourceCommentaryDirectory).filter((file) => file.endsWith('.json')).sort();
for (const file of commentaryFiles) {
  const source = readJson(path.join('commentary-data-en', file));
  const translation = readJson(path.join('commentary-data-es', file));
  if (!source || !translation) continue;
  if (translation.language !== 'es') errors.push(`${file}: commentary language must be es`);
  const sourceIds = Object.keys(source.records || {});
  const translatedIds = Object.keys(translation.records || {});
  if (translatedIds.length !== sourceIds.length || sourceIds.some((id) => !translation.records[id]?.text)) {
    errors.push(`${file}: incomplete Spanish commentary records`);
  }
}

if (errors.length) {
  console.error(errors.slice(0, 100).join('\n'));
  console.error(`Spanish localization validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(JSON.stringify({
  valid: true,
  bibleVerses: spanishBible.length,
  encyclopediaEntries: spanishEncyclopedia.entries.length,
  translatedStrings: translationReport.translated_strings,
  studyFiles: spanishStudies.length,
  pageBundles: pageBundles.length,
  commentaryBooks: commentaryFiles.length
}));
