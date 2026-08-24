const fs = require("fs");
const path = require("path");

// ======================================================
// دائرة المعارف الكتابية
// محرك بناء قاعدة بيانات OCR العربية
// ======================================================

const ROOT = __dirname;

// ------------------------------------------------------
// مصادر OCR
// ------------------------------------------------------

const OCR_FOLDER = path.join(ROOT, "encyclopedia_ocr");

// ------------------------------------------------------
// الناتج
// ------------------------------------------------------

const OUTPUT_FOLDER = path.join(ROOT, "encyclopedia_text");
const OUTPUT_FILE = path.join(
    OUTPUT_FOLDER,
    "encyclopedia_ar.json"
);

// ------------------------------------------------------
// عدد الصفحات المتوقع
// ------------------------------------------------------

const EXPECTED_PAGES = 595;

// ------------------------------------------------------
// الحروف العربية
// ------------------------------------------------------

const ARABIC_LETTERS = [
    "ا","ب","ت","ث","ج","ح","خ",
    "د","ذ","ر","ز","س","ش","ص",
    "ض","ط","ظ","ع","غ","ف","ق",
    "ك","ل","م","ن","ه","و","ي"
];

// ======================================================
// تطبيع النص العربي
// ======================================================

function normalizeArabic(text) {

    return String(text || "")
        .normalize("NFC")

        // الهمزات
        .replace(/[أإآٱ]/g, "ا")

        // الياء والألف المقصورة
        .replace(/ى/g, "ي")

        // التاء المربوطة
        .replace(/ة/g, "ه")

        // الهمزات على الواو والياء
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي")

        // التطويل
        .replace(/ـ/g, "")

        // التشكيل
        .replace(/[ًٌٍَُِّْ]/g, "")

        // مسافات زائدة
        .replace(/[ \t]+/g, " ")

        // أسطر فارغة متكررة
        .replace(/\n{3,}/g, "\n\n")

        .trim();
}

// ======================================================
// استخراج أول حرف عربي
// ======================================================

function firstArabicLetter(text) {

    const normalized = normalizeArabic(text);

    for (const char of normalized) {

        if (ARABIC_LETTERS.includes(char)) {
            return char;
        }
    }

    return "#";
}

// ======================================================
// تنظيف OCR
// ======================================================

function cleanOCR(text) {

    let result = String(text || "");

    result = result
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");

    result = result
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n");

    result = result
        .replace(/[ \t]{2,}/g, " ");

    result = result
        .replace(/\n{3,}/g, "\n\n");

    return result.trim();
}

// ======================================================
// استخراج رقم الصفحة من اسم الملف
//
// أمثلة:
//
// page-1.txt
// page_001.txt
// 1.txt
// 001.txt
// ======================================================

function getPageNumber(fileName) {

    const match = fileName.match(/(\d+)/);

    if (!match) {
        return null;
    }

    return Number(match[1]);
}

// ======================================================
// البحث عن ملفات OCR
// ======================================================

function getOCRFiles() {

    if (!fs.existsSync(OCR_FOLDER)) {

        throw new Error(
            "\nلم يتم العثور على مجلد OCR:\n" +
            OCR_FOLDER +
            "\n\n" +
            "أنشئ مجلد encyclopedia_ocr وضع داخله ملفات OCR قبل تشغيل البرنامج."
        );
    }

    const files = fs
        .readdirSync(OCR_FOLDER)
        .filter(file => {

            const ext = path
                .extname(file)
                .toLowerCase();

            return [
                ".txt",
                ".text",
                ".ocr"
            ].includes(ext);
        });

    const pages = [];

    for (const file of files) {

        const page = getPageNumber(file);

        if (page === null) {

            console.warn(
                `⚠️ تم تجاهل الملف لعدم وجود رقم صفحة: ${file}`
            );

            continue;
        }

        pages.push({
            page,
            file,
            fullPath: path.join(OCR_FOLDER, file)
        });
    }

    pages.sort((a, b) => a.page - b.page);

    return pages;
}

// ======================================================
// قراءة صفحات OCR
// ======================================================

