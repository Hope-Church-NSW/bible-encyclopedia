"use strict";

const fs = require("fs");
const path = require("path");

const dataFile = path.join(__dirname, "encyclopedia_ar.json");
const reportFile = path.join(__dirname, "biblical-entry-audit-report.json");
const prefixes = ["رؤية في ", "زاوية في ", "سياق ", "شأن ", "صراسة ", "ضراسة "];
const arabicLetters = new Set("ابتثجحخدذرزسشصضطظعغفقكلمنهوي");

function normalizeArabic(value) {
    return String(value || "")
        .trim()
        .replace(/^ال\s*/, "")
        .replace(/[أإآٱ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/ـ/g, "")
        .replace(/[\u064B-\u065F\u0670]/g, "");
}

function initialLetter(title) {
    return [...normalizeArabic(title)].find(character => arabicLetters.has(character)) || "";
}

function scriptureReference(entry) {
    return Array.isArray(entry.references) && entry.references.some(reference =>
        reference && typeof reference === "object" &&
        reference.author === "الكتاب المقدس" &&
        typeof reference.title === "string" && reference.title.trim()
    );
}

const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const report = { totalBefore: data.entries.length, renamed: [], trimmedRepeatedSections: [], removedUnverifiedOriginalLanguage: [], removedDuplicateTitles: [], removed: [] };

data.entries = data.entries.flatMap(entry => {
    if (!scriptureReference(entry)) {
        report.removed.push({ id: entry.id, title: entry.title, reason: "missing-biblical-reference" });
        return [];
    }

    const repeatedSection = ["\n\nالتفسير الموسّع:", "\n\nمنهج القراءة الأكاديمية:"].find(marker => entry.content.includes(marker));
    if (repeatedSection) {
        entry = { ...entry, content: entry.content.slice(0, entry.content.indexOf(repeatedSection)).trim() };
        report.trimmedRepeatedSections.push(entry.id);
    }

    const originalLanguageText = `${entry.originalLanguage?.language || ""} ${entry.originalLanguage?.meaning || ""}`;
    if (/لم يُحسم|يحتاج تحقق|لا يُعتمد معنى اشتقاقي/i.test(originalLanguageText)) {
        const { originalLanguage, ...entryWithoutUnverifiedLanguage } = entry;
        entry = entryWithoutUnverifiedLanguage;
        report.removedUnverifiedOriginalLanguage.push(entry.id);
    }

    const prefix = prefixes.find(candidate => entry.title.startsWith(candidate));
    if (!prefix) {
        return [entry];
    }

    const title = entry.title.slice(prefix.length).trim();
    const letter = initialLetter(title);
    if (!letter) {
        report.removed.push({ id: entry.id, title: entry.title, reason: "no-arabic-title-after-cleanup" });
        return [];
    }

    report.renamed.push({ id: entry.id, from: entry.title, to: title, letter });
    return [{ ...entry, title, letter }];
});

const entriesByTitle = new Map();
for (const entry of data.entries) {
    const candidates = entriesByTitle.get(entry.title) || [];
    candidates.push(entry);
    entriesByTitle.set(entry.title, candidates);
}

data.entries = [...entriesByTitle.values()].flatMap(candidates => {
    if (candidates.length === 1) return candidates;
    const sorted = [...candidates].sort((left, right) => {
        const leftScore = (left.status === "reviewed" ? 2 : 0) + (left.originalLanguage ? 1 : 0) + (left.content || "").length / 100000;
        const rightScore = (right.status === "reviewed" ? 2 : 0) + (right.originalLanguage ? 1 : 0) + (right.content || "").length / 100000;
        return rightScore - leftScore;
    });
    const [retained, ...duplicates] = sorted;
    duplicates.forEach(duplicate => report.removedDuplicateTitles.push({ title: duplicate.title, removedId: duplicate.id, retainedId: retained.id }));
    return [retained];
});

report.totalAfter = data.entries.length;
const temporaryData = `${dataFile}.${process.pid}.tmp`;
fs.writeFileSync(temporaryData, `${JSON.stringify(data, null, 2)}\n`, "utf8");
JSON.parse(fs.readFileSync(temporaryData, "utf8"));
fs.renameSync(temporaryData, dataFile);
fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`راجَع ${report.totalBefore} مدخلًا: عُدّل ${report.renamed.length} عنوانًا، ونُظّف ${report.trimmedRepeatedSections.length} قسمًا متكررًا، وحُذف أصل لغوي غير موثّق من ${report.removedUnverifiedOriginalLanguage.length} مدخلًا، وأُزيل ${report.removedDuplicateTitles.length} عنوانًا مكررًا و${report.removed.length} مدخلًا بلا مرجع كتابي.`);