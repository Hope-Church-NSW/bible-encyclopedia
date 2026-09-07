const promptIndex = process.argv.indexOf('-p');
const prompt = promptIndex >= 0 ? process.argv[promptIndex + 1] : '';
const packetMatch = prompt.match(/source packet file: ([^\s]+)\./);
if (!packetMatch) {
  console.error('Mock CLI could not locate packet path');
  process.exit(1);
}
const fs = require('fs');
const packet = JSON.parse(fs.readFileSync(packetMatch[1], 'utf8'));
const verses = {};
for (const item of packet.verses) {
  const marker = item.chapter_verse.replace(':', ' آية ');
  verses[item.chapter_verse] = {
    academic: `يعرض المرجع ${marker} سياقه الأكاديمي الخاص، ويربط المرجع ${marker} العبارة ببنيتها الأدبية وفق النص المرفق.`,
    theological: `يكشف المرجع ${marker} معناه اللاهوتي المنضبط، ويحفظ المرجع ${marker} شهادة المصدر دون إضافة غير موثقة.`,
    deep: `يتعمق المرجع ${marker} في وظيفته الخاصة، ويميز المرجع ${marker} دلالته عن الآيات المجاورة بوضوح.`,
    applied: `يوجه المرجع ${marker} القارئ إلى استجابته، ويمنع المرجع ${marker} تطبيقًا عامًا منفصلًا عن دلالته.`
  };
}
process.stdout.write(JSON.stringify({ verses }));