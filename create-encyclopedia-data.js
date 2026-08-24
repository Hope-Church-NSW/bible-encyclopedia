const fs = require("fs");
const path = require("path");

// ============================================
// إعدادات الموسوعة
// ============================================

const ROOT = __dirname;

const FOLDER_NAME = "encyclopedia_text";
const FILE_NAME = "encyclopedia_ar.json";

const DATA_FOLDER = path.join(ROOT, FOLDER_NAME);
const DATA_FILE = path.join(DATA_FOLDER, FILE_NAME);

// ============================================
// إنشاء مجلد بيانات الموسوعة
// ============================================

if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

// ============================================
// الهيكل الأساسي لملف الموسوعة
// ============================================

const encyclopediaData = {
    pages: [
        {
            page: 1,
            text: "دائرة المعارف الكتابية"
        }
    ]
};

// ============================================
// كتابة ملف JSON
// ============================================

fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(encyclopediaData, null, 2),
    "utf8"
);

// ============================================
// النتيجة
// ============================================

console.log("");
console.log("============================================");
console.log("تم إنشاء بيانات دائرة المعارف بنجاح");
console.log("============================================");
console.log("");

console.log("المجلد:");
console.log(DATA_FOLDER);

console.log("");

console.log("الملف:");
console.log(DATA_FILE);

console.log("");

console.log("مسار الربط داخل encyclopedia.html:");
console.log("encyclopedia_text/encyclopedia_ar.json");

console.log("");

console.log("============================================");
console.log("الخطوة الأولى اكتملت بنجاح");
console.log("============================================");
