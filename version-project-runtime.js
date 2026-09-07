const fs = require('fs');

const version = process.argv[2];

if (!/^\d{8}-\d+$/.test(version || '')) {
    throw new Error('Usage: node version-project-runtime.js YYYYMMDD-N');
}

const files = fs.readdirSync('.').filter((file) => file.endsWith('.html'));
let changed = 0;
const runtimePath = 'assets/project-header-runtime.js';
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const versionedRuntimeSource = runtimeSource.replace(
    /const TRANSLATION_VERSION = '[^']+';/,
    `const TRANSLATION_VERSION = '${version}';`
);
if (versionedRuntimeSource !== runtimeSource) fs.writeFileSync(runtimePath, versionedRuntimeSource, 'utf8');

for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const translationBundle = file.replace(/\.html$/, '.json');
    const bootstrap = `<script data-project-language-bootstrap>try{const language=localStorage.getItem('bibleAppLanguage')==='en'?'en':'ar';document.documentElement.lang=language;document.documentElement.dir=language==='en'?'ltr':'rtl';if(language==='en'){document.documentElement.classList.add('project-english-pending');document.documentElement.style.visibility='hidden'}}catch(_){}</script>\n<link rel="preload" href="assets/project-translations-pages/${translationBundle}?v=${version}" as="fetch" crossorigin>`;
    let after = before
        .replace(/<script data-project-language-bootstrap>[\s\S]*?<\/script>\s*/g, '')
        .replace(/<link rel="preload" href="assets\/project-translations-pages\/[^"']+" as="fetch" crossorigin>\s*/g, '')
        .replace(/<script(?: defer)? src="assets\/project-header-runtime\.js(?:\?v=[^"']*)?"><\/script>\s*/g, '')
        .replace(/assets\/project-header-runtime\.css(?:\?v=[^"']*)?/g, `assets/project-header-runtime.css?v=${version}`)
        .replace(/(<link rel="stylesheet" href="assets\/project-header-runtime\.css\?v=[^"']+">)/, `${bootstrap}\n$1\n<script defer src="assets/project-header-runtime.js?v=${version}"></script>`);

    if (after === before) continue;
    fs.writeFileSync(file, after, 'utf8');
    changed += 1;
}

console.log(JSON.stringify({ files: files.length, changed, version }));