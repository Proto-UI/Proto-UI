import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  protoSourceEntries,
  protoSourceFiles,
  protoSourceTargets,
} from '../../build/proto-source.mjs';
import {
  ROOT_DIR,
  getPublicPackages,
  publicPackageSourceEntries,
} from '../../build/public-packages.mjs';
import { createPublishManifest, stagePackage, writeSupportingFiles } from '../lib.mjs';
import { localManifest } from '../../build/draft-prototype-packages.mjs';

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'proto-source-pack-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'package');
  const stage = path.join(root, 'stage');
  mkdirSync(stage);
  const put = (name, contents) => {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), contents);
  };
  const manifest = {
    name: '@example/ordinary-source',
    version: '1.0.0',
    type: 'module',
    exports: {
      '.': {
        proto: './src/index.ts',
        types: './dist/index.d.ts',
        import: './dist/index.js',
        default: './dist/index.js',
      },
    },
  };
  put('package.json', JSON.stringify(manifest));
  put(
    'src/index.ts',
    `export {behavior} from './logic.proto'; export type {Shape} from './types';`
  );
  put('src/logic.proto.ts', `import {helper} from './helper'; export const behavior=helper;`);
  put('src/helper.ts', `export const helper=1;`);
  put(
    'src/types.ts',
    `export interface Shape {count:number} throw new Error('source is never executed');`
  );
  put('src/unreached.ts', `throw new Error('unpublished');`);
  put('dist/index.js', `export const behavior=1;`);
  put('dist/index.d.ts', `export declare const behavior: number;`);
  return {
    root,
    stage,
    put,
    pkg: { dir, manifest, name: manifest.name, version: manifest.version },
  };
}

for (const form of ['root', 'subpath']) {
  test(`direct authored ${form} exports remain reachable after release staging`, (t) => {
    const { pkg, root } = fixture(t);
    const target = './src/logic.proto.ts';
    const runtime = {
      types: './src/index.ts',
      import: './src/index.ts',
      default: './src/index.ts',
    };
    pkg.manifest.exports = form === 'root' ? target : { '.': runtime, './behavior': target };
    const result = stagePackage(pkg, { outDir: path.join(root, 'release') });
    const manifest = JSON.parse(readFileSync(path.join(result.stageDir, 'package.json'), 'utf8'));
    assert.deepEqual(
      manifest.exports,
      form === 'root'
        ? target
        : {
            '.': {
              types: './dist/index.d.ts',
              import: './dist/index.js',
              default: './dist/index.js',
            },
            './behavior': target,
          }
    );
    assert.deepEqual(
      manifest.files.filter((file) => file.startsWith('src/')),
      ['src/helper.ts', 'src/logic.proto.ts']
    );
    for (const file of ['src/helper.ts', 'src/logic.proto.ts'])
      assert.equal(
        readFileSync(path.join(result.stageDir, file), 'utf8'),
        readFileSync(path.join(pkg.dir, file), 'utf8')
      );
    assert.equal(existsSync(path.join(result.stageDir, 'dist/logic.proto.js')), false);
    assert.equal(result.publishResult, null);
  });
}

test('direct authored leaves preserve nested conditions and array runtime/type rewrites', (t) => {
  const { pkg } = fixture(t);
  pkg.manifest.exports = {
    '.': {
      node: {
        types: ['./src/index.ts', './src/index.d.ts'],
        import: [{ proto: './src/index.ts', default: './src/index.ts' }, './src/logic.proto.ts'],
        default: './src/index.ts',
      },
      default: './src/index.ts',
    },
    './behavior': './src/logic.proto.ts',
    './blocked': null,
  };
  const original = structuredClone(pkg.manifest.exports);
  const manifest = createPublishManifest(pkg, { access: 'public' });
  assert.deepEqual(manifest.exports, {
    '.': {
      node: {
        types: ['./dist/index.d.ts', './dist/index.d.ts'],
        import: [{ proto: './src/index.ts', default: './dist/index.js' }, './src/logic.proto.ts'],
        default: './dist/index.js',
      },
      default: './dist/index.js',
    },
    './behavior': './src/logic.proto.ts',
    './blocked': null,
  });
  assert.deepEqual(pkg.manifest.exports, original);
});

test('source staging preserves explicit proto exports and the complete source/type closure', (t) => {
  const { pkg, stage } = fixture(t);
  const files = ['src/helper.ts', 'src/index.ts', 'src/logic.proto.ts', 'src/types.ts'];
  assert.deepEqual(protoSourceFiles(pkg), files);
  assert.deepEqual(protoSourceEntries(pkg), [path.join(pkg.dir, 'src/index.ts')]);
  assert.ok(publicPackageSourceEntries(pkg).includes(path.join(pkg.dir, 'src/index.ts')));
  const manifest = createPublishManifest(pkg, { access: 'public' });
  assert.deepEqual(manifest.exports, pkg.manifest.exports);
  assert.deepEqual(
    manifest.files.filter((file) => file.startsWith('src/')),
    files
  );
  writeSupportingFiles(pkg, stage);
  for (const file of files)
    assert.equal(
      readFileSync(path.join(stage, file), 'utf8'),
      readFileSync(path.join(pkg.dir, file), 'utf8')
    );
  assert.throws(() => readFileSync(path.join(stage, 'src/unreached.ts')), /ENOENT/);
  const draft = localManifest(
    pkg.manifest,
    new Map([[pkg.name, '0.0.0-draft']]),
    manifest.exports,
    files
  );
  assert.equal(draft.exports['.'].proto, './src/index.ts');
  assert.deepEqual(
    draft.files.filter((file) => file.startsWith('src/')),
    files
  );
});

