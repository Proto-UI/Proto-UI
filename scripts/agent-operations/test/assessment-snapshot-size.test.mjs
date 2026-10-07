import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { collectRepositorySnapshot } from '../assessment-runtime.mjs';

function git(root, args, encoding = 'utf8') {
  return execFileSync('git', args, { cwd: root, encoding, maxBuffer: 8 * 1024 * 1024 });
}

function repository(t, filename) {
  const root = mkdtempSync(join(tmpdir(), 'pui-assessment-large-diff-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.name', 'Snapshot size fixture']);
  git(root, ['config', 'user.email', 'snapshot-size@invalid.example']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  const hooks = join(root, '.git', 'fixture-hooks');
  mkdirSync(hooks);
  git(root, ['config', 'core.hooksPath', hooks]);
  for (const path of [
    'internal/agent-operations/capability-policy.yaml',
    'internal/agent-operations/capability-rubric.yaml',
    'scripts/agent-operations/create-capability-challenge.mjs',
    filename,
  ]) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, 'fixture baseline\n');
  }
  git(root, ['add', '--all']);
  git(root, ['commit', '--quiet', '-m', 'Snapshot fixture baseline']);
  return root;
}

function snapshot(root) {
  return collectRepositorySnapshot(root, { repositoryId: 'fixture/large-snapshot' });
}

function assertCompleteDiff(root, current) {
  const diff = git(root, ['diff', '--binary', 'HEAD', '--'], null);
  assert(diff.length > 1024 * 1024, 'fixture must cross the default child-process output bound');
  const expected = createHash('sha256')
    .update(diff)
    .update('\0')
    .update(current.worktreeDigest)
    .digest('hex');
  assert.equal(current.diffDigest, expected, 'snapshot must hash every diff byte, not a prefix');
}

test('repository snapshots bind complete text diffs larger than one MiB', (t) => {
  const root = repository(t, 'large.txt');
  assert.equal(snapshot(root).snapshotMode, 'committed-clean');
  writeFileSync(join(root, 'large.txt'), 'x'.repeat(2 * 1024 * 1024) + '\nfirst-tail\n');
  const first = snapshot(root);
  assert.equal(first.snapshotMode, 'worktree');
  assertCompleteDiff(root, first);
  writeFileSync(join(root, 'large.txt'), 'x'.repeat(2 * 1024 * 1024) + '\nchanged-tail\n');
  const second = snapshot(root);
  assertCompleteDiff(root, second);
  assert.notEqual(second.worktreeDigest, first.worktreeDigest);
  assert.notEqual(second.diffDigest, first.diffDigest);
  assert.equal(second.baseSha, first.baseSha);
  assert.equal(second.treeSha, first.treeSha);
});

test('repository snapshots bind complete binary patches larger than one MiB', (t) => {
  const root = repository(t, 'large.bin');
  const bytes = Buffer.alloc(2 * 1024 * 1024);
  let seed = 0x12345678;
  for (let i = 0; i < bytes.length; i += 1) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    bytes[i] = seed & 0xff;
  }
  bytes[0] = 0;
  writeFileSync(join(root, 'large.bin'), bytes);
  const first = snapshot(root);
  assert.equal(first.snapshotMode, 'worktree');
  assertCompleteDiff(root, first);
  bytes[bytes.length - 1] ^= 1;
  writeFileSync(join(root, 'large.bin'), bytes);
  const second = snapshot(root);
  assertCompleteDiff(root, second);
  assert.notEqual(second.worktreeDigest, first.worktreeDigest);
  assert.notEqual(second.diffDigest, first.diffDigest);
});
