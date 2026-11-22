import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';
import {
  assertSprint1StepEvidence,
  finishSprint1,
  prepareSprint1,
  runSprint1,
  runSprint1Command,
  sprint1Plan,
  SPRINT1_BROWSER_SUITES,
  SPRINT1_CLEANUP_MS,
  SPRINT1_MATRIX_CASE,
  SPRINT1_NODE_SUITES,
  SPRINT1_TOTAL_MS,
  SPRINT1_UNIT_SUITES,
} from './sprint1-evidence.mjs';
import {
  assertBrowserInventory,
  assertBrowserShardCapacity,
  BROWSER_SUITES,
  createRuntimeTestPlan,
} from './runtime-test-plan.mjs';

function temporary(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'sprint1-controls-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function sourceFixture(t) {
  const directory = temporary(t);
  const repo = path.join(directory, 'repo');
  const output = path.join(directory, 'evidence');
  mkdirSync(repo);
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init');
  writeFileSync(
    path.join(repo, 'control.txt'),
    'Simulated source for runner tests; not native evidence.\n'
  );
  git('add', 'control.txt');
  git(
    '-c',
    'user.name=Runner Control',
    '-c',
    'user.email=control@example.invalid',
    'commit',
    '-m',
    'Simulated runner source'
  );
  const sha = git('rev-parse', 'HEAD');
  return { directory, repo, output, sha };
}

// Deliberately synthetic producer reports exercise the strict aggregation gate.
// None of these records are a browser, input or application acceptance result.
function simulatedReport(step, sha, repo) {
  if (step.report.kind === 'tap')
    return '# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  if (['vitest', 'vitest-case'].includes(step.report.kind))
    return {
      success: true,
      numFailedTests: 0,
      numFailedTestSuites: 0,
      numPassedTests: step.suites.length,
      testResults: step.suites.map((suite) => ({
        name: path.join(repo, suite),
        status: 'passed',
        assertionResults: step.includedTestNames
          ? [
              ...step.includedTestNames.map((fullName) => ({ fullName, status: 'passed' })),
              { fullName: 'simulated deliberately unselected case', status: 'pending' },
            ]
          : [{ fullName: 'simulated producer gate control', status: 'passed' }],
      })),
    };
  if (step.report.kind === 'number-field') {
    const runtimes = ['wc', 'react', 'vue', 'vue2'];
    const cases = runtimes.flatMap((runtime) =>
      step.families.map((family) => ({ runtime, family, kind: 'number-field', status: 'passed' }))
    );
    return {
      source: { head: sha },
      environment: { runtimes, families: step.families, kinds: ['number-field'] },
      cases,
      numberFieldIme: cases.map((entry) => ({
        ...entry,
        cases: [false, true].map((controlled) => ({ controlled, status: 'passed' })),
      })),
      numberFieldImeControls: [false, true].map((controlled) => ({ controlled, status: 'passed' })),
    };
  }
  return {
    sourceSha: sha,
    plan: { pairs: 5, readinessBudgetMs: 1000 },
    samples: Array.from({ length: 80 }, (_, index) => ({ id: `simulated-${index}` })),
    summary: {
      complete: true,
      variants: {
        current: { planned: 40, readinessPasses: 40 },
        'forced-write': { readinessFailures: ['simulated-negative-control'] },
      },
    },
    passed: true,
  };
}
function writeSimulated(step, sha, repo) {
  if (!step.report) return;
  mkdirSync(path.dirname(step.report.path), { recursive: true });
  const report = simulatedReport(step, sha, repo);
  writeFileSync(step.report.path, typeof report === 'string' ? report : JSON.stringify(report));
}

