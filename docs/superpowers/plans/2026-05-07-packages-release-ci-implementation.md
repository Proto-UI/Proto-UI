# Packages Release CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the v0 packages release CI design from `docs/superpowers/specs/2026-05-06-packages-release-ci-design.md` — VERSION-anchored minor lockstep, pure-OIDC `release-packages.yml` (4 modes), Thursday cadence reporter, and stamp 34 packages to `0.1.0`.

**Architecture:** A single `VERSION` file at repo root anchors the active minor line. Two small Node scripts (`stamp-version.mjs`, `check-lockstep.mjs`) keep all `@proto.ui/*` package versions on the same `MAJOR.MINOR.*` while letting same-minor patches drift. Workflows are reshaped: `ci.yml` gains a 5-second `lockstep-check` job and bumps Node 20→22; `release-packages.yml` switches to 4-mode pure OIDC (no `NPM_TOKEN`) gated by GitHub Environment `npm-publish`; new `release-cadence.yml` fires every Thursday and opens a release-readiness issue.

**Tech Stack:** Node 22 + pnpm (lockfile-version-driven 8.13.1 / 10.32.1 via corepack), `node:test` for script tests, GitHub Actions Trusted Publishing (npm CLI ≥ 11.5.1).

**Pre-conditions assumed already done before this plan starts:**

- Spec committed at `docs/superpowers/specs/2026-05-06-packages-release-ci-design.md` (`54b1bfe`)
- `scripts/release/lib.mjs` Windows spawn fix committed (`89e7934`)
- 5 new packages (`@proto.ui/{hooks, module-boundary, module-hit-participation, module-presence, prototypes-lucide}`) bootstrapped to npm at `0.0.1`
- Trusted publisher configured on npm UI for all 34 `@proto.ui/*` packages (5 fields: `Proto-UI` / `Proto-UI` / `release-packages.yml` / env `npm-publish`)

**Maintainer side actions tracked by PR description (NOT implementation tasks):**

- Create GitHub Environment `npm-publish` with required reviewers (`255doesnotexist` + `guangliang2019`), branch=main only, no secrets
- After merge: trigger `release-packages.yml` with `mode=publish-all` to ship `0.1.0`

---

## File Structure

**New files:** | Path | Responsibility | | --- | --- | | `VERSION` | Single line of `MAJOR.MINOR.PATCH` (initially `0.1.0`) — anchors the active minor line | | `scripts/release/version-utils.mjs` | Shared helpers: `readVersion()`, `findProtoPackages(rootDir?)` | | `scripts/release/stamp-version.mjs` | Align cross-minor `@proto.ui/*` package versions to VERSION; preserve same-minor patches; idempotent | | `scripts/release/check-lockstep.mjs` | Assert all `@proto.ui/*` packages share VERSION's `MAJOR.MINOR.*`; non-zero exit on violation | | `scripts/release/bump-version.mjs` | publish-single helper: bump named packages by `--bump patch\|minor`, write manifests, emit `release-bump.json` summary | | `scripts/release/test/version-utils.test.mjs` | Unit tests for shared helpers (node:test) | | `scripts/release/test/stamp-version.test.mjs` | End-to-end script tests against tmp-dir fixtures | | `scripts/release/test/check-lockstep.test.mjs` | End-to-end script tests against tmp-dir fixtures | | `scripts/release/test/bump-version.test.mjs` | End-to-end tests against tmp-dir fixtures | | `.github/workflows/release-cadence.yml` | Thursday 10:07 UTC cron + workflow_dispatch; opens release-readiness issue |

**Modified files:** | Path | Change | | --- | --- | | `.github/workflows/release-packages.yml` | Replace 3-mode `NPM_TOKEN` flow with 4-mode pure OIDC (`scan` / `stage` / `publish-all` / `publish-single`), add `id-token: write` + `environment: npm-publish`, bump Node 20→22, drop all `NPM_TOKEN` references | | `.github/workflows/ci.yml` | Add `lockstep-check` job; bump 5 jobs from `node-version: 20` to `node-version: 22` | | All 34 `packages/**/package.json` `version` field | `0.0.1` (×33) and `0.0.4` (cli) → `0.1.0` (one stamp commit) |

**Existing files referenced unchanged:**

- `scripts/release/lib.mjs` — already Windows-spawn-safe (`89e7934`); stamp/check scripts re-implement package discovery in `version-utils.mjs` rather than threading a configurable root through `lib.mjs`'s monolithic helpers.
- `package.json#scripts` — no new npm scripts; CI invokes `node scripts/release/...` directly.

---

## Test Strategy

The two new Node scripts are exercised end-to-end against temp-dir fixtures using Node's built-in test runner (`node --test`) — no vitest config change required, no dependency added.

**Why not vitest:** the root `vitest.config.ts` only globs `packages/**` and `internal/contracts/__tests__/**`; teaching it about `scripts/**` is an unrelated config change and would mean scripts tests run in `happy-dom` for no reason. `node --test` is built-in to Node 22, runs `.test.mjs` files directly with `node --test scripts/release/test/`, and the script fixtures are filesystem-level (write JSON manifests to a tmp dir, spawn the script with `PROTO_RELEASE_ROOT=<tmp>`, assert exit code + filesystem state).

Workflow YAML edits are validated by:

- `actionlint` locally if available (`winget install rhysd.actionlint` or `go install github.com/rhysd/actionlint/cmd/actionlint@latest`)
- pushing to the feature branch — GitHub will syntax-check on workflow registration
- the `lockstep-check` job itself running on the PR (proves the cross-job structure works)

`release-packages.yml` `publish-*` modes can't be exercised on the PR (they require manual dispatch + environment approval), so verification of those branches is post-merge.

---

## Task 1: VERSION file + `version-utils.mjs` helpers (TDD)

**Files:**

- Create: `VERSION`
- Create: `scripts/release/version-utils.mjs`
- Create: `scripts/release/test/version-utils.test.mjs`

