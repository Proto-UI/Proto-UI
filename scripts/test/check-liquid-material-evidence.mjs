import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MATERIAL_FILE = 'apps/www/src/content/docs/zh-cn/demo-liquid-glass-material.browser.test.ts';

// T-LIQUID-GLASS-MATERIAL-0001's opt-in cases must actually execute in the
// dedicated evidence lanes. A successful public Button case alone is not the
// light/dark, preference, portal-theme or release-lifecycle evidence.
const RELEASE_CASES = [
  'light: visible dynamic source, optical pixels, motion, input and revocation',
  'dark: visible dynamic source, optical pixels, motion, input and revocation',
  'the actual public Button documentation uses the same optical path on all four runtime panels',
  'preserves authored theme tokens through a real WC portal and native observer cleanup',
  'retains complete paint geometry, finishes real release tails and rejects late completions',
];
const DIAGNOSTIC_CASE =
  'records actual four-runtime idle/hover work without accepting an optimization';

export function requiredLiquidMaterialCases(scope) {
  if (scope === 'frame-budget-release') return [...RELEASE_CASES];
  if (scope === 'material-library') return [...RELEASE_CASES, DIAGNOSTIC_CASE];
  throw new Error(`Unknown Liquid evidence scope: ${scope}`);
}

export function inspectLiquidMaterialEvidence(report, scope) {
  const required = requiredLiquidMaterialCases(scope);
  const files = (report?.testResults ?? []).filter((file) => {
    const name = String(file.name ?? '').replaceAll('\\', '/');
    return name === MATERIAL_FILE || name.endsWith(`/${MATERIAL_FILE}`);
  });
  const assertions = files.flatMap((file) => file.assertionResults ?? []);
  const cases = required.map((title) => {
    const matches = assertions.filter((item) => item.title === title);
    return {
      title,
      occurrences: matches.length,
      statuses: matches.map((item) => item.status),
      passed: matches.length === 1 && matches[0].status === 'passed',
    };
  });
  const reportSuccessful =
    report?.success === true &&
    report?.numFailedTests === 0 &&
    report?.numFailedTestSuites === 0 &&
    // Vitest 2's JSON reporter has no runtime-error counter. Retain a later
    // reporter's explicit failure without rejecting the pinned reporter shape.
    (report.numRuntimeErrorTestSuites === undefined || report.numRuntimeErrorTestSuites === 0);
  return {
    scope,
    file: MATERIAL_FILE,
    fileOccurrences: files.length,
    reportSuccessful,
    cases,
    passed: reportSuccessful && files.length === 1 && cases.every((item) => item.passed),
    limitation:
      'Executed case coverage only; the original browser assertions determine optical and lifecycle acceptance. No physical refresh or input-to-photon claim.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [file, scope, output] = process.argv.slice(2);
  if (!file || !scope || !output || process.argv.length !== 5)
    throw new Error('Usage: node check-liquid-material-evidence.mjs REPORT SCOPE OUTPUT');
  const coverage = inspectLiquidMaterialEvidence(JSON.parse(readFileSync(file, 'utf8')), scope);
  writeFileSync(output, `${JSON.stringify(coverage, null, 2)}\n`);
  if (!coverage.passed) {
    const failures = coverage.cases
      .filter((item) => !item.passed)
      .map(
        (item) => `${item.title}: ${item.occurrences} occurrence(s), ${item.statuses.join(', ')}`
      );
    throw new Error(
      `Liquid evidence is incomplete (reportSuccessful=${coverage.reportSuccessful}, files=${coverage.fileOccurrences}):\n${failures.join('\n')}`
    );
  }
  console.log(`[liquid-evidence] ${scope}: all ${coverage.cases.length} required cases passed`);
}
