import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { generalCheckPlan, executeGeneralChecks } from './general-ci.mjs';
import { generalJobPlan, assertGeneralCheckEvidence } from './general-check-plan.mjs';
import YAML from 'yaml';
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
  browserSuiteWeightSeconds,
  BROWSER_SUITES,
  BROWSER_SHARD_COUNT,
  BROWSER_EXECUTION_BUDGET_SECONDS,
  BROWSER_SETUP_RESERVE_SECONDS,
  SEARCH_BROWSER_SUITES,
  validateBrowserCostEvidence,
} from './runtime-test-plan.mjs';

const sha = 'a'.repeat(40);
const snapshot = {
  checkoutSha: sha,
  treeSha: 'b'.repeat(40),
  dirty: false,
  worktreeSha256: 'c'.repeat(64),
};

test('Search splitting preserves the complete retained inventory and fixed worker budgets', () => {
  assert.deepEqual(SEARCH_BROWSER_SUITES, [
    'apps/www/src/content/docs/zh-cn/site-search-activation.browser.test.ts',
    'apps/www/src/content/docs/zh-cn/site-search-layout.browser.test.ts',
    'apps/www/src/content/docs/zh-cn/site-search-menu.browser.test.ts',
  ]);
  assert.equal(BROWSER_SHARD_COUNT, 20);
  assert.equal(BROWSER_EXECUTION_BUDGET_SECONDS, 900);
  assert.equal(BROWSER_SETUP_RESERVE_SECONDS, 180);
  const shards = browserShards();
  assert.equal(shards.length, 20);
  assert.deepEqual([...shards.flat()].sort(), [...BROWSER_SUITES].sort());
  assert.equal(new Set(shards.flat()).size, BROWSER_SUITES.length);
  assert.ok(
    shards.every(
      (shard) => shard.length > 0 && shard.length <= Math.ceil(BROWSER_SUITES.length / 20)
    )
  );
  assert.deepEqual(browserShards([...BROWSER_SUITES].reverse()), shards);
  for (const suite of SEARCH_BROWSER_SUITES)
    assert.equal(shards.flat().filter((selected) => selected === suite).length, 1);
  assert.ok(
    !BROWSER_SUITES.includes('apps/www/src/content/docs/zh-cn/site-search-commands.browser.test.ts')
  );
});

test('the isolated homepage workflow selects the complete retained Search replacement inventory', () => {
  const workflow = YAML.parse(
    readFileSync(
      new URL('../../.github/workflows/homepage-visual-evidence.yml', import.meta.url),
      'utf8'
    )
  );
  const job = workflow.jobs['isolated-controls'];
  const search = job.strategy.matrix.include.filter((entry) =>
    entry.suite.startsWith('site-search-')
  );
  const files = search.map(
    (entry) => `apps/www/src/content/docs/zh-cn/${entry.suite}.browser.test.ts`
  );
  assert.deepEqual(files, SEARCH_BROWSER_SUITES);
  for (const file of files)
    assert.ok(readFileSync(new URL(`../../${file}`, import.meta.url)).length);
  assert.equal(
    search.filter((entry) => entry.contract === 'site-search-browser-inventory').length,
    1
  );
  assert.equal(job['timeout-minutes'], 15);
  const execution = job.steps.find(
    (step) => step.name === 'Execute the exact isolated browser suite'
  );
  assert.equal(execution['timeout-minutes'], 12);
  assert.match(execution.run, /timeout --signal=TERM --kill-after=10s 600s/);
  assert.match(execution.run, /test -f "\$FILE"/);
});

test('suite exchanges cannot make an impossible complete workload pass capacity admission', () => {
  const impossible = browserShards(BROWSER_SUITES, 1);
  assert.deepEqual([...impossible.flat()].sort(), [...BROWSER_SUITES].sort());
  assert.throws(() => assertBrowserShardCapacity(impossible), /beyond 900s/);
});

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

