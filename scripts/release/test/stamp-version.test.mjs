import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'stamp-version.mjs');

function makeFixture(layout) {
  const root = mkdtempSync(join(tmpdir(), 'proto-stamp-'));
  writeFileSync(join(root, 'VERSION'), `${layout.version}\n`);
  const packagesDir = join(root, 'packages');
  mkdirSync(packagesDir, { recursive: true });
  for (const pkg of layout.packages) {
    const dir = join(packagesDir, ...pkg.relPath.split('/'));
    mkdirSync(dir, { recursive: true });
    const manifest = { name: pkg.name, version: pkg.version, ...(pkg.extra || {}) };
    writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return root;
}

function runStamp(root) {
  return spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, PROTO_RELEASE_ROOT: root },
    encoding: 'utf8',
  });
}

function readManifestVersion(root, relPath) {
  const path = join(root, 'packages', ...relPath.split('/'), 'package.json');
  return JSON.parse(readFileSync(path, 'utf8')).version;
}

test('stamp resets cross-minor packages to VERSION', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      { relPath: 'cli', name: '@proto.ui/cli', version: '0.0.4' },
      { relPath: 'core', name: '@proto.ui/core', version: '0.0.1' },
    ],
  });
  try {
    const result = runStamp(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(readManifestVersion(root, 'cli'), '0.1.0');
    assert.equal(readManifestVersion(root, 'core'), '0.1.0');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('stamp leaves same-minor patches untouched', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      { relPath: 'cli', name: '@proto.ui/cli', version: '0.1.5' },
      { relPath: 'core', name: '@proto.ui/core', version: '0.1.0' },
      { relPath: 'modules/base', name: '@proto.ui/module-base', version: '0.1.7' },
    ],
  });
  try {
    const result = runStamp(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(readManifestVersion(root, 'cli'), '0.1.5');
    assert.equal(readManifestVersion(root, 'core'), '0.1.0');
    assert.equal(readManifestVersion(root, 'modules/base'), '0.1.7');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('stamp is idempotent when run twice', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      { relPath: 'cli', name: '@proto.ui/cli', version: '0.0.4' },
      { relPath: 'core', name: '@proto.ui/core', version: '0.1.3' },
    ],
  });
  try {
    runStamp(root);
    const afterFirst = {
      cli: readManifestVersion(root, 'cli'),
      core: readManifestVersion(root, 'core'),
    };
    const second = runStamp(root);
    assert.equal(second.status, 0);
    assert.equal(readManifestVersion(root, 'cli'), afterFirst.cli);
    assert.equal(readManifestVersion(root, 'core'), afterFirst.core);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('stamp does not touch workspace:* dep entries', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      {
        relPath: 'cli',
        name: '@proto.ui/cli',
        version: '0.0.4',
        extra: {
          dependencies: { '@proto.ui/core': 'workspace:*' },
          peerDependencies: { '@proto.ui/runtime': 'workspace:*' },
        },
      },
    ],
  });
  try {
    runStamp(root);
    const path = join(root, 'packages', 'cli', 'package.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(manifest.version, '0.1.0');
    assert.equal(manifest.dependencies['@proto.ui/core'], 'workspace:*');
    assert.equal(manifest.peerDependencies['@proto.ui/runtime'], 'workspace:*');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('stamp ignores non-@proto.ui packages', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      { relPath: 'cli', name: '@proto.ui/cli', version: '0.0.4' },
      { relPath: 'apps/www', name: 'apps-www', version: '0.0.0' },
    ],
  });
  try {
    runStamp(root);
    assert.equal(readManifestVersion(root, 'apps/www'), '0.0.0');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
