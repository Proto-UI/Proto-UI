// Explicit Sprint 1 selection. This lane supplements the full regression cycle;
// importing it starts no process, server or browser.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeGeneralChecks } from './general-ci.mjs';
import { assertRuntimeSource, assertVitestReport, writeJson } from './runtime-ci.mjs';
import { readOptionalJson, runtimeSourceSnapshot } from './runtime-observation.mjs';
import { liveOwned, observeChildren } from './linux-process-ownership.mjs';
import { SEARCH_BROWSER_SUITES } from './runtime-test-plan.mjs';

export const SPRINT1_BROWSER_SUITES = Object.freeze([
  'apps/www/src/content/docs/zh-cn/demo-matrix-accessibility.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-search-recovery.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-search-disposal.browser.test.ts',
]);
export const SPRINT1_UNIT_SUITES = Object.freeze([
  'apps/www/src/components/site-search-commands.recovery.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-matrix-observation.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-matrix-accessibility.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-matrix-activation.test.ts',
  'apps/www/src/content/docs/zh-cn/site-search-evidence.test.ts',
  'apps/www/src/components/site-search-commands.test.ts',
  'apps/www/src/components/site-search-commands.public-mode.test.ts',
  'apps/www/src/components/site-search-commands.disposal.test.ts',
  'apps/www/src/components/site-search-commands.theme-lease.test.ts',
  'apps/www/src/components/site-search-data.test.ts',
  'apps/www/src/components/site-search-session.test.ts',
  'apps/www/src/components/site-search-composition-paint-cost.test.ts',
  'packages/prototypes/base/test/select-legacy-slot.test.ts',
  'packages/prototypes/base/test/select.test.ts',
  'packages/prototypes/shadcn/test/select.test.ts',
  'packages/prototypes/brutalist/test/select.test.ts',
  'packages/adapters/react/test/select.test.ts',
  'packages/adapters/vue/test/select.test.ts',
  'packages/adapters/vue2/test/select.test.ts',
  'packages/adapters/react/test/raw-props-commit.integration.test.ts',
  'packages/prototypes/base/test/number-field-capabilities.test.ts',
  'packages/prototypes/base/test/number-field-format.test.ts',
  'packages/prototypes/base/test/number-field-supersession.test.ts',
  'packages/prototypes/base/test/range-owner-supersession.test.ts',
]);
// Additional controls for Anatomy, Shadow CSS, initial portal styles and main integration; keep the
// original focused-unit selection and its resource budget unchanged.
export const SPRINT1_INTEGRATION_UNIT_SUITES = Object.freeze([
  'packages/modules/anatomy/test/subscriber-fanout.test.ts',
  'packages/modules/anatomy/test/contract/anatomy-order.v0.contract.test.ts',
  'packages/runtime/test/contract/anatomy.order-fanout-cost.contract.test.ts',
  'packages/runtime/test/contract/anatomy.domain-fanout-cost.contract.test.ts',
  'packages/runtime/test/contract/anatomy.catalog-lifecycle.contract.test.ts',
  'apps/www/src/components/PrototypePreviewer/runtime-preview-portal-theme.test.ts',
  'apps/www/src/components/PrototypePreviewer/runtime-preview-surface.test.ts',
  'apps/www/src/components/PrototypePreviewer/passive-shell-composition.test.ts',
  'packages/adapters/web-component/test/shadow-style-artifact.test.ts',
  'packages/adapters/web-component/test/shadow-split-effects.test.ts',
  'packages/modules/positioning/test/floating-ui-host.test.ts',
  'packages/modules/positioning/test/available-projection-ownership.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-matrix-startup-diagnostic.test.ts',
]);
export const SPRINT1_NODE_SUITES = Object.freeze([
  'scripts/analysis/test/number-field-ime-evidence.test.mjs',
  'scripts/test/search-props-ab.test.mjs',
  'scripts/test/sprint1-evidence.test.mjs',
  'scripts/test/browser-suite-repair-toolbar.test.mjs',
  'scripts/test/run-runtime-tests.test.mjs',
  'scripts/ci/test/ci-scheduling-policy.test.mjs',
  'apps/www/scripts/run-search-production-evidence.test.mjs',
]);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimes = ['wc', 'react', 'vue', 'vue2'];
export const SPRINT1_TOTAL_MS = 80 * 60_000;
export const SPRINT1_CLEANUP_MS = 5_000;
export const SPRINT1_MATRIX_CASE =
  'Website Demo Matrix browser smoke mounts every demo in every official Web adapter';
