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

test('budget implementation, phase ledger and policy tests select every public package', () => {
  for (const path of [
    'scripts/analysis/package-budgets.mjs',
    'scripts/analysis/package-budget-policy.mjs',
    'scripts/analysis/test/package-budget-policy.test.mjs',
    'internal/coverage-matrices/prototype-coverage-matrix.json',
  ]) {
    assert.deepEqual(
      [...selectAffectedPackages(packages, [path])].sort(),
      packages.map((pkg) => pkg.name).sort(),
      path
    );
  }
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
