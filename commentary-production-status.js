const worklist = require('./commentary-worklist.json');
const progress = require('./sources/commentaries/approved/orchestration-progress.json');
const pending = Object.values(worklist.verses).filter(verse => verse.status !== 'approved_four_line_commentary');
const groups = new Map();
for (const verse of pending) {
  const key = `${verse.book}:${verse.chapter}`;
  groups.set(key, (groups.get(key) || 0) + 1);
}
const remainingBatches = [...groups.values()].reduce((sum, count) => sum + Math.ceil(count / 8), 0);
console.log(JSON.stringify({
  processed_batches: progress.processed_chunks,
  last_batch: progress.last_chunk,
  halted: progress.halted,
  completed_verses: worklist.verse_count - pending.length,
  pending_verses: pending.length,
  remaining_batches: remainingBatches
}, null, 2));
