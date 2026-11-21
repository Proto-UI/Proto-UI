import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generalCheckPlan, executeGeneralChecks } from './general-ci.mjs';
import { selectGeneralChecks } from './general-check-plan.mjs';
import { assertRuntimeSource, createCiPlan, runtimeRoot } from './runtime-ci.mjs';
import { RUNTIME_TEST_INCLUDES } from './runtime-inventory.mjs';
import {
  readOptionalJson,
  runtimeObservation,
  runtimeSourceSnapshot,
} from './runtime-observation.mjs';
import {
  assertBrowserShardCapacity,
  browserShards,
  browserShardCosts,
  BROWSER_SUITES,
  validateBrowserCostEvidence,
} from './runtime-test-plan.mjs';

const sha = 'a'.repeat(40);
const snapshot = {
  checkoutSha: sha,
  treeSha: 'b'.repeat(40),
  dirty: false,
  worktreeSha256: 'c'.repeat(64),
};

test('the general receipt inventory retains the explicitly included JavaScript source suite', () => {
  const suite = 'apps/www/test/proto-ui-source.test.mjs';
  assert.ok(RUNTIME_TEST_INCLUDES.includes(suite));
  assert.equal(createCiPlan(sha).general.filter((file) => file === suite).length, 1);
});

test('the full browser inventory fits the unchanged deadline with a setup reserve', () => {
  assertBrowserShardCapacity();
  assert.equal(browserShards().flat().length, BROWSER_SUITES.length);
  assert.ok(
    browserShardCosts().every(
      (cost) => cost.estimatedSeconds + cost.setupReserveSeconds <= cost.executionBudgetSeconds
    )
  );
  // The old ten-worker allocation demonstrably cannot admit the measured work.
  assert.throws(() => assertBrowserShardCapacity(browserShards(BROWSER_SUITES, 10)), /beyond/);
});

test('malformed or duplicated timing observations cannot bypass capacity admission', () => {
  const original = JSON.parse(
    readFileSync(
      new URL('./fixtures/browser-suite-costs-44876125495.json', import.meta.url),
      'utf8'
    )
  );
  for (const mutate of [
    (input) => {
      delete input.observations[0].durationMs;
    },
    (input) => {
      input.observations[0].durationMs = NaN;
    },
    (input) => {
      input.observations[0].durationMs = -1;
    },
    (input) => {
      input.observations.push(input.observations[0]);
    },
    (input) => {
      input.observations[0].jobUrl += '-wrong';
    },
  ]) {
    const input = structuredClone(original);
    mutate(input);
    assert.throws(() => validateBrowserCostEvidence(input), /Invalid/);
  }
});

test('general planning preserves every root gate and separates controls from runtime execution', () => {
  const manifest = JSON.parse(readFileSync(path.join(runtimeRoot, 'package.json'), 'utf8'));
  const plan = generalCheckPlan(manifest, sha);
  const rootScripts = manifest.scripts.test
    .split(' && ')
    .map((command) => command.split(' ').at(-1));
  assert.deepEqual(
    plan
      .slice(2)
      .map((step) => step.id)
      .filter((id) => !id.startsWith('test:runtime:')),
    rootScripts.filter((id) => id !== 'test:runtime')
  );
  assert.deepEqual(
    plan.slice(-2).map((step) => step.id),
    ['test:runtime:controls', 'test:runtime:execute']
  );
  assert.equal(plan.filter((step) => step.id === 'test:public-docs').length, 1);
  assert.throws(() => generalCheckPlan(manifest, 'HEAD'), /Exact/);
  assert.throws(
    () => generalCheckPlan({ scripts: { ...manifest.scripts, test: 'echo success' } }, sha),
    /Unrecognized/
  );
});

