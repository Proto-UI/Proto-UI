import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOL_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY = 'Proto-UI/Proto-UI';
export const REMOTE = `https://github.com/${REPOSITORY}.git`;
export const TARGET_REF = 'refs/heads/fix/sprint1-reliable-regression-20261122';
export const PUBLIC_BASE = '2810f0116b5bfe614b6e76d0a40984f86beebe3f';
export const TYPE_BASE = 'dc3b184ba10b0de53e40359c52d012b204b2cd01';
export const EXPECTED_ACTOR = 'cyjin-yl';
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const fileHash = (file) => sha256(readFileSync(file));
export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.new`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  renameSync(temporary, file);
}
export function git(repo, args, options = {}) {
  const result = execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 90_000,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  return typeof result === 'string' ? result.trim() : result;
}
export function validateManifest(manifest) {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.repository, REPOSITORY);
  assert.equal(manifest.targetRef, TARGET_REF);
  assert.equal(manifest.expectedPublicHead, PUBLIC_BASE);
  assert.equal(manifest.typeBaseline.sha, TYPE_BASE);
  assert.equal(manifest.expectedActor, EXPECTED_ACTOR);
  assert.match(manifest.carrierRef, /^refs\/heads\/evidence\/sprint1-transfer-[a-z0-9-]+$/);
  for (const value of [manifest.target.sha, manifest.target.tree, manifest.typeBaseline.tree])
    assert.match(value, /^[a-f0-9]{40}$/);
  for (const value of [manifest.bundle.sha256, manifest.target.treeListingSha256])
    assert.match(value, /^[a-f0-9]{64}$/);
  assert.equal(manifest.bundle.file, 'source.bundle.b64');
  assert.equal(manifest.bundle.headRef, 'HEAD');
  assert.ok(manifest.commits.length > 0);
  assert.equal(manifest.commits.at(-1).sha, manifest.target.sha);
  assert.ok(manifest.websiteTsRoots.length > 0);
  for (const file of manifest.websiteTsRoots)
    assert.match(file, /^apps\/www\/(?!.*(?:^|\/)\.\.(?:\/|$)).+\.tsx?$/);
  return manifest;
}
export function loadManifest() {
  const manifest = validateManifest(readJson(path.join(TOOL_ROOT, 'manifest.json')));
  for (const [name, digest] of Object.entries(manifest.helperSha256)) {
    assert.match(name, /^[a-z-]+\.mjs$/);
    assert.equal(fileHash(path.join(TOOL_ROOT, name)), digest, `Helper mismatch: ${name}`);
  }
  return manifest;
}
export function runtimeOrigin(manifest, env = process.env) {
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'Manual dispatch only');
  assert.equal(env.GITHUB_REPOSITORY, REPOSITORY);
  assert.equal(env.GITHUB_REF, manifest.carrierRef, 'Exact carrier branch required');
  assert.equal(env.GITHUB_ACTOR, EXPECTED_ACTOR, 'Expected currently authorized dispatcher');
  assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
  if (env.GITHUB_WORKFLOW_SHA) assert.equal(env.GITHUB_WORKFLOW_SHA, env.GITHUB_SHA,
    'The manual workflow definition must come from the recorded carrier commit');
  assert.equal(env.S1_TARGET_SHA, manifest.target.sha);
  assert.equal(env.S1_TARGET_TREE, manifest.target.tree);
  assert.equal(env.S1_PUBLIC_BASE, PUBLIC_BASE);
  assert.equal(env.S1_TARGET_REF, TARGET_REF);
  assert.equal(env.S1_BUNDLE_SHA256, manifest.bundle.sha256);
  return {
    workflowHead: env.GITHUB_SHA,
    workflowRef: env.GITHUB_REF,
    workflowDefinitionHead: env.GITHUB_WORKFLOW_SHA ?? null,
    workflowDefinitionRef: env.GITHUB_WORKFLOW_REF ?? null,
    workflowEvent: env.GITHUB_EVENT_NAME,
    actor: env.GITHUB_ACTOR,
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
    candidateSha: manifest.target.sha,
    candidateTree: manifest.target.tree,
    boundary: 'Workflow head is the carrier; source head is the original bundled candidate.',
  };
}
export function verifyCarrier(repo, manifest, origin) {
  assert.equal(git(repo, ['rev-parse', 'HEAD']), origin.workflowHead);
  assert.equal(git(repo, ['rev-list', '--parents', '-n', '1', 'HEAD']),
    `${origin.workflowHead} ${manifest.expectedPublicHead}`, 'Carrier must be one additive commit on the fixed public base');
  assert.equal(git(repo, ['status', '--porcelain', '--untracked-files=no']), '');
  const expectedFiles = ['.github/workflows/browser-suite-repair-evidence.yml',
    '.sprint1-transfer/manifest.json', '.sprint1-transfer/source.bundle.b64',
    ...Object.keys(manifest.helperSha256).map((name) => `.sprint1-transfer/${name}`)].sort();
  assert.deepEqual(git(repo, ['diff', '--name-only', manifest.expectedPublicHead, 'HEAD']).split('\n').sort(),
    expectedFiles, 'Only the seven reviewed carrier files may differ from the public base');
  assert.equal(
    fileHash(path.join(repo, '.github/workflows/browser-suite-repair-evidence.yml')),
    manifest.workflowSha256,
    'Carrier workflow mismatch'
  );
}
export function decodeBundle(text, expected) {
  const compact = text.replace(/\s/g, '');
  assert.match(compact, /^[A-Za-z0-9+/]+={0,2}$/);
  const bytes = Buffer.from(compact, 'base64');
  assert.equal(bytes.toString('base64'), compact, 'Canonical base64 required');
  assert.equal(bytes.length, expected.bytes, 'Bundle byte count mismatch');
  assert.equal(sha256(bytes), expected.sha256, 'Bundle SHA256 mismatch');
  return bytes;
}
export function permittedRemoteState(observed, manifest) {
  if (observed === manifest.target.sha) return 'already-target';
  assert.equal(observed, manifest.expectedPublicHead, 'Public branch changed; do not overwrite it');
  return 'expected-base';
}
export function exactLeasePushArguments(manifest) {
  // The caller must first prove base -> target ancestry. This lease is a
  // compare-and-swap guard for that fast-forward, never permission to rewrite.
  return [
    'push', '--porcelain',
    `--force-with-lease=${manifest.targetRef}:${manifest.expectedPublicHead}`,
    REMOTE, `${manifest.target.sha}:${manifest.targetRef}`,
  ];
}
