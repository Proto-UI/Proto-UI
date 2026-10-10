import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const BASELINE = '15d864de54210c2eebc4f4b2fec6235324989989';
// Calibrated against run 37756502706, artifact 11540591374. A changed probe
// closure needs fresh evidence/review, never an arbitrary AssertionError allowlist.
export const PROBE_HASHES = {
  'subject/apps/www/src/content/docs/zh-cn/dialog-available-space.browser.test.ts':
    'e50e6c8b484eb283584a5173d92fe3b6c5cde8369c3aae69329b875bd06d5c3d',
  'subject/apps/www/src/content/docs/zh-cn/browser-harness.ts':
    '9ac8ced949a73f5b5267f7ba6796a6bb69959704f2dc7fd5df5e7c96e3979839',
  'subject/scripts/test/server-readiness.mjs':
    '4bbc332f34ebf8a9c24f0ccc01d53438dd7146e86118a932eacc63d819105fda',
};
const journey =
  'live available region bounds content, leaves Mask full-size, scrolls long text and restores on close';
const insetError = 'AssertionError: expected 0 to be greater than or equal to 15';
const titleError =
  'AssertionError: CloseIcon must not cover the Title box: expected 504 to be +0 // Object.is equality';
const unavailableError = 'Error: RuntimeNotOffered:shadcn/vue2:["wc","react","vue"]';
const identities = ['shadcn', 'brutalist'].flatMap((family) =>
  ['wc', 'react', 'vue', 'vue2'].map((runtime) => `${family}/${runtime}`)
);
const rect = (x, y, width, height) => ({
  x,
  y,
  width,
  height,
  top: y,
  right: x + width,
  bottom: y + height,
  left: x,
});
const overlap = (a, b) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

export function verifyRunnerIntegrity(report, binding, exitCode) {
  const probePath = 'apps/www/src/content/docs/zh-cn/dialog-available-space.browser.test.ts';
  assert.equal(report.numTotalTestSuites, 1);
  assert.equal(report.numFailedTestSuites, 1);
  assert.equal(report.numPassedTestSuites, 0);
  assert.equal(report.numPendingTestSuites, 0);
  assert.equal(report.testResults.length, 1);
  const suite = report.testResults[0];
  assert.equal(suite.message, '', 'Unexpected suite/hook error');
  assert.equal(suite.status, 'failed');
  assert.ok(suite.name.endsWith(`/${probePath}`), 'Unexpected test file');
  const integrity = binding.runnerIntegrity;
  assert.ok(
    integrity,
    'Missing actual runner integrity receipt; historical geometry alone is incomplete'
  );
  assert.equal(integrity.schemaVersion, 1);
  assert.equal(integrity.vitestVersion, '2.1.9');
  assert.match(binding.expectedReporterSha256, /^[a-f0-9]{64}$/);
  assert.equal(integrity.reporterSha256, binding.expectedReporterSha256);
  assert.match(binding.reportSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    integrity.reportSha256,
    binding.reportSha256,
    'Receipt belongs to another JSON report'
  );
  assert.equal(integrity.phase, 'process-exit');
  assert.equal(integrity.exitCode, exitCode);
  assert.equal(integrity.finishedCalls, 1);
  assert.equal(integrity.closeStarted, true);
  assert.equal(integrity.closeFinished, true);
  assert.equal(integrity.processTimedOut, false);
  assert.equal(integrity.cancelled, false);
  assert.deepEqual(integrity.unhandledErrors, [], 'Unhandled runner errors');
  assert.deepEqual(integrity.runnerErrors, [], 'Runner/cleanup errors');
  assert.deepEqual(integrity.files, [{ path: probePath, state: 'fail', suiteErrors: [] }]);
}