test('the latest official terminal costs retain failures and exclude interrupted selections', () => {
  const evidence = validateBrowserCostEvidence(
    JSON.parse(
      readFileSync(
        new URL('./fixtures/browser-suite-costs-45537881490.json', import.meta.url),
        'utf8'
      )
    )
  );
  const directory = new URL(
    '../../internal/records/evidence/2026-11-25-release-gate-browser-costs/',
    import.meta.url
  );
  const receipt = JSON.parse(readFileSync(new URL('receipt.json', directory), 'utf8'));
  const observations = [];
  const missing = [];
  assert.equal(receipt.runId, evidence.runId);
  assert.equal(receipt.headSha, evidence.headSha);
  assert.equal(receipt.jobs.length, 18);
  for (const job of receipt.jobs) {
    // Original raw logs live in the published ancestor after evidence archival.
    // Keep their exact bytes and every digest/selection/terminal assertion below.
    let compressed;
    try {
      compressed = execFileSync(
        'git',
        [
          'show',
          `1c4a23455175ec65d3b41a630cfa9797d74a721d:internal/records/evidence/2026-11-25-release-gate-browser-costs/${job.logPath}`,
        ],
        { cwd: runtimeRoot, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }
      );
    } catch (cause) {
      throw new Error(
        `Original browser-cost evidence requires complete Git history through 1c4a23455175ec65d3b41a630cfa9797d74a721d; unable to read ${job.logPath}.`,
        { cause }
      );
    }
    const bytes = gunzipSync(compressed);
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.equal(createHash('sha256').update(compressed).digest('hex'), job.gzipSha256);
    assert.equal(digest, job.logSha256);
    const log = bytes.toString('utf8').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
    const selection = JSON.parse(
      log
        .split('\n')
        .find((line) => line.includes('[test:runtime] selection '))
        .split('[test:runtime] selection ')[1]
    );
    assert.deepEqual(selection, job.selection);
    assert.equal(selection.checkoutSha, evidence.headSha);
    const terminal = new Set();
    for (const match of log.matchAll(
      /(✓|❯|×)\s+((?:apps|packages)\/\S+\.test\.[cm]?[jt]sx?)\s+\(([^)]*)\)\s+([\d.]+)ms/g
    )) {
      const row = evidence.observations.find((entry) => entry.suite === match[2]);
      assert.ok(row, `unrecorded terminal file: ${match[2]}`);
      assert.ok(selection.suites.includes(row.suite));
      assert.equal(row.jobId, job.jobId);
      assert.equal(row.logSha256, digest);
      assert.equal(row.durationMs, Number(match[4]));
      assert.equal(row.summary, match[3]);
      assert.equal(row.fileOutcome, match[1] === '✓' ? 'passed' : 'failed');
      terminal.add(row.suite);
      observations.push(row.suite);
    }
    missing.push(...selection.suites.filter((suite) => !terminal.has(suite)));
  }
  assert.equal(observations.length, 98);
  assert.equal(new Set(observations).size, 98);
  assert.equal(evidence.observations.filter((row) => row.fileOutcome === 'failed').length, 15);
  assert.deepEqual(observations.sort(), evidence.observations.map((row) => row.suite).sort());
  assert.equal(missing.length, 16);
  assert.deepEqual(missing.sort(), receipt.selectedWithoutTerminal.map((row) => row.suite).sort());
  for (const suite of missing) assert.ok(!observations.includes(suite));
  assert.equal(BROWSER_SHARD_COUNT, 20);
  assert.doesNotThrow(() => assertBrowserShardCapacity());
});

