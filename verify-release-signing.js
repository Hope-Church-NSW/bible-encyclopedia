const fs = require('fs');
const path = require('path');

const required = [
  'BIBLE_RELEASE_STORE_FILE',
  'BIBLE_RELEASE_STORE_PASSWORD',
  'BIBLE_RELEASE_KEY_ALIAS',
  'BIBLE_RELEASE_KEY_PASSWORD'
];
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.error(`Missing release signing variables: ${missing.join(', ')}`);
  process.exit(1);
}

const keystore = path.resolve(process.env.BIBLE_RELEASE_STORE_FILE);
if (!fs.existsSync(keystore)) {
  console.error(`Release keystore does not exist: ${keystore}`);
  process.exit(1);
}

console.log(`Release signing key: ${keystore}`);