test('a failed source-binding check and a spawn error do not suppress later tests or turn green', async () => {
  const reached = [];
  const steps = [{ id: 'coverage' }, { id: 'spawn-error' }, { id: 'runtime' }];
  const result = await executeGeneralChecks(steps, async (step) => {
    reached.push(step.id);
    if (step.id === 'spawn-error') throw new Error('fixture unavailable executable');
    const child = spawnSync(process.execPath, [
      '-e',
      `process.exit(${step.id === 'coverage' ? 1 : 0})`,
    ]);
    return { exitCode: child.status, signal: child.signal };
  });
  assert.deepEqual(
    reached,
    steps.map((step) => step.id)
  );
  assert.equal(result.passed, false);
  assert.deepEqual(
    result.results.map((step) => step.passed),
    [false, false, true]
  );
  await assert.rejects(
    executeGeneralChecks([], async () => ({})),
    /empty/
  );
});

test('independent general groups partition the original plan without omitting or duplicating work', () => {
  const manifest = JSON.parse(readFileSync(path.join(runtimeRoot, 'package.json'), 'utf8'));
  const plan = generalCheckPlan(manifest, sha);
  const checks = selectGeneralChecks(plan, 'checks');
  const runtime = selectGeneralChecks(plan, 'runtime');
  assert.equal(checks.length, 20);
  assert.deepEqual(
    runtime.map((step) => step.id),
    ['test:runtime:execute']
  );
  assert.deepEqual([...checks, ...runtime], plan);
  assert.throws(() => selectGeneralChecks(plan, 'partial'), /Unknown general check group/);
  assert.throws(() => selectGeneralChecks([...plan, plan[0]], 'checks'), /Duplicate general step/);
  assert.throws(() => selectGeneralChecks(checks, 'checks'), /exactly one runtime execution/);
});

test('a complete red report preserves failures and skipped tests separately', () => {
  const selection = { checkoutSha: sha, phase: 'browser', shard: '1/18', suites: ['one.test.ts'] };
  const report = {
    testResults: [
      {
        name: path.join(runtimeRoot, 'one.test.ts'),
        status: 'failed',
        assertionResults: [
          {
            fullName: 'original failed assertion',
            status: 'failed',
            failureMessages: ['actual != expected'],
          },
          { fullName: 'unexecuted case', status: 'pending' },
        ],
      },
    ],
  };
  const observed = runtimeObservation({
    selection,
    root: runtimeRoot,
    report,
    sourceBefore: snapshot,
    sourceAfter: snapshot,
    exitCode: 1,
  });
  assert.equal(observed.completeInventory, true);
  assert.deepEqual(observed.counts, {
    selectedSuites: 1,
    reportedSuites: 1,
    passed: 0,
    failed: 1,
    skipped: 1,
  });
  assert.equal(observed.acceptance, 'requires-original-strict-gate');
  const interrupted = runtimeObservation({
    selection,
    root: runtimeRoot,
    report: null,
    progress: { finished: false },
    sourceBefore: snapshot,
    sourceAfter: snapshot,
    signal: 'SIGTERM',
  });
  assert.equal(interrupted.execution, 'interrupted');
  assert.equal(interrupted.completeInventory, false);
  assert.deepEqual(interrupted.missingSuites, selection.suites);
});

test('source acceptance rejects stable dirty trees, changed contents, and wrong commit identity', () => {
  const selection = { checkoutSha: sha };
  assert.doesNotThrow(() =>
    assertRuntimeSource({ before: snapshot, after: { ...snapshot } }, selection)
  );
  const dirty = { ...snapshot, dirty: true };
  assert.throws(() => assertRuntimeSource({ before: dirty, after: dirty }, selection), /Dirty/);
  assert.throws(
    () =>
      assertRuntimeSource(
        { before: snapshot, after: { ...snapshot, worktreeSha256: 'd'.repeat(64) } },
        selection
      ),
    /changed/
  );
  assert.throws(
    () =>
      assertRuntimeSource({ before: snapshot, after: snapshot }, { checkoutSha: 'e'.repeat(40) }),
    /SHA drift/
  );
});

