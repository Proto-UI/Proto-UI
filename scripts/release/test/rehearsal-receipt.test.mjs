import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureRehearsalSource, runRehearsal } from '../rehearsal-receipt.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'pui-rehearsal-receipt-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const rootDir = join(directory, 'source');
  const artifactDir = join(directory, 'evidence');
  mkdirSync(join(rootDir, 'internal/releases/0.0.0'), { recursive: true });
  writeFileSync(join(rootDir, 'VERSION'), '0.0.0\n');
  writeFileSync(join(rootDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  writeFileSync(join(rootDir, 'internal/releases/0.0.0/package-bom.json'), '{}\n');
  for (const args of [
    ['init', '-q'],
    ['config', 'user.name', 'Receipt fixture'],
    ['config', 'user.email', 'receipt@example.invalid'],
    ['add', '.'],
    ['-c', 'commit.gpgsign=false', 'commit', '-qm', 'Initial source'],
  ])
    execFileSync('git', args, { cwd: rootDir });
  return { rootDir, artifactDir, packageManager: 'pnpm@10.32.1' };
}

const step = (label, script) => [label, process.execPath, ['-e', script]];
const readReceipt = (dir) => JSON.parse(readFileSync(join(dir, 'rehearsal.json'), 'utf8'));

test('successful execution retains logs, BOM/source binding and a complete receipt', (t) => {
  const f = fixture(t);
  const receipt = runRehearsal({
    ...f,
    steps: [
      step('one', 'console.log("consumer ran")'),
      step('two', 'console.error("stderr retained")'),
    ],
  });
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.qualifiesAsFrozenCandidate, true);
  assert.equal(receipt.sourceUnchanged, true);
  assert.equal(receipt.source.revision.length, 40);
  assert.deepEqual(readReceipt(f.artifactDir), receipt);
  for (const result of receipt.steps) {
    const log = readFileSync(join(f.artifactDir, result.log));
    assert.equal(result.status, 'passed');
    assert.equal(result.logSha256, createHash('sha256').update(log).digest('hex'));
  }
  assert.match(readFileSync(join(f.artifactDir, 'step-01.log'), 'utf8'), /consumer ran/);
  assert.match(readFileSync(join(f.artifactDir, 'step-02.log'), 'utf8'), /stderr retained/);
});

test('failed process preserves its exit and prevents later required steps from running', (t) => {
  const f = fixture(t);
  const receipt = runRehearsal({
    ...f,
    steps: [
      step('failure', 'console.error("real failure"); process.exit(7)'),
      step('must not run', 'require("fs").writeFileSync("should-not-exist", "bad")'),
    ],
  });
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.steps[0].exitCode, 7);
  assert.equal(receipt.steps[1].status, 'not-run');
  assert.match(receipt.steps[1].reason, /step-01/);
  assert.equal(existsSync(join(f.rootDir, 'should-not-exist')), false);
  assert.equal(receipt.qualifiesAsFrozenCandidate, false);
});

test('missing executable has a failed terminal row and retained error', (t) => {
  const f = fixture(t);
  const receipt = runRehearsal({
    ...f,
    steps: [['missing', join(f.rootDir, 'not-a-command'), []]],
  });
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.steps[0].status, 'failed');
  assert.ok(receipt.steps[0].error || receipt.steps[0].exitCode !== 0);
});

test(
  'signal and timeout are failures, never successful null exits',
  { skip: process.platform === 'win32' },
  (t) => {
    const f = fixture(t);
    const receipt = runRehearsal({
      ...f,
      steps: [step('signal', 'process.kill(process.pid, "SIGTERM")')],
    });
    assert.equal(receipt.steps[0].signal, 'SIGTERM');
    assert.equal(receipt.steps[0].status, 'failed');
    const timed = runRehearsal({
      ...f,
      artifactDir: f.artifactDir + '-timeout',
      stepTimeoutMs: 50,
      steps: [step('timeout', 'setInterval(() => {}, 1000)')],
    });
    assert.equal(timed.status, 'failed');
    assert.equal(timed.steps[0].error.code, 'ETIMEDOUT');
    t.after(() => rmSync(f.artifactDir + '-timeout', { recursive: true, force: true }));
  }
);

test('source changed by a successful command invalidates the complete run', (t) => {
  const f = fixture(t);
  const receipt = runRehearsal({
    ...f,
    steps: [step('mutate', 'require("fs").writeFileSync("VERSION", "0.0.0\\n ")')],
  });
  assert.equal(receipt.steps[0].status, 'failed');
  assert.equal(receipt.steps[0].exitCode, 0);
  assert.equal(receipt.sourceUnchanged, false);
  assert.notEqual(receipt.sourceAfter.sourceSha256, receipt.source.sourceSha256);
  assert.equal(receipt.status, 'failed');
});

test('dirty-source diagnostics are bound to actual bytes and never a frozen candidate', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.rootDir, 'extra-source.js'), 'export const answer = 42;');
  const receipt = runRehearsal({ ...f, steps: [step('check', '')] });
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.source.clean, false);
  assert.equal(receipt.qualifiesAsFrozenCandidate, false);
  assert.match(receipt.source.worktreeStatus, /extra-source/);
});

