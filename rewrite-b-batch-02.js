"use strict";

const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "encyclopedia_ar.json");
const references = {
  "b-11": [["الكتاب المقدس", "تكوين 28:10-22؛ 35:1-15؛ هوشع 12:4-5"], ["Gordon J. Wenham", "Genesis 16-50, Word Biblical Commentary 2, 1994"], ["John H. Walton", "Genesis, Zondervan, 2001"]],
  "b-12": [["الكتاب المقدس", "متى 21:17؛ مرقس 11:11-12؛ يوحنا 11-12"], ["Raymond E. Brown", "The Gospel According to John I-XII, Anchor Bible 29, 1966"], ["Craig S. Keener", "The Gospel of John, Hendrickson, 2003"]],
  "b-13": [["الكتاب المقدس", "متى 21:1؛ مرقس 11:1؛ لوقا 19:29"], ["R. T. France", "The Gospel of Matthew, NICNT, 2007"], ["Craig S. Keener", "The Gospel of Matthew, Eerdmans, 2009"]],
  "b-14": [["الكتاب المقدس", "يشوع 19:35؛ مرقس 6:45؛ 8:22؛ يوحنا 1:44"], ["Richard S. Hess", "Joshua, Tyndale Old Testament Commentaries, 1996"], ["Craig S. Keener", "The Gospel of John, Hendrickson, 2003"]],
  "b-15": [["الكتاب المقدس", "مزمور 122؛ إشعياء 2:1-4؛ متى 23:37-39؛ رؤيا 21"], ["Jon D. Levenson", "Sinai and Zion, HarperOne, 1985"], ["J. Gordon McConville", "Exploring the Old Testament, Volume 4, IVP Academic, 2002"]],
  "b-16": [["الكتاب المقدس", "تكوين 21:14؛ خروج 17:6؛ يوحنا 4:6-14"], ["John H. Walton", "Ancient Near Eastern Thought and the Old Testament, Baker Academic, 2006"], ["Gordon J. Wenham", "Genesis 16-50, Word Biblical Commentary 2, 1994"]],
  "b-17": [["الكتاب المقدس", "تكوين 21:33؛ إشعياء 5:1-7؛ متى 20:1-16"], ["Adele Berlin", "Poetics and Interpretation of Biblical Narrative, Eisenbrauns, 1994"], ["John H. Walton", "The IVP Bible Background Commentary, Zondervan, 2000"]],
  "b-18": [["الكتاب المقدس", "تكوين 1:9-10؛ خروج 14؛ مزمور 107:23-30؛ رؤيا 21:1"], ["William P. Brown", "The Seven Pillars of Creation, Oxford University Press, 2010"], ["Richard Bauckham", "The Theology of the Book of Revelation, Cambridge University Press, 1993"]],
  "b-19": [["الكتاب المقدس", "متى 4:18؛ 8:23-27؛ مرقس 4:35-41؛ يوحنا 6"], ["Craig S. Keener", "The Gospel of Matthew, Eerdmans, 2009"], ["Adela Yarbro Collins", "Mark: A Commentary, Fortress Press, 2007"]],
  "b-20": [["الكتاب المقدس", "خروج 14؛ 15:1-21؛ مزمور 106؛ 1 كورنثوس 10:1-2"], ["Brevard S. Childs", "The Book of Exodus, Westminster Press, 1974"], ["John I. Durham", "Exodus, Word Biblical Commentary 3, 1987"]]
};
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const selected = data.entries.filter(e => e.letter === "ب" && e.status !== "reviewed").slice(0, 10);
if (selected.length !== 10) throw new Error(`المتوقع 10 مداخل، وجد ${selected.length}.`);
for (const entry of selected) {
  entry.references = references[entry.id].map(([author, title]) => ({ author, title }));
  entry.status = "reviewed";
  entry.content += "\n\nمنهج القراءة الأكاديمية: يميز هذا المدخل بين الشهادة النصية والسياق التاريخي وتاريخ التفسير اليهودي والقراءة المسيحية. تُعرض القضايا اللغوية والجغرافية بحدود أدلتها، وتُبنى الخلاصة اللاهوتية والروحية على سياق النص وعلاقته بالعهد والقداسة والعدل.";
}
const temporary = `${file}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
JSON.parse(fs.readFileSync(temporary, "utf8"));
fs.renameSync(temporary, file);
console.log(`تم اعتماد المرحلة الثانية من حرف ب: ${selected.length} مداخل.`);
