const http = require('http');
const fs = require('fs');

const SOURCE = 'encyclopedia_ar.json';
const CACHE = '.encyclopedia-translation-cache.json';
const SKIP = new Set(['id', 'letter', 'sourceLetter', 'status', 'url']);
const ARABIC = /[\u0600-\u06ff]/;

function collect(value, key = '', strings = new Set()) {
  if (typeof value === 'string') {
    if (!SKIP.has(key) && ARABIC.test(value)) strings.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collect(item, key, strings));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([childKey, childValue]) => collect(childValue, childKey, strings));
  }
  return strings;
}

function readCache() {
  return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
}

const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const required = [...collect(source)];

const server = http.createServer((request, response) => {
  response.setHeader('content-type', 'application/json; charset=utf-8');

  if (request.method === 'GET' && request.url === '/pending') {
    const cache = readCache();
    const pending = required.filter((text) => !cache[text] || ARABIC.test(cache[text]));
    response.end(JSON.stringify({ pending }));
    return;
  }

  if (request.method === 'POST' && request.url === '/translations') {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const updates = JSON.parse(body);
      const cache = { ...readCache(), ...updates };
      fs.writeFileSync(CACHE, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
      response.end(JSON.stringify({ saved: Object.keys(updates).length }));
    });
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(4180, '127.0.0.1', () => console.log('Translation cache server: http://127.0.0.1:4180'));
