"use strict";

const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "encyclopedia_ar.json");
const references = {
  "a-abishai": [["الكتاب المقدس", "1 صموئيل 26؛ 2 صموئيل 2؛ 10؛ 18-20"], ["Robert Alter", "The David Story, W. W. Norton, 1999"], ["P. Kyle McCarter Jr.", "II Samuel, Anchor Bible 9, Doubleday, 1984"]],
  "a-abishag": [["الكتاب المقدس", "1 ملوك 1-2"], ["Mordechai Cogan", "1 Kings, Anchor Bible 10, Doubleday, 2001"], ["Tikva Frymer-Kensky", "Reading the Women of the Bible, Schocken, 2002"]],
  "a-abimelech": [["الكتاب المقدس", "تكوين 20-21؛ قضاة 8:31-9:57"], ["Nahum M. Sarna", "Genesis, JPS Torah Commentary, 1989"], ["Daniel I. Block", "Judges, Ruth, New American Commentary, 1999"]],
  "a-abinadab": [["الكتاب المقدس", "1 صموئيل 7:1-2؛ 2 صموئيل 6:3-7"], ["P. Kyle McCarter Jr.", "I Samuel, Anchor Bible 8, Doubleday, 1980"], ["David G. Firth", "1 & 2 Samuel, Apollos, 2009"]],
  "a-ararat": [["الكتاب المقدس", "تكوين 8:4؛ 2 ملوك 19:37؛ إشعياء 37:38؛ إرميا 51:27"], ["Gordon J. Wenham", "Genesis 1-15, Word Biblical Commentary 1, 1987"], ["John J. Collins", "The Apocalyptic Imagination, Eerdmans, 1998"]],
  "a-arnon": [["الكتاب المقدس", "عدد 21:13-15؛ يشوع 12:1؛ قضاة 11:13-28"], ["Jacob Milgrom", "Numbers, JPS Torah Commentary, 1990"], ["Anson F. Rainey and R. Steven Notley", "The Sacred Bridge, Carta, 2006"]],
  "a-abana": [["الكتاب المقدس", "2 ملوك 5:12"], ["Iain Provan", "1 and 2 Kings, New International Biblical Commentary, 1995"], ["K. Lawson Younger Jr.", "Ancient Conquest Accounts, Sheffield Academic Press, 1990"]],
  "a-euphrates": [["الكتاب المقدس", "تكوين 2:14؛ 15:18؛ تثنية 1:7؛ رؤيا 9:14؛ 16:12"], ["John H. Walton", "Genesis, Zondervan, 2001"], ["Richard Bauckham", "The Theology of the Book of Revelation, Cambridge University Press, 1993"]],
  "a-jericho": [["الكتاب المقدس", "يشوع 2؛ 6؛ 2 ملوك 2:4-22؛ لوقا 10:30-37؛ 19:1-10"], ["Richard S. Hess", "Joshua, Tyndale Old Testament Commentaries, 1996"], ["James K. Hoffmeier", "The Archaeology of the Bible, Lion Hudson, 2008"]],
  "a-ur": [["الكتاب المقدس", "تكوين 11:27-32؛ 12:1-9؛ نحميا 9:7؛ أعمال 7:2-4؛ عبرانيين 11:8-10"], ["Nahum M. Sarna", "Genesis, JPS Torah Commentary, 1989"], ["John H. Walton", "The Lost World of Genesis One, IVP Academic, 2009"]]
};
const data = JSON.parse(fs.readFileSync(file, "utf8"));
let updated = 0;
for (const entry of data.entries) {
  const sources = references[entry.id];
  if (!sources) continue;
  entry.references = sources.map(([author, title]) => ({ author, title }));
  entry.status = "reviewed";
  entry.content += "\n\nمنهج القراءة الأكاديمية: يقرأ هذا المدخل المصطلح داخل وحدته الأدبية وسياقه التاريخي، ثم يقارن بين الشواهد العبرية والترجمات القديمة والدراسات الحديثة. ويُفصل بوضوح بين ما يثبته النص، وما يبقى فرضية جغرافية أو تاريخية، وبين استقبال المدخل في التفسير اليهودي والقراءة المسيحية. أما الدلالة الروحية فتنبني على حركة النص وأخلاقه ولا تستبدل البحث بالتطبيق الوعظي.";
  updated += 1;
}
if (updated !== 10) throw new Error(`المتوقع 10 مداخل، تم تحديث ${updated}.`);
const temporary = `${file}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
JSON.parse(fs.readFileSync(temporary, "utf8"));
fs.renameSync(temporary, file);
console.log(`تم اعتماد الدفعة الثانية من حرف أ: ${updated} مداخل.`);
