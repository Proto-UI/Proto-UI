import assert from 'node:assert/strict';
import { test } from 'node:test';

import { selectAffectedPackages } from '../../build/public-packages.mjs';

const packages = [
  ['core', []],
  ['runtime', ['core']],
  ['cli', ['runtime']],
  ['icons', []],
].map(([name, dependencies]) => ({
  name: `@proto.ui/${name}`,
  relDir: `packages/${name}`,
  internalDeps: dependencies.map((dependency) => `@proto.ui/${dependency}`),
  buildDeps: dependencies.map((dependency) => `@proto.ui/${dependency}`),
}));

test('budget changes select every public package for the blocking measurement', () => {
  assert.deepEqual(
    [...selectAffectedPackages(packages, ['scripts/analysis/package-budgets.mjs'])].sort(),
    packages.map((pkg) => pkg.name).sort()
  );
});

test('records and unrelated analysis do not select public package builds', () => {
  assert.deepEqual(
    [
      ...selectAffectedPackages(packages, [
        'internal/records/budget-attribution.md',
        'scripts/analysis/monorepo-snapshot.mjs',
      ]),
    ],
    []
  );
});

test('package changes retain their consumers and required dependencies', () => {
  assert.deepEqual(
    [...selectAffectedPackages(packages, ['packages/runtime/src/session.ts'])].sort(),
    ['@proto.ui/cli', '@proto.ui/core', '@proto.ui/runtime']
  );
});

test('builds an explicit private subpath without re-exporting it from the root', async (t) => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const { buildPublicPackage } = await import('../../build/public-packages.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'public-subpath-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const manifest = {
    name: '@proto.ui/private-subpath-fixture',
    type: 'module',
    exports: {
      '.': { import: './dist/index.js', types: './dist/index.d.ts' },
      './internal/value': {
        import: './dist/internal/value.js',
        types: './dist/internal/value.d.ts',
      },
    },
  };
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
  mkdirSync(join(dir, 'src/internal'), { recursive: true });
  writeFileSync(join(dir, 'src/index.ts'), 'export const publicValue = 1;');
  writeFileSync(join(dir, 'src/internal/value.ts'), 'export const privateValue = 2;');
  buildPublicPackage({ name: manifest.name, dir, manifest });
  const root = await import(pathToFileURL(join(dir, 'dist/index.js')).href);
  const subpath = await import(pathToFileURL(join(dir, 'dist/internal/value.js')).href);
  assert.equal(root.publicValue, 1);
  assert.equal(root.privateValue, undefined);
  assert.equal(subpath.privateValue, 2);
});
