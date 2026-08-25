/*
==============================================================
موسوعة الكتاب المقدس
أداة التصحيح النهائي لقاعدة البيانات العربية

FILE:
fix-encyclopedia-ar.js

الوظيفة:
- قراءة encyclopedia_ar.json
- فحص عنوان كل مدخل
- تحديد الحرف الحقيقي من اسم المدخل
- تصحيح قيمة letter
- ترتيب المداخل أبجديًا
- منع ظهور مدخل بحرف خاطئ
- إنشاء نسخة احتياطية قبل التعديل
- لا تضيف أي بيانات جديدة
- لا تحذف أي مدخل صالح
==============================================================
*/

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "encyclopedia_ar.json");
const BACKUP = path.join(__dirname, "encyclopedia_ar.backup.json");
const OUTPUT = path.join(__dirname, "encyclopedia_ar.fixed.json");

/*
==============================================================
الحروف العربية المعتمدة
==============================================================
*/

const ARABIC_LETTERS = [
    "ا",
    "ب",
    "ت",
    "ث",
    "ج",
    "ح",
    "خ",
    "د",
    "ذ",
    "ر",
    "ز",
    "س",
    "ش",
    "ص",
    "ض",
    "ط",
    "ظ",
    "ع",
    "غ",
    "ف",
    "ق",
    "ك",
    "ل",
    "م",
    "ن",
    "ه",
    "و",
    "ي"
];

/*
==============================================================
تطبيع الاسم
==============================================================
*/

function normalizeText(value) {

    if (value === null || value === undefined) {
        return "";
    }

    let text = String(value).trim();

    /*
    إزالة التشكيل
    */
    text = text.replace(/[\u064B-\u065F\u0670]/g, "");

    /*
    إزالة علامات غير مرئية
    */
    text = text.replace(/[\u200B-\u200F\uFEFF]/g, "");

    return text;
}

/*
==============================================================
تحديد الحرف الحقيقي
==============================================================
*/

function getRealLetter(title) {

    const text = normalizeText(title);

    if (!text) {
        return "";
    }

    let first = text.charAt(0);

    /*
    الألف بجميع أشكالها
    */
    if (
        first === "أ" ||
        first === "إ" ||
        first === "آ" ||
        first === "ٱ"
    ) {
        return "ا";
    }

    /*
    الهاء
    */
    if (first === "ه" || first === "هـ") {
        return "ه";
    }

    /*
    الياء
    */
    if (first === "ى") {
        return "ي";
    }

    return ARABIC_LETTERS.includes(first)
        ? first
        : "";
}

/*
==============================================================
الحصول على عنوان المدخل
==============================================================
*/

function getTitle(entry) {

    if (!entry || typeof entry !== "object") {
        return "";
    }

    return normalizeText(
        entry.title ||
        entry.name ||
        entry.term ||
        entry.heading ||
        ""
    );
}

/*
==============================================================
ترتيب عربي ثابت
==============================================================
*/

function arabicSort(a, b) {

    const titleA = getTitle(a);
    const titleB = getTitle(b);

    const letterA = getRealLetter(titleA);
    const letterB = getRealLetter(titleB);

    const indexA = ARABIC_LETTERS.indexOf(letterA);
    const indexB = ARABIC_LETTERS.indexOf(letterB);

    if (indexA !== indexB) {
        return indexA - indexB;
    }

    return titleA.localeCompare(
        titleB,
        "ar",
        {
            sensitivity: "base",
            numeric: false
        }
    );
}

/*
==============================================================
التأكد من وجود الملف
==============================================================
*/

if (!fs.existsSync(FILE)) {

    console.error("");
    console.error("❌ لم يتم العثور على:");
    console.error(FILE);
    console.error("");

    process.exit(1);
}

/*
==============================================================
قراءة الملف
==============================================================
*/

let raw;

