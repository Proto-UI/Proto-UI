import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PROBE_HASHES, verifyExpectedBaseline } from './check-dialog-baseline-evidence.mjs';
import { fixture, rect } from './dialog-baseline-fixture.mjs';
const verify = (f, exit = 1) => verifyExpectedBaseline(f.report, f.observations, exit, f.binding);
const row = (f, id = 'shadcn-wc-390-settled') =>
  f.observations.observations.find((r) => r.id === id);
const title = (f) => row(f, 'brutalist-wc-390-settled-title-clearance').fact;
const results = (f) => f.report.testResults[0].assertionResults;

test('the calibrated closure matches the actual candidate-owned probe source', () => {
  for (const [file, expected] of Object.entries(PROBE_HASHES)) {
    const bytes = readFileSync(new URL(`../../${file.replace(/^subject\//, '')}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, file);
  }
});

test('the workflow binds classification to its independently selected candidate SHA', () => {
  const workflow = readFileSync(
    new URL('../../.github/workflows/dialog-available-space-evidence.yml', import.meta.url),
    'utf8'
  );
  assert.ok(workflow.includes('observations.json" "$status" "$CANDIDATE_SHA"'));
  assert.ok(
    workflow.includes('--reporter=../candidate/scripts/test/dialog-run-integrity-reporter.mjs')
  );
  assert.ok(
    workflow.includes(
      'PROTO_UI_DIALOG_INTEGRITY_PATH: ${{ runner.temp }}/dialog-space/runner-integrity.json'
    )
  );
  assert.ok(
    workflow.includes('PROTO_UI_DIALOG_JSON_PATH: ${{ runner.temp }}/dialog-space/vitest.json')
  );
  assert.ok(workflow.includes('candidate/scripts/test/dialog-run-integrity.test.mjs'));
});

test('classifies only three inset assertions, four earlier Title box failures and one not-exercised entry', () => {
  const result = verify(fixture());
  assert.equal(result.classification, 'partial-historical-coverage');
  assert.equal(result.geometryFailures, 7);
  assert.equal(result.zeroInsetAssertionFailures, 3);
  assert.equal(result.titleBoxOverlapAssertionFailures, 4);
  assert.equal(result.failedReportedTests, 8);
  assert.equal(result.failedProductJourneys, 7);
  assert.equal(result.notExercisedRuntimeEntries, 1);
  assert.equal(result.passedProductJourneys, 0);
  assert.equal(result.completedProductJourneys, 0);
  assert.equal(
    result.cases.find((c) => c.identity === 'shadcn/vue2').classification,
    'not-exercised'
  );
  assert.equal(result.cases.filter((c) => c.insetAssertion === 'not-reached').length, 4);
});
for (const [name, mutate] of [
  ['unexpected timeout', (f) => (results(f)[0].failureMessages = ['locator.click timed out'])],
  [
    'generic assertion',
    (f) => (results(f)[4].failureMessages = ['AssertionError: arbitrary product defect']),
  ],
  ['setup failure', (f) => (results(f)[4].failureMessages = ['Error: browser launch failed'])],
  [
    'error containing the expected substring',
    (f) => (results(f)[4].failureMessages[0] = 'Error: nested ' + results(f)[4].failureMessages[0]),
  ],
  [
    'additional failure message',
    (f) => results(f)[4].failureMessages.push('Error: teardown failed'),
  ],
  [
    'failure observation disagrees',
    (f) => (row(f, 'brutalist-wc-failure').error = 'Error: timeout'),
  ],
  ['missing screenshot', (f) => delete row(f).image],
  ['mislabeled screenshot', (f) => (row(f).image.file = 'other.png')],
  ['invalid screenshot hash', (f) => (row(f).image.sha256 = 'invalid')],
  ['wrong source', (f) => (f.observations.sourceSha = 'c'.repeat(40))],
  [
    'wrong row source',
    (f) =>
      title(f) && (row(f, 'brutalist-wc-390-settled-title-clearance').sourceSha = 'c'.repeat(40)),
  ],
  ['wrong source receipt', (f) => (f.binding.subjectSha = 'c'.repeat(40))],
  ['candidate subject', (f) => (f.observations.subject = 'candidate')],
  ['wrong observed probe', (f) => (f.observations.probeSha = 'c'.repeat(40))],
  ['wrong probe receipt', (f) => (f.binding.probeSha = 'c'.repeat(40))],
  ['wrong expected probe', (f) => (f.binding.expectedProbeSha = 'c'.repeat(40))],
  ['invalid expected probe', (f) => (f.binding.expectedProbeSha = 'HEAD')],
  ['missing closure', (f) => delete f.binding.probeHashes],
  [
    'additional closure member',
    (f) => (f.binding.probeHashes['subject/other.ts'] = 'a'.repeat(64)),
  ],
  ['wrong font', (f) => (row(f).data.font = 20)],
  ['wrong runtime route', (f) => (row(f).route = '/404/')],
  ['wrong failure route', (f) => (row(f, 'brutalist-wc-failure').setup.url = '/404/')],
  ['unknown platform font', (f) => (row(f).platformFonts.status = 'no-glyphs')],
  ['fonts not loaded', (f) => (row(f).data.rendering.fonts = 'loading')],
  ['different device scale', (f) => (row(f).data.rendering.dpr = 2)],
  ['different color scheme', (f) => (row(f).data.rendering.scheme = 'dark')],
  ['unsettled transition', (f) => (row(f).data.transition = 'entering')],
  ['different viewport', (f) => (row(f).viewport.width = 430)],
  ['different visible region', (f) => (row(f).data.viewport.visibleWidth = 300)],
  ['different settled geometry', (f) => (row(f).data.rect.x = 16)],
  [
    'different actual assertion sample',
    (f) => (row(f, 'shadcn-wc-390-resize-immediate').data.rect.x = 16),
  ],
  ['unexpected pass', (f) => (f.report.numPassedTests = 1)],
  ['passed result', (f) => (results(f)[0].status = 'passed')],
  ['pending test', (f) => (f.report.numPendingTests = 1)],
  ['todo test', (f) => (f.report.numTodoTests = 1)],
  ['successful suite', (f) => (f.report.success = true)],
  ['extra failed suite', (f) => f.report.testResults.push({ assertionResults: [] })],
  ['changed case title', (f) => (results(f)[0].fullName += ' altered')],
  ['duplicate runtime identity', (f) => (results(f)[3].fullName = results(f)[0].fullName)],
  ['missing observation', (f) => f.observations.observations.pop()],
  ['duplicate observation', (f) => f.observations.observations.push(row(f))],
  [
    'unexpected later observation',
    (f) => f.observations.observations.push({ id: 'brutalist-wc-scale2' }),
  ],
  ['missing Title', (f) => (title(f).missing = true)],
  ['hidden Title', (f) => (title(f).titleVisible = false)],
  ['hidden CloseIcon', (f) => (title(f).closeVisible = false)],
  ['different Title text', (f) => (title(f).text = 'Other dialog')],
  ['unmeasured overlap', (f) => delete title(f).titleOverlapArea],
  ['zero Title overlap', (f) => (title(f).titleOverlapArea = 0)],
  ['different Title overlap', (f) => (title(f).titleOverlapArea = 505)],
  ['fabricated overlap with disjoint boxes', (f) => (title(f).close = rect(500, 371, 36, 36))],
  ['inconsistent rectangle edges', (f) => (title(f).title.right = 365)],
  ['different Title geometry', (f) => (title(f).title = rect(26, 379, 338, 19))],
  ['missing actual text ranges', (f) => (title(f).lines = [])],
  ['painted text overlap', (f) => (title(f).lines[0].overlapArea = 1)],
  ['different text range geometry', (f) => (title(f).lines[0].rect.right = 350)],
  [
    'offered Vue2 entry',
    (f) => (row(f, 'shadcn-vue2-failure').setup.offeredRuntimes = '["wc","react","vue","vue2"]'),
  ],
  ['generic Vue2 timeout', (f) => (results(f)[3].failureMessages = ['locator.click timed out'])],
  [
    'unknown Brutalist runtime offering',
    (f) => (row(f, 'brutalist-wc-failure').setup.offeredRuntimes = '["wc"]'),
  ],
  [
    'obsolete seven-inset classification',
    (f) => {
      results(f)[4].failureMessages = [
        'AssertionError: expected 0 to be greater than or equal to 15',
      ];
      row(f, 'brutalist-wc-failure').error = results(f)[4].failureMessages[0];
    },
  ],
])
  test(`rejects ${name}`, () => {
    const f = fixture();
    mutate(f);
    assert.throws(() => verify(f));
  });
for (const file of Object.keys(PROBE_HASHES))
  test(`rejects changed probe closure member ${file}`, () => {
    const f = fixture();
    f.binding.probeHashes[file] = 'c'.repeat(64);
    assert.throws(() => verify(f));
  });
test('does not turn a successful, cancelled or setup-failed process into the expected failure', () => {
  for (const code of [0, 2, 137, 143]) assert.throws(() => verify(fixture(), code));
});

test('rejects an additional timeout hidden after the expected error line', () => {
  const f = fixture();
  results(f)[4].failureMessages[0] += '\nError: locator timed out';
  assert.throws(() => verify(f));
});

for (const [name, mutate] of [
  [
    'afterAll timeout in suite message',
    (f) => (f.report.testResults[0].message = 'Hook timed out in afterAll'),
  ],
  ['wrong suite path', (f) => (f.report.testResults[0].name = '/other.test.ts')],
  ['passed suite status', (f) => (f.report.testResults[0].status = 'passed')],
  ['missing suite message', (f) => delete f.report.testResults[0].message],
  ['different total suite count', (f) => (f.report.numTotalTestSuites = 2)],
  ['different failed suite count', (f) => (f.report.numFailedTestSuites = 2)],
  ['passed suite count', (f) => (f.report.numPassedTestSuites = 1)],
  ['pending suite count', (f) => (f.report.numPendingTestSuites = 1)],
  ['missing runner receipt', (f) => delete f.binding.runnerIntegrity],
  ['different runner version', (f) => (f.binding.runnerIntegrity.vitestVersion = '3.0.0')],
  ['different reporter source', (f) => (f.binding.runnerIntegrity.reporterSha256 = 'f'.repeat(64))],
  ['receipt from another report', (f) => (f.binding.runnerIntegrity.reportSha256 = 'f'.repeat(64))],
  ['reporting before process exit', (f) => (f.binding.runnerIntegrity.phase = 'reported')],
  ['mismatched runner exit', (f) => (f.binding.runnerIntegrity.exitCode = 2)],
  ['missing onFinished', (f) => (f.binding.runnerIntegrity.finishedCalls = 0)],
  ['multiple runs', (f) => (f.binding.runnerIntegrity.finishedCalls = 2)],
  ['cleanup not started', (f) => (f.binding.runnerIntegrity.closeStarted = false)],
  ['cleanup not finished', (f) => (f.binding.runnerIntegrity.closeFinished = false)],
  ['process cleanup timeout', (f) => (f.binding.runnerIntegrity.processTimedOut = true)],
  ['cancelled runner', (f) => (f.binding.runnerIntegrity.cancelled = true)],
  [
    'unhandled error',
    (f) => (f.binding.runnerIntegrity.unhandledErrors = ['unexpected async error']),
  ],
  ['cleanup error', (f) => (f.binding.runnerIntegrity.runnerErrors = ['unexpected cleanup error'])],
  [
    'suite error omitted by JSON',
    (f) => (f.binding.runnerIntegrity.files[0].suiteErrors = ['afterAll failure']),
  ],
  ['missing runner file', (f) => (f.binding.runnerIntegrity.files = [])],
  ['different runner file', (f) => (f.binding.runnerIntegrity.files[0].path = 'other.test.ts')],
])
  test(`rejects incomplete execution: ${name}`, () => {
    const f = fixture();
    mutate(f);
    assert.throws(() => verify(f));
  });
