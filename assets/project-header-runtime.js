(function () {
    const selectedLanguage = localStorage.getItem('bibleAppLanguage') === 'en' ? 'en' : 'ar';
    document.documentElement.lang = selectedLanguage;
    document.documentElement.dir = selectedLanguage === 'en' ? 'ltr' : 'rtl';
    document.body.dir = document.documentElement.dir;

    function normalizeTranslationKey(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function translatePattern(value) {
        const patterns = [
            [/^الأصحاح\s+(\d+)$/, 'Chapter $1'],
            [/^(\d+)\s+سفرًا$/, '$1 Books'],
            [/^نتائج البحث عن:\s*(.+)$/, 'Search results for: $1']
        ];
        for (const [pattern, replacement] of patterns) {
            if (pattern.test(value)) return value.replace(pattern, replacement);
        }
        return '';
    }

    function translateElement(root, translations) {
        const scope = root && root.nodeType === Node.ELEMENT_NODE ? root : document.body;
        if (!scope) return;
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        textNodes.forEach((node) => {
            if (!node.parentElement || /^(SCRIPT|STYLE|PRE|TEXTAREA)$/.test(node.parentElement.tagName)) return;
            const key = normalizeTranslationKey(node.nodeValue);
            const translation = translations[key] || translatePattern(key);
            if (!key || key.length === 1 || !translation) return;
            const leading = node.nodeValue.match(/^\s*/)[0];
            const trailing = node.nodeValue.match(/\s*$/)[0];
            node.nodeValue = `${leading}${translation}${trailing}`;
        });
        scope.querySelectorAll('[title], [placeholder], [aria-label], [alt]').forEach((element) => {
            ['title', 'placeholder', 'aria-label', 'alt'].forEach((attribute) => {
                const value = element.getAttribute(attribute);
                const translation = translations[normalizeTranslationKey(value)];
                if (translation) element.setAttribute(attribute, translation);
            });
        });
    }

    async function applyEnglishTranslations() {
        if (selectedLanguage !== 'en') return;
        try {
            const response = await fetch('assets/project-translations-en.json?v=20260831-2');
            if (!response.ok) throw new Error(`Translation file returned ${response.status}`);
            const translations = await response.json();
            const titleKey = normalizeTranslationKey(document.title);
            if (translations[titleKey]) document.title = translations[titleKey];
            translateElement(document.body, translations);
            let translationFrame = 0;
            new MutationObserver((mutations) => {
                if (translationFrame) return;
                const added = mutations.flatMap((mutation) => [...mutation.addedNodes]).find((node) => node.nodeType === Node.ELEMENT_NODE);
                if (!added) return;
                translationFrame = requestAnimationFrame(() => {
                    translationFrame = 0;
                    translateElement(document.body, translations);
                });
            }).observe(document.body, { childList: true, subtree: true });
        } catch (error) {
            console.error('Unable to load English translations.', error);
        }
    }

    const isEntryPage = location.pathname.endsWith('/index.html') || location.pathname.endsWith('index.html') || location.pathname === '/';
    if (!isEntryPage && !localStorage.getItem('bibleAppSession')) {
        location.replace('index.html');
        return;
    }

    function removeBlankDisplayLines(root) {
        const scope = root && root.nodeType === Node.ELEMENT_NODE ? root : document.body;
        if (!scope) return;
        scope.querySelectorAll('br + br').forEach((element) => element.remove());
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach((node) => {
            if (node.parentElement && /^(SCRIPT|STYLE|PRE|TEXTAREA)$/.test(node.parentElement.tagName)) return;
            if (node.parentElement && /^(P|LI)$/.test(node.parentElement.tagName) && !node.nodeValue.trim()) {
                node.nodeValue = '';
                return;
            }
            const compacted = node.nodeValue.replace(/(\r?\n[ \t]*){2,}/g, '\n');
            if (compacted !== node.nodeValue) node.nodeValue = compacted;
        });
    }

    window.removeProjectBlankLines = removeBlankDisplayLines;
    removeBlankDisplayLines(document.body);
    let blankLineFrame = 0;
    new MutationObserver((mutations) => {
        if (blankLineFrame) return;
        const added = mutations.flatMap((mutation) => [...mutation.addedNodes]).find((node) => node.nodeType === Node.ELEMENT_NODE);
        if (!added) return;
        blankLineFrame = requestAnimationFrame(() => {
            blankLineFrame = 0;
            removeBlankDisplayLines(document.body);
        });
    }).observe(document.body, { childList: true, subtree: true });

    const header = document.querySelector('header, .top-frame, .site-header');
    if (!header) return;
    document.body.classList.add('project-unified-header');
    const returnControl = header.querySelector('.back-button, .back-btn, .home-button, .home-btn, .back-link');
    const riversControl = header.querySelector('.header-rivers-back');
    const logo = header.querySelector('img');
    const returnHref = returnControl ? returnControl.getAttribute('href') : 'studies.html';
    const returnText = returnControl ? returnControl.textContent.replace(/[←→⌂]/g, '').trim() : 'الدراسات';
    const isHomePage = location.pathname.endsWith('/index.html') || location.pathname.endsWith('index.html') || location.pathname === '/';
    header.className = 'project-header';
    header.replaceChildren();
    const brand = document.createElement('div');
    brand.className = 'project-brand';
    brand.innerHTML = `<div class="project-brand-text"><div class="project-brand-name">موسوعة الكتاب المقدس</div><div class="project-brand-church">كنيسة رجاء الأمم سيدني</div></div><img class="project-brand-logo" src="${logo ? logo.getAttribute('src') : 'assets/logo.png'}" alt="شعار كنيسة رجاء الأمم سيدني">`;
    const actions = document.createElement('div');
    actions.className = 'project-header-actions';
    const languageToggle = document.createElement('button');
    languageToggle.className = 'project-language-toggle';
    languageToggle.type = 'button';
    languageToggle.setAttribute('aria-label', 'Switch language');
    languageToggle.textContent = selectedLanguage === 'en' ? 'العربية' : 'English';
    languageToggle.addEventListener('click', () => {
        const language = localStorage.getItem('bibleAppLanguage') === 'en' ? 'ar' : 'en';
        localStorage.setItem('bibleAppLanguage', language);
        location.reload();
    });
    const back = document.createElement('a');
    back.className = 'project-return';
    back.href = returnHref;
    back.innerHTML = `<span>↩</span><span>${returnText || 'الدراسات'}</span>`;
    if (!isHomePage) actions.appendChild(back);
    actions.appendChild(languageToggle);
    if (location.pathname.endsWith('/bible.html') || location.pathname.endsWith('bible.html')) {
        document.body.classList.add('project-bible-page');
        const bibleHome = document.createElement('button');
        bibleHome.id = 'bibleHomeButton';
        bibleHome.className = 'project-books-return project-bible-return';
        bibleHome.type = 'button';
        bibleHome.hidden = true;
        bibleHome.innerHTML = '<span>📖</span><span>الكتاب المقدس</span>';
        bibleHome.addEventListener('click', () => {
            if (typeof renderTestaments === 'function') renderTestaments();
        });
        actions.appendChild(bibleHome);
    }
    if (riversControl) { riversControl.className = 'project-rivers-return'; actions.appendChild(riversControl); }
    if (location.pathname.endsWith('study-biblical-books-introductions.html')) {
        const booksReturn = document.createElement('a');
        booksReturn.className = 'project-books-return';
        booksReturn.href = '#bookIndex';
        booksReturn.textContent = '📖 الأسفار الكتابية';
        actions.appendChild(booksReturn);
    }
    header.append(brand, actions);
    document.querySelectorAll('footer, .footer-note').forEach((footer) => footer.remove());
    const projectFooter = document.createElement('footer');
    projectFooter.className = 'project-footer';
    projectFooter.innerHTML = '<div>موسوعة الكتاب المقدس</div><div>كنيسة رجاء الأمم سيدني</div>';
    document.body.appendChild(projectFooter);
    applyEnglishTranslations();
}());
