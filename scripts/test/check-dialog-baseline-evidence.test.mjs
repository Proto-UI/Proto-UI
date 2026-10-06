import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE, verifyExpectedBaseline } from './check-dialog-baseline-evidence.mjs';
function fixture() {
  const cases = ['shadcn', 'brutalist'].flatMap((family) =>
    ['wc', 'react', 'vue', 'vue2'].map((runtime) => ({
      id: `${family}-${runtime}-390-settled`,
      sourceSha: BASELINE,
      route:
        family === 'shadcn'
          ? '/en/ui-libraries/shadcn/dialog/'
          : '/en/ui-libraries/brutalist/components/dialog/',
      viewport: { width: 390, height: 900 },
      data: {
        rect: { x: 0, width: 390 },
        font: 16,
        rendering: { dpr: 1, scheme: 'light', fonts: 'loaded' },
        transition: 'entered',
      },
      platformFonts: { status: 'measured' },
      image: { file: `${family}-${runtime}-390-settled.png`, sha256: 'a'.repeat(64) },
    }))
  );
  const unavailable = cases.findIndex((row) => row.id === 'shadcn-vue2-390-settled');
  cases[unavailable] = {
    id: 'shadcn-vue2-failure',
    sourceSha: BASELINE,
    error: 'Error: RuntimeNotOffered:shadcn/vue2:["wc","react","vue"]',
    setup: { url: '/en/ui-libraries/shadcn/dialog/', offeredRuntimes: '["wc","react","vue"]' },
    image: { file: 'shadcn-vue2-failure.png', sha256: 'a'.repeat(64) },
  };
  return {
    report: {
      numTotalTests: 8,
      numFailedTests: 8,
      numPassedTests: 0,
      testResults: [
        {
          assertionResults: cases.map((row, index) => ({
            fullName:
              index === unavailable
                ? 'shadcn/vue2: live available region'
                : row.id.replace('-390-settled', '').replace('-', '/') + ': live available region',
            status: 'failed',
            failureMessages: [
              index === unavailable
                ? cases[unavailable].error
                : 'AssertionError: expected 0 to be greater than or equal to 15',
            ],
          })),
        },
      ],
    },
    observations: { sourceSha: BASELINE, probeSha: 'b'.repeat(40), observations: cases },
  };
}
test('recognizes only the explicitly retained seven historical geometry failures plus the unavailable entry', () => {
  const f = fixture();
  assert.equal(verifyExpectedBaseline(f.report, f.observations, 1).passedProductJourneys, 0);
});
for (const [name, mutate] of [
  [
    'unexpected timeout',
    (f) =>
      (f.report.testResults[0].assertionResults[0].failureMessages = ['locator.click timed out']),
  ],
  ['missing screenshot', (f) => f.observations.observations.pop()],
  ['wrong source', (f) => (f.observations.sourceSha = 'c'.repeat(40))],
  ['wrong font', (f) => (f.observations.observations[0].data.font = 20)],
  ['wrong runtime route', (f) => (f.observations.observations[0].route = '/404/')],
  ['unexpected pass', (f) => (f.report.numPassedTests = 1)],
  [
    'unknown platform font',
    (f) => (f.observations.observations[0].platformFonts.status = 'no-glyphs'),
  ],
])
  test(`rejects ${name}`, () => {
    const f = fixture();
    mutate(f);
    assert.throws(() => verifyExpectedBaseline(f.report, f.observations, 1));
  });
test('does not turn a successful or cancelled process into the expected failure', () => {
  const f = fixture();
  for (const code of [0, 137, 143])
    assert.throws(() => verifyExpectedBaseline(f.report, f.observations, code));
});

test('rejects a generic Vue2 timeout or an actually offered Vue2 entry', () => {
  const f = fixture();
  f.observations.observations[3].setup.offeredRuntimes = '["wc","react","vue","vue2"]';
  assert.throws(() => verifyExpectedBaseline(f.report, f.observations, 1));
  const g = fixture();
  g.report.testResults[0].assertionResults[3].failureMessages = ['locator.click timed out'];
  assert.throws(() => verifyExpectedBaseline(g.report, g.observations, 1));
});

test('rejects duplicate or missing reported runtime identities', () => {
  const f = fixture();
  f.report.testResults[0].assertionResults[3].fullName =
    f.report.testResults[0].assertionResults[0].fullName;
  assert.throws(() => verifyExpectedBaseline(f.report, f.observations, 1));
});
