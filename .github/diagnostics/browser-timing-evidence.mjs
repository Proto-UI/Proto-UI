import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
export const runtimeRoot=process.cwd();
const manifest=JSON.parse(readFileSync(new URL('./browser-timing-manifest.json',import.meta.url),'utf8'));
export function ciContext(){const checkoutSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(checkoutSha,manifest.source);return {checkoutSha};}
export function runtimeSelection(phase,shard){assert.equal(phase,'browser');const match=/^([1-9][0-9]*)\/13$/.exec(shard??'');assert.ok(match);const group=manifest.groups[Number(match[1])-1];assert.ok(group);return {...ciContext(),phase,shard,suites:group.files};}
export function writeJson(file,value){mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(value,null,2)+'\n');}
export function assertVitestReport(report, selection, root = runtimeRoot) {
  assert.equal(report.success, true, 'Vitest must report success');
  assert.equal(report.numFailedTests, 0, 'Failed tests');
  assert.equal(report.numFailedTestSuites, 0, 'Failed suites');
  assert.ok(report.numPassedTests > 0, 'An empty or entirely skipped job cannot pass');
  const files = report.testResults.map((file) => ({
    ...file,
    name: path.relative(root, file.name).replaceAll('\\', '/'),
  }));
  assert.deepEqual(
    files.map((file) => file.name).sort(),
    [...selection.suites].sort(),
    'Executed suites must equal the selection exactly once'
  );
  let passed = 0;
  for (const file of files) {
    assert.equal(file.status, 'passed', `Suite failed: ${file.name}`);
    assert.ok(file.assertionResults.length > 0, `Empty suite: ${file.name}`);
    for (const test of file.assertionResults) {
      // General tests already contain explicitly authored todo coverage. Browser
      // shards have no skip/todo allowance: every selected browser test must run.
      assert.ok(
        (selection.phase === 'browser' ? ['passed'] : ['passed', 'todo', 'skipped']).includes(
          test.status
        ),
        `Unexpected ${test.status} test: ${file.name} ${test.fullName}`
      );
      if (test.status === 'passed') passed += 1;
    }
  }
  assert.equal(passed, report.numPassedTests, 'Passed assertion count disagrees with report');
}
