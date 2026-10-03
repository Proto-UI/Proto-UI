// Socket-free CI planning and evidence validation; importing this module runs no jobs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  globSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BROWSER_SHARD_COUNT,
  BROWSER_SUITES,
  PRODUCTION_BROWSER_SUITES,
  assertBrowserInventory,
  browserShards,
  selectBrowserShard,
} from './runtime-test-plan.mjs';

export const runtimeRoot = fileURLToPath(new URL('../../', import.meta.url));
export function checkoutSha(root = runtimeRoot) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

export function createCiPlan(sha = checkoutSha()) {
  assertBrowserInventory();
  return {
    checkoutSha: sha,
    general: [
      ...new Set(
        globSync(
          [
            'packages/**/*.test.ts',
            'internal/contracts/__tests__/**/*.test.ts',
            'apps/**/test/**/*.test.ts',
            'apps/www/src/**/*.test.ts',
          ],
          { cwd: runtimeRoot, exclude: ['**/node_modules/**', '**/dist/**'] }
        )
      ),
    ]
      .map((file) => file.replaceAll('\\', '/'))
      .filter((file) => ![...BROWSER_SUITES, ...PRODUCTION_BROWSER_SUITES].includes(file))
      .sort(),
    browser: browserShards(),
    productionExcluded: [...PRODUCTION_BROWSER_SUITES],
  };
}

export function runtimeSelection(phase, shard, plan = createCiPlan()) {
  assert.ok(['general', 'browser'].includes(phase), 'Unknown CI runtime phase');
  assert.ok(phase === 'browser' || shard === undefined, 'General phase cannot have a shard');
  const suites = phase === 'browser' ? selectBrowserShard(shard) : plan.general;
  assert.ok(suites.length > 0, 'CI runtime selection must not be empty');
  return { checkoutSha: plan.checkoutSha, phase, shard: shard ?? null, suites };
}

export function assertVitestReport(report, selection, root = runtimeRoot) {
  assert.equal(report.success, true, 'Vitest must report success');
  assert.equal(report.numFailedTests, 0, 'Failed tests');
  assert.equal(report.numFailedTestSuites, 0, 'Failed suites');
  assert.ok(report.numPassedTests > 0, 'An empty or entirely skipped job cannot pass');
  const files = report.testResults.map((file) => ({
    ...file,
    name: path.relative(root, file.name).replaceAll('\\', '/'),
  }));
  assert.deepEqual(
    files.map((file) => file.name).sort(),
    [...selection.suites].sort(),
    'Executed suites must equal the selection exactly once'
  );
  let passed = 0;
  for (const file of files) {
    assert.equal(file.status, 'passed', `Suite failed: ${file.name}`);
    assert.ok(file.assertionResults.length > 0, `Empty suite: ${file.name}`);
    for (const test of file.assertionResults) {
      // General tests already contain explicitly authored todo coverage. Browser
      // shards have no skip/todo allowance: every selected browser test must run.
      assert.ok(
        (selection.phase === 'browser' ? ['passed'] : ['passed', 'todo', 'skipped']).includes(
          test.status
        ),
        `Unexpected ${test.status} test: ${file.name} ${test.fullName}`
      );
      if (test.status === 'passed') passed += 1;
    }
  }
  assert.equal(passed, report.numPassedTests, 'Passed assertion count disagrees with report');
}

export function assertRuntimeGate(needs, plan, receipts, sha = checkoutSha()) {
  assert.deepEqual(Object.keys(needs).sort(), ['test-browser', 'test-general', 'test-plan']);
  for (const [job, result] of Object.entries(needs))
    assert.equal(result.result, 'success', `Required job ${job} did not succeed`);
  assert.deepEqual(
    plan,
    createCiPlan(sha),
    'Plan must match the gate checkout and complete current inventory'
  );
  const expected = [
    runtimeSelection('general', undefined, plan),
    ...plan.browser.map((_, index) =>
      runtimeSelection('browser', `${index + 1}/${BROWSER_SHARD_COUNT}`, plan)
    ),
  ];
  assert.equal(
    receipts.length,
    expected.length,
    'Every required job must supply exactly one receipt'
  );
  for (const selection of expected) {
    const matches = receipts.filter(
      (receipt) => receipt.phase === selection.phase && receipt.shard === selection.shard
    );
    assert.equal(
      matches.length,
      1,
      `Missing/duplicate receipt: ${selection.phase} ${selection.shard}`
    );
    const { report, ...actual } = matches[0];
    assert.deepEqual(
      actual,
      selection,
      'Receipt must bind the checkout SHA and planned suite list'
    );
    assertVitestReport(report, selection);
  }
}

// GITHUB_SHA is the workflow event revision (the synthetic merge for a PR),
// not pull_request.head.sha. Reruns preserve it and GITHUB_RUN_ID.
export function ciContext(env = process.env, actualSha = checkoutSha()) {
  assert.match(env.GITHUB_RUN_ID ?? '', /^[1-9]\d*$/, 'Missing/invalid workflow run ID');
  assert.match(env.GITHUB_RUN_ATTEMPT ?? '', /^[1-9]\d*$/, 'Missing/invalid run attempt');
  const attempt = Number(env.GITHUB_RUN_ATTEMPT);
  assert.ok(Number.isSafeInteger(attempt), 'Invalid run attempt');
  assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/, 'Missing/invalid event SHA');
  assert.equal(
    actualSha,
    env.GITHUB_SHA,
    'Actual checkout HEAD must equal expected event GITHUB_SHA'
  );
  return { runId: env.GITHUB_RUN_ID, attempt, eventSha: env.GITHUB_SHA, checkoutSha: actualSha };
}

