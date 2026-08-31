const fs = require('fs');
const path = require('path');

const sourceDir = path.join('sources', 'commentaries', 'numbers');
const sourceIndex = JSON.parse(fs.readFileSync(path.join(sourceDir, 'source-index.json'), 'utf8')).verses;
const supportIndex = JSON.parse(fs.readFileSync('commentary-support-index.json', 'utf8'));
const bible = JSON.parse(fs.readFileSync('bible.json', 'utf8'));
const chapter = bible.filter(verse => verse.book === '04-Numbers' && Number(verse.chapter) === 2);
const interpreterNames = {
  matthew_henry: 'متى هنري',
  jfb: 'جاميسون وفوست وبراون',
  keil_delitzsch: 'كايل ودليتش'
};

const summaries = {
  1: 'يفتتح الإصحاح بخطاب من الرب إلى موسى وهارون معًا، فيربط ترتيب المحلة بالسلطان الإلهي الذي وجّه الإحصاء السابق. التنظيم الآتي ليس اقتراحًا عسكريًا منفصلًا، بل أمر يُنفذ داخل حياة جماعة العهد.',
  2: 'يُعطى لكل إسرائيلي موضع عند راية سبطه وعلامة بيت آبائه، بينما تحيط المحلات بخيمة الاجتماع على مسافة تحفظ حرمة المركز. يجمع الترتيب بين هوية العائلة ووحدة الشعب حول حضور الله دون إذابة أحدهما في الآخر.',
  3: 'تحتل محلة يهوذا جهة الشرق ويتقدمها نحشون بن عميناداب. يحدد النص الاتجاه والراية والرئيس معًا، فيجعل يهوذا نقطة البداية في ترتيب المحلات والأجناد المحيطة بالمسكن.',
  4: 'يسجل النص قوة جند يهوذا بأربعة وسبعين ألفًا وست مئة، وهو العدد المثبت في الإحصاء السابق. هنا لا يعاد الرقم لمجرد التكرار، بل لبيان حجم الوحدة التي ستقود الارتحال الأول.',
  5: 'ينزل سبط يساكر إلى جوار يهوذا، ويظل نثنائيل بن صوغر رئيسه المعروف من الإحصاء. بذلك تتكون المحلة من أسباط متجاورة تحت راية رئيسية مع احتفاظ كل سبط بقيادته.',
  6: 'يبلغ جند يساكر أربعة وخمسين ألفًا وأربع مئة. إدراج العدد داخل وصف المحلة يسمح بحساب قوتها المجتمعة، ولا يجعل يساكر مجرد تابع بلا سجل مستقل.',
  7: 'ينضم زبولون إلى المجموعة الشرقية تحت رئاسة أليآب بن حيلون. تكمل إضافته الأسباط الثلاثة التابعة لراية محلة يهوذا قبل إعلان مجموعها وترتيب مسيرها.',
  8: 'كان المعدودون في جند زبولون سبعة وخمسين ألفًا وأربع مئة. يحفظ النص عدده الخاص داخل التحالف الشرقي، فيظهر أن الوحدة الأكبر مبنية من وحدات قبلية معلومة.',
  9: 'يبلغ مجموع محلة يهوذا مئة وستة وثمانين ألفًا وأربع مئة، وتُكلّف بالارتحال أولًا. الأولوية هنا وظيفة داخل نظام المسير، والنص لا يحولها في هذه الآية إلى امتياز يسمح بإهمال بقية المحلات.',
  10: 'تُوضع راية محلة رأوبين في جهة الجنوب، ويرأس رأوبين أليصور بن شديئور. بعد تحديد مقدمة الشرق يبدأ النص الجناح التالي، محافظًا على اتصال القيادة بالترتيب القبلي.',
  11: 'عدد جند رأوبين ستة وأربعون ألفًا وخمس مئة. يعيد السجل الرقم داخل موضعه الجديد ليبيّن القوة التي تبدأ بها المحلة الجنوبية قبل إضافة السبطين المصاحبين.',
  12: 'ينزل شمعون إلى جوار رأوبين تحت رئاسة شلوميئيل بن صوريشداي. تحدد الآية الشراكة المكانية والقيادة، فتجعل قرب الأسباط جزءًا من ترتيب معلوم لا تجمعًا عارضًا.',
  13: 'يضم جند شمعون تسعة وخمسين ألفًا وثلاث مئة من المعدودين. يظل هذا العدد مميزًا داخل محلة رأوبين لكي يمكن فهم مجموعها النهائي وتركيبها.',
  14: 'جاد هو السبط الثالث في المحلة الجنوبية، ورئيسه ألياساف بن رعوئيل بحسب نص هذه الآية. لا ينبغي تغيير الاسم لتسوية اختلافات النسخ أو المواضع دون دراسة نصية مستقلة.',
  15: 'بلغ جند جاد خمسة وأربعين ألفًا وست مئة وخمسين. يضيف الرقم القوة الثالثة إلى محلة الجنوب ويحتفظ بالدقة العددية التي بدأ بها السفر.',
  16: 'يصل مجموع محلة رأوبين إلى مئة وواحد وخمسين ألفًا وأربع مئة وخمسين، وتتحرك في المرتبة الثانية. يربط النص بين العدد وموقع الوحدة في المسيرة مع إبقاء القيادة الأولى لمحلة يهوذا.',
  17: 'تتحرك خيمة الاجتماع ومحلة اللاويين في وسط المحلات، ويظل ترتيب المسير مطابقًا لترتيب النزول. وجود المسكن في الوسط يجعل العبادة والحضور مركز البنية المتحركة، لا ملحقًا في مقدمتها أو مؤخرتها.',
  18: 'تقام راية محلة أفرايم في الغرب، ويرأس السبط أليشمع بن عميهود. يفتتح هذا التحديد النصف الثالث من ترتيب المحلة في الجهة المقابلة ليهوذا.',
  19: 'كان جند أفرايم أربعين ألفًا وخمس مئة. يسجل العدد بداية قوة المجموعة الغربية، التي ستضم أيضًا منسى وبنيامين في وحدة واحدة.',
  20: 'ينزل منسى مع أفرايم ويرأسه جمليئيل بن فدهصور. اجتماع سبطي يوسف في المحلة نفسها يحفظ قرابتهما، مع بقاء لكل منهما رئيس وعدد مستقلان.',
  21: 'بلغ المعدودون من جند منسى اثنين وثلاثين ألفًا ومئتين. يضاف هذا الرقم إلى أفرايم قبل اكتمال المحلة ببنيامين، فلا تضيع مساهمة السبط الأصغر داخل الإجمالي.',
  22: 'يكتمل الجانب الغربي بانضمام بنيامين ورئيسه أبيدن بن جدعوني. يضعه النص مع سبطي يوسف في ترتيب محدد دون أن يلغي هويته بوصفه سبطًا مستقلًا.',
  23: 'عدد جند بنيامين خمسة وثلاثون ألفًا وأربع مئة. بإثبات هذه الحصيلة تصبح العناصر العددية الثلاثة لمحلة أفرايم جاهزة للجمع في الآية التالية.',
  24: 'مجموع محلة أفرايم مئة وثمانية آلاف ومئة، وتتحرك ثالثة بعد المسكن والمجموعة الجنوبية بحسب ترتيب العرض. يوضح النص موقعها في المسير بدل ترك حركة هذا العدد الكبير للمصادفة.',
  25: 'تكون راية محلة دان في الشمال، ورئيس دان أخيعزر بن عميشداي. تبدأ بها المجموعة الرابعة التي ستؤدي وظيفة المؤخرة في حركة الشعب.',
  26: 'بلغ جند دان اثنين وستين ألفًا وسبع مئة، وهو أساس القوة العددية للمحلة الشمالية. يسجل النص العدد قبل ذكر السبطين المصاحبين لكي تبقى بنية المجموعة قابلة للتتبع.',
  27: 'ينزل أشير إلى جوار دان تحت قيادة فجعيئيل بن عكرن. يواصل الترتيب نمط المحلات السابقة: سبط رئيسي ومعه سبطان، لكل واحد منهما رئيس معروف.',
  28: 'كان المعدودون من جند أشير واحدًا وأربعين ألفًا وخمس مئة. يثبت الرقم موقع السبط داخل إجمالي المحلة الشمالية من غير أن يخلط عدده بعدد دان.',
  29: 'نفتالي هو السبط الثالث مع دان، ويرأسه أخيرع بن عينن. باكتمال هذه القيادة يكتمل توزيع الأسباط الاثني عشر على الجهات الأربع حول خيمة الاجتماع.',
  30: 'يبلغ جند نفتالي ثلاثة وخمسين ألفًا وأربع مئة. وهذه آخر حصيلة قبل إعلان مجموع المحلة الأخيرة وتعيين مكانها في خط الارتحال.',
  31: 'مجموع محلة دان مئة وسبعة وخمسون ألفًا وست مئة، وتتحرك أخيرًا براياتها. وظيفة المؤخرة تكمل حماية نظام المسير، ولا تعني أن أسباط الشمال بلا قيمة داخل الجماعة.',
  32: 'يجمع النص أعداد المحلات كلها في ست مئة وثلاثة آلاف وخمس مئة وخمسين بحسب بيوت الآباء. يطابق الإجمالي نتيجة الإحصاء السابق، مما يصل التسجيل العددي مباشرة بتوزيع الشعب في المحلات.',
  33: 'يبقى اللاويون خارج تعداد أجناد بني إسرائيل تنفيذًا لأمر الرب إلى موسى. وجودهم في وسط المحلات لا يغيّر تخصيصهم لخدمة المسكن بدل إدراجهم في القوات القبلية.',
  34: 'نفذ بنو إسرائيل الأمر في نزولهم وارتحالهم، كل بحسب رايته وعشيرته وبيت آبائه. تختم الطاعة الإصحاح، فتظهر أن النظام المكتوب صار ممارسة جماعية في السكن والحركة.'
};

