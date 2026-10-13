import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const modules = ['axis-input', 'native-link'];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'proto-new-module-metadata-'));
  const copy = (path) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    copyFileSync(join(ROOT, path), join(root, path));
  };
  for (const file of ['sync-metadata.mjs', 'readme-metadata.mjs', 'lib.mjs', 'governance.mjs'])
    copy(`scripts/release/${file}`);
  copy('package.json');
  copy('VERSION');
  for (const name of modules) {
    copy(`packages/modules/${name}/package.json`);
    copy(`packages/modules/${name}/README.md`);
  }
  const paths = [
    'package.json',
    ...modules.flatMap((name) => [
      `packages/modules/${name}/package.json`,
      `packages/modules/${name}/README.md`,
    ]),
  ];
  return {
    root,
    snapshot: () => paths.map((path) => readFileSync(join(root, path), 'utf8')),
    run: () =>
      spawnSync(process.execPath, ['scripts/release/sync-metadata.mjs'], {
        cwd: root,
        encoding: 'utf8',
      }),
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

test('new module metadata preserves authored boundaries, exact descriptions and dependencies idempotently', () => {
  const f = fixture();
  try {
    const first = f.run();
    assert.equal(first.status, 0, first.stderr);
    for (const name of modules) {
      const path = `packages/modules/${name}`;
      assert.deepEqual(
        readFileSync(join(f.root, path, 'README.md')),
        readFileSync(join(ROOT, path, 'README.md'))
      );
      const before = JSON.parse(readFileSync(join(ROOT, path, 'package.json'), 'utf8'));
      const after = JSON.parse(readFileSync(join(f.root, path, 'package.json'), 'utf8'));
      for (const field of ['name', 'description', 'version', 'dependencies', 'exports'])
        assert.deepEqual(after[field], before[field], `${name}: ${field}`);
    }
    const once = f.snapshot();
    const second = f.run();
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(f.snapshot(), once);
  } finally {
    f.close();
  }
});

for (const name of modules) {
  test(`missing ${name} metadata rule fails before any workspace write`, () => {
    const f = fixture();
    try {
      const script = join(f.root, 'scripts/release/sync-metadata.mjs');
      const source = readFileSync(script, 'utf8');
      const key = `'@proto.ui/module-${name}':`;
      assert.ok(source.includes(key));
      writeFileSync(script, source.replace(key, `'@proto.ui/unused-${name}':`));
      const before = f.snapshot();
      const result = f.run();
      assert.notEqual(result.status, 0);
      assert.ok(
        result.stderr.includes(`No metadata rule defined for: @proto.ui/module-${name}`),
        result.stderr
      );
      assert.deepEqual(f.snapshot(), before);
    } finally {
      f.close();
    }
  });
}
