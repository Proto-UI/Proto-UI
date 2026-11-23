import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { readCollectionsSourceInventory } from '../collections-source-inventory.mjs';

test('hashes the existing Unicode source path without treating Git quoting as a filename', async () => {
  const file = 'apps/www/src/styles/__行文脉络.md';
  const legacy = execFileSync('git', ['-c', 'core.quotepath=true', 'ls-files', '--', file], {
    encoding: 'utf8',
  }).trim();
  assert.notEqual(legacy, file);
  await assert.rejects(readFile(legacy), { code: 'ENOENT' });
  const inventory = await readCollectionsSourceInventory();
  assert.ok(inventory.paths.includes(file));
  assert.ok(!inventory.paths.includes(legacy));
  assert.notEqual(await readFile(file, 'utf8'), '');
  assert.match(inventory.sha256, /^[a-f0-9]{64}$/);
});
