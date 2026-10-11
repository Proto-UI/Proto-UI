import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const FIELD_SUITE = 'apps/www/src/content/docs/zh-cn/demo-field-family.browser.test.ts';
export const FIELD_FAMILIES = ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'];
export const FIELD_RUNTIMES = ['wc', 'react', 'vue', 'vue2'];
export const FIELD_CASE_TITLES = [
  ...FIELD_FAMILIES.flatMap((family) =>
    FIELD_RUNTIMES.map(
      (runtime) =>
        `${family} ${runtime} labels, native editing, validity lease, focus and screenshots`
    )
  ),
  ...FIELD_FAMILIES.map((family) => `${family} Chinese public route consumes the same six atoms`),
];

export function assertFieldReport(report) {
  assert.equal(report.success, true);
  for (const key of ['numTotalTests', 'numPassedTests']) assert.equal(report[key], 25, key);
  for (const key of [
    'numFailedTests',
    'numPendingTests',
    'numTodoTests',
    'numFailedTestSuites',
    'numPendingTestSuites',
  ])
    assert.equal(report[key], 0, key);
  assert.equal(report.testResults.length, 1, 'Exactly the unchanged Field suite must execute');
  const file = report.testResults[0];
  const normalized = file.name.replaceAll('\\', '/');
  assert.ok(
    normalized === FIELD_SUITE || normalized.endsWith(`/${FIELD_SUITE}`),
    'Wrong test file'
  );
  assert.equal(file.status, 'passed');
  assert.equal(file.assertionResults.length, 25);
  for (const test of file.assertionResults)
    assert.equal(test.status, 'passed', test.fullName ?? test.title);
  assert.deepEqual(
    file.assertionResults.map((test) => test.title).sort(),
    [...FIELD_CASE_TITLES].sort(),
    'Every family/runtime and Chinese case must execute exactly once'
  );
}

export function sourceBinding(candidateSha, git, outcome = 'unknown') {
  return {
    candidateSha,
    checkoutSha: git(['rev-parse', 'HEAD']).trim(),
    sourceTree: git(['rev-parse', 'HEAD^{tree}']).trim(),
    sourceDirty: git(['status', '--porcelain']).trim().length > 0,
    outcome,
  };
}
export function assertSourceBinding(binding) {
  for (const key of ['candidateSha', 'checkoutSha', 'sourceTree'])
    assert.match(binding[key], /^[a-f0-9]{40}$/);
  assert.equal(
    binding.checkoutSha,
    binding.candidateSha,
    'Actual checkout must equal requested exact head'
  );
  assert.equal(binding.sourceDirty, false, 'Dirty source cannot be admitted as the committed head');
}
export function writeSourceBinding(file, binding) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(binding, null, 2)}\n`, { flag: 'wx' });
  // Persist the observed mismatch/dirty state before rejecting it.
  assertSourceBinding(binding);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, file, candidateSha] = process.argv.slice(2);
  assert.ok(file, 'Evidence path is required');
  if (command === 'check') assertFieldReport(JSON.parse(fs.readFileSync(file, 'utf8')));
  else if (command === 'source')
    writeSourceBinding(
      file,
      sourceBinding(
        candidateSha,
        (args) => execFileSync('git', args, { encoding: 'utf8' }),
        process.env.FIELD_RUN_OUTCOME
      )
    );
  else throw new Error('Expected check or source');
}
