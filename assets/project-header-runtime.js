(function () {
    const TRANSLATION_VERSION = '20260908-3';
    const pageName = location.pathname.split('/').pop() || 'index.html';
    const translationBundle = pageName.replace(/\.html$/, '.json');
    const TRANSLATION_SESSION_KEY = `projectTranslationsEn:${TRANSLATION_VERSION}:${translationBundle}`;
    const selectedLanguage = localStorage.getItem('bibleAppLanguage') === 'en' ? 'en' : 'ar';
    document.documentElement.lang = selectedLanguage;
    document.documentElement.dir = selectedLanguage === 'en' ? 'ltr' : 'rtl';
    document.body.dir = document.documentElement.dir;

    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = 'manifest.webmanifest';
    document.head.appendChild(manifest);

    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/png';
    favicon.sizes = '48x48';
    favicon.href = 'assets/app-icons/favicon-48.png';
    document.head.appendChild(favicon);

    const appleTouchIcon = document.createElement('link');
    appleTouchIcon.rel = 'apple-touch-icon';
    appleTouchIcon.sizes = '180x180';
    appleTouchIcon.href = 'assets/app-icons/apple-touch-icon-180.png';
    document.head.appendChild(appleTouchIcon);

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        window.addEventListener('load', async () => {
            try {
                await navigator.serviceWorker.register('service-worker.js?v=16', { updateViaCache: 'none' });
                const registration = await navigator.serviceWorker.ready;
                if (registration.active && navigator.onLine) {
                    const cacheSite = () => registration.active.postMessage('CACHE_PUBLISHED_SITE');
                    if ('requestIdleCallback' in window) requestIdleCallback(cacheSite, { timeout: 5000 });
                    else setTimeout(cacheSite, 1000);
                }
            } catch (error) {
                console.error('Unable to enable offline access.', error);
            }
        });
    }

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

    function revealProjectPage() {
        document.documentElement.classList.remove('project-english-pending');
        document.documentElement.style.removeProperty('visibility');
        document.body.classList.add('project-runtime-ready');
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
            let translationText = sessionStorage.getItem(TRANSLATION_SESSION_KEY);
            if (!translationText) {
                const response = await fetch(`assets/project-translations-pages/${translationBundle}?v=${TRANSLATION_VERSION}`);
                if (!response.ok) throw new Error(`Translation file returned ${response.status}`);
                translationText = await response.text();
                try {
                    sessionStorage.setItem(TRANSLATION_SESSION_KEY, translationText);
                } catch (_) {
                    // Translation still works when storage quota is unavailable.
                }
            }
            const translations = JSON.parse(translationText);
            const titleKey = normalizeTranslationKey(document.title);
            if (translations[titleKey]) document.title = translations[titleKey];
            translateElement(document.body, translations);
            new MutationObserver((mutations) => {
                const translationRoots = new Set();
                mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) translationRoots.add(node);
                    else if (node.nodeType === Node.TEXT_NODE && node.parentElement) translationRoots.add(node.parentElement);
                }));
                translationRoots.forEach((root) => translateElement(root, translations));
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
    const blankLineRoots = new Set();
    new MutationObserver((mutations) => {
        mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) blankLineRoots.add(node);
            else if (node.nodeType === Node.TEXT_NODE && node.parentElement) blankLineRoots.add(node.parentElement);
        }));
        if (blankLineFrame || !blankLineRoots.size) return;
        blankLineFrame = requestAnimationFrame(() => {
            blankLineFrame = 0;
            const roots = [...blankLineRoots];
            blankLineRoots.clear();
            roots.forEach(removeBlankDisplayLines);
        });
    }).observe(document.body, { childList: true, subtree: true });

    const prefetchedPages = new Set();
    const translationPrefetches = new Map();
    function prefetchTranslation(destination) {
        if (selectedLanguage !== 'en') return null;
        const bundle = destination.pathname.split('/').pop().replace(/\.html$/, '.json');
        const storageKey = `projectTranslationsEn:${TRANSLATION_VERSION}:${bundle}`;
        if (sessionStorage.getItem(storageKey)) return null;
        if (translationPrefetches.has(bundle)) return translationPrefetches.get(bundle);
        const pending = fetch(`assets/project-translations-pages/${bundle}?v=${TRANSLATION_VERSION}`)
            .then((response) => {
                if (!response.ok) throw new Error(`Translation file returned ${response.status}`);
                return response.text();
            })
            .then((translationText) => {
                try {
                    sessionStorage.setItem(storageKey, translationText);
                } catch (_) {
                    // Navigation continues when storage quota is unavailable.
                }
            })
            .catch(() => undefined);
        translationPrefetches.set(bundle, pending);
        return pending;
    }
    function prefetchPage(link) {
        if (!link || link.target || link.hasAttribute('download')) return null;
        const destination = new URL(link.href, location.href);
        if (destination.origin !== location.origin || destination.pathname === location.pathname || !destination.pathname.endsWith('.html')) return null;
        if (!prefetchedPages.has(destination.href)) {
            prefetchedPages.add(destination.href);
            const prefetch = document.createElement('link');
            prefetch.rel = 'prefetch';
            prefetch.href = destination.href;
            document.head.appendChild(prefetch);
        }
        return prefetchTranslation(destination);
    }
    document.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest('a[href]');
        const pendingTranslation = prefetchPage(link);
        if (!pendingTranslation) return;
        event.preventDefault();
        pendingTranslation.finally(() => location.assign(link.href));
    });
    document.addEventListener('pointerover', (event) => prefetchPage(event.target.closest('a[href]')), { passive: true });
    document.addEventListener('touchstart', (event) => prefetchPage(event.target.closest('a[href]')), { passive: true });
    const prefetchLinkedPages = () => document.querySelectorAll('a[href]').forEach(prefetchPage);
    if ('requestIdleCallback' in window) requestIdleCallback(prefetchLinkedPages, { timeout: 1500 });
    else setTimeout(prefetchLinkedPages, 500);

    const header = document.querySelector('header, .top-frame, .site-header');
    if (!header) {
        applyEnglishTranslations().finally(revealProjectPage);
        return;
    }
    document.body.classList.add('project-unified-header');
    const returnControl = header.querySelector('.back-button, .back-btn, .home-button, .home-btn, .back-link');
    const riversControl = header.querySelector('.header-rivers-back');
    const logo = header.querySelector('img');
    const returnHref = returnControl ? returnControl.getAttribute('href') : 'studies.html';
    const returnsHome = returnHref && new URL(returnHref, location.href).pathname.endsWith('/index.html');
    const returnText = returnsHome
        ? (selectedLanguage === 'en' ? 'Home' : 'الرئيسية')
        : (returnControl ? returnControl.textContent.replace(/[←→⌂🏠]/gu, '').trim() : (selectedLanguage === 'en' ? 'Studies' : 'الدراسات'));
    const isHomePage = location.pathname.endsWith('/index.html') || location.pathname.endsWith('index.html') || location.pathname === '/';
    header.className = 'project-header';
    header.replaceChildren();
    const brand = document.createElement('div');
    brand.className = 'project-brand';
    const brandText = document.createElement('div');
    brandText.className = 'project-brand-text';
    const brandName = document.createElement('div');
    brandName.className = 'project-brand-name';
    brandName.textContent = 'موسوعة الكتاب المقدس';
    const brandChurch = document.createElement('div');
    brandChurch.className = 'project-brand-church';
    brandChurch.textContent = 'كنيسة رجاء الأمم سيدني';
    const brandLogo = document.createElement('img');
    brandLogo.className = 'project-brand-logo';
    brandLogo.src = logo ? logo.getAttribute('src') : 'assets/logo.png';
    brandLogo.alt = 'شعار كنيسة رجاء الأمم سيدني';
    brandText.append(brandName, brandChurch);
    brand.append(brandText, brandLogo);
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
    const backIcon = document.createElement('span');
    backIcon.textContent = '↩';
    const backText = document.createElement('span');
    backText.textContent = returnText || 'الدراسات';
    back.append(backIcon, backText);
    if (!isHomePage) actions.appendChild(back);
    actions.appendChild(languageToggle);
    if (location.pathname.endsWith('/bible.html') || location.pathname.endsWith('bible.html')) {
        document.body.classList.add('project-bible-page');
        const readerSettings = document.createElement('button');
        readerSettings.className = 'project-reader-settings';
        readerSettings.type = 'button';
        readerSettings.textContent = selectedLanguage === 'en' ? '⚙ Reading settings' : '⚙ إعدادات القراءة';
        readerSettings.setAttribute('aria-label', selectedLanguage === 'en' ? 'Open reading settings' : 'فتح إعدادات القراءة');
        readerSettings.addEventListener('click', () => {
            if (typeof openReaderSettings === 'function') openReaderSettings();
        });
        actions.appendChild(readerSettings);
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
        booksReturn.textContent = selectedLanguage === 'en' ? '📖 Biblical Books' : '📖 الأسفار الكتابية';
        actions.appendChild(booksReturn);
    }
    header.append(brand, actions);
    document.querySelectorAll('footer, .footer-note').forEach((footer) => footer.remove());
    const projectFooter = document.createElement('footer');
    projectFooter.className = 'project-footer';
    projectFooter.innerHTML = '<div>موسوعة الكتاب المقدس</div><div>كنيسة رجاء الأمم سيدني</div>';
    document.body.appendChild(projectFooter);
    applyEnglishTranslations().finally(revealProjectPage);
}());
