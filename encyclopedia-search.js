/* =========================================================
   موسوعة الكتاب المقدس
   encyclopedia-search.js

   المسؤول عن:
   1. تحميل encyclopedia-data.json
   2. إنشاء الحروف العربية الـ28
   3. تصفية المداخل حسب الحرف
   4. ترتيب المداخل أبجديًا
   5. البحث داخل المداخل
   6. عرض المدخل كاملًا داخل الصفحة
   7. دعم النصوص الطويلة
========================================================= */


/* =========================================================
   إعدادات قاعدة البيانات
========================================================= */

const ENCYCLOPEDIA_DATA_URL =
    "encyclopedia-data.json";


/* =========================================================
   الحروف العربية الـ28
========================================================= */

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


/* =========================================================
   حالة التطبيق
========================================================= */

let encyclopediaEntries = [];

let currentLetter = null;

let currentEntries = [];

let currentSearch = "";


/* =========================================================
   عناصر الصفحة
========================================================= */

const lettersGrid =
    document.getElementById(
        "lettersGrid"
    );


const entriesList =
    document.getElementById(
        "entriesList"
    );


const entriesTitle =
    document.getElementById(
        "entriesTitle"
    );


const entriesCount =
    document.getElementById(
        "entriesCount"
    );


const entrySearch =
    document.getElementById(
        "entrySearch"
    );


const articleContainer =
    document.getElementById(
        "articleContainer"
    );


/* =========================================================
   بدء الموسوعة
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeEncyclopedia
);


async function initializeEncyclopedia(){

    renderLetters();

    showLoading();

    try{

        await loadEncyclopediaData();

        entriesList.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    📖
                </div>

                <div>
                    اختر حرفًا من الأعلى
                    لعرض المداخل التابعة له.
                </div>

            </div>
        `;

    }

    catch(error){

        console.error(
            "Encyclopedia error:",
            error
        );

        showError(
            error
        );

    }

}


/* =========================================================
   إنشاء الحروف العربية
========================================================= */

function renderLetters(){

    lettersGrid.innerHTML = "";


    ARABIC_LETTERS.forEach(
        letter => {

            const button =
                document.createElement(
                    "button"
                );


            button.type = "button";

            button.className =
                "letter-button";


            button.textContent =
                letter;


            button.dataset.letter =
                letter;


            button.setAttribute(
                "aria-label",
                `حرف ${letter}`
            );


            button.addEventListener(
                "click",
                () => {

                    selectLetter(
                        letter
                    );

                }
            );


            lettersGrid.appendChild(
                button
            );

        }
    );

}


/* =========================================================
   تحميل قاعدة البيانات
========================================================= */

async function loadEncyclopediaData(){

    const response =
        await fetch(
            ENCYCLOPEDIA_DATA_URL,
            {
                cache:"no-cache"
            }
        );


    if(!response.ok){

        throw new Error(
            `تعذر تحميل ${ENCYCLOPEDIA_DATA_URL} — HTTP ${response.status}`
        );

    }


    const rawData =
        await response.json();


    encyclopediaEntries =
        normalizeDatabase(
            rawData
        );


    /*
     * ترتيب قاعدة البيانات بالكامل
     */

    encyclopediaEntries.sort(
        compareEntries
    );

}


/* =========================================================
   توحيد بنية قاعدة البيانات
========================================================= */

