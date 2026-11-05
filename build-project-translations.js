const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const ARABIC = /[\u0600-\u06ff]/;
const args = new Set(process.argv.slice(2));
const languageArgument = process.argv.find((value) => value.startsWith('--lang='));
const targetLanguage = languageArgument ? languageArgument.split('=')[1] : 'en';
if (!['en', 'es', 'fr'].includes(targetLanguage)) throw new Error('Supported target languages: en, es, fr');
const providerArgument = process.argv.find((value) => value.startsWith('--provider='));
const translationProvider = providerArgument ? providerArgument.split('=')[1] : 'copilot';
if (!['copilot', 'bing'].includes(translationProvider)) throw new Error('Supported providers: copilot, bing');
const languageName = targetLanguage === 'es' ? 'neutral Spanish' : targetLanguage === 'fr' ? 'French' : 'English';
const encyclopediaOnly = args.has('--encyclopedia');
const commentaryOnly = args.has('--commentary');
const sourceLanguageName = commentaryOnly ? 'English' : 'Arabic';
const translationScope = commentaryOnly ? 'commentary' : encyclopediaOnly ? 'encyclopedia' : 'project';
const shardArgument = process.argv.find((value) => value.startsWith('--shard='));
const shardMatch = shardArgument?.match(/^--shard=(\d+)\/(\d+)$/);
const shard = shardMatch ? { index: Number(shardMatch[1]), count: Number(shardMatch[2]) } : null;
if (shard && (shard.count < 2 || shard.index < 0 || shard.index >= shard.count)) {
  throw new Error('Shard must use --shard=index/count with 0 <= index < count.');
}
const BASE_OUTPUT = path.join(ROOT, 'assets', `${translationScope}-translations-${targetLanguage}.json`);
const OUTPUT = shard
  ? path.join(ROOT, 'assets', `${translationScope}-translations-${targetLanguage}-part-${shard.index}-of-${shard.count}.json`)
  : BASE_OUTPUT;