try {

    raw = fs.readFileSync(FILE, "utf8");

} catch (error) {

    console.error("");
    console.error("❌ تعذر قراءة encyclopedia_ar.json");
    console.error(error.message);
    console.error("");

    process.exit(1);
}

/*
==============================================================
تحليل JSON
==============================================================
*/

let database;

try {

    database = JSON.parse(raw);

} catch (error) {

    console.error("");
    console.error("❌ encyclopedia_ar.json غير صالح.");
    console.error(error.message);
    console.error("");

    process.exit(1);
}

/*
==============================================================
التأكد من بنية قاعدة البيانات
==============================================================
*/

if (
    !database ||
    typeof database !== "object" ||
    !Array.isArray(database.entries)
) {

    console.error("");
    console.error(
        "❌ بنية encyclopedia_ar.json غير متوافقة."
    );

    console.error(
        "المطلوب وجود مصفوفة باسم entries."
    );

    console.error("");

    process.exit(1);
}

/*
==============================================================
نسخة احتياطية
==============================================================
*/

try {

    fs.copyFileSync(FILE, BACKUP);

    console.log("");
    console.log(
        "✅ تم إنشاء النسخة الاحتياطية:"
    );
    console.log(
        "   encyclopedia_ar.backup.json"
    );

} catch (error) {

    console.error("");
    console.error(
        "❌ تعذر إنشاء النسخة الاحتياطية."
    );

    console.error(error.message);

    process.exit(1);
}

/*
==============================================================
المعالجة
==============================================================
*/

const correctedEntries = [];

const errors = [];
const corrections = [];

const seenIds = new Set();
const seenTitles = new Set();

/*
عداد الحروف
*/

const counts = {};

for (const letter of ARABIC_LETTERS) {
    counts[letter] = 0;
}

/*
==============================================================
معالجة كل مدخل
==============================================================
*/

database.entries.forEach((entry, index) => {

    const number = index + 1;

    if (!entry || typeof entry !== "object") {

        errors.push(
            `المدخل رقم ${number} ليس كائنًا صالحًا.`
        );

        return;
    }

    const title = getTitle(entry);

    if (!title) {

        errors.push(
            `المدخل رقم ${number} لا يحتوي على عنوان.`
        );

        return;
    }

    const realLetter = getRealLetter(title);

    if (!realLetter) {

        errors.push(
            `"${title}" لا يمكن تحديد حرفه العربي.`
        );

        return;
    }

    /*
    ------------------------------------------
    فحص التكرار
    ------------------------------------------
    */

    const titleKey = title.toLowerCase();

    if (seenTitles.has(titleKey)) {

        errors.push(
            `عنوان مكرر: "${title}".`
        );

        return;
    }

    seenTitles.add(titleKey);

    /*
    ------------------------------------------
    ID
    ------------------------------------------
    */

    if (entry.id) {

        if (seenIds.has(entry.id)) {

            errors.push(
                `ID مكرر: "${entry.id}".`
            );

            return;
        }

        seenIds.add(entry.id);
    }

    /*
    ------------------------------------------
    معرفة الحرف القديم
    ------------------------------------------
    */

    const oldLetter = entry.letter || "";

    /*
    ------------------------------------------
    تصحيح الحرف
    ------------------------------------------
    */

    const corrected = {
        ...entry,
        letter: realLetter
    };

    /*
    ------------------------------------------
    تسجيل التصحيح
    ------------------------------------------
    */

    if (oldLetter !== realLetter) {

        corrections.push({
            title: title,
            oldLetter: oldLetter || "(فارغ)",
            newLetter: realLetter
        });
    }

    /*
    ------------------------------------------
    زيادة العداد
    ------------------------------------------
    */

    counts[realLetter]++;

    correctedEntries.push(corrected);
});

/*
==============================================================
ترتيب البيانات
==============================================================
*/

correctedEntries.sort(arabicSort);

/*
==============================================================
بناء قاعدة البيانات الجديدة
==============================================================
*/

