import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'check-version-governance.mjs');

function makeFixture({
  packageVersion = '0.2.0-rc.0',
  entityVersion = '0.2.0-rc.0',
  activeSince,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'proto-version-governance-'));
  writeFileSync(join(root, 'VERSION'), '0.2.0-rc.0\n');

  const packageDir = join(root, 'packages', 'core');
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    join(packageDir, 'package.json'),
    `${JSON.stringify({ name: '@proto.ui/core', version: packageVersion }, null, 2)}\n`
  );

  const specDir = join(root, 'spec', 'versions');
  mkdirSync(specDir, { recursive: true });
  writeFileSync(
    join(specDir, 'V-PROTO-UI-0001.yaml'),
    `id: V-PROTO-UI-0001
type: version
title: Proto UI 0.2.0-rc.0
status: draft
since: ${entityVersion}${activeSince ? `\nactiveSince: ${activeSince}` : ''}
release:
  version: ${entityVersion}
  channel: prerelease
  gitTag: v${entityVersion}
  npmDistTag: next
  packageVersionPolicy: exact
  packageScope: public-@proto.ui
`
  );

  const governanceDir = join(root, 'internal', 'governance');
  mkdirSync(governanceDir, { recursive: true });
  writeFileSync(
    join(governanceDir, 'launch-package-governance.json'),
    `${JSON.stringify({ releaseLine: 'v0.2.0-rc.0' }, null, 2)}\n`
  );
  return root;
}

function runCheck(root) {
  return spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, PROTO_RELEASE_ROOT: root },
    encoding: 'utf8',
  });
}

test('global version governance accepts one exact draft release train', () => {
  const root = makeFixture();
  try {
    const result = runCheck(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('global version governance rejects package patch autonomy', () => {
  const root = makeFixture({ packageVersion: '0.2.1' });
  try {
    const result = runCheck(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /@proto\.ui\/core is 0\.2\.1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('global version governance rejects undeclared 0.2 spec versions', () => {
  const root = makeFixture({ entityVersion: '0.2.1' });
  const decisionDir = join(root, 'spec', 'decisions');
  mkdirSync(decisionDir, { recursive: true });
  writeFileSync(
    join(decisionDir, 'D-EXAMPLE-0001.yaml'),
    `id: D-EXAMPLE-0001
type: decision
title: Example
status: active
since: 0.2.7
`
  );
  try {
    const result = runCheck(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /undeclared release version 0\.2\.7/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('global version governance rejects undeclared activeSince versions', () => {
  const root = makeFixture({ activeSince: '0.3.1' });
  try {
    const result = runCheck(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /undeclared release version 0\.3\.1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('global version governance rejects duplicate V identities', () => {
  const root = makeFixture();
  const duplicate = join(root, 'spec', 'versions', 'V-PROTO-UI-0002.yaml');
  writeFileSync(
    duplicate,
    `id: V-PROTO-UI-0002
type: version
title: Duplicate release identity
status: draft
since: 0.2.0-rc.0
release:
  version: 0.2.0-rc.0
  channel: prerelease
  gitTag: v0.2.0-rc.0
  npmDistTag: next
  packageVersionPolicy: exact
  packageScope: public-@proto.ui
`
  );
  try {
    const result = runCheck(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /declared by 2 V entities/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('global version governance rejects active V entities without evidence', () => {
  const root = makeFixture();
  const entityPath = join(root, 'spec', 'versions', 'V-PROTO-UI-0001.yaml');
  const contents = readFileSync(entityPath, 'utf8').replace('status: draft', 'status: active');
  writeFileSync(entityPath, contents);
  try {
    const result = runCheck(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /active release needs publishedAt/);
    assert.match(result.stderr, /active release needs a 40-character commit/);
    assert.match(result.stderr, /active release needs a sha256 specSnapshotDigest/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
