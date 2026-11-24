import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import YAML from 'yaml';

test('focused public browser evidence disables only the supported Astro developer toolbar before tests', () => {
  const workflow = YAML.parse(
    readFileSync('.github/workflows/browser-suite-repair-evidence.yml', 'utf8')
  );
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const steps = workflow.jobs['focused-browser'].steps;
  const setup = steps.findIndex((step) =>
    step.run?.includes('astro preferences disable devToolbar')
  );
  const execute = steps.findIndex(
    (step) => step.name === 'Exercise unchanged controls with failure diagnostics'
  );
  assert.ok(
    setup >= 0 && setup < execute,
    'The official preference must be set before launching the browser suite.'
  );
  assert.match(
    steps[setup].run,
    /--filter apps-www exec astro preferences get devToolbar\.enabled/
  );
  assert.doesNotMatch(
    steps[execute].run,
    /force\s*:\s*true|pointer-events|astro-dev-toolbar.*remove/
  );
  assert.match(steps[execute].run, /demo-base-image\.browser\.test\.ts/);
  assert.equal(
    steps.find((step) => step.uses === 'actions/checkout@v4').with['persist-credentials'],
    false
  );
});

test('repair retains its original suites and captures all Neo Input journeys within the same owner', () => {
  const workflow = YAML.parse(
    readFileSync('.github/workflows/browser-suite-repair-evidence.yml', 'utf8')
  );
  const job = workflow.jobs['focused-browser'];
  const execute = job.steps.find(
    (step) => step.name === 'Exercise unchanged controls with failure diagnostics'
  );
  const upload = job.steps.find((step) => step.uses === 'actions/upload-artifact@v4');
  assert.equal(job['timeout-minutes'], 10);
  assert.equal(job['continue-on-error'], undefined);
  assert.equal(execute['continue-on-error'], undefined);
  assert.equal(execute['timeout-minutes'], undefined);
  assert.deepEqual(execute.run.match(/(?:apps|packages)\/[^\s\\]+\.browser\.test\.ts/g), [
    'apps/www/src/content/docs/zh-cn/demo-base-image.browser.test.ts',
    'apps/www/src/content/docs/zh-cn/scroll-end-follow.browser.test.ts',
    'apps/www/test/evidence/brutalist-spinner.capture.browser.test.ts',
    'apps/www/src/content/docs/zh-cn/demo-brutalist-input.browser.test.ts',
  ]);
  assert.match(execute.run, /exec vitest run --no-file-parallelism/);
  assert.doesNotMatch(
    execute.run,
    /--(?:testNamePattern|testTimeout|hookTimeout|bail|retry|exclude)(?:=|\s|$)|(?:^|\s)-t(?:\s|$)/
  );
  assert.match(execute.run, /--reporter=default/);
  assert.match(execute.run, /--reporter=json/);
  assert.match(execute.run, /--outputFile="\$PROTO_UI_IMAGE_SCREENSHOT_DIR\/vitest\.json"/);
  const directory = execute.env.PROTO_UI_IMAGE_SCREENSHOT_DIR;
  assert.equal(
    execute.env.PROTO_UI_NEO_INPUT_EVIDENCE_DIR,
    `${directory}/neo-input`,
    'The real Input collector must write beneath the uploaded evidence root.'
  );
  assert.equal(upload.with.path, directory);
  assert.equal(upload.if, 'always()');
});
