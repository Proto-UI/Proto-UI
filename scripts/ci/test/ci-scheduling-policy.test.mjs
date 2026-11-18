import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { collectViolations, WORKFLOW_DIR } from '../check-ci-schedule.mjs';

const repoRoot = new URL('../../../', import.meta.url).pathname;

function fixtureWorkflowDir(files) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pui-ci-schedule-'));
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

const ciSkeleton = `
name: CI
on:
  pull_request:
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * *'
    - cron: '0 8 * * *'
    - cron: '0 16 * * *'
concurrency:
  group: ci
  cancel-in-progress: true
jobs:
  lockstep-check: { runs-on: ubuntu-latest, steps: [] }
  public_package_plan: { runs-on: ubuntu-latest, steps: [] }
  type-check: { if: "github.event_name != 'pull_request'", runs-on: ubuntu-latest, steps: [] }
  test: { if: "always() && github.event_name != 'pull_request'", runs-on: ubuntu-latest, steps: [] }
  release-scan: { if: "github.event_name != 'pull_request'", runs-on: ubuntu-latest, steps: [] }
  cycle-report:
    if: "always() && github.event_name != 'pull_request'"
    runs-on: ubuntu-latest
    permissions: { contents: read, actions: read }
    steps: []
`;

test('the live workflow inventory passes the scheduling policy', () => {
  const violations = collectViolations();
  assert.deepEqual(violations, [], `unexpected violations: ${JSON.stringify(violations, null, 2)}`);
});

test('a push trigger anywhere fails closed', () => {
  const dir = fixtureWorkflowDir({
    'ci.yml': ciSkeleton,
    'other.yml': `
name: Other
on:
  push:
    branches: [main]
permissions:
  contents: read
jobs: {}
`,
  });
  const violations = collectViolations(dir);
  assert.ok(
    violations.some((v) => v.rule === 'forbidden-trigger' && v.file === `${WORKFLOW_DIR}/other.yml`)
  );
});

test('a second regression schedule owner is rejected', () => {
  const dir = fixtureWorkflowDir({
    'ci.yml': ciSkeleton,
    'extra.yml': `
name: Extra
on:
  pull_request:
  schedule:
    - cron: '0 8 * * *'
permissions:
  contents: read
jobs: {}
`,
  });
  const violations = collectViolations(dir);
  assert.ok(violations.some((v) => v.rule === 'duplicate-schedule'));
});

test('unguarded pull_request context under a non-PR trigger is rejected', () => {
  const dir = fixtureWorkflowDir({
    'ci.yml': ciSkeleton,
    'diag.yml': `
name: Diag
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  lane:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ github.event.pull_request.head.sha }}
`,
  });
  const violations = collectViolations(dir);
  assert.ok(violations.some((v) => v.rule === 'unguarded-pr-context'));
});

test('guard expressions on the same line satisfy the context rule', () => {
  const dir = fixtureWorkflowDir({
    'ci.yml': ciSkeleton,
    'diag.yml': `
name: Diag
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  lane:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ github.event.pull_request.head.sha || github.sha }}
`,
  });
  const violations = collectViolations(dir);
  assert.equal(violations.filter((v) => v.rule === 'unguarded-pr-context').length, 0);
});

test('a drifted cron set on the owner is rejected', () => {
  const drifted = ciSkeleton.replace("- cron: '0 16 * * *'", "- cron: '15 16 * * *'");
  const dir = fixtureWorkflowDir({ 'ci.yml': drifted });
  const violations = collectViolations(dir);
  assert.ok(violations.some((v) => v.rule === 'regression-slots'));
});

test('workflow-level permissions on the owner violate token-escalation hygiene', () => {
  const drifted = ciSkeleton.replace(
    'concurrency:',
    'permissions:\n  contents: read\nconcurrency:'
  );
  const dir = fixtureWorkflowDir({ 'ci.yml': drifted });
  const violations = collectViolations(dir);
  assert.ok(violations.some((v) => v.rule === 'token-escalation'));
});

test('a missing cycle-report job grant is rejected', () => {
  const drifted = ciSkeleton.replace(
    '    permissions: { contents: read, actions: read }',
    '    permissions: { contents: read }'
  );
  const dir = fixtureWorkflowDir({ 'ci.yml': drifted });
  const violations = collectViolations(dir);
  assert.ok(violations.some((v) => v.rule === 'cycle-report-permissions'));
});

