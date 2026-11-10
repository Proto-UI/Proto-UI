import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { diagramBuildInventory } from '../../../apps/www/scripts/whitepaper-diagram-build.mjs';

test('the build inventory detects changed emitted scripts, missing assets and additional output', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'diagram-build-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, '_astro'));
  await fs.writeFile(path.join(directory, 'index.html'), '<main>article</main>');
  await fs.writeFile(path.join(directory, '_astro/preview.js'), 'const candidate = 1;');
  await fs.writeFile(path.join(directory, 'figure.svg'), '<svg/>');
  const original = await diagramBuildInventory(directory);
  assert.equal(original.fileCount, 3);
  assert.deepEqual(original.files.map((file) => file.path), ['_astro/preview.js', 'figure.svg', 'index.html']);
  assert.deepEqual(await diagramBuildInventory(directory), original);
  await fs.writeFile(path.join(directory, '_astro/preview.js'), 'const candidate = 2;');
  const changed = await diagramBuildInventory(directory);
  assert.equal(changed.fileCount, original.fileCount);
  assert.notEqual(changed.sha256, original.sha256);
  await fs.rm(path.join(directory, 'figure.svg'));
  assert.equal((await diagramBuildInventory(directory)).fileCount, 2);
  await fs.writeFile(path.join(directory, 'later.css'), 'body { color: red; }');
  assert.notEqual((await diagramBuildInventory(directory)).sha256, changed.sha256);
});

test('empty builds and linked output cannot become a source-bound build inventory', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'diagram-build-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await assert.rejects(diagramBuildInventory(directory), /production build/);
  await fs.writeFile(path.join(directory, 'index.html'), '<main>article</main>');
  await fs.symlink('index.html', path.join(directory, 'linked.html'));
  await assert.rejects(diagramBuildInventory(directory), /regular files/);
});