const REPORT = path.join(
  ROOT,
  commentaryOnly || encyclopediaOnly
    ? `${translationScope}-translation-report-${targetLanguage}${shard ? `-part-${shard.index}-of-${shard.count}` : ''}.json`
    : targetLanguage === 'en'
      ? 'project-translation-report.json'
      : `project-translation-report-${targetLanguage}${shard ? `-part-${shard.index}-of-${shard.count}` : ''}.json`
);
const studyOnly = args.has('--studies');
const FRENCH_TRANSLATION_OVERRIDES = new Map([
  ['حالة الحروف العربية الـ28', 'État des 28 lettres arabes'],
  ['70م', '70 apr. J.-C.'],
  ['7م', '7 h du soir'],
  ['7:00 مساءً', '7:00 du soir'],
  ['نايين — لوقا 7:11-17', 'Naïn — Luc 7:11-17'],
  ['🌐 اللغة', '🌐 Langue']
]);
const FRENCH_BIBLE_REFERENCE_NAMES = new Map([
  ['أخبار الأيام الأول', '1 Chroniques'], ['أخبار الأيام الأولى', '1 Chroniques'],
  ['أخبار الأيام الثاني', '2 Chroniques'], ['أخبار الأيام الثانية', '2 Chroniques'],
  ['أخبار الأيام', 'Chroniques'], ['تثنية', 'Deutéronome'], ['الاشتراع', 'Deutéronome'],
  ['1 أخبار الأيام', '1 Chroniques'], ['2 أخبار الأيام', '2 Chroniques'], ['1 أخبار', '1 Chroniques'], ['2 أخبار', '2 Chroniques'],
  ['1 صموئيل', '1 Samuel'], ['2 صموئيل', '2 Samuel'], ['1 ملوك', '1 Rois'], ['2 ملوك', '2 Rois'],
  ['1 كورنثوس', '1 Corinthiens'], ['2 كورنثوس', '2 Corinthiens'], ['1 تسالونيكي', '1 Thessaloniciens'], ['2 تسالونيكي', '2 Thessaloniciens'],
  ['1 تيموثاوس', '1 Timothée'], ['2 تيموثاوس', '2 Timothée'], ['1 بطرس', '1 Pierre'], ['2 بطرس', '2 Pierre'],
  ['1 يوحنا', '1 Jean'], ['2 يوحنا', '2 Jean'], ['3 يوحنا', '3 Jean'], ['مزمور', 'Psaume'],
  ['صموئيل الأول', '1 Samuel'], ['صموئيل الأولى', '1 Samuel'], ['صموئيل الثاني', '2 Samuel'], ['صموئيل الثانية', '2 Samuel'],
  ['الملوك الأول', '1 Rois'], ['الملوك الأولى', '1 Rois'], ['الملوك الثاني', '2 Rois'], ['الملوك الثانية', '2 Rois'],
  ['ملوك أول', '1 Rois'], ['ملوك أولى', '1 Rois'], ['ملوك ثاني', '2 Rois'], ['ملوك ثانية', '2 Rois'],
  ['عزرا', 'Esdras'], ['نحميا', 'Néhémie'], ['أستير', 'Esther'], ['أيوب', 'Job'], ['المزامير', 'Psaumes'], ['مزامير', 'Psaumes'],
  ['الأمثال', 'Proverbes'], ['أمثال', 'Proverbes'], ['الجامعة', 'Ecclésiaste'], ['نشيد الأنشاد', 'Cantique des cantiques'],
  ['نشيد سليمان', 'Cantique des cantiques'], ['إشعياء', 'Ésaïe'], ['اشعياء', 'Ésaïe'], ['إرميا', 'Jérémie'],
  ['مراثي إرميا', 'Lamentations de Jérémie'], ['حزقيال', 'Ézéchiel'], ['دانيال', 'Daniel'], ['هوشع', 'Osée'],
  ['يوئيل', 'Joël'], ['عاموس', 'Amos'], ['عوبديا', 'Abdias'], ['يونان', 'Jonas'], ['ميخا', 'Michée'], ['ناحوم', 'Nahum'],
  ['حبقوق', 'Habakuk'], ['صفنيا', 'Sophonie'], ['حجي', 'Aggée'], ['زكريا', 'Zacharie'], ['ملاخي', 'Malachie'],
  ['تكوين', 'Genèse'], ['خروج', 'Exode'], ['لاويين', 'Lévitique'], ['عدد', 'Nombres'], ['يشوع', 'Josué'], ['قضاة', 'Juges'],
  ['راعوث', 'Ruth'], ['راعوت', 'Ruth'], ['يشوع بن نون', 'Josué'], ['متى', 'Matthieu'], ['مرقس', 'Marc'], ['لوقا', 'Luc'],
  ['يوحنا', 'Jean'], ['أعمال الرسل', 'Actes'], ['أعمال', 'Actes'], ['رومية', 'Romains'],
  ['كورنثوس الأولى', '1 Corinthiens'], ['كورنثوس الأول', '1 Corinthiens'], ['كورنثوس الثانية', '2 Corinthiens'], ['كورنثوس الثاني', '2 Corinthiens'],
  ['غلاطية', 'Galates'], ['أفسس', 'Éphésiens'], ['فيلبي', 'Philippiens'], ['كولوسي', 'Colossiens'],
  ['تسالونيكي الأولى', '1 Thessaloniciens'], ['تسالونيكي الأول', '1 Thessaloniciens'], ['تسالونيكي الثانية', '2 Thessaloniciens'], ['تسالونيكي الثاني', '2 Thessaloniciens'],
  ['تيموثاوس الأولى', '1 Timothée'], ['تيموثاوس الأول', '1 Timothée'], ['تيموثاوس الثانية', '2 Timothée'], ['تيموثاوس الثاني', '2 Timothée'],
  ['تيطس', 'Tite'], ['فليمون', 'Philémon'], ['عبرانيين', 'Hébreux'], ['العبرانيين', 'Hébreux'], ['يعقوب', 'Jacques'],
  ['بطرس الأولى', '1 Pierre'], ['بطرس الأول', '1 Pierre'], ['بطرس الثانية', '2 Pierre'], ['بطرس الثاني', '2 Pierre'],
  ['يوحنا الأولى', '1 Jean'], ['يوحنا الأول', '1 Jean'], ['يوحنا الثانية', '2 Jean'], ['يوحنا الثاني', '2 Jean'],
  ['يوحنا الثالثة', '3 Jean'], ['يوحنا الثالث', '3 Jean'], ['يهوذا', 'Jude'], ['رؤيا يوحنا', 'Apocalypse'], ['الرؤيا', 'Apocalypse']
]);
for (const [english, french] of [
  ['Genesis', 'Genèse'], ['Exodus', 'Exode'], ['Leviticus', 'Lévitique'], ['Numbers', 'Nombres'], ['Deuteronomy', 'Deutéronome'],
  ['Joshua', 'Josué'], ['Judges', 'Juges'], ['Ruth', 'Ruth'], ['1 Samuel', '1 Samuel'], ['2 Samuel', '2 Samuel'],
  ['1 Kings', '1 Rois'], ['2 Kings', '2 Rois'], ['1 Chronicles', '1 Chroniques'], ['2 Chronicles', '2 Chroniques'],
  ['Ezra', 'Esdras'], ['Nehemiah', 'Néhémie'], ['Esther', 'Esther'], ['Job', 'Job'], ['Psalms', 'Psaumes'], ['Psalm', 'Psaume'],
  ['Proverbs', 'Proverbes'], ['Ecclesiastes', 'Ecclésiaste'], ['Song of Solomon', 'Cantique des cantiques'], ['Isaiah', 'Ésaïe'],
  ['Jeremiah', 'Jérémie'], ['Lamentations', 'Lamentations'], ['Ezekiel', 'Ézéchiel'], ['Daniel', 'Daniel'], ['Hosea', 'Osée'],
  ['Joel', 'Joël'], ['Amos', 'Amos'], ['Obadiah', 'Abdias'], ['Jonah', 'Jonas'], ['Micah', 'Michée'], ['Nahum', 'Nahum'],
  ['Habakkuk', 'Habakuk'], ['Zephaniah', 'Sophonie'], ['Haggai', 'Aggée'], ['Zechariah', 'Zacharie'], ['Malachi', 'Malachie'],
  ['Matthew', 'Matthieu'], ['Mark', 'Marc'], ['Luke', 'Luc'], ['John', 'Jean'], ['Acts', 'Actes'], ['Romans', 'Romains'],
  ['1 Corinthians', '1 Corinthiens'], ['2 Corinthians', '2 Corinthiens'], ['Galatians', 'Galates'], ['Ephesians', 'Éphésiens'],
  ['Philippians', 'Philippiens'], ['Colossians', 'Colossiens'], ['1 Thessalonians', '1 Thessaloniciens'], ['2 Thessalonians', '2 Thessaloniciens'],
  ['1 Timothy', '1 Timothée'], ['2 Timothy', '2 Timothée'], ['Titus', 'Tite'], ['Philemon', 'Philémon'], ['Hebrews', 'Hébreux'],
  ['James', 'Jacques'], ['1 Peter', '1 Pierre'], ['2 Peter', '2 Pierre'], ['1 John', '1 Jean'], ['2 John', '2 Jean'],
  ['3 John', '3 Jean'], ['Jude', 'Jude'], ['Revelation', 'Apocalypse']
]) FRENCH_BIBLE_REFERENCE_NAMES.set(english, french);

