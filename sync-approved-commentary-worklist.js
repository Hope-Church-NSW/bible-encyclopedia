const fs = require('fs');
const path = require('path');

const worklist = JSON.parse(fs.readFileSync('commentary-worklist.json', 'utf8'));
const directories = [path.join('sources', 'commentaries', 'numbers')];
let approvedCount = 0;

for (const directory of directories) {
  if (!fs.existsSync(directory)) continue;
  const files = fs.readdirSync(directory).filter(file => /^approved-.*\.json$/.test(file));
  for (const file of files) {
    const draft = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    for (const [reference, entry] of Object.entries(draft.verses || {})) {
      const key = `${draft.book}:${reference}`;
      const target = worklist.verses[key];
      if (!target) throw new Error(`Approved commentary has no Bible verse: ${key}`);
      if (!entry.explanation_lines || !entry.interpreter_names?.length) throw new Error(`Incomplete approved commentary: ${key}`);
      target.status = 'approved_four_line_commentary';
      target.approved_file = path.join(directory, file).replace(/\\/g, '/');
      approvedCount += 1;
    }
  }
}

for (const book of Object.keys(worklist.books)) {
  const rows = Object.values(worklist.verses).filter(verse => verse.book === book);
  worklist.books[book].completed = rows.filter(verse => verse.status === 'approved_four_line_commentary').length;
}
fs.writeFileSync('commentary-worklist.json', `${JSON.stringify(worklist, null, 2)}\n`, 'utf8');
console.log(`Approved commentary worklist entries: ${approvedCount}`);