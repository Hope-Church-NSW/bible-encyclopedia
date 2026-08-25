/* =========================================================
   موسوعة الكتاب المقدس
   محرك قاعدة البيانات المركزية
   Database: encyclopedia_ar.json
   ========================================================= */

(() => {
    "use strict";

    /* ---------------------------------------------------------
       إعدادات قاعدة البيانات
       --------------------------------------------------------- */

    const DATA_URL = "./encyclopedia_ar.json";

    let encyclopediaData = null;
    let allEntries = [];
    let currentLetter = null;

    /* ---------------------------------------------------------
       الحروف العربية
       --------------------------------------------------------- */

    const ARABIC_LETTERS = [
        "ا", "ب", "ت", "ث", "ج", "ح", "خ",
        "د", "ذ", "ر", "ز", "س", "ش", "ص",
        "ض", "ط", "ظ", "ع", "غ", "ف", "ق",
        "ك", "ل", "م", "ن", "ه", "و", "ي"
    ];

    /* ---------------------------------------------------------
       أدوات عامة
       --------------------------------------------------------- */

    function normalizeArabic(text) {
        return String(text || "")
            .trim()
            .replace(/[أإآٱ]/g, "ا")
            .replace(/ى/g, "ي")
            .replace(/ة/g, "ه")
            .replace(/ـ/g, "")
            .replace(/[\u064B-\u065F\u0670]/g, "");
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getEntryLetter(entry) {
        if (entry.letter) {
            return normalizeArabic(entry.letter).charAt(0);
        }

        if (entry.title) {
            return normalizeArabic(entry.title).charAt(0);
        }

        return "";
    }

    function getEntryText(entry) {
        return (
            entry.text ||
            entry.content ||
            entry.description ||
            entry.body ||
            ""
        );
    }

    function getScriptureReferences(entry) {
        if (Array.isArray(entry.scripture)) {
            return entry.scripture;
        }

        if (Array.isArray(entry.scripture_references)) {
            return entry.scripture_references;
        }

        if (Array.isArray(entry.references)) {
            return entry.references;
        }

        return [];
    }

    function getKeywords(entry) {
        if (Array.isArray(entry.keywords)) {
            return entry.keywords;
        }

        return [];
    }

    function getRelatedEntries(entry) {
        if (Array.isArray(entry.related_entries)) {
            return entry.related_entries;
        }

        if (Array.isArray(entry.related)) {
            return entry.related;
        }

        return [];
    }

    function getSources(entry) {
        if (Array.isArray(entry.sources)) {
            return entry.sources;
        }

        return [];
    }

    /* ---------------------------------------------------------
       تحويل النص إلى فقرات
       --------------------------------------------------------- */

    function formatText(text) {
        if (!text) {
            return "";
        }

        return String(text)
            .split(/\n{2,}/)
            .map(paragraph => paragraph.trim())
            .filter(Boolean)
            .map(paragraph => `<p>${escapeHTML(paragraph)}</p>`)
            .join("");
    }

    /* ---------------------------------------------------------
       تحميل قاعدة البيانات
       --------------------------------------------------------- */

    async function loadEncyclopedia() {

        try {

            showLoading();

            const response = await fetch(DATA_URL, {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data = await response.json();

            encyclopediaData = data;

            /* -------------------------------------------------
               دعم أكثر من شكل لقاعدة البيانات
               ------------------------------------------------- */

            if (Array.isArray(data.entries)) {

                allEntries = data.entries;

            } else if (Array.isArray(data)) {

                allEntries = data;

            } else {

                allEntries = [];

                if (data.letters && typeof data.letters === "object") {

                    Object.values(data.letters).forEach(letterData => {

                        if (Array.isArray(letterData)) {
                            allEntries.push(...letterData);
                        }

                        if (
                            letterData &&
                            Array.isArray(letterData.entries)
                        ) {
                            allEntries.push(...letterData.entries);
                        }

                    });

                }

            }

            normalizeEntries();

            renderLetters();

            if (allEntries.length > 0) {

                const firstLetter = getEntryLetter(allEntries[0]);

                if (firstLetter) {
                    showLetter(firstLetter);
                } else {
                    showEmptyState();
                }

            } else {

                showEmptyState();

            }

        } catch (error) {

            console.error(
                "Encyclopedia loading error:",
                error
            );

            showError(error);

        }

    }

    /* ---------------------------------------------------------
       توحيد البيانات
       --------------------------------------------------------- */

    function normalizeEntries() {

        allEntries = allEntries
            .filter(entry => entry && typeof entry === "object")
            .map(entry => {

                const normalizedLetter =
                    getEntryLetter(entry);

                return {
                    ...entry,

                    _letter: normalizedLetter,

                    _title:
                        entry.title ||
                        entry.name ||
                        "مدخل بدون عنوان",

                    _text:
                        getEntryText(entry),

                    _scripture:
                        getScriptureReferences(entry),

                    _keywords:
                        getKeywords(entry),

                    _related:
                        getRelatedEntries(entry),

                    _sources:
                        getSources(entry)

                };

            });

        /* ترتيب عربي */

        allEntries.sort((a, b) => {

            return String(a._title)
                .localeCompare(
                    String(b._title),
                    "ar",
                    {
                        sensitivity: "base"
                    }
                );

        });

    }

    /* ---------------------------------------------------------
       إظهار الحروف
       --------------------------------------------------------- */

    function renderLetters() {

        const container =
            document.querySelector(
                "#letters"
            ) ||
            document.querySelector(
                ".letters"
            ) ||
            document.querySelector(
                "[data-letters]"
            );

        if (!container) {
            console.warn(
                "لم يتم العثور على حاوية الحروف."
            );
            return;
        }

        container.innerHTML = "";

        ARABIC_LETTERS.forEach(letter => {

            const count =
                allEntries.filter(entry =>
                    normalizeArabic(entry._letter) ===
                    normalizeArabic(letter)
                ).length;

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "encyclopedia-letter";

            if (
                currentLetter &&
                normalizeArabic(currentLetter) ===
                normalizeArabic(letter)
            ) {
                button.classList.add("active");
            }

            button.dataset.letter = letter;

            button.innerHTML = `
                <span class="letter">${escapeHTML(letter)}</span>
                <span class="count">${count}</span>
            `;

            button.addEventListener(
                "click",
                () => showLetter(letter)
            );

            container.appendChild(button);

        });

    }

    /* ---------------------------------------------------------
       عرض حرف
       --------------------------------------------------------- */

    function showLetter(letter) {

        currentLetter = letter;

        renderLetters();

        const entries =
            allEntries.filter(entry =>
                normalizeArabic(entry._letter) ===
                normalizeArabic(letter)
            );

        const container =
            document.querySelector(
                "#entries"
            ) ||
            document.querySelector(
                ".entries"
            ) ||
            document.querySelector(
                "[data-entries]"
            );

        if (!container) {
            console.warn(
                "لم يتم العثور على حاوية المداخل."
            );
            return;
        }

        if (!entries.length) {

            container.innerHTML = `
                <div class="encyclopedia-empty">
                    <div class="empty-icon">📖</div>
                    <h3>لا توجد مداخل</h3>
                    <p>
                        لا توجد مداخل مسجلة حاليًا تحت حرف
                        ${escapeHTML(letter)}
                    </p>
                </div>
            `;

            updateLetterTitle(letter, 0);

            return;
        }

        container.innerHTML = entries
            .map(renderEntry)
            .join("");

        updateLetterTitle(
            letter,
            entries.length
        );

    }

    /* ---------------------------------------------------------
       عنوان الحرف وعدد المداخل
       --------------------------------------------------------- */

    function updateLetterTitle(letter, count) {

        const elements = [

            document.querySelector(
                "#current-letter"
            ),

            document.querySelector(
                "#selected-letter"
            ),

            document.querySelector(
                ".current-letter"
            ),

            document.querySelector(
                "[data-current-letter]"
            )

        ].filter(Boolean);

        elements.forEach(element => {

            element.textContent =
                `${letter} (${count})`;

        });

    }

    /* ---------------------------------------------------------
       إنشاء مدخل موسوعي
       --------------------------------------------------------- */

    function renderEntry(entry) {

        const title =
            escapeHTML(entry._title);

        const category =
            entry.category
                ? escapeHTML(entry.category)
                : "";

        const text =
            formatText(entry._text);

        const scripture =
            renderScripture(
                entry._scripture
            );

        const keywords =
            renderKeywords(
                entry._keywords
            );

        const related =
            renderRelated(
                entry._related
            );

        const sources =
            renderSources(
                entry._sources
            );

        return `

            <article
                class="encyclopedia-entry"
                id="entry-${escapeHTML(entry.id || "")}"
                data-entry-id="${escapeHTML(entry.id || "")}"
            >

                <header class="entry-header">

                    <div>

                        <h2 class="entry-title">
                            ${title}
                        </h2>

                        ${
                            category
                                ? `
                                    <div class="entry-category">
                                        ${category}
                                    </div>
                                  `
                                : ""
                        }

                    </div>

                </header>

                <div class="entry-body">

                    ${
                        text
                            ? `
                                <section class="entry-text">
                                    ${text}
                                </section>
                              `
                            : ""
                    }

                    ${scripture}

                    ${keywords}

                    ${related}

                    ${sources}

                </div>

            </article>

        `;

    }

    /* ---------------------------------------------------------
       المراجع الكتابية
       --------------------------------------------------------- */

    function renderScripture(references) {

        if (!references.length) {
            return "";
        }

        return `

            <section class="entry-section scripture-section">

                <h3>
                    📖 المراجع الكتابية
                </h3>

                <div class="reference-list">

                    ${references
                        .map(reference => `
                            <span class="reference-item">
                                ${escapeHTML(reference)}
                            </span>
                        `)
                        .join("")}

                </div>

            </section>

        `;

    }

    /* ---------------------------------------------------------
       الكلمات المفتاحية
       --------------------------------------------------------- */

    function renderKeywords(keywords) {

        if (!keywords.length) {
            return "";
        }

        return `

            <section class="entry-section keywords-section">

                <h3>
                    🔎 الكلمات المفتاحية
                </h3>

                <div class="keyword-list">

                    ${keywords
                        .map(keyword => `
                            <span class="keyword">
                                ${escapeHTML(keyword)}
                            </span>
                        `)
                        .join("")}

                </div>

            </section>

        `;

    }

    /* ---------------------------------------------------------
       المداخل المرتبطة
       --------------------------------------------------------- */

    function renderRelated(related) {

        if (!related.length) {
            return "";
        }

        return `

            <section class="entry-section related-section">

                <h3>
                    🔗 مداخل مرتبطة
                </h3>

                <div class="related-list">

                    ${related
                        .map(item => `
                            <button
                                type="button"
                                class="related-entry"
                                data-related="${escapeHTML(item)}"
                            >
                                ${escapeHTML(item)}
                            </button>
                        `)
                        .join("")}

                </div>

            </section>

        `;

    }

    /* ---------------------------------------------------------
       المصادر
       --------------------------------------------------------- */

    function renderSources(sources) {

        if (!sources.length) {
            return "";
        }

        return `

            <section class="entry-section sources-section">

                <h3>
                    📚 المصادر
                </h3>

                <div class="sources-list">

                    ${sources
                        .map(source => {

                            if (
                                typeof source === "string"
                            ) {

                                return `
                                    <div class="source-item">
                                        ${escapeHTML(source)}
                                    </div>
                                `;

                            }

                            const name =
                                source.name ||
                                source.title ||
                                source.source ||
                                "";

                            const type =
                                source.type || "";

                            const url =
                                source.url ||
                                source.link ||
                                "";

                            if (url) {

                                return `
                                    <div class="source-item">

                                        <a
                                            href="${escapeHTML(url)}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            ${escapeHTML(name)}
                                        </a>

                                        ${
                                            type
                                                ? `
                                                    <span class="source-type">
                                                        ${escapeHTML(type)}
                                                    </span>
                                                  `
                                                : ""
                                        }

                                    </div>
                                `;

                            }

                            return `
                                <div class="source-item">

                                    <strong>
                                        ${escapeHTML(name)}
                                    </strong>

                                    ${
                                        type
                                            ? `
                                                <span class="source-type">
                                                    ${escapeHTML(type)}
                                                </span>
                                              `
                                            : ""
                                    }

                                </div>
                            `;

                        })
                        .join("")}

                </div>

            </section>

        `;

    }

    /* ---------------------------------------------------------
       البحث داخل الموسوعة
       --------------------------------------------------------- */

    function searchEntries(query) {

        const normalizedQuery =
            normalizeArabic(query);

        if (!normalizedQuery) {

            if (currentLetter) {
                showLetter(currentLetter);
            }

            return;

        }

        const results =
            allEntries.filter(entry => {

                const searchable = [

                    entry._title,

                    entry._text,

                    entry.category,

                    ...(entry._keywords || []),

                    ...(entry._related || []),

                    ...(entry._scripture || [])

                ]
                    .filter(Boolean)
                    .join(" ");

                return normalizeArabic(
                    searchable
                ).includes(
                    normalizedQuery
                );

            });

        renderSearchResults(
            results,
            query
        );

    }

    /* ---------------------------------------------------------
       نتائج البحث
       --------------------------------------------------------- */

    function renderSearchResults(
        results,
        query
    ) {

        const container =
            document.querySelector(
                "#entries"
            ) ||
            document.querySelector(
                ".entries"
            ) ||
            document.querySelector(
                "[data-entries]"
            );

        if (!container) {
            return;
        }

        if (!results.length) {

            container.innerHTML = `

                <div class="encyclopedia-empty">

                    <div class="empty-icon">
                        🔎
                    </div>

                    <h3>
                        لا توجد نتائج
                    </h3>

                    <p>
                        لم يتم العثور على مدخل يطابق:
                        <strong>
                            ${escapeHTML(query)}
                        </strong>
                    </p>

                </div>

            `;

            return;

        }

        container.innerHTML = `

            <div class="search-results-header">

                <h2>
                    نتائج البحث
                </h2>

                <div>
                    ${results.length} مدخل
                </div>

            </div>

            ${results
                .map(renderEntry)
                .join("")}

        `;

        attachRelatedEvents();

    }

    /* ---------------------------------------------------------
       ربط المداخل المرتبطة
       --------------------------------------------------------- */

    function attachRelatedEvents() {

        document
            .querySelectorAll(
                ".related-entry"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const title =
                            button.dataset.related;

                        const normalized =
                            normalizeArabic(title);

                        const entry =
                            allEntries.find(item =>
                                normalizeArabic(
                                    item._title
                                ) === normalized
                            );

                        if (!entry) {

                            console.warn(
                                "المدخل المرتبط غير موجود:",
                                title
                            );

                            return;

                        }

                        const element =
                            document.querySelector(
                                `[data-entry-id="${CSS.escape(entry.id || "")}"]`
                            );

                        if (element) {

                            element.scrollIntoView({
                                behavior: "smooth",
                                block: "start"
                            });

                        } else {

                            const letter =
                                getEntryLetter(entry);

                            if (letter) {

                                showLetter(
                                    letter
                                );

                                setTimeout(() => {

                                    const target =
                                        document.querySelector(
                                            `[data-entry-id="${CSS.escape(entry.id || "")}"]`
                                        );

                                    if (target) {

                                        target.scrollIntoView({
                                            behavior: "smooth",
                                            block: "start"
                                        });

                                    }

                                }, 100);

                            }

                        }

                    }
                );

            });

    }

    /* ---------------------------------------------------------
       حالات الواجهة
       --------------------------------------------------------- */

    function showLoading() {

        const container =
            document.querySelector(
                "#entries"
            ) ||
            document.querySelector(
                ".entries"
            ) ||
            document.querySelector(
                "[data-entries]"
            );

        if (!container) {
            return;
        }

        container.innerHTML = `

            <div class="encyclopedia-loading">

                <div class="loading-icon">
                    📚
                </div>

                <h3>
                    جارٍ تحميل الموسوعة
                </h3>

                <p>
                    يرجى الانتظار...
                </p>

            </div>

        `;

    }

    function showEmptyState() {

        const container =
            document.querySelector(
                "#entries"
            ) ||
            document.querySelector(
                ".entries"
            ) ||
            document.querySelector(
                "[data-entries]"
            );

        if (!container) {
            return;
        }

        container.innerHTML = `

            <div class="encyclopedia-empty">

                <div class="empty-icon">
                    📚
                </div>

                <h3>
                    قاعدة الموسوعة فارغة
                </h3>

                <p>
                    لم يتم العثور على أي مداخل في
                    encyclopedia_ar.json
                </p>

            </div>

        `;

    }

    function showError(error) {

        const container =
            document.querySelector(
                "#entries"
            ) ||
            document.querySelector(
                ".entries"
            ) ||
            document.querySelector(
                "[data-entries]"
            );

        if (!container) {
            return;
        }

        container.innerHTML = `

            <div class="encyclopedia-error">

                <div class="error-icon">
                    ⚠️
                </div>

                <h3>
                    تعذر تحميل الموسوعة
                </h3>

                <p>
                    تأكد من وجود الملف:
                </p>

                <strong>
                    encyclopedia_ar.json
                </strong>

                <p class="error-details">
                    ${escapeHTML(error.message)}
                </p>

            </div>

        `;

    }

    /* ---------------------------------------------------------
       البحث من عناصر HTML الموجودة
       --------------------------------------------------------- */

    function initializeSearch() {

        const searchInputs = [

            document.querySelector(
                "#encyclopedia-search"
            ),

            document.querySelector(
                "#searchInput"
            ),

            document.querySelector(
                "#search"
            ),

            document.querySelector(
                "[data-search]"
            )

        ].filter(Boolean);

        searchInputs.forEach(input => {

            input.addEventListener(
                "input",
                event => {

                    searchEntries(
                        event.target.value
                    );

                }
            );

            input.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Escape"
                    ) {

                        input.value = "";

                        if (currentLetter) {
                            showLetter(
                                currentLetter
                            );
                        }

                    }

                }
            );

        });

    }

    /* ---------------------------------------------------------
       دعم الروابط ?letter=
       --------------------------------------------------------- */

    function initializeURL() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const letter =
            params.get("letter");

        if (!letter) {
            return false;
        }

        const normalized =
            normalizeArabic(letter);

        const validLetter =
            ARABIC_LETTERS.find(item =>
                normalizeArabic(item) ===
                normalized
            );

        if (validLetter) {

            currentLetter =
                validLetter;

            return true;

        }

        return false;

    }

    /* ---------------------------------------------------------
       تشغيل الموسوعة
       --------------------------------------------------------- */

    document.addEventListener(
        "DOMContentLoaded",
        async () => {

            initializeSearch();

            const urlLetter =
                initializeURL();

            await loadEncyclopedia();

            if (urlLetter) {

                showLetter(
                    currentLetter
                );

            }

            attachRelatedEvents();

        }
    );

    /* ---------------------------------------------------------
       واجهة عامة اختيارية
       يمكن للصفحات الأخرى استخدامها
       --------------------------------------------------------- */

    window.BibleEncyclopedia = {

        getData: () =>
            encyclopediaData,

        getEntries: () =>
            allEntries,

        showLetter,

        searchEntries,

        getEntry: id =>
            allEntries.find(
                entry =>
                    String(entry.id) ===
                    String(id)
            )

    };

})();
