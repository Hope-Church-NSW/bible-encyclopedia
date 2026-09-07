const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, 'assets', 'project-translations-en.json');
const REPORT = path.join(ROOT, 'project-translation-report.json');
const ARABIC = /[\u0600-\u06ff]/;
const args = new Set(process.argv.slice(2));
const studyOnly = args.has('--studies');

function studySourceFiles() {
  return fs.readdirSync(ROOT).filter((file) => file.endsWith('-study.txt') && !file.endsWith('-study-en.txt'));
}

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTranslation(value) {
  return normalize(value).replace(/،/g, ',').replace(/؛/g, ';').replace(/؟/g, '?');
}

function addIfArabic(target, value, file) {
  const text = normalize(value);
  if (!text || text.length === 1 || !ARABIC.test(text) || text.length > 12000) return;
  if (!target.has(text)) target.set(text, new Set());
  target.get(text).add(file);
}

function extractStrings() {
  const strings = new Map();
  const files = fs.readdirSync(ROOT).filter((file) => {
    if (!file.endsWith('.html')) return false;
    return !studyOnly || file === 'studies.html' || file.startsWith('study-') || file === 'solomon-temple.html' || file === 'solomon_temple_overview.html';
  });
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const withoutCode = source.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    for (const match of withoutCode.matchAll(/>([^<>]*[\u0600-\u06ff][^<>]*)</g)) addIfArabic(strings, match[1], file);
    for (const match of source.matchAll(/(?:title|placeholder|aria-label|alt)=["']([^"']*[\u0600-\u06ff][^"']*)["']/gi)) {
      addIfArabic(strings, match[1], file);
    }
    const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).join('\n');
    for (const match of scripts.matchAll(/(["'`])([^"'`\r\n]*[\u0600-\u06ff][^"'`\r\n]*)\1/g)) addIfArabic(strings, match[2], file);
  }
  for (const file of studySourceFiles()) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const line of source.split(/\r?\n/)) addIfArabic(strings, line, file);
  }
  return strings;
}

function writeEnglishStudyFiles(translations) {
  for (const file of studySourceFiles()) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
    const translated = source.split('\n').map((line) => {
      const text = normalize(line);
      return text && ARABIC.test(text) && hasValidTranslation(text, translations) ? normalize(translations[text]) : line;
    }).join('\n');
    const output = file.replace(/-study\.txt$/, '-study-en.txt');
    fs.writeFileSync(path.join(ROOT, output), translated, 'utf8');
  }
}

function findCopilotLoader() {
  const candidates = [
    process.env.COPILOT_NPM_LOADER,
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@github', 'copilot', 'npm-loader.js'),
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@github', 'copilot-win32-x64', 'npm-loader.js')
  ].filter(Boolean);
  const loader = candidates.find((candidate) => fs.existsSync(candidate));
  if (!loader) throw new Error('Unable to locate the GitHub Copilot CLI loader.');
  return loader;
}

function parseJson(text) {
  const fenced = [...String(text).matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const block of fenced.reverse()) {
    try { return JSON.parse(block[1]); } catch (_) {}
  }
  const start = String(text).indexOf('{');
  const end = String(text).lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(String(text).slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

function translateBatch(batch, retryFeedback = '') {
  const correction = retryFeedback ? ` Previous attempts failed validation. Correct these errors exactly: ${retryFeedback}` : '';
  const prompt = `Translate the following Arabic evangelical Bible-study website strings into accurate, natural academic English. Translate every Arabic word, including Arabic book names, person names, place names, labels, and titles; no Arabic letters may remain. Preserve intentional Hebrew and Greek source-language text, every Bible reference, number, HTML entity, and template expression such as \${name} exactly. Every number written with digits in the input must remain the identical digits in the output; never spell it out as words. Every number written as an Arabic word must remain written as an English word; never convert it to digits. For example, translate "أخبار الأيام الثاني 3:1" as "Second Chronicles 3:1", not "2 Chronicles 3:1". Use English punctuation, including commas, semicolons, and question marks. Translate the full meaning without summarizing, omitting, or adding commentary. Use established English biblical names.${correction} Return strict JSON only in this shape: {"translations":[{"id":0,"text":"English"}]}. Include every id exactly once. Input: ${JSON.stringify(batch)}`;
  const result = spawnSync(process.execPath, [
    findCopilotLoader(), '-p', prompt, '--allow-all-tools', '--no-ask-user', '--no-custom-instructions',
    '--disable-builtin-mcps', '--max-ai-credits', '30', '--model', 'auto', '--silent'
  ], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status !== 0) throw new Error(output.trim() || `Copilot exited with ${result.status}`);
  const parsed = parseJson(output);
  if (!parsed || !Array.isArray(parsed.translations)) throw new Error('Copilot returned invalid translation JSON.');
  return parsed.translations;
}

function validateTranslation(source, translation) {
  if (!translation || ARABIC.test(translation)) return 'translation contains Arabic or is empty';
  const sourceNumbers = source.match(/\d+/g) || [];
  const translatedNumbers = translation.match(/\d+/g) || [];
  const writtenNumberValues = {
    الأول: '1', الأولى: '1', واحد: '1', واحدة: '1',
    الثاني: '2', الثانية: '2', اثنان: '2', اثنين: '2', اثنتان: '2', اثنتين: '2',
    الثالث: '3', الثالثة: '3', ثلاثة: '3', ثلاث: '3',
    الرابع: '4', الرابعة: '4', أربعة: '4', أربع: '4',
    الخامس: '5', الخامسة: '5', خمسة: '5', خمس: '5',
    السادس: '6', السادسة: '6', ستة: '6', ست: '6',
    السابع: '7', السابعة: '7', سبعة: '7', سبع: '7',
    الثامن: '8', الثامنة: '8', ثمانية: '8', ثماني: '8',
    التاسع: '9', التاسعة: '9', تسعة: '9', تسع: '9',
    العاشر: '10', العاشرة: '10', عشرة: '10', عشر: '10',
    أربعون: '40', الأربعون: '40', أربعين: '40', الأربعين: '40',
    خمسون: '50', الخمسون: '50', خمسين: '50', الخمسين: '50'
  };
  const writtenNumbers = [...source.matchAll(/الأول(?:ى)?|الثاني(?:ة)?|الثالث(?:ة)?|الرابع(?:ة)?|الخامس(?:ة)?|السادس(?:ة)?|السابع(?:ة)?|الثامن(?:ة)?|التاسع(?:ة)?|العاشر(?:ة)?|اثنان|اثنين|اثنتان|اثنتين|ثمانية|ثماني|ثلاثة|ثلاث|أربعة|أربع|خمسة|خمس|ستة|ست|سبعة|سبع|تسعة|تسع|عشرة|عشر|واحدة|واحد|الأربعون|أربعون|الأربعين|أربعين|الخمسون|خمسون|الخمسين|خمسين/g)]
    .map((match) => writtenNumberValues[match[0]]);
  const numbersMatch = sourceNumbers.join('|') === translatedNumbers.join('|');
  const writtenNumbersMatch = sourceNumbers.length === 0 && writtenNumbers.length > 0 && writtenNumbers.join('|') === translatedNumbers.join('|');
  if (!numbersMatch && !writtenNumbersMatch) return 'numbers or Bible references changed';
  const sourceTemplates = source.match(/\$\{[^}]+\}/g) || [];
  const translatedTemplates = translation.match(/\$\{[^}]+\}/g) || [];
  if (sourceTemplates.join('|') !== translatedTemplates.join('|')) return 'template expressions changed';
  if (source.length > 120 && translation.length < source.length * 0.35) return 'translation appears truncated';
  return '';
}

function hasValidTranslation(source, translations) {
  return !validateTranslation(source, normalize(translations[source]));
}

function translateValidatedBatch(batch) {
  const translatedById = new Map();
  let pending = batch;
  let lastError;
  let retryFeedback = '';
  for (let attempt = 1; attempt <= 3 && pending.length; attempt += 1) {
    let translated;
    try {
      translated = translateBatch(pending, retryFeedback);
    } catch (error) {
      lastError = error;
      continue;
    }
    const expectedIds = new Set(pending.map((item) => item.id));
    const expectedTranslations = translated.filter((item) => expectedIds.has(item.id));
    const returnedIds = new Set(expectedTranslations.map((item) => item.id));
    if (returnedIds.size !== pending.length || pending.some((item) => !returnedIds.has(item.id))) {
      throw new Error(`Translation batch returned ${returnedIds.size}/${pending.length} requested ids.`);
    }
    const invalid = [];
    const validationFailures = [];
    for (const item of expectedTranslations) {
      const source = batch.find((candidate) => candidate.id === item.id);
      const translation = normalizeTranslation(item.text);
      const validationError = source && validateTranslation(source.text, translation);
      if (!source || validationError) {
        if (source) lastError = new Error(`id ${item.id}: ${validationError}; output: ${translation.slice(0, 200)}`);
        if (source) validationFailures.push(`id ${item.id}: ${validationError}; rejected output: ${translation.slice(0, 200)}`);
        invalid.push(source || { id: item.id, text: '' });
      } else {
        translatedById.set(item.id, translation);
      }
    }
    pending = invalid;
    retryFeedback = validationFailures.join(' | ');
  }
  if (pending.length) {
    const failed = pending[0];
    const detail = lastError ? lastError.message : `id ${failed.id}: ${failed.text.slice(0, 160)}`;
    throw new Error(`Unable to translate validated batch after 3 attempts: ${detail}`);
  }
  return batch.map((item) => ({ id: item.id, text: translatedById.get(item.id) }));
}

function writeReport(strings, translations) {
  const missing = [...strings.keys()].filter((text) => !hasValidTranslation(text, translations));
  const files = {};
  for (const [text, owners] of strings) {
    for (const file of owners) {
      if (!files[file]) files[file] = { source_strings: 0, translated_strings: 0, missing_strings: 0 };
      files[file].source_strings += 1;
      if (hasValidTranslation(text, translations)) files[file].translated_strings += 1;
      else files[file].missing_strings += 1;
    }
  }
  for (const file of Object.values(files)) {
    file.coverage_percent = Number(((file.translated_strings / Math.max(file.source_strings, 1)) * 100).toFixed(2));
  }
  const report = {
    generated_at: new Date().toISOString(),
    source_language: 'ar',
    target_language: 'en',
    source_strings: strings.size,
    translated_strings: strings.size - missing.length,
    missing_strings: missing.length,
    coverage_percent: Number((((strings.size - missing.length) / Math.max(strings.size, 1)) * 100).toFixed(2)),
    complete_files: Object.values(files).filter((file) => file.missing_strings === 0).length,
    total_files: Object.keys(files).length,
    files,
    missing: missing.slice(0, 200).map((text) => ({ text, files: [...strings.get(text)] }))
  };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

function main() {
  const strings = extractStrings();
  const translations = fs.existsSync(OUTPUT) ? JSON.parse(fs.readFileSync(OUTPUT, 'utf8')) : {};
  if (args.has('--audit')) {
    writeEnglishStudyFiles(translations);
    console.log(JSON.stringify(writeReport(strings, translations), null, 2));
    return;
  }
  const pending = [...strings.keys()].filter((text) => !hasValidTranslation(text, translations));
  const limitArgument = process.argv.find((value) => value.startsWith('--limit='));
  const limit = limitArgument ? Number(limitArgument.split('=')[1]) : pending.length;
  let completed = 0;
  while (pending.length && completed < limit) {
    const batch = [];
    let characters = 0;
    while (pending.length && batch.length < 80 && characters < 12000 && completed + batch.length < limit) {
      const text = pending.shift();
      batch.push({ id: batch.length, text });
      characters += text.length;
    }
    const translated = translateValidatedBatch(batch);
    const returnedIds = new Set(translated.map((item) => item.id));
    if (returnedIds.size !== batch.length || batch.some((_, id) => !returnedIds.has(id))) {
      throw new Error(`Translation batch returned ${returnedIds.size}/${batch.length} unique ids.`);
    }
    for (const item of translated) {
      const source = batch[item.id];
      if (!source || typeof item.text !== 'string' || !item.text.trim()) throw new Error(`Invalid translation at id ${item.id}.`);
      const translation = normalizeTranslation(item.text);
      const validationError = validateTranslation(source.text, translation);
      if (validationError) throw new Error(`Invalid translation at id ${item.id}: ${validationError}`);
      translations[source.text] = translation;
    }
    completed += batch.length;
    fs.writeFileSync(OUTPUT, `${JSON.stringify(translations, null, 2)}\n`, 'utf8');
    writeEnglishStudyFiles(translations);
    const report = writeReport(strings, translations);
    console.log(`Translated ${report.translated_strings}/${report.source_strings} strings (${report.coverage_percent}%).`);
  }
  writeEnglishStudyFiles(translations);
  writeReport(strings, translations);
}

main();