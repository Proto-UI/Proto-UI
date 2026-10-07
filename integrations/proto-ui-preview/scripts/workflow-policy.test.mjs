import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(
  new URL('../.github/workflows/poppy-preview-deploy.yml', import.meta.url),
  'utf8'
);
const close = await readFile(
  new URL('../.github/workflows/poppy-preview-close.yml', import.meta.url),
  'utf8'
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

test('unavailable and failed-build comments require all revocation acknowledgements', () => {
  for (const [start, end, name] of [
    ['  fallback-unavailable:', '  deploy:', 'Maintain the sticky fallback comment'],
    ['  report-failed-build:', '  fallback-upload:', 'Maintain the sticky failure comment'],
  ]) {
    const job = workflow.slice(workflow.indexOf(start), workflow.indexOf(end));
    const allowed = conditionForStep(job, name);
    const steps = {
      resolve: { outputs: { report: 'true' } },
      live: { outcome: 'success' },
      'comment-live': { outcome: 'success' },
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
      'comment-live': { outcome: 'success' },
      resolve: { outcome: 'success', outputs: { pr: '596' } },
      'failure-live': { outcome: 'success' },
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
          'failure-live': { outcome: 'skipped' },
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

test('cancelled or skipped publication still readmits before configured dual-plane revocation', () => {
  for (const [start, end, admission, failedNames] of [
    [
      '  fallback-upload:',
      '  fallback-unavailable:',
      'live',
      [
        'Report a failed fallback deployment to the central control plane',
        'Report a failed fallback deployment to Poppy',
      ],
    ],
    [
      '  deploy:',
      null,
      'resolve',
      [
        'Report a failed deployment to Poppy',
        'Report a failed Pages deployment to the configured fallback control plane',
      ],
    ],
  ]) {
    const job = workflow.slice(workflow.indexOf(start), end ? workflow.indexOf(end) : undefined);
    const vars = { POPPY_PREVIEW_FALLBACK_ORIGIN: 'https://fallback.example' };
    for (const outcome of ['failure', 'cancelled', 'skipped']) {
      const steps = {
        [admission]: { outcome: 'success', outputs: { pr: '596' } },
        'failure-live': { outcome: 'success' },
        ready: { outcome },
        publish: { outputs: { exit_code: '0' } },
        deployed: { outcome: 'success' },
        'assets-ready': { outcome: 'success' },
      };
      assert.equal(
        conditionForStep(job, 'Readmit the current build before failure revocation')(steps, vars),
        true
      );
      for (const name of failedNames)
        assert.equal(conditionForStep(job, name)(steps, vars), true, name);
      assert.equal(
        conditionForStep(job, 'Readmit the current build before failure revocation')(
          {
            ...steps,
            [admission]: { outcome: 'failure', outputs: {} },
          },
          vars
        ),
        false
      );
    }
  }
});

test('credential-bearing security lanes are unreachable for pull_request events', () => {
  const enabled = (job, event) => {
    const definition = security
      .split(/\n(?= {2}[\w-]+:\n)/)
      .find((block) => block.startsWith(`  ${job}:\n`));
    // Match the owning job condition, not a copied approximation.
    const condition = definition.match(/^    if: (.+)$/m)[1];
    return Function('github', `return (${condition});`)({ event_name: event });
  };
  for (const event of ['pull_request', 'pull_request_target', 'push']) {
    assert.equal(enabled('security-boundary', event), event !== 'pull_request_target');
    assert.equal(enabled('dcbot-contract-exact-head', event), event === 'pull_request_target');
    assert.equal(enabled('dcbot-contract-pinned', event), event === 'push');
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

test('rejected post-lock admission cannot revoke or comment in either reporting path', () => {
  for (const [start, end, admission, names] of [
    [
      '  report-failed-build:',
      '  fallback-upload:',
      'resolve',
      [
        'Revoke the failed head on the central Poppy control plane',
        'Revoke the failed head on the configured fallback control plane',
        'Maintain the sticky failure comment',
      ],
    ],
    [
      '  fallback-unavailable:',
      '  deploy:',
      'live',
      [
        'Revoke the current head on the central Poppy control plane',
        'Revoke the current head on the configured fallback control plane',
        'Maintain the sticky fallback comment',
      ],
    ],
  ]) {
    const job = workflow.slice(workflow.indexOf(start), workflow.indexOf(end));
    const vars = { POPPY_PREVIEW_FALLBACK_ORIGIN: 'https://fallback.example' };
    for (const outcome of ['failure', 'cancelled', 'skipped']) {
      const steps = {
        live: { outcome: 'success' },
        resolve: { outputs: { report: 'true' } },
        'comment-live': { outcome: 'success' },
        'revoke-central': { outcome: 'success' },
        'revoke-fallback': { outcome: 'success' },
        [admission]: { outcome, outputs: {} },
      };
      for (const name of names) assert.equal(conditionForStep(job, name)(steps, vars), false, name);
    }
  }
});

test('a stale final admission prevents Ready and a stale failure admission prevents revocation', () => {
  for (const [start, end, readyName, failedNames] of [
    [
      '  fallback-upload:',
      '  fallback-unavailable:',
      'Report fallback ready to Poppy',
      [
        'Report a failed fallback deployment to the central control plane',
        'Report a failed fallback deployment to Poppy',
      ],
    ],
    [
      '  deploy:',
      null,
      'Report the ready deployment to Poppy',
      [
        'Report a failed deployment to Poppy',
        'Report a failed Pages deployment to the configured fallback control plane',
      ],
    ],
  ]) {
    const job = workflow.slice(workflow.indexOf(start), end ? workflow.indexOf(end) : undefined);
    const vars = { POPPY_PREVIEW_FALLBACK_ORIGIN: 'https://fallback.example' };
    const good = {
      live: { outcome: 'success' },
      resolve: { outcome: 'success', outputs: { pr: '596' } },
      'final-live': { outcome: 'success' },
      'failure-live': { outcome: 'success' },
      publish: { outputs: { exit_code: '0' } },
      deployed: { outcome: 'success' },
      'assets-ready': { outcome: 'success' },
      ready: { outcome: 'failure' },
    };
    assert.equal(conditionForStep(job, readyName)(good, vars), true);
    for (const outcome of ['failure', 'cancelled', 'skipped']) {
      assert.equal(
        conditionForStep(job, readyName)({ ...good, 'final-live': { outcome } }, vars),
        false
      );
      for (const name of failedNames) {
        assert.equal(
          conditionForStep(job, name)({ ...good, 'failure-live': { outcome } }, vars),
          false,
          name
        );
      }
    }
    for (const name of failedNames)
      assert.equal(conditionForStep(job, name)(good, vars), true, name);
  }
});

test('sticky writers reject a superseded tuple even after successful lifecycle acknowledgements', () => {
  for (const [start, end, name] of [
    ['  report-failed-build:', '  fallback-upload:', 'Maintain the sticky failure comment'],
    ['  fallback-unavailable:', '  deploy:', 'Maintain the sticky fallback comment'],
    ['  fallback-upload:', '  fallback-unavailable:', 'Maintain the sticky fallback comment'],
    ['  deploy:', null, 'Maintain the sticky PR comment'],
  ]) {
    const job = workflow.slice(workflow.indexOf(start), end ? workflow.indexOf(end) : undefined);
    const steps = {
      live: { outcome: 'success' },
      resolve: { outcome: 'success', outputs: { pr: '596', report: 'true' } },
      'failure-live': { outcome: 'skipped' },
      ready: { outcome: 'success' },
      'revoke-central': { outcome: 'success' },
      'revoke-fallback': { outcome: 'success' },
      'failed-central': { outcome: 'success' },
      failed: { outcome: 'success' },
      'failed-fallback': { outcome: 'success' },
      'comment-live': { outcome: 'success' },
    };
    const vars = { POPPY_PREVIEW_FALLBACK_ORIGIN: 'https://fallback.example' };
    const allowed = conditionForStep(job, name);
    assert.equal(allowed(steps, vars), true);
    for (const outcome of ['failure', 'cancelled', 'skipped']) {
      assert.equal(allowed({ ...steps, 'comment-live': { outcome } }, vars), false, name);
    }
  }
});

test('a successful Pages publication updates its Ready card without failure revocation', () => {
  const job = workflow.slice(workflow.indexOf('  deploy:'));
  const steps = {
    resolve: { outcome: 'success', outputs: { pr: '596' } },
    ready: { outcome: 'success' },
    'failure-live': { outcome: 'skipped' },
    'failed-central': { outcome: 'skipped' },
    'failed-fallback': { outcome: 'skipped' },
    'comment-live': { outcome: 'success' },
  };
  const vars = { POPPY_PREVIEW_FALLBACK_ORIGIN: 'https://fallback.example' };
  assert.equal(
    conditionForStep(job, 'Readmit the current build before updating the sticky card')(steps, vars),
    true
  );
  assert.equal(conditionForStep(job, 'Maintain the sticky PR comment')(steps, vars), true);
});

function assertIngestKeySeparation(source) {
  const bindings = [];
  for (const step of source.split(/(?=^      - name: )/m).slice(1)) {
    const assignment = step.match(/^          POPPY_PREVIEW_INGEST_SECRET: (.+)$/m);
    if (!assignment) continue;
    const fallback = step.includes(
      'POPPY_CONTROL_PLANE: ${{ vars.POPPY_PREVIEW_FALLBACK_ORIGIN }}'
    );
    const expected = fallback
      ? '${{ secrets.POPPY_PREVIEW_FALLBACK_INGEST_SECRET }}'
      : '${{ secrets.POPPY_PREVIEW_INGEST_SECRET }}';
    assert.equal(assignment[1], expected, step.split('\n')[0]);
    assert.match(
      step,
      /run: node integrations\/proto-ui-preview\/scripts\/(report|upload-poppy-artifact)\.mjs/
    );
    bindings.push(fallback ? 'fallback' : 'central');
  }
  return bindings;
}

test('every lifecycle and artifact step binds only its own control-plane ingest key', () => {
  for (const [source, fallbackCount, centralCount] of [
    [workflow, 7, 6],
    [close, 1, 1],
  ]) {
    const bindings = assertIngestKeySeparation(source);
    assert.equal(bindings.filter((plane) => plane === 'fallback').length, fallbackCount);
    assert.equal(bindings.filter((plane) => plane === 'central').length, centralCount);
  }
});

test('key-routing controls reject central reuse and a missing-key fallback expression', () => {
  const fallback = '${{ secrets.POPPY_PREVIEW_FALLBACK_INGEST_SECRET }}';
  for (const replacement of [
    '${{ secrets.POPPY_PREVIEW_INGEST_SECRET }}',
    '${{ secrets.POPPY_PREVIEW_FALLBACK_INGEST_SECRET || secrets.POPPY_PREVIEW_INGEST_SECRET }}',
  ]) {
    assert.throws(() => assertIngestKeySeparation(workflow.replace(fallback, replacement)));
    assert.throws(() => assertIngestKeySeparation(close.replace(fallback, replacement)));
  }
});