test('the fixed serial selection preserves the full original criteria and bounded resource budget', () => {
  const steps = sprint1Plan('/tmp/simulated-sprint1', 'a'.repeat(40));
  assert.equal(steps.length, 11);
  assert.equal(new Set(steps.map((step) => step.id)).size, steps.length);
  assert.equal(SPRINT1_TOTAL_MS, 80 * 60_000);
  assert.ok(
    steps.reduce((sum, step) => sum + step.timeoutMs + SPRINT1_CLEANUP_MS, 0) < SPRINT1_TOTAL_MS
  );
  assert.ok(
    SPRINT1_NODE_SUITES.includes('scripts/analysis/test/number-field-ime-evidence.test.mjs')
  );
  for (const suite of [
    'apps/www/src/content/docs/zh-cn/demo-matrix-activation.test.ts',
    'packages/compiler/test/props-update-policy.test.ts',
    'packages/prototypes/base/test/select-legacy-slot.test.ts',
    'packages/compiler/test/diagnostic-origin.test.ts',
    'packages/compiler/src/diagnostic-format.test.ts',
    'packages/prototypes/base/test/number-field-capabilities.test.ts',
    'packages/prototypes/base/test/number-field-format.test.ts',
  ])
    assert.ok(SPRINT1_UNIT_SUITES.includes(suite));
  assert.equal(SPRINT1_UNIT_SUITES.length, 27);
  const search = steps.find((step) => step.id === 'search-native');
  assert.equal(search.timeoutMs, 1_200_000);
  assert.deepEqual(search.suites, [
    'apps/www/src/content/docs/zh-cn/site-search-commands.browser.test.ts',
  ]);
  assert.ok(
    search.args.every(
      (arg) => !/^--(?:testNamePattern|testTimeout|hookTimeout|bail)(?:=|$)/.test(arg)
    ),
    'Producer budget must not filter Search cases or override their original limits'
  );
  const release = steps.find((step) => step.id === 'number-field-0.3');
  assert.equal(release.env.PUI_BROWSER_FAMILIES, 'base,shadcn,brutalist');
  assert.equal(release.env.PUI_BROWSER_RUNTIMES, 'wc,react,vue,vue2');
  assert.equal(
    steps.find((step) => step.id === 'number-field-experimental').env.PUI_BROWSER_FAMILIES,
    'bootstrap-2-3-2,liquid-glass'
  );
  assert.equal(
    steps.find((step) => step.id === 'search-props-ab').env.PROTO_UI_SEARCH_AB_SHA,
    'a'.repeat(40)
  );
  assert.ok(
    steps.every(
      (step) => !step.args.includes('--passWithNoTests') && !step.args.includes('--retry')
    )
  );
});

test('new native suites remain in the complete scheduled inventory and fit the existing 18 shards', () => {
  assertBrowserInventory();
  assertBrowserShardCapacity();
  const [general, browser] = createRuntimeTestPlan([]);
  for (const suite of SPRINT1_BROWSER_SUITES) {
    assert.equal(BROWSER_SUITES.filter((candidate) => candidate === suite).length, 1);
    assert.equal(general.args[general.args.indexOf(suite) - 1], '--exclude');
    assert.ok(browser.args.includes(suite));
  }
});

test('the existing repair scope and manual serial Sprint 1 owner retain actual workflow wiring', () => {
  const workflow = YAML.parse(
    readFileSync('.github/workflows/browser-suite-repair-evidence.yml', 'utf8')
  );
  assert.deepEqual(Object.keys(workflow.on).sort(), ['workflow_call', 'workflow_dispatch']);
  assert.equal(workflow.on.workflow_dispatch.inputs.scope.default, 'repair');
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.scope.options, ['repair', 'sprint1']);
  assert.equal(workflow.on.workflow_call.inputs.scope.default, 'repair');
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const repair = workflow.jobs['focused-browser'];
  assert.equal(repair.if, "${{ inputs.scope != 'sprint1' }}");
  assert.ok(repair.steps.some((step) => step.run === 'test "$EVIDENCE_SCOPE" = repair'));
  const original = repair.steps.find(
    (step) => step.name === 'Exercise unchanged controls with failure diagnostics'
  );
  for (const suite of [
    'demo-base-image.browser.test.ts',
    'scroll-end-follow.browser.test.ts',
    'brutalist-spinner.capture.browser.test.ts',
  ])
    assert.ok(original.run.includes(suite));
  const job = workflow.jobs.sprint1;
  assert.equal(job['timeout-minutes'], 90);
  assert.equal(job.strategy, undefined, 'Heavy operations run in one serial worker');
  const execute = job.steps.find((step) => step.run?.includes('sprint1-evidence.mjs run'));
  assert.equal(execute.if, '${{ !cancelled() }}');
  assert.equal(execute['timeout-minutes'] * 60_000, SPRINT1_TOTAL_MS);
  assert.equal(execute['continue-on-error'], undefined);
  assert.equal(
    job.steps.find((step) => step.run?.includes('sprint1-evidence.mjs finish')).if,
    'always()'
  );
  const upload = job.steps.find((step) => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()');
  assert.match(upload.with.name, /github.run_attempt/);
});

