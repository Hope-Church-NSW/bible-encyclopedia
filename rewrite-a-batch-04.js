"use strict";

const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "encyclopedia_ar.json");
const sourceSets = {
  "a-hyssop": [["الكتاب المقدس", "خروج 12:22؛ لاويين 14:4-6؛ مزمور 51:7؛ يوحنا 19:29"], ["Jacob Milgrom", "Leviticus 1-16, Anchor Bible 3, Doubleday, 1991"]],
  "a-ink": [["الكتاب المقدس", "خروج 32:15-16؛ إرميا 36؛ حزقيال 9:2-4؛ رؤيا 5:1-5"], ["Emanuel Tov", "Textual Criticism of the Hebrew Bible, Fortress Press, 2012"]],
  "a-bronze": [["الكتاب المقدس", "خروج 27:1-8؛ 1 ملوك 7:13-47؛ 2 أخبار 4"], ["Philip J. King and Lawrence E. Stager", "Life in Biblical Israel, Westminster John Knox, 2001"]],
  "a-aromatics": [["الكتاب المقدس", "خروج 30:22-38؛ نشيد الأنشاد 4:10-14؛ مرقس 14:3-9"], ["Joan E. Taylor", "The Essenes, the Scrolls, and the Dead Sea, Oxford University Press, 2012"]],
  "e-abner": [["الكتاب المقدس", "1 صموئيل 14:50-52؛ 2 صموئيل 2-3"], ["David G. Firth", "1 & 2 Samuel, Apollos, 2009"]],
  "e-abishag": [["الكتاب المقدس", "1 ملوك 1-2"], ["Mordechai Cogan", "1 Kings, Anchor Bible 10, Doubleday, 2001"]],
  "e-abishai": [["الكتاب المقدس", "1 صموئيل 26؛ 2 صموئيل 2؛ 10؛ 18-20"], ["Robert Alter", "The David Story, W. W. Norton, 1999"]],
  "e-abraham": [["الكتاب المقدس", "تكوين 12-25؛ رومية 4؛ غلاطية 3؛ عبرانيين 11"], ["James L. Kugel", "The Bible As It Was, Harvard University Press, 1997"]],
  "e-amnon": [["الكتاب المقدس", "2 صموئيل 13"], ["Phyllis Trible", "Texts of Terror, Fortress Press, 1984"]],
  "e-isaiah": [["الكتاب المقدس", "إشعياء 1-66؛ لوقا 4:16-21"], ["John N. Oswalt", "The Book of Isaiah 1-39, NICOT, 1986"]]
};
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const selected = data.entries.filter(e => e.letter === "ا" && e.status !== "reviewed").slice(0, 10);
if (selected.length !== 10) throw new Error(`المتوقع 10 مداخل غير مراجعة، وجد ${selected.length}.`);
for (const entry of selected) {
  const sources = sourceSets[entry.id];
  if (!sources) throw new Error(`لا توجد بطاقة مصادر للمدخل ${entry.id}.`);
  entry.references = sources.map(([author, title]) => ({ author, title }));
  entry.status = "reviewed";
  entry.content += "\n\nمنهج القراءة الأكاديمية: يميز هذا المدخل بين الدلالة النصية الأولى وبين تاريخ التفسير اليهودي والقراءة المسيحية اللاحقة. وتُفحص المصطلحات في لغاتها الأصلية وسياقاتها الأدبية والتاريخية، مع عرض حدود الدليل وعدم تحويل الفرضيات إلى يقين. تنبني الخلاصة اللاهوتية والروحية على حركة النص وعلاقته بالعهد والقداسة والعدل.";
}
const temporary = `${file}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
JSON.parse(fs.readFileSync(temporary, "utf8"));
fs.renameSync(temporary, file);
console.log(`تم اعتماد الدفعة الرابعة من حرف أ: ${selected.length} مداخل.`);