function protectFrenchBibleReferences(value, tokenScope = '') {
  const aliases = [...FRENCH_BIBLE_REFERENCE_NAMES.keys()]
    .sort((left, right) => right.length - left.length)
    .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const referencePattern = new RegExp(
    `(^|[^\\u0621-\\u064a])(${aliases.join('|')})\\s+(\\d{1,3}(?:(?:\\s*:\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)(?:\\s*[,،]\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)*)?(?:\\s*[-–]\\s*\\d{1,3})?)`,
    'gu'
  );
  const protectedReferences = [];
  const text = value.replace(referencePattern, (match, boundary, book, numbers) => {
    const frenchBook = FRENCH_BIBLE_REFERENCE_NAMES.get(book);
    const token = `ZXQREF${tokenScope}${protectedReferences.length.toString(36)}QXZ`;
    protectedReferences.push({ token, reference: `${frenchBook} ${numbers}`.trim(), sourceBook: book });
    return `${boundary}${token}`;
  });
  return { text, protectedReferences };
}

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

function splitTranslationSource(value, maximumLength = 8000) {
  const chunks = [];
  let remaining = normalize(value);
  while (remaining.length > maximumLength) {
    const window = remaining.slice(0, maximumLength + 1);
    const sentenceBreak = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('? '),
      window.lastIndexOf('! '),
      window.lastIndexOf('; ')
    );
    const spaceBreak = window.lastIndexOf(' ');
    const splitAt = sentenceBreak > maximumLength * 0.55 ? sentenceBreak + 1 : spaceBreak;
    if (splitAt <= 0) throw new Error('Unable to split translation source safely.');
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function extractStrings() {
  const strings = new Map();
  if (commentaryOnly) {
    const directory = path.join(ROOT, 'commentary-data-en');
    for (const file of fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort()) {
      const data = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
      for (const record of Object.values(data.records || {})) {
        for (const text of splitTranslationSource(record.text)) {
          if (!strings.has(text)) strings.set(text, new Set());
          strings.get(text).add(path.join('commentary-data-en', file));
        }
      }
    }
    return strings;
  }
  if (encyclopediaOnly) {
    const collect = (value, key = '') => {
      if (typeof value === 'string') {
        if (!['id', 'letter', 'sourceLetter', 'status', 'url'].includes(key)) {
          addIfArabic(strings, value, 'encyclopedia_ar.json');
        }
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => collect(item, key));
        return;
      }
      if (value && typeof value === 'object') {
        Object.entries(value).forEach(([childKey, childValue]) => collect(childValue, childKey));
      }
    };
    collect(JSON.parse(fs.readFileSync(path.join(ROOT, 'encyclopedia_ar.json'), 'utf8')));
    return strings;
  }
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

function writeStudyFiles(translations) {
  if (encyclopediaOnly || commentaryOnly) return;
  const files = studySourceFiles();
  if (targetLanguage === 'fr' && files.some((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
    .split(/\r?\n/)
    .some((line) => {
      const text = normalize(line);
      return text && ARABIC.test(text) && text !== 'و' && !hasValidTranslation(text, translations);
    }))) return;
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
    const translated = source.split('\n').map((line) => {
      const text = normalize(line);
      if (text === 'و') return targetLanguage === 'es' ? 'y' : targetLanguage === 'fr' ? 'et' : 'and';
      return text && ARABIC.test(text) && hasValidTranslation(text, translations) ? normalize(translations[text]) : line;
    }).join('\n');
    const output = file.replace(/-study\.txt$/, `-study-${targetLanguage}.txt`);
    fs.writeFileSync(path.join(ROOT, output), translated, 'utf8');
  }
}

function writeLocalizedEncyclopedia(translations) {
  if (!encyclopediaOnly || !['es', 'fr'].includes(targetLanguage)) return;
    const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'encyclopedia_ar.json'), 'utf8'));
    const preserve = new Set(['id', 'letter', 'sourceLetter', 'status', 'url']);
    const translateValue = (value, key = '') => {
      if (typeof value === 'string') {
        const text = normalize(value);
        return !preserve.has(key) && ARABIC.test(text) && hasValidTranslation(text, translations)
          ? translations[text]
          : value;
      }

      if (Array.isArray(value)) return value.map((item) => translateValue(item, key));
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
          childKey,
          translateValue(childValue, childKey)
        ]));
      }
      return value;
    };
    const entries = source.entries.map((entry) => {
      const translated = translateValue(entry);
      translated.sourceLetter = entry.letter;
      const letter = String(translated.title || '').normalize('NFKD').match(/[A-Za-z]/);
      translated.letter = letter ? letter[0].toUpperCase() : '#';
      return translated;
    });
    const hasRemainingArabic = (value, key = '') => {
      if (typeof value === 'string') return !preserve.has(key) && ARABIC.test(value);
      if (Array.isArray(value)) return value.some((item) => hasRemainingArabic(item, key));
      if (value && typeof value === 'object') {
        return Object.entries(value).some(([childKey, childValue]) => hasRemainingArabic(childValue, childKey));
      }
      return false;
    };
    fs.writeFileSync(path.join(ROOT, `encyclopedia_${targetLanguage}.json`), `${JSON.stringify({
      language: targetLanguage,
      complete: !hasRemainingArabic(entries),
      sourceEntries: source.entries.length,
      entries
    }, null, 2)}\n`, 'utf8');
}