test('strict producer validation rejects missing suites, skips, owner gaps and lowered Search thresholds', (t) => {
  const f = sourceFixture(t);
  const steps = sprint1Plan(f.output, f.sha, f.repo);
  for (const step of steps.filter((entry) => entry.report)) {
    writeSimulated(step, f.sha, f.repo);
    assert.doesNotThrow(() => assertSprint1StepEvidence(step, f.sha, f.repo));
  }
  for (const mutate of [
    (report) => report.testResults.pop(),
    (report) => {
      report.testResults[0].assertionResults[0].status = 'skipped';
    },
    (report) => {
      report.numPassedTests = 0;
    },
  ]) {
    const step = steps.find((entry) => entry.id === 'focused-unit');
    const report = simulatedReport(step, f.sha, f.repo);
    mutate(report);
    writeFileSync(step.report.path, JSON.stringify(report));
    assert.throws(() => assertSprint1StepEvidence(step, f.sha, f.repo));
  }
  const matrix = steps.find((entry) => entry.id === 'matrix-accessibility-consumer');
  assert.deepEqual(matrix.includedTestNames, [SPRINT1_MATRIX_CASE]);
  for (const mutate of [
    (report) => {
      report.testResults[0].assertionResults[0].status = 'pending';
    },
    (report) => {
      report.testResults[0].assertionResults[0].fullName = 'wrong selected case';
    },
    (report) => {
      report.testResults[0].assertionResults[1].status = 'passed';
    },
  ]) {
    const report = simulatedReport(matrix, f.sha, f.repo);
    mutate(report);
    writeFileSync(matrix.report.path, JSON.stringify(report));
    assert.throws(() => assertSprint1StepEvidence(matrix, f.sha, f.repo));
  }
  const ime = steps.find((entry) => entry.id === 'number-field-0.3');
  for (const mutate of [
    (report) => report.cases.pop(),
    (report) => report.numberFieldIme[0].cases.pop(),
    (report) => {
      report.numberFieldIme[0].cases[1].status = 'failed';
    },
    (report) => {
      report.source.head = 'b'.repeat(40);
    },
  ]) {
    const report = simulatedReport(ime, f.sha, f.repo);
    mutate(report);
    writeFileSync(ime.report.path, JSON.stringify(report));
    assert.throws(() => assertSprint1StepEvidence(ime, f.sha, f.repo));
  }
  const ab = steps.find((entry) => entry.id === 'search-props-ab');
  for (const mutate of [
    (report) => {
      report.plan.readinessBudgetMs = 1500;
    },
    (report) => report.samples.pop(),
    (report) => {
      report.summary.variants.current.readinessPasses = 39;
    },
  ]) {
    const report = simulatedReport(ab, f.sha, f.repo);
    mutate(report);
    writeFileSync(ab.report.path, JSON.stringify(report));
    assert.throws(() => assertSprint1StepEvidence(ab, f.sha, f.repo));
  }
  const tap = steps[0];
  writeFileSync(
    tap.report.path,
    '# tests 1\n# pass 0\n# fail 0\n# cancelled 0\n# skipped 1\n# todo 0\n'
  );
  assert.throws(() => assertSprint1StepEvidence(tap, f.sha, f.repo));
});

test('all selected steps receive terminal receipts after earlier errors without replacing the original cause', async (t) => {
  const f = sourceFixture(t);
  prepareSprint1(f.output, f.repo, f.sha);
  const called = [];
  const result = await runSprint1(f.output, {
    repo: f.repo,
    expectedSha: f.sha,
    execute: async (step) => {
      called.push(step.id);
      if (step.id === 'node-controls') throw new Error('original failing control');
      writeSimulated(step, f.sha, f.repo);
      return { exitCode: step.id === 'styles' ? 7 : 0, signal: null, cleanupErrors: [] };
    },
  });
  assert.deepEqual(
    called,
    result.steps.map((step) => step.id)
  );
  assert.equal(result.results.length, 11);
  assert.equal(result.passed, false);
  assert.match(result.results[0].validationError, /original failing control/);
  assert.equal(result.results[2].commandExitCode, 7);
  assert.equal(result.results[2].passed, false);
  assert.equal(result.results.at(-1).passed, true);
  assert.equal(JSON.parse(readFileSync(path.join(f.output, 'progress.json'))).current, null);
});

test('an old green report cannot satisfy a new producer that did not write its own report', async (t) => {
  const f = sourceFixture(t);
  const plan = prepareSprint1(f.output, f.repo, f.sha);
  for (const step of plan.steps) writeSimulated(step, f.sha, f.repo);
  const result = await runSprint1(f.output, {
    repo: f.repo,
    expectedSha: f.sha,
    execute: async () => ({ exitCode: 0, signal: null, cleanupErrors: [] }),
  });
  assert.equal(result.passed, false);
  assert.ok(result.results.filter((step) => step.report).every((step) => !step.passed));
});