test('a pull_request trigger outside the lightweight allowlist is rejected', () => {
  const dir = fixtureWorkflowDir({
    'ci.yml': ciSkeleton,
    'heavy-evidence.yml': `
name: Heavy evidence
on:
  pull_request:
  workflow_dispatch:
  workflow_call:
permissions:
  contents: read
jobs: {}
`,
  });
  const violations = collectViolations(dir);
  assert.ok(
    violations.some(
      (v) =>
        v.rule === 'pull-request-not-allowed' && v.file === `${WORKFLOW_DIR}/heavy-evidence.yml`
    )
  );
});

test('an expensive owner job cannot turn each PR update into a full cycle', () => {
  const dir = fixtureWorkflowDir({
    'ci.yml': ciSkeleton.replace(
      '  type-check: { if: "github.event_name != \'pull_request\'",',
      '  type-check: {'
    ),
  });
  assert.ok(collectViolations(dir).some((v) => v.rule === 'heavy-pr-fanout'));
});

test('an OR bypass cannot turn a scheduled-only condition into a PR flood', () => {
  const dir = fixtureWorkflowDir({
    'ci.yml': ciSkeleton.replace(
      '"github.event_name != \'pull_request\'"',
      '"github.event_name != \'pull_request\' || true"'
    ),
  });
  assert.ok(collectViolations(dir).some((v) => v.rule === 'heavy-pr-fanout'));
});

test('nested cycle evidence cannot be cancelled by a manual dispatch', (t) => {
  for (const cancellation of ['false', 'true', '${{ true }}']) {
    const dir = fixtureWorkflowDir({
      'ci.yml': ciSkeleton.replace(
        'jobs:\n',
        `jobs:\n  production:\n    if: "github.event_name != 'pull_request'"\n    uses: ./.github/workflows/production.yml\n`
      ),
      'production.yml': `
on:
  workflow_call:
permissions:
  contents: read
jobs:
  native:
    uses: ./.github/workflows/native.yml
`,
      'native.yml': `
on:
  workflow_call:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: native-main
  cancel-in-progress: ${cancellation}
jobs: {}
`,
    });
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const violations = collectViolations(dir).filter((v) => v.rule === 'cycle-callee-cancellation');
    assert.deepEqual(
      violations.map((v) => v.file),
      cancellation === 'false' ? [] : [`${WORKFLOW_DIR}/native.yml`]
    );
  }
});