function normalizeDatabase(
    data
){

    let entries = [];


    /*
     * الشكل الأساسي:
     *
     * [
     *   {...},
     *   {...}
     * ]
     */

    if(Array.isArray(data)){

        entries =
            data;

    }


    /*
     * الشكل:
     *
     * {
     *   "entries":[...]
     * }
     */

    else if(
        data &&
        Array.isArray(
            data.entries
        )
    ){

        entries =
            data.entries;

    }


    /*
     * الشكل:
     *
     * {
     *   "articles":[...]
     * }
     */

    else if(
        data &&
        Array.isArray(
            data.articles
        )
    ){

        entries =
            data.articles;

    }


    /*
     * الشكل:
     *
     * {
     *   "items":[...]
     * }
     */

    else if(
        data &&
        Array.isArray(
            data.items
        )
    ){

        entries =
            data.items;

    }


    /*
     * دعم تنظيم البيانات حسب الحروف:
     *
     * {
     *   "ا":[...],
     *   "ب":[...]
     * }
     */

    else if(
        data &&
        typeof data === "object"
    ){

        for(
            const key
            of Object.keys(data)
        ){

            if(
                !Array.isArray(
                    data[key]
                )
            ){

                continue;

            }


            data[key].forEach(
                item => {

                    if(
                        item &&
                        typeof item ===
                        "object"
                    ){

                        entries.push({

                            ...item,

                            letter:
                                item.letter ||
                                key

                        });

                    }

                }
            );

        }

    }


    return entries
        .map(
            normalizeEntry
        )
        .filter(
            entry =>
                entry.title ||
                entry.text
        );

}


/* =========================================================
   توحيد المدخل
========================================================= */

function normalizeEntry(
    item,
    index
){

    /*
     * إذا كان المدخل مجرد نص
     */

    if(
        typeof item ===
        "string"
    ){

        return {

            id:index,

            title:
                item.trim(),

            letter:
                getFirstArabicLetter(
                    item
                ),

            text:
                item

        };

    }


    const title =
        item.title ??
        item.name ??
        item.heading ??
        item.entry ??
        item.term ??
        "";


    const text =
        item.text ??
        item.content ??
        item.body ??
        item.article ??
        item.description ??
        "";


    const suppliedLetter =
        item.letter ??
        item.char ??
        item.firstLetter ??
        "";


    return {

        ...item,

        id:
            item.id ??
            index,

        title:
            String(title)
                .trim(),

        letter:
            normalizeLetter(
                suppliedLetter ||
                getFirstArabicLetter(
                    title
                )
            ),

        text:
            text

    };

}


/* =========================================================
   اختيار الحرف
========================================================= */

function selectLetter(
    letter
){

    currentLetter =
        letter;


    currentSearch =
        "";


    if(entrySearch){

        entrySearch.value =
            "";

    }


    /*
     * تحديث الزر النشط
     */

    document
        .querySelectorAll(
            ".letter-button"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.letter ===
                    letter
                );

            }
        );


    /*
     * استخراج المداخل
     */

    currentEntries =
        encyclopediaEntries
            .filter(
                entry => {

                    const entryLetter =
                        normalizeLetter(
                            entry.letter ||
                            getFirstArabicLetter(
                                entry.title
                            )
                        );


                    return (
                        entryLetter ===
                        letter
                    );

                }
            )
            .sort(
                compareEntries
            );


    /*
     * تحديث العنوان
     */

    entriesTitle.textContent =
        `مداخل حرف ${letter}`;


    updateEntriesCount(
        currentEntries.length
    );


    /*
     * عرض المداخل
     */

    renderEntries(
        currentEntries
    );


    /*
     * إعادة المقال إلى وضع البداية
     */

    showArticlePlaceholder(
        letter
    );

}


/* =========================================================
   عرض المداخل
========================================================= */