test('unconfirmed owned-process cleanup blocks later resource use and retains every terminal', async (t) => {
  const f = sourceFixture(t);
  prepareSprint1(f.output, f.repo, f.sha);
  let attempts = 0;
  const result = await runSprint1(f.output, {
    repo: f.repo,
    expectedSha: f.sha,
    execute: async (step) => {
      attempts++;
      writeSimulated(step, f.sha, f.repo);
      return {
        exitCode: 0,
        signal: null,
        cleanupErrors: ['simulated unconfirmed process exit'],
        survivors: [{ pid: 999999999, started: 'simulated; no process is signaled' }],
      };
    },
  });
  assert.equal(attempts, 1, 'A later heavy command cannot compete with a known survivor');
  assert.equal(result.passed, false);
  assert.ok(
    result.results.slice(1).every((step) => step.terminal === 'blocked-cleanup' && !step.passed)
  );
  for (const step of result.steps) {
    const receipt = JSON.parse(readFileSync(path.join(f.output, step.id, 'receipt.json')));
    assert.ok(receipt.validationError || receipt.terminal === 'blocked-cleanup');
  }
});

test('source drift and interrupted setup are explicit failures with every selected missing outcome', (t) => {
  const f = sourceFixture(t);
  assert.throws(() => prepareSprint1(f.output, f.repo, 'b'.repeat(40)), /requested source/);
  prepareSprint1(f.output, f.repo, f.sha);
  const interrupted = finishSprint1(f.output, f.repo, 'setup failed before execution');
  assert.equal(interrupted.passed, false);
  assert.equal(interrupted.results.length, 11);
  assert.ok(interrupted.results.every((step) => step.terminal === 'not-completed' && !step.passed));
  writeFileSync(path.join(f.repo, 'control.txt'), 'changed source');
  const changed = finishSprint1(f.output, f.repo);
  assert.equal(changed.passed, false);
  assert.match(changed.sourceError, /source changed|Dirty runtime/);
});

test('the bounded process retains real nonzero exit and output', async (t) => {
  const directory = temporary(t);
  const result = await runSprint1Command(
    {
      id: 'failure-control',
      executable: process.execPath,
      args: ['-e', "console.log('original failure output'); process.exitCode=7"],
      timeoutMs: 2000,
    },
    directory
  );
  assert.equal(result.exitCode, 7);
  assert.equal(result.timedOut, false);
  assert.deepEqual(result.cleanupErrors, []);
  assert.match(readFileSync(result.logFile, 'utf8'), /original failure output/);
});

test('timeout cleans only the owned detached descendant and retains a failed terminal', async (t) => {
  const directory = temporary(t);
  const sentinel = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  t.after(() => sentinel.kill('SIGKILL'));
  const descendant = "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)";
  const program = `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{detached:true,stdio:'ignore'});console.log('owned='+child.pid);setInterval(()=>{},1000);`;
  const result = await runSprint1Command(
    { id: 'timeout-control', executable: process.execPath, args: ['-e', program], timeoutMs: 1000 },
    directory,
    { cleanupMs: 300 }
  );
  assert.equal(result.timedOut, true);
  assert.deepEqual(result.survivors, []);
  const pid = Number(/owned=(\d+)/.exec(readFileSync(result.logFile, 'utf8'))?.[1]);
  assert.ok(pid > 0);
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    assert.equal(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0], 'Z');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  assert.doesNotThrow(() => process.kill(sentinel.pid, 0), 'Unrelated process remains alive');
});

test('an immediate owner exit cannot hide a reparented detached child between lineage polls', async (t) => {
  const directory = temporary(t);
  const sentinel = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  t.after(() => sentinel.kill('SIGKILL'));
  let childPid;
  t.after(() => {
    if (childPid)
      try {
        process.kill(childPid, 'SIGKILL');
      } catch {}
  });
  const program =
    "const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});console.log('owned='+child.pid);child.unref();";
  const result = await runSprint1Command(
    {
      id: 'immediate-orphan-control',
      executable: process.execPath,
      args: ['-e', program],
      timeoutMs: 2000,
    },
    directory,
    { cleanupMs: 300 }
  );
  childPid = Number(/owned=(\d+)/.exec(readFileSync(result.logFile, 'utf8'))?.[1]);
  assert.ok(childPid > 0);
  assert.equal(result.exitCode, 0, 'Retain the producer exit separately from cleanup acceptance');
  assert.ok(result.cleanupErrors.includes('Command exited with live owned descendants'));
  assert.deepEqual(result.survivors, []);
  try {
    const stat = readFileSync(`/proc/${childPid}/stat`, 'utf8');
    assert.equal(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0], 'Z');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  assert.doesNotThrow(
    () => process.kill(sentinel.pid, 0),
    'A different process does not inherit the marker'
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /PROTO_UI_SPRINT1_PROCESS_OWNER=/,
    'Environment contents are not evidence output'
  );
});
