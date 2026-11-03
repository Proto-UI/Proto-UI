import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
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