test('new terminal costs reject the interrupted shard allocation without inventing its remaining results', () => {
  const evidence = validateBrowserCostEvidence(
    JSON.parse(
      readFileSync(
        new URL('./fixtures/browser-suite-costs-46161223435.json', import.meta.url),
        'utf8'
      )
    )
  );
  assert.equal(evidence.runId, 46161223435);
  assert.equal(evidence.headSha, 'd858406214482b9700e60ca425ef4e9ed8219da8');
  assert.equal(evidence.capturedJobs.length, 12);
  assert.equal(evidence.observations.length, 61);
  for (const row of evidence.observations) {
    assert.ok(BROWSER_SUITES.includes(row.suite));
    assert.ok(evidence.capturedJobs.includes(row.jobId));
    assert.ok(browserSuiteWeightSeconds(row.suite) >= Math.ceil(row.durationMs / 1000), row.suite);
  }
  const interrupted = evidence.observations.filter((row) => row.jobId === 141028823358);
  assert.deepEqual(
    interrupted.map((row) => row.durationMs),
    [80459, 38216, 13288, 541603]
  );
  assert.ok(interrupted.every((row) => row.fileOutcome === 'passed' && !row.jobCompletedVitest));
  assert.equal(evidence.observations.filter((row) => row.fileOutcome === 'failed').length, 1);
  assert.equal(
    evidence.observations.find((row) => row.fileOutcome === 'failed').suite,
    'apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts'
  );
  assert.equal(evidence.selectedWithoutTerminal.length, 10);
  for (const { suite } of evidence.selectedWithoutTerminal) {
    assert.ok(!evidence.observations.some((row) => row.suite === suite));
    assert.ok(browserSuiteWeightSeconds(suite) > 0);
  }
  const unfinished = evidence.selectedWithoutTerminal
    .filter((row) => row.jobId === 141028823358)
    .map((row) => row.suite);
  assert.deepEqual(unfinished, [
    'apps/www/src/content/docs/zh-cn/contents-wheel-evidence.browser.test.ts',
    'apps/www/src/content/docs/zh-cn/runtime-layout-parity.browser.test.ts',
  ]);
  const oldAllocation = [...interrupted.map((row) => row.suite), ...unfinished];
  assert.equal(oldAllocation.length, 6);
  assert.throws(() => assertBrowserShardCapacity([oldAllocation]), /beyond 900s/);
});

test('the actual new cost floor cannot fit nineteen workers with the original setup reserve', () => {
  const total = BROWSER_SUITES.reduce((sum, suite) => sum + browserSuiteWeightSeconds(suite), 0);
  const workerCapacity = BROWSER_EXECUTION_BUDGET_SECONDS - BROWSER_SETUP_RESERVE_SECONDS;
  assert.ok(total > 19 * workerCapacity);
  assert.throws(() => assertBrowserShardCapacity(browserShards(BROWSER_SUITES, 19)), /beyond 900s/);
  assert.doesNotThrow(() => assertBrowserShardCapacity());
});

