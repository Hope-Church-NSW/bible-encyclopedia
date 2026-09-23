const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const root = path.join(__dirname, 'dist');
const outputRoot = path.join(__dirname, 'app-store');
const mimeTypes = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
};

function startServer() {
    const server = http.createServer((request, response) => {
        const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
        const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const filePath = path.resolve(root, relativePath);
        if (!filePath.startsWith(`${root}${path.sep}`)) {
            response.writeHead(403).end();
            return;
        }
        fs.readFile(filePath, (error, content) => {
            if (error) {
                response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
                return;
            }
            response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
            response.end(content);
        });
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function setLanguage(page, language) {
    await page.evaluate((value) => {
        localStorage.setItem('bibleAppLanguage', value);
        localStorage.setItem('bibleAppSession', 'app-store-screenshot-capture');
    }, language);
}

async function waitForPage(page) {
    await page.waitForFunction(() => document.body.classList.contains('project-runtime-ready'));
}

async function prepareStoreCapture(page, view) {
    const viewRules = {
        chapter: '.verse:nth-child(n + 7) { display: none !important; }',
        studies: '.study-card:nth-child(n + 7) { display: none !important; }',
        testaments: '.search-container { display: none !important; } .testaments { margin-top: 24px !important; }',
        books: '.book-card:nth-child(n + 5), #newTestament { display: none !important; }'
    };
    await page.addStyleTag({ content: `
        html, body { overflow: hidden !important; scrollbar-width: none; }
        ::-webkit-scrollbar { display: none; }
        .project-language-toggle, .project-reader-settings, .project-footer { display: none !important; }
        .project-header-actions { display: none !important; }
        body.project-unified-header .project-brand {
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
            transform: none !important;
        }
        body.project-unified-header .project-brand-name,
        body.project-unified-header .project-brand-church {
            left: 58px !important;
            right: 0 !important;
            width: auto !important;
            white-space: nowrap !important;
        }
        ${viewRules[view] || ''}
    ` });
    await page.evaluate(() => window.scrollTo(0, 0));
}

function pngDimensions(file) {
    const header = fs.readFileSync(file).subarray(0, 24);
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function validateScreenshots(devices) {
    for (const device of devices) {
        for (const locale of ['ar', 'en']) {
            const folder = path.join(outputRoot, device.folder, locale);
            const files = fs.readdirSync(folder).filter((file) => file.endsWith('.png')).sort();
            if (files.length !== 4) throw new Error(`${folder} must contain exactly four screenshots.`);
            for (const file of files) {
                const fullPath = path.join(folder, file);
                const dimensions = pngDimensions(fullPath);
                const expectedWidth = device.viewport.width * device.deviceScaleFactor;
                const expectedHeight = device.viewport.height * device.deviceScaleFactor;
                if (dimensions.width !== expectedWidth || dimensions.height !== expectedHeight) {
                    throw new Error(`${fullPath} has invalid dimensions ${dimensions.width}x${dimensions.height}.`);
                }
                if (fs.statSync(fullPath).size < 100000) throw new Error(`${fullPath} appears incomplete.`);
            }
        }

        const arabic = fs.readFileSync(path.join(outputRoot, device.folder, 'ar', '03-bible-testaments.png'));
        const english = fs.readFileSync(path.join(outputRoot, device.folder, 'en', '03-bible-testaments.png'));
        if (crypto.createHash('sha256').update(arabic).digest('hex') === crypto.createHash('sha256').update(english).digest('hex')) {
            throw new Error(`${device.folder || 'iphone'} testament screenshots must be localized.`);
        }
    }
}

async function captureSet(browser, baseUrl, device, locale) {
    const deviceName = device.folder || 'iphone';
    console.log(`Capturing ${deviceName}/${locale}...`);
    const context = await browser.newContext({
        viewport: device.viewport,
        deviceScaleFactor: device.deviceScaleFactor
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(20000);
    const output = path.join(outputRoot, device.folder, locale);
    fs.mkdirSync(output, { recursive: true });

    await page.goto(`${baseUrl}/index.html`);
    await setLanguage(page, locale);
    await page.goto(`${baseUrl}/bible.html`);
    await waitForPage(page);
    await page.waitForSelector('.testaments');
    await page.evaluate(() => openChapter('43-John', 1));
    await page.waitForSelector('.verse:nth-child(3)');
    await prepareStoreCapture(page, 'chapter');
    await page.screenshot({ path: path.join(output, '01-john-chapter-1.png') });
    console.log(`  ${deviceName}/${locale}/01`);

    await page.goto(`${baseUrl}/studies.html`);
    await waitForPage(page);
    await prepareStoreCapture(page, 'studies');
    await page.screenshot({ path: path.join(output, '02-bible-studies.png') });
    console.log(`  ${deviceName}/${locale}/02`);

    await setLanguage(page, locale);
    await page.goto(`${baseUrl}/bible.html`);
    await waitForPage(page);
    await page.waitForSelector('.testaments');
    await prepareStoreCapture(page, 'testaments');
    await page.screenshot({ path: path.join(output, '03-bible-testaments.png') });
    console.log(`  ${deviceName}/${locale}/03`);

    await setLanguage(page, locale);
    await page.goto(`${baseUrl}/study-biblical-books-introductions.html`);
    await waitForPage(page);
    await prepareStoreCapture(page, 'books');
    await page.screenshot({ path: path.join(output, '04-bible-books-introductions.png') });
    console.log(`  ${deviceName}/${locale}/04`);

    await context.close();
    console.log(`Captured ${deviceName}/${locale}.`);
}

async function main() {
    console.log('Preparing App Store screenshots...');
    fs.rmSync(outputRoot, { recursive: true, force: true });
    const server = await startServer();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const browser = await chromium.launch({ headless: true });
    const devices = [
        { folder: '', viewport: { width: 414, height: 896 }, deviceScaleFactor: 3 },
        { folder: 'ipad', viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2 }
    ];

    try {
        for (const device of devices) {
            await captureSet(browser, baseUrl, device, 'ar');
            await captureSet(browser, baseUrl, device, 'en');
        }
        validateScreenshots(devices);
        console.log('Validated 16 localized App Store screenshots.');
    } finally {
        await browser.close();
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});