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
const extract = await readFile(new URL('./extract-fallback-artifact.mjs', import.meta.url), 'utf8');
const security = await readFile(
  new URL('../.github/workflows/poppy-preview-security.yml', import.meta.url),
  'utf8'
);

test('failed builds revoke both possible control planes regardless of the current mutation mode', () => {
  const failed = workflow.slice(
    workflow.indexOf('  report-failed-build:'),
    workflow.indexOf('  fallback-upload:')
  );
  const central = failed.slice(
    failed.indexOf('- name: Revoke the failed head on the central Poppy control plane'),
    failed.indexOf('- name: Revoke the failed head on the configured fallback control plane')
  );
  const fallback = failed.slice(
    failed.indexOf('- name: Revoke the failed head on the configured fallback control plane'),
    failed.indexOf('- name: Maintain the sticky failure comment')
  );
  assert.match(central, /id: revoke-central/);
  assert.match(central, /continue-on-error: true/);
  assert.match(
    central,
    /POPPY_CONTROL_PLANE: https:\/\/poppy-proto-ui\.chenyejin2004\.workers\.dev/
  );
  assert.match(central, /if:.*steps\.resolve\.outputs\.report == 'true'/);
  assert.doesNotMatch(central, /CLOUDFLARE_MUTATIONS_ENABLED/);
  assert.match(fallback, /id: revoke-fallback/);
  assert.match(fallback, /continue-on-error: true/);
  assert.match(
    fallback,
    /if:.*always\(\).*steps\.resolve\.outputs\.report == 'true'.*POPPY_PREVIEW_FALLBACK_ORIGIN != ''/
  );
  assert.match(fallback, /POPPY_CONTROL_PLANE: \$\{\{ vars\.POPPY_PREVIEW_FALLBACK_ORIGIN \}\}/);
  assert.match(fallback, /POPPY_PREVIEW_FALLBACK_MODE: 'true'/);
  assert.doesNotMatch(fallback, /CLOUDFLARE_MUTATIONS_ENABLED/);
  for (const step of [central, fallback]) {
    assert.match(step, /PREVIEW_SHA: \$\{\{ steps\.resolve\.outputs\.head_sha \}\}/);
    assert.match(step, /PREVIEW_RUN_ID: \$\{\{ steps\.resolve\.outputs\.run_id \}\}/);
    assert.match(step, /PREVIEW_RUN_ATTEMPT: \$\{\{ steps\.resolve\.outputs\.run_attempt \}\}/);
    assert.match(step, /report\.mjs failed/);
  }
  assert.match(
    failed,
    /always\(\).*steps\.resolve\.outputs\.report == 'true'.*steps\.revoke-central\.outcome != 'success'.*steps\.revoke-fallback\.outcome != 'success'/
  );
});

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
  assert.match(
    close,
    /cleanup:[\s\S]*if: steps\.live\.outputs\.cleanup == 'true' && vars\.POPPY_CLOUDFLARE_MUTATIONS_ENABLED == 'true'/
  );
  assert.match(workflow, /fallback-upload:[\s\S]*vars\.POPPY_PREVIEW_FALLBACK_ORIGIN != ''/);
  assert.match(workflow, /fallback-unavailable:[\s\S]*vars\.POPPY_PREVIEW_FALLBACK_ORIGIN == ''/);
  assert.match(upload, /new URL\(['"]\/api\/preview\/deployments['"]/);
  for (const file of ['_worker.js', '_routes.json', '_headers', '_redirects', '.assetsignore']) {
    assert.match(fallbackPrepare, new RegExp(`['"]${file.replace('.', '\\.')}['"]`));
  }
  assert.match(workflow, /PREVIEW_ORIGIN: \$\{\{ vars\.POPPY_PREVIEW_FALLBACK_CONTENT_ORIGIN \}\}/);
  assert.match(workflow, /POPPY_PREVIEW_FALLBACK_MODE: 'true'/);
  assert.match(upload, /X-Poppy-Preview-Head-SHA/);
});
test('fallback publication requires a separate untrusted content origin', async () => {
  assert.match(
    workflow,
    /fallback-upload:[\s\S]*POPPY_PREVIEW_FALLBACK_CONTENT_ORIGIN != ''[\s\S]*POPPY_PREVIEW_FALLBACK_CONTENT_ORIGIN != vars\.POPPY_PREVIEW_FALLBACK_ORIGIN/
  );
  assert.match(
    workflow,
    /fallback-unavailable:[\s\S]*POPPY_PREVIEW_FALLBACK_CONTENT_ORIGIN == ''[\s\S]*POPPY_PREVIEW_FALLBACK_CONTENT_ORIGIN == vars\.POPPY_PREVIEW_FALLBACK_ORIGIN/
  );
  assert.match(fallbackPrepare, /maxCompressedBytes:\s*50 \* 1024 \* 1024/);
  assert.match(sticky, /fallback preview origin must be an HTTPS origin/);
  assert.match(
    await readFile(new URL('./report.mjs', import.meta.url), 'utf8'),
    /fallback preview origin must be an HTTPS origin isolated from the control plane/
  );
});

test('eligible close reports to Poppy while Cloudflare deletion remains gated', () => {
  assert.match(close, /Report the closed deployment to the central Poppy control plane/);
  assert.match(close, /Report the closed deployment to the configured fallback control plane/);
  assert.equal((close.match(/report\.mjs closed/g) ?? []).length, 2);
  assert.match(
    close,
    /cleanup:[\s\S]*if: steps\.live\.outputs\.cleanup == 'true' && vars\.POPPY_CLOUDFLARE_MUTATIONS_ENABLED == 'true'/
  );
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
test('fallback rejects oversized artifacts before download extraction', () => {
  const fallback = workflow.slice(
    workflow.indexOf('  fallback-upload:'),
    workflow.indexOf('  fallback-unavailable:')
  );
  assert.match(workflow, /artifact_size: \$\{\{ steps\.resolve\.outputs\.artifact_size \}\}/);
  assert.match(
    fallback,
    /id: size[\s\S]*ARTIFACT_SIZE: \$\{\{ needs\.resolve-deploy\.outputs\.artifact_size \}\}/
  );
  assert.match(fallback, /50 \* 1024 \* 1024/);
  assert.match(fallback, /id: download[\s\S]*if: steps\.building\.outcome == 'success'/);
  assert.match(fallback, /steps\.size\.outcome != 'success'/);
});

test('fallback download uses bounded extraction instead of an unbounded archive action', () => {
  const fallback = workflow.slice(
    workflow.indexOf('  fallback-upload:'),
    workflow.indexOf('  fallback-unavailable:')
  );
  assert.doesNotMatch(fallback, /actions\/download-artifact/);
  assert.match(fallback, /id: download[\s\S]*extract-fallback-artifact\.mjs/);
  assert.match(extract, /does not belong to the verified workflow run/);
  assert.match(extract, /artifact stream exceeded the 50 MiB compressed envelope/);
  assert.match(extract, /redirect: 'manual'/);
  assert.match(extract, /link or special file/);
  assert.match(extract, /unsafe path segment/);
  assert.match(extract, /maxOutputLength: limits\.maxFileBytes \+ 1/);
  assert.match(extract, /expanded beyond its recorded size/);
  const listed = extract.indexOf('export function listBoundedEntries');
  const inflate = extract.indexOf('inflateRawSync(');
  assert.ok(listed > 0 && inflate > listed, 'central-directory bounds run before any inflation');
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

test('the Ready write is revalidated against the live head after the upload', () => {
  const fallback = workflow.slice(
    workflow.indexOf('  fallback-upload:'),
    workflow.indexOf('  fallback-unavailable:')
  );
  const finalLive = fallback.indexOf(
    '- name: Revalidate the open pull request and exact head before marking Ready'
  );
  const ready = fallback.indexOf('- name: Report fallback ready to Poppy');
  assert.ok(finalLive > 0 && ready > finalLive, 'the live recheck must immediately precede Ready');
  assert.match(fallback, /id: ready\s+if: steps\.final-live\.outcome == 'success'/);
  assert.match(
    fallback,
    /pr\.state !== 'open' \|\| pr\.head\.sha !== '\$\{\{ needs\.resolve-deploy\.outputs\.head_sha \}\}'/
  );
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
    'size',
    'building',
    'download',
    'archive',
    'upload',
    'final-live',
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
  for (const failedStep of [
    'size',
    'download',
    'archive',
    'upload',
    'final-live',
    'ready',
    'failed',
    'comment',
  ]) {
    assert.match(fallback, new RegExp(`steps\\.${failedStep}\\.outcome != 'success'`));
  }

  const shouldReportFailed = (outcomes) =>
    outcomes.live === 'success' && outcomes.ready !== 'success';
  const shouldWriteComment = (outcomes) =>
    outcomes.live === 'success' &&
    (outcomes.ready === 'success' ||
      (outcomes.failed === 'success' && outcomes.failedCentral === 'success'));
  const shouldFailJob = (outcomes) =>
    [
      'live',
      'size',
      'building',
      'download',
      'archive',
      'upload',
      'final-live',
      'ready',
      'comment',
    ].some((step) => outcomes[step] !== 'success') ||
    (outcomes.ready !== 'success' && outcomes.failed !== 'success');

  const success = Object.fromEntries(
    [
      'live',
      'size',
      'building',
      'download',
      'archive',
      'upload',
      'final-live',
      'ready',
      'comment',
    ].map((step) => [step, 'success'])
  );
  success.failed = 'skipped';
  assert.equal(shouldReportFailed(success), false);
  assert.equal(shouldWriteComment(success), true);
  assert.equal(shouldFailJob(success), false);
  const oversized = {
    ...success,
    size: 'failure',
    building: 'skipped',
    download: 'skipped',
    archive: 'skipped',
    upload: 'skipped',
    ready: 'skipped',
    failed: 'success',
    failedCentral: 'success',
  };
  assert.equal(
    shouldReportFailed(oversized),
    true,
    'oversized artifacts must revoke the lifecycle'
  );
  assert.equal(
    shouldWriteComment(oversized),
    true,
    'oversized artifacts must update the sticky state'
  );
  assert.equal(shouldFailJob(oversized), true, 'oversized artifacts must fail the job');

  const publicationSteps = ['building', 'download', 'archive', 'upload', 'ready'];
  for (const [failureIndex, boundary] of publicationSteps.entries()) {
    const injected = { ...success, failed: 'success', failedCentral: 'success' };
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
  assert.doesNotMatch(
    failedBuild,
    new RegExp(selectedControlPlane.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
  assert.doesNotMatch(
    close,
    new RegExp(selectedControlPlane.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'close must not key revocation on the current switch value'
  );
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

test('eligible close revokes the central and currently configured fallback targets in both modes', () => {
  // The owning plane cannot be derived from the current kill-switch value, so
  // trusted cleanup always revokes the central plane and revokes the fallback
  // plane whenever one is configured.
  const central = close.slice(
    close.indexOf('- name: Report the closed deployment to the central Poppy control plane'),
    close.indexOf('- name: Report the closed deployment to the configured fallback control plane')
  );
  assert.match(
    central,
    /POPPY_CONTROL_PLANE: https:\/\/poppy-proto-ui\.chenyejin2004\.workers\.dev/
  );
  assert.match(central, /continue-on-error: true/);
  assert.match(central, /report\.mjs closed/);
  const fallback = close.slice(
    close.indexOf('- name: Report the closed deployment to the configured fallback control plane'),
    close.indexOf('- name: Maintain the sticky PR comment')
  );
  assert.match(fallback, /POPPY_CONTROL_PLANE: \$\{\{ vars\.POPPY_PREVIEW_FALLBACK_ORIGIN \}\}/);
  assert.match(
    fallback,
    /if: always\(\) && steps\.live\.outputs\.cleanup == 'true' && vars\.POPPY_PREVIEW_FALLBACK_ORIGIN != ''/
  );
  assert.match(fallback, /report\.mjs closed/);
  assert.match(
    close,
    /steps\.revoke-central\.outcome != 'success' \|\|\s*\(vars\.POPPY_PREVIEW_FALLBACK_ORIGIN != '' && steps\.revoke-fallback\.outcome != 'success'\) \|\|\s*\(vars\.POPPY_CLOUDFLARE_MUTATIONS_ENABLED == 'true' && steps\.cleanup\.outcome != 'success'\)/
  );

  const cleanupFails = ({
    cloudflareEnabled,
    fallbackConfigured,
    cleanup,
    revokeCentral,
    revokeFallback,
  }) =>
    revokeCentral !== 'success' ||
    (fallbackConfigured && revokeFallback !== 'success') ||
    (cloudflareEnabled && cleanup !== 'success');
  assert.equal(
    cleanupFails({
      cloudflareEnabled: false,
      fallbackConfigured: false,
      cleanup: 'skipped',
      revokeCentral: 'failure',
      revokeFallback: 'skipped',
    }),
    true,
    'Closed rejection must fail while Cloudflare is disabled'
  );
  assert.equal(
    cleanupFails({
      cloudflareEnabled: false,
      fallbackConfigured: false,
      cleanup: 'skipped',
      revokeCentral: 'success',
      revokeFallback: 'skipped',
    }),
    false
  );
  assert.equal(
    cleanupFails({
      cloudflareEnabled: false,
      fallbackConfigured: true,
      cleanup: 'skipped',
      revokeCentral: 'success',
      revokeFallback: 'failure',
    }),
    true,
    'a rejected fallback Closed transition must fail cleanup'
  );
  assert.equal(
    cleanupFails({
      cloudflareEnabled: true,
      fallbackConfigured: true,
      cleanup: 'failure',
      revokeCentral: 'success',
      revokeFallback: 'success',
    }),
    true,
    'Cloudflare deletion failure must remain fatal while it is enabled'
  );
});

test('pull_request security runs never receive the dcbot credential', () => {
  const boundary = security.slice(
    security.indexOf('  security-boundary:'),
    security.indexOf('  dcbot-contract-exact-head:')
  );
  assert.match(boundary, /if: github\.event_name != 'pull_request_target'/);
  assert.doesNotMatch(boundary, /secrets\.DCBOT_CONTRACT_TOKEN/);
  assert.doesNotMatch(boundary, /Proto-UI\/dcbot/);
  const exactHead = security.slice(
    security.indexOf('  dcbot-contract-exact-head:'),
    security.indexOf('  dcbot-contract-pinned:')
  );
  assert.match(exactHead, /if: github\.event_name == 'pull_request_target'/);
  assert.match(exactHead, /token: \$\{\{ secrets\.DCBOT_CONTRACT_TOKEN \}\}/);
  assert.doesNotMatch(exactHead, /github\.token/);
  assert.doesNotMatch(exactHead, /continue-on-error/);
  const pinned = security.slice(security.indexOf('  dcbot-contract-pinned:'));
  assert.match(pinned, /if: github\.event_name == 'push'/);
  assert.match(pinned, /token: \$\{\{ secrets\.DCBOT_CONTRACT_TOKEN \}\}/);
  assert.doesNotMatch(pinned, /continue-on-error/);
});

test('security CI checks the immutable dcbot handler source and runs its real preview tests', () => {
  assert.match(security, /repository: Proto-UI\/dcbot/);
  assert.match(security, /ref: 3f60a2b41832a0b02e64a0f4b8bf237355b59806/);
  assert.match(security, /DCBOT_CONTRACT_ROOT/);
  assert.match(security, /go test \.\/internal\/preview/);
});

test('security CI fails closed when the pinned contract repository is unreachable', () => {
  // Inability to fetch or test the pinned dcbot revision is blocking for
  // acceptance: neither trusted lane may skip verification and stay green.
  assert.match(security, /^  pull_request_target:$/m);
  assert.match(
    security,
    /group: poppy-preview-security-\$\{\{ github\.event_name \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/
  );
  const exactHead = security.slice(
    security.indexOf('  dcbot-contract-exact-head:'),
    security.indexOf('  dcbot-contract-pinned:')
  );
  assert.match(exactHead, /DCBOT_CONTRACT_TOKEN is not configured/);
  assert.doesNotMatch(exactHead, /continue-on-error/);
  // The trusted lane binds both checkouts before any verification runs:
  // the pinned dcbot revision and the exact pull request head.
  assert.match(exactHead, /ref: refs\/pull\/\$\{\{ github\.event\.pull_request\.number \}\}\/head/);
  assert.match(exactHead, /git -C \.pr-head rev-parse HEAD/);
  assert.match(exactHead, /\$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(exactHead, /git -C \.poppy\/dcbot-contract rev-parse HEAD/);
  // The pull request checkout is inert data: nothing under .pr-head executes.
  assert.match(exactHead, /sparse-checkout: integrations\/proto-ui-preview\/contracts/);
  assert.doesNotMatch(exactHead, /working-directory: \.pr-head/);
  assert.doesNotMatch(exactHead, /(?:npm|node|go)[^\n]*\.pr-head/);
  // Digest verification runs trusted inline code, enforces the workflow pin,
  // and rejects unsafe digest paths from the pull-request-controlled JSON.
  assert.match(exactHead, /PINNED_DCBOT_REVISION/);
  assert.match(exactHead, /contract revision pin drifted from the trusted workflow pin/);
  assert.match(exactHead, /unsafe digest path rejected/);
  const pinned = security.slice(security.indexOf('  dcbot-contract-pinned:'));
  assert.match(pinned, /DCBOT_CONTRACT_TOKEN is not configured/);
  assert.doesNotMatch(pinned, /continue-on-error/);
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

test('publication failure paths revoke every configured owning plane before failure comments', () => {
  for (const [start, end, ids] of [
    ['  fallback-upload:', '  fallback-unavailable:', ['failed-central', 'failed']],
    ['  deploy:', null, ['failed-central', 'failed-fallback']],
  ]) {
    const job = workflow.slice(workflow.indexOf(start), end ? workflow.indexOf(end) : undefined);
    for (const id of ids) {
      assert.match(job, new RegExp(`id: ${id}\\b`));
    }
    assert.match(job, /POPPY_CONTROL_PLANE: https:\/\/poppy-proto-ui\.chenyejin2004\.workers\.dev/);
    assert.match(job, /POPPY_CONTROL_PLANE: \$\{\{ vars\.POPPY_PREVIEW_FALLBACK_ORIGIN \}\}/);
    for (const id of ids) assert.match(job, new RegExp(`steps\\.${id}\\.outcome == 'success'`));
  }
});

function conditionForStep(job, name) {
  const start = job.indexOf(`      - name: ${name}\n`);
  assert.ok(start >= 0, name);
  const step = job.slice(
    start,
    job.indexOf('\n      - name:', start + 1) < 0
      ? undefined
      : job.indexOf('\n      - name:', start + 1)
  );
  const match = step.match(/^        if: (.+)$/m);
  assert.ok(match, name);
  const expression =
    match[1] === '>-'
      ? step
          .slice(match.index + match[0].length)
          .trimStart()
          .split('\n')[0]
      : match[1];
  const source = expression.replace(
    /steps\.([\w-]+)/g,
    (_all, name) => `steps[${JSON.stringify(name)}]`
  );
  return (steps, vars) =>
    Function('steps', 'vars', 'always', `return (${source});`)(steps, vars, () => true);
}

test('unavailable and failed-build comments require all revocation acknowledgements', () => {
  for (const [start, end, name] of [
    ['  fallback-unavailable:', '  deploy:', 'Maintain the sticky fallback comment'],
    ['  report-failed-build:', '  fallback-upload:', 'Maintain the sticky failure comment'],
  ]) {
    const job = workflow.slice(workflow.indexOf(start), workflow.indexOf(end));
    const allowed = conditionForStep(job, name);
    const steps = {
      resolve: { outputs: { report: 'true' } },
      'revoke-central': { outcome: 'success' },
      'revoke-fallback': { outcome: 'success' },
    };
    const vars = { POPPY_PREVIEW_FALLBACK_ORIGIN: 'https://fallback.example' };
    assert.equal(allowed(steps, vars), true);
    for (const target of ['revoke-central', 'revoke-fallback']) {
      for (const outcome of ['failure', 'cancelled', 'skipped']) {
        assert.equal(
          allowed({ ...steps, [target]: { outcome } }, vars),
          false,
          `${name}: ${target} ${outcome}`
        );
      }
    }
    assert.equal(
      allowed(
        { ...steps, 'revoke-fallback': { outcome: 'skipped' } },
        { POPPY_PREVIEW_FALLBACK_ORIGIN: '' }
      ),
      true
    );
  }
});

test('both publication comment predicates suppress failed revocation outcomes', () => {
  for (const [start, end, name, failureIds] of [
    [
      '  fallback-upload:',
      '  fallback-unavailable:',
      'Maintain the sticky fallback comment',
      ['failed-central', 'failed'],
    ],
    ['  deploy:', null, 'Maintain the sticky PR comment', ['failed-central', 'failed-fallback']],
  ]) {
    const job = workflow.slice(workflow.indexOf(start), end ? workflow.indexOf(end) : undefined);
    const allowed = conditionForStep(job, name);
    const steps = {
      live: { outcome: 'success' },
      resolve: { outputs: { pr: '596' } },
      ready: { outcome: 'failure' },
      'failed-central': { outcome: 'success' },
      failed: { outcome: 'success' },
      'failed-fallback': { outcome: 'success' },
    };
    const vars = { POPPY_PREVIEW_FALLBACK_ORIGIN: 'https://fallback.example' };
    assert.equal(allowed(steps, vars), true);
    for (const id of failureIds) {
      for (const outcome of ['failure', 'cancelled', 'skipped']) {
        assert.equal(
          allowed({ ...steps, [id]: { outcome } }, vars),
          false,
          `${start}: ${id} ${outcome}`
        );
      }
    }
    assert.equal(
      allowed(
        {
          ...steps,
          ready: { outcome: 'success' },
          'failed-central': { outcome: 'skipped' },
          failed: { outcome: 'skipped' },
          'failed-fallback': { outcome: 'skipped' },
        },
        vars
      ),
      true
    );
  }
});

test('cleanup cards treat every configured non-success revocation as cleanup-failed', () => {
  const expression = close
    .match(/PREVIEW_STATUS: \$\{\{ (.+) \}\}/)[1]
    .replace(/steps\.([\w-]+)/g, (_all, name) => `steps[${JSON.stringify(name)}]`);
  const status = Function('steps', 'vars', `return (${expression});`);
  for (const mode of ['true', 'false']) {
    const vars = {
      POPPY_CLOUDFLARE_MUTATIONS_ENABLED: mode,
      POPPY_PREVIEW_FALLBACK_ORIGIN: 'https://fallback.example',
    };
    const steps = {
      cleanup: { outcome: 'success' },
      'revoke-central': { outcome: 'success' },
      'revoke-fallback': { outcome: 'success' },
    };
    assert.equal(status(steps, vars), mode === 'true' ? 'closed' : 'fallback-closed');
    for (const outcome of ['failure', 'cancelled', 'skipped']) {
      assert.equal(status({ ...steps, 'revoke-fallback': { outcome } }, vars), 'cleanup-failed');
    }
  }
});

test('cleanup admission rechecks the live closed state and exact head under the lock', async () => {
  const block = close.match(
    /name: Revalidate the live closed pull request under the lock[\s\S]*?script: \|\n([\s\S]*?)\n      - name:/
  );
  assert.ok(block, 'cleanup needs an early live-state guard, before lifecycle mutations');
  const script = block[1]
    .split('\n')
    .map((line) => line.replace(/^            /, ''))
    .join('\n');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const [state, head, allowed] of [
    ['closed', 'a'.repeat(40), 'true'],
    ['open', 'a'.repeat(40), 'false'],
    ['closed', 'b'.repeat(40), 'false'],
  ]) {
    const outputs = {};
    await new AsyncFunction('github', 'context', 'core', script)(
      { rest: { pulls: { get: async () => ({ data: { state, head: { sha: head } } }) } } },
      {
        repo: { owner: 'Fixture', repo: 'fixture' },
        payload: { pull_request: { number: 596, head: { sha: 'a'.repeat(40) } } },
      },
      { setOutput: (key, value) => (outputs[key] = value), notice: () => {} }
    );
    assert.equal(outputs.cleanup, allowed);
  }
});

test('stale cleanup cannot delete resources, report Closed or replace the sticky card', () => {
  const stale = {
    live: { outputs: { cleanup: 'false' } },
    cleanup: { outcome: 'success' },
    'revoke-central': { outcome: 'success' },
    'revoke-fallback': { outcome: 'success' },
  };
  const vars = {
    POPPY_CLOUDFLARE_MUTATIONS_ENABLED: 'true',
    POPPY_PREVIEW_FALLBACK_ORIGIN: 'https://fallback.example',
  };
  for (const name of [
    'Delete all preview resources for the PR',
    'Report the closed deployment to the central Poppy control plane',
    'Report the closed deployment to the configured fallback control plane',
    'Maintain the sticky PR comment',
  ]) {
    assert.equal(conditionForStep(close, name)(stale, vars), false, name);
  }
});

test('failed or invalid live cleanup lookup never authorizes mutation', async () => {
  const block = close.match(
    /name: Revalidate the live closed pull request under the lock[\s\S]*?script: \|\n([\s\S]*?)\n      - name:/
  );
  assert.ok(block);
  const script = block[1]
    .split('\n')
    .map((line) => line.replace(/^            /, ''))
    .join('\n');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const value of ['lookup-failure', {}, { state: 'closed' }, null]) {
    const outputs = {};
    const invoke = () =>
      new AsyncFunction('github', 'context', 'core', script)(
        {
          rest: {
            pulls: {
              get: async () => {
                if (value === 'lookup-failure') throw new Error('lookup unavailable');
                return { data: value };
              },
            },
          },
        },
        {
          repo: { owner: 'Fixture', repo: 'fixture' },
          payload: { pull_request: { number: 596, head: { sha: 'a'.repeat(40) } } },
        },
        { setOutput: (key, value) => (outputs[key] = value), notice: () => {} }
      );
    if (value === 'lookup-failure' || value === null) await assert.rejects(invoke);
    else await invoke();
    assert.notEqual(outputs.cleanup, 'true');
  }
});