export function verifyExpectedBaseline(report, observations, exitCode, binding) {
  assert.equal(exitCode, 1, 'The historical product must retain its failing assertions');
  verifyRunnerIntegrity(report, binding, exitCode);
  assert.equal(report.numTotalTests, 8);
  assert.equal(report.numFailedTests, 8);
  assert.equal(report.numPassedTests, 0);
  assert.equal(report.numPendingTests, 0);
  assert.equal(report.numTodoTests, 0);
  assert.equal(report.success, false);
  assert.equal(observations.subject, 'baseline');
  assert.equal(observations.sourceSha, BASELINE);
  assert.equal(binding.subjectSha, BASELINE);
  assert.match(binding.expectedProbeSha, /^[a-f0-9]{40}$/);
  assert.equal(binding.probeSha, binding.expectedProbeSha);
  assert.equal(observations.probeSha, binding.probeSha);
  assert.deepEqual(binding.probeHashes, PROBE_HASHES, 'Uncalibrated probe closure');
  assert.equal(report.testResults.length, 1);
  const assertions = report.testResults.flatMap((file) => file.assertionResults);
  assert.equal(assertions.length, 8);
  assert.deepEqual(
    assertions.map((result) => result.fullName).sort(),
    identities.map((id) => `${id}: ${journey}`).sort(),
    'Each exact historical family/runtime journey must occur once'
  );
  const rows = observations.observations;
  const expectedIds = identities.flatMap((identity) => {
    const id = identity.replace('/', '-');
    return identity === 'shadcn/vue2'
      ? [`${id}-failure`]
      : [
          `${id}-390-immediate`,
          `${id}-390-resize-immediate`,
          `${id}-390-settled`,
          ...(identity.startsWith('brutalist/') ? [`${id}-390-settled-title-clearance`] : []),
          `${id}-failure`,
        ];
  });
  assert.deepEqual(
    rows.map((row) => row.id).sort(),
    expectedIds.sort(),
    'Missing, duplicate or unexpected historical observations'
  );
  for (const row of rows) {
    assert.equal(row.sourceSha, BASELINE);
    if (!row.id.endsWith('-title-clearance')) {
      assert.equal(row.image.file, `${row.id}.png`);
      assert.match(row.image.sha256, /^[a-f0-9]{64}$/);
    }
  }
  const cases = [];
  for (const result of assertions) {
    assert.equal(result.status, 'failed');
    const identity = result.fullName.split(':')[0];
    const [family] = identity.split('/');
    const id = identity.replace('/', '-');
    const unavailable = identity === 'shadcn/vue2';
    const expectedError = unavailable
      ? unavailableError
      : family === 'brutalist'
        ? titleError
        : insetError;
    assert.equal(result.failureMessages.length, 1);
    const [message, ...stack] = result.failureMessages[0].split('\n');
    assert.equal(message, expectedError);
    assert.ok(
      stack.every((line) => /^    at \S/.test(line)),
      'Unexpected additional failure'
    );
    const failure = rows.find((row) => row.id === `${id}-failure`);
    assert.equal(failure.error, expectedError);
    const route =
      family === 'shadcn'
        ? '/en/ui-libraries/shadcn/dialog/'
        : '/en/ui-libraries/brutalist/components/dialog/';
    assert.equal(failure.setup.url, route);
    assert.deepEqual(
      JSON.parse(failure.setup.offeredRuntimes),
      family === 'shadcn' ? ['wc', 'react', 'vue'] : ['wc', 'react', 'vue', 'vue2']
    );
    if (unavailable) {
      cases.push({ identity, classification: 'not-exercised', reason: 'runtime-not-offered' });
      continue;
    }
    // The Shadcn assertion is on resize-immediate, not the later settled sample.
    // Brutalist records the same inset but stops at Title before either bounds check.
    for (const phase of ['390-resize-immediate', '390-settled']) {
      const row = rows.find((row) => row.id === `${id}-${phase}`);
      assert.equal(row.route, route);
      assert.deepEqual(row.viewport, { width: 390, height: 900 });
      assert.equal(row.data.rect.x, 0);
      assert.equal(row.data.rect.width, 390);
      assert.equal(row.data.rect.right, 390);
      assert.deepEqual(row.data.viewport, {
        width: 390,
        height: 900,
        x: 0,
        y: 0,
        visibleWidth: 390,
        visibleHeight: 900,
        scale: 1,
      });
      assert.equal(row.data.font, 16);
      assert.equal(row.data.rendering.dpr, 1);
      assert.equal(row.data.rendering.scheme, 'light');
      assert.equal(row.data.rendering.fonts, 'loaded');
      assert.equal(row.data.transition, 'entered');
      if (phase === '390-settled') assert.equal(row.platformFonts.status, 'measured');
    }
    if (family === 'brutalist') {
      const fact = rows.find((row) => row.id === `${id}-390-settled-title-clearance`).fact;
      assert.equal(fact.missing, false);
      assert.equal(fact.text, 'Neo-Brutalist modal');
      assert.equal(fact.titleVisible, true);
      assert.equal(fact.closeVisible, true);
      assert.deepEqual(fact.title, rect(26, 379, 338, 18));
      assert.deepEqual(fact.close, rect(336, 371, 36, 36));
      assert.equal(fact.titleOverlapArea, 504);
      assert.equal(overlap(fact.title, fact.close), fact.titleOverlapArea);
      // This sample proves box overlap, not painted glyph occlusion.
      assert.deepEqual(fact.lines, [{ rect: rect(26, 376, 170.828125, 24), overlapArea: 0 }]);
      assert.equal(overlap(fact.lines[0].rect, fact.close), 0);
      cases.push({
        identity,
        classification: 'historical-title-box-overlap',
        stoppedAt: '390-settled-title-clearance',
        insetAssertion: 'not-reached',
      });
    } else {
      cases.push({
        identity,
        classification: 'historical-zero-inset',
        stoppedAt: '390-resize-immediate-bounds',
      });
    }
  }
  return {
    classification: 'partial-historical-coverage',
    sourceSha: BASELINE,
    probeSha: binding.probeSha,
    probeHashes: binding.probeHashes,
    geometryFailures: 7,
    zeroInsetAssertionFailures: 3,
    titleBoxOverlapAssertionFailures: 4,
    unavailableRuntimeEntries: 1,
    notExercisedRuntimeEntries: 1,
    failedReportedTests: 8,
    failedProductJourneys: 7,
    passedProductJourneys: 0,
    completedProductJourneys: 0,
    limitations: [
      'All seven native journeys stop at the first 390px check; later viewport, long-text, scale, close and reopen assertions are not reached.',
      'Shadcn Vue2 has availability evidence only; it is not a native product failure or a comparable historical journey.',
      'Classification does not establish equal browser/font environments, pixel parity or a candidate pass.',
    ],
    cases,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [reportPath, observationsPath, exit, expectedProbeSha] = process.argv.slice(2);
  const root = path.dirname(reportPath);
  const read = (name) => fs.readFileSync(path.join(root, name), 'utf8').trim();
  const entries = read('probe-sha256.txt')
    .split('\n')
    .map((line) => {
      const match = /^([a-f0-9]{64})  (subject\/\S+)$/.exec(line);
      assert.ok(match, 'Malformed probe hash record');
      return [match[2], match[1]];
    });
  assert.equal(entries.length, Object.keys(PROBE_HASHES).length);
  const observations = JSON.parse(fs.readFileSync(observationsPath, 'utf8'));
  const reportBytes = fs.readFileSync(reportPath);
  const integrityPath = path.join(root, 'runner-integrity.json');
  assert.equal(Number(exit), Number(read('product-exit-code.txt')));
  const result = verifyExpectedBaseline(
    JSON.parse(reportBytes.toString('utf8')),
    observations,
    Number(exit),
    {
      subjectSha: read('subject-sha.txt'),
      probeSha: read('probe-sha.txt'),
      expectedProbeSha,
      probeHashes: Object.fromEntries(entries),
      reportSha256: createHash('sha256').update(reportBytes).digest('hex'),
      expectedReporterSha256: createHash('sha256')
        .update(fs.readFileSync(new URL('./dialog-run-integrity-reporter.mjs', import.meta.url)))
        .digest('hex'),
      runnerIntegrity: fs.existsSync(integrityPath)
        ? JSON.parse(read('runner-integrity.json'))
        : undefined,
    }
  );
  for (const row of observations.observations.filter((row) => row.image)) {
    const bytes = fs.readFileSync(path.join(path.dirname(observationsPath), row.image.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.image.sha256);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), 390);
    assert.equal(bytes.readUInt32BE(20), 900);
  }
  console.log(JSON.stringify(result));
}
