const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CHUNK_SIZE = 4;
const MAX_RETRIES = 2;
const CREDIT_LIMIT_PER_CHUNK = 30;

function parseArgs(argv) {
  const options = {
    dryRun: false,
    maxChunks: Number.POSITIVE_INFINITY,
    workspaceRoot: process.cwd(),
    mockCliLoader: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--max-chunks') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) throw new Error('--max-chunks requires a positive integer');
      options.maxChunks = value;
      index += 1;
      continue;
    }
    if (arg === '--workspace-root') {
      const value = argv[index + 1];
      if (!value) throw new Error('--workspace-root requires a path');
      options.workspaceRoot = path.resolve(value);
      index += 1;
      continue;
    }
    if (arg === '--mock-cli-loader') {
      const value = argv[index + 1];
      if (!value) throw new Error('--mock-cli-loader requires a path');
      options.mockCliLoader = path.resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeSpaces(value) {
  return String(value || '').replace(/[\s\p{P}\p{M}]+/gu, ' ').trim();
}

function extractEightWordPhrases(text) {
  const normalized = normalizeSpaces(text);
  const words = normalized.split(' ').filter(Boolean);
  const phrases = [];
  for (let index = 0; index <= words.length - 8; index += 1) {
    phrases.push(words.slice(index, index + 8).join(' '));
  }
  return phrases;
}

function verseNumericSort(left, right) {
  if (left.book !== right.book) return left.book.localeCompare(right.book);
  if (left.chapter !== right.chapter) return left.chapter - right.chapter;
  return left.verse - right.verse;
}

function buildBibleMap(bible) {
  const map = new Map();
  for (const entry of Object.values(bible)) {
    if (!entry || typeof entry !== 'object') continue;
    const key = `${entry.book}:${entry.chapter}:${entry.verse}`;
    map.set(key, entry.text || '');
  }
  return map;
}

function collectApprovedFiles(root) {
  const files = [];
  const approvedRoot = path.join(root, 'sources', 'commentaries', 'approved');
  if (fs.existsSync(approvedRoot)) {
    for (const bookDir of fs.readdirSync(approvedRoot)) {
      const fullBookDir = path.join(approvedRoot, bookDir);
      if (!fs.statSync(fullBookDir).isDirectory()) continue;
      for (const file of fs.readdirSync(fullBookDir)) {
        if (/^approved-.*\.json$/.test(file)) files.push(path.join(fullBookDir, file));
      }
    }
  }
  const legacyNumbersDir = path.join(root, 'sources', 'commentaries', 'numbers');
  if (fs.existsSync(legacyNumbersDir)) {
    for (const file of fs.readdirSync(legacyNumbersDir)) {
      if (/^approved-.*\.json$/.test(file)) files.push(path.join(legacyNumbersDir, file));
    }
  }
  return files.sort();
}

function loadExistingApproved(root) {
  const approved = new Map();
  const phraseOwners = new Map();
  for (const file of collectApprovedFiles(root)) {
    const data = readJson(file);
    for (const [reference, entry] of Object.entries(data.verses || {})) {
      const verseKey = `${data.book}:${reference}`;
      approved.set(verseKey, { ...entry, book: data.book, reference });
      for (const line of Object.values(entry.explanation_lines || {})) {
        for (const phrase of extractEightWordPhrases(line)) {
          if (!phraseOwners.has(phrase)) phraseOwners.set(phrase, new Set());
          phraseOwners.get(phrase).add(verseKey);
        }
      }
    }
  }
  return { approved, phraseOwners };
}

function buildSourceNamesFromPacket(primarySources) {
  const names = [];
  for (const source of primarySources) {
    if (source.interpreter_name && !names.includes(source.interpreter_name)) names.push(source.interpreter_name);
  }
  return names;
}

function flattenPrimarySources(primarySources) {
  const byId = new Map();
  for (const source of primarySources) {
    const id = source.id || source.source_id;
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, { id, locators: [], ranges: [] });
    const bucket = byId.get(id);
    for (const locator of source.locators || []) if (locator && !bucket.locators.includes(locator)) bucket.locators.push(locator);
    for (const range of source.ranges || []) if (range && !bucket.ranges.includes(range)) bucket.ranges.push(range);
  }
  return [...byId.values()];
}

function findCopilotLoader(options) {
  if (options.mockCliLoader) return options.mockCliLoader;
  if (process.env.COPILOT_NPM_LOADER) return process.env.COPILOT_NPM_LOADER;
  const candidates = [
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@github', 'copilot', 'npm-loader.js'),
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@github', 'copilot-win32-x64', 'npm-loader.js')
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Unable to locate Copilot npm-loader.js. Set COPILOT_NPM_LOADER or use --mock-cli-loader.');
}

function safeJsonParseFromText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  const fencedBlocks = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const fenced of fencedBlocks.reverse()) {
    try {
      const parsed = JSON.parse(fenced[1]);
      if (parsed && parsed.verses) return parsed;
    } catch (_) {}
  }
  const firstBrace = trimmed.indexOf('{');
  if (firstBrace === -1) return null;
  for (let end = trimmed.length - 1; end > firstBrace; end -= 1) {
    if (trimmed[end] !== '}') continue;
    const segment = trimmed.slice(firstBrace, end + 1);
    try {
      return JSON.parse(segment);
    } catch (_) {}
  }
  return null;
}