- [ ] **Step 1: Create the VERSION file**

```bash
echo "0.1.0" > VERSION
```

Verify: `cat VERSION` should print exactly `0.1.0`.

- [ ] **Step 2: Write the failing tests**

Create `scripts/release/test/version-utils.test.mjs`:

```js
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
```

- [ ] **Step 3: Run tests, confirm they fail with "module not found"**

Run: `node --test scripts/release/test/version-utils.test.mjs` Expected: 4 tests fail with `ERR_MODULE_NOT_FOUND` for `../version-utils.mjs`.

- [ ] **Step 4: Implement `version-utils.mjs`**

Create `scripts/release/version-utils.mjs`:

```js
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(__dirname, '..', '..');

export function getRoot(rootDir) {
  if (rootDir) return resolve(rootDir);
  if (process.env.PROTO_RELEASE_ROOT) return resolve(process.env.PROTO_RELEASE_ROOT);
  return DEFAULT_ROOT;
}

export function readVersion(rootDir) {
  const root = getRoot(rootDir);
  const raw = readFileSync(join(root, 'VERSION'), 'utf8').trim();
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid VERSION at ${join(root, 'VERSION')}: ${raw}`);
  }
  const [, major, minor, patch] = match;
  return {
    raw,
    major,
    minor,
    patch,
    minorPrefix: `${major}.${minor}.`,
  };
}

export function findProtoPackages(rootDir) {
  const root = getRoot(rootDir);
  const packagesDir = join(root, 'packages');
  if (!existsSync(packagesDir)) return [];

  const manifestPaths = [];
  for (const scope of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!scope.isDirectory()) continue;
    const scopeDir = join(packagesDir, scope.name);
    const direct = join(scopeDir, 'package.json');
    if (existsSync(direct)) {
      manifestPaths.push(direct);
      continue;
    }
    for (const child of readdirSync(scopeDir, { withFileTypes: true })) {
      if (!child.isDirectory()) continue;
      const childManifest = join(scopeDir, child.name, 'package.json');
      if (existsSync(childManifest)) manifestPaths.push(childManifest);
    }
  }

  return manifestPaths
    .map((manifestPath) => ({
      manifestPath,
      manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
    }))
    .filter(
      (entry) =>
        typeof entry.manifest.name === 'string' && entry.manifest.name.startsWith('@proto.ui/')
    )
    .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}
```

- [ ] **Step 5: Run tests, confirm they pass**

Run: `node --test scripts/release/test/version-utils.test.mjs` Expected: `# pass 4 # fail 0`.

- [ ] **Step 6: Commit**

```bash
git add VERSION scripts/release/version-utils.mjs scripts/release/test/version-utils.test.mjs
git commit -m "feat(release): add VERSION anchor and version-utils helpers

VERSION is the single source of truth for the active minor line. version-utils.mjs exposes readVersion() and findProtoPackages() for stamp-version and check-lockstep."
```

---

## Task 2: `stamp-version.mjs` (TDD)

**Files:**

- Create: `scripts/release/stamp-version.mjs`
- Create: `scripts/release/test/stamp-version.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `scripts/release/test/stamp-version.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests, confirm they fail with "module not found"**

Run: `node --test scripts/release/test/stamp-version.test.mjs` Expected: 5 tests fail because `stamp-version.mjs` doesn't exist yet (spawnSync exit code != 0).

- [ ] **Step 3: Implement `stamp-version.mjs`**

Create `scripts/release/stamp-version.mjs`:

```js
#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { readVersion, findProtoPackages } from './version-utils.mjs';

const version = readVersion();
const packages = findProtoPackages();

let updated = 0;
for (const pkg of packages) {
  const currentVersion = pkg.manifest.version || '0.0.0';
  if (currentVersion.startsWith(version.minorPrefix)) continue;
  pkg.manifest.version = version.raw;
  writeFileSync(pkg.manifestPath, `${JSON.stringify(pkg.manifest, null, 2)}\n`);
  console.log(`stamped ${pkg.manifest.name}: ${currentVersion} -> ${version.raw}`);
  updated += 1;
}

const aligned = packages.length - updated;
console.log(
  `stamp-version: ${updated} updated, ${aligned} already on minor ${version.major}.${version.minor}`
);
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `node --test scripts/release/test/stamp-version.test.mjs` Expected: `# pass 5 # fail 0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/release/stamp-version.mjs scripts/release/test/stamp-version.test.mjs
git commit -m "feat(release): add stamp-version.mjs

Cross-minor reset (e.g. 0.0.x -> 0.1.0) writes pkg.version = VERSION; same-minor patches (e.g. cli@0.1.5 with VERSION=0.1.0) are preserved per versioning-policy.zh-CN.md \"minor-locked, patch-free\". Idempotent; ignores non-@proto.ui packages and workspace:* dep entries."
```

---

## Task 3: `check-lockstep.mjs` (TDD)

**Files:**

- Create: `scripts/release/check-lockstep.mjs`
- Create: `scripts/release/test/check-lockstep.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `scripts/release/test/check-lockstep.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `node --test scripts/release/test/check-lockstep.test.mjs` Expected: 5 tests fail because `check-lockstep.mjs` doesn't exist.

- [ ] **Step 3: Implement `check-lockstep.mjs`**

Create `scripts/release/check-lockstep.mjs`:

```js
#!/usr/bin/env node
import { readVersion, findProtoPackages } from './version-utils.mjs';

const version = readVersion();
const packages = findProtoPackages();

const violations = [];
for (const pkg of packages) {
  const v = pkg.manifest.version || '';
  if (!v.startsWith(version.minorPrefix)) {
    violations.push({ name: pkg.manifest.name, version: v });
  }
}