test('a truncated terminal report is diagnostic debt and does not erase a valid checkpoint', (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'runtime-truncated-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, 'report.json'), '{"testResults":[');
  writeFileSync(path.join(dir, 'progress.json'), '{"finished":false}');
  const report = readOptionalJson(path.join(dir, 'report.json'));
  assert.equal(report.value, null);
  assert.ok(report.error);
  assert.deepEqual(readOptionalJson(path.join(dir, 'progress.json')).value, { finished: false });
});

test('source snapshots detect unstaged and untracked content changes without a commit change', (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'runtime-source-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  git('init', '-q');
  writeFileSync(path.join(dir, 'source'), 'original');
  git('add', 'source');
  git(
    '-c',
    'user.name=Isolated test fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'isolated fixture'
  );
  const before = runtimeSourceSnapshot(dir);
  assert.equal(before.dirty, false);
  writeFileSync(path.join(dir, 'source'), 'changed');
  const changed = runtimeSourceSnapshot(dir);
  assert.equal(changed.checkoutSha, before.checkoutSha);
  assert.notEqual(changed.worktreeSha256, before.worktreeSha256);
  writeFileSync(path.join(dir, 'new-source'), 'one');
  const newFile = runtimeSourceSnapshot(dir);
  writeFileSync(path.join(dir, 'new-source'), 'two');
  assert.notEqual(runtimeSourceSnapshot(dir).worktreeSha256, newFile.worktreeSha256);
});

test('the real pinned Vitest reporter retains original failing assertions before acceptance', (t) => {
  const cache = path.join(runtimeRoot, 'node_modules/.cache');
  mkdirSync(cache, { recursive: true });
  const dir = mkdtempSync(path.join(cache, 'runtime-progress-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const suite = path.relative(runtimeRoot, path.join(dir, 'fixture.test.ts'));
  writeFileSync(
    path.join(dir, 'fixture.test.ts'),
    "import { it, expect } from 'vitest'; it('keeps the original red assertion', () => expect(1).toBe(2));\n"
  );
  writeFileSync(
    path.join(dir, 'config.mjs'),
    "export default { test: { include: ['fixture.test.ts'], environment: 'node', pool: 'forks', minWorkers: 1, maxWorkers: 1 } };\n"
  );
  writeFileSync(
    path.join(dir, 'selection.json'),
    JSON.stringify({ checkoutSha: sha, suites: [suite] })
  );
  const child = spawnSync(
    process.execPath,
    [
      path.join(runtimeRoot, 'node_modules/vitest/vitest.mjs'),
      'run',
      '--root',
      dir,
      '--config',
      path.join(dir, 'config.mjs'),
      '--reporter',
      path.join(runtimeRoot, 'scripts/test/runtime-progress-reporter.mjs'),
    ],
    {
      cwd: runtimeRoot,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        PROTO_UI_RUNTIME_ROOT: runtimeRoot,
        PROTO_UI_RUNTIME_PROGRESS_FILE: path.join(dir, 'progress.json'),
        PROTO_UI_RUNTIME_SELECTION_FILE: path.join(dir, 'selection.json'),
      },
    }
  );
  assert.equal(child.status, 1, child.stderr);
  const report = JSON.parse(readFileSync(path.join(dir, 'progress.json'), 'utf8'));
  assert.equal(report.finished, true);
  const failed = report.suites[0].observation.children[0];
  assert.equal(failed.status, 'fail');
  assert.match(failed.name, /original red assertion/);
  assert.match(failed.errors[0].message, /expected 1 to be 2/);
  const journal = readFileSync(path.join(dir, 'progress.json.events.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(journal[0].type, 'selection');
  assert.ok(
    journal.some(
      (entry) =>
        entry.type === 'task' &&
        entry.state === 'fail' &&
        entry.name.includes('original red assertion')
    )
  );
  assert.ok(journal.every((entry) => !Object.hasOwn(entry, 'children')));
});
