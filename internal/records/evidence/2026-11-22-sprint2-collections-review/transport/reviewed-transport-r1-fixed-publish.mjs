import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// This temporary carrier never enters the product branch. It imports original
// Git objects and preserves their author, committer, sign-off, parents and SHA.
const manifestBytes = readFileSync('.sprint2-transport/manifest.json');
const manifest = JSON.parse(manifestBytes);
const mode = process.argv[2];
assert.ok(['verify', 'publish'].includes(mode));
const run = (binary, args, extra = {}) =>
  execFileSync(binary, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...extra,
  }).trim();
const git = (...args) => run('git', args);
const receiptPath = path.join(process.env.RUNNER_TEMP, `sprint2-transport-${mode}.json`);
const receipt = {
  kind: 'original-git-object-transport',
  mode,
  startedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY,
  transportCommit: process.env.GITHUB_SHA,
  triggeringActor: process.env.GITHUB_ACTOR,
  runId: process.env.GITHUB_RUN_ID,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
  manifest,
  status: 'preparing',
  writeAttempts: 0,
};
const save = () => writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
const remoteHead = () => {
  const text = git('ls-remote', 'origin', `refs/heads/${manifest.branch}`);
  const [sha, ref, ...extra] = text.split(/\s+/);
  assert.equal(ref, `refs/heads/${manifest.branch}`);
  assert.equal(extra.length, 0);
  assert.match(sha, /^[a-f0-9]{40}$/);
  return sha;
};
save();
try {
  assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(process.env.GITHUB_REPOSITORY, 'Proto-UI/Proto-UI');
  assert.equal(process.env.GITHUB_REF, `refs/heads/${manifest.transportBranch}`);
  assert.equal(git('rev-parse', 'HEAD'), process.env.GITHUB_SHA);
  assert.equal(git('status', '--porcelain'), '', 'carrier checkout must be clean');
  assert.equal(manifest.branch, 'sprint2/0.3-semantics-consumers-20261122');
  for (const sha of [manifest.expectedHead, manifest.targetHead, manifest.targetTree])
    assert.match(sha, /^[a-f0-9]{40}$/);
  const bundle = readFileSync('.sprint2-transport/candidate.bundle');
  assert.equal(bundle.length, manifest.bundleBytes);
  assert.equal(createHash('sha256').update(bundle).digest('hex'), manifest.bundleSha256);
  git('bundle', 'verify', '.sprint2-transport/candidate.bundle');
  assert.equal(
    git('bundle', 'list-heads', '.sprint2-transport/candidate.bundle'),
    `${manifest.targetHead} HEAD`
  );
  // An exact ref import loads data. It never checks out or executes candidate code.
  git('fetch', '--no-tags', '.sprint2-transport/candidate.bundle', 'HEAD:refs/sprint2/candidate');
  assert.equal(git('rev-parse', 'refs/sprint2/candidate'), manifest.targetHead);
  assert.equal(git('rev-parse', `${manifest.targetHead}^{tree}`), manifest.targetTree);
  git('merge-base', '--is-ancestor', manifest.expectedHead, manifest.targetHead);
  const commits = git(
    'rev-list',
    '--reverse',
    `${manifest.expectedHead}..${manifest.targetHead}`
  ).split('\n');
  assert.deepEqual(
    commits,
    manifest.commits.map((item) => item.sha)
  );
  for (const item of manifest.commits) {
    const object = execFileSync('git', ['cat-file', 'commit', item.sha]);
    assert.equal(createHash('sha256').update(object).digest('hex'), item.objectSha256);
    const author = git('show', '-s', '--format=%an <%ae>', item.sha);
    assert.ok(
      git('show', '-s', '--format=%B', item.sha).split('\n').includes(`Signed-off-by: ${author}`),
      `original author sign-off missing: ${item.sha}`
    );
  }
  const paths = execFileSync('git', [
    'diff',
    '--name-only',
    '-z',
    manifest.expectedHead,
    manifest.targetHead,
  ]);
  assert.equal(createHash('sha256').update(paths).digest('hex'), manifest.changedPathsSha256);
  receipt.originalObjectsVerified = commits.length;
  receipt.note =
    'Object/sign-off verification is not native DCO App success, independent approval, technical CI, merge or deployment.';
  if (mode === 'verify') {
    receipt.status = 'verified-no-write';
  } else {
    const live = JSON.parse(
      run('gh', [
        'api',
        'graphql',
        '-f',
        'query=query { viewer { login } repository(owner:"Proto-UI", name:"Proto-UI") { databaseId nameWithOwner viewerPermission isArchived defaultBranchRef { name } } }',
      ])
    );
    assert.ok(!live.errors?.length);
    assert.equal(live.data.repository.nameWithOwner, manifest.repository);
    assert.equal(live.data.repository.databaseId, 840178061);
    assert.equal(live.data.repository.isArchived, false);
    // GITHUB_TOKEN is an installation access token, not a human repository role.
    // GitHub documents viewerPermission=null for App authentication. The reviewed
    // publisher job requests contents:write; the actual push enforces that grant.
    // Do not invent WRITE/MAINTAIN, substitute a token, or weaken a platform refusal.
    assert.equal(live.data.viewer.login, 'github-actions[bot]');
    assert.equal(live.data.repository.viewerPermission, null);
    assert.equal(process.env.GITHUB_JOB, 'publish-exact-candidate');
    assert.equal(process.env.GITHUB_ACTOR, 'cyjin-yl');
    assert.equal(process.env.GITHUB_TRIGGERING_ACTOR, 'cyjin-yl');
    assert.equal(process.env.GITHUB_ACTOR_ID, '19223209');
    assert.equal(process.env.GITHUB_WORKFLOW_SHA, process.env.GITHUB_SHA);
    assert.equal(
      process.env.GITHUB_WORKFLOW_REF,
      `${manifest.repository}/.github/workflows/preference-source-evidence.yml@refs/heads/${manifest.transportBranch}`
    );
    assert.notEqual(manifest.branch, live.data.repository.defaultBranchRef.name);
    receipt.publisher = {
      actor: live.data.viewer.login,
      userRepositoryRole: live.data.repository.viewerPermission,
      permissionModel: 'GitHub App installation access token',
      requestedJobPermission: 'contents:write',
      credential: 'ephemeral repository GITHUB_TOKEN; not exported',
      authority:
        'current-user authorized feature-branch publication; native Git push is the permission enforcement boundary',
    };
    receipt.before = remoteHead();
    if (receipt.before === manifest.targetHead) {
      receipt.status = 'already-present-no-write';
    } else {
      assert.equal(receipt.before, manifest.expectedHead, 'remote head changed; no retry');
      receipt.writeAttempts = 1;
      receipt.status = 'attempting-exact-lease-push';
      save();
      receipt.push = run('git', [
        '-c',
        'credential.helper=!gh auth git-credential',
        'push',
        '--porcelain',
        `--force-with-lease=refs/heads/${manifest.branch}:${manifest.expectedHead}`,
        'origin',
        `${manifest.targetHead}:refs/heads/${manifest.branch}`,
      ]);
      receipt.after = remoteHead();
      assert.equal(receipt.after, manifest.targetHead);
      receipt.status = 'applied-readback';
    }
  }
} catch (error) {
  receipt.error = { message: String(error.message ?? error), stderr: error.stderr?.toString() };
  receipt.status = receipt.writeAttempts ? 'unknown-after-attempt' : 'rejected-before-write';
  if (receipt.writeAttempts) {
    try {
      receipt.reconciledHead = remoteHead();
      if (receipt.reconciledHead === manifest.expectedHead)
        receipt.status = 'rejected-old-head-retained';
      if (receipt.reconciledHead === manifest.targetHead)
        receipt.status = 'observed-target-after-unknown-ack';
    } catch (readError) {
      receipt.reconciliationError = String(readError);
    }
  }
  process.exitCode = 1;
} finally {
  receipt.finishedAt = new Date().toISOString();
  save();
  console.log(
    JSON.stringify(
      {
        receiptPath,
        status: receipt.status,
        targetHead: manifest.targetHead,
        writeAttempts: receipt.writeAttempts,
        error: receipt.error,
      },
      null,
      2
    )
  );
}