function runCopilotChunk(options, prompt) {
  const loader = findCopilotLoader(options);
  const args = [
    loader,
    '-p',
    prompt,
    '--allow-all-tools',
    '--no-ask-user',
    '--no-custom-instructions',
    '--disable-builtin-mcps',
    '--max-ai-credits',
    String(CREDIT_LIMIT_PER_CHUNK),
    '--model',
    'auto',
    '--silent'
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: options.workspaceRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  if (result.error) {
    return { ok: false, stopReason: 'execution_error', output: String(result.error) };
  }
  const lowered = output.toLowerCase();
  if (/no authentication information found|authentication required|unauthorized|sign in to use copilot|login required/.test(lowered)) {
    return { ok: false, stopReason: 'auth_error', output };
  }
  if (/quota|credit|rate limit|limit exceeded|insufficient/.test(lowered) && result.status !== 0) {
    return { ok: false, stopReason: 'quota_error', output };
  }
  if (result.status !== 0) return { ok: false, stopReason: 'cli_error', output };
  const parsed = safeJsonParseFromText(output);
  if (!parsed || !parsed.verses) return { ok: false, stopReason: 'invalid_model_json', output };
  return { ok: true, payload: parsed, output };
}

function validateChunkFile(options, filePath) {
  const result = spawnSync(process.execPath, ['validate-commentary-quality.js', filePath], {
    cwd: options.workspaceRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}\n${result.stderr || ''}`.trim()
  };
}

function parseBookName(bookCode) {
  const parts = String(bookCode).split('-');
  return parts.slice(1).join('-') || bookCode;
}

function aggregateBookCommentary(options, bookCode) {
  const bookApproved = {};
  const approvedRoot = path.join(options.workspaceRoot, 'sources', 'commentaries', 'approved', bookCode);
  if (fs.existsSync(approvedRoot)) {
    for (const file of fs.readdirSync(approvedRoot).filter((name) => /^approved-.*\.json$/.test(name)).sort()) {
      const data = readJson(path.join(approvedRoot, file));
      Object.assign(bookApproved, data.verses || {});
    }
  }
  if (bookCode === '04-Numbers') {
    const legacyRoot = path.join(options.workspaceRoot, 'sources', 'commentaries', 'numbers');
    if (fs.existsSync(legacyRoot)) {
      for (const file of fs.readdirSync(legacyRoot).filter((name) => /^approved-.*\.json$/.test(name)).sort()) {
        const data = readJson(path.join(legacyRoot, file));
        Object.assign(bookApproved, data.verses || {});
      }
    }
  }

  const verses = {};
  const bookName = parseBookName(bookCode);
  for (const [chapterVerse, entry] of Object.entries(bookApproved)) {
    const [chapterRaw, verseRaw] = chapterVerse.split(':');
    const chapter = Number(chapterRaw);
    const verse = Number(verseRaw);
    const reference = `${bookCode}:${chapter}:${verse}`;
    const references = [];
    (entry.sources || []).forEach((source, index) => {
      const sourceName = (entry.interpreter_names || [])[index] || source.id;
      for (const locator of source.locators || []) references.push({ source: sourceName, locator });
    });
    verses[reference] = {
      reference: { book: bookCode, chapter, verse, book_name: bookName },
      text: entry.text,
      commentators: {
        academic_synthesis: {
          explanation_lines: entry.explanation_lines,
          interpreter_names: entry.interpreter_names || [],
          summary: entry.summary || '',
          interpretation: '',
          theological_emphasis: ''
        }
      },
      references,
      status: { completed: true, reviewed: true, sources_verified: true, preview: false }
    };
  }
  const output = { verses };
  writeJson(path.join(options.workspaceRoot, 'commentary-data', `${bookCode}.json`), output);
}

function buildPrimarySourcesForVerse(context, verseInfo) {
  const chapterVerse = `${verseInfo.chapter}:${verseInfo.verse}`;
  const fullKey = `${verseInfo.book}:${verseInfo.chapter}:${verseInfo.verse}`;
  if (verseInfo.book === '04-Numbers' && context.numbersIndex.verses[chapterVerse]) {
    const verseNode = context.numbersIndex.verses[chapterVerse];
    const idNameMap = {
      matthew_henry: 'متى هنري',
      jfb: 'جاميسون وفوست وبراون',
      keil_delitzsch: 'كايل ودليتش'
    };
    const rows = [];
    for (const [id, records] of Object.entries(verseNode.sources || {})) {
      const locators = [];
      const ranges = [];
      const excerpts = [];
      for (const record of records || []) {
        if (record.locator && !locators.includes(record.locator)) locators.push(record.locator);
        if (record.range && !ranges.includes(record.range)) ranges.push(record.range);
        if (record.text && !excerpts.includes(record.text)) excerpts.push(record.text);
      }
      rows.push({ id, interpreter_name: idNameMap[id] || id, locators, ranges, excerpts });
    }
    return rows;
  }

  const rows = [];
  const recordIds = verseInfo.primary_source_records || [];
  for (const recordId of recordIds) {
    const record = context.primaryIndex.records[recordId];
    if (!record) continue;
    rows.push({
      id: record.source_id,
      record_id: recordId,
      interpreter_name: record.interpreter_name || record.source_id,
      locators: record.locator ? [record.locator] : [],
      ranges: [record.start_verse && record.end_verse ? `${record.book} ${record.chapter}:${record.start_verse}-${record.end_verse}` : `${record.book} ${record.chapter}`],
      excerpts: record.text ? [record.text] : []
    });
  }
  if (!rows.length) {
    const fallbackIds = context.primaryIndex.verses[fullKey] || [];
    for (const recordId of fallbackIds) {
      const record = context.primaryIndex.records[recordId];
      if (!record) continue;
      rows.push({
        id: record.source_id,
        record_id: recordId,
        interpreter_name: record.interpreter_name || record.source_id,
        locators: record.locator ? [record.locator] : [],
        ranges: [record.start_verse && record.end_verse ? `${record.book} ${record.chapter}:${record.start_verse}-${record.end_verse}` : `${record.book} ${record.chapter}`],
        excerpts: record.text ? [record.text] : []
      });
    }
  }
  return rows;
}

function buildSupplementalForVerse(context, verseKey) {
  const links = context.supportIndex.verses[verseKey] || [];
  const supplemental = [];
  for (const link of links) {
    const record = context.supportIndex.records[link.record_id];
    if (!record) continue;
    supplemental.push({
      id: link.record_id,
      relation: link.relation,
      scope: link.scope,
      title: record.title,
      source_file: record.source_file,
      references: record.references || []
    });
  }
  return supplemental;
}

function buildPrompt(chunkPacket, policy, feedback, packetPath) {
  const requiredLineIds = (policy.required_lines || []).map((line) => line.id);
  return [
    'Work only in this repository.',
    `Write commentary for ${chunkPacket.verses.length} Bible verses.`,
    `Return only JSON object with this shape: {"verses":{"chapter:verse":{"academic":"...","theological":"...","deep":"...","applied":"..."}}}.`,
    `Line IDs must be exactly: ${requiredLineIds.join(', ')}.`,
    `Each verse must have exactly four Arabic lines, each ${policy.limits.minimum_characters_per_line}-${policy.limits.maximum_characters_per_line} chars, total <= ${policy.limits.maximum_total_characters}.`,
    'Write every line in Arabic. Do not answer in English and do not include Hebrew or Greek transliterations unless the packet explicitly contains a verified linguistic source.',
    'Academic/theological/deep/applied lines must be specific to that exact verse and avoid repeated long wording.',
    `Read and use only this source packet file: ${packetPath}. Keep interpreter grounding exact.`,
    'Do not add typology, Christ/church connections, historical details, original-language meanings, or doctrinal claims unless explicitly supported by the packet source text for that verse.',
    `Verse keys (must all be present): ${chunkPacket.verses.map((item) => item.chapter_verse).join(', ')}`,
    feedback ? `Validator/global-feedback to fix:\n${feedback}` : '',
    'Read the packet file, but do not edit repository files. Return only the requested JSON in your response.'
  ].filter(Boolean).join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = options.workspaceRoot;

  const bible = readJson(path.join(root, 'bible.json'));
  const worklist = readJson(path.join(root, 'commentary-worklist.json'));
  const policy = readJson(path.join(root, 'commentary-quality-policy.json'));
  const primaryIndex = readJson(path.join(root, 'sources', 'commentaries', 'whole-bible', 'mhc-source-index.json'));
  const numbersIndex = readJson(path.join(root, 'sources', 'commentaries', 'numbers', 'source-index.json'));
  const supportIndex = readJson(path.join(root, 'commentary-support-index.json'));

  const bibleMap = buildBibleMap(bible);
  const { approved, phraseOwners } = loadExistingApproved(root);
  const approvedKeySet = new Set(approved.keys());

  const progressPath = path.join(root, 'sources', 'commentaries', 'approved', 'orchestration-progress.json');
  const reportPath = path.join(root, 'sources', 'commentaries', 'approved', 'orchestration-report.json');
  const previousProgress = fs.existsSync(progressPath) ? readJson(progressPath) : null;

  const pendingVerses = Object.entries(worklist.verses)
    .map(([key, value]) => ({ key, ...value }))
    .filter((row) => row.status !== 'approved_four_line_commentary' && !approvedKeySet.has(row.key))
    .sort(verseNumericSort);

  const context = { primaryIndex, numbersIndex, supportIndex };
  const report = {
    started_at: new Date().toISOString(),
    dry_run: options.dryRun,
    max_chunks: Number.isFinite(options.maxChunks) ? options.maxChunks : null,
    resumed_from_previous_progress: Boolean(previousProgress),
    completed_chunks: [],
    halted: false,
    halt_reason: null
  };

  let chunksProcessed = 0;
  const touchedBooks = new Set();
  let cursor = 0;

  while (cursor < pendingVerses.length && chunksProcessed < options.maxChunks) {
    const first = pendingVerses[cursor];
    const chunkRows = [first];
    cursor += 1;
    while (cursor < pendingVerses.length && chunkRows.length < CHUNK_SIZE && pendingVerses[cursor].book === first.book && pendingVerses[cursor].chapter === first.chapter) {
      chunkRows.push(pendingVerses[cursor]);
      cursor += 1;
    }

    const chunkNumber = (previousProgress?.processed_chunks || 0) + chunksProcessed + 1;
    const chunkId = `chunk-${String(chunkNumber).padStart(5, '0')}`;
    const bookDir = path.join(root, 'sources', 'commentaries', 'approved', first.book);
    const packetDir = path.join(bookDir, 'packets');
    const packet = {
      chunk_id: chunkId,
      book: first.book,
      generated_at: new Date().toISOString(),
      verses: chunkRows.map((row) => {
        const verseKey = `${row.book}:${row.chapter}:${row.verse}`;
        const chapterVerse = `${row.chapter}:${row.verse}`;
        const text = bibleMap.get(verseKey);
        if (!text) throw new Error(`Missing verse text in bible.json for ${verseKey}`);
        const primarySources = buildPrimarySourcesForVerse(context, row);
        const supplementalSources = buildSupplementalForVerse(context, verseKey);
        return {
          verse_key: verseKey,
          chapter_verse: chapterVerse,
          text,
          interpreter_names: buildSourceNamesFromPacket(primarySources),
          primary_sources: primarySources,
          supplemental_links: supplementalSources
        };
      })
    };
    const packetPath = path.join(packetDir, `${chunkId}-source-packet.json`);
    writeJson(packetPath, packet);

    if (options.dryRun) {
      report.completed_chunks.push({
        chunk_id: chunkId,
        book: first.book,
        status: 'dry_run_planned',
        verse_keys: packet.verses.map((item) => item.verse_key)
      });
      chunksProcessed += 1;
      writeJson(progressPath, {
        updated_at: new Date().toISOString(),
        processed_chunks: (previousProgress?.processed_chunks || 0) + chunksProcessed,
        dry_run: true,
        last_chunk: chunkId,
        halted: false
      });
      writeJson(reportPath, report);
      continue;
    }

    let attempt = 0;
    let approvedOutput = null;
    let attemptFeedback = '';
    let lastCandidateFile = null;
    while (attempt <= MAX_RETRIES && !approvedOutput) {
      const prompt = buildPrompt(packet, policy, attemptFeedback, path.relative(root, packetPath).replace(/\\/g, '/'));
      const modelResult = runCopilotChunk(options, prompt);
      if (!modelResult.ok) {
        if (modelResult.stopReason === 'invalid_model_json' && attempt < MAX_RETRIES) {
          attemptFeedback = 'Your previous response was not one complete valid JSON object. Return exactly one JSON object, with every requested verse key and no prose or markdown fences.';
          attempt += 1;
          continue;
        }
        report.halted = true;
        report.halt_reason = modelResult.stopReason;
        report.completed_chunks.push({
          chunk_id: chunkId,
          book: first.book,
          status: 'halted',
          attempt: attempt + 1,
          reason: modelResult.stopReason,
          details: modelResult.output.slice(0, 3000)
        });
        writeJson(progressPath, {
          updated_at: new Date().toISOString(),
          processed_chunks: (previousProgress?.processed_chunks || 0) + chunksProcessed,
          dry_run: false,
          last_chunk: chunkId,
          halted: true,
          halt_reason: modelResult.stopReason
        });
        writeJson(reportPath, report);
        console.error(`Stopped on ${chunkId}: ${modelResult.stopReason}`);
        return;
      }

      const versesPayload = modelResult.payload.verses || {};
      const chunkVerses = {};
      const phraseProblems = [];
      for (const versePacket of packet.verses) {
        const modelVerse = versesPayload[versePacket.chapter_verse] || versesPayload[versePacket.verse_key];
        if (!modelVerse) {
          phraseProblems.push(`${versePacket.chapter_verse}: missing response block`);
          continue;
        }
        const lines = modelVerse.explanation_lines || modelVerse;
        const entry = {
          reference: `${first.book} ${versePacket.chapter_verse}`,
          text: versePacket.text,
          summary: '',
          sources: flattenPrimarySources(versePacket.primary_sources),
          interpreter_names: versePacket.interpreter_names,
          supplemental_sources: versePacket.supplemental_links,
          status: 'approved_four_line_commentary',
          explanation_lines: {
            academic: String(lines.academic || '').trim(),
            theological: String(lines.theological || '').trim(),
            deep: String(lines.deep || '').trim(),
            applied: String(lines.applied || '').trim()
          }
        };
        chunkVerses[versePacket.chapter_verse] = entry;
      }

      const candidate = {
        book: first.book,
        chunk_id: chunkId,
        status: 'approved_four_line_commentary',
        verses: chunkVerses
      };
      const tempFile = path.join(bookDir, `${chunkId}-candidate.json`);
      lastCandidateFile = tempFile;
      writeJson(tempFile, candidate);
      const validation = validateChunkFile(options, tempFile);
      if (!validation.ok) phraseProblems.push(validation.output.slice(0, 4000));

      for (const [chapterVerse, entry] of Object.entries(candidate.verses)) {
        const verseKey = `${first.book}:${chapterVerse}`;
        for (const line of Object.values(entry.explanation_lines || {})) {
          for (const phrase of extractEightWordPhrases(line)) {
            const owners = phraseOwners.get(phrase);
            if (owners && !owners.has(verseKey)) {
              phraseProblems.push(`Repeated eight-word phrase with existing approved verse(s): ${phrase}`);
            }
          }
        }
      }

      if (!phraseProblems.length) {
        approvedOutput = candidate;
      } else {
        attemptFeedback = phraseProblems.join('\n');
        attempt += 1;
      }
      if (fs.existsSync(tempFile) && (approvedOutput || attempt <= MAX_RETRIES)) fs.unlinkSync(tempFile);
    }

    if (!approvedOutput) {
      report.halted = true;
      report.halt_reason = 'max_retries_exceeded';
      report.completed_chunks.push({
        chunk_id: chunkId,
        book: first.book,
        status: 'failed_after_retries',
        retries: MAX_RETRIES,
        validator_feedback: attemptFeedback.slice(0, 8000),
        candidate_file: lastCandidateFile ? path.relative(root, lastCandidateFile).replace(/\\/g, '/') : null
      });
      writeJson(progressPath, {
        updated_at: new Date().toISOString(),
        processed_chunks: (previousProgress?.processed_chunks || 0) + chunksProcessed,
        dry_run: false,
        last_chunk: chunkId,
        halted: true,
        halt_reason: 'max_retries_exceeded'
      });
      writeJson(reportPath, report);
      console.error(`Chunk ${chunkId} failed after retries. No approval written.`);
      return;
    }

    const outputFile = path.join(bookDir, `approved-${chunkId}.json`);
    writeJson(outputFile, approvedOutput);
    touchedBooks.add(first.book);
    for (const [chapterVerse, entry] of Object.entries(approvedOutput.verses)) {
      const verseKey = `${first.book}:${chapterVerse}`;
      approvedKeySet.add(verseKey);
      for (const line of Object.values(entry.explanation_lines || {})) {
        for (const phrase of extractEightWordPhrases(line)) {
          if (!phraseOwners.has(phrase)) phraseOwners.set(phrase, new Set());
          phraseOwners.get(phrase).add(verseKey);
        }
      }
    }

    report.completed_chunks.push({
      chunk_id: chunkId,
      book: first.book,
      status: 'approved',
      verses: Object.keys(approvedOutput.verses).length,
      output_file: path.relative(root, outputFile).replace(/\\/g, '/')
    });
    chunksProcessed += 1;
    for (const chapterVerse of Object.keys(approvedOutput.verses)) {
      const verseKey = `${first.book}:${chapterVerse}`;
      if (worklist.verses[verseKey]) {
        worklist.verses[verseKey].status = 'approved_four_line_commentary';
        worklist.verses[verseKey].approved_file = path.relative(root, outputFile).replace(/\\/g, '/');
      }
    }
    const bookRows = Object.values(worklist.verses).filter((verse) => verse.book === first.book);
    if (worklist.books[first.book]) {
      worklist.books[first.book].completed = bookRows.filter((verse) => verse.status === 'approved_four_line_commentary').length;
    }
    writeJson(path.join(root, 'commentary-worklist.json'), worklist);
    aggregateBookCommentary(options, first.book);
    writeJson(progressPath, {
      updated_at: new Date().toISOString(),
      processed_chunks: (previousProgress?.processed_chunks || 0) + chunksProcessed,
      dry_run: false,
      last_chunk: chunkId,
      halted: false
    });
    writeJson(reportPath, report);
  }

  for (const book of touchedBooks) aggregateBookCommentary(options, book);
  report.finished_at = new Date().toISOString();
  writeJson(reportPath, report);
  console.log(`Completed ${chunksProcessed} chunk(s). Halted=${report.halted}. Pending remaining=${Math.max(0, pendingVerses.length - cursor)}.`);
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
}
