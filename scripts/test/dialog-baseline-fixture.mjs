// Synthetic geometry and receipts for verifier controls, never native evidence.
import { BASELINE, PROBE_HASHES } from './check-dialog-baseline-evidence.mjs';
export const rect = (x, y, width, height) => ({
  x,
  y,
  width,
  height,
  top: y,
  right: x + width,
  bottom: y + height,
  left: x,
});
export function fixture() {
  // Synthetic copies of the narrowly classified observations from run 37756502706.
  // Actual archived JSON and PNG bytes are replayed separately, never manufactured here.
  const observations = [],
    assertions = [];
  for (const family of ['shadcn', 'brutalist']) {
    for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
      const id = `${family}-${runtime}`;
      const unavailable = id === 'shadcn-vue2';
      const error = unavailable
        ? 'Error: RuntimeNotOffered:shadcn/vue2:["wc","react","vue"]'
        : family === 'brutalist'
          ? 'AssertionError: CloseIcon must not cover the Title box: expected 504 to be +0 // Object.is equality'
          : 'AssertionError: expected 0 to be greater than or equal to 15';
      const route =
        family === 'shadcn'
          ? '/en/ui-libraries/shadcn/dialog/'
          : '/en/ui-libraries/brutalist/components/dialog/';
      const add = (suffix, data) =>
        observations.push({
          id: `${id}-${suffix}`,
          sourceSha: BASELINE,
          image: { file: `${id}-${suffix}.png`, sha256: 'a'.repeat(64) },
          ...data,
        });
      if (!unavailable) {
        for (const phase of ['390-immediate', '390-resize-immediate', '390-settled']) {
          add(phase, {
            route,
            viewport: { width: 390, height: 900 },
            data: {
              rect: rect(0, family === 'shadcn' ? 368 : 353, 390, family === 'shadcn' ? 164 : 194),
              viewport: {
                width: 390,
                height: 900,
                x: 0,
                y: 0,
                visibleWidth: 390,
                visibleHeight: 900,
                scale: 1,
              },
              font: 16,
              rendering: { dpr: 1, scheme: 'light', fonts: 'loaded' },
              transition: 'entered',
            },
            platformFonts: { status: 'measured' },
          });
        }
        if (family === 'brutalist')
          observations.push({
            id: `${id}-390-settled-title-clearance`,
            sourceSha: BASELINE,
            fact: {
              missing: false,
              text: 'Neo-Brutalist modal',
              titleVisible: true,
              closeVisible: true,
              title: rect(26, 379, 338, 18),
              close: rect(336, 371, 36, 36),
              titleOverlapArea: 504,
              lines: [{ rect: rect(26, 376, 170.828125, 24), overlapArea: 0 }],
            },
          });
      }
      add('failure', {
        error,
        setup: {
          url: route,
          offeredRuntimes: JSON.stringify(
            family === 'shadcn' ? ['wc', 'react', 'vue'] : ['wc', 'react', 'vue', 'vue2']
          ),
        },
      });
      assertions.push({
        fullName: `${family}/${runtime}: live available region bounds content, leaves Mask full-size, scrolls long text and restores on close`,
        status: 'failed',
        failureMessages: [error + '\n    at probe'],
      });
    }
  }
  return {
    report: {
      numTotalTestSuites: 1,
      numFailedTestSuites: 1,
      numPassedTestSuites: 0,
      numPendingTestSuites: 0,
      numTotalTests: 8,
      numFailedTests: 8,
      numPassedTests: 0,
      numPendingTests: 0,
      numTodoTests: 0,
      success: false,
      testResults: [
        {
          assertionResults: assertions,
          message: '',
          status: 'failed',
          name: '/synthetic/apps/www/src/content/docs/zh-cn/dialog-available-space.browser.test.ts',
        },
      ],
    },
    observations: {
      sourceSha: BASELINE,
      probeSha: 'b'.repeat(40),
      subject: 'baseline',
      observations,
    },
    binding: {
      subjectSha: BASELINE,
      probeSha: 'b'.repeat(40),
      expectedProbeSha: 'b'.repeat(40),
      probeHashes: { ...PROBE_HASHES },
      reportSha256: 'd'.repeat(64),
      expectedReporterSha256: 'e'.repeat(64),
      runnerIntegrity: {
        schemaVersion: 1,
        vitestVersion: '2.1.9',
        reporterSha256: 'e'.repeat(64),
        reportSha256: 'd'.repeat(64),
        phase: 'process-exit',
        exitCode: 1,
        finishedCalls: 1,
        closeStarted: true,
        closeFinished: true,
        processTimedOut: false,
        cancelled: false,
        unhandledErrors: [],
        runnerErrors: [],
        files: [
          {
            path: 'apps/www/src/content/docs/zh-cn/dialog-available-space.browser.test.ts',
            state: 'fail',
            suiteErrors: [],
          },
        ],
      },
    },
  };
}
