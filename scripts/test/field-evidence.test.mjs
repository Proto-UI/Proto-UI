import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path, { matchesGlob } from 'node:path';
import test from 'node:test';
import YAML from 'yaml';
import {
  assertFieldReport,
  FIELD_CASE_TITLES,
  FIELD_SUITE,
  sourceBinding,
  assertSourceBinding,
  writeSourceBinding,
} from './field-evidence.mjs';
const root = new URL('../../', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');
const workflow = () => YAML.parse(read('.github/workflows/field-family-evidence.yml'));
function report() {
  return {
    success: true,
    numTotalTests: 25,
    numPassedTests: 25,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    testResults: [
      {
        name: `/checkout/${FIELD_SUITE}`,
        status: 'passed',
        assertionResults: FIELD_CASE_TITLES.map((title) => ({ title, status: 'passed' })),
      },
    ],
  };
}
test('accepts exactly the existing 25 native Field case identities', () =>
  assertFieldReport(report()));
for (const [name, change] of [
  ['aggregate failure', (r) => (r.success = false)],
  ['zero tests', (r) => (r.numPassedTests = 0)],
  ['missing case', (r) => r.testResults[0].assertionResults.pop()],
  [
    'duplicate replacing a case',
    (r) => (r.testResults[0].assertionResults[1] = r.testResults[0].assertionResults[0]),
  ],
  ['wrong source file', (r) => (r.testResults[0].name = '/checkout/other.test.ts')],
  ['extra source file', (r) => r.testResults.push(r.testResults[0])],
  [
    'skipped assertion hidden by aggregate',
    (r) => (r.testResults[0].assertionResults[0].status = 'skipped'),
  ],
  [
    'todo assertion hidden by aggregate',
    (r) => (r.testResults[0].assertionResults[0].status = 'todo'),
  ],
  ['pending total', (r) => (r.numPendingTests = 1)],
  ['todo total', (r) => (r.numTodoTests = 1)],
  ['failed suite', (r) => (r.numFailedTestSuites = 1)],
  [
    'swapped runtime',
    (r) =>
      (r.testResults[0].assertionResults[0].title = FIELD_CASE_TITLES[0].replace(' wc ', ' gpui ')),
  ],
])
  test(`rejects ${name}`, () => {
    const r = report();
    change(r);
    assert.throws(() => assertFieldReport(r));
  });
function binding(status = '', head = 'a'.repeat(40)) {
  return sourceBinding(
    'a'.repeat(40),
    (args) => (args[0] === 'status' ? status : args[1] === 'HEAD' ? head : 'b'.repeat(40)),
    'failure'
  );
}
test('records actual head/tree and retains failed producer outcome', () => {
  const b = binding();
  assertSourceBinding(b);
  assert.equal(b.outcome, 'failure');
  assert.equal(b.sourceTree, 'b'.repeat(40));
});
for (const status of [' M tracked.ts\n', '?? new-source.ts\n'])
  test(`rejects dirty source ${status.trim()}`, () =>
    assert.throws(() => assertSourceBinding(binding(status))));
test('rejects stale checkout and malformed identity', () => {
  assert.throws(() => assertSourceBinding(binding('', 'c'.repeat(40))));
  assert.throws(() => assertSourceBinding({ ...binding(), sourceTree: 'missing' }));
});
test('failure facts are written before rejection and never overwritten', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'field-source-binding-'));
  const file = path.join(dir, 'source.json');
  try {
    assert.throws(() => writeSourceBinding(file, binding('?? new-source.ts\n')));
    assert.equal(JSON.parse(fs.readFileSync(file)).sourceDirty, true);
    assert.throws(() => writeSourceBinding(file, binding()), /EEXIST/);
    assert.equal(JSON.parse(fs.readFileSync(file)).sourceDirty, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('exact-head read-only workflow retains required inventory and all failures', () => {
  const w = workflow(),
    steps = w.jobs['browser-evidence'].steps;
  assert.deepEqual(w.permissions, { contents: 'read' });
  assert.ok('workflow_dispatch' in w.on);
  assert.equal(w.env.CANDIDATE_SHA, '${{ github.event.pull_request.head.sha || github.sha }}');
  assert.equal(steps[0].with.ref, '${{ env.CANDIDATE_SHA }}');
  assert.equal(steps[0].with['persist-credentials'], false);
  assert.equal(steps.find((s) => s.uses === 'actions/setup-node@v4').with['node-version'], 24);
  assert.ok(steps.some((s) => s.run?.includes('corepack pnpm@10.32.1 install --frozen-lockfile')));
  const execute = steps.find((s) => s.run?.includes(`exec vitest run`));
  assert.ok(execute.run.includes(FIELD_SUITE));
  assert.equal(
    execute.env.PROTO_UI_FIELD_SCREENSHOT_DIR,
    '${{ runner.temp }}/field-family/screenshots'
  );
  assert.match(execute.run, /set -euo pipefail/);
  assert.match(execute.run, /--reporter=json/);
  assert.match(execute.run, /field-evidence.mjs check/);
  assert.equal(execute['continue-on-error'], undefined);
  assert.equal(execute.if, undefined);
  const after = steps.find((s) => s.run?.includes('source-after.json'));
  assert.equal(after.if, 'always()');
  assert.match(after.run, /field-evidence.mjs source/);
  const artifact = steps.find((s) => s.uses === 'actions/upload-artifact@v4');
  assert.equal(artifact.if, 'always()');
  assert.equal(artifact.with['if-no-files-found'], 'error');
  assert.match(artifact.with.name, /CANDIDATE_SHA/);
  assert.match(artifact.with.name, /github.run_attempt/);
  assert.ok(read('scripts/test/runtime-test-plan.mjs').includes(FIELD_SUITE));
  const accordion = YAML.parse(read('.github/workflows/accordion-family-evidence.yml'));
  const toolbar = steps.find((s) => s.run?.includes('preferences disable devToolbar'));
  assert.equal(
    toolbar.run,
    accordion.jobs['browser-evidence'].steps.find((s) =>
      s.run?.includes('preferences disable devToolbar')
    ).run
  );
});
const inputs = [
  '.github/workflows/field-family-evidence.yml',
  'scripts/test/field-evidence.mjs',
  'scripts/test/field-evidence.test.mjs',
  'apps/www/src/content/docs/zh-cn/field-browser-oracle.ts',
  FIELD_SUITE,
  'apps/www/src/content/docs/field-demo.shared.ts',
  'vitest.config.ts',
  'apps/www/astro.config.mjs',
  'apps/www/package.json',
  'package.json',
  'apps/www/src/styles/global.css',
  'apps/www/src/styles/runtime-box.css',
  ...['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'].flatMap((f) => [
    `packages/prototypes/${f}/src/field/root.proto.ts`,
    `packages/prototypes/${f}/src/button/button.proto.ts`,
    `apps/www/src/content/docs/en/ui-libraries/${f}/field.mdx`,
    `apps/www/src/content/docs/zh-cn/ui-libraries/${f}/field.mdx`,
  ]),
];
for (const input of inputs)
  test(`actual Field input triggers fresh evidence: ${input}`, () => {
    assert.ok(read(input).length);
    const paths = workflow().on.pull_request.paths;
    assert.ok(paths.some((pattern) => matchesGlob(input, pattern)));
    assert.equal(
      paths
        .filter((pattern) => !matchesGlob(input, pattern))
        .some((pattern) => matchesGlob(input, pattern)),
      false,
      'Removing the actual input trigger must leave this input uncovered'
    );
  });
test('trigger scope excludes unrelated source and README changes', () => {
  for (const input of ['README.md', 'packages/prototypes/base/src/table/root.proto.ts'])
    assert.equal(
      workflow().on.pull_request.paths.some((p) => matchesGlob(input, p)),
      false
    );
});