function writeLocalizedCommentary(translations) {
  if (!commentaryOnly || !['es', 'fr'].includes(targetLanguage)) return;
  const sourceDirectory = path.join(ROOT, 'commentary-data-en');
  const outputDirectory = path.join(ROOT, `commentary-data-${targetLanguage}`);
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const file of fs.readdirSync(sourceDirectory).filter((name) => name.endsWith('.json')).sort()) {
    const source = JSON.parse(fs.readFileSync(path.join(sourceDirectory, file), 'utf8'));
    const records = {};
    for (const [recordId, record] of Object.entries(source.records || {})) {
      const chunks = splitTranslationSource(record.text);
      if (!chunks.every((chunk) => hasValidTranslation(chunk, translations))) continue;
      records[recordId] = {
        source_id: record.source_id,
        locator: record.locator,
        text: chunks.map((chunk) => translations[chunk]).join(' ')
      };
    }
    fs.writeFileSync(path.join(outputDirectory, file), `${JSON.stringify({
      schema_version: 1,
      language: targetLanguage,
      records,
      verses: source.verses
    })}\n`, 'utf8');
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

async function translateBingBatch(batch) {
  const { translate } = require('bing-translate-api');
  const marker = '[[[FIELD_BREAK_7F3A9]]]';
  const results = batch.map(() => []);
  const tasks = [];
  for (let itemIndex = 0; itemIndex < batch.length; itemIndex += 1) {
    const item = batch[itemIndex];
    const override = targetLanguage === 'fr' ? FRENCH_TRANSLATION_OVERRIDES.get(item.text) : null;
    if (override) {
      results[itemIndex] = [override];
      continue;
    }
    const chunks = splitTranslationSource(item.text, 700);
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const tokenScope = `${itemIndex.toString(36)}X${chunkIndex.toString(36)}X`;
      const { text: referenceProtectedText, protectedReferences } = protectFrenchBibleReferences(chunks[chunkIndex], tokenScope);
      const protectedTemplates = [];
      const templateProtectedText = referenceProtectedText.replace(/\$\{[^}]+\}/g, (expression) => {
        const token = `ZXQTPL${tokenScope}${protectedTemplates.length.toString(36)}QXZ`;
        protectedTemplates.push({ token, expression });
        return token;
      });
      const protectedNumbers = [];
      const numberProtectedText = templateProtectedText.replace(/\d+/g, (digits) => {
        const token = `ZXQNUM${tokenScope}${protectedNumbers.length.toString(36)}QXZ`;
        protectedNumbers.push({ token, digits });
        return token;
      });
      const protectedTerms = [];
      const text = numberProtectedText.replace(/[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff]+/g, (term) => {
        const token = `ZXQLT${tokenScope}${protectedTerms.length.toString(36)}QXZ`;
        protectedTerms.push({ token, term });
        return token;
      });
      tasks.push({
        itemIndex,
        chunkIndex,
        text,
        protectedTerms,
        protectedTemplates,
        protectedReferences,
        protectedNumbers
      });
    }
    results[itemIndex] = new Array(chunks.length);
  }

  const groups = [];
  let group = [];
  let groupLength = 0;
  for (const task of tasks) {
    const addedLength = task.text.length + (group.length ? marker.length + 2 : 0);
    if (group.length && groupLength + addedLength > 900) {
      groups.push(group);
      group = [];
      groupLength = 0;
    }
    group.push(task);
    groupLength += task.text.length + (group.length > 1 ? marker.length + 2 : 0);
  }
  if (group.length) groups.push(group);

  let nextIndex = 0;
  let failure;
  const workers = Array.from({ length: Math.min(4, groups.length) }, async () => {
    while (nextIndex < groups.length && !failure) {
      const index = nextIndex;
      nextIndex += 1;
      const currentGroup = groups[index];
      try {
        const response = await translate(currentGroup.map((task) => task.text).join(` ${marker} `), commentaryOnly ? 'en' : 'ar', targetLanguage);
        let translatedParts = response.translation.split(marker).map((part) => part.trim());
        if (translatedParts.length !== currentGroup.length) {
          translatedParts = [];
          for (const task of currentGroup) {
            const fallback = await translate(task.text, commentaryOnly ? 'en' : 'ar', targetLanguage);
            translatedParts.push(fallback.translation.trim());
          }
        }
        for (let partIndex = 0; partIndex < currentGroup.length; partIndex += 1) {
          const task = currentGroup[partIndex];
          let translated = translatedParts[partIndex];
          const protectedItems = [
            ...task.protectedTerms,
            ...task.protectedTemplates,
            ...task.protectedNumbers,
            ...task.protectedReferences
          ];
          if (protectedItems.some(({ token }) => !translated.includes(token))) {
            const fallback = await translate(task.text, commentaryOnly ? 'en' : 'ar', targetLanguage);
            translated = fallback.translation.trim();
          }
          for (const { token, term } of task.protectedTerms) {
            if (!translated.includes(token)) throw new Error(`Translation provider changed source-language term ${term}.`);
            translated = translated.replaceAll(token, term);
          }
          for (const { token, digits } of task.protectedNumbers) {
            if (!translated.includes(token)) throw new Error(`Translation provider changed protected number ${digits}.`);
            translated = translated.replaceAll(token, digits);
          }
          for (const { token, expression } of task.protectedTemplates) {
            if (!translated.includes(token)) throw new Error(`Translation provider changed template expression ${expression}.`);
            translated = translated.replaceAll(token, expression);
          }
          for (const { token, reference } of task.protectedReferences) {
            if (!translated.includes(token)) throw new Error(`Translation provider changed biblical reference ${reference}.`);
            translated = translated.replaceAll(token, reference);
          }
          results[task.itemIndex][task.chunkIndex] = translated;
        }
      } catch (error) {
        failure = error;
      }
    }
  });
  await Promise.all(workers);
  if (failure) throw failure;
  return batch.map((item, index) => ({ id: item.id, text: results[index].join(' ') }));
}

