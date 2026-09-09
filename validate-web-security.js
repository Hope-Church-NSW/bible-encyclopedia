const fs = require('fs');

const dataFiles = ['encyclopedia_ar.json', 'encyclopedia_en.json'];
const errors = [];
const unsafeMarkup = /<\/?[a-z][^>]*>|\bon(?:error|load|click)\s*=/i;

function inspect(value, path, file) {
  if (typeof value === 'string') {
    if (unsafeMarkup.test(value)) errors.push(`${file}:${path}: unsafe markup`);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => inspect(item, `${path}[${index}]`, file));
    return;
  }

  if (!value || typeof value !== 'object') return;

  Object.entries(value).forEach(([key, child]) => {
    const childPath = path ? `${path}.${key}` : key;
    if (key === 'url' && typeof child === 'string') {
      try {
        const protocol = new URL(child).protocol;
        if (!['http:', 'https:'].includes(protocol)) {
          errors.push(`${file}:${childPath}: unsafe URL protocol`);
        }
      } catch {
        errors.push(`${file}:${childPath}: invalid URL`);
      }
    }
    inspect(child, childPath, file);
  });
}

dataFiles.forEach((file) => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  inspect(data, '', file);
});

if (errors.length) {
  console.error(errors.slice(0, 50).join('\n'));
  console.error(`Security validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(JSON.stringify({ valid: true, files: dataFiles.length }));