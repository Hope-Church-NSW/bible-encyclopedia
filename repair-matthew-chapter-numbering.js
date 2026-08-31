const fs = require('fs');

const file = 'bible.json';
const bible = JSON.parse(fs.readFileSync(file, 'utf8'));
const matthew = bible.filter(verse => verse.book === '40-Matthew');
const maximumChapter = Math.max(...matthew.map(verse => Number(verse.chapter)));

if (maximumChapter === 28) {
  console.log('Matthew chapter numbering is already repaired');
  process.exit(0);
}
if (maximumChapter !== 29) throw new Error(`Unexpected Matthew maximum chapter: ${maximumChapter}`);

const splitStart = matthew.find(verse => Number(verse.chapter) === 21 && Number(verse.verse) === 31);
const splitEnd = matthew.find(verse => Number(verse.chapter) === 22 && Number(verse.verse) === 1);
if (!splitStart?.text.includes('فَأَيُّ الاثْنَيْنِ عَمِلَ إِرَادَةَ الأَبِ')) throw new Error('Matthew 21:31 split start was not recognized');
if (!splitEnd?.text.includes('قَالُوا لَهُ') || !splitEnd.text.includes('الْعَشَّارِينَ وَالزَّوَانِيَ')) throw new Error('Matthew 21:31 split end was not recognized');

splitStart.text = `${splitStart.text} ${splitEnd.text}`;
const splitEndIndex = bible.indexOf(splitEnd);
bible.splice(splitEndIndex, 1);

for (const verse of bible) {
  if (verse.book !== '40-Matthew') continue;
  const chapter = Number(verse.chapter);
  if (chapter === 22) verse.chapter = 21;
  else if (chapter >= 23 && chapter <= 29) verse.chapter = chapter - 1;
}

const repairedMatthew = bible.filter(verse => verse.book === '40-Matthew');
const keys = repairedMatthew.map(verse => `${verse.chapter}:${verse.verse}`);
if (new Set(keys).size !== keys.length) throw new Error('Repair produced duplicate Matthew verse keys');
if (Math.max(...repairedMatthew.map(verse => Number(verse.chapter))) !== 28) throw new Error('Repair did not restore 28 Matthew chapters');
if (repairedMatthew.length !== 1070) throw new Error(`Unexpected repaired Matthew verse count: ${repairedMatthew.length}`);
if (!repairedMatthew.find(verse => Number(verse.chapter) === 28 && Number(verse.verse) === 20)?.text.includes('وَهَا أَنَا مَعَكُمْ')) throw new Error('Matthew 28:20 was not restored');

const temporaryFile = `${file}.repairing`;
fs.writeFileSync(temporaryFile, JSON.stringify(bible), 'utf8');
fs.renameSync(temporaryFile, file);
console.log('Repaired Matthew: merged 21:31 and restored chapters 22-28');