const fixedDatabase = {
    ...database,

    letters: ARABIC_LETTERS,

    entries: correctedEntries
};

/*
==============================================================
كتابة الملف الجديد
==============================================================
*/

try {

    fs.writeFileSync(
        OUTPUT,
        JSON.stringify(
            fixedDatabase,
            null,
            2
        ),
        "utf8"
    );

} catch (error) {

    console.error("");
    console.error(
        "❌ تعذر إنشاء encyclopedia_ar.fixed.json"
    );

    console.error(error.message);

    process.exit(1);
}

/*
==============================================================
تقرير الألف
==============================================================
*/

const alefEntries = correctedEntries.filter(
    entry => entry.letter === "ا"
);

console.log("");
console.log("==================================================");
console.log("        نتيجة تصحيح موسوعة الكتاب المقدس");
console.log("==================================================");

console.log("");
console.log(
    `عدد المداخل الأصلية: ${database.entries.length}`
);

console.log(
    `عدد المداخل بعد التصحيح: ${correctedEntries.length}`
);

console.log(
    `عدد التصحيحات: ${corrections.length}`
);

console.log(
    `عدد الأخطاء: ${errors.length}`
);

console.log("");
console.log("==================================================");
console.log("توزيع المداخل حسب الحروف");
console.log("==================================================");

ARABIC_LETTERS.forEach(letter => {

    console.log(
        `${letter} : ${counts[letter]}`
    );

});

console.log("");
console.log("==================================================");
console.log("مداخل حرف الألف فقط");
console.log("==================================================");

if (alefEntries.length === 0) {

    console.log(
        "⚠️ لا توجد مداخل تحت الألف."
    );

} else {

    alefEntries.forEach(
        (entry, index) => {

            console.log(
                `${index + 1}. ${entry.title}`
            );

        }
    );
}

/*
==============================================================
التصحيحات التي تمت
==============================================================
*/

console.log("");
console.log("==================================================");
console.log("التصحيحات التي تمت");
console.log("==================================================");

if (corrections.length === 0) {

    console.log(
        "لا توجد قيم letter خاطئة."
    );

} else {

    corrections.forEach(item => {

        console.log(
            `"${item.title}" : ${item.oldLetter} → ${item.newLetter}`
        );

    });
}

/*
==============================================================
الأخطاء
==============================================================
*/

console.log("");
console.log("==================================================");
console.log("الأخطاء");
console.log("==================================================");

if (errors.length === 0) {

    console.log(
        "✅ لا توجد أخطاء تمنع بناء الملف."
    );

} else {

    errors.forEach(error => {

        console.log(
            "❌ " + error
        );

    });
}

/*
==============================================================
التحقق النهائي
==============================================================
*/

const finalInvalidEntries =
    correctedEntries.filter(entry => {

        const title = getTitle(entry);
        const realLetter = getRealLetter(title);

        return entry.letter !== realLetter;

    });

console.log("");
console.log("==================================================");
console.log("التحقق النهائي");
console.log("==================================================");

if (
    errors.length === 0 &&
    finalInvalidEntries.length === 0 &&
    correctedEntries.length === database.entries.length
) {

    console.log("");
    console.log(
        "✅ تم تصحيح قاعدة البيانات بنجاح."
    );

    console.log("");
    console.log(
        "✅ كل مدخل يحمل الحرف الحقيقي لعنوانه."
    );

    console.log("");
    console.log(
        "✅ لا توجد مداخل من ع / م / هـ داخل الألف."
    );

    console.log("");
    console.log(
        "الملف الجديد:"
    );

    console.log(
        "encyclopedia_ar.fixed.json"
    );

    console.log("");

} else {

    console.log("");
    console.log(
        "❌ لم يتم اعتماد الملف كنسخة نهائية."
    );

    console.log(
        "راجع الأخطاء أعلاه."
    );

    console.log("");
}

console.log("==================================================");
console.log("");