test('a nested cycle rejects a missing browser source even when its job is conditional', (t) => {
  const suite = 'apps/www/test/current.browser.test.ts';
  const dir = fixtureWorkflowDir({
    'ci.yml': ciSkeleton.replace(
      'jobs:\n',
      `jobs:\n  production:\n    if: "github.event_name != 'pull_request'"\n    uses: ./.github/workflows/production.yml\n`
    ),
    'production.yml': `
on:
  workflow_call:
permissions: { contents: read }
jobs:
  native:
    uses: ./.github/workflows/native.yml
`,
    'native.yml': `
on:
  workflow_call:
  workflow_dispatch:
permissions: { contents: read }
jobs:
  native:
    if: false
    continue-on-error: true
    runs-on: ubuntu-latest
    steps:
      - run: corepack pnpm@10.32.1 exec vitest run ${suite}
`,
  });
  const sourceRoot = mkdtempSync(path.join(os.tmpdir(), 'pui-ci-source-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  t.after(() => rmSync(sourceRoot, { recursive: true, force: true }));
  const failures = () =>
    collectViolations(dir, sourceRoot).filter((v) => v.rule === 'cycle-browser-source-missing');
  const expected = [
    {
      file: `${WORKFLOW_DIR}/native.yml`,
      rule: 'cycle-browser-source-missing',
      detail: `job 'native' references missing browser suite '${suite}'`,
    },
  ];
  assert.deepEqual(failures(), expected);
  mkdirSync(path.dirname(path.join(sourceRoot, suite)), { recursive: true });
  writeFileSync(path.join(sourceRoot, suite), '// Current native test source\n');
  assert.deepEqual(failures(), []);
  rmSync(path.join(sourceRoot, suite));
  assert.deepEqual(failures(), expected);
});

const workflowDirectory = path.join(repoRoot, WORKFLOW_DIR);
const sizingWorkflow = 'select-item-sizing-evidence.yml';

function readWorkflows() {
  return Object.fromEntries(
    readdirSync(workflowDirectory)
      .filter((name) => /\.ya?ml$/u.test(name))
      .map((name) => [name, parse(readFileSync(path.join(workflowDirectory, name), 'utf8'))])
  );
}

function auditSizingCycle(workflows) {
  const failures = [];
  const calls = [];
  const visit = (name, ancestors = []) => {
    if (ancestors.includes(name)) {
      failures.push('workflow-call-cycle');
      return;
    }
    const workflow = workflows[name];
    if (!workflow) {
      failures.push('missing-called-workflow');
      return;
    }
    for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
      const called = job.uses?.match(/^\.\/\.github\/workflows\/([^/]+\.ya?ml)$/u)?.[1];
      if (!called) continue;
      if (called === sizingWorkflow) {
        calls.push({ caller: name, id, job, siblings: workflow.jobs });
      }
      visit(called, [...ancestors, name]);
    }
  };
  visit('ci.yml');
  if (calls.length !== 1) failures.push('sizing-not-reachable-once');
  for (const { job, siblings } of calls) {
    const predecessors = typeof job.needs === 'string' ? [job.needs] : job.needs;
    if (!predecessors?.length || predecessors.some((id) => !siblings[id])) {
      failures.push('sizing-not-in-bounded-chain');
    }
    if (job.if !== '${{ !cancelled() }}') failures.push('predecessor-failure-hides-evidence');
  }

  const workflow = workflows[sizingWorkflow];
  if (!workflow) return [...failures, 'missing-sizing-workflow'];
  if (
    JSON.stringify(Object.keys(workflow.on ?? {}).sort()) !==
    JSON.stringify(['workflow_call', 'workflow_dispatch'])
  )
    failures.push('sizing-trigger-policy');
  if (workflow.concurrency?.['cancel-in-progress'] !== false) {
    failures.push('active-sizing-evidence-can-be-cancelled');
  }
  if (workflow.permissions?.contents !== 'read' || Object.keys(workflow.permissions).length !== 1) {
    failures.push('sizing-permissions');
  }
  const job = workflow.jobs?.['styled-demo-eight'];
  if (!job || /pull_request/u.test(job.if ?? '')) failures.push('pr-only-job');
  const steps = job?.steps ?? [];
  const checkout = steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  if (
    checkout?.with?.ref !== '${{ github.sha }}' ||
    checkout.with['persist-credentials'] !== false
  ) {
    failures.push('checkout-not-bound-to-cycle-source');
  }
  const execution = steps.find((step) => step.env?.EXPECTED_HEAD);
  if (execution?.env?.EXPECTED_HEAD !== '${{ github.sha }}') {
    failures.push('receipt-not-bound-to-cycle-source');
  }
  const artifact = steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
  if (!artifact?.with?.name?.includes('${{ github.sha }}') || artifact.if !== 'always()') {
    failures.push('artifact-not-bound-and-retained');
  }
  return failures;
}

test('sizing evidence remains reachable once from the full cycle and binds its exact source', () => {
  assert.deepEqual(auditSizingCycle(readWorkflows()), []);
});

test('a detached sizing owner is rejected even when its workflow still exists', () => {
  const workflows = readWorkflows();
  for (const workflow of Object.values(workflows)) {
    for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
      if (job.uses === `./.github/workflows/${sizingWorkflow}`) delete workflow.jobs[id];
    }
  }
  assert.ok(auditSizingCycle(workflows).includes('sizing-not-reachable-once'));
});

test('an independently stale checkout, receipt or artifact identity is rejected', () => {
  for (const kind of ['checkout', 'receipt', 'artifact']) {
    const workflows = readWorkflows();
    const steps = workflows[sizingWorkflow].jobs['styled-demo-eight'].steps;
    if (kind === 'checkout') {
      steps.find((step) => step.uses?.startsWith('actions/checkout@')).with.ref = 'main';
    } else if (kind === 'receipt') {
      steps.find((step) => step.env?.EXPECTED_HEAD).env.EXPECTED_HEAD = 'old-source';
    } else {
      steps.find((step) => step.uses?.startsWith('actions/upload-artifact@')).with.name = 'unbound';
    }
    assert.ok(auditSizingCycle(workflows).some((failure) => failure.startsWith(kind)));
  }
});

test('a restored PR-number-only condition cannot impersonate scheduled reachability', () => {
  const workflows = readWorkflows();
  workflows[sizingWorkflow].jobs['styled-demo-eight'].if =
    'github.event.pull_request.number == 1229';
  assert.ok(auditSizingCycle(workflows).includes('pr-only-job'));
});