function readPages(files) {

    const pages = [];

    for (const item of files) {

        try {

            const raw = fs.readFileSync(
                item.fullPath,
                "utf8"
            );

            const text = cleanOCR(raw);

            if (!text) {

                console.warn(
                    `⚠️ الصفحة ${item.page} فارغة: ${item.file}`
                );

                continue;
            }

            const lines = text
                .split("\n")
                .map(line => line.trim())
                .filter(Boolean);

            const title =
                lines.length > 0
                    ? lines[0]
                    : `صفحة ${item.page}`;

            pages.push({

                id: pages.length + 1,

                page: item.page,

                source_file: item.file,

                title: title,

                letter: firstArabicLetter(title),

                text: text
            });

        } catch (error) {

            console.error(
                `❌ فشل قراءة الصفحة ${item.page}:`,
                error.message
            );
        }
    }

    return pages;
}

// ======================================================
// التحقق من الصفحات
// ======================================================

function validatePages(pages) {

    const numbers = pages.map(
        page => page.page
    );

    const duplicates = numbers.filter(
        (page, index) =>
            numbers.indexOf(page) !== index
    );

    if (duplicates.length) {

        console.warn(
            "\n⚠️ صفحات مكررة:"
        );

        console.warn(
            [...new Set(duplicates)].join(", ")
        );
    }

    const missing = [];

    for (
        let page = 1;
        page <= EXPECTED_PAGES;
        page++
    ) {

        if (!numbers.includes(page)) {
            missing.push(page);
        }
    }

    if (missing.length) {

        console.warn(
            "\n⚠️ صفحات مفقودة:"
        );

        console.warn(
            missing.join(", ")
        );

    } else {

        console.log(
            "\n✅ جميع الصفحات من 1 إلى 595 موجودة."
        );
    }
}

// ======================================================
// إنشاء البيانات النهائية
// ======================================================

function buildDatabase(pages) {

    return {

        version: "1.0.0",

        language: "ar",

        title: "دائرة المعارف الكتابية",

        source: {
            type: "OCR",
            expected_pages: EXPECTED_PAGES,
            actual_pages: pages.length
        },

        generated_at:
            new Date().toISOString(),

        pages: pages
    };
}

// ======================================================
// إنشاء مجلد الناتج
// ======================================================

function prepareOutput() {

    if (!fs.existsSync(OUTPUT_FOLDER)) {

        fs.mkdirSync(
            OUTPUT_FOLDER,
            { recursive: true }
        );
    }
}

// ======================================================
// كتابة JSON
// ======================================================

function writeDatabase(database) {

    fs.writeFileSync(

        OUTPUT_FILE,

        JSON.stringify(
            database,
            null,
            2
        ),

        "utf8"
    );
}

// ======================================================
// التقرير النهائي
// ======================================================

function report(pages) {

    console.log("");
    console.log("==============================================");
    console.log("      دائرة المعارف الكتابية");
    console.log("      OCR → JSON BUILD ENGINE");
    console.log("==============================================");

    console.log("");

    console.log(
        `الصفحات المتوقعة : ${EXPECTED_PAGES}`
    );

    console.log(
        `الصفحات المعالجة : ${pages.length}`
    );

    console.log("");

    console.log(
        "ملف الناتج:"
    );

    console.log(
        OUTPUT_FILE
    );

    console.log("");

    console.log(
        "مسار التحميل داخل encyclopedia.html:"
    );

    console.log(
        "encyclopedia_text/encyclopedia_ar.json"
    );

    console.log("");

    if (pages.length === EXPECTED_PAGES) {

        console.log(
            "✅ قاعدة البيانات تحتوي على 595 صفحة."
        );

    } else {

        console.log(
            "⚠️ لم يتم الوصول إلى 595 صفحة."
        );
    }

    console.log("");

    console.log(
        "=============================================="
    );
}

// ======================================================
// تشغيل المحرك
// ======================================================

function main() {

    try {

        console.log("");
        console.log(
            "🔄 بدء بناء قاعدة بيانات دائرة المعارف..."
        );

        const files =
            getOCRFiles();

        console.log(
            `📄 تم العثور على ${files.length} ملف OCR.`
        );

        const pages =
            readPages(files);

        validatePages(pages);

        const database =
            buildDatabase(pages);

        prepareOutput();

        writeDatabase(database);

        report(pages);

    } catch (error) {

        console.error("");
        console.error(
            "❌ فشل بناء الموسوعة:"
        );

        console.error(
            error.message
        );

        process.exit(1);
    }
}

// ======================================================

main();