// Written by the existing four production cases on their successful paths.
// The poll records carry original 1000ms publication verdicts; destination
// captures cover both family journeys and their native IME/keyboard journeys.
export const SPRINT1_PRODUCTION_CAPTURES = Object.freeze([
  'native-ime-plain-input-control.json',
  'pagefind-empty-query-control.json',
  ...['shadcn', 'brutalist'].flatMap((family) => [
    `${family}-destination.json`,
    `${family}-ime-keyboard-destination.json`,
    ...['vue', 'react', 'vue2', 'wc'].map((runtime) => `${family}-runtime-${runtime}-poll.json`),
  ]),
]);

export function sprint1Plan(directory, sourceSha, repo = root) {
  assert.match(sourceSha ?? '', /^[a-f0-9]{40}$/, 'Exact Sprint 1 source SHA is required');
  const output = path.resolve(directory);
  const node = (id, args, seconds, extra = {}) => ({
    id,
    executable: process.execPath,
    args,
    timeoutMs: seconds * 1000,
    ...extra,
  });
  const vitest = (id, suites, seconds) => {
    const report = path.join(output, id, 'vitest.json');
    return node(
      id,
      [
        path.join(repo, 'node_modules/vitest/vitest.mjs'),
        'run',
        '--no-file-parallelism',
        '--maxWorkers=1',
        '--minWorkers=1',
        '--reporter=default',
        '--reporter=json',
        `--outputFile=${report}`,
        ...suites,
      ],
      seconds,
      {
        suites,
        report: { kind: 'vitest', path: report },
        env: {
          PROTO_UI_RUNTIME_EVIDENCE_DIR: path.join(output, id),
        },
      }
    );
  };
  const numberField = (id, families, seconds) =>
    node(id, ['--import', 'tsx', 'scripts/analysis/component-capabilities-browser.mjs'], seconds, {
      families,
      report: { kind: 'number-field', path: path.join(output, id, 'report.json') },
      env: {
        PUI_EVIDENCE_DIR: path.join(output, id),
        PUI_BROWSER_RUNTIMES: runtimes.join(','),
        PUI_BROWSER_FAMILIES: families.join(','),
        PUI_BROWSER_KINDS: 'number-field',
      },
    });
  const productionReport = path.join(output, 'search-production', 'vitest.json');
  const matrix = vitest(
    'matrix-accessibility-consumer',
    ['apps/www/src/content/docs/zh-cn/demo-matrix.browser.test.ts'],
    420
  );
  matrix.args.push('--testNamePattern=mounts every demo in every official Web adapter$');
  matrix.includedTestNames = [SPRINT1_MATRIX_CASE];
  matrix.report.kind = 'vitest-case';
  return [
    node('node-controls', ['--test', '--test-reporter=tap', ...SPRINT1_NODE_SUITES], 90, {
      suites: SPRINT1_NODE_SUITES,
      report: { kind: 'tap', path: path.join(output, 'node-controls.log') },
    }),
    vitest('focused-unit', SPRINT1_UNIT_SUITES, 120),
    vitest('integration-unit', SPRINT1_INTEGRATION_UNIT_SUITES, 90),
    {
      id: 'styles',
      executable: 'corepack',
      args: ['pnpm@10.32.1', '--filter', 'apps-www', 'generate:proto-ui-style'],
      timeoutMs: 300_000,
    },
    numberField('number-field-0.3', ['base', 'shadcn', 'brutalist'], 150),
    numberField('number-field-experimental', ['bootstrap-2-3-2', 'liquid-glass'], 90),
    vitest(
      'dialog-observer-native',
      [...SPRINT1_BROWSER_SUITES.slice(0, 2), ...SPRINT1_BROWSER_SUITES.slice(3)],
      420
    ),
    matrix,
    vitest(
      'search-native',
      SEARCH_BROWSER_SUITES,
      // The complete serial Search producer exhausted its previous 900s window
      // before writing terminal Vitest JSON. Preserve that failed attempt and
      // allow the same 84 cases across three files their acquisition/reporting time;
      // every case, assertion and original 1000ms readiness limit remains owned
      // by their original callbacks. This allowance proves no product speedup.
      1200
    ),
    vitest('ownership-native', SPRINT1_BROWSER_SUITES.slice(2, 3), 180),
    node(
      'search-props-ab',
      ['--import', 'tsx', 'scripts/test/search-props-ab.mjs', path.join(output, 'search-props-ab')],
      960,
      {
        env: { PROTO_UI_SEARCH_AB_SHA: sourceSha },
        report: { kind: 'search-ab', path: path.join(output, 'search-props-ab', 'result.json') },
      }
    ),
    node('search-production', ['apps/www/scripts/run-search-production-evidence.mjs'], 570, {
      suites: ['apps/www/src/content/docs/zh-cn/site-search-production.browser.test.ts'],
      env: {
        // The unchanged production suite owns captures under
        // RUNNER_TEMP/homepage-evidence/search-production. Scope this one
        // subprocess to the uploaded subtree without changing other steps.
        RUNNER_TEMP: path.join(output, 'search-production'),
        PROTO_UI_RUNTIME_EVIDENCE_DIR: path.join(output, 'search-production'),
        PROTO_UI_SEARCH_PRODUCTION_REPORT: productionReport,
      },
      report: {
        kind: 'vitest',
        path: productionReport,
        captureDirectory: path.join(
          output,
          'search-production',
          'homepage-evidence',
          'search-production'
        ),
      },
    }),
  ];
}

