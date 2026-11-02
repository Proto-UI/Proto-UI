import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { mapWithConcurrency } from './bounded-map.mjs';

test('processes every input exactly once, in input order', async () => {
  const items = Array.from({ length: 300 }, (_, index) => index);
  const results = await mapWithConcurrency(items, 8, async (item) => item * 2);
  assert.equal(results.length, 300);
  for (let index = 0; index < items.length; index += 1) {
    assert.equal(results[index], items[index] * 2);
  }
});

test('bounds peak concurrency to the limit', async () => {
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency(
    Array.from({ length: 300 }, (_, index) => index),
    8,
    async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return item;
    }
  );
  assert.equal(peak, 8);
  assert.equal(results.length, 300);
});

test('preserves result order under artificial completion delay', async () => {
  const results = await mapWithConcurrency([0, 1, 2, 3, 4], 2, async (item) => {
    await new Promise((resolve) => setTimeout(resolve, (4 - item) * 5));
    return item * 10;
  });
  assert.deepEqual(results, [0, 10, 20, 30, 40]);
});

test('propagates a worker failure naming the failing input', async () => {
  const items = [0, 1, 2, 3, 4];
  const worker = async (item) => {
    if (item === 2) throw new Error(`boom at ${item}`);
    return item;
  };
  await assert.rejects(mapWithConcurrency(items, 2, worker), (error) =>
    error.message.includes('boom at 2')
  );
});

test('handles more inputs than the limit without omission or duplication', async () => {
  const items = Array.from({ length: 257 }, (_, index) => index);
  const results = await mapWithConcurrency(items, 8, async (item) => item);
  assert.equal(results.length, 257);
  assert.equal(new Set(results).size, 257);
});

test('reports the accurate file on a read failure and fails the batch', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'bounded-map-'));
  try {
    const files = [
      path.join(directory, 'missing.ts'),
      path.join(directory, 'a.ts'),
      path.join(directory, 'b.ts'),
    ];
    await assert.rejects(
      mapWithConcurrency(files, 8, (file) => readFile(file, 'utf8')),
      (error) => error.code === 'ENOENT' && error.message.includes('missing.ts')
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects a non-positive limit', async () => {
  await assert.rejects(
    mapWithConcurrency([1, 2], 0, async () => 1),
    TypeError
  );
});
