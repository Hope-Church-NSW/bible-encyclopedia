const http = require('http');
const fs = require('fs');
const path = require('path');
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
    await page.evaluate((value) => localStorage.setItem('bibleAppLanguage', value), language);
}

async function waitForPage(page) {
    await page.waitForFunction(() => document.body.classList.contains('project-runtime-ready'));
    await page.addStyleTag({ content: 'html { scrollbar-width: none; } ::-webkit-scrollbar { display: none; }' });
}

async function captureSet(browser, baseUrl, device, locale) {
    const context = await browser.newContext({
        viewport: device.viewport,
        deviceScaleFactor: device.deviceScaleFactor
    });
    const page = await context.newPage();
    const output = path.join(outputRoot, device.folder, locale);
    fs.mkdirSync(output, { recursive: true });

    await page.goto(`${baseUrl}/bible.html`);
    await setLanguage(page, locale);
    await page.reload();
    await waitForPage(page);
    await page.waitForFunction(() => typeof openChapter === 'function' && Array.isArray(verses) && verses.length > 0);
    await page.evaluate(() => openChapter('43-John', 1));
    await page.waitForFunction(() => document.querySelectorAll('.verse').length > 2);
    await page.screenshot({ path: path.join(output, '01-john-chapter-1.png') });

    await page.goto(`${baseUrl}/studies.html`);
    await waitForPage(page);
    await page.screenshot({ path: path.join(output, '02-bible-studies.png') });

    await setLanguage(page, 'en');
    await page.goto(`${baseUrl}/bible.html`);
    await waitForPage(page);
    await page.waitForFunction(() => document.body.innerText.includes('Old Testament'));
    await page.screenshot({ path: path.join(output, '03-bible-testaments-en.png') });

    await setLanguage(page, locale);
    await page.goto(`${baseUrl}/study-biblical-books-introductions.html`);
    await waitForPage(page);
    await page.screenshot({ path: path.join(output, '04-bible-books-introductions.png') });

    await context.close();
}

async function main() {
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
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});