test('the ordinary packed tarball contains source helpers and erased types without running scripts', (t) => {
  const { pkg, stage, root } = fixture(t);
  const manifest = createPublishManifest(pkg, { access: 'public' });
  writeSupportingFiles(pkg, stage);
  mkdirSync(path.join(stage, 'dist'));
  for (const name of ['index.js', 'index.d.ts'])
    writeFileSync(path.join(stage, 'dist', name), readFileSync(path.join(pkg.dir, 'dist', name)));
  writeFileSync(
    path.join(stage, 'package.json'),
    JSON.stringify({ ...manifest, scripts: { prepack: 'exit 41' } })
  );
  const packed = spawnSync(
    process.execPath,
    [
      path.join(ROOT_DIR, 'node_modules/npm/bin/npm-cli.js'),
      'pack',
      '--offline',
      '--ignore-scripts',
      '--json',
      '--pack-destination',
      root,
    ],
    {
      cwd: stage,
      encoding: 'utf8',
      timeout: 20_000,
      env: {
        ...process.env,
        npm_config_cache: path.join(root, 'cache'),
        npm_config_audit: 'false',
        npm_config_fund: 'false',
      },
    }
  );
  assert.equal(packed.status, 0, packed.stderr || packed.stdout);
  const [result] = JSON.parse(packed.stdout);
  assert.deepEqual(
    result.files
      .filter((file) => file.path.startsWith('src/'))
      .map((file) => file.path)
      .sort(),
    protoSourceFiles(pkg)
  );
  assert.ok(result.files.some((file) => file.path === 'dist/index.js'));
  assert.ok(readFileSync(path.join(root, result.filename)).length > 0);
});

test('the actual Transition package source export stages its machine and types unchanged', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'proto-transition-source-stage-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pkg = getPublicPackages().find(
    (candidate) => candidate.name === '@proto.ui/prototypes-base'
  );
  assert.ok(pkg);
  assert.equal(pkg.manifest.exports['./transition'].proto, './src/transition/index.ts');
  const expected = [
    'src/transition/as-transition.proto.ts',
    'src/transition/index.ts',
    'src/transition/machine.ts',
    'src/transition/transition.proto.ts',
    'src/transition/types.ts',
  ];
  assert.deepEqual(protoSourceFiles(pkg), expected);
  const manifest = createPublishManifest(pkg, { access: 'public' });
  assert.equal(manifest.exports['./transition'].proto, './src/transition/index.ts');
  assert.deepEqual(
    manifest.files.filter((file) => file.startsWith('src/')),
    expected
  );
  writeSupportingFiles(pkg, root);
  for (const file of expected)
    assert.equal(
      readFileSync(path.join(root, file), 'utf8'),
      readFileSync(path.join(pkg.dir, file), 'utf8')
    );
});

test('ordinary runtime exports never imply a source publication', (t) => {
  const { pkg } = fixture(t);
  delete pkg.manifest.exports['.'].proto;
  assert.deepEqual(protoSourceTargets(pkg.manifest), []);
  assert.deepEqual(protoSourceFiles(pkg), []);
  assert.deepEqual(createPublishManifest(pkg, { access: 'public' }).files, [
    'dist',
    'README.md',
    'LICENSE',
  ]);
});

test('source publication rejects missing, escaping, ambiguous and symlinked source targets', (t) => {
  const { pkg, put, root } = fixture(t);
  for (const target of [
    './missing.ts',
    '../outside.ts',
    './src/../outside.ts',
    ['./src/index.ts'],
    { default: './src/index.ts' },
  ]) {
    pkg.manifest.exports['.'].proto = target;
    assert.throws(() => protoSourceFiles(pkg));
  }
  pkg.manifest.exports['.'].proto = './src/index.ts';
  put('src/index.ts', `export {missing} from './absent';`);
  assert.throws(() => protoSourceFiles(pkg), /missing authored source/);
  put('src/index.ts', `export {missing} from '../../../outside';`);
  assert.throws(() => protoSourceFiles(pkg), /escapes its package/);
  writeFileSync(path.join(root, 'external.ts'), 'export const value=1;');
  rmSync(path.join(pkg.dir, 'src/index.ts'));
  symlinkSync(path.join(root, 'external.ts'), path.join(pkg.dir, 'src/index.ts'));
  assert.throws(() => protoSourceFiles(pkg), /symlink escapes/);
});