if (violations.length > 0) {
  console.error(
    `check-lockstep: ${violations.length} @proto.ui package(s) outside minor ${version.major}.${version.minor}:`
  );
  for (const violation of violations) {
    console.error(`  ${violation.name} @ ${violation.version || '<missing>'}`);
  }
  console.error(`expected MAJOR.MINOR prefix: ${version.minorPrefix}`);
  process.exit(1);
}

console.log(
  `check-lockstep: all ${packages.length} @proto.ui packages on minor ${version.major}.${version.minor} (patch differences allowed)`
);
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `node --test scripts/release/test/check-lockstep.test.mjs` Expected: `# pass 5 # fail 0`.

- [ ] **Step 5: Run all script tests together**

Run: `node --test scripts/release/test/` Expected: `# pass 14 # fail 0` (4 + 5 + 5).

- [ ] **Step 6: Commit**

```bash
git add scripts/release/check-lockstep.mjs scripts/release/test/check-lockstep.test.mjs
git commit -m "feat(release): add check-lockstep.mjs

Asserts every @proto.ui package shares VERSION's MAJOR.MINOR prefix; allows patch differences within the same minor (per versioning-policy.zh-CN.md). Non-zero exit when any package drifts cross-minor; intended as a 5-second PR gate in ci.yml."
```

---

## Task 4: `bump-version.mjs` (TDD)

**Files:**

- Create: `scripts/release/bump-version.mjs`
- Create: `scripts/release/test/bump-version.test.mjs`

This is the helper `release-packages.yml` `publish-single` mode invokes to bump named packages by patch (default) or minor. Extracting it out of the workflow keeps the YAML readable and gets the bump logic under unit test.

- [ ] **Step 1: Write the failing tests**

Create `scripts/release/test/bump-version.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'bump-version.mjs');

function makeFixture(layout) {
  const root = mkdtempSync(join(tmpdir(), 'proto-bump-'));
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

function runBump(root, args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: root,
    env: { ...process.env, PROTO_RELEASE_ROOT: root },
    encoding: 'utf8',
  });
}

function readManifestVersion(root, relPath) {
  const path = join(root, 'packages', ...relPath.split('/'), 'package.json');
  return JSON.parse(readFileSync(path, 'utf8')).version;
}

test('bumps a single package by patch by default', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [{ relPath: 'cli', name: '@proto.ui/cli', version: '0.1.0' }],
  });
  try {
    const result = runBump(root, ['@proto.ui/cli']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(readManifestVersion(root, 'cli'), '0.1.1');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('bumps multiple packages by patch', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      { relPath: 'cli', name: '@proto.ui/cli', version: '0.1.5' },
      { relPath: 'core', name: '@proto.ui/core', version: '0.1.0' },
    ],
  });
  try {
    const result = runBump(root, ['--bump', 'patch', '@proto.ui/cli', '@proto.ui/core']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(readManifestVersion(root, 'cli'), '0.1.6');
    assert.equal(readManifestVersion(root, 'core'), '0.1.1');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('bumps a package by minor (resets patch to 0)', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [{ relPath: 'cli', name: '@proto.ui/cli', version: '0.1.5' }],
  });
  try {
    const result = runBump(root, ['--bump', 'minor', '@proto.ui/cli']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(readManifestVersion(root, 'cli'), '0.2.0');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('writes release-bump.json summary in cwd', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [
      { relPath: 'cli', name: '@proto.ui/cli', version: '0.1.0' },
      { relPath: 'core', name: '@proto.ui/core', version: '0.1.3' },
    ],
  });
  try {
    runBump(root, ['@proto.ui/cli', '@proto.ui/core']);
    const summary = JSON.parse(readFileSync(join(root, 'release-bump.json'), 'utf8'));
    assert.deepEqual(
      summary.bumped.sort((a, b) => a.name.localeCompare(b.name)),
      [
        { name: '@proto.ui/cli', from: '0.1.0', to: '0.1.1' },
        { name: '@proto.ui/core', from: '0.1.3', to: '0.1.4' },
      ]
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails on unknown package', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [{ relPath: 'cli', name: '@proto.ui/cli', version: '0.1.0' }],
  });
  try {
    const result = runBump(root, ['@proto.ui/does-not-exist']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown/i);
    assert.ok(!existsSync(join(root, 'release-bump.json')), 'should not write summary on failure');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails on bad --bump value', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [{ relPath: 'cli', name: '@proto.ui/cli', version: '0.1.0' }],
  });
  try {
    const result = runBump(root, ['--bump', 'major', '@proto.ui/cli']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /patch.*minor|minor.*patch/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails when no targets given', () => {
  const root = makeFixture({
    version: '0.1.0',
    packages: [{ relPath: 'cli', name: '@proto.ui/cli', version: '0.1.0' }],
  });
  try {
    const result = runBump(root, []);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /at least one package/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `node --test scripts/release/test/bump-version.test.mjs` Expected: 7 tests fail because `bump-version.mjs` doesn't exist.

- [ ] **Step 3: Implement `bump-version.mjs`**

Create `scripts/release/bump-version.mjs`:

```js
#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProtoPackages, getRoot } from './version-utils.mjs';

const args = process.argv.slice(2);
let bump = 'patch';
const targets = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--bump') {
    bump = args[++i];
  } else if (args[i] === '--') {
    continue;
  } else {
    targets.push(args[i]);
  }
}

if (targets.length === 0) {
  console.error('bump-version: at least one package name is required');
  process.exit(1);
}
if (!['patch', 'minor'].includes(bump)) {
  console.error(`bump-version: --bump must be patch or minor (got: ${bump})`);
  process.exit(1);
}

const all = findProtoPackages();
const byName = new Map(all.map((pkg) => [pkg.manifest.name, pkg]));

