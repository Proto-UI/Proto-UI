import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { collectViolations, WORKFLOW_DIR } from '../check-ci-schedule.mjs';
import { assertFlutterScrollReports } from '../check-flutter-scroll-evidence.mjs';

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

function assertReusableCompilerInputBoundary(workflow) {
  // Adapter and browser acceptance are separate default-off reusable inputs.
  // Package-budget and Website evidence remain manual-only.
  assert.deepEqual(workflow.on.workflow_call, {
    inputs: {
      adapter_acceptance: { type: 'boolean', required: false, default: false },
      browser_acceptance: { type: 'boolean', required: false, default: false },
    },
  });
  const browser = workflow.jobs['browser-compiler'];
  assert.equal(browser.if, '${{ inputs.browser_acceptance }}');
  assert.equal(browser.uses, './.github/workflows/compiler-browser-acceptance.yml');
  assert.deepEqual(browser.with, { source_regressions: true, production_build: true });
}

test('reusable compiler inputs preserve separate default-off Adapter and browser boundaries', () => {
  const original = readWorkflows()['compiler-gpui-source-consumers.yml'];
  assertReusableCompilerInputBoundary(original);
  const mutations = [
    (workflow) => {
      workflow.on.workflow_call = null;
    },
    (workflow) => {
      workflow.on.workflow_call.inputs.adapter_acceptance.default = true;
    },
    (workflow) => {
      workflow.on.workflow_call.inputs.adapter_acceptance.required = true;
    },
    (workflow) => {
      workflow.on.workflow_call.inputs.adapter_acceptance.type = 'string';
    },
    (workflow) => {
      workflow.on.workflow_call.inputs.browser_acceptance.default = true;
    },
    (workflow) => {
      workflow.on.workflow_call.inputs.browser_acceptance.required = true;
    },
    (workflow) => {
      workflow.on.workflow_call.inputs.browser_acceptance.type = 'string';
    },
    (workflow) => {
      workflow.jobs['browser-compiler'].if = 'true';
    },
    (workflow) => {
      workflow.jobs['browser-compiler'].uses = './.github/workflows/gpui-adapter-acceptance.yml';
    },
    (workflow) => {
      workflow.jobs['browser-compiler'].with.source_regressions = false;
    },
    (workflow) => {
      workflow.jobs['browser-compiler'].with.production_build = false;
    },
    (workflow) => {
      workflow.on.workflow_call.inputs.package_budget_evidence = {
        type: 'boolean',
        required: false,
        default: false,
      };
    },
    (workflow) => {
      workflow.on.workflow_call.inputs.website_shader_evidence = {
        type: 'boolean',
        required: false,
        default: false,
      };
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(original);
    mutate(changed);
    assert.throws(() => assertReusableCompilerInputBoundary(changed));
  }
});

test('manual compiler evidence can explicitly request the unchanged strict package gate', () => {
  const workflows = readWorkflows();
  const workflow = workflows['compiler-gpui-source-consumers.yml'];
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.package_budget_evidence, {
    description: 'Also run the strict whole-entry package gate for this exact ref',
    type: 'boolean',
    required: false,
    default: false,
  });
  assertReusableCompilerInputBoundary(workflow);
  const job = workflow.jobs['package-budgets'];
  assert.equal(
    job.if,
    "github.event_name == 'workflow_dispatch' && inputs.package_budget_evidence == true"
  );
  assert.equal(job.uses, './.github/workflows/package-budget-evidence.yml');
  assert.deepEqual(job.permissions, { contents: 'read' });
  assert.equal(job.secrets, undefined);
  assert.equal(workflow.jobs['native-consumer'].if, undefined);
  const gate = workflows['package-budget-evidence.yml'].jobs['whole-entry-budgets'];
  assert.ok(
    gate.steps.some((step) =>
      step.run?.includes(
        'node scripts/analysis/package-budgets.mjs --json --require-clean --expected-sha "$GITHUB_SHA"'
      )
    )
  );
});

