document.addEventListener("DOMContentLoaded", async () => {

    /* =====================================================
       إعدادات الموسوعة
    ===================================================== */

    const DATA_URL = "./encyclopedia-data.json";

    const ARABIC_LETTERS = [
        "ا", "ب", "ت", "ث", "ج", "ح", "خ",
        "د", "ذ", "ر", "ز", "س", "ش", "ص",
        "ض", "ط", "ظ", "ع", "غ", "ف", "ق",
        "ك", "ل", "م", "ن", "ه", "و", "ي"
    ];


    /* =====================================================
       عناصر الصفحة
    ===================================================== */

    const lettersGrid =
        document.getElementById("lettersGrid");

    const entriesList =
        document.getElementById("entriesList");

    const entriesTitle =
        document.getElementById("entriesTitle");

    const entriesCount =
        document.getElementById("entriesCount");

    const entrySearch =
        document.getElementById("entrySearch");

    const articleContainer =
        document.getElementById("articleContainer");


    let entries = [];

    let selectedLetter = null;



    /* =====================================================
       تطبيع النص العربي
    ===================================================== */

    function normalizeArabic(value) {

        return String(value || "")
            .trim()
            .replace(/[إأآٱ]/g, "ا")
            .replace(/ى/g, "ي")
            .replace(/ة/g, "ه")
            .replace(/ؤ/g, "و")
            .replace(/ئ/g, "ي")
            .replace(/[ًٌٍَُِّْـ]/g, "");

    }



    /* =====================================================
       الحصول على الحرف
    ===================================================== */

    function getEntryLetter(entry) {

        if (entry.letter) {

            const letter =
                normalizeArabic(entry.letter)
                    .charAt(0);

            return letter;

        }

        return normalizeArabic(entry.title)
            .charAt(0);
    }



    /* =====================================================
       ترتيب المداخل
    ===================================================== */

    function sortEntries(list) {

        return [...list].sort((a, b) => {

            return normalizeArabic(a.title)
                .localeCompare(
                    normalizeArabic(b.title),
                    "ar"
                );

        });

    }



    /* =====================================================
       إنشاء الحروف الـ28
    ===================================================== */

    function renderLetters() {

        lettersGrid.innerHTML = "";

        ARABIC_LETTERS.forEach(letter => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "letter-button";

            button.textContent =
                letter;

            button.dataset.letter =
                letter;


            const count =
                entries.filter(entry =>
                    getEntryLetter(entry) === letter
                ).length;


            if (count > 0) {

                button.classList.add(
                    "has-entries"
                );

            }


            button.title =
                count > 0
                    ? `${count} مدخل`
                    : `لا توجد مداخل بعد`;


            button.addEventListener(
                "click",
                () => selectLetter(letter)
            );


            lettersGrid.appendChild(button);

        });

    }



    /* =====================================================
       اختيار الحرف
    ===================================================== */

    function selectLetter(letter) {

        selectedLetter = letter;


        document
            .querySelectorAll(".letter-button")
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.letter === letter
                );

            });


        entrySearch.value = "";


        const letterEntries =
            entries.filter(entry =>
                getEntryLetter(entry) === letter
            );


        renderEntries(letterEntries);


        articleContainer.innerHTML = `

            <div class="article-placeholder">

                <div class="placeholder-icon">
                    📖
                </div>

                <h2>
                    مداخل حرف ${escapeHTML(letter)}
                </h2>

                <p>
                    اختر أحد المداخل من القائمة
                    لعرض الدراسة كاملة هنا.
                </p>

            </div>

        `;

    }



    /* =====================================================
       عرض قائمة المداخل
    ===================================================== */

    function renderEntries(list) {

        const sorted =
            sortEntries(list);


        entriesList.innerHTML = "";


        if (selectedLetter) {

            entriesTitle.textContent =
                `مداخل حرف ${selectedLetter}`;

        } else {

            entriesTitle.textContent =
                "المداخل";

        }


        entriesCount.textContent =
            `${sorted.length} مدخل`;


        if (sorted.length === 0) {

            entriesList.innerHTML = `

                <div class="empty-state">

                    <div class="empty-icon">
                        📖
                    </div>

                    <div>
                        لا توجد مداخل لهذا الحرف.
                    </div>

                </div>

            `;

            return;

        }


        sorted.forEach(entry => {

            const button =
                document.createElement("button");


            button.type = "button";

            button.className =
                "entry-item";


            button.dataset.id =
                entry.id;


            button.innerHTML = `

                <span class="entry-item-title">
                    ${escapeHTML(entry.title)}
                </span>

                ${
                    entry.category
                        ? `
                            <span class="entry-item-category">
                                ${escapeHTML(entry.category)}
                            </span>
                        `
                        : ""
                }

            `;


            button.addEventListener(
                "click",
                () => openEntry(entry)
            );


            entriesList.appendChild(button);

        });

    }



    /* =====================================================
       فتح المدخل
    ===================================================== */

    function openEntry(entry) {

        document
            .querySelectorAll(".entry-item")
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.id === entry.id
                );

            });


        const paragraphs =
            String(entry.text || "")
                .split(/\n\s*\n/)
                .filter(text => text.trim());


        const articleText =
            paragraphs
                .map(paragraph => {

                    return `
                        <p>
                            ${escapeHTML(paragraph)
                                .replace(/\n/g, "<br>")}
                        </p>
                    `;

                })
                .join("");


        const referencesHTML =
            buildReferences(entry);


        const keywordsHTML =
            buildKeywords(entry);


        const relatedHTML =
            buildRelatedEntries(entry);


        const sourcesHTML =
            buildSources(entry);


        articleContainer.innerHTML = `

            <div class="article-header">

                <div class="article-category">

                    ${
                        entry.category
                            ? escapeHTML(entry.category)
                            : "مدخل موسوعي"
                    }

                </div>


                <h1>
                    ${escapeHTML(entry.title)}
                </h1>


                <div class="article-letter">

                    حرف ${escapeHTML(
                        getEntryLetter(entry)
                    )}

                </div>

            </div>


            <div class="article-body">

                ${articleText}

            </div>


            ${referencesHTML}

            ${keywordsHTML}

            ${relatedHTML}

            ${sourcesHTML}

        `;


        bindRelatedEntries();


        articleContainer.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }



    /* =====================================================
       المراجع الكتابية
    ===================================================== */

    function buildReferences(entry) {

        if (
            !Array.isArray(
                entry.scripture_references
            ) ||
            entry.scripture_references.length === 0
        ) {

            return "";

        }


        return `

            <section class="article-section">

                <h3>
                    📖 المراجع الكتابية
                </h3>

                <div class="reference-list">

                    ${entry.scripture_references
                        .map(reference => `

                            <span class="reference-chip">

                                ${escapeHTML(reference)}

                            </span>

                        `)
                        .join("")}

                </div>

            </section>

        `;

    }



    /* =====================================================
       الكلمات المفتاحية
    ===================================================== */

    function buildKeywords(entry) {

        if (
            !Array.isArray(entry.keywords) ||
            entry.keywords.length === 0
        ) {

            return "";

        }


        return `

            <section class="article-section">

                <h3>
                    🔎 الكلمات المرتبطة
                </h3>

                <div class="keyword-list">

                    ${entry.keywords
                        .map(keyword => `

                            <span class="keyword-chip">

                                ${escapeHTML(keyword)}

                            </span>

                        `)
                        .join("")}

                </div>

            </section>

        `;

    }



    /* =====================================================
       المداخل المرتبطة
    ===================================================== */

    function buildRelatedEntries(entry) {

        if (
            !Array.isArray(entry.related_entries) ||
            entry.related_entries.length === 0
        ) {

            return "";

        }


        return `

            <section class="article-section">

                <h3>
                    🔗 مداخل مرتبطة
                </h3>

                <div class="related-list">

                    ${entry.related_entries
                        .map(title => `

                            <button
                                type="button"
                                class="related-entry"
                                data-title="${escapeHTML(title)}"
                            >

                                ${escapeHTML(title)}

                            </button>

                        `)
                        .join("")}

                </div>

            </section>

        `;

    }



    /* =====================================================
       المصادر
    ===================================================== */

    function buildSources(entry) {

        if (
            !Array.isArray(entry.sources) ||
            entry.sources.length === 0
        ) {

            return "";

        }


        return `

            <section class="article-section">

                <h3>
                    📚 المصادر
                </h3>

                <div class="sources-list">

                    ${entry.sources
                        .map(source => `

                            <div class="source-item">

                                <strong>
                                    ${escapeHTML(
                                        source.name || ""
                                    )}
                                </strong>

                                ${
                                    source.type
                                        ? `
                                            <span>
                                                ${escapeHTML(
                                                    source.type
                                                )}
                                            </span>
                                        `
                                        : ""
                                }

                            </div>

                        `)
                        .join("")}

                </div>

            </section>

        `;

    }



    /* =====================================================
       تشغيل المداخل المرتبطة
    ===================================================== */

    function bindRelatedEntries() {

        document
            .querySelectorAll(".related-entry")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const title =
                            button.dataset.title;


                        const normalized =
                            normalizeArabic(title);


                        const found =
                            entries.find(entry => {

                                return normalizeArabic(
                                    entry.title
                                ) === normalized;

                            });


                        if (found) {

                            openEntry(found);

                        } else {

                            alert(
                                `المدخل "${title}" لم تتم إضافته إلى الموسوعة بعد.`
                            );

                        }

                    }
                );

            });

    }



    /* =====================================================
       البحث
    ===================================================== */

    entrySearch.addEventListener(
        "input",
        () => {

            const query =
                normalizeArabic(
                    entrySearch.value
                );


            let sourceEntries = entries;


            if (selectedLetter) {

                sourceEntries =
                    entries.filter(entry =>
                        getEntryLetter(entry) ===
                        selectedLetter
                    );

            }


            if (!query) {

                renderEntries(
                    sourceEntries
                );

                return;

            }


            const results =
                sourceEntries.filter(entry => {

                    const title =
                        normalizeArabic(
                            entry.title
                        );


                    const text =
                        normalizeArabic(
                            entry.text
                        );


                    const keywords =
                        Array.isArray(
                            entry.keywords
                        )
                            ? normalizeArabic(
                                entry.keywords.join(" ")
                            )
                            : "";


                    const references =
                        Array.isArray(
                            entry.scripture_references
                        )
                            ? normalizeArabic(
                                entry.scripture_references
                                    .join(" ")
                            )
                            : "";


                    return (
                        title.includes(query) ||
                        text.includes(query) ||
                        keywords.includes(query) ||
                        references.includes(query)
                    );

                });


            renderEntries(results);

        }
    );



    /* =====================================================
       حماية HTML
    ===================================================== */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }



    /* =====================================================
       تحميل قاعدة البيانات
    ===================================================== */

    async function loadDatabase() {

        try {

            entriesList.innerHTML = `

                <div class="empty-state">

                    <div class="empty-icon">
                        ⏳
                    </div>

                    <div>
                        جاري تحميل الموسوعة...
                    </div>

                </div>

            `;


            const response =
                await fetch(
                    DATA_URL,
                    {
                        cache: "no-store"
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );

            }


            const data =
                await response.json();


            if (
                !data ||
                !Array.isArray(data.entries)
            ) {

                throw new Error(
                    "ملف encyclopedia-data.json لا يحتوي على entries صحيحة."
                );

            }


            entries =
                data.entries.filter(entry =>
                    entry &&
                    entry.title &&
                    entry.text
                );


            entries =
                sortEntries(entries);


            renderLetters();


            entriesCount.textContent =
                "اختر حرفًا";


            entriesList.innerHTML = `

                <div class="empty-state">

                    <div class="empty-icon">
                        📖
                    </div>

                    <div>
                        اختر حرفًا من الأعلى
                    </div>

                </div>

            `;


        } catch (error) {

            console.error(
                "Encyclopedia error:",
                error
            );


            lettersGrid.innerHTML = "";


            entriesList.innerHTML = `

                <div class="empty-state error-state">

                    <div class="empty-icon">
                        ⚠️
                    </div>

                    <h3>
                        تعذر تحميل الموسوعة
                    </h3>

                    <p>
                        تأكد من وجود الملف:
                    </p>

                    <strong>
                        encyclopedia-data.json
                    </strong>

                    <p>
                        في نفس مجلد encyclopedia.html
                    </p>

                    <small>
                        ${escapeHTML(error.message)}
                    </small>

                </div>

            `;


            articleContainer.innerHTML = `

                <div class="article-placeholder">

                    <div class="placeholder-icon">
                        ⚠️
                    </div>

                    <h2>
                        تعذر تحميل قاعدة البيانات
                    </h2>

                    <p>
                        ${escapeHTML(error.message)}
                    </p>

                </div>

            `;

        }

    }



    /* =====================================================
       بدء الموسوعة
    ===================================================== */

    await loadDatabase();

});
