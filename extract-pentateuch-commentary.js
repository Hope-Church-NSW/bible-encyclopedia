const fs = require('fs');
const readline = require('readline');

const outputs = {
  '01-gen': 'commentary-genesis.json',
  '02-Exodus': 'commentary-exodus.json',
  '03-Leviticus': 'commentary-leviticus.json'
};
const streams = Object.fromEntries(
  Object.entries(outputs).map(([book, output]) => [book, fs.createWriteStream(output)])
);
const counts = Object.fromEntries(Object.keys(outputs).map(book => [book, 0]));

for (const stream of Object.values(streams)) {
  stream.write('{"verses":{');
}

let activeBook = null;
let record = [];
const input = readline.createInterface({
  input: fs.createReadStream('commentary.json', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

input.on('line', line => {
  if (!activeBook) {
    const match = line.match(/^    "(01-gen|02-Exodus|03-Leviticus):\d+:\d+": \{$/);
    if (match) {
      activeBook = match[1];
      record = [line.trimStart()];
    }
    return;
  }

  record.push(line);
  if (/^    }[,]?$/.test(line)) {
    const stream = streams[activeBook];
    if (counts[activeBook] > 0) stream.write(',');
    record[record.length - 1] = record[record.length - 1].replace(/,$/, '');
    stream.write(record.join('\n'));
    counts[activeBook] += 1;
    activeBook = null;
    record = [];
  }
});

input.on('close', () => {
  for (const [book, stream] of Object.entries(streams)) {
    stream.end('}}');
    console.log(`${outputs[book]}: ${counts[book]} verses`);
  }
});