function assertNativeGeneratedConsumerEvidence(workflow) {
  const job = workflow.jobs['native-consumer'];
  assert.equal(job.if, undefined);
  assert.equal(job.needs, undefined);
  for (const [target, log] of [
    ['control_label', 'control-label-consumer.log'],
    ['style_mapping', 'style-mapping-consumer.log'],
    ['a11y_activation', 'a11y-activation-consumer.log'],
    ['scroll_pause', 'scroll-pause-consumer.log'],
    ['scroll_reader', 'scroll-reader-consumer.log'],
  ]) {
    const matches = job.steps.filter((step) =>
      new RegExp(`--test ${target}(?:\\s|$)`, 'u').test(step.run ?? '')
    );
    assert.equal(matches.length, 1, `one complete native ${target} target is mandatory`);
    const [step] = matches;
    assert.equal(step.if, undefined);
    assert.equal(step['continue-on-error'], undefined);
    assert.deepEqual(step.run.trim().split('\n'), [
      'set -euo pipefail',
      `cargo +1.98.1 test --locked --manifest-path "$RUNNER_TEMP/gpui-evidence/generated/transition/Cargo.toml" --features test-support --test ${target} -- --test-threads=1 --nocapture 2>&1 | tee "$RUNNER_TEMP/gpui-evidence/${log}"`,
    ]);
  }
}

test('native generated evidence executes five complete locked targets once in the existing owner', () => {
  assertNativeGeneratedConsumerEvidence(readWorkflows()['compiler-gpui-source-consumers.yml']);
});

test('native generated evidence rejects missing, duplicated, filtered, optional or swallowed execution', () => {
  const original = readWorkflows()['compiler-gpui-source-consumers.yml'];
  // Mutation controls must start from a valid inventory, not pass because
  // another unchanged target was already missing or duplicated.
  assertNativeGeneratedConsumerEvidence(original);
  const targetStep = (workflow, target) =>
    workflow.jobs['native-consumer'].steps.find((step) => step.run?.includes(`--test ${target} `));
  for (const target of [
    'control_label',
    'style_mapping',
    'a11y_activation',
    'scroll_pause',
    'scroll_reader',
  ]) {
    const mutations = [
      (workflow) => {
        workflow.jobs['native-consumer'].steps = workflow.jobs['native-consumer'].steps.filter(
          (step) => !step.run?.includes(`--test ${target} `)
        );
      },
      (workflow) => {
        workflow.jobs['native-consumer'].steps.push(structuredClone(targetStep(workflow, target)));
      },
      (workflow) => {
        targetStep(workflow, target).if = 'false';
      },
      (workflow) => {
        targetStep(workflow, target)['continue-on-error'] = true;
      },
      (workflow) => {
        targetStep(workflow, target).run = targetStep(workflow, target).run.replace(
          '-- --test-threads=1',
          'one-case -- --test-threads=1'
        );
      },
      (workflow) => {
        targetStep(workflow, target).run = targetStep(workflow, target).run.replace(
          '--locked ',
          ''
        );
      },
      (workflow) => {
        targetStep(workflow, target).run = targetStep(workflow, target).run.replace(
          'set -euo pipefail',
          'set -eu'
        );
      },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(original);
      mutate(changed);
      assert.throws(() => assertNativeGeneratedConsumerEvidence(changed));
    }
  }
});

