import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import {
  inspectLiquidMaterialEvidence,
  requiredLiquidMaterialCases,
} from './check-liquid-material-evidence.mjs';

const filename = 'apps/www/src/content/docs/zh-cn/demo-liquid-glass-material.browser.test.ts';
function report(scope = 'material-library') {
  return {
    success: true,
    numFailedTests: 0,
    numFailedTestSuites: 0,
    testResults: [
      {
        name: `/candidate/${filename}`,
        assertionResults: requiredLiquidMaterialCases(scope).map((title) => ({
          title,
          status: 'passed',
        })),
      },
    ],
  };
}

test('the historical green public-only run does not cover omitted WIP conditions', () => {
  const result = report();
  result.testResults[0].assertionResults = result.testResults[0].assertionResults.filter((item) =>
    item.title.startsWith('the actual public Button')
  );
  const coverage = inspectLiquidMaterialEvidence(result, 'material-library');
  assert.equal(coverage.reportSuccessful, true);
  assert.equal(coverage.passed, false);
  assert.equal(coverage.cases.filter((item) => item.passed).length, 1);
  assert.equal(coverage.cases.filter((item) => item.occurrences === 0).length, 5);
});

test('missing, skipped, failed, duplicated and unfinished required cases each fail closed', () => {
  for (const scope of ['material-library', 'frame-budget-release']) {
    assert.equal(inspectLiquidMaterialEvidence(report(scope), scope).passed, true);
    for (let index = 0; index < requiredLiquidMaterialCases(scope).length; index++) {
      for (const status of ['pending', 'skipped', 'todo', 'failed', undefined]) {
        const result = report(scope);
        result.testResults[0].assertionResults[index].status = status;
        assert.equal(inspectLiquidMaterialEvidence(result, scope).passed, false);
      }
      const missing = report(scope);
      missing.testResults[0].assertionResults.splice(index, 1);
      assert.equal(inspectLiquidMaterialEvidence(missing, scope).passed, false);
      const duplicate = report(scope);
      duplicate.testResults[0].assertionResults.push(
        duplicate.testResults[0].assertionResults[index]
      );
      assert.equal(inspectLiquidMaterialEvidence(duplicate, scope).passed, false);
    }
  }
});

test('runtime or other suite failures, missing reports and wrong file identity cannot pass', () => {
  // The pinned Vitest 2.1.9 reporter omits numRuntimeErrorTestSuites.
  assert.equal(Object.hasOwn(report(), 'numRuntimeErrorTestSuites'), false);
  assert.equal(inspectLiquidMaterialEvidence(report(), 'material-library').passed, true);
  for (const key of ['numFailedTests', 'numFailedTestSuites', 'numRuntimeErrorTestSuites']) {
    const result = report();
    result[key] = 1;
    assert.equal(inspectLiquidMaterialEvidence(result, 'material-library').passed, false);
  }
  for (const result of [undefined, {}, { ...report(), success: false }])
    assert.equal(inspectLiquidMaterialEvidence(result, 'material-library').passed, false);
  const wrong = report();
  wrong.testResults[0].name = `/different-${filename}`;
  assert.equal(inspectLiquidMaterialEvidence(wrong, 'material-library').passed, false);
  const duplicated = report();
  duplicated.testResults.push(structuredClone(duplicated.testResults[0]));
  assert.equal(inspectLiquidMaterialEvidence(duplicated, 'material-library').passed, false);
});

test('the release selection excludes only the separate unselected diagnostic', () => {
  const result = report('frame-budget-release');
  result.testResults[0].assertionResults.push({
    title: requiredLiquidMaterialCases('material-library').at(-1),
    status: 'pending',
  });
  assert.equal(inspectLiquidMaterialEvidence(result, 'frame-budget-release').passed, true);
  assert.equal(inspectLiquidMaterialEvidence(result, 'material-library').passed, false);
  assert.throws(() => requiredLiquidMaterialCases(''), /Unknown Liquid evidence scope/);
});

test('dedicated evidence lanes opt in, retain JSON and always verify executed required cases', () => {
  const lanes = [
    ['liquid-material-evidence.yml', 'browser-evidence', 'material-library'],
    ['liquid-glass-frame-budget.yml', 'matched-browser', 'frame-budget-release'],
  ];
  for (const [workflow, job, scope] of lanes) {
    const steps = parse(readFileSync(`.github/workflows/${workflow}`, 'utf8')).jobs[job].steps;
    const execution = steps.find((step) => step.run?.includes(filename));
    assert.equal(execution?.env?.PUI_LIQUID_GLASS_INCLUDE_WIP, '1', workflow);
    assert.match(execution.run, /--reporter=json/);
    assert.match(execution.run, /--outputFile\.json=/);
    const verification = steps.find((step) =>
      step.run?.includes(`check-liquid-material-evidence.mjs`)
    );
    assert.equal(verification?.if, 'always()');
    assert.ok(steps.indexOf(verification) > steps.indexOf(execution));
    assert.ok(verification.run.includes(scope));
  }
});
