import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
const workflow = parse(
  readFileSync('.github/workflows/liquid-card-candidate-evidence.yml', 'utf8')
);
const source = readFileSync(
  'apps/www/src/content/docs/zh-cn/library-liquid-card-producer.browser.test.ts',
  'utf8'
);
const expectedCases = [
  'actual complete Liquid Card optical producer en-light-1440-text100',
  'actual complete Liquid Card optical producer en-light-320-text200',
  'actual complete Liquid Card optical producer en-dark-1440-text100',
  'actual complete Liquid Card optical producer en-dark-320-text200',
  'actual complete Liquid Card optical producer zh-cn-light-1440-text100',
  'actual complete Liquid Card optical producer zh-cn-light-320-text200',
  'actual complete Liquid Card optical producer zh-cn-dark-1440-text100',
  'actual complete Liquid Card optical producer zh-cn-dark-320-text200',
  'no-script native input controls scrolls a long no-script document and follows a real same-origin link',
  'no-script native input controls refuses a stable action hidden beneath a real fixed header',
  'candidate Card keeps its complete opaque no-JS fallback en 320px with 200% text',
  'candidate Card keeps its complete opaque no-JS fallback zh-cn 320px with 200% text',
  'same-origin response collector native controls success',
  'same-origin response collector native controls http-error',
  'same-origin response collector native controls request-abort',
  'same-origin response collector native controls missing-location',
  'same-origin response collector native controls invalid-location',
  'same-origin response collector native controls unknown-status',
];
function verify(value) {
  assert.deepEqual(value.permissions, { contents: 'read' });
  assert.equal(value.env.CANDIDATE_SHA, '${{ github.event.pull_request.head.sha || github.sha }}');
  assert.deepEqual(Object.keys(value.jobs), ['actual-card-producer']);
  const job = value.jobs['actual-card-producer'];
  assert.equal(job.needs, undefined);
  assert.equal(job.if, undefined);
  assert.equal(job['continue-on-error'], undefined);
  const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v4');
  assert.equal(checkout.with.ref, '${{ env.CANDIDATE_SHA }}');
  assert.equal(checkout.with['persist-credentials'], false);
  const run = job.steps.find(
    (step) => step.name === 'Run original twelve Card cases and six response collector controls'
  );
  assert.equal(run['continue-on-error'], undefined);
  assert.equal(run.if, undefined);
  assert.match(run.run, /set -euo pipefail/);
  assert.match(run.run, /library-liquid-card-producer\.browser\.test\.ts/);
  assert.match(run.run, /assert\.equal\(report.numTotalTests, 18/);
  assert.match(run.run, /assert\.equal\(report.numPassedTests, 18\)/);
  assert.equal(job['timeout-minutes'], 25);
  assert.equal(run['timeout-minutes'], 20);
  const expected = JSON.parse(run.run.match(/const expected = (\[[^\n]+\]);/)[1]);
  assert.deepEqual(expected, expectedCases);
  assert.ok(
    run.run.includes(
      'assert.deepEqual(rows.map(row => row.fullName).sort(), [...expected].sort());'
    )
  );
  assert.ok(run.run.includes("assert.ok(rows.every(row => row.status === 'passed'));"));
  const upload = job.steps.find((step) => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with.path, '${{ runner.temp }}/liquid-card');
}
test('private full-Card producer is exact-source, separately runnable and retains original failures', () => {
  verify(workflow);
  assert.match(source, /libraryCardReadabilityFailures\(cards\)/);
  assert.match(source, /readMediaObservation\(page, requested\)/);
  assert.match(source, /verifyInitialPaintArtifact\(artifact.serialized, artifact.binding\)/);
  assert.match(source, /readCardsSha = digest\(code\)/);
});
for (const [name, change] of [
  [
    'foreign checkout',
    (v) => {
      v.jobs['actual-card-producer'].steps[0].with.ref = 'main';
    },
  ],
  [
    'write permission',
    (v) => {
      v.permissions.contents = 'write';
    },
  ],
  [
    'swallowed native failure',
    (v) => {
      v.jobs['actual-card-producer']['continue-on-error'] = true;
    },
  ],
  [
    'success-only artifacts',
    (v) => {
      v.jobs['actual-card-producer'].steps.at(-1).if = 'success()';
    },
  ],
  [
    'missing original evidence',
    (v) => {
      v.jobs['actual-card-producer'].steps.at(-1).with.path = '/tmp/other';
    },
  ],
])
  test(`Card producer refuses ${name}`, () => {
    const copy = structuredClone(workflow);
    change(copy);
    assert.throws(() => verify(copy));
  });

for (const [name, change] of [
  [
    'old twelve-only total',
    (value) => {
      value.jobs['actual-card-producer'].steps.find((step) =>
        step.run?.includes('report.numTotalTests')
      ).run = value.jobs['actual-card-producer'].steps
        .find((step) => step.run?.includes('report.numTotalTests'))
        .run.replace('report.numTotalTests, 18', 'report.numTotalTests, 12');
    },
  ],
  [
    'missing original Card identity',
    (value) => {
      value.jobs['actual-card-producer'].steps.find((step) =>
        step.run?.includes('const expected =')
      ).run = value.jobs['actual-card-producer'].steps
        .find((step) => step.run?.includes('const expected ='))
        .run.replace(
          'actual complete Liquid Card optical producer en-light-1440-text100',
          'replacement case'
        );
    },
  ],
  [
    'skipped native control accepted',
    (value) => {
      value.jobs['actual-card-producer'].steps.find((step) =>
        step.run?.includes('const expected =')
      ).run = value.jobs['actual-card-producer'].steps
        .find((step) => step.run?.includes('const expected ='))
        .run.replace("assert.ok(rows.every(row => row.status === 'passed'));", '');
    },
  ],
])
  test(`Card producer refuses ${name}`, () => {
    const copy = structuredClone(workflow);
    change(copy);
    assert.throws(() => verify(copy));
  });
