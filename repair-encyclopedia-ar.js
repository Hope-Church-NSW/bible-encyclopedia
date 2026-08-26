"use strict";

const fs = require("fs");

const SOURCE = "encyclopedia_ar.json";
const OUTPUT = "encyclopedia_ar_repaired.json";

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
            if (!started) {
                started = true;
            }

            depth++;
            continue;
        }

        if (ch === "}") {
            depth--;

            if (started && depth === 0) {
                return {
                    jsonText: text.slice(0, i + 1),
                    remainder: text.slice(i + 1)
                };
            }
        }
    }

    throw new Error(
        "تعذر العثور على نهاية الكائن JSON الأول."
    );
}

function main() {
    console.log("========================================");
    console.log("إصلاح encyclopedia_ar.json");
    console.log("========================================");

    if (!fs.existsSync(SOURCE)) {
        throw new Error(
            `الملف غير موجود: ${SOURCE}`
        );
    }

    const original = fs.readFileSync(
        SOURCE,
        "utf8"
    );

    if (!original.trim()) {
        throw new Error(
            "encyclopedia_ar.json فارغ."
        );
    }

    console.log("1. قراءة الملف: OK");

    const extracted = extractFirstJSONObject(
        original
    );

    console.log("2. العثور على أول كائن JSON: OK");

    let firstObject;

    try {
        firstObject = JSON.parse(
            extracted.jsonText
        );
    } catch (error) {
        throw new Error(
            "الكائن JSON الأول نفسه غير صالح:\n" +
            error.message
        );
    }

    console.log("3. التحقق من الكائن الأول: OK");

    if (
        !firstObject ||
        typeof firstObject !== "object" ||
        !Array.isArray(firstObject.entries)
    ) {
        throw new Error(
            'الكائن الأول لا يحتوي على مصفوفة "entries".'
        );
    }

    console.log(
        `4. عدد المداخل في الكائن الأول: ${firstObject.entries.length}`
    );

    const remainder = extracted.remainder.trim();

    if (!remainder) {
        throw new Error(
            "لا يوجد نص زائد بعد الكائن الأول. الملف قد يكون صالحًا بالفعل."
        );
    }

    console.log(
        "5. تم اكتشاف محتوى إضافي بعد نهاية JSON الأول."
    );

    let secondObject = null;

    try {
        secondObject = JSON.parse(remainder);
    } catch {
        console.log(
            "6. المحتوى الإضافي ليس JSON مستقلًا صالحًا بالكامل."
        );
    }

    if (secondObject) {
        console.log(
            "6. المحتوى الإضافي هو كائن JSON مستقل."
        );

        if (
            secondObject &&
            Array.isArray(secondObject.entries)
        ) {
            console.log(
                `   عدد مداخل الكائن الثاني: ${secondObject.entries.length}`
            );

            const firstIds = new Set(
                firstObject.entries
                    .map(entry => entry?.id)
                    .filter(Boolean)
            );

            const secondIds = new Set(
                secondObject.entries
                    .map(entry => entry?.id)
                    .filter(Boolean)
            );

            const overlap = [...secondIds]
                .filter(id => firstIds.has(id));

            console.log(
                `   IDs مشتركة بين الكائنين: ${overlap.length}`
            );

            if (
                overlap.length ===
                Math.min(
                    firstIds.size,
                    secondIds.size
                )
            ) {
                console.log(
                    "   النتيجة: البيانات الإضافية تبدو نسخة مكررة من الأولى."
                );
            }
        }
    }

    /*
     * لا نعدل الملف الأصلي.
     * نكتب فقط أول كائن JSON صالح إلى ملف جديد.
     */
    fs.writeFileSync(
        OUTPUT,
        JSON.stringify(
            firstObject,
            null,
            2
        ) + "\n",
        "utf8"
    );

    console.log("");
    console.log("========================================");
    console.log("تم إنشاء الملف:");
    console.log(OUTPUT);
    console.log("========================================");
    console.log("");
    console.log(
        "الملف الأصلي encyclopedia_ar.json لم يتم تعديله."
    );
}

try {
    main();
} catch (error) {
    console.error("");
    console.error("✖ فشل الإصلاح");
    console.error(error.message);
    process.exit(1);
}
