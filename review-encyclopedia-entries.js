"use strict";

const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "encyclopedia_ar.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const exactOriginalLanguages = {
  "ذهب الهيكل": {
    language: "العبرية זָהָב (zahav)",
    meaning: "ذهب؛ معدن ثمين استُخدم في الخيمة والهيكل، ويحدد السياق هل هو مادة للعبادة أم رمز للثروة."
  }
};
let corrected = 0;
let markedDraft = 0;
for (const entry of data.entries) {
  if (exactOriginalLanguages[entry.title]) {
    entry.originalLanguage = exactOriginalLanguages[entry.title];
    corrected += 1;
  }
  if (!entry.originalLanguage) {
    entry.originalLanguage = {
      language: "لم يُحسم في هذه النسخة؛ يحتاج تحققًا من العبرية أو الآرامية أو اليونانية الأصلية",
      meaning: "لا يُعتمد معنى اشتقاقي قبل مراجعة الشاهد واللغة الأصلية."
    };
    entry.status = "draft";
    markedDraft += 1;
  }
  if (!entry.content || entry.content.length < 650 || !Array.isArray(entry.references) || entry.references.length < 2) {
    entry.status = "draft";
  }
}
const temporary = `${file}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
JSON.parse(fs.readFileSync(temporary, "utf8"));
fs.renameSync(temporary, file);
console.log(`تمت مراجعة ${data.entries.length} مدخلًا؛ صُحح ${corrected}، ووُسم ${markedDraft} كمسودة تحتاج بحثًا.`);
