import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SHADER_BROWSER_CASES,
  SHADER_BROWSER_SUITE,
  SHADER_BROWSER_SELECTION,
  verifyShaderBrowserReport,
  verifyShaderBrowserBuilds,
} from './shader-browser-evidence.mjs';

// Synthetic report controls test acceptance bookkeeping, not browser execution.
const complete = () => ({
  success: true,
  numTotalTests: SHADER_BROWSER_CASES,
  numPassedTests: SHADER_BROWSER_CASES,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  testResults: [
    {
      name: fileURLToPath(new URL(`../../${SHADER_BROWSER_SUITE}`, import.meta.url)),
      status: 'passed',
      assertionResults: [
        ...SHADER_BROWSER_SELECTION.originalJourneys,
        ...SHADER_BROWSER_SELECTION.sceneJourneys,
      ].map((fullName) => ({
        fullName,
        status: 'passed',
      })),
    },
  ],
});

test('the complete distinct selected denominator is admissible', () => {
  assert.doesNotThrow(() => verifyShaderBrowserReport(complete()));
});

test('a correct target label cannot hide a substituted emitted profile', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'shader-build-reports-'));
  const candidate = 'a'.repeat(40);
  try {
    for (const [index, entry] of SHADER_BROWSER_SELECTION.fixtures.entries()) {
      const target = path.join(directory, String(index));
      mkdirSync(target);
      const report = {
        candidate: { head: candidate, dirty: false },
        compilations: [
          { target: 'react', profile: 'react-dom-source-v1', entry },
          { target: 'vue', profile: 'vue-source-v1', entry },
          { target: 'vue2', profile: 'vue2-source-v1', entry },
          { target: 'wc', profile: 'web-component-source-v1', entry },
        ],
        sourceGenerator: { files: ['controlled-generator'] },
        inputs: { 'controlled-input': 'controlled-hash' },
      };
      writeFileSync(path.join(target, 'build.json'), JSON.stringify(report));
    }
    assert.doesNotThrow(() => verifyShaderBrowserBuilds(directory, candidate));
    const first = path.join(directory, '0/build.json');
    const changed = JSON.parse(readFileSync(first, 'utf8'));
    changed.compilations[0].profile = 'vue-source-v1';
    writeFileSync(first, JSON.stringify(changed));
    assert.throws(() => verifyShaderBrowserBuilds(directory, candidate), /actual admitted profile/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const [name, mutate] of [
  [
    'missing original journeys',
    (report) => {
      report.numTotalTests--;
      report.numPassedTests--;
      report.testResults[0].assertionResults.pop();
    },
  ],
  [
    'skipped assertions under a successful runner',
    (report) => {
      report.numPassedTests--;
      report.numPendingTests++;
      report.testResults[0].assertionResults[0].status = 'skipped';
    },
  ],
  [
    'duplicate receipt replacing an unexecuted journey',
    (report) => {
      report.testResults[0].assertionResults[1].fullName =
        report.testResults[0].assertionResults[0].fullName;
    },
  ],
  [
    'failed assertion despite green summary',
    (report) => {
      report.testResults[0].assertionResults[0].status = 'failed';
    },
  ],
  [
    'a different journey replacing an original while keeping the count',
    (report) => {
      report.testResults[0].assertionResults[0].fullName = 'substitute journey';
    },
  ],
  [
    'different selected suite',
    (report) => {
      report.testResults[0].name = '/tmp/other.browser.test.ts';
    },
  ],
]) {
  test(`refuses ${name}`, () => {
    const report = complete();
    mutate(report);
    assert.throws(() => verifyShaderBrowserReport(report));
  });
}
