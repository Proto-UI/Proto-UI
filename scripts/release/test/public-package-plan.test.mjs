import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  buildPublicPackage,
  ROOT_DIR,
  selectAffectedPackages,
} from '../../build/public-packages.mjs';

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

test('declared subpaths build independently of the barrel for JavaScript and type consumers', (t) => {
  const packageDir = mkdtempSync(join(tmpdir(), 'proto-ui-detached-exports-'));
  t.after(() => rmSync(packageDir, { recursive: true, force: true }));
  mkdirSync(join(packageDir, 'src', 'internal'), { recursive: true });
  const manifest = {
    name: '@proto.ui/build-fixture',
    type: 'module',
    exports: {
      '.': { types: './dist/index.d.ts', import: './dist/index.js' },
      './internal/double': {
        types: './dist/internal/double.d.ts',
        import: './dist/internal/double.js',
      },
      './internal/input': { types: './dist/internal/input.d.ts' },
    },
  };
  writeFileSync(join(packageDir, 'package.json'), JSON.stringify(manifest));
  writeFileSync(join(packageDir, 'src', 'index.ts'), 'export const root = true;\n');
  writeFileSync(
    join(packageDir, 'src', 'internal', 'double.ts'),
    'export function double(value: number) { return value * 2; }\n'
  );
  writeFileSync(
    join(packageDir, 'src', 'internal', 'input.ts'),
    'export type Input = { value: number };\n'
  );
  const pkg = { name: manifest.name, dir: packageDir, manifest };
  buildPublicPackage(pkg);

  const runtime = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `import { double } from '@proto.ui/build-fixture/internal/double';
       import * as root from '@proto.ui/build-fixture';
       console.log(JSON.stringify({ doubled: double(7), leaked: 'double' in root }));`,
    ],
    { cwd: packageDir, encoding: 'utf8' }
  );
  assert.equal(runtime.status, 0, runtime.stderr);
  assert.deepEqual(JSON.parse(runtime.stdout), { doubled: 14, leaked: false });

  const consumer = join(packageDir, 'consumer.ts');
  writeFileSync(
    consumer,
    `import { double } from '@proto.ui/build-fixture/internal/double';
     import type { Input } from '@proto.ui/build-fixture/internal/input';
     const input: Input = { value: 7 };
     double(input.value);\n`
  );
  const types = spawnSync(
    process.execPath,
    [
      join(ROOT_DIR, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--noEmit',
      '--strict',
      '--module',
      'ES2022',
      '--moduleResolution',
      'Bundler',
      consumer,
    ],
    { cwd: packageDir, encoding: 'utf8' }
  );
  assert.equal(types.status, 0, types.stdout + types.stderr);

  manifest.exports['./absent'] = { import: './dist/absent.js' };
  assert.throws(
    () => buildPublicPackage(pkg),
    (error) => error instanceof Error && error.message.includes('./dist/absent.js')
  );
});
