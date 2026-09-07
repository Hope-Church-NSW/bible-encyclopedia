const fs = require('fs');
const path = require('path');

const root = __dirname;
const sourceFile = path.join(root, 'sources', 'commentaries', 'whole-bible', 'mhc-source-index.json');
const outputDirectory = path.join(root, 'commentary-data-en');
const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const books = new Map();

for (const [verseKey, recordIds] of Object.entries(source.verses || {})) {
    const book = verseKey.split(':')[0];
    if (!books.has(book)) books.set(book, { records: {}, verses: {} });
    const output = books.get(book);
    output.verses[verseKey] = recordIds;
    for (const recordId of recordIds) {
        const record = source.records[recordId];
        if (!record) throw new Error(`Missing source record ${recordId} for ${verseKey}`);
        output.records[recordId] = {
            source_id: record.source_id,
            locator: record.locator,
            text: record.text
        };
    }
}

fs.mkdirSync(outputDirectory, { recursive: true });
for (const [book, data] of books) {
    fs.writeFileSync(
        path.join(outputDirectory, `${book}.json`),
        `${JSON.stringify({ schema_version: 1, language: 'en', ...data })}\n`,
        'utf8'
    );
}

const verseCount = [...books.values()].reduce((total, book) => total + Object.keys(book.verses).length, 0);
if (verseCount !== 31104) throw new Error(`Expected 31104 covered verses, received ${verseCount}`);
console.log(JSON.stringify({ books: books.size, verses: verseCount }));