export const runtimeSlots = [
  'plan',
  'general',
  ...Array.from(
    { length: BROWSER_SHARD_COUNT },
    (_, index) => `browser-${index + 1}-of-${BROWSER_SHARD_COUNT}`
  ),
];
export function artifactName({ runId, attempt, slot }) {
  return `runtime-ci-${runId}-${slot}-attempt-${attempt}`;
}

export function latestSlotReceipts(artifacts, context) {
  const attempts = new Set();
  const latest = new Map();
  for (const { name, receipt } of artifacts) {
    assert.equal(receipt.schemaVersion, 1, 'Unsupported receipt schema');
    assert.equal(receipt.runId, context.runId, 'Receipt belongs to another run');
    assert.equal(receipt.eventSha, context.eventSha, 'Receipt event SHA drift');
    assert.equal(receipt.checkoutSha, context.checkoutSha, 'Receipt checkout SHA drift');
    assert.ok(
      Number.isSafeInteger(receipt.attempt) &&
        receipt.attempt > 0 &&
        receipt.attempt <= context.attempt,
      'Invalid/future receipt attempt'
    );
    assert.ok(runtimeSlots.includes(receipt.slot), 'Unknown/empty logical slot');
    assert.equal(name, artifactName(receipt), 'Artifact name must match embedded run/slot/attempt');
    assert.ok(
      ['success', 'failure', 'cancelled', 'skipped'].includes(receipt.outcome),
      'Nonterminal/unknown producer outcome'
    );
    const key = `${receipt.slot}:${receipt.attempt}`;
    assert.ok(!attempts.has(key), `Duplicate slot/attempt: ${key}`);
    attempts.add(key);
    if (!latest.has(receipt.slot) || latest.get(receipt.slot).attempt < receipt.attempt)
      latest.set(receipt.slot, receipt);
  }
  // Select by attempt BEFORE considering success. A later failed/missing report
  // is never repaired by reusing an older successful artifact.
  return runtimeSlots.map((slot) => {
    const receipt = latest.get(slot);
    assert.ok(receipt, `Missing logical slot: ${slot}`);
    assert.equal(receipt.outcome, 'success', `Latest ${slot} attempt did not succeed`);
    assert.ok(receipt.payload, `Latest ${slot} attempt has no completed evidence`);
    return receipt;
  });
}

export function assertCiGate(needs, artifacts, context = ciContext()) {
  // This is also the hard-cancellation guard when a producer cannot upload its
  // final receipt. Never infer success from old artifacts while needs is red.
  assert.deepEqual(Object.keys(needs).sort(), ['test-browser', 'test-general', 'test-plan']);
  for (const [job, result] of Object.entries(needs))
    assert.equal(result.result, 'success', `Required job ${job} did not succeed`);
  const [plan, ...results] = latestSlotReceipts(artifacts, context);
  assertRuntimeGate(
    needs,
    plan.payload,
    results.map(({ slot, payload }) => {
      const expectedSlot =
        payload.phase === 'general' ? 'general' : `browser-${payload.shard?.replace('/', '-of-')}`;
      assert.equal(slot, expectedSlot, 'Receipt payload must belong to its logical slot');
      return payload;
    }),
    context.checkoutSha
  );
}

export function finishCiSlot(directory, slot, outcome, context = ciContext()) {
  assert.ok(runtimeSlots.includes(slot), 'Unknown logical producer slot');
  assert.ok(
    ['success', 'failure', 'cancelled', 'skipped'].includes(outcome),
    'Unknown producer outcome'
  );
  const file = path.join(directory, slot === 'plan' ? 'plan.json' : `result-${slot}.json`);
  const payload = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  // Always retain failure/cancellation, including a job that failed before Vitest.
  writeJson(path.join(directory, 'receipt.json'), {
    schemaVersion: 1,
    ...context,
    slot,
    outcome,
    payload,
  });
  if (outcome === 'success') assert.ok(payload, 'Successful producer must have completed evidence');
}

export function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, directory] = process.argv.slice(2);
  if (command === 'plan' && directory) {
    const context = ciContext();
    const plan = createCiPlan(context.checkoutSha);
    writeJson(path.join(directory, 'plan.json'), plan);
    console.log(JSON.stringify(plan, null, 2));
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `matrix=${JSON.stringify({ include: plan.browser.map((_, index) => ({ shard: `${index + 1}/${BROWSER_SHARD_COUNT}`, slot: `browser-${index + 1}-of-${BROWSER_SHARD_COUNT}` })) })}\n`
      );
  } else if (command === 'finish' && directory) {
    finishCiSlot(directory, process.env.PROTO_UI_RUNTIME_SLOT, process.env.RUNTIME_CI_OUTCOME);
  } else if (command === 'gate' && directory) {
    const context = ciContext();
    // download-artifact keeps each immutable artifact in its own named directory.
    // Reject unexpected/empty folders instead of globbing only successful files.
    const artifacts = readdirSync(directory, { withFileTypes: true }).map((entry) => {
      assert.ok(entry.isDirectory(), 'Expected one directory per CI artifact');
      const receipt = JSON.parse(
        readFileSync(path.join(directory, entry.name, 'receipt.json'), 'utf8')
      );
      return { name: entry.name, receipt };
    });
    assertCiGate(JSON.parse(process.env.RUNTIME_CI_NEEDS ?? '{}'), artifacts, context);
    console.log(
      `Runtime gate passed for run ${context.runId} attempt ${context.attempt} event/checkout ${context.checkoutSha}: general plus ${BROWSER_SHARD_COUNT} browser shards`
    );
  } else {
    throw new Error(
      'Usage: node scripts/test/runtime-ci.mjs <plan|finish|gate> <evidence-directory>'
    );
  }
}