async function translateBatch(batch, retryFeedback = '') {
  if (translationProvider === 'bing') return translateBingBatch(batch);
  const correction = retryFeedback ? ` Previous attempts failed validation. Correct these errors exactly: ${retryFeedback}` : '';
  const targetInstructions = targetLanguage === 'es'
    ? 'Use neutral, natural, academically precise Spanish understandable throughout the Spanish-speaking world. Use biblical names and theological terminology established by the public-domain Reina-Valera 1909, while preserving the full meaning of the Arabic source. Use correct Spanish punctuation, including opening question and exclamation marks where applicable. A digit before a biblical book name must remain the identical digit: translate "1 صموئيل 7:1" as "1 Samuel 7:1", never "Primero de Samuel 7:1". A number written as an Arabic word must remain a Spanish word: translate "أخبار الأيام الثاني 3:1" as "Segundo de Crónicas 3:1", not "2 Crónicas 3:1".'
    : targetLanguage === 'fr'
      ? 'Use accurate, natural French with academically precise biblical and theological terminology. Use established French biblical book names and terminology from the public-domain Louis Segond 1910. Preserve the full meaning of the Arabic source and use correct French accents, apostrophes, and punctuation. Preserve every digit exactly, and render numbers written as Arabic words as French words rather than digits.'
    : 'Use accurate, natural academic English and established English biblical names. Use English punctuation, including commas, semicolons, and question marks. For example, translate "أخبار الأيام الثاني 3:1" as "Second Chronicles 3:1", not "2 Chronicles 3:1".';
  const prompt = `Translate the following ${sourceLanguageName} evangelical Bible-study ${commentaryOnly ? 'commentary passages' : 'website strings'} into ${languageName}. ${targetInstructions} Translate every source-language word, including book names, person names, place names, labels, and titles; no untranslated ${sourceLanguageName} prose may remain. Preserve intentional Hebrew and Greek source-language text, every Bible reference, number, HTML entity, and template expression such as \${name} exactly. Every number written with digits in the input must remain the identical digits in the output; never spell it out as words. Every number written as a source-language word or ordinal must remain written as a target-language word or ordinal; never convert it to digits. Translate the full meaning without summarizing, omitting, modernizing, or adding commentary.${correction} Return strict JSON only in this shape: {"translations":[{"id":0,"text":"Translation"}]}. Include every id exactly once. Input: ${JSON.stringify(batch)}`;
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
  if (!translation) return 'translation is empty';
  const preservedArabicLetters = new Set([...source.matchAll(/(?:حرف|الحرف)\s+([\u0621-\u064a])/g)].map((match) => match[1]));
  const untranslatedArabic = [...translation].filter((character) => ARABIC.test(character) && !preservedArabicLetters.has(character));
  if (untranslatedArabic.length) return 'translation contains untranslated Arabic prose';
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
  if (targetLanguage === 'fr') {
    let searchFrom = 0;
    const bookNumberPositions = [];
    for (const { reference, sourceBook } of protectFrenchBibleReferences(source).protectedReferences) {
      if (/\d/.test(sourceBook)) continue;
      const bookNumber = reference.match(/^(\d+)\s/);
      if (!bookNumber) continue;
      const referencePosition = translation.indexOf(reference, searchFrom);
      if (referencePosition < 0) continue;
      searchFrom = referencePosition + reference.length;
      const position = (translation.slice(0, referencePosition).match(/\d+/g) || []).length;
      bookNumberPositions.push({ position, number: bookNumber[1] });
    }
    for (const { position, number } of bookNumberPositions.sort((left, right) => right.position - left.position)) {
      if (translatedNumbers[position] === number) translatedNumbers.splice(position, 1);
    }
  }
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

async function translateValidatedBatch(batch) {
  const translatedById = new Map();
  let pending = batch;
  let lastError;
  let retryFeedback = '';
  for (let attempt = 1; attempt <= 3 && pending.length; attempt += 1) {
    let translated;
    try {
      translated = await translateBatch(pending, retryFeedback);
    } catch (error) {
      lastError = error;
      if (translationProvider === 'bing' && attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      continue;
    }
    const expectedIds = new Set(pending.map((item) => item.id));
    const expectedTranslations = translated.filter((item) => expectedIds.has(item.id));
    const returnedIds = new Set(expectedTranslations.map((item) => item.id));
    const missingItems = pending.filter((item) => !returnedIds.has(item.id));
    const invalid = [...missingItems];
    const validationFailures = missingItems.map((item) => `id ${item.id}: translation was omitted`);
    for (const item of expectedTranslations) {
      const source = batch.find((candidate) => candidate.id === item.id);
      const translation = normalizeTranslation(item.text);
      const validationError = source && validateTranslation(source.text, translation);
      if (!source || validationError) {
        if (source) lastError = new Error(`id ${item.id}: ${validationError}; source: ${source.text.slice(0, 200)}; output: ${translation.slice(0, 200)}`);
        if (source) validationFailures.push(`id ${item.id}: ${validationError}; source: ${source.text.slice(0, 200)}; rejected output: ${translation.slice(0, 200)}`);
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
    source_language: commentaryOnly ? 'en' : 'ar',
    target_language: targetLanguage,
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

async function main() {
  const strings = extractStrings();
  const translations = Object.assign(
    {},
    fs.existsSync(BASE_OUTPUT) ? JSON.parse(fs.readFileSync(BASE_OUTPUT, 'utf8')) : {},
    fs.existsSync(OUTPUT) ? JSON.parse(fs.readFileSync(OUTPUT, 'utf8')) : {}
  );
  if (targetLanguage === 'fr') {
    for (const [source, translation] of FRENCH_TRANSLATION_OVERRIDES) {
      if (strings.has(source)) translations[source] = translation;
    }
    for (const source of Object.keys(translations)) {
      if (commentaryOnly && /\d/.test(source)) delete translations[source];
    }
    fs.writeFileSync(OUTPUT, `${JSON.stringify(translations, null, 2)}\n`, 'utf8');
  }
  if (args.has('--audit')) {
    if (shard) throw new Error('Audit merged translations without --shard.');
    writeStudyFiles(translations);
    writeLocalizedEncyclopedia(translations);
    writeLocalizedCommentary(translations);
    console.log(JSON.stringify(writeReport(strings, translations), null, 2));
    return;
  }
  const allPending = [...strings.keys()].filter((text) => !hasValidTranslation(text, translations));
  const pending = shard
    ? allPending.filter((_, index) => index % shard.count === shard.index)
    : allPending;
  const limitArgument = process.argv.find((value) => value.startsWith('--limit='));
  const limit = limitArgument ? Number(limitArgument.split('=')[1]) : pending.length;
  let completed = 0;
  while (pending.length && completed < limit) {
    const batch = [];
    let characters = 0;
    const maximumBatchItems = translationProvider === 'bing' ? 20 : commentaryOnly ? 10 : 80;
    const maximumBatchCharacters = translationProvider === 'bing' ? 12000 : commentaryOnly ? 50000 : 12000;
    while (pending.length && batch.length < maximumBatchItems && characters < maximumBatchCharacters && completed + batch.length < limit) {
      const text = pending.shift();
      batch.push({ id: batch.length, text });
      characters += text.length;
    }
    const translated = await translateValidatedBatch(batch);
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
    if (!shard) {
      writeStudyFiles(translations);
      writeLocalizedEncyclopedia(translations);
      if (!pending.length) writeLocalizedCommentary(translations);
    }
    const report = writeReport(strings, translations);
    console.log(`Translated ${report.translated_strings}/${report.source_strings} strings (${report.coverage_percent}%).`);
  }
  if (!shard) {
    writeStudyFiles(translations);
    writeLocalizedEncyclopedia(translations);
    writeLocalizedCommentary(translations);
  }
  writeReport(strings, translations);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});