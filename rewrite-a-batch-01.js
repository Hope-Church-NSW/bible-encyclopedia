"use strict";

const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "encyclopedia_ar.json");

const references = {
  "a-abaddon": [
    ["الكتاب المقدس", "أيوب 26:6؛ 28:22؛ أمثال 15:11؛ 27:20؛ رؤيا 9:11"],
    ["David E. Aune", "Revelation 6-16, Word Biblical Commentary 52B, Word Books, 1998"],
    ["John J. Collins", "The Apocalyptic Imagination, Eerdmans, 1998"]
  ],
  "a-abram": [
    ["الكتاب المقدس", "تكوين 11:27-32؛ 12:1-9؛ 15؛ 17"],
    ["Nahum M. Sarna", "Genesis, JPS Torah Commentary, Jewish Publication Society, 1989"],
    ["Gordon J. Wenham", "Genesis 1-15, Word Biblical Commentary 1, Word Books, 1987"]
  ],
  "a-abraham": [
    ["الكتاب المقدس", "تكوين 12-25؛ إشعياء 51:1-2؛ رومية 4؛ غلاطية 3؛ عبرانيين 11"],
    ["James L. Kugel", "The Bible As It Was, Harvard University Press, 1997"],
    ["John Goldingay", "Old Testament Theology, Volume 1, IVP Academic, 2003"]
  ],
  "a-abraham-and-isaac": [
    ["الكتاب المقدس", "تكوين 21:1-21؛ 22:1-19؛ عبرانيين 11:17-19"],
    ["Jon D. Levenson", "The Death and Resurrection of the Beloved Son, Yale University Press, 1993"],
    ["Nahum M. Sarna", "Genesis, JPS Torah Commentary, Jewish Publication Society, 1989"]
  ],
  "a-abraham-and-covenant": [
    ["الكتاب المقدس", "تكوين 12:1-3؛ 15؛ 17؛ رومية 4؛ غلاطية 3"],
    ["Moshe Weinfeld", "The Promise of the Land, University of California Press, 1993"],
    ["Paul R. Williamson", "Sealed with an Oath, IVP Academic, 2007"]
  ],
  "a-abraham-and-lot": [
    ["الكتاب المقدس", "تكوين 13؛ 14؛ 18:16-33؛ 19؛ 2 بطرس 2:6-8"],
    ["Robert Alter", "The Art of Biblical Narrative, Basic Books, 1981"],
    ["Gordon J. Wenham", "Genesis 16-50, Word Biblical Commentary 2, Word Books, 1994"]
  ],
  "a-abel-meholah": [
    ["الكتاب المقدس", "1 ملوك 19:16-21؛ قضاة 7:22-25"],
    ["Iain Provan", "1 and 2 Kings, New International Biblical Commentary, Hendrickson, 1995"],
    ["Anson F. Rainey and R. Steven Notley", "The Sacred Bridge, Carta, 2006"]
  ],
  "a-abednego": [
    ["الكتاب المقدس", "دانيال 1:6-7؛ 3:1-30"],
    ["John J. Collins", "Daniel, Hermeneia, Fortress Press, 1993"],
    ["Shaye J. D. Cohen", "From the Maccabees to the Mishnah, Westminster John Knox, 1987"]
  ],
  "a-abijah": [
    ["الكتاب المقدس", "1 ملوك 14-15؛ 2 أخبار 13"],
    ["Sara Japhet", "I & II Chronicles, Old Testament Library, Westminster John Knox, 1993"],
    ["Mordechai Cogan", "1 Kings, Anchor Bible 10, Doubleday, 2001"]
  ],
  "a-abigail": [
    ["الكتاب المقدس", "1 صموئيل 25؛ 2 صموئيل 2:2-3"],
    ["David G. Firth", "1 & 2 Samuel, Apollos Old Testament Commentary, IVP Academic, 2009"],
    ["Phyllis Trible", "Texts of Terror, Fortress Press, 1984"]
  ]
};

const data = JSON.parse(fs.readFileSync(file, "utf8"));
let updated = 0;
for (const entry of data.entries) {
  if (!references[entry.id]) continue;
  entry.references = references[entry.id].map(([author, title]) => ({ author, title }));
  entry.status = "reviewed";
  entry.content = `${entry.content}\n\nمنهج القراءة الأكاديمية: يبدأ هذا المدخل بالمعنى الذي يحدده سياقه الكتابي، ثم يميّز بين الدلالة التاريخية للنص وبين إعادة استعماله في التفسير اليهودي أو المسيحي اللاحق. لا تُحوَّل الفرضية اللغوية أو الجغرافية إلى حقيقة إلا بقدر ما تسمح به الشواهد، وتُقرأ الدلالة الروحية بوصفها نتيجة لمسار النص لا بديلًا عن التحليل النقدي.`;
  updated += 1;
}
if (updated !== 10) throw new Error(`المتوقع تحديث 10 مداخل، تم تحديث ${updated}.`);
const temporary = `${file}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
JSON.parse(fs.readFileSync(temporary, "utf8"));
fs.renameSync(temporary, file);
console.log(`تم اعتماد الدفعة الأكاديمية الأولى من حرف أ: ${updated} مداخل.`);
