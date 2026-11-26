node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const directory = process.env.CONTENTS_WHEEL_EVIDENCE_DIR;
const plans = [
  { id: 'controls', file: 'apps/www/src/content/docs/zh-cn/contents-wheel-evidence.browser.test.ts', titles: [
    'preserves native cancellation=false and current dialog identity',
    'preserves native cancellation=true and current dialog identity',
  ] },
  { id: 'popover', file: 'apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts', titles: [
    'uses real family Popover Triggers through all four Docs runtimes with keyboard and exact-source visual evidence',
  ] },
];
const results = plans.map((plan) => {
  try {
    const report = JSON.parse(readFileSync(path.join(directory, `${plan.id}-vitest.json`), 'utf8'));
    const suites = report.testResults ?? [];
    const assertions = suites.flatMap((suite) => suite.assertionResults ?? []);
    const selected = assertions.filter((test) => plan.titles.includes(test.title));
    const executed = assertions.filter((test) => ['passed', 'failed'].includes(test.status));
    const exactScope = suites.length === 1 && suites[0].name === path.resolve(plan.file)
      && plan.titles.every((title) => selected.filter((test) => test.title === title).length === 1)
      && selected.every((test) => ['passed', 'failed'].includes(test.status))
      && executed.length === plan.titles.length;
    return { ...plan, exactScope, passed: exactScope && report.success === true && selected.every((test) => test.status === 'passed'),
      collected: assertions.length, executed: executed.length,
      skipped: assertions.filter((test) => !['passed', 'failed'].includes(test.status)).length,
      selected: selected.map(({ title, fullName, status, failureMessages }) => ({ title, fullName, status, failureMessages })) };
  } catch (error) { return { ...plan, exactScope: false, passed: false, error: String(error) }; }
});
let generatedEvidence;
try {
  const after = JSON.parse(readFileSync(path.join(directory, 'afterTest.json'), 'utf8'));
  generatedEvidence = { complete: after.generatedFiles.length === 5
    && after.generatedFiles.every((file) => !file.error && /^[a-f0-9]{64}$/.test(file.sha256)),
    files: after.generatedFiles };
} catch (error) { generatedEvidence = { complete: false, error: String(error) }; }
writeFileSync(path.join(directory, 'selection-results.json'), JSON.stringify({
  expectedSha: process.env.CANDIDATE_SHA,
  scope: 'Two authored native oracle controls and one original public Popover matrix; not complete homepage or CI acceptance',
  results, generatedEvidence,
}, null, 2) + '\n');
if (results.some((result) => !result.passed) || !generatedEvidence.complete) process.exitCode = 1;
JS