const bumped = [];
for (const name of targets) {
  const pkg = byName.get(name);
  if (!pkg) {
    console.error(`bump-version: unknown package ${name}`);
    process.exit(1);
  }
  const current = pkg.manifest.version || '';
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    console.error(`bump-version: bad version on ${name}: ${current}`);
    process.exit(1);
  }
  const [, major, minor, patch] = match;
  const next =
    bump === 'minor' ? `${major}.${Number(minor) + 1}.0` : `${major}.${minor}.${Number(patch) + 1}`;
  pkg.manifest.version = next;
  writeFileSync(pkg.manifestPath, `${JSON.stringify(pkg.manifest, null, 2)}\n`);
  console.log(`bumped ${name}: ${current} -> ${next}`);
  bumped.push({ name, from: current, to: next });
}

const summaryPath = join(getRoot(), 'release-bump.json');
writeFileSync(summaryPath, `${JSON.stringify({ bumped }, null, 2)}\n`);
console.log(`bump-version: wrote summary to ${summaryPath}`);
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `node --test scripts/release/test/bump-version.test.mjs` Expected: `# pass 7 # fail 0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/release/bump-version.mjs scripts/release/test/bump-version.test.mjs
git commit -m "feat(release): add bump-version.mjs

Helper for release-packages.yml publish-single mode: takes a list of @proto.ui/* package names + --bump patch|minor (default patch), writes the new versions to package.json, and emits release-bump.json so the workflow can drive per-package commit + tag steps without re-parsing manifests."
```

---

## Task 5: Stamp 34 packages from `0.0.x` / `0.0.4` to `0.1.0`

**Files:**

- Modify: 34 `packages/**/package.json` (all `@proto.ui/*` packages)

This is the batch stamp commit referenced in spec §4.2 step 6 — reviewer-friendly because it's mechanical.

- [ ] **Step 1: Verify pre-stamp state**

Run:

```bash
node -e "const {findProtoPackages}=require('./scripts/release/version-utils.mjs');for(const p of findProtoPackages()) console.log(p.manifest.name, p.manifest.version);" 2>&1 | head -50
```

Wait — `version-utils.mjs` is ESM. Use:

```bash
node --input-type=module -e "import {findProtoPackages} from './scripts/release/version-utils.mjs'; for (const p of findProtoPackages()) console.log(p.manifest.name, p.manifest.version);"
```

Expected: 33 packages at `0.0.1` and `@proto.ui/cli` at `0.0.4`.

- [ ] **Step 2: Run stamp-version.mjs against the real repo**

Run:

```bash
node scripts/release/stamp-version.mjs
```

Expected output: 34 lines of `stamped @proto.ui/...: 0.0.x -> 0.1.0` then `stamp-version: 34 updated, 0 already on minor 0.1`.

- [ ] **Step 3: Confirm idempotence**

Run:

```bash
node scripts/release/stamp-version.mjs
```

Expected: `stamp-version: 0 updated, 34 already on minor 0.1`.

- [ ] **Step 4: Confirm check-lockstep passes**

Run:

```bash
node scripts/release/check-lockstep.mjs
```

Expected: `check-lockstep: all 34 @proto.ui packages on minor 0.1 (patch differences allowed)`. Exit code 0.

- [ ] **Step 5: Verify git diff scope**

Run:

```bash
git diff --name-only -- 'packages/**/package.json' | wc -l
```

Expected: `34`. (All changes are confined to `packages/**/package.json`.)

Run:

```bash
git diff -- 'packages/**/package.json' | grep -E '^[+-]\s+"version"' | sort -u
```

Expected output (only these 3 lines):

```
+  "version": "0.1.0",
-  "version": "0.0.1",
-  "version": "0.0.4",
```

If any other line shows up, abort and investigate.

- [ ] **Step 6: Commit**

```bash
git add 'packages/**/package.json'
git commit -m "chore(release): stamp 34 @proto.ui packages to 0.1.0

Aligns 33 packages from 0.0.1 and @proto.ui/cli from 0.0.4 to the v0 first-release minor (0.1.0). Generated by node scripts/release/stamp-version.mjs against VERSION=0.1.0. workspace:* deps untouched; lib.mjs normalizes them at publish time."
```

---

## Task 6: `ci.yml` — add `lockstep-check` job + Node 20→22

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `lockstep-check` job**

Insert this job at the top of the `jobs:` block (above `type-check:`) in `.github/workflows/ci.yml`:

```yaml
lockstep-check:
  runs-on: ubuntu-latest
  timeout-minutes: 5
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: 22

    - name: Verify @proto.ui packages share VERSION minor
      run: node scripts/release/check-lockstep.mjs
```

This job has no pnpm/install — `check-lockstep.mjs` only reads the filesystem. Five-second gate.

- [ ] **Step 2: Bump Node version on the existing 5 jobs**

In `.github/workflows/ci.yml`, find every occurrence of:

```yaml
with:
  node-version: 20
```

and change it to:

```yaml
with:
  node-version: 22
```

There should be exactly 5 occurrences (type-check, test, release-scan, release-stage, cli-smoke).

Verify with:

```bash
grep -c "node-version: 22" .github/workflows/ci.yml
```

Expected: `6` (5 existing jobs + the new lockstep-check).

- [ ] **Step 3: Run script tests once more to confirm scripts still resolve from CI cwd**

Run from repo root:

```bash
node scripts/release/check-lockstep.mjs
```

Expected: exit 0, message about 34 packages on minor 0.1.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lockstep-check job and bump Node 20 -> 22

lockstep-check is a 5-second PR gate that runs check-lockstep.mjs against the working tree. Node 22 is required for npm Trusted Publishing (npm CLI >= 11.5.1)."
```

---

## Task 7: `release-packages.yml` — 4 modes + pure OIDC + environment + Node 22

**Files:**

- Modify: `.github/workflows/release-packages.yml`

This is the largest file change. Replace the existing 3-mode `NPM_TOKEN` flow with a 4-mode pure-OIDC flow.

- [ ] **Step 1: Replace the entire file**

Overwrite `.github/workflows/release-packages.yml` with:

```yaml
name: Release Packages