function assertFlutterScrollConsumerEvidence(workflow) {
  const job = workflow.jobs['flutter-scroll-consumer'];
  assert.ok(job, 'real Flutter Widgets must have a continuous native owner');
  assert.equal(job.if, undefined);
  assert.equal(job.needs, undefined);
  assert.equal(job['continue-on-error'], undefined);
  assert.equal(job['runs-on'], 'ubuntu-24.04');
  assert.equal(job['timeout-minutes'], 15);
  const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ github.sha }}');
  assert.equal(checkout.with['persist-credentials'], false);
  const prepare = job.steps.filter((step) =>
    step.run?.includes('node scripts/ci/prepare-flutter-scroll-sdk.mjs ')
  );
  assert.equal(prepare.length, 1);
  assert.equal(prepare[0].if, undefined);
  assert.equal(prepare[0]['continue-on-error'], undefined);
  assert.ok(prepare[0].run.startsWith('set -euo pipefail\n'));
  assert.ok(
    prepare[0].run.includes(
      'node scripts/ci/prepare-flutter-scroll-sdk.mjs "$RUNNER_TEMP/flutter-scroll-sdk" "$RUNNER_TEMP/flutter-scroll-evidence"'
    )
  );
  const native = job.steps.filter((step) =>
    step.run?.includes(
      'exec vitest run packages/compiler/test/flutter-scroll-outcomes.native.test.ts '
    )
  );
  assert.equal(native.length, 1);
  assert.equal(native[0].if, undefined);
  assert.equal(native[0]['continue-on-error'], undefined);
  assert.deepEqual(native[0].run.trim().split('\n'), [
    'set -euo pipefail',
    'test -n "$PROTO_UI_FLUTTER"',
    'test -x "$PROTO_UI_FLUTTER"',
    'corepack pnpm@10.32.1 exec vitest run packages/compiler/test/flutter-scroll-outcomes.native.test.ts --maxWorkers=1 --minWorkers=1 --reporter=default --reporter=json --outputFile.json="$PROTO_UI_FLUTTER_EVIDENCE_DIR/vitest.json" 2>&1 | tee "$PROTO_UI_FLUTTER_EVIDENCE_DIR/native.log"',
  ]);
  const checks = job.steps.filter((step) =>
    step.run?.includes('node scripts/ci/check-flutter-scroll-evidence.mjs ')
  );
  assert.equal(checks.length, 1);
  assert.equal(checks[0].if, undefined);
  assert.equal(checks[0]['continue-on-error'], undefined);
  assert.equal(
    checks[0].run,
    'node scripts/ci/check-flutter-scroll-evidence.mjs "$RUNNER_TEMP/flutter-scroll-evidence" 14'
  );
  assert.ok(job.steps.indexOf(prepare[0]) < job.steps.indexOf(native[0]));
  assert.ok(job.steps.indexOf(native[0]) < job.steps.indexOf(checks[0]));
  const artifact = job.steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
  assert.equal(artifact.if, 'always()');
  assert.equal(artifact.with['if-no-files-found'], 'error');
  assert.equal(artifact.with.path, '${{ runner.temp }}/flutter-scroll-evidence');
  assert.ok(artifact.with.name.includes('${{ github.sha }}'));
}

test('dormant direct Flutter emission has mandatory real Widget evidence in the existing cycle', () => {
  const workflow = readWorkflows()['compiler-gpui-source-consumers.yml'];
  assertFlutterScrollConsumerEvidence(workflow);
  for (const mutate of [
    (job) => {
      job.if = 'false';
    },
    (job) => {
      job['continue-on-error'] = true;
    },
    (job) => {
      job.steps = job.steps.filter((step) => !step.run?.includes('prepare-flutter-scroll-sdk.mjs'));
    },
    (job) => {
      job.steps.find((step) => step.run?.includes('exec vitest run')).run =
        'corepack pnpm@10.32.1 exec vitest run --passWithNoTests';
    },
    (job) => {
      job.steps = job.steps.filter(
        (step) => !step.run?.includes('check-flutter-scroll-evidence.mjs')
      );
    },
    (job) => {
      job.steps.find((step) => step.run?.includes('check-flutter-scroll-evidence.mjs')).if =
        'false';
    },
  ]) {
    const changed = structuredClone(workflow);
    mutate(changed.jobs['flutter-scroll-consumer']);
    assert.throws(() => assertFlutterScrollConsumerEvidence(changed));
  }
});

