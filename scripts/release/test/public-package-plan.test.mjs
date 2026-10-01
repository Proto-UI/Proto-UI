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