test('a second invocation cannot overwrite prior evidence or write within its source', (t) => {
  const f = fixture(t);
  const options = { ...f, steps: [step('check', '')] };
  runRehearsal(options);
  const before = readFileSync(join(f.artifactDir, 'rehearsal.json'), 'utf8');
  assert.throws(() => runRehearsal(options), /must be empty/);
  assert.equal(readFileSync(join(f.artifactDir, 'rehearsal.json'), 'utf8'), before);
  assert.throws(
    () => runRehearsal({ ...options, artifactDir: join(f.rootDir, 'logs') }),
    /outside/
  );
});

test(
  'broken symlink source changes are included in the source digest',
  { skip: process.platform === 'win32' },
  (t) => {
    const f = fixture(t);
    const link = join(f.rootDir, 'source-link');
    symlinkSync('missing-one', link);
    const first = captureRehearsalSource(f.rootDir);
    rmSync(link);
    symlinkSync('missing-two', link);
    assert.notEqual(captureRehearsalSource(f.rootDir).sourceSha256, first.sourceSha256);
  }
);

test('one step cannot change source for a later step to restore and certify', (t) => {
  const f = fixture(t);
  const receipt = runRehearsal({
    ...f,
    steps: [
      step('change source', 'require("fs").writeFileSync("VERSION", "0.0.0\\n ")'),
      step(
        'check changed source and restore',
        'require("fs").writeFileSync("VERSION", "0.0.0\\n")'
      ),
    ],
  });
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.qualifiesAsFrozenCandidate, false);
  assert.equal(receipt.steps[0].sourceUnchanged, false);
  assert.equal(receipt.steps[1].status, 'not-run');
  assert.equal(readFileSync(join(f.rootDir, 'VERSION'), 'utf8'), '0.0.0\n ');
});

test('changing only the index invalidates a clean frozen candidate', (t) => {
  const f = fixture(t);
  const receipt = runRehearsal({
    ...f,
    steps: [['untrack version', 'git', ['rm', '--cached', 'VERSION']]],
  });
  assert.equal(receipt.source.sourceSha256, receipt.sourceAfter.sourceSha256);
  assert.notEqual(receipt.source.indexSha256, receipt.sourceAfter.indexSha256);
  assert.equal(receipt.sourceAfter.clean, false);
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.qualifiesAsFrozenCandidate, false);
});

test(
  'outside symlinks cannot store evidence inside the checkout',
  { skip: process.platform === 'win32' },
  (t) => {
    const f = fixture(t);
    const inside = join(f.rootDir, '.git', 'ignored-evidence');
    mkdirSync(inside);
    const outside = f.artifactDir + '-symlink';
    symlinkSync(inside, outside, 'dir');
    for (const artifactDir of [outside, join(outside, 'new-child')]) {
      assert.throws(
        () => runRehearsal({ ...f, artifactDir, steps: [step('check', '')] }),
        /outside/
      );
    }
    assert.equal(existsSync(join(inside, 'new-child')), false);
    assert.equal(existsSync(join(inside, 'rehearsal.json')), false);
  }
);

test('a log collision preserves old bytes and gives every step a terminal disposition', (t) => {
  const f = fixture(t);
  const collision = join(f.artifactDir, 'step-02.log');
  const receipt = runRehearsal({
    ...f,
    steps: [
      step(
        'prepare collision',
        `require("fs").writeFileSync(${JSON.stringify(collision)}, "retained evidence")`
      ),
      step('cannot open log', 'console.log("new output")'),
      step('blocked', 'process.exit(9)'),
    ],
  });
  assert.equal(receipt.status, 'failed');
  assert.deepEqual(
    receipt.steps.map(({ status }) => status),
    ['passed', 'failed', 'not-run']
  );
  assert.equal(receipt.steps[1].error.code, 'EEXIST');
  assert.equal(receipt.steps[1].logSha256, null);
  assert.equal(readFileSync(collision, 'utf8'), 'retained evidence');
  assert.deepEqual(readReceipt(f.artifactDir), receipt);
});

test('a missing completed log is recorded as an evidence failure', (t) => {
  const f = fixture(t);
  const receipt = runRehearsal({
    ...f,
    steps: [
      step(
        'remove own log',
        `require("fs").unlinkSync(${JSON.stringify(join(f.artifactDir, 'step-01.log'))})`
      ),
    ],
  });
  assert.equal(receipt.steps[0].exitCode, 0);
  assert.equal(receipt.steps[0].artifactErrors[0].code, 'ENOENT');
  assert.equal(receipt.steps[0].logSha256, null);
  assert.equal(receipt.status, 'failed');
  assert.deepEqual(readReceipt(f.artifactDir), receipt);
});

test('initial source binding errors also retain a failed receipt and not-run inventory', (t) => {
  const f = fixture(t);
  rmSync(join(f.rootDir, 'VERSION'));
  const receipt = runRehearsal({ ...f, steps: [step('must not run', '')] });
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.steps[0].status, 'not-run');
  assert.match(receipt.sourceError, /VERSION/);
  assert.equal(receipt.qualifiesAsFrozenCandidate, false);
  assert.deepEqual(readReceipt(f.artifactDir), receipt);
});