function supplementalSources(bibleKey) {
  const priority = { direct: 0, geography: 1, character: 2, messianic: 3, background: 4, encyclopedia: 5 };
  return (supportIndex.verses[bibleKey] || [])
    .filter(link => link.scope === 'verse_or_passage')
    .sort((left, right) => (priority[left.relation] ?? 9) - (priority[right.relation] ?? 9))
    .slice(0, 6)
    .map(link => ({
      record_id: link.record_id,
      relation: link.relation,
      title: supportIndex.records[link.record_id].title,
      source_file: supportIndex.records[link.record_id].source_file
    }));
}

const drafts = {};
for (const verse of chapter) {
  const key = `2:${verse.verse}`;
  const indexed = sourceIndex[key];
  if (!summaries[verse.verse] || !indexed) throw new Error(`Missing draft or source index for Numbers ${key}`);
  drafts[key] = {
    reference: `العدد ${key}`,
    text: verse.text,
    summary: summaries[verse.verse],
    sources: Object.entries(indexed.sources).map(([id, records]) => ({
      id,
      locators: records.map(record => record.locator),
      ranges: records.map(record => record.range)
    })),
    interpreter_names: Object.keys(indexed.sources).map(id => interpreterNames[id] || id),
    supplemental_sources: supplementalSources(`04-Numbers:${key}`),
    status: 'research_draft'
  };
}