test('general planning preserves every root gate and separates controls from runtime execution', () => {
  const manifest = JSON.parse(readFileSync(path.join(runtimeRoot, 'package.json'), 'utf8'));
  const plan = generalCheckPlan(manifest, sha);
  const rootScripts = manifest.scripts.test
    .split(' && ')
    .map((command) => command.split(' ').at(-1));
  assert.deepEqual(
    plan
      .slice(3)
      .map((step) => step.id)
      .filter((id) => !id.startsWith('test:runtime:')),
    rootScripts.filter((id) => id !== 'test:runtime')
  );
  assert.deepEqual(
    plan.slice(0, 3).map((step) => step.id),
    ['check:spec-authoring', 'check:public-docs', 'build:packages']
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

test('independent governance and general jobs retain every original check and required local inputs', () => {
  const manifest = JSON.parse(readFileSync(path.join(runtimeRoot, 'package.json'), 'utf8'));
  const full = generalCheckPlan(manifest, sha);
  const governance = generalJobPlan(manifest, 'governance', sha);
  const general = generalJobPlan(manifest, 'general');
  assert.deepEqual(
    governance,
    full.filter((step) => !step.id.startsWith('test:runtime:'))
  );
  assert.deepEqual(
    general.slice(2),
    full.filter((step) => step.id.startsWith('test:runtime:'))
  );
  assert.deepEqual(
    general[0],
    full.find((step) => step.id === 'build:packages')
  );
  assert.deepEqual(general[1], {
    id: 'prepare:runtime-styles',
    args: ['pnpm@10.32.1', '--filter', 'apps-www', 'generate:proto-ui-style'],
  });
  assert.deepEqual(
    [...new Set([...governance, ...general].map((step) => step.id))].sort(),
    [...full.map((step) => step.id), 'prepare:runtime-styles'].sort()
  );
  assert.equal(
    [...governance, ...general].filter((step) => step.id === 'build:packages').length,
    2,
    'Each isolated job builds its own package graph'
  );
  assert.throws(() => generalJobPlan(manifest, 'governance'), /Exact/);
  assert.throws(() => generalJobPlan(manifest, 'unknown', sha), /Unknown/);
});

test('a failed isolated preparation still runs controls and the whole runtime command', async () => {
  const manifest = JSON.parse(readFileSync(path.join(runtimeRoot, 'package.json'), 'utf8'));
  const steps = generalJobPlan(manifest, 'general');
  const reached = [];
  const result = await executeGeneralChecks(steps, async (step) => {
    reached.push(step.id);
    return { exitCode: step.id === 'prepare:runtime-styles' ? 17 : 0, signal: null };
  });
  assert.deepEqual(reached, [
    'build:packages',
    'prepare:runtime-styles',
    'test:runtime:controls',
    'test:runtime:execute',
  ]);
  assert.equal(result.passed, false);
  assert.deepEqual(result.results.at(-1).args, ['scripts/test/run-runtime-tests.mjs']);
});

test('governance evidence rejects omissions, forged aggregate success, changed commands and missing clocks', () => {
  const manifest = JSON.parse(readFileSync(path.join(runtimeRoot, 'package.json'), 'utf8'));
  const steps = generalJobPlan(manifest, 'governance', sha);
  const valid = {
    job: 'governance',
    specBase: sha,
    steps,
    sourceStable: true,
    passed: true,
    results: steps.map((step) => ({
      ...step,
      passed: true,
      exitCode: 0,
      signal: null,
      startedAt: '2026-11-23T00:00:00.000Z',
      finishedAt: '2026-11-23T00:00:01.000Z',
      logFile: `${step.id.replaceAll(':', '-')}.log`,
    })),
  };
  assert.doesNotThrow(() => assertGeneralCheckEvidence(valid, 'governance', manifest, sha));
  for (const mutate of [
    (r) => r.results.pop(),
    (r) => r.results.push(r.results[0]),
    (r) => r.results.reverse(),
    (r) => {
      r.results[0].args = ['echo', 'success'];
    },
    (r) => {
      r.results[0].exitCode = 1;
    },
    (r) => {
      r.results[0].signal = 'SIGTERM';
    },
    (r) => {
      r.results[0].passed = false;
    },
    (r) => {
      r.results[0].error = 'interrupted';
    },
    (r) => {
      delete r.results[0].finishedAt;
    },
    (r) => {
      r.sourceStable = false;
    },
    (r) => {
      r.specBase = 'b'.repeat(40);
    },
  ]) {
    const changed = structuredClone(valid);
    mutate(changed);
    assert.throws(() => assertGeneralCheckEvidence(changed, 'governance', manifest, sha));
  }
});

test('governance and general runtime have separate execution budgets and both block Tests and the cycle', () => {
  const { jobs } = YAML.parse(
    readFileSync(path.join(runtimeRoot, '.github/workflows/ci.yml'), 'utf8')
  );
  const governance = jobs['test-governance'];
  const general = jobs['test-general'];
  assert.equal(general.needs, 'test-plan');
  assert.deepEqual(governance.needs, ['test-plan', 'cycle-plan']);
  for (const [job, name, minutes] of [
    [governance, 'governance', 45],
    [general, 'general', 90],
  ]) {
    assert.equal(job['timeout-minutes'], minutes);
    assert.equal(job.env.PROTO_UI_GENERAL_JOB, name);
    assert.equal(job.env.PROTO_UI_RUNTIME_SLOT, name);
    assert.equal(job['continue-on-error'], undefined);
    assert.equal(job.if, "${{ github.event_name != 'pull_request' }}");
    assert.equal(
      job.steps.filter((step) => step.run?.includes('node scripts/test/general-ci.mjs')).length,
      1
    );
    for (const receipt of job.steps.filter(
      (step) =>
        step.run?.includes('runtime-ci.mjs finish') || step.uses === 'actions/upload-artifact@v4'
    ))
      assert.equal(receipt.if, 'always()');
  }
  assert.ok(
    governance.steps.some((step) => step.run?.includes('decode-video-evidence.integration.mjs'))
  );
  assert.deepEqual(jobs.test.needs, [
    'cycle-plan',
    'test-plan',
    'test-governance',
    'test-general',
    'test-browser',
  ]);
  for (const job of ['test-governance', 'test-general'])
    assert.ok(jobs['cycle-report'].needs.includes(job));
  const runtime = readFileSync(
    path.join(runtimeRoot, 'scripts/test/runtime-test-plan.mjs'),
    'utf8'
  );
  assert.match(runtime, /'--minWorkers=1'/);
  assert.match(runtime, /'--maxWorkers=2'/);
  assert.throws(
    () => generalJobPlan({ scripts: { test: 'echo pass' } }, 'general'),
    /Unrecognized/
  );
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
