const fs = require('fs');

const support = JSON.parse(fs.readFileSync('commentary-support-index.json', 'utf8'));
const encyclopedia = JSON.parse(fs.readFileSync('encyclopedia_ar.json', 'utf8'));
const categories = new Map(
  encyclopedia.entries.map(entry => [`encyclopedia:${entry.id}`, entry.category || ''])
);
const geographyCategory = /أماكن|مكان|أنهار|نهر|جغراف|مدن|بلاد|ممالك|مناطق|جبال|وديان|آبار|بحار/;
const riverMaps = {
  pishon: 'eden', gihon: 'eden', tigris: 'mesopotamia', euphrates: 'mesopotamia',
  jordan: 'levant', arnon: 'levant', jabbok: 'levant', zered: 'levant', nile: 'egypt',
  kishon: 'levant', cherith: 'levant', besor: 'levant', abana: 'levant', parpar: 'levant',
  khabur: 'mesopotamia', chebar: 'mesopotamia'
};

function compactText(value) {
  return String(value || '').replace(/\r/g, '').replace(/\n\s*\n+/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function geographyText(record) {
  const content = compactText(record.content);
  return content.match(/(?:المكان والسياق|الموضع الكتابي)\s*:\s*([^\n]+)/)?.[1] || content;
}

const records = {};
for (const [id, record] of Object.entries(support.records)) {
  const isRiver = record.type === 'river';
  const isPlace = record.type === 'encyclopedia' && geographyCategory.test(categories.get(id) || '');
  if (!isRiver && !isPlace) continue;
  const riverId = isRiver ? id.split(':')[1] : '';
  records[id] = {
    type: isRiver ? 'river' : 'place',
    title: record.title,
    content: geographyText(record),
    certainty: record.certainty || '',
    map: riverMaps[riverId] || '',
    source_file: record.source_file
  };
}

const verses = {};
for (const [verseKey, links] of Object.entries(support.verses)) {
  const ids = [...new Set(links.map(link => link.record_id).filter(id => records[id]))];
  if (ids.length) verses[verseKey] = ids;
}

const output = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  policy: 'Only study records linked by explicit biblical references are included.',
  records,
  verses
};

fs.writeFileSync('verse-geography.json', `${JSON.stringify(output)}\n`, 'utf8');
console.log(`Built ${Object.keys(records).length} geography records linked to ${Object.keys(verses).length} verses.`);