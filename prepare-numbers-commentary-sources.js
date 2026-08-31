const fs = require('fs');
const https = require('https');
const path = require('path');
const { execFileSync } = require('child_process');

const outputDir = path.join('sources', 'commentaries', 'numbers');
fs.mkdirSync(outputDir, { recursive: true });

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'BibleEncyclopediaResearch/1.0' } }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        download(new URL(response.headers.location, url).toString(), destination).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`${url}: HTTP ${response.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    });
    request.on('error', reject);
  });
}

function extractJfb() {
  const source = fs.readFileSync(path.join('sources', 'commentaries', 'jfb.txt'), 'utf8');
  const start = source.indexOf('THE FOURTH BOOK OF MOSES, CALLED\n   NUMBERS.');
  const end = source.indexOf('THE FIFTH BOOK OF MOSES, CALLED\n   DEUTERONOMY.', start);
  if (start < 0 || end < 0) throw new Error('Unable to locate the Numbers boundaries in JFB');
  const text = source.slice(start, end).trim();
  fs.writeFileSync(path.join(outputDir, 'jfb-numbers.txt'), `${text}\n`, 'utf8');
  return text.length;
}

async function main() {
  const mhcEpub = path.join(outputDir, 'mhc1.epub');
  const mhcDir = path.join(outputDir, 'mhc1');
  const kdJson = path.join(outputDir, 'keil-delitzsch-numbers.json');

  await download('https://ccel.org/ccel/h/henry/mhc1/cache/mhc1.epub', mhcEpub);
  fs.rmSync(mhcDir, { recursive: true, force: true });
  fs.mkdirSync(mhcDir, { recursive: true });
  execFileSync('tar.exe', ['-xf', path.resolve(mhcEpub), '-C', path.resolve(mhcDir)]);

  const kdApi = 'https://en.wikisource.org/w/api.php?action=parse&page=Biblical_commentary_the_Old_Testament%2FVolume_I._The_Pentateuch%2FNumbers&prop=text%7Cwikitext&format=json&formatversion=2';
  await download(kdApi, kdJson);

  const jfbLength = extractJfb();
  const kd = JSON.parse(fs.readFileSync(kdJson, 'utf8'));
  if (!kd.parse?.text || !kd.parse?.wikitext) throw new Error('Incomplete Keil & Delitzsch API response');

  const manifest = {
    prepared_at: new Date().toISOString(),
    scope: 'Numbers',
    sources: [
      {
        id: 'jfb',
        work: 'Commentary Critical and Explanatory on the Whole Bible',
        authors: 'Robert Jamieson, A. R. Fausset, David Brown',
        source: 'https://ccel.org/ccel/j/jamieson/jfb/cache/jfb.txt',
        license: 'Public Domain',
        local_file: 'jfb-numbers.txt',
        characters: jfbLength
      },
      {
        id: 'matthew_henry',
        work: 'Commentary on the Whole Bible, Volume I',
        author: 'Matthew Henry',
        source: 'https://ccel.org/ccel/henry/mhc1.html',
        license: 'Public Domain',
        local_file: 'mhc1.epub'
      },
      {
        id: 'keil_delitzsch',
        work: 'Biblical Commentary on the Old Testament, Volume I: The Pentateuch',
        authors: 'C. F. Keil and F. Delitzsch',
        source: 'https://en.wikisource.org/wiki/Biblical_commentary_the_Old_Testament/Volume_I._The_Pentateuch/Numbers',
        license: 'Public Domain; Wikisource transcription available under CC BY-SA 4.0',
        local_file: 'keil-delitzsch-numbers.json'
      }
    ]
  };
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Prepared Numbers sources in ${outputDir}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});