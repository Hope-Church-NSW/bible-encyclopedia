"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

const REPORT_FILE = path.join(
    ROOT,
    "encyclopedia-audit-report.json"
);

const JSON_FILES = [
    "encyclopedia_ar.json",
    "encyclopedia_b.json",
    "encyclopedia_ar_repaired.json"
];

const IMPORTANT_FILES = [
    "encyclopedia.html",
    "encyclopedia-validator.html",
    "encyclopedia-search.js",
    "build-encyclopedia.js",
    "create-encyclopedia-data.js"
];

function fileExists(file) {
    return fs.existsSync(path.join(ROOT, file));
}

function readText(file) {
    return fs.readFileSync(
        path.join(ROOT, file),
        "utf8"
    );
}

function extractFirstJSONObject(text) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let started = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === "\\") {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }

            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }

        if (ch === "{") {
            started = true;
            depth++;
            continue;
        }

        if (ch === "}") {
            depth--;

            if (started && depth === 0) {
                return {
                    endIndex: i,
                    jsonText: text.slice(0, i + 1),
                    remainder: text.slice(i + 1)
                };
            }
        }
    }

    return null;
}

function normalizeLetter(value) {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim();
}

function getFirstArabicLetter(title) {
    if (typeof title !== "string") {
        return "";
    }

    const text = title.trim();

    for (const ch of text) {
        if (
            ch === "أ" ||
            ch === "إ" ||
            ch === "آ" ||
            ch === "ا" ||
            ch === "ب" ||
            ch === "ت" ||
            ch === "ث" ||
            ch === "ج" ||
            ch === "ح" ||
            ch === "خ" ||
            ch === "د" ||
            ch === "ذ" ||
            ch === "ر" ||
            ch === "ز" ||
            ch === "س" ||
            ch === "ش" ||
            ch === "ص" ||
            ch === "ض" ||
            ch === "ط" ||
            ch === "ظ" ||
            ch === "ع" ||
            ch === "غ" ||
            ch === "ف" ||
            ch === "ق" ||
            ch === "ك" ||
            ch === "ل" ||
            ch === "م" ||
            ch === "ن" ||
            ch === "ه" ||
            ch === "و" ||
            ch === "ي"
        ) {
            return ch;
        }
    }

    return "";
}

function inspectJsonFile(file) {
    const result = {
        file,
        exists: false,
        byteSize: 0,
        validJson: false,
        hasEntries: false,
        entriesCount: 0,
        duplicateIds: [],
        missingIds: 0,
        emptyTitles: 0,
        emptyLetters: 0,
        letterMismatches: [],
        trailingContent: false,
        parseError: null
    };

    if (!fileExists(file)) {
        return result;
    }

    result.exists = true;

    const text = readText(file);

    result.byteSize = Buffer.byteLength(
        text,
        "utf8"
    );

    const extracted = extractFirstJSONObject(text);

    if (!extracted) {
        result.parseError =
            "تعذر تحديد نهاية أول كائن JSON.";

        return result;
    }

    const remainder = extracted.remainder.trim();

    result.trailingContent =
        remainder.length > 0;

    let data;

    try {
        data = JSON.parse(text);
        result.validJson = true;
    } catch (error) {
        result.parseError = error.message;

        /*
         * نحاول تحليل أول كائن فقط للتشخيص.
         */
        try {
            data = JSON.parse(
                extracted.jsonText
            );
        } catch {
            return result;
        }
    }

    if (
        !data ||
        typeof data !== "object"
    ) {
        return result;
    }

    if (!Array.isArray(data.entries)) {
        return result;
    }

    result.hasEntries = true;
    result.entriesCount =
        data.entries.length;

    const ids = new Set();

    for (const entry of data.entries) {
        const id =
            typeof entry?.id === "string"
                ? entry.id.trim()
                : "";

        const title =
            typeof entry?.title === "string"
                ? entry.title.trim()
                : "";

        const letter =
            normalizeLetter(entry?.letter);

        if (!id) {
            result.missingIds++;
        } else if (ids.has(id)) {
            result.duplicateIds.push(id);
        } else {
            ids.add(id);
        }

        if (!title) {
            result.emptyTitles++;
        }

        if (!letter) {
            result.emptyLetters++;
        }

        if (title && letter) {
            const firstLetter =
                getFirstArabicLetter(title);

            /*
             * هذه ليست قاعدة إصلاح.
             * إنها مجرد إشارة تشخيصية.
             */
            if (
                firstLetter &&
                !(
                    letter === firstLetter ||
                    (
                        letter === "أ" &&
                        (
                            firstLetter === "أ" ||
                            firstLetter === "إ" ||
                            firstLetter === "آ" ||
                            firstLetter === "ا"
                        )
                    )
                )
            ) {
                result.letterMismatches.push({
                    id,
                    title,
                    declaredLetter: letter,
                    detectedFirstLetter:
                        firstLetter
                });
            }
        }
    }

    return result;
}

