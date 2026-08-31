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
for (const [index, item] of packet.verses.entries()) {
  const marker = item.chapter_verse.replace(':', ' آية ');
  verses[item.chapter_verse] = index % 2 === 0 ? {
    academic: `يعرض السياق الأكاديمي للمرجع ${marker} افتتاح الوحدة ويربط العبارة الأولى بالبنية الأدبية التي تليها وفق النص المرفق.`,
    theological: `يكشف المعنى اللاهوتي في المرجع ${marker} أولوية فعل الله ويضبط قراءة الحدث داخل شهادة المصدر المحدد دون توسع.`,
    deep: `يتعمق شرح المرجع ${marker} في وظيفة البداية بوصفها أساس الحركة اللاحقة، مع حفظ خصوصية ألفاظ هذا الموضع وحدوده.`,
    applied: `يوجه المرجع ${marker} القارئ إلى ترتيب رؤيته ومسؤوليته انطلاقًا من دلالة الافتتاح، لا من استنتاج عام منفصل عنها.`
  } : {
    academic: `يضع التحليل الأكاديمي للمرجع ${marker} الوصف التالي داخل تتابع السرد، مبرزًا حالة المشهد قبل انتقال النص إلى الفعل.`,
    theological: `يبين البعد اللاهوتي للمرجع ${marker} حضور الله إزاء الاضطراب الموصوف، من غير تحويل الصمت السردي إلى معلومات زائدة.`,
    deep: `تفصيل المرجع ${marker} يميز بين حالة المكان وما سيحدث بعدها، ولذلك يؤدي دورًا بنيويًا لا يكرره السطر السابق في الوحدة.`,
    applied: `يدعو المرجع ${marker} إلى وصف الواقع بأمانة قبل اتخاذ الموقف، مع انتظار المعنى الذي يكشفه السياق بدل فرض إجابة جاهزة.`
  };
}
process.stdout.write(JSON.stringify({ verses }));