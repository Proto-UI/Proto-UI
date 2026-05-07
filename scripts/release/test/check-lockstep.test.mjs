import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'check-lockstep.mjs');

function makeFixture(layout) {
  const root = mkdtempSync(join(tmpdir(), 'proto-check-'));
  writeFileSync(join(root, 'VERSION'), `${layout.version}\n`);
  const packagesDir = join(root, 'packages');
  mkdirSync(packagesDir, { recursive: true });
  for (const pkg of layout.packages) {
    const dir = join(packagesDir, ...pkg.relPath.split('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      `${JSON.stringify({ name: pkg.name, version: pkg.version }, null, 2)}\n`
    );
  }
  return root;
}

function runCheck(root) {
  return spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, PROTO_RELEASE_ROOT: root },
    encoding: 'utf8',
  });
}

test('check passes when all @proto.ui packages share VERSION minor', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      { relPath: 'cli', name: '@proto.ui/cli', version: '0.1.0' },
      { relPath: 'core', name: '@proto.ui/core', version: '0.1.0' },
      { relPath: 'modules/base', name: '@proto.ui/module-base', version: '0.1.0' },
    ],
  });
  try {
    const result = runCheck(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check passes when patches differ but minor matches', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      { relPath: 'cli', name: '@proto.ui/cli', version: '0.1.5' },
      { relPath: 'core', name: '@proto.ui/core', version: '0.1.0' },
      { relPath: 'modules/base', name: '@proto.ui/module-base', version: '0.1.7' },
    ],
  });
  try {
    const result = runCheck(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check fails when any package is on a different minor', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      { relPath: 'cli', name: '@proto.ui/cli', version: '0.1.5' },
      { relPath: 'core', name: '@proto.ui/core', version: '0.2.0' },
    ],
  });
  try {
    const result = runCheck(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /@proto\.ui\/core/);
    assert.match(result.stderr + result.stdout, /0\.2\.0/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check fails when a package still sits on pre-VERSION minor', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      { relPath: 'cli', name: '@proto.ui/cli', version: '0.0.4' },
      { relPath: 'core', name: '@proto.ui/core', version: '0.1.0' },
    ],
  });
  try {
    const result = runCheck(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /@proto\.ui\/cli/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check ignores non-@proto.ui packages', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      { relPath: 'cli', name: '@proto.ui/cli', version: '0.1.0' },
      { relPath: 'apps/www', name: 'apps-www', version: '99.99.99' },
    ],
  });
  try {
    const result = runCheck(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
