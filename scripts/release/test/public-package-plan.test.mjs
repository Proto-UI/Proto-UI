import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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

function uninstalledRepository(t) {
  const root = mkdtempSync(join(tmpdir(), 'proto-ui-uninstalled-plan-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts/build'), { recursive: true });
  for (const script of ['public-packages.mjs', 'proto-source.mjs'])
    copyFileSync(join(ROOT_DIR, 'scripts/build', script), join(root, 'scripts/build', script));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  for (const pkg of packages) {
    const dir = join(root, pkg.relDir);
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: pkg.name,
        type: 'module',
        dependencies: Object.fromEntries(pkg.internalDeps.map((name) => [name, 'workspace:*'])),
        exports: { '.': { proto: './src/index.ts', import: './dist/index.js' } },
      })
    );
    writeFileSync(
      join(dir, 'src/index.ts'),
      "throw new Error('planning must not execute source');\n"
    );
  }
  for (const [name, privatePackage] of [
    ['@proto.ui/private', true],
    ['@example/external', false],
  ]) {
    const dir = join(root, 'packages', privatePackage ? 'private' : 'external');
    mkdirSync(dir);
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, private: privatePackage }));
  }
  assert.equal(existsSync(join(root, 'node_modules')), false);
  const run = (args) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  const plan = (...args) => run(['scripts/build/public-packages.mjs', ...args, '--plan', '--json']);
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const commit = () => {
    git('add', '.');
    git(
      '-c',
      'user.name=Proto UI test fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'Record isolated package-plan fixture'
    );
    return git('rev-parse', 'HEAD');
  };
  git('init', '--quiet');
  return { root, run, plan, commit, base: commit() };
}

test('dependency-free planning reads the real public graph with authored source exports', (t) => {
  const { root, plan, run } = uninstalledRepository(t);
  const result = plan();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    packageCount: 4,
    selectedCount: 4,
    packages: ['@proto.ui/core', '@proto.ui/runtime', '@proto.ui/cli', '@proto.ui/icons'],
  });
  const metadata = run([
    '--input-type=module',
    '--eval',
    `
    import {readFileSync} from 'node:fs';
    import {resolve} from 'node:path';
    import {protoSourceTargets,protoSourceEntries} from './scripts/build/proto-source.mjs';
    const dir=resolve('packages/runtime');
    const manifest=JSON.parse(readFileSync(dir+'/package.json','utf8'));
    console.log(JSON.stringify({targets:protoSourceTargets(manifest),
      entries:protoSourceEntries({dir,name:manifest.name,manifest})}));
  `,
  ]);
  assert.equal(metadata.status, 0, metadata.stderr);
  assert.deepEqual(JSON.parse(metadata.stdout), {
    targets: ['./src/index.ts'],
    entries: [join(root, 'packages/runtime/src/index.ts')],
  });
});

test('dependency-free changed-from planning preserves consumer, dependency and unrelated-path selection', (t) => {
  const { root, base, plan, commit } = uninstalledRepository(t);
  mkdirSync(join(root, 'internal/records'), { recursive: true });
  writeFileSync(join(root, 'internal/records/plan.md'), 'Documentation only.\n');
  commit();
  const unrelated = plan('--changed-from', base);
  assert.equal(unrelated.status, 0, unrelated.stderr);
  assert.deepEqual(JSON.parse(unrelated.stdout), {
    packageCount: 4,
    selectedCount: 0,
    packages: [],
  });
  writeFileSync(join(root, 'packages/runtime/src/index.ts'), 'export const changed = true;\n');
  commit();
  const changed = plan('--changed-from', base);
  assert.equal(changed.status, 0, changed.stderr);
  assert.deepEqual(JSON.parse(changed.stdout), {
    packageCount: 4,
    selectedCount: 3,
    packages: ['@proto.ui/core', '@proto.ui/runtime', '@proto.ui/cli'],
  });
});

test('dependency-free planning still rejects an unknown declared build dependency', (t) => {
  const { root, plan } = uninstalledRepository(t);
  writeFileSync(
    join(root, 'packages/runtime/package.json'),
    JSON.stringify({
      name: '@proto.ui/runtime',
      protoUi: { buildDependencies: ['@proto.ui/missing'] },
    })
  );
  const result = plan();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown protoUi\.buildDependencies: @proto\.ui\/missing/);
});

test('source closure validation still requires the real TypeScript parser after planning', (t) => {
  const { run } = uninstalledRepository(t);
  const result = run([
    '--input-type=module',
    '--eval',
    `
    import {readFileSync} from 'node:fs';
    import {resolve} from 'node:path';
    import {protoSourceFiles} from './scripts/build/proto-source.mjs';
    const dir=resolve('packages/runtime');
    const manifest=JSON.parse(readFileSync(dir+'/package.json','utf8'));
    protoSourceFiles({dir,name:manifest.name,manifest});
  `,
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot find (?:package|module) 'typescript'/);
});

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
