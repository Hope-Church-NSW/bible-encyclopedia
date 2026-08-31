const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const retryDelayMs = Math.max(10, Number(process.env.COMMENTARY_RETRY_SECONDS) || 60) * 1000;
const progressPath = path.join(root, 'sources', 'commentaries', 'approved', 'orchestration-progress.json');
const worklistPath = path.join(root, 'commentary-worklist.json');

function pendingVerseCount() {
  const worklist = JSON.parse(fs.readFileSync(worklistPath, 'utf8'));
  return Object.values(worklist.verses).filter((verse) => verse.status !== 'approved_four_line_commentary').length;
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

while (pendingVerseCount() > 0) {
  const result = spawnSync(process.execPath, ['run-approved-commentary-orchestrator.js'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit'
  });
  const remaining = pendingVerseCount();
  if (remaining === 0) break;

  let reason = result.status === 0 ? 'orchestrator_stopped' : `exit_${result.status}`;
  if (fs.existsSync(progressPath)) {
    const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    reason = progress.halt_reason || reason;
  }
  console.error(`Production paused (${reason}); ${remaining} verses remain. Retrying in ${retryDelayMs / 1000}s.`);
  wait(retryDelayMs);
}

console.log('Commentary production is complete.');