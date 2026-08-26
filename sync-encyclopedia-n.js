"use strict";

const fs = require("fs");
const path = require("path");

const root = __dirname;
const mainFile = path.join(root, "encyclopedia_ar.json");
const nounFile = path.join(root, "encyclopedia_n.json");
const temporaryFile = `${mainFile}.${process.pid}.tmp`;

const mainData = JSON.parse(fs.readFileSync(mainFile, "utf8"));
const nounData = JSON.parse(fs.readFileSync(nounFile, "utf8"));

if (!Array.isArray(mainData.entries) || !Array.isArray(nounData.entries)) {
    throw new Error("كلا الملفين يجب أن يحتوي على مصفوفة entries.");
}

if (nounData.entries.length !== 40) {
    throw new Error(`ملف النون يجب أن يحتوي على 40 مدخلًا، ووجد ${nounData.entries.length}.`);
}

const nonNounEntries = mainData.entries.filter(entry => entry.letter !== "ن");
const mergedEntries = [...nonNounEntries, ...nounData.entries];
const ids = new Set();

for (const entry of mergedEntries) {
    if (!entry.id || ids.has(entry.id)) {
        throw new Error(`معرّف مفقود أو مكرر: ${entry.id || "غير معروف"}`);
    }

    ids.add(entry.id);
}

const output = {
    ...mainData,
    entries: mergedEntries
};

fs.writeFileSync(temporaryFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
JSON.parse(fs.readFileSync(temporaryFile, "utf8"));
fs.renameSync(temporaryFile, mainFile);

console.log(`تم دمج ${nounData.entries.length} مدخلًا لحرف النون في ${path.basename(mainFile)}.`);
console.log(`إجمالي المداخل: ${output.entries.length}.`);
