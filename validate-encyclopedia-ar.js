/*
===========================================================
موسوعة الكتاب المقدس
مدقق قاعدة البيانات العربية
File: validate-encyclopedia-ar.js
===========================================================

الهدف:
1. التحقق من صحة JSON.
2. التحقق من الحرف الحقيقي لكل مدخل.
3. منع خلط المداخل بين الحروف.
4. كشف التكرار.
5. كشف المداخل الناقصة.
6. عدم إنشاء أي بيانات من تلقاء نفسه.
7. عدم تعديل قاعدة البيانات الأصلية.
===========================================================
*/

const fs = require("fs");

const FILE = "encyclopedia_ar.json";

/*
-----------------------------------------------------------
الحروف العربية المعتمدة في الموسوعة
-----------------------------------------------------------
*/
const LETTERS = [
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
-----------------------------------------------------------
تطبيع الحروف الأولى
الألف بجميع صورها = ا
-----------------------------------------------------------
*/

function normalizeFirstLetter(text) {

    if (!text) return "";

    let value = String(text).trim();

    /*
    إزالة علامات التشكيل من البداية
    */
    value = value.replace(/[\u064B-\u065F\u0670]/g, "");

    const first = value.charAt(0);

    /*
    جميع صور الألف تعامل كألف
    */
    if (
        first === "أ" ||
        first === "إ" ||
        first === "آ" ||
        first === "ٱ"
    ) {
        return "ا";
    }

    return first;
}

/*
-----------------------------------------------------------
تحديد الاسم الحقيقي للمدخل
-----------------------------------------------------------
*/

function getTitle(entry) {

    return (
        entry.title ||
        entry.name ||
        entry.term ||
        entry.heading ||
        ""
    ).trim();
}

/*
-----------------------------------------------------------
تحميل الملف
-----------------------------------------------------------
*/

if (!fs.existsSync(FILE)) {

    console.error("\n❌ الملف غير موجود:");
    console.error(FILE);
    console.error("\nضع validate-encyclopedia-ar.js بجوار encyclopedia_ar.json");
    process.exit(1);
}

let raw;

try {

    raw = fs.readFileSync(FILE, "utf8");

} catch (error) {

    console.error("\n❌ تعذر قراءة الملف:");
    console.error(error.message);
    process.exit(1);
}

/*
-----------------------------------------------------------
تحليل JSON
-----------------------------------------------------------
*/

let data;

try {

    data = JSON.parse(raw);

} catch (error) {

    console.error("\n❌ encyclopedia_ar.json غير صالح.");
    console.error(error.message);
    process.exit(1);
}

/*
-----------------------------------------------------------
دعم أكثر من شكل للبيانات
-----------------------------------------------------------
*/

let entries = [];

if (Array.isArray(data)) {

    entries = data;

} else if (Array.isArray(data.entries)) {

    entries = data.entries;

} else if (Array.isArray(data.items)) {

    entries = data.items;

} else if (Array.isArray(data.data)) {

    entries = data.data;

} else {

    console.error("\n❌ لم يتم العثور على قائمة المداخل.");

    console.error(
        "يجب أن تكون البيانات Array أو تحتوي على entries/items/data."
    );

    process.exit(1);
}

/*
-----------------------------------------------------------
إحصاءات
-----------------------------------------------------------
*/

let errors = [];
let warnings = [];

const ids = new Map();
const titles = new Map();
const letterCounts = {};

for (const letter of LETTERS) {
    letterCounts[letter] = 0;
}

/*
-----------------------------------------------------------
فحص كل مدخل
-----------------------------------------------------------
*/

entries.forEach((entry, index) => {

    const position = index + 1;

    if (!entry || typeof entry !== "object") {

        errors.push(
            `المدخل رقم ${position}: ليس كائن بيانات صالحًا.`
        );

        return;
    }

    const title = getTitle(entry);

    /*
    -----------------------------------------
    الاسم
    -----------------------------------------
    */

    if (!title) {

        errors.push(
            `المدخل رقم ${position}: لا يحتوي على title/name/term/heading.`
        );

        return;
    }

    /*
    -----------------------------------------
    الحرف المسجل
    -----------------------------------------
    */

    const actualLetter = normalizeFirstLetter(title);

    if (!LETTERS.includes(actualLetter)) {

        errors.push(
            `المدخل "${title}": الحرف "${actualLetter}" غير موجود في النظام.`
        );

    }

    /*
    -----------------------------------------
    الحرف الموجود في JSON
    -----------------------------------------
    */

    const declaredLetter =
        entry.letter ||
        entry.first_letter ||
        entry.initial ||
        "";

    if (declaredLetter) {

        const normalizedDeclared =
            normalizeFirstLetter(declaredLetter);

        if (normalizedDeclared !== actualLetter) {

            errors.push(
                `خطأ حرف: "${title}" مسجل تحت "${declaredLetter}" بينما الحرف الحقيقي هو "${actualLetter}".`
            );
        }
    }

    /*
    -----------------------------------------
    عداد الحروف
    -----------------------------------------
    */

    if (letterCounts[actualLetter] !== undefined) {
        letterCounts[actualLetter]++;
    }

    /*
    -----------------------------------------
    التكرار بالعنوان
    -----------------------------------------
    */

    const titleKey = title
        .replace(/\s+/g, " ")
        .trim();

    if (titles.has(titleKey)) {

        warnings.push(
            `تكرار محتمل: "${title}" — المدخل رقم ${titles.get(titleKey)} والمدخل رقم ${position}.`
        );

    } else {

        titles.set(titleKey, position);
    }

    /*
    -----------------------------------------
    التكرار بالـ ID
    -----------------------------------------
    */

    if (entry.id) {

        if (ids.has(entry.id)) {

            errors.push(
                `تكرار ID: "${entry.id}" في المدخلين ${ids.get(entry.id)} و${position}.`
            );

        } else {

            ids.set(entry.id, position);
        }
    }

    /*
    -----------------------------------------
    المحتوى
    -----------------------------------------
    */

    const content =
        entry.content ||
        entry.text ||
        entry.description ||
        "";

    if (!String(content).trim()) {

        warnings.push(
            `المدخل "${title}" لا يحتوي على محتوى موسوعي.`
        );
    }

    /*
    -----------------------------------------
    التصنيف
    -----------------------------------------
    */

    const category =
        entry.category ||
        entry.type ||
        "";

    if (!String(category).trim()) {

        warnings.push(
            `المدخل "${title}" لا يحتوي على تصنيف.`
        );
    }
});

/*
===========================================================
فحص خاص بحرف الألف
===========================================================
*/

const ALEF_FORMS = ["ا", "أ", "إ", "آ", "ٱ"];

let alefEntries = [];

entries.forEach((entry, index) => {

    const title = getTitle(entry);

    if (!title) return;

    const first = title.charAt(0);

    if (ALEF_FORMS.includes(first)) {

        alefEntries.push({
            index: index + 1,
            title: title
        });
    }
});

/*
-----------------------------------------------------------
إخراج التقرير
-----------------------------------------------------------
*/

console.log("\n");
console.log("==================================================");
console.log("   موسوعة الكتاب المقدس — تقرير فحص البيانات");
console.log("==================================================");
console.log("");

console.log(`عدد المداخل الكلي: ${entries.length}`);
console.log("");

console.log("توزيع المداخل حسب الحروف:");
console.log("------------------------------------------");

for (const letter of LETTERS) {

    console.log(
        `${letter} : ${letterCounts[letter]}`
    );
}

console.log("");
console.log("--------------------------------------------------");
console.log(`عدد مداخل حرف الألف: ${alefEntries.length}`);
console.log("--------------------------------------------------");

if (alefEntries.length) {

    alefEntries.forEach(item => {

        console.log(
            `${item.index}. ${item.title}`
        );

    });

} else {

    console.log("لا توجد مداخل لحرف الألف حاليًا.");

}

/*
===========================================================
فحص الأخطاء
===========================================================
*/

console.log("");
console.log("==================================================");
console.log("الأخطاء");
console.log("==================================================");

if (errors.length === 0) {

    console.log("✅ لا توجد أخطاء بنيوية.");

} else {

    errors.forEach(error => {

        console.log("❌ " + error);

    });
}

/*
===========================================================
التحذيرات
===========================================================
*/

console.log("");
console.log("==================================================");
console.log("التحذيرات");
console.log("==================================================");

if (warnings.length === 0) {

    console.log("✅ لا توجد تحذيرات.");

} else {

    warnings.forEach(warning => {

        console.log("⚠️ " + warning);

    });
}

/*
===========================================================
فحص النتيجة النهائية
===========================================================
*/

console.log("");
console.log("==================================================");

if (errors.length === 0) {

    console.log("✅ قاعدة البيانات اجتازت الفحص البنيوي.");

    console.log(
        "يمكن الانتقال إلى مرحلة العرض في encyclopedia.html."
    );

} else {

    console.log(
        "❌ قاعدة البيانات لم تجتز الفحص."
    );

    console.log(
        "يجب إصلاح الأخطاء قبل تثبيت البيانات."
    );
}

console.log("==================================================");
console.log("");
