const fs = require('fs');

const policy = JSON.parse(fs.readFileSync('commentary-quality-policy.json', 'utf8'));
const file = process.argv[2];
if (!file) throw new Error('Usage: node validate-commentary-quality.js <draft.json>');

const draft = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = Object.entries(draft.verses || {});
const problems = [];
const phraseOwners = new Map();

for (const [key, entry] of entries) {
  const lines = entry.explanation_lines;
  if (!lines || typeof lines !== 'object') {
    problems.push(`${key}: requires expansion to the four-line schema`);
    continue;
  }

  const ordered = policy.required_lines.map(line => String(lines[line.id] || '').trim());
  if (ordered.some(line => !line)) problems.push(`${key}: one or more required lines are missing`);
  if (ordered.length !== policy.limits.exact_line_count) problems.push(`${key}: invalid line count`);
  for (let index = 0; index < ordered.length; index += 1) {
    const line = ordered[index];
    if (line.length < policy.limits.minimum_characters_per_line) problems.push(`${key}: line ${index + 1} is too short`);
    if (line.length > policy.limits.maximum_characters_per_line) problems.push(`${key}: line ${index + 1} is too long`);
    const letters = line.match(/[\p{L}]/gu) || [];
    const arabicLetters = line.match(/[\p{Script=Arabic}]/gu) || [];
    if (!letters.length || arabicLetters.length / letters.length < 0.72) problems.push(`${key}: line ${index + 1} must be written in Arabic`);
    const words = line.replace(/[\p{P}\p{M}]/gu, '').split(/\s+/).filter(Boolean);
    for (let offset = 0; offset <= words.length - 8; offset += 1) {
      const phrase = words.slice(offset, offset + 8).join(' ');
      phraseOwners.set(phrase, new Set([...(phraseOwners.get(phrase) || []), key]));
    }
  }
  if (ordered.join(' ').length > policy.limits.maximum_total_characters) problems.push(`${key}: explanation exceeds total limit`);
  if (!entry.sources?.length || entry.sources.some(source => !source.locators?.length)) problems.push(`${key}: missing traceable primary source`);
  if (!entry.interpreter_names?.length || entry.interpreter_names.length !== entry.sources.length) problems.push(`${key}: interpreter names do not match primary sources`);
  if (/الأصل اللغوي|العبرية|اليونانية/.test(ordered.join(' ')) && !entry.language_source) problems.push(`${key}: unsupported language claim`);
}

for (const [phrase, owners] of phraseOwners) {
  if (owners.size > 1) problems.push(`Repeated eight-word phrase in ${[...owners].join(', ')}: ${phrase}`);
}

if (problems.length) {
  console.error(problems.slice(0, 100).join('\n'));
  console.error(`Rejected: ${problems.length} quality problem(s)`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${entries.length} verses meet the four-line commentary standard`);
}