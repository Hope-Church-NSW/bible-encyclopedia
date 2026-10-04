(function () {
    const TRANSLATION_VERSION = '20260915-4';
    const pageName = location.pathname.split('/').pop() || 'index.html';
    const translationBundle = pageName.replace(/\.html$/, '.json');
    const TRANSLATION_SESSION_KEY = `projectTranslationsEn:${TRANSLATION_VERSION}:${translationBundle}`;
    const PROJECT_PREFERENCES_KEY = 'bibleReaderPreferencesV1';
    const PROJECT_FONTS = {
        default: 'Arial, "Helvetica Neue", Tahoma, sans-serif',
        naskh: '"Geeza Pro", "Noto Naskh Arabic", "Traditional Arabic", serif',
        serif: 'Georgia, "Times New Roman", "Geeza Pro", serif',
        mono: '"Courier New", "Noto Sans Mono", monospace'
    };
    const selectedLanguage = localStorage.getItem('bibleAppLanguage') === 'en' ? 'en' : 'ar';
    const isBiblePage = location.pathname.endsWith('/bible.html') || location.pathname.endsWith('bible.html');
    document.documentElement.lang = selectedLanguage;
    document.documentElement.dir = selectedLanguage === 'en' ? 'ltr' : 'rtl';
    document.body.dir = document.documentElement.dir;

    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport && !viewport.content.includes('viewport-fit=')) {
        viewport.content = `${viewport.content}, viewport-fit=cover`;
    }

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
                await navigator.serviceWorker.register('service-worker.js?v=20', { updateViaCache: 'none' });
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

    function selectProjectLanguage(language) {
        localStorage.setItem('bibleAppLanguage', language);
        if (pageName === 'encyclopedia-letter.html') {
            location.assign('encyclopedia.html');
            return;
        }
        location.reload();
    }

    function readProjectPreferences() {
        try {
            const stored = JSON.parse(localStorage.getItem(PROJECT_PREFERENCES_KEY) || '{}');
            return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
        } catch (error) {
            console.warn('Unable to read project display settings.', error);
            return {};
        }
    }

    const projectPreferences = Object.assign(
        { theme: 'blue', font: 'default', size: 21 },
        readProjectPreferences()
    );

    function applyProjectPreferences() {
        if (!['blue', 'white', 'black'].includes(projectPreferences.theme)) projectPreferences.theme = 'blue';
        if (!PROJECT_FONTS[projectPreferences.font]) projectPreferences.font = 'default';
        projectPreferences.size = Math.min(30, Math.max(17, Number(projectPreferences.size) || 21));
        document.body.dataset.projectTheme = projectPreferences.theme;
        document.body.dataset.readerTheme = projectPreferences.theme;
        document.documentElement.style.setProperty('--reader-font-family', PROJECT_FONTS[projectPreferences.font]);
        document.documentElement.style.setProperty('--reader-font-size', `${projectPreferences.size}px`);
        document.body.style.setProperty('font-family', PROJECT_FONTS[projectPreferences.font], 'important');
        document.body.style.setProperty('--project-body-size', `${projectPreferences.size}px`);
        document.body.style.setProperty('--project-section-size', `${Math.min(38, projectPreferences.size + 7)}px`);
        document.body.style.setProperty('--project-title-size', `${Math.min(48, projectPreferences.size + 15)}px`);
        document.body.style.setProperty('font-size', `${projectPreferences.size}px`);
    }

    function saveProjectPreference(name, value) {
        if (name === 'theme' && ['blue', 'white', 'black'].includes(value)) projectPreferences.theme = value;
        if (name === 'font' && PROJECT_FONTS[value]) projectPreferences.font = value;
        if (name === 'size') projectPreferences.size = Number(value);
        applyProjectPreferences();
        localStorage.setItem(PROJECT_PREFERENCES_KEY, JSON.stringify(projectPreferences));
    }

    applyProjectPreferences();

    const languageToggle = document.createElement('button');
    languageToggle.className = 'project-language-toggle';
    languageToggle.type = 'button';
    languageToggle.setAttribute('aria-label', selectedLanguage === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية');
    languageToggle.title = selectedLanguage === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية';
    languageToggle.textContent = selectedLanguage === 'en' ? '🌐 العربية' : '🌐 English';
    languageToggle.addEventListener('click', () => {
        const language = localStorage.getItem('bibleAppLanguage') === 'en' ? 'ar' : 'en';
        selectProjectLanguage(language);
    });
    document.body.appendChild(languageToggle);

    const settingsBackdrop = document.createElement('div');
    settingsBackdrop.className = 'project-settings-backdrop';
    settingsBackdrop.hidden = true;
    settingsBackdrop.setAttribute('role', 'dialog');
    settingsBackdrop.setAttribute('aria-modal', 'true');
    settingsBackdrop.setAttribute('aria-labelledby', 'projectSettingsTitle');
    const settingsPanel = document.createElement('div');
    settingsPanel.className = 'project-settings-panel';
    const settingsHeading = document.createElement('div');
    settingsHeading.className = 'project-settings-heading';
    const settingsTitle = document.createElement('h2');
    settingsTitle.id = 'projectSettingsTitle';
    settingsTitle.textContent = selectedLanguage === 'en' ? 'Project settings' : 'إعدادات المشروع';
    const settingsClose = document.createElement('button');
    settingsClose.className = 'project-settings-close';
    settingsClose.type = 'button';
    settingsClose.textContent = '×';
    settingsClose.setAttribute('aria-label', selectedLanguage === 'en' ? 'Close settings' : 'إغلاق الإعدادات');
    settingsHeading.append(settingsTitle, settingsClose);
    const settingsOptions = document.createElement('div');
    settingsOptions.className = 'project-settings-options';

    const fontGroup = document.createElement('label');
    fontGroup.className = 'project-setting-group';
    const fontLabel = document.createElement('span');
    fontLabel.className = 'project-setting-label';
    fontLabel.textContent = selectedLanguage === 'en' ? 'Font type' : 'نوع الخط';
    const fontSelect = document.createElement('select');
    fontSelect.className = 'project-setting-select';
    [
        ['default', selectedLanguage === 'en' ? 'Clear font' : 'خط واضح'],
        ['naskh', selectedLanguage === 'en' ? 'Arabic Naskh' : 'نسخ عربي'],
        ['serif', selectedLanguage === 'en' ? 'Traditional font' : 'خط تقليدي'],
        ['mono', selectedLanguage === 'en' ? 'Monospace' : 'خط ثابت العرض']
    ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        fontSelect.appendChild(option);
    });
    fontSelect.value = projectPreferences.font;
    fontSelect.addEventListener('change', () => saveProjectPreference('font', fontSelect.value));
    fontGroup.append(fontLabel, fontSelect);

    const sizeGroup = document.createElement('label');
    sizeGroup.className = 'project-setting-group';
    const sizeLabel = document.createElement('span');
    sizeLabel.className = 'project-setting-label';
    sizeLabel.textContent = selectedLanguage === 'en' ? 'Font size' : 'حجم الخط';
    const sizeRow = document.createElement('span');
    sizeRow.className = 'project-setting-range-row';
    const sizeRange = document.createElement('input');
    sizeRange.className = 'project-setting-range';
    sizeRange.type = 'range';
    sizeRange.min = '17';
    sizeRange.max = '30';
    sizeRange.step = '1';
    sizeRange.value = String(projectPreferences.size);
    const sizeValue = document.createElement('output');
    sizeValue.className = 'project-setting-size-value';
    sizeValue.textContent = `${projectPreferences.size} px`;
    sizeRange.addEventListener('input', () => {
        sizeValue.textContent = `${sizeRange.value} px`;
        saveProjectPreference('size', sizeRange.value);
    });
    sizeRow.append(sizeRange, sizeValue);
    sizeGroup.append(sizeLabel, sizeRow);

    const themeGroup = document.createElement('div');
    themeGroup.className = 'project-setting-group';
    const themeLabel = document.createElement('span');
    themeLabel.className = 'project-setting-label';
    themeLabel.textContent = selectedLanguage === 'en' ? 'Background' : 'الخلفية';
    const themeOptions = document.createElement('div');
    themeOptions.className = 'project-theme-options';
    [['blue', selectedLanguage === 'en' ? 'Blue' : 'أزرق'], ['white', selectedLanguage === 'en' ? 'White' : 'أبيض'], ['black', selectedLanguage === 'en' ? 'Black' : 'أسود']].forEach(([theme, label]) => {
        const option = document.createElement('button');
        option.className = 'project-settings-option';
        option.type = 'button';
        option.textContent = label;
        option.setAttribute('aria-pressed', String(projectPreferences.theme === theme));
        option.addEventListener('click', () => {
            saveProjectPreference('theme', theme);
            themeOptions.querySelectorAll('button').forEach((button) => {
                button.setAttribute('aria-pressed', String(button === option));
            });
        });
        themeOptions.appendChild(option);
    });
    themeGroup.append(themeLabel, themeOptions);
    settingsOptions.append(fontGroup, sizeGroup, themeGroup);
    settingsPanel.append(settingsHeading, settingsOptions);
    settingsBackdrop.appendChild(settingsPanel);
    document.body.appendChild(settingsBackdrop);

    const settingsToggle = document.createElement('button');
    settingsToggle.className = 'project-reader-settings';
    settingsToggle.type = 'button';
    settingsToggle.textContent = '⚙';
    settingsToggle.title = selectedLanguage === 'en' ? 'Settings' : 'الإعدادات';
    settingsToggle.setAttribute('aria-label', selectedLanguage === 'en' ? 'Open settings' : 'فتح الإعدادات');
    settingsToggle.addEventListener('click', () => {
        settingsBackdrop.hidden = false;
        settingsClose.focus();
    });
    const closeSettings = () => {
        settingsBackdrop.hidden = true;
        settingsToggle.focus();
    };
    settingsClose.addEventListener('click', closeSettings);
    settingsBackdrop.addEventListener('click', (event) => {
        if (event.target === settingsBackdrop) closeSettings();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !settingsBackdrop.hidden) closeSettings();
    });
    document.body.appendChild(settingsToggle);

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
    const back = document.createElement('a');
    back.className = 'project-return';
    back.href = returnHref;
    const backIcon = document.createElement('span');
    backIcon.textContent = '↩';
    const backText = document.createElement('span');
    backText.textContent = returnText || 'الدراسات';
    back.append(backIcon, backText);
    if (!isHomePage) actions.appendChild(back);
    if (isBiblePage) {
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
