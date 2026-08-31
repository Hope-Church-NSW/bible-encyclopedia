"use strict";

const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "encyclopedia_ar.json"), "utf8"));
const report = { total: data.entries.length, complete: [], needsReview: [] };

function hasText(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function hasBiblicalReference(entry) {
    return Array.isArray(entry.references) && entry.references.some(reference =>
        reference && typeof reference === "object" &&
        reference.author === "الكتاب المقدس" && hasText(reference.title)
    );
}

for (const entry of data.entries) {
    const content = String(entry.content || "");
    const originalLanguage = entry.originalLanguage || {};
    const reasons = [];

    if (entry.originalLanguage) {
        if (!hasText(originalLanguage.language) || !hasText(originalLanguage.meaning)) {
            reasons.push("incomplete-original-language-fields");
        }
        if (/لم يُحسم|يحتاج تحقق|لا يُعتمد معنى اشتقاقي/i.test(`${originalLanguage.language || ""} ${originalLanguage.meaning || ""}`)) {
            reasons.push("unverified-original-language");
        }
        if (!/المعنى في الأصل:|الأصل اللغوي:/.test(content)) {
            reasons.push("missing-original-language-section");
        }
    }
    if (!/الشواهد الأساسية:|الشاهد الكتابي:/.test(content)) {
        reasons.push("missing-scripture-section");
    }
    if (!/المكان|الموضع/.test(content)) {
        reasons.push("missing-place-section");
    }
    if (!/الأشخاص|معاصرو/.test(content)) {
        reasons.push("missing-people-section");
    }
    if (!hasBiblicalReference(entry)) {
        reasons.push("missing-biblical-reference");
    }

    const result = { id: entry.id, title: entry.title, letter: entry.letter, reasons };
    (reasons.length ? report.needsReview : report.complete).push(result);
}

report.summary = {
    complete: report.complete.length,
    needsReview: report.needsReview.length,
    byReason: report.needsReview.reduce((counts, entry) => {
        entry.reasons.forEach(reason => { counts[reason] = (counts[reason] || 0) + 1; });
        return counts;
    }, {})
};

fs.writeFileSync(path.join(__dirname, "academic-completeness-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`دُقّق ${report.total} مدخلًا: مكتمل ${report.summary.complete}، يحتاج مراجعة ${report.summary.needsReview}.`);

if (process.argv.includes("--strict") && report.summary.needsReview > 0) {
    process.exitCode = 1;
    console.error("فشل الاعتماد الأكاديمي: توجد مداخل لا تستوفي حقول الأصل والشاهد والمكان والأشخاص والمراجع.");
}