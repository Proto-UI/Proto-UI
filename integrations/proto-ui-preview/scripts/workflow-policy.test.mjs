import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(
  new URL('../.github/workflows/poppy-preview-deploy.yml', import.meta.url),
  'utf8'
).catch(() =>
  readFile(new URL('../../../.github/workflows/poppy-preview-deploy.yml', import.meta.url), 'utf8')
);
const bootstrap = await readFile(
  new URL('../.github/workflows/poppy-preview-bootstrap.yml', import.meta.url),
  'utf8'
).catch(() =>
  readFile(
    new URL('../../../.github/workflows/poppy-preview-bootstrap.yml', import.meta.url),
    'utf8'
  )
);
const close = await readFile(
  new URL('../.github/workflows/poppy-preview-close.yml', import.meta.url),
  'utf8'
).catch(() =>
  readFile(new URL('../../../.github/workflows/poppy-preview-close.yml', import.meta.url), 'utf8')
);
const build = await readFile(
  new URL('../.github/workflows/poppy-preview-build.yml', import.meta.url),
  'utf8'
).catch(() =>
  readFile(new URL('../../../.github/workflows/poppy-preview-build.yml', import.meta.url), 'utf8')
);

test('Poppy revokes the previous ready state before Cloudflare publication', () => {
  const buildingStart = workflow.indexOf('- name: Mark the current head as building in Poppy');
  const downloadStart = workflow.indexOf('- name: Download only the verified artifact');
  assert.ok(buildingStart > 0 && downloadStart > buildingStart);
  const buildingStep = workflow.slice(buildingStart, downloadStart);
  assert.doesNotMatch(buildingStep, /continue-on-error:\s*true/);
  assert.match(buildingStep, /report\.mjs building/);
});

test('a ready-report failure cannot produce a Ready card or successful workflow', () => {
  assert.match(workflow, /- name: Report the ready deployment to Poppy\s+id: ready/);
  assert.match(
    workflow,
    /PREVIEW_STATUS: \$\{\{ steps\.ready\.outcome == 'success' && 'ready' \|\| 'failed' \}\}/
  );
  const readyFailureChecks = workflow.match(/steps\.ready\.outcome != 'success'/g) ?? [];
  assert.ok(
    readyFailureChecks.length >= 2,
    'failed-report and terminal workflow gates must both include the ready outcome'
  );
});

test('the trusted Worker is bound to the exact workflow run tuple', () => {
  for (const argument of ['--head-sha', '--run-id', '--run-attempt']) {
    assert.match(workflow, new RegExp(argument));
  }
});

test('the secret-bearing deploy installs only production dependencies', () => {
  assert.match(
    workflow,
    /npm ci --prefix integrations\/proto-ui-preview --omit=dev --ignore-scripts/
  );
});

test('trusted installation bootstraps every already-open or draft PR', () => {
  assert.match(bootstrap, /push:\s+branches: \[main\]/);
  assert.match(bootstrap, /state: "open"/);
  assert.match(bootstrap, /github\.paginate\(github\.rest\.pulls\.list/);
  assert.match(bootstrap, /workflow_id: "poppy-preview-build\.yml"/);
  assert.match(bootstrap, /inputs: \{[\s\S]*pr_number: String\(pull\.number\)/);
  assert.match(bootstrap, /expected_head_sha: pull\.head\.sha/);
  assert.doesNotMatch(bootstrap, /\$\{\{\s*secrets\./);
});

test('failed trusted dispatches revoke only their immutable live head', () => {
  assert.match(build, /expected_head_sha:[\s\S]*required: true/);
  assert.match(build, /pr\.head\.sha !== expectedHead/);
  assert.match(
    build,
    /name: poppy-preview-binding-\$\{\{ steps\.pr\.outputs\.number \}\}-\$\{\{ steps\.pr\.outputs\.sha \}\}-\$\{\{ github\.run_attempt \}\}/
  );
  assert.ok(
    build.indexOf('- name: Upload the immutable build binding') <
      build.indexOf('- name: Check out the exact pull request head'),
    'binding must exist before pull-request code executes'
  );
  assert.match(
    workflow,
    /report-failed-build:[\s\S]*github\.event\.workflow_run\.event == 'workflow_dispatch'/
  );
  assert.match(
    workflow,
    /poppy-preview-binding-\(\[1-9\]\[0-9\]\*\)-\(\[0-9a-f\]\{40\}\)-\(\[1-9\]\[0-9\]\*\)/
  );
  assert.match(workflow, /pr\.head\.sha !== candidate\.sha/);
});

test('deployment and close serialize on an API-derived PR key', () => {
  assert.doesNotMatch(workflow, /^concurrency:/m);
  assert.match(
    workflow,
    /resolve-deploy:[\s\S]*outputs:\s+pr: \$\{\{ steps\.resolve\.outputs\.pr \}\}/
  );
  assert.match(workflow, /workflow\.path !== "\.github\/workflows\/poppy-preview-build\.yml"/);
  assert.match(
    workflow,
    /deploy:[\s\S]*needs: resolve-deploy[\s\S]*group: poppy-preview-pr-\$\{\{ needs\.resolve-deploy\.outputs\.pr \}\}[\s\S]*cancel-in-progress: false/
  );
  assert.match(
    close,
    /^concurrency:\s+group: poppy-preview-pr-\$\{\{ github\.event\.pull_request\.number \}\}\s+cancel-in-progress: true/m
  );
  assert.doesNotMatch(workflow, /group:.*display_title/);
  assert.doesNotMatch(close, /display_title/);
});

test('installed workflows remain byte-identical to reviewed templates', async (t) => {
  const names = [
    'poppy-preview-bootstrap.yml',
    'poppy-preview-build.yml',
    'poppy-preview-close.yml',
    'poppy-preview-deploy.yml',
    'poppy-preview-security.yml',
  ];
  const repositoryRoot = new URL('../../../.github/workflows/', import.meta.url);
  const installed = await readFile(new URL(names[0], repositoryRoot), 'utf8').catch(() => null);
  if (installed === null) {
    t.skip('integration source repository has no installed workflow copies');
    return;
  }
  for (const name of names) {
    const template = await readFile(
      new URL(`../.github/workflows/${name}`, import.meta.url),
      'utf8'
    );
    const root = await readFile(new URL(name, repositoryRoot), 'utf8');
    assert.equal(root, template, `${name} drifted from its reviewed template`);
  }
});
