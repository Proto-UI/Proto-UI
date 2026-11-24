// Validate the existing isolated Bootstrap producer; importing starts no server.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertVitestReport } from './runtime-ci.mjs';

export const BOOTSTRAP_BROWSER_SUITE =
  'apps/www/src/content/docs/zh-cn/demo-bootstrap-state-controls.browser.test.ts';
export const BOOTSTRAP_EVIDENCE_SUITES = Object.freeze([
  'packages/prototypes/bootstrap-2-3-2/test/controls.test.ts',
  'apps/www/src/content/docs/zh-cn/native-editor-evidence.test.ts',
  'apps/www/src/content/docs/zh-cn/native-composition-evidence.test.ts',
  'apps/www/src/content/docs/zh-cn/bootstrap-disabled-paint.test.ts',
  BOOTSTRAP_BROWSER_SUITE,
]);
const runtimes = ['wc', 'react', 'vue', 'vue2'];
const themes = ['light', 'dark'];
// Inventory of the original fifteen journeys, not replacement behavior oracles.
export const BOOTSTRAP_ORIGINAL_BROWSER_CASES = Object.freeze([
  ...themes.flatMap((theme) => [
    `renders source-owned paint for all eight parts in ${theme}`,
    ...runtimes.map(
      (runtime) =>
        `${runtime}/${theme}: real activation, context, controlled requests and disabled recovery`
    ),
  ]),
  ...runtimes.map(
    (runtime) =>
      `${runtime}: native singleton editors, controlled values, readonly and disabled recovery`
  ),
  'updates semantic/decorative separators, remains readable on mobile, and disposes every real host',
]);

export const BOOTSTRAP_COMPOSITION_BROWSER_CASES = Object.freeze(
  runtimes.flatMap((runtime) =>
    ['input', 'textarea'].flatMap((kind) =>
      ['uncontrolled', 'controlled'].map(
        (owner) => `${runtime}/${kind}/${owner}: native CDP composition preserves editor and owner`
      )
    )
  )
);
export const BOOTSTRAP_BROWSER_CASES = Object.freeze([
  ...BOOTSTRAP_ORIGINAL_BROWSER_CASES,
  ...BOOTSTRAP_COMPOSITION_BROWSER_CASES,
]);

export function assertBootstrapEvidence({ manifest, report }, expected) {
  assert.match(expected.sha ?? '', /^[a-f0-9]{40}$/, 'Expected an exact checkout SHA');
  assert.match(expected.runId ?? '', /^[1-9][0-9]*$/, 'Missing actual workflow run ID');
  assert.match(expected.runAttempt ?? '', /^[1-9][0-9]*$/, 'Missing actual workflow attempt');
  assert.equal(manifest.sourceSha, expected.sha, 'Bootstrap source SHA drift');
  assert.equal(manifest.expectedSha, expected.sha, 'Bootstrap expected SHA drift');
  assert.equal(manifest.runId, expected.runId, 'Bootstrap receipt belongs to another run');
  assert.equal(manifest.runAttempt, expected.runAttempt, 'Bootstrap receipt attempt drift');
  assert.equal(manifest.status, 'passed', 'Bootstrap manifest did not finish successfully');
  assert.equal(manifest.workflowStatus, 'success', 'Bootstrap producer or cleanup failed');
  assert.equal(manifest.startupError, undefined, 'Bootstrap startup failed');
  assert.equal(manifest.route, '/en/test/bootstrap-state-controls/');
  assert.deepEqual(manifest.runtimes, runtimes);
  assert.deepEqual(manifest.themes, themes);
  assert.deepEqual(manifest.pageErrors, [], 'Bootstrap page errors remain');
  assert.deepEqual(
    manifest.results.map((result) => result.name).sort(),
    [...BOOTSTRAP_BROWSER_CASES].sort(),
    'Every original browser journey and composition combination must appear exactly once'
  );
  for (const result of manifest.results) {
    assert.equal(result.status, 'pass', `Bootstrap journey did not pass: ${result.name}`);
    assert.deepEqual(result.errors, [], `Bootstrap journey retained errors: ${result.name}`);
  }

  // Reuse the shared strict browser report gate: no skipped, todo, failed or
  // missing suites, including all original supporting tests and the shared composition oracle.
  assertVitestReport(
    report,
    { phase: 'browser', suites: BOOTSTRAP_EVIDENCE_SUITES },
    expected.root
  );
  const browser = report.testResults.find(
    (result) =>
      path.relative(expected.root, result.name).replaceAll('\\', '/') === BOOTSTRAP_BROWSER_SUITE
  );
  assert.deepEqual(
    browser.assertionResults.map((result) => result.title).sort(),
    [...BOOTSTRAP_BROWSER_CASES].sort(),
    'Vitest must execute all original and composition Bootstrap browser journeys'
  );
  assert.equal(
    report.numTotalTests,
    report.testResults.reduce((total, result) => total + result.assertionResults.length, 0),
    'Vitest total assertion count disagrees with its results'
  );
  return {
    browserCases: browser.assertionResults.length,
    selectedSuites: report.testResults.length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.env.PROTO_UI_BOOTSTRAP_EVIDENCE_DIR;
  let validation;
  try {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Require the actual Actions execution owner');
    assert.ok(directory, 'Missing Bootstrap evidence directory');
    const root = process.cwd();
    const expected = {
      root,
      sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    };
    assert.equal(expected.sha, process.env.PROTO_UI_EXPECTED_HEAD_SHA, 'Checkout SHA drift');
    assert.equal(
      execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
        encoding: 'utf8',
      }).trim(),
      '',
      'Bootstrap source changed during execution'
    );
    const read = (name) => JSON.parse(readFileSync(path.join(directory, name), 'utf8'));
    const result = assertBootstrapEvidence(
      { manifest: read('manifest.json'), report: read('vitest.json') },
      expected
    );
    validation = {
      ok: true,
      sourceSha: expected.sha,
      runId: expected.runId,
      runAttempt: expected.runAttempt,
      ...result,
    };
  } catch (error) {
    validation = { ok: false, error: String(error) };
    process.exitCode = 1;
  }
  if (directory) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      path.join(directory, 'validation.json'),
      JSON.stringify(validation, null, 2) + '\n'
    );
  }
  console.log(JSON.stringify(validation));
}