on:
  workflow_dispatch:
    inputs:
      mode:
        description: 'scan, stage(dry-run), publish-all, or publish-single'
        required: true
        type: choice
        options:
          - scan
          - stage
          - publish-all
          - publish-single
        default: scan
      profile:
        description: 'release profile (workspace = all 34, launch = governance subset)'
        required: true
        type: choice
        options:
          - launch
          - workspace
        default: workspace
      include_approved_candidates:
        description: 'include approved candidate packages (launch profile only)'
        required: true
        type: boolean
        default: false
      version:
        description: 'override VERSION on publish-all (e.g. 0.1.0); ignored for other modes'
        required: false
        type: string
      tag:
        description: 'npm dist-tag'
        required: true
        default: latest
        type: string
      only:
        description: 'comma-separated package names (required for publish-single)'
        required: false
        type: string
      bump:
        description: 'patch bump type for publish-single'
        required: true
        type: choice
        options:
          - patch
          - minor
        default: patch
      publish_delay_ms:
        description: 'delay between package publish requests'
        required: true
        default: '3000'
        type: string
      max_publish_retries:
        description: 'retries when npm returns 429/rate-limit'
        required: true
        default: '2'
        type: string
      retry_delay_ms:
        description: 'delay before each retry'
        required: true
        default: '15000'
        type: string

permissions:
  contents: read

