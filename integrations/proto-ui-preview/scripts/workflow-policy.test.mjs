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
const upload = await readFile(new URL('./upload-poppy-artifact.mjs', import.meta.url), 'utf8');
const fallbackPrepare = await readFile(
  new URL('./prepare-fallback-artifact.mjs', import.meta.url),
  'utf8'
);
const sticky = await readFile(new URL('./sticky-comment.mjs', import.meta.url), 'utf8');
const security = await readFile(
  new URL('../.github/workflows/poppy-preview-security.yml', import.meta.url),
  'utf8'
);

test('Poppy revokes the previous ready state before Cloudflare publication', () => {
  const deployStart = workflow.indexOf('  deploy:');
  const deployWorkflow = workflow.slice(deployStart);
  const buildingStart = deployWorkflow.indexOf(
    '- name: Mark the current head as building in Poppy'
  );
  const downloadStart = deployWorkflow.indexOf('- name: Download only the verified artifact');
  assert.ok(buildingStart > 0 && downloadStart > buildingStart);
  const buildingStep = deployWorkflow.slice(buildingStart, downloadStart);
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
  assert.doesNotMatch(bootstrap, /^  workflow_dispatch:/m);
  assert.match(bootstrap, /POST \/repos\/\{owner\}\/\{repo\}\/dispatches/);
  assert.match(bootstrap, /event_type: "poppy_preview_build_completed"/);
  assert.match(workflow, /repository_dispatch:\s+types: \[poppy_preview_build_completed\]/);
  assert.doesNotMatch(workflow, /^  workflow_dispatch:/m);
  assert.match(workflow, /context\.payload\.client_payload\?\.build_run_id/);
  assert.doesNotMatch(workflow, /context\.payload\.inputs\?\.build_run_id/);
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

test('Cloudflare mutation kill switch gates deployment and selects the dcbot fallback', () => {
  assert.match(
    workflow,
    /deploy:[\s\S]*if: needs\.resolve-deploy\.outputs\.pr != '' && vars\.POPPY_CLOUDFLARE_MUTATIONS_ENABLED == 'true'/
  );
  assert.match(close, /cleanup:[\s\S]*if: vars\.POPPY_CLOUDFLARE_MUTATIONS_ENABLED == 'true'/);
  assert.match(workflow, /fallback-upload:[\s\S]*vars\.POPPY_PREVIEW_FALLBACK_ORIGIN != ''/);
  assert.match(workflow, /fallback-unavailable:[\s\S]*vars\.POPPY_PREVIEW_FALLBACK_ORIGIN == ''/);
  assert.match(upload, /new URL\(['"]\/api\/preview\/deployments['"]/);
  for (const file of ['_worker.js', '_routes.json', '_headers', '_redirects', '.assetsignore']) {
    assert.match(fallbackPrepare, new RegExp(`['"]${file.replace('.', '\\.')}['"]`));
  }
  assert.match(workflow, /PREVIEW_ORIGIN: \$\{\{ vars\.POPPY_PREVIEW_FALLBACK_ORIGIN \}\}/);
  assert.match(workflow, /POPPY_PREVIEW_FALLBACK_MODE: 'true'/);
  assert.match(upload, /X-Poppy-Preview-Head-SHA/);
});

test('close always reports closed to Poppy while Cloudflare deletion is gated', () => {
  assert.match(close, /Report the closed deployment to Poppy/);
  assert.match(close, /run: node integrations\/proto-ui-preview\/scripts\/report\.mjs closed/);
  assert.match(close, /cleanup:[\s\S]*if: vars\.POPPY_CLOUDFLARE_MUTATIONS_ENABLED == 'true'/);
  assert.match(close, /fallback-closed/);
});

test('every permitted Cloudflare mutation process receives the exact reviewed switch', () => {
  const ensure = workflow.slice(
    workflow.indexOf('- name: Create or reuse the per-PR Pages project'),
    workflow.indexOf('- name: Install integrity-locked trusted deployment tooling')
  );
  const remove = close.slice(
    close.indexOf('- name: Delete all preview resources for the PR'),
    close.indexOf('- name: Report the closed deployment to Poppy')
  );
  for (const step of [ensure, remove]) {
    assert.match(
      step,
      /POPPY_CLOUDFLARE_MUTATIONS_ENABLED: \$\{\{ vars\.POPPY_CLOUDFLARE_MUTATIONS_ENABLED \}\}/
    );
  }
});

test('fallback sanitizes into a trusted tree before archiving and enforces receiver limits', () => {
  const fallback = workflow.slice(
    workflow.indexOf('  fallback-upload:'),
    workflow.indexOf('  fallback-unavailable:')
  );
  assert.match(fallback, /prepare-fallback-artifact\.mjs/);
  assert.doesNotMatch(fallback, /tar[^\n]*-C \.poppy\/artifact/);
  assert.match(fallbackPrepare, /maxFiles:\s*20_000/);
  assert.match(fallbackPrepare, /maxFileBytes:\s*25 \* 1024 \* 1024/);
  assert.match(fallbackPrepare, /maxExpandedBytes:\s*100 \* 1024 \* 1024/);
  assert.match(fallbackPrepare, /maxCompressedBytes:\s*50 \* 1024 \* 1024/);
  assert.match(fallbackPrepare, /isSymbolicLink/);
  assert.match(fallbackPrepare, /isFile/);
  assert.match(fallbackPrepare, /reserved platform file/);
});

test('fallback Ready uses the deployment ID emitted by an exact handler acknowledgement', () => {
  assert.match(workflow, /id: upload[\s\S]*upload-poppy-artifact\.mjs/);
  assert.match(
    workflow,
    /PREVIEW_DEPLOYMENT_ID: \$\{\{ steps\.upload\.outputs\.deployment_id \}\}/
  );
  assert.match(workflow, /PREVIEW_REPOSITORY: \$\{\{ github\.repository \}\}/);
  assert.match(upload, /X-Poppy-Preview-Repository/);
  assert.match(upload, /acknowledgement does not match/);
  assert.match(upload, /deployment_id=/);
});

test('every fallback failure after Building converges to Failed, sticky state, and job failure', () => {
  const fallback = workflow.slice(
    workflow.indexOf('  fallback-upload:'),
    workflow.indexOf('  fallback-unavailable:')
  );
  for (const id of [
    'live',
    'building',
    'download',
    'archive',
    'upload',
    'ready',
    'failed',
    'comment',
  ]) {
    assert.match(fallback, new RegExp(`id: ${id}`));
  }
  assert.match(
    fallback,
    /always\(\)[\s\S]*steps\.live\.outcome == 'success'[\s\S]*steps\.ready\.outcome != 'success'[\s\S]*report\.mjs failed/
  );
  assert.match(fallback, /id: comment\s+if: always\(\) && steps\.live\.outcome == 'success'/);
  assert.match(
    fallback,
    /PREVIEW_STATUS: \$\{\{ steps\.ready\.outcome == 'success' && 'ready' \|\| 'failed' \}\}/
  );
  assert.match(fallback, /Fail the fallback job when publication did not converge/);
  for (const failedStep of ['download', 'archive', 'upload', 'ready', 'failed', 'comment']) {
    assert.match(fallback, new RegExp(`steps\\.${failedStep}\\.outcome != 'success'`));
  }

  const shouldReportFailed = (outcomes) =>
    outcomes.live === 'success' && outcomes.ready !== 'success';
  const shouldWriteComment = (outcomes) => outcomes.live === 'success';
  const shouldFailJob = (outcomes) =>
    ['live', 'building', 'download', 'archive', 'upload', 'ready', 'comment'].some(
      (step) => outcomes[step] !== 'success'
    ) ||
    (outcomes.ready !== 'success' && outcomes.failed !== 'success');

  const success = Object.fromEntries(
    ['live', 'building', 'download', 'archive', 'upload', 'ready', 'comment'].map((step) => [
      step,
      'success',
    ])
  );
  success.failed = 'skipped';
  assert.equal(shouldReportFailed(success), false);
  assert.equal(shouldWriteComment(success), true);
  assert.equal(shouldFailJob(success), false);

  const publicationSteps = ['building', 'download', 'archive', 'upload', 'ready'];
  for (const [failureIndex, boundary] of publicationSteps.entries()) {
    const injected = { ...success, failed: 'success' };
    for (const skipped of publicationSteps.slice(failureIndex + 1)) injected[skipped] = 'skipped';
    injected[boundary] = 'failure';
    assert.equal(shouldReportFailed(injected), true, `${boundary} must trigger Failed`);
    assert.equal(shouldWriteComment(injected), true, `${boundary} must update the sticky state`);
    assert.equal(shouldFailJob(injected), true, `${boundary} must leave the job failed`);
  }

  const failedConvergence = {
    ...success,
    ready: 'failure',
    failed: 'failure',
  };
  assert.equal(shouldFailJob(failedConvergence), true, 'a rejected Failed report must fail closed');

  const failedComment = { ...success, comment: 'failure' };
  assert.equal(
    shouldFailJob(failedComment),
    true,
    'a stale or rejected sticky write must fail closed'
  );
});

test('fallback lifecycle writers use one configured dcbot control plane', () => {
  const fallbackOrigin = 'POPPY_CONTROL_PLANE: ${{ vars.POPPY_PREVIEW_FALLBACK_ORIGIN }}';
  const fallback = workflow.slice(
    workflow.indexOf('  fallback-upload:'),
    workflow.indexOf('  fallback-unavailable:')
  );
  assert.equal(
    fallback.split(fallbackOrigin).length - 1,
    4,
    'Building, artifact upload, Ready, and Failed must use the same fallback origin'
  );

  const selectedControlPlane =
    "POPPY_CONTROL_PLANE: ${{ vars.POPPY_CLOUDFLARE_MUTATIONS_ENABLED != 'true' && vars.POPPY_PREVIEW_FALLBACK_ORIGIN != '' && vars.POPPY_PREVIEW_FALLBACK_ORIGIN || 'https://poppy-proto-ui.chenyejin2004.workers.dev' }}";
  const failedBuild = workflow.slice(
    workflow.indexOf('  report-failed-build:'),
    workflow.indexOf('  fallback-upload:')
  );
  assert.match(
    failedBuild,
    new RegExp(selectedControlPlane.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
  assert.match(close, new RegExp(selectedControlPlane.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('all fallback comment writers serialize per PR and the writer rechecks live state', () => {
  for (const [start, end] of [
    ['  fallback-upload:', '  fallback-unavailable:'],
    ['  fallback-unavailable:', '  deploy:'],
  ]) {
    const job = workflow.slice(workflow.indexOf(start), workflow.indexOf(end));
    assert.match(job, /group: poppy-preview-pr-\$\{\{ needs\.resolve-deploy\.outputs\.pr \}\}/);
    assert.match(job, /cancel-in-progress: false/);
  }
  const commentsCollected = sticky.indexOf('const matches = ownedMarkerComments');
  const liveRecheck = sticky.indexOf('await github(`/pulls/${pr}`)');
  const firstMutation = sticky.indexOf("method: 'POST'");
  assert.ok(
    commentsCollected >= 0 && liveRecheck > commentsCollected && firstMutation > liveRecheck
  );
  assert.match(sticky, /pullRequest\?\.state !== expectedState/);
  assert.match(sticky, /pullRequest\?\.head\?\.sha !== headSHA/);
});

test('close revocation targets the active fallback control plane and is mandatory in both modes', () => {
  const revoke = close.slice(
    close.indexOf('- name: Report the closed deployment to Poppy'),
    close.indexOf('- name: Maintain the sticky PR comment')
  );
  assert.match(revoke, /POPPY_PREVIEW_FALLBACK_ORIGIN/);
  assert.match(
    close,
    /steps\.revoke\.outcome != 'success' \|\|\s*\(vars\.POPPY_CLOUDFLARE_MUTATIONS_ENABLED == 'true' && steps\.cleanup\.outcome != 'success'\)/
  );

  const cleanupFails = ({ cloudflareEnabled, cleanup, revoke }) =>
    revoke !== 'success' || (cloudflareEnabled && cleanup !== 'success');
  assert.equal(
    cleanupFails({ cloudflareEnabled: false, cleanup: 'skipped', revoke: 'failure' }),
    true,
    'Closed rejection must fail while Cloudflare is disabled'
  );
  assert.equal(
    cleanupFails({ cloudflareEnabled: false, cleanup: 'skipped', revoke: 'success' }),
    false
  );
  assert.equal(
    cleanupFails({ cloudflareEnabled: true, cleanup: 'failure', revoke: 'success' }),
    true,
    'Cloudflare deletion failure must remain fatal while it is enabled'
  );
});

test('security CI checks the immutable dcbot handler source and runs its real preview tests', () => {
  assert.match(security, /repository: Proto-UI\/dcbot/);
  assert.match(security, /ref: 3f60a2b41832a0b02e64a0f4b8bf237355b59806/);
  assert.match(security, /DCBOT_CONTRACT_ROOT/);
  assert.match(security, /go test \.\/internal\/preview/);
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
