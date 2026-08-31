const fs = require('fs');

const file = 'bible.json';
const bible = JSON.parse(fs.readFileSync(file, 'utf8'));
const alreadyMerged = bible.filter(verse => verse.book === '61-2pet');
if (alreadyMerged.length !== 61) throw new Error('The canonical bible.json must contain all 61 verses of 2 Peter');

bible.sort((left, right) => {
  const bookDifference = Number(left.book.split('-')[0]) - Number(right.book.split('-')[0]);
  return bookDifference || Number(left.chapter) - Number(right.chapter) || Number(left.verse) - Number(right.verse);
});

const keys = bible.map(verse => `${verse.book}:${verse.chapter}:${verse.verse}`);
if (new Set(keys).size !== keys.length) throw new Error('Unified Bible contains duplicate verse keys');
if (new Set(bible.map(verse => verse.book)).size !== 66) throw new Error('Unified Bible does not contain 66 books');
const mergedSecondPeter = bible.filter(verse => verse.book === '61-2pet');
if (mergedSecondPeter.length !== 61 || !mergedSecondPeter.find(verse => Number(verse.chapter) === 3 && Number(verse.verse) === 18)) {
  throw new Error('Unified 2 Peter coverage is incomplete');
}

const temporaryFile = `${file}.unifying`;
fs.writeFileSync(temporaryFile, JSON.stringify(bible), 'utf8');
fs.renameSync(temporaryFile, file);
console.log(`Unified Bible validated: ${bible.length} verses, 66 books, 2 Peter included`);