function renderEntries(
    entries
){

    entriesList.innerHTML = "";


    if(
        entries.length === 0
    ){

        entriesList.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    📚
                </div>

                <div>
                    لا توجد مداخل لهذا الحرف
                    حاليًا.
                </div>

            </div>

        `;

        return;

    }


    entries.forEach(
        (entry,index) => {

            const button =
                document.createElement(
                    "button"
                );


            button.type = "button";


            button.className =
                "entry-button";


            button.textContent =
                entry.title;


            button.dataset.index =
                String(index);


            button.addEventListener(
                "click",
                () => {

                    openEntry(
                        entry,
                        button
                    );

                }
            );


            entriesList.appendChild(
                button
            );

        }
    );

}


/* =========================================================
   فتح المدخل
========================================================= */

function openEntry(
    entry,
    clickedButton
){

    /*
     * إزالة النشاط من جميع المداخل
     */

    document
        .querySelectorAll(
            ".entry-button"
        )
        .forEach(
            button => {

                button.classList.remove(
                    "active"
                );

            }
        );


    /*
     * تحديد المدخل الحالي
     */

    if(clickedButton){

        clickedButton.classList.add(
            "active"
        );

    }


    /*
     * بناء المقال
     */

    const title =
        escapeHtml(
            entry.title
        );


    const content =
        renderArticleContent(
            entry.text
        );


    articleContainer.innerHTML = `

        <h1 class="article-title">
            ${title}
        </h1>

        <div class="article-content">
            ${content}
        </div>

    `;


    /*
     * عند الهاتف ننتقل إلى المقال
     */

    if(
        window.innerWidth <=
        1050
    ){

        document
            .getElementById(
                "articlePanel"
            )
            .scrollIntoView({
                behavior:"smooth",
                block:"start"
            });

    }

}


/* =========================================================
   عرض محتوى المقال
========================================================= */

function renderArticleContent(
    text
){

    if(
        text === null ||
        text === undefined
    ){

        return `
            <p>
                لا يوجد نص لهذا المدخل.
            </p>
        `;

    }


    /*
     * النص إذا كان مصفوفة
     */

    if(
        Array.isArray(text)
    ){

        return text
            .map(
                item => {

                    if(
                        item &&
                        typeof item ===
                        "object"
                    ){

                        const value =
                            item.text ??
                            item.content ??
                            item.body ??
                            "";


                        return createParagraphs(
                            value
                        );

                    }


                    return createParagraphs(
                        item
                    );

                }
            )
            .join("");

    }


    /*
     * النص العادي
     */

    return createParagraphs(
        String(text)
    );

}


/* =========================================================
   تحويل النص الطويل إلى فقرات
========================================================= */

function createParagraphs(
    value
){

    if(
        value === null ||
        value === undefined
    ){

        return "";

    }


    const safe =
        escapeHtml(
            String(value)
        )
        .replace(
            /\r\n/g,
            "\n"
        )
        .replace(
            /\r/g,
            "\n"
        );


    /*
     * فصل الفقرات الفعلية
     */

    const paragraphs =
        safe.split(
            /\n{2,}/
        );


    return paragraphs
        .map(
            paragraph => {

                const content =
                    paragraph
                        .replace(
                            /\n/g,
                            "<br>"
                        );


                if(
                    !content.trim()
                ){

                    return "";

                }


                return `
                    <p>
                        ${content}
                    </p>
                `;

            }
        )
        .join("");

}


/* =========================================================
   البحث داخل المداخل
========================================================= */

if(entrySearch){

    entrySearch.addEventListener(
        "input",
        function(){

            currentSearch =
                this.value
                    .trim()
                    .toLocaleLowerCase(
                        "ar"
                    );


            if(
                !currentLetter
            ){

                return;

            }


            /*
             * إذا لم يوجد بحث
             */

            if(
                !currentSearch
            ){

                renderEntries(
                    currentEntries
                );


                updateEntriesCount(
                    currentEntries.length
                );


                return;

            }


            /*
             * البحث في العنوان والنص
             */

            const filtered =
                currentEntries.filter(
                    entry => {

                        const title =
                            String(
                                entry.title ||
                                ""
                            )
                            .toLocaleLowerCase(
                                "ar"
                            );


                        const text =
                            String(
                                entry.text ||
                                ""
                            )
                            .toLocaleLowerCase(
                                "ar"
                            );


                        return (
                            title.includes(
                                currentSearch
                            ) ||
                            text.includes(
                                currentSearch
                            )
                        );

                    }
                );


            renderEntries(
                filtered
            );


            updateEntriesCount(
                filtered.length,
                currentEntries.length
            );

        }
    );

}


/* =========================================================
   عداد المداخل
========================================================= */

function updateEntriesCount(
    visible,
    total = null
){

    if(
        total === null
    ){

        entriesCount.textContent =
            `${visible} مدخل`;

        return;

    }


    entriesCount.textContent =
        `${visible} من ${total}`;

}


/* =========================================================
   رسالة بداية المقال
========================================================= */

function showArticlePlaceholder(
    letter
){

    articleContainer.innerHTML = `

        <div class="article-placeholder">

            <div class="placeholder-icon">
                📚
            </div>

            <h2>
                مداخل حرف ${escapeHtml(letter)}
            </h2>

            <p>
                اختر أحد المداخل من القائمة
                لعرض الدراسة كاملة هنا.
            </p>

        </div>

    `;

}


/* =========================================================
   رسالة التحميل
========================================================= */

function showLoading(){

    entriesList.innerHTML = `

        <div class="loading-state">

            جاري تحميل قاعدة بيانات
            الموسوعة...

        </div>

    `;

}


/* =========================================================
   رسالة الخطأ
========================================================= */

function showError(
    error
){

    entriesList.innerHTML = `

        <div class="error-state">

            ❌ تعذر تحميل بيانات الموسوعة.

            <br><br>

            تأكد من وجود الملف:

            <strong>
                encyclopedia-data.json
            </strong>

            في نفس مجلد:

            <strong>
                encyclopedia.html
            </strong>

            <br><br>

            ${escapeHtml(
                error.message
            )}

        </div>

    `;


    articleContainer.innerHTML = `

        <div class="article-placeholder">

            <div class="placeholder-icon">
                ⚠️
            </div>

            <h2>
                تعذر تحميل الموسوعة
            </h2>

            <p>
                راجع اسم ملف قاعدة البيانات
                ومكانه.
            </p>

        </div>

    `;

}


/* =========================================================
   ترتيب المداخل أبجديًا
========================================================= */

function compareEntries(
    a,
    b
){

    const titleA =
        normalizeSortText(
            a.title
        );


    const titleB =
        normalizeSortText(
            b.title
        );


    return titleA.localeCompare(
        titleB,
        "ar",
        {
            sensitivity:"base",
            numeric:false
        }
    );

}


/* =========================================================
   تجهيز النص للترتيب
========================================================= */

function normalizeSortText(
    value
){

    return String(
        value || ""
    )
    .trim()
    .replace(
        /^ال/,
        ""
    )
    .replace(
        /^أ/,
        "ا"
    )
    .replace(
        /^إ/,
        "ا"
    )
    .replace(
        /^آ/,
        "ا"
    )
    .replace(
        /^ٱ/,
        "ا"
    );

}


/* =========================================================
   استخراج الحرف الأول
========================================================= */

function getFirstArabicLetter(
    value
){

    if(!value){

        return "";

    }


    let text =
        String(value)
            .trim();


    /*
     * إزالة أل التعريف
     * للتصنيف الأبجدي
     */

    text =
        text.replace(
            /^[اأإآٱ]ل/,
            ""
        );


    return normalizeLetter(
        text.charAt(0)
    );

}


/* =========================================================
   توحيد الحروف
========================================================= */

function normalizeLetter(
    value
){

    if(!value){

        return "";

    }


    const letter =
        String(value)
            .trim()
            .charAt(0);


    /*
     * أشكال الألف
     */

    if(
        letter === "أ" ||
        letter === "إ" ||
        letter === "آ" ||
        letter === "ٱ"
    ){

        return "ا";

    }


    /*
     * الألف المقصورة
     */

    if(
        letter === "ى"
    ){

        return "ي";

    }


    return letter;

}


/* =========================================================
   حماية النص من HTML
========================================================= */

function escapeHtml(
    value
){

    return String(
        value ?? ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}
