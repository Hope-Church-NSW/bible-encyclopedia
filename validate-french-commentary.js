const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SOURCE_DIRECTORY = path.join(ROOT, 'commentary-data-en');
const TRANSLATION_DIRECTORY = path.join(ROOT, 'commentary-data-fr');
const REPORT_PATH = path.join(ROOT, 'commentary-translation-report-fr.json');
const ARABIC = /[\u0600-\u06ff]/;
const errors = [];
const files = fs.readdirSync(SOURCE_DIRECTORY).filter((file) => file.endsWith('.json')).sort();
const translatedFiles = new Set(
  fs.readdirSync(TRANSLATION_DIRECTORY).filter((file) => file.endsWith('.json'))
);
const report = {
  generated_at: new Date().toISOString(),
  source_language: 'en',
  target_language: 'fr',
  source_files: files.length,
  translated_files: 0,
  source_records: 0,
  translated_records: 0,
  missing_records: 0,
  files: {}
};

for (const file of files) {
  const source = JSON.parse(fs.readFileSync(path.join(SOURCE_DIRECTORY, file), 'utf8'));
  const translationPath = path.join(TRANSLATION_DIRECTORY, file);
  if (!fs.existsSync(translationPath)) {
    errors.push(`Missing commentary-data-fr/${file}`);
    report.missing_records += Object.keys(source.records || {}).length;
    continue;
  }

  const translation = JSON.parse(fs.readFileSync(translationPath, 'utf8'));
  const sourceRecords = source.records || {};
  const translatedRecords = translation.records || {};
  const sourceIds = Object.keys(sourceRecords);
  let translatedCount = 0;
  let missingCount = 0;

  if (translation.schema_version !== source.schema_version || translation.language !== 'fr') {
    errors.push(`${file}: invalid translation schema or language`);
  }
  if (JSON.stringify(translation.verses) !== JSON.stringify(source.verses)) {
    errors.push(`${file}: verse index differs from the source`);
  }

  for (const id of sourceIds) {
    const sourceRecord = sourceRecords[id];
    const translatedRecord = translatedRecords[id];
    if (!translatedRecord || typeof translatedRecord.text !== 'string' || !translatedRecord.text.trim()) {
      missingCount += 1;
      errors.push(`${file}:${id}: missing translated text`);
      continue;
    }
    if (translatedRecord.source_id !== sourceRecord.source_id || translatedRecord.locator !== sourceRecord.locator) {
      errors.push(`${file}:${id}: source ID or biblical locator changed`);
    }
    if (ARABIC.test(translatedRecord.text)) {
      errors.push(`${file}:${id}: Arabic remains in translated commentary`);
    }
    if (/\bn\.\s*v\./i.test(translatedRecord.text)) {
      errors.push(`${file}:${id}: invalid French rendering of the historical date abbreviation`);
    }
    translatedCount += 1;
  }

  for (const id of Object.keys(translatedRecords)) {
    if (!Object.hasOwn(sourceRecords, id)) errors.push(`${file}:${id}: unexpected commentary record`);
  }

  report.source_records += sourceIds.length;
  report.translated_records += translatedCount;
  report.missing_records += missingCount;
  if (!missingCount && translatedCount === sourceIds.length) report.translated_files += 1;
  report.files[file] = {
    source_records: sourceIds.length,
    translated_records: translatedCount,
    missing_records: missingCount
  };
}

for (const file of translatedFiles) {
  if (!files.includes(file)) errors.push(`Unexpected French commentary file: ${file}`);
}

report.complete = errors.length === 0;
report.coverage_percent = Number(
  ((report.translated_records / Math.max(report.source_records, 1)) * 100).toFixed(2)
);
fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (errors.length) {
  console.error(errors.slice(0, 100).join('\n'));
  console.error(`French commentary validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(JSON.stringify({
  valid: true,
  files: report.translated_files,
  records: report.translated_records,
  coverage: `${report.coverage_percent}%`
}));
