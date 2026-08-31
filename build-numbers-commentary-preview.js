const fs = require('fs');

const draft = JSON.parse(fs.readFileSync('sources/commentaries/numbers/draft-book.json', 'utf8'));
const approvedFiles = fs.readdirSync('sources/commentaries/numbers').filter(file => /^approved-.*\.json$/.test(file));
const approved = {};
for (const file of approvedFiles) {
  Object.assign(approved, JSON.parse(fs.readFileSync(`sources/commentaries/numbers/${file}`, 'utf8')).verses);
}
const sourceNames = {
  matthew_henry: 'متى هنري',
  jfb: 'جاميسون وفوست وبراون',
  keil_delitzsch: 'كايل ودليتش'
};
const verses = {};

for (const [key, entry] of Object.entries(draft.verses)) {
  const approvedEntry = approved[key];
  const interpreterNames = entry.sources.map(source => sourceNames[source.id] || source.id);
  const supplemental = entry.supplemental_sources || [];
  const notes = [
    `مصادر التفسير: ${interpreterNames.join('، ')}.`,
    supplemental.length ? `مواد مساندة مرتبطة بالآية: ${supplemental.map(source => source.title).join('، ')}.` : '',
    'حالة المادة: ملخص بحثي سابق يحتاج إعادة صياغة وفق معيار الشرح الأكاديمي واللاهوتي والعميق والتطبيقي في أربعة أسطر.'
  ].filter(Boolean).join('\n\n');

  verses[`04-Numbers:${key}`] = {
    reference: {
      book: '04-Numbers',
      chapter: Number(key.split(':')[0]),
      verse: Number(key.split(':')[1]),
      book_name: 'العدد'
    },
    text: entry.text,
    commentators: {
      academic_synthesis: {
        explanation_lines: approvedEntry?.explanation_lines,
        interpreter_names: approvedEntry?.interpreter_names || [],
        summary: approvedEntry ? '' : entry.summary,
        interpretation: approvedEntry ? '' : notes,
        theological_emphasis: ''
      }
    },
    references: entry.sources.flatMap(source => source.locators.map(locator => ({
      source: sourceNames[source.id] || source.id,
      locator
    }))),
    status: approvedEntry
      ? { completed: true, reviewed: true, sources_verified: true, preview: false }
      : { completed: false, reviewed: true, sources_verified: true, preview: true }
  };
}

fs.writeFileSync('commentary-numbers-preview.json', `${JSON.stringify({ verses }, null, 2)}\n`, 'utf8');
console.log(`Numbers preview built: ${Object.keys(verses).length} verses; ${Object.keys(approved).length} approved`);