test('active evidence cancellation and missing callable admission are rejected', () => {
  const cancelling = readWorkflows();
  cancelling[sizingWorkflow].concurrency['cancel-in-progress'] = true;
  assert.ok(auditSizingCycle(cancelling).includes('active-sizing-evidence-can-be-cancelled'));
  const manualOnly = readWorkflows();
  delete manualOnly[sizingWorkflow].on.workflow_call;
  assert.ok(auditSizingCycle(manualOnly).includes('sizing-trigger-policy'));
});

test('removing serial admission or failure continuation is rejected', () => {
  for (const key of ['needs', 'if']) {
    const workflows = readWorkflows();
    for (const workflow of Object.values(workflows)) {
      for (const job of Object.values(workflow.jobs ?? {})) {
        if (job.uses === `./.github/workflows/${sizingWorkflow}`) delete job[key];
      }
    }
    assert.ok(
      auditSizingCycle(workflows).includes(
        key === 'needs' ? 'sizing-not-in-bounded-chain' : 'predecessor-failure-hides-evidence'
      )
    );
  }
});

test('GPUI source consumers run once per full cycle with retained, exact-source evidence', () => {
  const workflows = readWorkflows();
  const workflowPath = './.github/workflows/compiler-gpui-source-consumers.yml';
  const calls = Object.entries(workflows['ci.yml'].jobs).filter(
    ([, job]) => job.uses === workflowPath
  );
  assert.equal(calls.length, 1);
  const [jobId, call] = calls[0];
  assert.equal(call.if, "${{ github.event_name != 'pull_request' }}");
  assert.ok(workflows['ci.yml'].jobs['cycle-report'].needs.includes(jobId));

  const workflow = workflows['compiler-gpui-source-consumers.yml'];
  assert.deepEqual(Object.keys(workflow.on).sort(), ['workflow_call', 'workflow_dispatch']);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const job = workflow.jobs['native-consumer'];
  assert.deepEqual(job.strategy.matrix.os, ['ubuntu-24.04', 'macos-15']);
  const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ github.sha }}');
  assert.equal(checkout.with['persist-credentials'], false);
  const artifact = job.steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
  assert.equal(artifact.if, 'always()');
  assert.ok(artifact.with.name.includes('${{ github.sha }}'));
  assert.equal(artifact.with['if-no-files-found'], 'error');
});

test('GPUI Cargo target is initialized after runner allocation in the shared step environment', () => {
  const workflow = readWorkflows()['compiler-gpui-source-consumers.yml'];
  const job = workflow.jobs['native-consumer'];
  // runner is unavailable in jobs.<job_id>.env, even though it is valid in
  // step contexts. A workflow rejected there cannot start a native test job.
  assert.doesNotMatch(JSON.stringify(job.env), /\$\{\{[^}]*\brunner\./u);
  const setupIndex = job.steps.findIndex((step) => step.id === 'configure-cargo');
  assert.ok(setupIndex >= 0);
  const consumers = job.steps
    .map((step, index) => (/\bcargo\b/u.test(step.run ?? '') ? index : -1))
    .filter((index) => index >= 0);
  assert.ok(consumers.length >= 2);
  assert.ok(consumers.every((index) => index > setupIndex));
  const cache = job.steps.find((step) => step.uses?.startsWith('actions/cache@'));
  assert.ok(job.steps.indexOf(cache) > setupIndex);
  assert.ok(cache.with.path.split('\n').includes('${{ runner.temp }}/gpui-consumer-target'));

  const temporary = mkdtempSync(path.join(os.tmpdir(), 'pui-gpui-runner-'));
  try {
    const runnerTemp = path.join(temporary, 'runner directory');
    const environmentFile = path.join(temporary, 'step-environment');
    mkdirSync(runnerTemp);
    writeFileSync(environmentFile, 'UNCHANGED=before\n');
    const configured = spawnSync('bash', ['-euo', 'pipefail', '-c', job.steps[setupIndex].run], {
      env: { ...process.env, RUNNER_TEMP: runnerTemp, GITHUB_ENV: environmentFile },
      encoding: 'utf8',
    });
    assert.equal(configured.status, 0, configured.stderr);
    assert.equal(
      readFileSync(environmentFile, 'utf8'),
      `UNCHANGED=before\nCARGO_TARGET_DIR=${runnerTemp}/gpui-consumer-target\n`
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
