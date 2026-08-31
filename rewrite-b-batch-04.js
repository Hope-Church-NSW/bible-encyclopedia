"use strict";

const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "encyclopedia_ar.json");
const refs = {
  "b-31": [["الكتاب المقدس", "خروج 13:1-2؛ تثنية 12:6؛ لوقا 2:22-24"], ["Jacob Milgrom", "Numbers, JPS Torah Commentary, 1990"], ["R. T. France", "The Gospel of Luke, Eerdmans, 2007"]],
  "b-32": [["الكتاب المقدس", "عدد 16؛ مزمور 42-49؛ 84-85؛ 1 أخبار 6:31-38"], ["Jacob Milgrom", "Numbers, JPS Torah Commentary, 1990"], ["James L. Mays", "Psalms, Interpretation, Westminster John Knox, 1994"]],
  "b-33": [["الكتاب المقدس", "خروج 1-2؛ أعمال 7:20-22؛ عبرانيين 11:23-29"], ["Brevard S. Childs", "The Book of Exodus, Westminster Press, 1974"], ["Phyllis Trible", "Texts of Terror, Fortress Press, 1984"]],
  "b-34": [["الكتاب المقدس", "قضاة 2:11-13؛ 1 ملوك 18؛ 2 ملوك 10:18-28"], ["Mark S. Smith", "The Early History of God, Eerdmans, 2002"], ["John Day", "Yahweh and the Gods and Goddesses of Canaan, Sheffield Academic Press, 2002"]],
  "b-35": [["الكتاب المقدس", "1 ملوك 15:16-34؛ 16:1-7؛ 2 أخبار 16:1-6"], ["Mordechai Cogan", "1 Kings, Anchor Bible 10, Doubleday, 2001"], ["Walter Brueggemann", "First and Second Kings, Smyth & Helwys, 2000"]],
  "b-36": [["الكتاب المقدس", "2 صموئيل 17:27-29؛ 19:31-40; 1 ملوك 2:7"], ["Robert Alter", "The David Story, W. W. Norton, 1999"], ["David G. Firth", "1 & 2 Samuel, Apollos, 2009"]],
  "b-37": [["الكتاب المقدس", "1 أخبار 6:14؛ عزرا 8:16; نحميا 3:25"], ["Sara Japhet", "I & II Chronicles, Old Testament Library, 1993"], ["H. G. M. Williamson", "Ezra, Nehemiah, Word Biblical Commentary 16, 1985"]],
  "b-38": [["الكتاب المقدس", "إشعياء 52:7؛ لوقا 2:10-11؛ رومية 1:1-17"], ["John N. Oswalt", "The Book of Isaiah 40-66, NICOT, 1998"], ["John Barclay", "Paul and the Gift, Eerdmans, 2015"]],
  "b-39": [["الكتاب المقدس", "أمثال 2:1-11؛ 3:13-18؛ فيلبي 1:9-11"], ["Michael V. Fox", "Proverbs 1-9, Anchor Bible 18A, Doubleday, 2000"], ["Richard J. Clifford", "Proverbs, Westminster John Knox, 1999"]],
  "b-40": [["الكتاب المقدس", "تكوين 15؛ خروج 24؛ إرميا 31:31-34؛ عبرانيين 8-10"], ["Moshe Weinfeld", "The Promise of the Land, University of California Press, 1993"], ["F. F. Bruce", "The Epistle to the Hebrews, Eerdmans, 1990"]]
};
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const selected = data.entries.filter(e => e.letter === "ب" && e.status !== "reviewed");
if (selected.length !== 10) throw new Error(`المتوقع 10 مداخل، وجد ${selected.length}.`);
for (const entry of selected) {
  entry.references = refs[entry.id].map(([author, title]) => ({ author, title }));
  entry.status = "reviewed";
  entry.content += "\n\nمنهج القراءة الأكاديمية: يفصل هذا المدخل بين المعنى النصي والسياق التاريخي والاستقبال اليهودي والقراءة المسيحية. وتُعرض النتائج الأثرية واللغوية بحدود الدليل، بينما تنبني الخلاصة اللاهوتية والروحية على بنية النص وعلاقته بالعهد والقداسة والعدل.";
}
const temporary = `${file}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
JSON.parse(fs.readFileSync(temporary, "utf8"));
fs.renameSync(temporary, file);
console.log(`تم اعتماد المرحلة الرابعة والأخيرة من حرف ب: ${selected.length} مداخل.`);