const problems = [];
if (chapter.length !== 34 || Object.keys(drafts).length !== 34) problems.push('Expected 34 verses');
const entries = Object.entries(drafts);
const normalized = entries.map(([, entry]) => entry.summary.replace(/[\s\p{P}]+/gu, ' ').trim());
if (new Set(normalized).size !== normalized.length) problems.push('Duplicate summaries');
for (const [key, entry] of entries) {
  if (entry.summary.length < 100) problems.push(`${key}: summary is too short`);
  if (!entry.sources.length) problems.push(`${key}: no primary source`);
  if (entry.sources.some(source => source.locators.some(locator => !locator))) problems.push(`${key}: missing source locator`);
  if (entry.supplemental_sources.length > 6) problems.push(`${key}: too many supplemental sources`);
  if (/الأصل اللغوي|العبرية|اليونانية/.test(entry.summary)) problems.push(`${key}: unreviewed language claim`);
}

const repeatedPhrases = new Map();
for (const [key, entry] of entries) {
  const words = entry.summary.replace(/[\p{P}\p{M}]/gu, '').split(/\s+/).filter(Boolean);
  for (let index = 0; index <= words.length - 7; index += 1) {
    const phrase = words.slice(index, index + 7).join(' ');
    repeatedPhrases.set(phrase, [...(repeatedPhrases.get(phrase) || []), key]);
  }
}
for (const [phrase, keys] of repeatedPhrases) if (new Set(keys).size > 1) problems.push(`Repeated phrase in ${[...new Set(keys)].join(', ')}: ${phrase}`);

for (let left = 0; left < entries.length; left += 1) {
  for (let right = left + 1; right < entries.length; right += 1) {
    const leftWords = new Set(normalized[left].split(' '));
    const rightWords = new Set(normalized[right].split(' '));
    const overlap = [...leftWords].filter(word => rightWords.has(word)).length;
    const similarity = overlap / (leftWords.size + rightWords.size - overlap);
    if (similarity >= 0.55) problems.push(`High similarity ${entries[left][0]}/${entries[right][0]}: ${similarity.toFixed(2)}`);
  }
}
if (problems.length) throw new Error(problems.join('\n'));

const output = {
  book: '04-Numbers',
  chapter: 2,
  status: 'research_draft',
  generated_from: ['sources/commentaries/numbers/source-index.json', 'commentary-support-index.json'],
  verses: drafts
};
fs.writeFileSync(path.join(sourceDir, 'draft-chapter-02.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Numbers 2 draft validated: ${entries.length} unique verse summaries`);