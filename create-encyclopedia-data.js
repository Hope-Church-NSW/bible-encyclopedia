"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "encyclopedia_ar.json");
const ARABIC_LETTERS = [
    "ا", "ب", "ت", "ث", "ج", "ح", "خ",
    "د", "ذ", "ر", "ز", "س", "ش", "ص",
    "ض", "ط", "ظ", "ع", "غ", "ف", "ق",
    "ك", "ل", "م", "ن", "ه", "و", "ي"
];

function usage() {
    console.log(`
الاستخدام:
  node create-encyclopedia-data.js validate
  node create-encyclopedia-data.js init
  node create-encyclopedia-data.js add --entry-file path/to/entry.json

شكل ملف المدخل:
  {
    "id": "b-example",
    "title": "عنوان المدخل",
    "letter": "ب",
    "category": "موضوعات كتابية",
    "content": "نص الدراسة..."
  }
`);
}

function normalizeArabic(value) {
    return String(value || "")
        .trim()
        .replace(/[أإآٱ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/ـ/g, "")
        .replace(/[\u064B-\u065F\u0670]/g, "");
}

function firstArabicLetter(value) {
    for (const character of String(value || "")) {
        const normalized = normalizeArabic(character);

        if (ARABIC_LETTERS.includes(normalized)) {
            return normalized;
        }
    }

    return "";
}

function readJson(file) {
    if (!fs.existsSync(file)) {
        throw new Error(`الملف غير موجود: ${file}`);
    }

    const raw = fs.readFileSync(file, "utf8");

    if (!raw.trim()) {
        throw new Error(`الملف فارغ: ${file}`);
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new Error(`JSON غير صالح في ${file}: ${error.message}`);
    }
}

function validateData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("يجب أن تكون البنية الرئيسية كائنًا يحتوي على entries.");
    }

    if (!Array.isArray(data.entries)) {
        throw new Error("يجب أن يحتوي الملف على مصفوفة entries.");
    }

    const ids = new Set();

    data.entries.forEach((entry, index) => {
        validateEntry(entry, `entries[${index}]`);

        if (ids.has(entry.id)) {
            throw new Error(`المعرّف مكرر: ${entry.id}`);
        }

        ids.add(entry.id);
    });

    return data;
}

function validateEntry(entry, label = "المدخل") {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`${label} يجب أن يكون كائنًا.`);
    }

    for (const field of ["id", "title", "letter", "content"]) {
        if (typeof entry[field] !== "string" || !entry[field].trim()) {
            throw new Error(`${label}: الحقل ${field} مطلوب كنص غير فارغ.`);
        }
    }

    if (!/^[a-z0-9][a-z0-9-]*$/i.test(entry.id.trim())) {
        throw new Error(`${label}: id يجب أن يحتوي على أحرف إنجليزية وأرقام وشرطات فقط.`);
    }

    const letter = normalizeArabic(entry.letter).charAt(0);

    if (!ARABIC_LETTERS.includes(letter)) {
        throw new Error(`${label}: الحرف غير صالح: ${entry.letter}`);
    }

    const titleLetter = firstArabicLetter(entry.title);

    if (titleLetter && titleLetter !== letter) {
        throw new Error(
            `${label}: الحقل letter (${entry.letter}) لا يطابق أول حرف في العنوان (${entry.title}).`
        );
    }

    if (entry.references !== undefined) {
        if (!Array.isArray(entry.references) || entry.references.length === 0) {
            throw new Error(`${label}: references يجب أن تكون مصفوفة غير فارغة.`);
        }

        entry.references.forEach((reference, index) => {
            if (typeof reference === "string") {
                if (!reference.trim()) {
                    throw new Error(`${label}.references[${index}] لا يمكن أن يكون فارغًا.`);
                }
                return;
            }

            if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
                throw new Error(`${label}.references[${index}] يجب أن يكون نصًا أو كائنًا.`);
            }

            if (!reference.title && !reference.url) {
                throw new Error(`${label}.references[${index}] يحتاج title أو url.`);
            }
        });
    }
}

function writeDataSafely(data) {
    const serialized = `${JSON.stringify(data, null, 2)}\n`;
    const temporaryFile = `${DATA_FILE}.${process.pid}.tmp`;

    fs.writeFileSync(temporaryFile, serialized, "utf8");
    validateData(readJson(temporaryFile));
    fs.renameSync(temporaryFile, DATA_FILE);
}

function validateCommand() {
    const data = validateData(readJson(DATA_FILE));
    console.log(`تم التحقق بنجاح: ${data.entries.length} مدخلًا.`);
}

function initCommand() {
    if (fs.existsSync(DATA_FILE)) {
        throw new Error("الملف موجود بالفعل؛ لم يتم استبداله. استخدم validate أو add.");
    }

    writeDataSafely({ entries: [] });
    console.log(`تم إنشاء ${path.basename(DATA_FILE)} ببنية صالحة.`);
}

function addCommand(args) {
    const fileIndex = args.indexOf("--entry-file");

    if (fileIndex === -1 || !args[fileIndex + 1]) {
        throw new Error("استخدم add مع --entry-file path/to/entry.json.");
    }

    const entryFile = path.resolve(ROOT, args[fileIndex + 1]);
    const entry = readJson(entryFile);
    validateEntry(entry);

    const data = validateData(readJson(DATA_FILE));

    if (data.entries.some(item => item.id === entry.id)) {
        throw new Error(`يوجد مدخل بالمعرّف نفسه: ${entry.id}`);
    }

    data.entries.push(entry);
    validateData(data);
    writeDataSafely(data);

    console.log(`تمت إضافة المدخل ${entry.id} تحت حرف ${entry.letter}.`);
    console.log(`إجمالي المداخل: ${data.entries.length}.`);
}

function main() {
    const [command = "validate", ...args] = process.argv.slice(2);

    if (command === "validate") {
        validateCommand();
        return;
    }

    if (command === "init") {
        initCommand();
        return;
    }

    if (command === "add") {
        addCommand(args);
        return;
    }

    usage();
    process.exitCode = 1;
}

try {
    main();
} catch (error) {
    console.error(`فشل التنفيذ: ${error.message}`);
    process.exitCode = 1;
}