function inspectImportantFiles() {
    return IMPORTANT_FILES.map(file => ({
        file,
        exists: fileExists(file),
        byteSize: fileExists(file)
            ? fs.statSync(
                path.join(ROOT, file)
            ).size
            : 0
    }));
}

function main() {
    console.log("");
    console.log(
        "=============================================="
    );
    console.log(
        "BIBLE ENCYCLOPEDIA — REPOSITORY AUDIT"
    );
    console.log(
        "=============================================="
    );
    console.log("");

    const report = {
        auditVersion: "1.0.0",
        generatedAt:
            new Date().toISOString(),

        repositoryRoot: ROOT,

        importantFiles:
            inspectImportantFiles(),

        jsonFiles:
            JSON_FILES.map(
                inspectJsonFile
            ),

        safety: {
            modifiedFiles: [],
            deletedFiles: [],
            createdDataFiles: [],
            note:
                "هذا التدقيق لا يعدّل ملفات المشروع."
        }
    };

    for (const item of report.jsonFiles) {
        console.log(
            `\n[JSON] ${item.file}`
        );

        if (!item.exists) {
            console.log(
                "  غير موجود"
            );
            continue;
        }

        console.log(
            `  الحجم: ${item.byteSize} bytes`
        );

        console.log(
            `  JSON صالح: ${
                item.validJson
                    ? "YES"
                    : "NO"
            }`
        );

        console.log(
            `  entries: ${
                item.entriesCount
            }`
        );

        console.log(
            `  IDs مكررة: ${
                item.duplicateIds.length
            }`
        );

        console.log(
            `  IDs ناقصة: ${
                item.missingIds
            }`
        );

        console.log(
            `  عناوين فارغة: ${
                item.emptyTitles
            }`
        );

        console.log(
            `  حروف فارغة: ${
                item.emptyLetters
            }`
        );

        console.log(
            `  اختلافات الحرف/العنوان: ${
                item.letterMismatches.length
            }`
        );

        console.log(
            `  محتوى بعد نهاية أول JSON: ${
                item.trailingContent
                    ? "YES"
                    : "NO"
            }`
        );

        if (item.parseError) {
            console.log(
                `  Parse error: ${item.parseError}`
            );
        }
    }

    fs.writeFileSync(
        REPORT_FILE,
        JSON.stringify(
            report,
            null,
            2
        ) + "\n",
        "utf8"
    );

    console.log("");
    console.log(
        "=============================================="
    );
    console.log(
        "تم إنشاء تقرير التدقيق:"
    );
    console.log(
        "encyclopedia-audit-report.json"
    );
    console.log(
        "=============================================="
    );
    console.log("");
    console.log(
        "لم يتم تعديل أي ملف من ملفات الموسوعة."
    );
}

try {
    main();
} catch (error) {
    console.error("");
    console.error(
        "✖ فشل تنفيذ التدقيق"
    );
    console.error(
        error.stack || error.message
    );
    process.exit(1);
}
