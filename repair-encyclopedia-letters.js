"use strict";

const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "encyclopedia_ar.json");
const arabicLetters = new Set("ابتثجحخدذرزسشصضطظعغفقكلمنهوي".split(""));
const normalize = value => String(value || "").replace(/[أإآٱ]/g, "ا");
const prefixes = { ا: "a", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", ع: "ain", ن: "n" };

const data = JSON.parse(fs.readFileSync(file, "utf8"));
let repaired = 0;
const counters = {};
for (const entry of data.entries) {
  const first = [...String(entry.title || "").trim()]
    .map(character => normalize(character))
    .find(character => arabicLetters.has(character));
  if (first && entry.letter !== first) {
    entry.letter = first;
    repaired += 1;
  }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(entry.id)) {
    const prefix = prefixes[first] || "entry";
    counters[prefix] = (counters[prefix] || 0) + 1;
    entry.id = `${prefix}-${counters[prefix]}`;
  }
}
const temporary = `${file}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
JSON.parse(fs.readFileSync(temporary, "utf8"));
fs.renameSync(temporary, file);
console.log(`تم تصحيح فهرسة ${repaired} مدخلًا وفق أول حرف في العنوان.`);
