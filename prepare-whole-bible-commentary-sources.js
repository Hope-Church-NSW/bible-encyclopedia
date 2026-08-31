const fs = require('fs');
const https = require('https');
const path = require('path');
const { execFileSync } = require('child_process');

const outputDir = path.join('sources', 'commentaries', 'whole-bible');
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

async function main() {
  const volumes = [
    [1, 'Genesis to Deuteronomy'],
    [2, 'Joshua to Esther'],
    [3, 'Job to Song of Solomon'],
    [4, 'Isaiah to Malachi'],
    [5, 'Matthew to John'],
    [6, 'Acts to Revelation']
  ];
  const prepared = [];

  for (const [number, scope] of volumes) {
    const id = `mhc${number}`;
    const epub = path.join(outputDir, `${id}.epub`);
    const extracted = path.join(outputDir, id);
    const url = `https://ccel.org/ccel/h/henry/${id}/cache/${id}.epub`;
    await download(url, epub);
    fs.rmSync(extracted, { recursive: true, force: true });
    fs.mkdirSync(extracted, { recursive: true });
    execFileSync('tar.exe', ['-xf', path.resolve(epub), '-C', path.resolve(extracted)]);
    prepared.push({ id, scope, url, bytes: fs.statSync(epub).size });
  }

  const manifest = {
    prepared_at: new Date().toISOString(),
    scope: 'Whole Bible, 66 books',
    sources: [
      {
        id: 'matthew_henry',
        work: 'Commentary on the Whole Bible, Volumes I-VI',
        author: 'Matthew Henry',
        publisher: 'Christian Classics Ethereal Library, Calvin University',
        license: 'Public Domain',
        volumes: prepared
      },
      {
        id: 'jfb',
        work: 'Commentary Critical and Explanatory on the Whole Bible',
        authors: 'Robert Jamieson, A. R. Fausset, David Brown',
        source: 'https://ccel.org/ccel/j/jamieson/jfb/cache/jfb.txt',
        local_file: '../jfb.txt',
        license: 'Public Domain'
      },
      {
        id: 'barnes',
        work: "Barnes' New Testament Notes",
        author: 'Albert Barnes',
        local_module: '../Barnes',
        license: 'Public Domain',
        scope: 'New Testament'
      },
      {
        id: 'keil_delitzsch',
        work: 'Biblical Commentary on the Old Testament',
        authors: 'C. F. Keil and F. Delitzsch',
        local_module: '../KD',
        license: 'Public Domain',
        scope: 'Old Testament'
      }
    ]
  };
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Prepared ${prepared.length} Matthew Henry volumes in ${outputDir}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});