concurrency:
  group: release-packages-${{ github.ref }}
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    # publish-all and publish-single both write to the registry; gate them on the
    # npm-publish environment (required reviewers + branch=main only). scan and
    # stage have no side effects but ride the same job to keep the workflow shape
    # simple — the environment check on those modes is a no-op (no rules trigger
    # for non-deployment runs that don't need approval).
    environment: ${{ (inputs.mode == 'publish-all' || inputs.mode == 'publish-single') && 'npm-publish' || '' }}
    permissions:
      # OIDC token for npm Trusted Publishing.
      id-token: write
      # commit + tag push back to main on publish-* modes.
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          # Need full history for tag computation and post-publish commits.
          fetch-depth: 0
          # Token has to allow writes for the post-publish push step.
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org

      - name: Setup pnpm (corepack)
        run: |
          set -euo pipefail
          PACKAGE_MANAGER=$(node -p "require('./package.json').packageManager || ''")
          LOCKFILE_VERSION=$(node -e "const fs=require('fs');const text=fs.readFileSync('pnpm-lock.yaml','utf8');const m=text.match(/^lockfileVersion:\\s*['\\\"]?([^'\\\"\\n]+)['\\\"]?/m);if(!m){throw new Error('lockfileVersion not found');}process.stdout.write(m[1]);")
          echo "packageManager=${PACKAGE_MANAGER}"
          echo "lockfileVersion=${LOCKFILE_VERSION}"

          case "${LOCKFILE_VERSION}" in
            6* )
              PNPM_VERSION="8.13.1"
              ;;
            9* )
              PNPM_VERSION="10.32.1"
              ;;
            * )
              echo "Unsupported pnpm lockfileVersion: ${LOCKFILE_VERSION}"
              exit 1
              ;;
          esac

          corepack enable
          # Activate the lockfile-selected pnpm so any bare `pnpm` invocation
          # (including child spawns inside scripts/release/lib.mjs) honors the
          # version we picked, instead of falling back to package.json#packageManager.
          corepack prepare pnpm@"${PNPM_VERSION}" --activate
          echo "PROTO_PNPM_VERSION=${PNPM_VERSION}" >> "$GITHUB_ENV"
          # Tell corepack to ignore package.json#packageManager so child processes
          # spawning bare `pnpm` see the activated version.
          echo "COREPACK_ENABLE_PROJECT_SPEC=0" >> "$GITHUB_ENV"
          corepack pnpm@"${PNPM_VERSION}" --version

      - name: Install
        run: corepack pnpm@"${PROTO_PNPM_VERSION}" install --frozen-lockfile

      - name: Validate Publish Branch
        if: ${{ inputs.mode == 'publish-all' || inputs.mode == 'publish-single' }}
        run: |
          set -euo pipefail
          if [[ "${GITHUB_REF_NAME}" != "main" ]]; then
            echo "publish-* modes are only allowed on main (got: ${GITHUB_REF_NAME})"
            exit 1
          fi

      - name: Configure git identity
        if: ${{ inputs.mode == 'publish-all' || inputs.mode == 'publish-single' }}
        run: |
          git config user.name "proto-ui-release-bot"
          git config user.email "release-bot@proto-ui.invalid"

      - name: Override VERSION (publish-all only)
        if: ${{ inputs.mode == 'publish-all' && inputs.version != '' }}
        run: |
          set -euo pipefail
          echo "${{ inputs.version }}" > VERSION
          echo "VERSION overridden to ${{ inputs.version }}"

      - name: Stamp + lockstep (publish-all only)
        if: ${{ inputs.mode == 'publish-all' }}
        run: |
          set -euo pipefail
          node scripts/release/stamp-version.mjs
          node scripts/release/check-lockstep.mjs

      - name: Lockstep guard (other modes)
        if: ${{ inputs.mode != 'publish-all' }}
        run: node scripts/release/check-lockstep.mjs

      - name: Patch-bump selected packages (publish-single only)
        if: ${{ inputs.mode == 'publish-single' }}
        run: |
          set -euo pipefail
          if [[ -z "${{ inputs.only }}" ]]; then
            echo "publish-single requires inputs.only"
            exit 1
          fi
          # Convert "a,b" -> "a b" then call the standalone bump script.
          # The script writes release-bump.json describing the rewrite,
          # which the commit+tag step downstream consumes.
          TARGETS=$(echo "${{ inputs.only }}" | tr ',' ' ')
          node scripts/release/bump-version.mjs --bump "${{ inputs.bump }}" -- $TARGETS
          node scripts/release/check-lockstep.mjs

      - name: Run Release Command
        run: |
          set -euo pipefail

          ARGS=(
            --profile "${{ inputs.profile }}"
            --check-governance
            --tag "${{ inputs.tag }}"
            --publish-delay-ms "${{ inputs.publish_delay_ms }}"
            --max-publish-retries "${{ inputs.max_publish_retries }}"
            --retry-delay-ms "${{ inputs.retry_delay_ms }}"
          )

          if [[ "${{ inputs.include_approved_candidates }}" == "true" ]]; then
            ARGS+=(--include-approved-candidates)
          fi

          if [[ -n "${{ inputs.only }}" ]]; then
            ARGS+=(--only "${{ inputs.only }}")
          fi

          case "${{ inputs.mode }}" in
            scan)
              node scripts/release/scan.mjs "${ARGS[@]}" --json | tee release-scan.json
              ;;
            stage)
              node scripts/release/publish.mjs --dry-run "${ARGS[@]}"
              ;;
            publish-all)
              # OIDC: no NODE_AUTH_TOKEN, no NPM_TOKEN. npm CLI auto-detects
              # ACTIONS_ID_TOKEN_REQUEST_URL/_TOKEN and exchanges for a
              # short-lived publish credential (with provenance).
              node scripts/release/publish.mjs --publish "${ARGS[@]}"
              ;;
            publish-single)
              if [[ -z "${{ inputs.only }}" ]]; then
                echo "publish-single requires inputs.only"
                exit 1
              fi
              node scripts/release/publish.mjs --publish "${ARGS[@]}"
              ;;
            *)
              echo "unsupported mode: ${{ inputs.mode }}"
              exit 1
              ;;
          esac

      - name: Upload Release Scan Artifact
        if: ${{ inputs.mode == 'scan' }}
        uses: actions/upload-artifact@v4
        with:
          name: release-scan
          path: release-scan.json

      - name: Commit + tag (publish-all)
        if: ${{ inputs.mode == 'publish-all' }}
        run: |
          set -euo pipefail
          VERSION_VALUE=$(cat VERSION)
          git add -A
          git commit -m "chore(release): publish ${VERSION_VALUE}"
          git tag "release/${VERSION_VALUE}"
          git push origin HEAD
          git push origin "release/${VERSION_VALUE}"

      - name: Commit + tag (publish-single)
        if: ${{ inputs.mode == 'publish-single' }}
        run: |
          set -euo pipefail
          # release-bump.json was written by the bump step earlier in the job
          # and is the source of truth for what to commit/tag. Iterate its
          # `bumped` array to produce one commit + one tag per package.
          if [[ ! -f release-bump.json ]]; then
            echo "release-bump.json missing — bump step did not run"
            exit 1
          fi
          mapfile -t LINES < <(node --input-type=module -e "
            import { readFileSync } from 'node:fs';
            const { bumped } = JSON.parse(readFileSync('release-bump.json', 'utf8'));
            for (const entry of bumped) {
              process.stdout.write(\`\${entry.name}\t\${entry.to}\n\`);
            }
          ")
          for line in "${LINES[@]}"; do
            [[ -z "$line" ]] && continue
            name="${line%%$'\t'*}"
            version="${line##*$'\t'}"
            git add -A
            git commit -m "chore(release): publish ${name}@${version}"
            git tag "${name}@${version}"
          done
          git push origin HEAD
          git push origin --tags
```

- [ ] **Step 2: Validate YAML parses**

If `actionlint` is on PATH:

```bash
actionlint .github/workflows/release-packages.yml
```

Expected: no errors.

If not, fall back to a JS-side YAML parse check:

```bash
node --input-type=module -e "import { readFileSync } from 'node:fs'; const yaml = await import('yaml').catch(() => null); if (!yaml) { console.log('yaml package not installed; skipping JS-side parse check'); process.exit(0); } yaml.parse(readFileSync('.github/workflows/release-packages.yml','utf8')); console.log('release-packages.yml parses');"
```

If neither works, push to feature branch and let GitHub validate on workflow registration (Settings → Actions → Workflow runs).

- [ ] **Step 3: Confirm `NPM_TOKEN` is fully gone**

Run:

```bash
grep -n "NPM_TOKEN" .github/workflows/release-packages.yml || echo "no NPM_TOKEN references"
```

Expected: `no NPM_TOKEN references`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release-packages.yml
git commit -m "ci(release-packages): switch to 4-mode pure OIDC

Modes: scan / stage (dry-run) / publish-all (cross-minor full release) / publish-single (same-minor patch hotfix). All publish-* modes require the npm-publish GitHub Environment (required reviewers + branch=main). NODE_AUTH_TOKEN and NPM_TOKEN are gone — npm CLI consumes the GitHub Actions OIDC token directly and emits provenance attestations. publish-all stamps + lockstep-checks before publishing; publish-single bumps patch on inputs.only and tags per-package."
```

---

## Task 8: `release-cadence.yml` — Thursday cron + issue creation

**Files:**

- Create: `.github/workflows/release-cadence.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/release-cadence.yml`:

````yaml
name: Release Cadence

on:
  schedule:
    # Thursday 10:07 UTC — odd minute to avoid the on-the-hour cron pile-up.
    - cron: '7 10 * * 4'
  workflow_dispatch:

permissions:
  contents: read
  issues: write

concurrency:
  group: release-cadence-${{ github.ref }}
  cancel-in-progress: false

jobs:
  cadence:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Compute commits since last release/* tag
        id: changes
        run: |
          set -euo pipefail
          LAST_TAG=$(git describe --tags --match 'release/*' --abbrev=0 2>/dev/null || true)
          echo "last_tag=${LAST_TAG}"
          if [[ -z "${LAST_TAG}" ]]; then
            RANGE_LABEL="(no previous release/* tag — listing recent packages/ history)"
            COMMITS=$(git log --oneline -- packages/ | head -200)
          else
            RANGE_LABEL="${LAST_TAG}..HEAD"
            COMMITS=$(git log "${LAST_TAG}..HEAD" --oneline -- packages/)
          fi

          if [[ -z "${COMMITS}" ]]; then
            echo "has_changes=false" >> "$GITHUB_OUTPUT"
            echo "no packages/ commits since ${LAST_TAG:-origin}; skipping issue"
            exit 0
          fi

          echo "has_changes=true" >> "$GITHUB_OUTPUT"
          echo "last_tag=${LAST_TAG}" >> "$GITHUB_OUTPUT"
          echo "range_label=${RANGE_LABEL}" >> "$GITHUB_OUTPUT"

          {
            echo "commits<<EOF"
            echo "${COMMITS}"
            echo "EOF"
          } >> "$GITHUB_OUTPUT"

      - name: Open release readiness issue
        if: steps.changes.outputs.has_changes == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          TITLE="release readiness: $(date -u +%Y-%m-%d)"
          BODY=$(cat <<'EOF'
          ### packages/ commits since last release tag

          Range: ${{ steps.changes.outputs.range_label }}

          ```
          ${{ steps.changes.outputs.commits }}
          ```

          ### Maintainer next steps

          - Decide which packages need a same-minor patch hotfix → trigger `Release Packages` with `mode=publish-single`, `only=<comma-separated>`, `bump=patch`.
          - If this batch crosses a minor (new public surface, breaking config, ecosystem coordination) → bump `VERSION`, then trigger `mode=publish-all` with the new `version` input.
          - If nothing needs to ship this week, close this issue with a brief note ("nothing to ship — only tooling/docs commits").

          _Auto-generated by `release-cadence.yml`._
          EOF
          )
          gh issue create \
            --title "${TITLE}" \
            --body "${BODY}" \
            --label "release-cadence"
````

- [ ] **Step 2: Verify YAML parses (best-effort)**

If `actionlint` is on PATH:

```bash
actionlint .github/workflows/release-cadence.yml
```

Expected: no errors.

- [ ] **Step 3: Verify the `release-cadence` label exists or document creating it**

Run:

```bash
gh label list --search release-cadence 2>/dev/null || echo "gh not auth'd / not on PATH"
```

If the label doesn't exist, the maintainer will create it manually after merge — `gh issue create --label X` errors out if the label is missing. Add this to the PR description checklist (Task 8).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release-cadence.yml
git commit -m "ci: add release-cadence workflow

Thursday 10:07 UTC cron + workflow_dispatch. Lists git log packages/ since the last release/* tag and opens a release-readiness issue summarizing what's pending. Does NOT publish — that path stays gated behind the npm-publish environment in release-packages.yml."
```

---

## Task 9: PR description draft + final acceptance walkthrough

**Files:**

- No file changes — this task drafts the PR body and runs the final acceptance checklist before pushing.

- [ ] **Step 1: Run the full local acceptance checklist**

Per spec §8, verify each item:

```bash
# Script tests
node --test scripts/release/test/
# Expect: # pass 14 # fail 0

# Stamp idempotent (no diff after second run)
node scripts/release/stamp-version.mjs
git diff --quiet -- 'packages/**/package.json' && echo "idempotent: clean"

# Lockstep against real repo
node scripts/release/check-lockstep.mjs
# Expect: all 34 @proto.ui packages on minor 0.1

# All 34 packages stamped
node --input-type=module -e "import {findProtoPackages} from './scripts/release/version-utils.mjs'; const pkgs = findProtoPackages(); const off = pkgs.filter(p => p.manifest.version !== '0.1.0'); if (off.length) { for (const p of off) console.error(p.manifest.name, p.manifest.version); process.exit(1); } console.log('all 34 packages at 0.1.0');"

# release:scan still clean
pnpm release:scan -- --json | node -e "const d = JSON.parse(require('fs').readFileSync(0,'utf8')); const tolerated = (i) => /^workspace deps:/.test(i); const off = (d.selected||[]).filter(p => (p.issues||[]).some(i => !tolerated(i))); if (off.length) { for (const p of off) console.error(p.name, p.issues); process.exit(1); } console.log('scan clean');"

# release:stage still clean (this re-runs tsc + dry-run publish on all 34 packages)
pnpm release:stage
```

Expected: every command exit 0. If `release:stage` fails on any package, investigate before proceeding.

- [ ] **Step 2: Verify `NPM_TOKEN` is gone repo-wide in workflows**

```bash
grep -nR "NPM_TOKEN" .github/workflows/ || echo "no NPM_TOKEN references in workflows"
```

Expected: `no NPM_TOKEN references in workflows`. (The string may still appear in `docs/` — that's fine; we're only confirming it's out of the CI graph.)

- [ ] **Step 3: Verify all 6 `node-version: 22` markers in ci.yml**

```bash
grep -c "node-version: 22" .github/workflows/ci.yml
grep -c "node-version: 20" .github/workflows/ci.yml
```

Expected: `6` and `0`.

- [ ] **Step 4: Verify release-packages.yml uses Node 22 and pure OIDC**

```bash
grep -c "node-version: 22" .github/workflows/release-packages.yml
grep -c "id-token: write" .github/workflows/release-packages.yml
grep -c "environment:" .github/workflows/release-packages.yml
```

Expected: `1`, `1`, `1`.

- [ ] **Step 5: Push the branch**

```bash
git push -u origin feat/v0-release-governance
```

Then check on the PR or create one. CI should run on push:

- `lockstep-check` → should pass (we just stamped)
- `type-check`, `test`, `release-scan`, `release-stage`, `cli-smoke` → unaffected by this PR's logic but will re-run on Node 22

- [ ] **Step 6: Draft the PR description**

Use this body (matches spec §7):

```markdown
## What this PR ships

Implements `docs/superpowers/specs/2026-05-06-packages-release-ci-design.md`:

- `VERSION` file at repo root anchors the active minor line (initially `0.1.0`)
- `scripts/release/stamp-version.mjs` — cross-minor reset, same-minor patch preserve
- `scripts/release/check-lockstep.mjs` — minor-equals-VERSION assertion across 34 `@proto.ui/*` packages
- `.github/workflows/release-packages.yml` — 4 modes (scan / stage / publish-all / publish-single), pure OIDC (no `NPM_TOKEN`), `environment: npm-publish`, Node 22
- `.github/workflows/ci.yml` — new `lockstep-check` job + Node 20 → 22 across all 5 jobs
- `.github/workflows/release-cadence.yml` — Thursday 10:07 UTC cron, opens release-readiness issue
- 34 `@proto.ui/*` package versions stamped from `0.0.x` / `0.0.4` to `0.1.0`

## Pre-merge (maintainer prep)

- [x] Bootstrap 5 new packages (`@proto.ui/{hooks, module-boundary, module-hit-participation, module-presence, prototypes-lucide}`) to npm at `0.0.1`
- [x] Configure trusted publisher on npm UI for all 34 `@proto.ui/*` packages
  - Publisher: GitHub Actions
  - Organization: `Proto-UI`
  - Repository: `Proto-UI`
  - Workflow filename: `release-packages.yml`
  - Environment name: `npm-publish`
- [ ] Create GitHub Environment `npm-publish`:
  - Required reviewers: `255doesnotexist` + `guangliang2019`
  - Deployment branches: `main` only
  - **No** secrets (pure OIDC)
- [ ] Create the `release-cadence` label (`gh label create release-cadence -d "auto-opened by release-cadence.yml" -c FBCA04`)

## Post-merge (maintainer action)

- [ ] In GitHub Actions UI, run `Release Packages` with:
  - mode: `publish-all`
  - branch: `main`
  - profile: `workspace`
  - version: (leave blank — VERSION already says `0.1.0`)
- [ ] Approve the `npm-publish` environment deployment when prompted
- [ ] Verify `main` picked up commit `chore(release): publish 0.1.0` and tag `release/0.1.0`
- [ ] Verify `npm view @proto.ui/cli version` returns `0.1.0` (sample any package)

## Known limitations / follow-ups (not in this PR)

- `internal/governance/launch-package-governance.json` still doesn't list `@proto.ui/prototypes-lucide` — `--profile workspace` (this PR's path) ignores it; `--profile launch` would skip it. Track in follow-up issue.
- `release-cadence.yml` only lists raw `git log packages/`; per-package change attribution is a follow-up.
- `publish-single` `bump` only supports `patch` / `minor` keywords; explicit version (`0.1.7`) is a follow-up.
- The bootstrap granular npm token expires `2026-05-13`; revoke or let expire — production publishing is OIDC-only after merge.
```

- [ ] **Step 7: Open the PR**

```bash
gh pr create --title "ci: minor-locked release governance + pure-OIDC publish + 0.1.0 stamp" --body-file <(cat <<'EOF'
... (paste the body from Step 6)
EOF
)
```

Or push and use the GitHub UI. Ensure the PR title is under 70 chars.

- [ ] **Step 8: Watch CI**

After push, expect:

- `lockstep-check` → green (we just stamped)
- `type-check`, `test`, `release-scan`, `release-stage`, `cli-smoke` → green on Node 22
- `release-cadence` → won't auto-fire on PR (cron only triggers on `main`); to spot-check, use `workflow_dispatch` on the feature branch — it should either skip-no-changes or open a test issue (close manually after).

If `release-stage` or `cli-smoke` fail on Node 22 with errors that didn't show on Node 20, that's a regression to investigate before merge.

---

## Self-Review

After completing all 9 tasks, run this final pass:

**Spec coverage (§ refers to spec sections):**

- §2.2 `VERSION` + stamp + check chain → Task 1, 2, 3 ✅
- §2.3.1 `release-packages.yml` 4 modes + pure OIDC + environment → Task 7 (workflow body) + Task 4 (publish-single bump engine `bump-version.mjs`) ✅
- §2.3.2 `release-cadence.yml` Thursday cron → Task 8 ✅
- §2.3.3 `ci.yml` lockstep-check + Node 22 → Task 6 ✅
- §2.4 `npm-publish` GitHub Environment → maintainer action in Task 9 PR description (not implementable in code) ✅
- §3 Trusted Publisher npm UI config → already done pre-PR (per pre-conditions) ✅
- §4 Migration path → Task 5 (stamp 34 packages commit) + Task 9 (post-merge dispatch instructions) ✅
- §5 Node 22 → Task 6 (ci.yml) + Task 7 (release-packages.yml) + Task 8 (release-cadence.yml) ✅
- §6 file manifest → 9 tasks covering all 8 listed items; item 9 (lib.mjs Windows fix) already done at `89e7934` ✅
- §7 PR description template → Task 9 Step 6 ✅
- §8 acceptance checklist → Task 9 Step 1 ✅
- §9 follow-ups → noted in Task 9 PR description "Known limitations" ✅

**Type/name consistency:**

- `version-utils.mjs` exports `readVersion`, `findProtoPackages`, `getRoot` — same names used in `stamp-version.mjs`, `check-lockstep.mjs`, and `bump-version.mjs` ✅
- `bump-version.mjs` writes `release-bump.json` with shape `{ bumped: [{ name, from, to }] }` — `release-packages.yml` Commit + tag (publish-single) step reads exactly that shape ✅
- Workflow input names (`mode`, `profile`, `version`, `tag`, `only`, `bump`, `publish_delay_ms`, `max_publish_retries`, `retry_delay_ms`) match between the inputs definition and the steps using them ✅
- Environment name `npm-publish` matches between `release-packages.yml` and the Trusted Publisher config (per spec §3.1) ✅

**Placeholder scan:** No TBD/TODO. Every step has the actual content. Checkboxes are the only `[ ]` patterns.

---

## Plan complete

Saved to `docs/superpowers/plans/2026-05-07-packages-release-ci-implementation.md`.
