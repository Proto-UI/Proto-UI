// Bounded-concurrency ordered map.
//
// Processes every input exactly once, preserves input order in the result, and
// bounds the number of concurrently in-flight workers to `limit` (peak concurrent
// I/O descriptors stay <= limit). A worker rejection rejects the whole batch, so a
// read/parse/semantic failure reports its own input and fails the run rather than
// being dropped or treated as an empty result.
export async function mapWithConcurrency(items, limit, worker) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError('mapWithConcurrency: limit must be a positive integer');
  }
  const results = new Array(items.length);
  let cursor = 0;
  async function runner() {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runner()));
  return results;
}
