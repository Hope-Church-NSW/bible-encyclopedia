const fs = require('fs');
const path = require('path');

const root = __dirname;
const outputDirectory = path.join(root, 'assets', 'project-translations-pages');
const translations = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'project-translations-en.json'), 'utf8'));
const arabic = /[\u0600-\u06ff]/;

function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function extract(source) {
    const strings = new Set();
    const add = (value) => {
        const key = normalize(value);
        if (key.length > 1 && arabic.test(key) && translations[key]) strings.add(key);
    };
    const withoutCode = source.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    for (const match of withoutCode.matchAll(/>([^<>]*[\u0600-\u06ff][^<>]*)</g)) add(match[1]);
    for (const match of source.matchAll(/(?:title|placeholder|aria-label|alt)=["']([^"']*[\u0600-\u06ff][^"']*)["']/gi)) add(match[1]);
    const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).join('\n');
    for (const match of scripts.matchAll(/(["'`])([^"'`\r\n]*[\u0600-\u06ff][^"'`\r\n]*)\1/g)) add(match[2]);
    return strings;
}

const runtimeStrings = extract(fs.readFileSync(path.join(root, 'assets', 'project-header-runtime.js'), 'utf8'));
const files = fs.readdirSync(root).filter((file) => file.endsWith('.html'));
fs.mkdirSync(outputDirectory, { recursive: true });

let entries = 0;
for (const file of files) {
    const keys = new Set([...runtimeStrings, ...extract(fs.readFileSync(path.join(root, file), 'utf8'))]);
    const bundle = Object.fromEntries([...keys].sort().map((key) => [key, translations[key]]));
    entries += keys.size;
    fs.writeFileSync(path.join(outputDirectory, file.replace(/\.html$/, '.json')), `${JSON.stringify(bundle)}\n`, 'utf8');
}

console.log(JSON.stringify({ files: files.length, entries }));