export function assertSprint1StepEvidence(step, sourceSha, repo = root) {
  if (!step.report) return null;
  if (step.report.kind === 'tap') {
    const log = readFileSync(step.report.path, 'utf8');
    const count = (name) => {
      const matches = [...log.matchAll(new RegExp(`^# ${name} (\\d+)$`, 'gm'))];
      assert.ok(matches.length, `Missing terminal TAP ${name}`);
      return Number(matches.at(-1)[1]);
    };
    const tests = count('tests');
    assert.ok(tests > 0, 'Node control selection must execute tests');
    for (const name of ['fail', 'cancelled', 'skipped', 'todo']) assert.equal(count(name), 0, name);
    assert.equal(count('pass'), tests, 'Every selected Node control must pass');
    return { tests };
  }
  const report = JSON.parse(readFileSync(step.report.path, 'utf8'));
  if (step.report.kind === 'vitest-case') {
    // The complete raw report remains on disk. Only the explicitly selected
    // case is accepted; other original cases are recorded as outside this run.
    assert.equal(report.testResults.length, 1);
    const file = report.testResults[0];
    const included = file.assertionResults.filter((entry) =>
      step.includedTestNames.includes(entry.fullName)
    );
    const excluded = file.assertionResults.filter(
      (entry) => !step.includedTestNames.includes(entry.fullName)
    );
    assert.deepEqual(
      included.map((entry) => entry.fullName).sort(),
      [...step.includedTestNames].sort()
    );
    assert.ok(
      excluded.every((entry) => ['pending', 'skipped'].includes(entry.status)),
      'Unselected cases must not be reported as executed'
    );
    assertVitestReport(
      { ...report, testResults: [{ ...file, assertionResults: included }] },
      { phase: 'browser', suites: step.suites },
      repo
    );
    return {
      suites: 1,
      tests: included.length,
      includedTestNames: step.includedTestNames,
      notSelected: excluded.map(({ fullName, status }) => ({ fullName, status })),
    };
  }
  if (step.report.kind === 'vitest') {
    assertVitestReport(report, { phase: 'browser', suites: step.suites }, repo);
    const evidence = { suites: report.testResults.length, tests: report.numPassedTests };
    if (step.report.captureDirectory) {
      for (const name of SPRINT1_PRODUCTION_CAPTURES) {
        const capture = JSON.parse(
          readFileSync(path.join(step.report.captureDirectory, name), 'utf8')
        );
        assert.equal(capture.source?.sha, sourceSha, `Capture source mismatch: ${name}`);
        assert.equal(capture.source?.dirty, false, `Capture must bind a clean source: ${name}`);
      }
      evidence.sourceBoundCaptures = SPRINT1_PRODUCTION_CAPTURES.length;
    }
    return evidence;
  }
  if (step.report.kind === 'number-field') {
    assert.equal(report.source.head, sourceSha);
    assert.deepEqual(report.environment.runtimes, runtimes);
    assert.deepEqual(report.environment.families, step.families);
    assert.deepEqual(report.environment.kinds, ['number-field']);
    const expected = runtimes.flatMap((runtime) =>
      step.families.map((family) => `${runtime}/${family}`)
    );
    const key = (entry) => `${entry.runtime}/${entry.family}`;
    assert.deepEqual(
      report.cases.map(key).sort(),
      [...expected].sort(),
      'Complete Number Field matrix'
    );
    assert.ok(
      report.cases.every((entry) => entry.kind === 'number-field' && entry.status === 'passed')
    );
    assert.deepEqual(report.numberFieldIme.map(key).sort(), [...expected].sort());
    for (const entry of report.numberFieldIme) {
      assert.deepEqual(
        entry.cases.map((owner) => owner.controlled),
        [false, true]
      );
      assert.ok(
        entry.cases.every((owner) => owner.status === 'passed'),
        'Both IME owners must pass'
      );
    }
    assert.deepEqual(
      report.numberFieldImeControls.map((entry) => entry.controlled),
      [false, true]
    );
    assert.ok(report.numberFieldImeControls.every((entry) => entry.status === 'passed'));
    return { journeys: expected.length, imeOwners: expected.length * 2 };
  }
  assert.equal(step.report.kind, 'search-ab');
  assert.equal(report.sourceSha, sourceSha);
  assert.equal(report.plan.pairs, 5);
  assert.equal(report.plan.readinessBudgetMs, 1000);
  assert.equal(report.samples.length, 80, 'All A/B observations remain in the report');
  assert.equal(report.summary.complete, true);
  assert.equal(report.summary.variants.current.planned, 40);
  assert.equal(report.summary.variants.current.readinessPasses, 40);
  assert.equal(report.passed, true);
  return {
    samples: 80,
    currentPassed: 40,
    counterfactual: report.summary.variants['forced-write'],
  };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runSprint1Command(
  step,
  directory,
  { repo = root, env = process.env, signal, cleanupMs = SPRINT1_CLEANUP_MS } = {}
) {
  const startedAt = new Date().toISOString();
  const logFile = path.join(directory, `${step.id}.log`);
  const log = createWriteStream(logFile);
  const owned = new Map();
  const marker = randomUUID();
  const ownership = {
    uid: process.geteuid(),
    started: null,
    unmarked: new Set(),
    match: Buffer.from(`\0PROTO_UI_SPRINT1_PROCESS_OWNER=${marker}\0`),
  };
  let child,
    timer,
    drainTimer,
    observer,
    timedOut = false,
    interrupted = false,
    finished = false;
  let termination = { exitCode: null, signal: null };
  const cleanupErrors = [];
  const signalOwned = (kind) => {
    if (child?.pid) observeChildren(child.pid, owned, ownership);
    for (const entry of liveOwned(owned).reverse()) {
      try {
        process.kill(entry.pid, kind);
      } catch (error) {
        if (error.code !== 'ESRCH') cleanupErrors.push(String(error));
      }
    }
  };
  return new Promise((resolve) => {
    const finish = async () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(drainTimer);
      clearInterval(observer);
      signal?.removeEventListener('abort', abort);
      if (child?.pid) observeChildren(child.pid, owned, ownership);
      // Give normally closing descendants one event turn before diagnosing a leak.
      if (!timedOut && !interrupted && liveOwned(owned).length) await delay(100);
      const leaked = !timedOut && !interrupted && liveOwned(owned).length > 0;
      if (leaked) cleanupErrors.push('Command exited with live owned descendants');
      if (liveOwned(owned).length) {
        signalOwned('SIGTERM');
        const gracefulUntil = Date.now() + Math.max(0, cleanupMs - 1000);
        while (liveOwned(owned).length && Date.now() < gracefulUntil) await delay(25);
        signalOwned('SIGKILL');
        const forcedUntil = Date.now() + Math.min(1000, cleanupMs);
        while (liveOwned(owned).length && Date.now() < forcedUntil) await delay(25);
      }
      const survivors = liveOwned(owned).map(({ pid, started }) => ({ pid, started }));
      if (survivors.length) cleanupErrors.push('Owned child exit could not be confirmed');
      child?.stdout?.destroy();
      child?.stderr?.destroy();
      child?.unref();
      await new Promise((done) => log.end(done));
      resolve({
        ...termination,
        startedAt,
        finishedAt: new Date().toISOString(),
        logFile,
        timedOut,
        interrupted,
        cleanupErrors,
        survivors,
      });
    };
    const abort = () => {
      interrupted = true;
      termination.signal ??= 'SIGTERM';
      void finish();
    };
    log.once('error', (error) => {
      cleanupErrors.push(`Evidence log: ${String(error)}`);
      void finish();
    });
    const childEnv = { ...env, ...step.env, PROTO_UI_SPRINT1_PROCESS_OWNER: marker };
    // Each native runner owns its server; an inherited URL could certify a stale tree.
    delete childEnv.PROTO_UI_BROWSER_BASE_URL;
    delete childEnv.PUI_BROWSER_FAIL_FAST;
    childEnv.PUI_CHROME_EXECUTABLE = env.CHROME_PATH;
    try {
      child = spawn(step.executable, step.args, {
        cwd: repo,
        env: childEnv,
        shell: false,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const output = (chunk) => {
        process.stdout.write(chunk);
        log.write(chunk);
      };
      child.stdout.on('data', output);
      child.stderr.on('data', output);
      child.once('spawn', () => observeChildren(child.pid, owned, ownership));
      child.once('error', (error) => {
        termination.error = String(error);
        void finish();
      });
      child.once('exit', (exitCode, exitSignal) => {
        termination = { ...termination, exitCode, signal: exitSignal };
        // A detached descendant may keep the pipes open after its owner exits.
        drainTimer = setTimeout(() => void finish(), 100);
      });
      child.once('close', () => void finish());
      observer = setInterval(() => {
        if (child.pid) observeChildren(child.pid, owned, ownership);
      }, 500);
      timer = setTimeout(() => {
        timedOut = true;
        void finish();
      }, step.timeoutMs);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    } catch (error) {
      termination.error = String(error);
      void finish();
    }
  });
}

export function prepareSprint1(directory, repo = root, expectedSha = process.env.CANDIDATE_SHA) {
  const source = runtimeSourceSnapshot(repo);
  assert.equal(
    source.checkoutSha,
    expectedSha,
    'Sprint 1 checkout must match the requested source'
  );
  assertRuntimeSource({ before: source, after: source }, { checkoutSha: expectedSha });
  const steps = sprint1Plan(directory, expectedSha, repo);
  assert.ok(
    steps.reduce((total, step) => total + step.timeoutMs + SPRINT1_CLEANUP_MS, 0) < SPRINT1_TOTAL_MS
  );
  const plan = {
    schemaVersion: 1,
    source,
    steps,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    boundary:
      'Selected Sprint 1 checks; producer timeouts bound serial acquisition and terminal reporting while original per-case readiness limits and assertions remain unchanged. Prior timed-out producers remain failed evidence. Full scheduled cycle, physical IME/AT, non-Web and real applications remain separate.',
  };
  writeJson(path.join(directory, 'plan.json'), plan);
  writeJson(path.join(directory, 'progress.json'), { current: null, results: [] });
  return plan;
}

export function finishSprint1(directory, repo = root, interrupted = null) {
  const plan = readOptionalJson(path.join(directory, 'plan.json')).value;
  assert.ok(plan, 'Missing Sprint 1 selection');
  const progress = readOptionalJson(path.join(directory, 'progress.json'));
  const sourceAfter = runtimeSourceSnapshot(repo);
  let sourceError = null;
  try {
    assert.deepEqual(
      plan.steps,
      sprint1Plan(directory, plan.source.checkoutSha, repo),
      'Selection drift'
    );
    assertRuntimeSource(
      { before: plan.source, after: sourceAfter },
      { checkoutSha: plan.source.checkoutSha }
    );
  } catch (error) {
    sourceError = String(error);
  }
  const results = plan.steps.map((step) => {
    const matches = (progress.value?.results ?? []).filter((entry) => entry.id === step.id);
    if (matches.length === 1) return matches[0];
    return {
      ...step,
      passed: false,
      terminal: 'not-completed',
      exitCode: null,
      error: matches.length
        ? 'Duplicate terminal receipts'
        : (interrupted ?? 'No terminal receipt; inspect setup and runner logs'),
    };
  });
  const unexpected = (progress.value?.results ?? []).filter(
    (entry) => !plan.steps.some((step) => step.id === entry.id)
  );
  const passed =
    !sourceError && !progress.error && !unexpected.length && results.every((entry) => entry.passed);
  const summary = {
    ...plan,
    sourceAfter,
    sourceError,
    progressError: progress.error,
    currentAtInterruption: progress.value?.current ?? null,
    unexpected,
    passed,
    results,
  };
  writeJson(path.join(directory, 'summary.json'), summary);
  return summary;
}

export async function runSprint1(
  directory,
  { repo = root, expectedSha = process.env.CANDIDATE_SHA, execute = runSprint1Command } = {}
) {
  const plan =
    readOptionalJson(path.join(directory, 'plan.json')).value ??
    prepareSprint1(directory, repo, expectedSha);
  assert.equal(plan.source.checkoutSha, expectedSha);
  assert.deepEqual(plan.steps, sprint1Plan(directory, expectedSha, repo), 'Selection drift');
  assertRuntimeSource(
    { before: plan.source, after: runtimeSourceSnapshot(repo) },
    { checkoutSha: expectedSha }
  );
  const controller = new AbortController();
  let blockedCleanup = false;
  const interrupt = () => controller.abort();
  for (const event of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(event, interrupt);
  const deadline = Date.now() + SPRINT1_TOTAL_MS;
  try {
    await executeGeneralChecks(
      plan.steps,
      async (step) => {
        writeJson(path.join(directory, step.id, 'selection.json'), { source: plan.source, step });
        if (
          controller.signal.aborted ||
          Date.now() + step.timeoutMs + SPRINT1_CLEANUP_MS > deadline
        ) {
          const receipt = {
            exitCode: null,
            signal: controller.signal.aborted && !blockedCleanup ? 'SIGTERM' : null,
            terminal: blockedCleanup ? 'blocked-cleanup' : 'not-run',
            error: blockedCleanup
              ? 'Earlier owned processes remain alive; later resource use is blocked'
              : 'Interrupted or insufficient total deadline for this complete step',
          };
          writeJson(path.join(directory, step.id, 'receipt.json'), receipt);
          return receipt;
        }
        const before = runtimeSourceSnapshot(repo);
        let result,
          evidence = null,
          validationError = null;
        try {
          assertRuntimeSource({ before: plan.source, after: before }, { checkoutSha: expectedSha });
          if (step.report) rmSync(step.report.path, { force: true });
          result = await execute(step, directory, { repo, signal: controller.signal });
          if (result.survivors?.length) {
            blockedCleanup = true;
            controller.abort();
          }
          assert.ok(!result.timedOut, 'Step deadline reached');
          assert.ok(!result.interrupted, 'Step interrupted');
          assert.deepEqual(result.cleanupErrors, [], 'Owned process cleanup must complete');
          assert.deepEqual(result.survivors ?? [], [], 'No owned process may overlap a later step');
          evidence = assertSprint1StepEvidence(step, expectedSha, repo);
        } catch (error) {
          validationError = error.stack ?? String(error);
        }
        const after = runtimeSourceSnapshot(repo);
        try {
          assertRuntimeSource({ before, after }, { checkoutSha: expectedSha });
        } catch (error) {
          validationError = [validationError, error.stack ?? String(error)]
            .filter(Boolean)
            .join('\n');
        }
        const receipt = {
          ...result,
          sourceBefore: before,
          sourceAfter: after,
          evidence,
          validationError,
          commandExitCode: result?.exitCode ?? null,
          terminal: 'completed',
          exitCode: validationError ? 1 : (result?.exitCode ?? 1),
        };
        writeJson(path.join(directory, step.id, 'receipt.json'), receipt);
        return receipt;
      },
      (progress) => writeJson(path.join(directory, 'progress.json'), progress)
    );
  } finally {
    for (const event of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.off(event, interrupt);
  }
  return finishSprint1(directory, repo);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [operation, directory] = process.argv.slice(2);
  assert.ok(
    directory && ['prepare', 'run', 'finish'].includes(operation),
    'Usage: sprint1-evidence.mjs prepare|run|finish <output>'
  );
  assert.equal(
    process.platform,
    'linux',
    'Sprint 1 process ownership uses the managed Linux runner'
  );
  const result =
    operation === 'prepare'
      ? prepareSprint1(directory)
      : operation === 'run'
        ? await runSprint1(directory)
        : finishSprint1(directory);
  if (operation !== 'prepare') {
    for (const entry of result.results)
      console.log(
        `[sprint1] ${entry.passed ? 'PASS' : 'FAIL'} ${entry.id}: ${entry.error ?? entry.validationError ?? entry.exitCode}`
      );
    process.exitCode = result.passed ? 0 : 1;
  }
}
