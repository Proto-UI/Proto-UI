import assert from 'node:assert/strict';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const moduleName = '@proto.ui/module-control-label';
const version = '0.3.0-alpha.1';
const names = [moduleName, '@proto.ui/prototypes-lucide', '@proto.ui/prototypes-shadcn'];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'proto-release-assets-'));
  const write = (path, contents) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(
      join(root, path),
      typeof contents === 'string' ? contents : `${JSON.stringify(contents, null, 2)}\n`
    );
  };
  for (const name of [
    'check-release-assets.mjs',
    'lib.mjs',
    'governance.mjs',
    'version-utils.mjs',
  ]) {
    mkdirSync(join(root, 'scripts/release'), { recursive: true });
    cpSync(join(ROOT, 'scripts/release', name), join(root, 'scripts/release', name));
  }
  symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'dir');
  write('package.json', { packageManager: 'pnpm@10.32.1' });
  write('VERSION', `${version}\n`);
  for (const name of names) {
    const dir = `packages/${name.split('/')[1]}`;
    write(`${dir}/package.json`, {
      name,
      version,
      private: false,
      protoUi: { release: { thirdPartyNotices: ['NOTICE'] } },
    });
    write(
      `${dir}/NOTICE`,
      'Lucide Icons and Contributors\nCole Bemis\nCopyright (c) 2023 shadcn\n'
    );
  }
  const governance = {
    internalOrDependencyDirectedPackages: [moduleName],
    launchCommitmentPackages: names.slice(1),
  };
  write('internal/governance/launch-package-governance.json', governance);
  for (const name of ['release-notes.md', 'release-notes.zh-CN.md'])
    write(`internal/releases/${version}/${name}`, version);
  const run = (...args) =>
    spawnSync(process.execPath, ['scripts/release/check-release-assets.mjs', ...args], {
      cwd: root,
      encoding: 'utf8',
    });
  return {
    root,
    write,
    governance,
    run,
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

test('BOM generator includes the dependency-directed control-label without changing its release version', () => {
  const f = fixture();
  try {
    const result = f.run('--write');
    assert.equal(result.status, 0, result.stderr);
    const bom = JSON.parse(
      readFileSync(join(f.root, `internal/releases/${version}/package-bom.json`), 'utf8')
    );
    assert.equal(bom.packageCount, 3);
    assert.deepEqual(
      bom.packages.find((pkg) => pkg.name === moduleName),
      {
        name: moduleName,
        version,
        path: 'packages/module-control-label',
        releaseRole: 'internal-or-dependency-directed',
        publishOrder: 1,
        internalDependencies: [],
      }
    );
    assert.equal(f.run('--check').status, 0);
  } finally {
    f.close();
  }
});

for (const [name, mutate, diagnostic] of [
  [
    'missing control-label classification',
    (f) => {
      f.governance.internalOrDependencyDirectedPackages = [];
    },
    /unclassified: @proto\.ui\/module-control-label/,
  ],
  [
    'duplicate control-label classification',
    (f) => {
      f.governance.launchCommitmentPackages.push(moduleName);
    },
    /multiple release roles/,
  ],
])
  test(`BOM generator rejects ${name}`, () => {
    const f = fixture();
    try {
      mutate(f);
      f.write('internal/governance/launch-package-governance.json', f.governance);
      const result = f.run('--write');
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, diagnostic);
    } finally {
      f.close();
    }
  });

test('BOM check rejects a stale generated package set', () => {
  const f = fixture();
  try {
    assert.equal(f.run('--write').status, 0);
    const path = `internal/releases/${version}/package-bom.json`;
    const bom = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
    bom.packages = bom.packages.filter((pkg) => pkg.name !== moduleName);
    bom.packageCount -= 1;
    f.write(path, bom);
    const result = f.run('--check');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /package BOM is stale/);
  } finally {
    f.close();
  }
});
