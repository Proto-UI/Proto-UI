import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readVersion, findProtoPackages } from '../version-utils.mjs';

function makeFixture(layout) {
  const root = mkdtempSync(join(tmpdir(), 'proto-version-utils-'));
  if (layout.version != null) {
    writeFileSync(join(root, 'VERSION'), `${layout.version}\n`);
  }
  const packagesDir = join(root, 'packages');
  mkdirSync(packagesDir, { recursive: true });
  for (const pkg of layout.packages || []) {
    const dir = join(packagesDir, ...pkg.relPath.split('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      `${JSON.stringify({ name: pkg.name, version: pkg.version }, null, 2)}\n`
    );
  }
  return root;
}

test('readVersion parses MAJOR.MINOR.PATCH', () => {
  const root = makeFixture({ version: '0.1.0' });
  try {
    const v = readVersion(root);
    assert.equal(v.raw, '0.1.0');
    assert.equal(v.major, '0');
    assert.equal(v.minor, '1');
    assert.equal(v.patch, '0');
    assert.equal(v.minorPrefix, '0.1.');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readVersion trims trailing whitespace', () => {
  const root = makeFixture({ version: '0.1.0  ' });
  try {
    const v = readVersion(root);
    assert.equal(v.raw, '0.1.0');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readVersion throws on malformed VERSION', () => {
  const root = makeFixture({ version: 'not-a-version' });
  try {
    assert.throws(() => readVersion(root), /Invalid VERSION/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findProtoPackages discovers nested @proto.ui packages and skips others', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      { relPath: 'cli', name: '@proto.ui/cli', version: '0.0.4' },
      { relPath: 'modules/base', name: '@proto.ui/module-base', version: '0.0.1' },
      { relPath: 'apps/www', name: 'apps-www', version: '0.0.0' },
    ],
  });
  try {
    const found = findProtoPackages(root);
    const names = found.map((p) => p.manifest.name).sort();
    assert.deepEqual(names, ['@proto.ui/cli', '@proto.ui/module-base']);
    const cli = found.find((p) => p.manifest.name === '@proto.ui/cli');
    assert.equal(cli.manifest.version, '0.0.4');
    assert.ok(cli.manifestPath.endsWith('package.json'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findProtoPackages reports the manifest path when JSON is malformed', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [{ relPath: 'cli', name: '@proto.ui/cli', version: '0.0.4' }],
  });
  const brokenDir = join(root, 'packages', 'broken');
  mkdirSync(brokenDir, { recursive: true });
  const brokenManifest = join(brokenDir, 'package.json');
  writeFileSync(brokenManifest, 'not json');
  try {
    assert.throws(
      () => findProtoPackages(root),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Failed to parse/);
        assert.ok(
          err.message.includes(brokenManifest),
          `error message should include ${brokenManifest}, got: ${err.message}`
        );
        return true;
      }
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
