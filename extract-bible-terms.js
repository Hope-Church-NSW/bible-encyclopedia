"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const BIBLE_FILE = path.join(ROOT, "bible.json");
const ENCYCLOPEDIA_FILE = path.join(ROOT, "encyclopedia_ar.json");
const DEFAULT_OUTPUT = path.join(ROOT, "encyclopedia_n_candidates.json");
const ARABIC_LETTER = "ن";

function normalizeArabic(value) {
    return String(value || "")
        .normalize("NFKC")
        .replace(/[أإآٱ]/g, "ا")
        .replace(/[ًٌٍَُِّْـ]/g, "")
        .replace(/ى/g, "ي")
        .trim();
}

function readJson(file) {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw);
}

function tokenize(text) {
    return String(text || "")
        .split(/[^\u0600-\u06FF]+/u)
        .map(word => normalizeArabic(word))
        .filter(word => word.length > 1 && word.startsWith(ARABIC_LETTER));
}

function getReferences(verse) {
    return {
        book: verse.book,
        chapter: verse.chapter,
        verse: verse.verse
    };
}

function getOutputPath(args) {
    const outputIndex = args.indexOf("--output");

    if (outputIndex === -1 || !args[outputIndex + 1]) {
        return DEFAULT_OUTPUT;
    }

    return path.resolve(ROOT, args[outputIndex + 1]);
}

function buildResearchedIndex() {
    const data = readJson(ENCYCLOPEDIA_FILE);
    const index = new Map();

    for (const entry of data.entries || []) {
        const key = normalizeArabic(entry.title);

        if (key.startsWith(ARABIC_LETTER)) {
            index.set(key, entry.id);
        }
    }

    return index;
}

function extractTerms() {
    const verses = readJson(BIBLE_FILE);
    const counts = new Map();

    for (const verse of verses) {
        for (const word of tokenize(verse.text)) {
            const item = counts.get(word) || {
                term: word,
                occurrences: 0,
                references: []
            };

            item.occurrences += 1;

            const reference = getReferences(verse);
            const referenceKey = `${reference.book}:${reference.chapter}:${reference.verse}`;

            if (!item.references.some(existing =>
                `${existing.book}:${existing.chapter}:${existing.verse}` === referenceKey
            )) {
                item.references.push(reference);
            }

            counts.set(word, item);
        }
    }

    const researched = buildResearchedIndex();

    return [...counts.values()]
        .sort((left, right) =>
            right.occurrences - left.occurrences ||
            left.term.localeCompare(right.term, "ar")
        )
        .map(item => ({
            ...item,
            status: researched.has(item.term)
                ? "researched"
                : "needs-research",
            entryId: researched.get(item.term) || null
        }));
}

function writeJsonSafely(file, data) {
    const temporaryFile = `${file}.${process.pid}.tmp`;
    const serialized = `${JSON.stringify(data, null, 2)}\n`;

    fs.writeFileSync(temporaryFile, serialized, "utf8");
    JSON.parse(fs.readFileSync(temporaryFile, "utf8"));
    fs.renameSync(temporaryFile, file);
}

function main() {
    const args = process.argv.slice(2);
    const outputFile = getOutputPath(args);
    const terms = extractTerms();
    const researchedCount = terms.filter(item => item.status === "researched").length;

    const output = {
        schemaVersion: "1.0",
        generatedFrom: "bible.json",
        letter: ARABIC_LETTER,
        generatedAt: new Date().toISOString(),
        note: "هذا فهرس مرشحين لغوي؛ لا يصبح أي عنصر دراسة منشورة قبل مراجعته وإضافة مراجع موثقة.",
        rules: [
            "التقطت الكلمات العربية المكتوبة التي تبدأ بحرف النون.",
            "احتُفظ بالتصريفات كما تظهر في النص، ولذلك قد تحتاج الكلمات المتقاربة إلى دمج لغوي يدوي.",
            "references هي مواضع ورود الكلمة في bible.json وليست بديلًا عن المراجع التفسيرية."
        ],
        totals: {
            candidates: terms.length,
            researched: researchedCount,
            needsResearch: terms.length - researchedCount
        },
        candidates: terms
    };

    writeJsonSafely(outputFile, output);
    console.log(`تم استخراج ${terms.length} مرشحًا لحرف ${ARABIC_LETTER}.`);
    console.log(`مدخلات مدروسة: ${researchedCount}. تحتاج إلى بحث: ${terms.length - researchedCount}.`);
    console.log(`الملف: ${outputFile}`);
}

try {
    main();
} catch (error) {
    console.error(`فشل الاستخراج: ${error.message}`);
    process.exitCode = 1;
}
