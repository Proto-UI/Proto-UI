import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { formatProducerStats, summarizeProducerStats } from './producer-stat-inventory.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'producer-stat-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function put(root, name, text) {
  const target = path.join(root, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
}

test('counts every regular byte in disjoint groups, including empty files', async (t) => {
  const root = await fixture(t);
  for (const [name, content] of [
    ['index.html', '123'],
    ['en/a/index.html', '12345'],
    ['_astro/a.js', '1234567'],
    ['pagefind/index.pf', '12345678901'],
    ['logo.svg', '1234567890123'],
    ['empty', ''],
  ])
    await put(root, name, content);
  const result = await summarizeProducerStats(root);
  assert.equal(result.status, 'complete');
  assert.equal(result.files, 6);
  assert.equal(result.statBytes, '39');
  assert.deepEqual(Object.fromEntries(result.kinds.map((row) => [row.name, row.bytes])), {
    'other-origin-unclassified': '13',
    pagefind: '11',
    html: '8',
    'compiled-assets': '7',
  });
  assert.deepEqual(result.largestFiles[0], { name: 'logo.svg', bytes: '13' });
});

test('top20 does not truncate full totals or directory/extension remainder', async (t) => {
  const root = await fixture(t);
  for (let i = 1; i <= 25; i += 1) await put(root, `d${i}/x.e${i}`, 'x'.repeat(i));
  const result = await summarizeProducerStats(root);
  assert.equal(result.status, 'complete');
  assert.equal(result.files, 25);
  assert.equal(result.statBytes, '325');
  assert.equal(result.largestFiles.length, 20);
  assert.equal(result.directories.remainingFiles, 5);
  assert.equal(result.directories.remainingBytes, '15');
  assert.equal(result.extensions.remainingGroups, 5);
  assert.equal(result.extensions.remainingBytes, '15');
});

test('reports a true stat total above100MiB without admitting or reading file bytes', async (t) => {
  const root = await fixture(t);
  await put(root, 'large.bin', '');
  await truncate(path.join(root, 'large.bin'), 104_857_601);
  const result = await summarizeProducerStats(root);
  assert.equal(result.status, 'complete');
  assert.equal(result.files, 1);
  assert.equal(result.statBytes, '104857601');
});

test('rejects a symlink file without following it outside the source', async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'dist'));
  await put(root, 'outside/private.txt', 'must-not-be-read');
  await symlink('../outside/private.txt', path.join(root, 'dist/link'));
  const result = await summarizeProducerStats(path.join(root, 'dist'));
  assert.deepEqual(result, { status: 'unavailable', reason: 'symbolic-link-entry' });
  assert.ok(!formatProducerStats(result).includes('private.txt'));
});

test('rejects a symlink directory inside the source', async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'dist'));
  await mkdir(path.join(root, 'outside'));
  await symlink('../outside', path.join(root, 'dist/link'));
  assert.deepEqual(await summarizeProducerStats(path.join(root, 'dist')), {
    status: 'unavailable',
    reason: 'symbolic-link-entry',
  });
});

test('rejects both a symlink root and a symlink ancestor', async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'actual/dist'), { recursive: true });
  await symlink('actual', path.join(root, 'link'));
  for (const source of [path.join(root, 'link'), path.join(root, 'link/dist')]) {
    assert.deepEqual(await summarizeProducerStats(source), {
      status: 'unavailable',
      reason: 'symbolic-link-ancestor',
    });
  }
});

test('filesystem errors return unknown rather than a partial total or absolute path', async (t) => {
  const root = await fixture(t);
  const result = await summarizeProducerStats(path.join(root, 'missing'));
  assert.deepEqual(result, { status: 'unavailable', reason: 'filesystem-unavailable' });
  assert.ok(!formatProducerStats(result).includes(root));
});

test('an overlong relative path is unknown, never a partial complete inventory', async (t) => {
  const root = await fixture(t);
  await put(root, `${Array.from({ length: 6 }, () => 'a'.repeat(200)).join('/')}/x`, 'x');
  assert.deepEqual(await summarizeProducerStats(root), {
    status: 'unavailable',
    reason: 'path-bound',
  });
});

test('escapes control/non-ASCII paths in one bounded diagnostic line', async (t) => {
  const root = await fixture(t);
  await put(root, 'line\n\u001b\u202e中.txt', 'x');
  const result = await summarizeProducerStats(root);
  assert.equal(result.status, 'complete');
  const text = formatProducerStats(result);
  assert.match(text, /\\n\\u001b\\u202e\\u4e2d/);
  assert.ok(!/[\u0000-\u001f\u007f-\uffff]/.test(text));
  assert.deepEqual(JSON.parse(text), result);
  assert.ok(Buffer.byteLength(text) <= 65536);
});

test('oversized diagnostic output is explicit unknown, not a truncated JSON claim', () => {
  assert.deepEqual(
    JSON.parse(formatProducerStats({ status: 'complete', name: 'x'.repeat(70000) })),
    {
      status: 'unavailable',
      reason: 'diagnostic-output-bound',
    }
  );
});
