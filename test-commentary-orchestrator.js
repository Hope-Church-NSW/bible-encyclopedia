const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'commentary-orchestrator-'));
const write = (file, value) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const policy = JSON.parse(fs.readFileSync('commentary-quality-policy.json', 'utf8'));
write('commentary-quality-policy.json', policy);
fs.copyFileSync('validate-commentary-quality.js', path.join(root, 'validate-commentary-quality.js'));
const verseNumbers = Array.from({ length: 9 }, (_, index) => index + 1);
write('bible.json', verseNumbers.map((verse) => ({
  book: '01-gen', chapter: 1, verse, text: `نص اختباري للآية ${verse}.`
})));
write('commentary-worklist.json', {
  books: { '01-gen': { verse_count: 9, completed: 0 } },
  verses: Object.fromEntries(verseNumbers.map((verse) => [
    `01-gen:1:${verse}`,
    { book: '01-gen', chapter: 1, verse, status: 'sources_ready_pending_four_line_commentary', primary_source_records: ['mhc:1'] }
  ]))
});
write('sources/commentaries/whole-bible/mhc-source-index.json', {
  records: { 'mhc:1': { source_id: 'matthew_henry', interpreter_name: 'متى هنري', locator: 'mock', book: '01-gen', chapter: 1, start_verse: 1, end_verse: 9, text: 'Mock source text for all verses.' } },
  verses: Object.fromEntries(verseNumbers.map((verse) => [`01-gen:1:${verse}`, ['mhc:1']]))
});
write('sources/commentaries/numbers/source-index.json', { verses: {} });
write('commentary-support-index.json', { records: {}, verses: {} });

const args = [
  'run-approved-commentary-orchestrator.js', '--workspace-root', root,
  '--mock-cli-loader', path.resolve('test-fixtures/mock-copilot-loader.js'), '--max-chunks', '1'
];
const result = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);
const approvedDir = path.join(root, 'sources', 'commentaries', 'approved', '01-gen');
const approvedFiles = fs.readdirSync(approvedDir).filter((file) => /^approved-.*\.json$/.test(file));
if (approvedFiles.length !== 1) throw new Error(`Expected one approved file, found ${approvedFiles.length}`);
const approved = JSON.parse(fs.readFileSync(path.join(approvedDir, approvedFiles[0]), 'utf8'));
if (Object.keys(approved.verses).length !== 9) throw new Error('Expected nine approved verses in one chunk');
const worklist = JSON.parse(fs.readFileSync(path.join(root, 'commentary-worklist.json'), 'utf8'));
if (Object.values(worklist.verses).some((verse) => verse.status !== 'approved_four_line_commentary')) throw new Error('Worklist was not synchronized');
const commentaryData = JSON.parse(fs.readFileSync(path.join(root, 'commentary-data', '01-gen.json'), 'utf8'));
if (Object.keys(commentaryData.verses || {}).length !== 9) throw new Error('Display data does not contain all nine approved verses');
const resume = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
if (resume.status !== 0) throw new Error(`${resume.stdout}\n${resume.stderr}`);
const resumedApprovedFiles = fs.readdirSync(approvedDir).filter((file) => /^approved-.*\.json$/.test(file));
if (resumedApprovedFiles.length !== 1) throw new Error('Resume generated duplicate approved output');
console.log('PASS: orchestrator mock generation, validation, progress, resume state, and aggregation');
fs.rmSync(root, { recursive: true, force: true });