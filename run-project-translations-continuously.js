const { spawnSync } = require('child_process');

const retryDelayMs = Math.max(10, Number(process.env.TRANSLATION_RETRY_SECONDS) || 60) * 1000;

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

while (true) {
  const result = spawnSync(process.execPath, ['build-project-translations.js'], {
    cwd: __dirname,
    encoding: 'utf8',
    stdio: 'inherit'
  });
  if (result.status === 0) break;
  console.error(`Translation paused (exit ${result.status}). Retrying in ${retryDelayMs / 1000}s.`);
  wait(retryDelayMs);
}

console.log('Project translation is complete.');