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
    (step) =>
      step.name === 'Produce eight real Card profiles and check two opaque no-script fallbacks'
  );
  assert.equal(run['continue-on-error'], undefined);
  assert.equal(run.if, undefined);
  assert.match(run.run, /set -euo pipefail/);
  assert.match(run.run, /library-liquid-card-producer\.browser\.test\.ts/);
  assert.match(run.run, /assert\.equal\(report.numTotalTests, 10/);
  assert.match(run.run, /assert\.equal\(report.numPassedTests, 10\)/);
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
