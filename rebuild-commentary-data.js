const fs = require('fs');
const path = require('path');
const { aggregateBookCommentary } = require('./run-approved-commentary-orchestrator');

const approvedRoot = path.join(process.cwd(), 'sources', 'commentaries', 'approved');
const requestedBooks = process.argv.slice(2);
const books = requestedBooks.length
  ? requestedBooks
  : fs.readdirSync(approvedRoot)
    .filter((name) => fs.statSync(path.join(approvedRoot, name)).isDirectory())
    .sort();

for (const book of books) aggregateBookCommentary({ workspaceRoot: process.cwd() }, book);

console.log(`Rebuilt commentary display data for ${books.length} book(s): ${books.join(', ')}`);