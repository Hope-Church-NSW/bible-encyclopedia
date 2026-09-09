const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SOURCE = path.join(ROOT, 'encyclopedia_ar.json');
const OUTPUT = path.join(ROOT, 'encyclopedia_en.json');
const CACHE = path.join(ROOT, '.encyclopedia-translation-cache.json');
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const MARKER = '[[[FIELD_BREAK_7F3A9]]]';
const MAX_BATCH_CHARACTERS = 3500;
const CONCURRENT_BATCHES = 1;
const ARABIC_PATTERN = /[\u0600-\u06ff]/;
const PRESERVED_KEYS = new Set(['id', 'letter', 'sourceLetter', 'status', 'url']);
let bingSession;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function isCompleteTranslation(value) {
  return typeof value === 'string' && value.trim() && !ARABIC_PATTERN.test(value);
}

function collectArabicStrings(value, key = '', strings = new Set()) {
  if (typeof value === 'string') {
    if (!PRESERVED_KEYS.has(key) && ARABIC_PATTERN.test(value)) strings.add(value);
    return strings;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectArabicStrings(item, key, strings));
    return strings;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([childKey, childValue]) => {
      collectArabicStrings(childValue, childKey, strings);
    });
  }

  return strings;
}

function makeBatches(strings) {
  const batches = [];
  let batch = [];
  let length = 0;

  strings.forEach((text) => {
    const addedLength = text.length + MARKER.length + 4;
    if (batch.length && length + addedLength > MAX_BATCH_CHARACTERS) {
      batches.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(text);
    length += addedLength;
  });

  if (batch.length) batches.push(batch);
  return batches;
}

async function getBingSession() {
  if (bingSession) return bingSession;
  const response = await fetch('https://www.bing.com/translator');
  if (!response.ok) throw new Error(`Bing session returned HTTP ${response.status}`);
  const html = await response.text();
  const ig = html.match(/IG:"([^"]+)"/)?.[1];
  const abuse = html.match(/params_AbusePreventionHelper\s*=\s*\[([^\]]+)\]/)?.[1];
  const values = abuse ? JSON.parse(`[${abuse}]`) : [];
  const iid = html.match(/data-iid="([^"]+)"/)?.[1] || 'translator.5028';
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ')
    : response.headers.get('set-cookie') || '';
  if (!ig || values.length < 2) throw new Error('Unable to read the Bing translation session.');
  bingSession = { ig, iid, cookies, key: values[0], token: values[1] };
  return bingSession;
}

async function requestBingTranslation(texts) {
  const session = await getBingSession();
  const body = new URLSearchParams({
    fromLang: 'ar',
    text: texts.join(`\n${MARKER}\n`),
    to: 'en',
    token: session.token,
    key: String(session.key)
  });
  const response = await fetch(`https://www.bing.com/ttranslatev3?isVertical=1&IG=${session.ig}&IID=${session.iid}.1`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: session.cookies,
      origin: 'https://www.bing.com',
      referer: 'https://www.bing.com/translator'
    },
    body
  });
  if (!response.ok) throw new Error(`Bing translation returned HTTP ${response.status}`);
  const payload = await response.json();
  return payload[0].translations[0].text;
}

async function requestTranslation(texts, attempt = 1) {
  const body = new URLSearchParams({
    client: 'gtx',
    sl: 'ar',
    tl: 'en',
    dt: 't',
    q: texts.join(`\n${MARKER}\n`)
  });

  try {
    const response = await fetch(ENDPOINT, { method: 'POST', body });
    let translated;
    if (response.status === 429) {
      translated = await requestBingTranslation(texts);
    } else {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      translated = payload[0].map((part) => part[0]).join('');
    }
    const parts = translated.split(new RegExp(`\\s*\\[\\[\\[FIELD_BREAK_7F3A9\\]\\]\\]\\s*`));

    if (parts.length !== texts.length) {
      if (texts.length === 1) return [translated.trim()];
      const midpoint = Math.ceil(texts.length / 2);
      return [
        ...await requestTranslation(texts.slice(0, midpoint)),
        ...await requestTranslation(texts.slice(midpoint))
      ];
    }

    return parts.map((part) => part.trim());
  } catch (error) {
    if (attempt >= 4) throw error;
    await delay(750 * attempt);
    return requestTranslation(texts, attempt + 1);
  }
}

function translateValue(value, translations, key = '') {
  if (typeof value === 'string') {
    return !PRESERVED_KEYS.has(key) && translations[value]
      ? translations[value]
      : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => translateValue(item, translations, key));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      translateValue(childValue, translations, childKey)
    ]));
  }

  return value;
}

function englishLetter(title) {
  const match = String(title || '').normalize('NFKD').match(/[A-Za-z]/);
  return match ? match[0].toUpperCase() : '#';
}

async function main() {
  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  if (!Array.isArray(source.entries)) throw new Error('encyclopedia_ar.json must contain entries.');

  const cached = fs.existsSync(CACHE)
    ? JSON.parse(fs.readFileSync(CACHE, 'utf8'))
    : {};
  const allStrings = [...collectArabicStrings(source)];
  const pending = allStrings.filter((text) => !isCompleteTranslation(cached[text]));
  const cachedOnly = process.argv.includes('--cached-only');
  const batches = cachedOnly ? [] : makeBatches(pending);

  let translationError = null;
  try {
    for (let index = 0; index < batches.length; index += CONCURRENT_BATCHES) {
      const wave = batches.slice(index, index + CONCURRENT_BATCHES);
      const translatedWave = await Promise.all(wave.map(requestTranslation));
      wave.forEach((batch, batchIndex) => batch.forEach((text, itemIndex) => {
        cached[text] = translatedWave[batchIndex][itemIndex];
      }));
      fs.writeFileSync(CACHE, `${JSON.stringify(cached, null, 2)}\n`, 'utf8');
      process.stdout.write(`\rTranslated ${Math.min(index + CONCURRENT_BATCHES, batches.length)}/${batches.length} batches`);
      await delay(650);
    }
  } catch (error) {
    translationError = error;
    process.stderr.write(`\nTranslation paused: ${error.message}\n`);
  }

  const entries = source.entries.filter((entry) => {
    const required = [...collectArabicStrings(entry)];
    return required.every((text) => cached[text]);
  }).map((entry) => {
    const translated = translateValue(entry, cached);
    translated.sourceLetter = entry.letter;
    translated.letter = englishLetter(translated.title);
    return translated;
  }).filter((entry) => collectArabicStrings(entry).size === 0);

  fs.writeFileSync(OUTPUT, `${JSON.stringify({
    language: 'en',
    complete: entries.length === source.entries.length,
    sourceEntries: source.entries.length,
    entries
  }, null, 2)}\n`, 'utf8');
  if (batches.length) process.stdout.write('\n');
  console.log(JSON.stringify({
    entries: entries.length,
    sourceEntries: source.entries.length,
    translatedStrings: Object.keys(cached).length,
    output: path.basename(OUTPUT)
  }));
  if (entries.length !== source.entries.length) {
    throw translationError || new Error(
      `English encyclopedia is incomplete: ${entries.length}/${source.entries.length} entries.`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});