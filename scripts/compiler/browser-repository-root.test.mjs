import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { browserRepositoryRoot } from './browser-inputs.mjs';
import { findBrowserRepositoryRoot } from './browser-repository-root.mjs';

test('relocated production assets read the same real source graph as the source module', async (t) => {
  // This reproduces the production bundle depth, where the old ../../ URL
  // resolved to apps/www instead of the repository. No fixture manifest is copied.
  const parent = path.join(browserRepositoryRoot, 'apps/www/.cache');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'compiler-root-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bundleFile = path.join(directory, 'browser-assets.mjs');
  await build({
    absWorkingDir: browserRepositoryRoot,
    entryPoints: ['scripts/compiler/browser-assets.ts'],
    outfile: bundleFile,
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    target: 'node24',
  });
  const { tsImport } = await import('tsx/esm/api');
  const source = await tsImport('./browser-assets.ts', import.meta.url);
  const relocated = await import(pathToFileURL(bundleFile).href);
  assert.deepEqual(
    await relocated.browserSourceRegistrations(),
    await source.browserSourceRegistrations()
  );
  assert.deepEqual(
    await relocated.readBrowserSource('base-button'),
    await source.readBrowserSource('base-button')
  );
});

test('an unrelated working directory cannot become a compiler repository', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'compiler-no-workspace-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const moduleURL = pathToFileURL(path.join(directory, 'module.mjs'));
  assert.throws(() => findBrowserRepositoryRoot(moduleURL), /workspace not found/);
  await writeFile(path.join(directory, 'pnpm-workspace.yaml'), 'packages: []\n');
  await writeFile(path.join(directory, 'package.json'), '{"name":"another-project"}\n');
  assert.throws(
    () => findBrowserRepositoryRoot(moduleURL),
    /Unexpected browser compiler workspace/
  );
});
