import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
export const FIXTURE_ASSETS = ['app.js', 'fixture.css', 'index.html', 'tokens.css'];
export const FIXTURE_GENERATORS = [
  'experiments/material-initial-paint/artifact-binding.mjs',
  'experiments/material-initial-paint/browser-entry.ts',
  'experiments/material-initial-paint/browser.test.mjs',
  'experiments/material-initial-paint/build-browser.mjs',
  'experiments/material-initial-paint/render-page.mjs',
  'packages/adapters/base/src/material/initial-paint-experiment.ts',
  'packages/adapters/base/src/material/initial-paint-receipt.ts',
  'packages/cli/bin/proto-ui.js',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
];
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const safePath = (root, file) => {
  if (
    typeof file !== 'string' ||
    file.includes('\\') ||
    file.includes('\0') ||
    file.startsWith('/') ||
    file.split('/').some((part) => part === '..' || part === '.' || part === '')
  )
    throw new Error('fixture-path-invalid');
  const path = resolve(root, file);
  if (!path.startsWith(resolve(root) + sep)) throw new Error('fixture-path-outside-root');
  return path;
};
const rows = async (root, files) =>
  Promise.all(
    [...new Set(files)]
      .sort()
      .map(async (file) => ({ file, sha256: sha256(await readFile(safePath(root, file))) }))
  );
function gitState(root) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  return {
    sourceSha: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    dirty: git('status', '--porcelain').length !== 0,
  };
}
export async function createFixtureBinding(repoRoot, bundleRoot, sourceInputs) {
  return {
    bindingVersion: 1,
    ...gitState(repoRoot),
    assets: await rows(bundleRoot, FIXTURE_ASSETS),
    sources: await rows(repoRoot, [
      ...FIXTURE_GENERATORS,
      ...sourceInputs.map((file) => relative(repoRoot, resolve(repoRoot, file))),
    ]),
  };
}
export async function verifyFixtureBinding(manifest, repoRoot, bundleRoot) {
  const actual = gitState(repoRoot);
  if (
    manifest.bindingVersion !== 1 ||
    manifest.dirty !== false ||
    actual.dirty ||
    manifest.sourceSha !== actual.sourceSha ||
    manifest.tree !== actual.tree
  )
    throw new Error('fixture-current-source-mismatch');
  if (
    !Array.isArray(manifest.assets) ||
    manifest.assets
      .map((row) => row.file)
      .sort()
      .join('|') !== [...FIXTURE_ASSETS].sort().join('|') ||
    !Array.isArray(manifest.sources) ||
    new Set(manifest.sources.map((row) => row.file)).size !== manifest.sources.length ||
    !FIXTURE_GENERATORS.every((file) => manifest.sources.some((row) => row.file === file))
  )
    throw new Error('fixture-binding-incomplete');
  for (const [root, list] of [
    [bundleRoot, manifest.assets],
    [repoRoot, manifest.sources],
  ])
    for (const row of list) {
      if (
        !/^[a-f0-9]{64}$/.test(row.sha256) ||
        sha256(await readFile(safePath(root, row.file))) !== row.sha256
      )
        throw new Error(`fixture-bytes-mismatch:${row.file}`);
    }
  // This verifies current execution bytes against a produced source receipt;
  // metadata hashes are not signatures or a hostile-code authentication scheme.
  return new Map(manifest.assets.map((row) => [row.file, row.sha256]));
}
export async function readBoundFixtureFile(root, file, bindings) {
  const expected = bindings.get(file);
  if (!expected) throw new Error('fixture-unbound-request');
  const bytes = await readFile(safePath(root, file));
  if (sha256(bytes) !== expected) throw new Error(`fixture-served-bytes-mismatch:${file}`);
  return bytes;
}