test('Flutter evidence rejects skipped wrappers and incomplete native execution', () => {
  const original = {
    vitest: {
      success: true,
      numTotalTests: 1,
      numPassedTests: 1,
      numFailedTests: 0,
      numPendingTests: 0,
      testResults: [
        {
          name: '/workspace/packages/compiler/test/flutter-scroll-outcomes.native.test.ts',
          status: 'passed',
          assertionResults: [{ status: 'passed' }],
        },
      ],
    },
    pubGet: {
      command: ['/owned/flutter', 'pub', 'get', '--offline'],
      status: 0,
      signal: null,
      stdout: 'ready',
    },
    widgets: {
      command: [
        '/owned/flutter',
        'test',
        '--no-pub',
        '--reporter',
        'expanded',
        'test/consumer_test.dart',
      ],
      status: 0,
      signal: null,
      stdout: '00:02 +14: All tests passed!\n',
    },
  };
  assert.deepEqual(assertFlutterScrollReports(original, 14), {
    wrapperPassed: 1,
    wrapperSkipped: 0,
    dartPassed: 14,
  });
  for (const mutate of [
    (reports) => {
      reports.vitest.numPassedTests = 0;
      reports.vitest.numPendingTests = 1;
    },
    (reports) => {
      reports.vitest.testResults[0].assertionResults[0].status = 'pending';
    },
    (reports) => {
      reports.pubGet.status = 1;
    },
    (reports) => {
      reports.widgets.status = 1;
    },
    (reports) => {
      reports.widgets.signal = 'SIGTERM';
    },
    (reports) => {
      reports.widgets.command.push('--name', 'one case');
    },
    (reports) => {
      reports.widgets.stdout = '00:02 +13: All tests passed!\n';
    },
    (reports) => {
      reports.widgets.stdout = 'No tests were found.';
    },
  ]) {
    const changed = structuredClone(original);
    mutate(changed);
    assert.throws(() => assertFlutterScrollReports(changed, 14));
  }
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

const websiteShaderWorkflow = 'website-shader-ownership-evidence.yml';
const docsColumnsSuite = 'apps/www/src/content/docs/zh-cn/site-docs-columns.browser.test.ts';

function assertWebsiteShaderEvidence(workflows) {
  const caller = workflows['compiler-gpui-source-consumers.yml'];
  assert.deepEqual(caller.on.workflow_dispatch.inputs.website_shader_evidence, {
    description: 'Also collect full Website source and original Docs evidence for this exact ref',
    type: 'boolean',
    required: false,
    default: false,
  });
  assertReusableCompilerInputBoundary(caller);
  const calls = Object.entries(workflows).flatMap(([workflow, definition]) =>
    Object.entries(definition.jobs ?? {})
      .filter(([, job]) => job.uses === `./.github/workflows/${websiteShaderWorkflow}`)
      .map(([id, job]) => ({ workflow, id, job }))
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].workflow, 'compiler-gpui-source-consumers.yml');
  assert.equal(
    calls[0].job.if,
    "github.event_name == 'workflow_dispatch' && inputs.website_shader_evidence == true"
  );
  assert.deepEqual(calls[0].job.permissions, { contents: 'read' });
  assert.equal(calls[0].job.secrets, undefined);
  assert.equal(calls[0].job['continue-on-error'], undefined);
  assert.equal(caller.jobs['native-consumer'].if, undefined);
  assert.equal(caller.jobs['native-consumer'].needs, undefined);
  assert.deepEqual(caller.jobs['native-consumer'].strategy.matrix.os, ['ubuntu-24.04', 'macos-15']);
  assert.equal(
    caller.jobs['package-budgets'].if,
    "github.event_name == 'workflow_dispatch' && inputs.package_budget_evidence == true"
  );
  assert.equal(caller.on.workflow_dispatch.inputs.package_budget_evidence.default, false);

  const workflow = workflows[websiteShaderWorkflow];
  assert.ok(workflow, 'the exact reusable Website evidence workflow exists');
  assert.deepEqual(Object.keys(workflow.on), ['workflow_call']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs).sort(), ['docs-columns', 'source-governance']);
  for (const [id, job] of Object.entries(workflow.jobs)) {
    assert.equal(job['runs-on'], 'ubuntu-24.04');
    assert.equal(job['timeout-minutes'], id === 'source-governance' ? 45 : 20);
    assert.equal(job.needs, undefined, 'source failure must not suppress original Docs evidence');
    assert.equal(job.if, undefined);
    assert.equal(job['continue-on-error'], undefined);
    assert.equal(job.env.EXPECTED_HEAD, '${{ github.sha }}');
    assert.doesNotMatch(JSON.stringify(job.env), /\$\{\{[^}]*\brunner\./u);
    const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
    assert.equal(checkout.with.ref, '${{ github.sha }}');
    assert.equal(checkout.with['persist-credentials'], false);
    const binding = job.steps.find((step) => step.id === 'bind-source');
    assert.match(binding.run, /test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_HEAD"/u);
    assert.match(binding.run, /git status --porcelain=v1 --untracked-files=all/u);
    assert.match(binding.run, /test ! -s "\$EVIDENCE_DIR\/source-status-before\.txt"/u);
    const terminal = job.steps.find((step) => step.id === 'record-terminal');
    assert.equal(terminal.if, 'always()');
    assert.match(terminal.run, /source-status-after\.txt/u);
    assert.match(terminal.run, /test ! -s "\$EVIDENCE_DIR\/source-status-after\.txt"/u);
    const artifact = job.steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
    assert.equal(artifact.if, 'always()');
    assert.equal(artifact.with['if-no-files-found'], 'error');
    assert.equal(artifact.with['include-hidden-files'], true);
    assert.ok(artifact.with.name.includes('${{ github.sha }}'));
    assert.ok(artifact.with.name.includes('${{ github.run_id }}'));
    assert.ok(artifact.with.name.includes('${{ github.run_attempt }}'));
    for (const step of job.steps) {
      assert.equal(step['continue-on-error'], undefined);
    }
  }
  const source = workflow.jobs['source-governance'].steps.find(
    (step) => step.id === 'run-source-scan'
  );
  assert.equal(source.if, undefined);
  assert.match(
    source.run,
    /node scripts\/coverage-matrices\/check-coverage-matrices\.mjs 2>&1 \| tee/u
  );
  assert.doesNotMatch(source.run, /\|\| true|--(?:filter|source-only)/u);
  const docs = workflow.jobs['docs-columns'];
  assert.equal(docs.env.PROTO_UI_EXPECTED_HEAD, '${{ github.sha }}');
  const execution = docs.steps.find((step) => step.id === 'run-docs-columns');
  assert.equal(execution.if, undefined);
  assert.equal(
    execution.env.PROTO_UI_RUNTIME_EVIDENCE_DIR,
    '${{ runner.temp }}/website-shader-docs'
  );
  assert.ok(execution.run.includes(docsColumnsSuite));
  assert.match(execution.run, /timeout --signal=TERM --kill-after=10s 900s/u);
  assert.doesNotMatch(
    execution.run,
    /--(?:retry|testNamePattern|passWithNoTests|testTimeout|hookTimeout)|(?:^|\s)-t(?:\s|=)|\|\| true/u
  );
  assert.ok(docs.steps.some((step) => step.id === 'verify-complete-docs'));
  const font = docs.steps.find((step) => step.id === 'prepare-browser-fonts');
  assert.equal(font['timeout-minutes'], 3);
  assert.equal(font.run, 'bash apps/www/scripts/prepare-homepage-composition-fonts.sh');
  const toolbar = docs.steps.find((step) => step.id === 'configure-browser');
  assert.match(toolbar.run, /astro preferences disable devToolbar/u);
  assert.match(toolbar.run, /astro preferences get devToolbar\.enabled/u);
  assert.match(toolbar.run, /CHROME_PATH=\$CHROME/u);
}

test('manual Website shader evidence preserves full source, all original Docs and strict failure ownership', () => {
  assertWebsiteShaderEvidence(readWorkflows());
});

test('Website evidence rejects automatic expansion, stale source, coupling and swallowed failures', () => {
  const original = readWorkflows();
  assertWebsiteShaderEvidence(original);
  const mutations = [
    (w) => {
      w[
        'compiler-gpui-source-consumers.yml'
      ].on.workflow_dispatch.inputs.website_shader_evidence.default = true;
    },
    (w) => {
      w['compiler-gpui-source-consumers.yml'].jobs['website-shader-evidence'].if = 'true';
    },
    (w) => {
      w['compiler-gpui-source-consumers.yml'].on.workflow_call = {
        inputs: { website_shader_evidence: { type: 'boolean', default: true } },
      };
    },
    (w) => {
      w['compiler-gpui-source-consumers.yml'].jobs['native-consumer'].if =
        'inputs.website_shader_evidence';
    },
    (w) => {
      w['compiler-gpui-source-consumers.yml'].jobs['package-budgets'].if =
        'inputs.website_shader_evidence';
    },
    (w) => {
      w[websiteShaderWorkflow].on.workflow_dispatch = null;
    },
    (w) => {
      w[websiteShaderWorkflow].permissions.contents = 'write';
    },
    (w) => {
      w[websiteShaderWorkflow].jobs['docs-columns'].needs = 'source-governance';
    },
    (w) => {
      w[websiteShaderWorkflow].jobs['source-governance']['continue-on-error'] = true;
    },
    (w) => {
      w[websiteShaderWorkflow].jobs['docs-columns'].steps[0].with.ref = 'main';
    },
    (w) => {
      w[websiteShaderWorkflow].jobs['source-governance'].env.EXPECTED_HEAD = 'old-source';
    },
    (w) => {
      w[websiteShaderWorkflow].jobs['docs-columns'].steps.find(
        (s) => s.id === 'run-docs-columns'
      ).run += ' --retry=1';
    },
    (w) => {
      w[websiteShaderWorkflow].jobs['docs-columns'].steps.find(
        (s) => s.id === 'run-docs-columns'
      ).run += ' -t one-case';
    },
    (w) => {
      w[websiteShaderWorkflow].jobs['source-governance'].steps.find(
        (s) => s.id === 'run-source-scan'
      )['continue-on-error'] = true;
    },
    (w) => {
      w[websiteShaderWorkflow].jobs['docs-columns'].steps.find((s) =>
        s.uses?.startsWith('actions/upload-artifact@')
      ).if = 'success()';
    },
    (w) => {
      w[websiteShaderWorkflow].jobs['source-governance'].steps.find((s) =>
        s.uses?.startsWith('actions/upload-artifact@')
      ).with['if-no-files-found'] = 'warn';
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(original);
    mutate(changed);
    assert.throws(() => assertWebsiteShaderEvidence(changed));
  }
});

test('Website evidence shell preserves complete diagnostic output and the real producer exit code', (t) => {
  const workflows = readWorkflows();
  assertWebsiteShaderEvidence(workflows);
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'pui-website-evidence-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const bin = path.join(temporary, 'bin');
  mkdirSync(bin);
  writeFileSync(
    path.join(bin, 'git'),
    '#!/bin/sh\nif [ "$1" = rev-parse ]; then printf "%s\\n" "$EXPECTED_HEAD"; fi\n',
    { mode: 0o755 }
  );
  const child =
    '#!/bin/sh\nprintf "%s\\0" "$@" > "$CAPTURE_ARGS"\nprintf "original stdout\\n"\nprintf "original stderr\\n" >&2\nexit "$CHILD_EXIT"\n';
  for (const name of ['node', 'corepack'])
    writeFileSync(path.join(bin, name), child, { mode: 0o755 });
  for (const [jobId, stepId, logName] of [
    ['source-governance', 'run-source-scan', 'source-scan.log'],
    ['docs-columns', 'run-docs-columns', 'browser.log'],
  ]) {
    const step = workflows[websiteShaderWorkflow].jobs[jobId].steps.find((s) => s.id === stepId);
    for (const status of [0, 1, 7]) {
      const evidence = path.join(temporary, `${jobId}-${status}`);
      mkdirSync(evidence);
      const captured = path.join(evidence, 'args');
      const result = spawnSync('bash', ['-euo', 'pipefail', '-c', step.run], {
        cwd: temporary,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          EVIDENCE_DIR: evidence,
          PROTO_UI_RUNTIME_EVIDENCE_DIR: evidence,
          EXPECTED_HEAD: 'a'.repeat(40),
          CAPTURE_ARGS: captured,
          CHILD_EXIT: String(status),
        },
        encoding: 'utf8',
      });
      assert.equal(result.status, status, result.stderr);
      assert.equal(
        readFileSync(path.join(evidence, 'command-exit-code.txt'), 'utf8'),
        `${status}\n`
      );
      assert.equal(
        readFileSync(path.join(evidence, logName), 'utf8'),
        'original stdout\noriginal stderr\n'
      );
      const args = readFileSync(captured, 'utf8').split('\0').filter(Boolean);
      assert.deepEqual(
        args,
        jobId === 'source-governance'
          ? ['scripts/coverage-matrices/check-coverage-matrices.mjs']
          : [
              'pnpm@10.32.1',
              'exec',
              'vitest',
              'run',
              docsColumnsSuite,
              '--no-file-parallelism',
              '--maxWorkers=1',
              '--minWorkers=1',
              '--reporter=default',
              '--reporter=json',
              `--outputFile=${evidence}/vitest.json`,
            ]
      );
    }
  }
});

test('Docs evidence cannot accept a skipped, filtered, missing or failing case as ten passes', (t) => {
  const workflows = readWorkflows();
  assertWebsiteShaderEvidence(workflows);
  const step = workflows[websiteShaderWorkflow].jobs['docs-columns'].steps.find(
    (item) => item.id === 'verify-complete-docs'
  );
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'pui-docs-inventory-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const valid = {
    success: true,
    numTotalTests: 10,
    numPassedTests: 10,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: [
      {
        name: path.join(temporary, docsColumnsSuite),
        assertionResults: Array.from({ length: 10 }, (_, index) => ({
          fullName: `original case ${index}`,
          status: 'passed',
        })),
      },
    ],
  };
  const cases = [
    [valid, 0],
    [{ ...valid, numPassedTests: 9, numPendingTests: 1 }, 1],
    [{ ...valid, numTotalTests: 9, numPassedTests: 9 }, 1],
    [{ ...valid, success: false, numFailedTests: 1 }, 1],
    [{ ...valid, testResults: [] }, 1],
    [
      { ...valid, testResults: [{ ...valid.testResults[0], name: 'different.browser.test.ts' }] },
      1,
    ],
    [
      {
        ...valid,
        testResults: [
          {
            ...valid.testResults[0],
            assertionResults: valid.testResults[0].assertionResults.map((item, index) =>
              index === 0 ? { ...item, status: 'pending' } : item
            ),
          },
        ],
      },
      1,
    ],
  ];
  for (const [report, expected] of cases) {
    writeFileSync(path.join(temporary, 'vitest.json'), JSON.stringify(report));
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', step.run], {
      cwd: temporary,
      env: { ...process.env, PROTO_UI_RUNTIME_EVIDENCE_DIR: temporary },
      encoding: 'utf8',
    });
    assert.equal(result.status, expected, result.stderr);
  }
});
