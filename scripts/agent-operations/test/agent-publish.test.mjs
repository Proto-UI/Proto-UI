import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  parsePublishCli,
  PublicationUnknown,
  runCommitMessageHook,
  runPublishCli,
} from '../agent-publish.mjs';
import {
  buildModelTraceRecord,
  computeModelTraceChallengeDigest,
  createModelTraceChallenge,
  renderModelTraceDisclosure,
  assertModelTraceDisclosure,
} from '../modeltrace.mjs';
import { ownerDelegationSigningBytes } from '../owner-authorization.mjs';

const REPOSITORY = 'github.com:fixture-owner/fixture-repository';
const LOGIN = 'fixture-contributor';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const PUBLISH_SCRIPT = fileURLToPath(new URL('../agent-publish.mjs', import.meta.url));
const HOOK_SCRIPT = fileURLToPath(new URL('../../../.husky/commit-msg', import.meta.url));
const LAUNCH = [
  '--mode',
  'human-assisted',
  '--mode-source',
  'current-user',
  '--authorization',
  'explicit-current-user',
];

function fixture(
  t,
  {
    body = 'Synthetic offline publication fixture.\n',
    now = new Date(),
    failed = false,
    repositoryId = REPOSITORY,
  } = {}
) {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'agent-publish-fixture-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = {
    schemaVersion: 1,
    kind: 'proto-ui.modeltrace-context',
    repositoryId,
    sessionId: randomBytes(32).toString('hex'),
    contextDigest: 'a'.repeat(64),
    routeDigest: 'b'.repeat(64),
    declared: { systemModel: 'synthetic-fixture', harnessModel: 'synthetic-fixture' },
  };
  const challenge = createModelTraceChallenge(context, { now });
  // Intentionally generated deterministic SYNTHETIC samples test rendering and
  // validation only. They are not a fingerprint measurement of Main or a model.
  const response = {
    schemaVersion: 1,
    kind: 'proto-ui.modeltrace-response',
    challengeDigest: computeModelTraceChallengeDigest(challenge),
    startedAt: now.toISOString(),
    completedAt: now.toISOString(),
    method: 'active-model-literals',
    outputs: challenge.probes.map((probe, index) => ({
      id: probe.id,
      text: failed
        ? null
        : JSON.stringify(
            Array.from(
              { length: probe.count },
              (_, position) => ((position * 31 + index * 11) % 355) + 1
            )
          ),
      error: failed ? 'refused' : null,
    })),
  };
  const record = buildModelTraceRecord(challenge, response);
  const recordPath = path.join(directory, 'record.json');
  const contextPath = path.join(directory, 'context.json');
  const bodyPath = path.join(directory, 'body.txt');
  fs.writeFileSync(recordPath, JSON.stringify(record));
  fs.writeFileSync(contextPath, JSON.stringify(context));
  fs.writeFileSync(bodyPath, body);
  return {
    directory,
    now,
    context,
    record,
    recordPath,
    contextPath,
    bodyPath,
    body,
    args: [
      ...LAUNCH,
      '--repository',
      repositoryId,
      '--record',
      recordPath,
      '--context',
      contextPath,
    ],
    env: {
      ...process.env,
      PUI_AGENT: '1',
      PUI_MODELTRACE_RECORD: recordPath,
      PUI_MODELTRACE_CONTEXT: contextPath,
    },
  };
}

function server({
  unknown = false,
  applyUnknown = false,
  targetChanged = false,
  pull = false,
  foreignCommit = false,
  permission = 'WRITE',
  sourceOwner = 'fixture-owner',
  sourceName = null,
  liveSourceName = null,
  sourceBranch = 'fixture-contributor-branch',
  baseBranch = 'main',
  comparisonPages = null,
  protectedBranch = false,
  repositoryId = REPOSITORY,
  login = LOGIN,
  revision = { headSha: 'c'.repeat(40), baseSha: 'd'.repeat(40) },
} = {}) {
  const comments = [];
  const issues = [];
  const writes = [];
  let targetReads = 0;
  const target = {
    id: 7,
    number: 7,
    node_id: 'I_fixture',
    body: 'Original body',
    state: 'closed',
    locked: false,
    updated_at: '2026-10-04T00:00:00Z',
    user: { login },
    html_url: 'fixture://issue/7',
  };
  const fullName = repositoryId.slice('github.com:'.length);
  const sourceFullName = `${sourceOwner}/${sourceName ?? fullName.split('/')[1]}`;
  const runner = (binary, args, options) => {
    if (binary === 'git' && pull) {
      if (args[0] === 'config') return `https://github.com/${sourceFullName}.git\n`;
      if (args[0] === 'symbolic-ref') return `${sourceBranch}\n`;
      if (args[0] === 'rev-parse') return `${revision.headSha}\n`;
      if (args[0] === 'check-ref-format') return '';
    }
    assert.equal(binary, 'gh');
    const endpoint =
      args.find((arg) => arg.startsWith('repos/')) ?? args.find((arg) => arg === 'graphql');
    const methodIndex = args.indexOf('--method');
    const method = methodIndex === -1 ? 'GET' : args[methodIndex + 1];
    const input = options.input ? JSON.parse(options.input) : null;
    if (endpoint === 'graphql')
      return JSON.stringify({
        data: {
          viewer: { login },
          repository: {
            nameWithOwner: fullName,
            viewerPermission: permission,
            isArchived: false,
            defaultBranchRef: { name: 'main' },
          },
        },
      });
    if (method !== 'GET') {
      writes.push({ method, endpoint, input });
      if (pull && endpoint.endsWith('/pulls')) {
        const parts = input.head.split(':');
        const requestedOwner = parts.length === 2 ? parts[0] : fullName.split('/')[0];
        if (
          parts.length > 2 ||
          requestedOwner.toLowerCase() !== sourceOwner.toLowerCase() ||
          parts.at(-1) !== sourceBranch
        )
          throw new Error('requested head branch is unavailable in the source repository');
      }
      if (
        pull &&
        endpoint.endsWith('/pulls') &&
        sourceFullName !== fullName &&
        (sourceOwner === fullName.split('/')[0] || input.head_repo !== undefined) &&
        input.head_repo !== sourceFullName.split('/')[1]
      )
        throw new Error('fork request must select its actual head repository');
      const number = 10 + comments.length + issues.length;
      let published;
      if (method === 'PATCH')
        published = { ...target, ...input, updated_at: '2026-10-04T00:01:00Z' };
      else
        published = {
          id: number,
          number,
          node_id: 'I_created',
          ...input,
          user: { login },
          updated_at: '2026-10-04T00:01:00Z',
          html_url: `fixture://publication/${number}`,
          ...(pull
            ? {
                pull_request: { url: `fixture://pull/${number}` },
                base: { ref: baseBranch, sha: revision.baseSha },
                head: {
                  ref: sourceBranch,
                  sha: revision.headSha,
                  repo: { full_name: sourceFullName },
                },
              }
            : {}),
        };
      if (!unknown || applyUnknown) {
        if (endpoint.endsWith('/comments')) comments.push(published);
        else if (method === 'PATCH') Object.assign(target, published);
        else issues.push(published);
      }
      if (unknown) throw new Error('synthetic connection lost after possible server write');
      return JSON.stringify(
        pull && endpoint.endsWith('/pulls')
          ? { ...published, id: 100 + number, node_id: 'PR_created' }
          : published
      );
    }
    if (pull && endpoint === `repos/${sourceFullName}`)
      return JSON.stringify({ full_name: liveSourceName ?? sourceFullName });
    if (endpoint.includes('/issues/7/comments?')) return JSON.stringify(comments);
    if (pull && endpoint.includes('/branches/'))
      return JSON.stringify({
        commit: {
          sha:
            endpoint === `repos/${fullName}/branches/${encodeURIComponent(baseBranch)}`
              ? revision.baseSha
              : revision.headSha,
        },
        protected: protectedBranch,
      });
    if (pull && endpoint.includes('/compare/') && comparisonPages) {
      if (args.includes('--paginate'))
        return comparisonPages.map((page) => JSON.stringify(page)).join('\n');
      const commits = comparisonPages.flatMap((page) => page.commits);
      return JSON.stringify({
        total_commits: comparisonPages[0].total_commits,
        commits: commits.length > 250 ? commits.slice(0, 249).concat(commits.at(-1)) : commits,
      });
    }
    if (pull && endpoint.includes('/compare/'))
      return JSON.stringify({
        total_commits: 1,
        commits: [
          {
            sha: revision.headSha,
            author: { login: foreignCommit ? 'another-contributor' : login },
            committer: { login },
          },
        ],
      });
    if (pull && /\/pulls\/\d+$/.test(endpoint)) {
      const item = issues.find((item) => item.number === Number(endpoint.split('/').at(-1)));
      return JSON.stringify({ ...item, id: 100 + item.number, node_id: 'PR_created' });
    }
    if (/\/issues\/comments\/\d+$/.test(endpoint))
      return JSON.stringify(
        comments.find((item) => item.id === Number(endpoint.split('/').at(-1)))
      );
    if (endpoint.includes('/issues?')) return JSON.stringify(issues);
    if (/\/issues\/\d+$/.test(endpoint) && !endpoint.endsWith('/issues/7'))
      return JSON.stringify(
        issues.find((item) => item.number === Number(endpoint.split('/').at(-1)))
      );
    if (endpoint.endsWith('/issues/7')) {
      targetReads++;
      return JSON.stringify(
        targetChanged && targetReads > 1
          ? { ...target, body: 'Concurrent edit', updated_at: '2026-10-04T00:02:00Z' }
          : target
      );
    }
    throw new Error(`unexpected fixture endpoint: ${endpoint}`);
  };
  return { runner, writes, comments, issues, target };
}

function ownerFixture(f, { scopeIds = ['*'], actions = ['implement', 'collaborate'] } = {}) {
  // This disposable signer is a synthetic trust anchor, never a production grant.
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const statePath = path.join(f.directory, 'owner-state.json');
  const keyPath = path.join(f.directory, 'owner.pub');
  fs.writeFileSync(keyPath, publicKey.export({ type: 'spki', format: 'pem' }));
  const grant = {
    id: 'synthetic-publisher-owner',
    generation: 1,
    status: 'active',
    grantor: { login: 'cyjin-yl', id: 19223209 },
    actor: 'cyjin-yl',
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    actions,
    scopeIds,
    baseRefName: 'main',
    decisionReference: 'fixture:synthetic-owner-decision',
  };
  const save = (current = grant, revision = 1) => {
    const payload = {
      schemaVersion: 1,
      kind: 'proto-ui.owner-delegation-state',
      revision,
      grants: [current],
    };
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        payload,
        signature: sign(null, ownerDelegationSigningBytes(payload), privateKey).toString('base64'),
      })
    );
  };
  save();
  return {
    grant,
    save,
    args: [
      '--mode',
      'autonomous',
      '--mode-source',
      'schedule',
      '--authorization',
      grant.id,
      '--owner-authorization',
      statePath,
      '--owner-key',
      keyPath,
      '--owner-grant',
      grant.id,
      ...f.args.slice(LAUNCH.length),
    ],
  };
}

function localRepository(
  f,
  { branch = 'fixture-contributor-branch', defaultBranch = 'main' } = {}
) {
  const directory = path.join(f.directory, 'checkout');
  fs.mkdirSync(directory);
  const git = (args) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        PUI_AGENT: '0',
        GIT_AUTHOR_NAME: LOGIN,
        GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
        GIT_COMMITTER_NAME: LOGIN,
        GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  git(['init', '--initial-branch=main']);
  git(['config', 'user.name', LOGIN]);
  git(['config', 'user.email', 'fixture@example.invalid']);
  git(['config', 'commit.gpgsign', 'false']);
  git(['config', 'core.hooksPath', '.git/hooks']);
  const repositoryId = f.args[f.args.indexOf('--repository') + 1];
  git([
    'remote',
    'add',
    'origin',
    `https://github.com/${repositoryId.slice('github.com:'.length)}.git`,
  ]);
  fs.writeFileSync(path.join(directory, 'initial.txt'), 'Synthetic repository fixture\n');
  git(['add', 'initial.txt']);
  git(['commit', '-m', 'Synthetic fixture baseline']);
  git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  git(['checkout', '-b', 'fixture-contributor-branch']);
  if (branch !== 'fixture-contributor-branch') git(['branch', '-M', branch]);
  const before = git(['rev-parse', 'HEAD']).trim();
  fs.writeFileSync(
    path.join(directory, '.git/hooks/commit-msg'),
    `#!/bin/sh\nexec "${process.execPath}" "${PUBLISH_SCRIPT}" check-commit-message --message-file "$1"\n`,
    { mode: 0o700 }
  );
  fs.writeFileSync(path.join(directory, 'change.txt'), 'Synthetic contributor change\n');
  git(['add', 'change.txt']);
  const tree = git(['write-tree']).trim();
  const messagePath = path.join(directory, 'message.txt');
  fs.writeFileSync(messagePath, 'feat: synthetic fixture contributor commit\n');
  const commitAttempts = [];
  const repositoryMetadata = {
    full_name: repositoryId.slice('github.com:'.length),
    default_branch: defaultBranch,
  };
  const runner = (binary, args, options) => {
    if (binary === 'gh') {
      assert.deepEqual(args, ['api', `repos/${repositoryId.slice('github.com:'.length)}`]);
      assert.equal(options.input, undefined, 'commit repository metadata is read-only');
      return JSON.stringify(repositoryMetadata);
    }
    assert.equal(binary, 'git', 'commit fixtures allow only native Git and configured REST reads');
    if (args[0] === 'commit') commitAttempts.push([...args]);
    return execFileSync(binary, args, {
      ...options,
      env: {
        ...(options.env ?? process.env),
        GIT_AUTHOR_NAME: LOGIN,
        GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
        GIT_COMMITTER_NAME: LOGIN,
        GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      },
    });
  };
  return {
    directory,
    git,
    before,
    tree,
    runner,
    commitAttempts,
    repositoryMetadata,
    args: [
      '--message-file',
      messagePath,
      '--branch',
      branch,
      '--expected-head',
      before,
      '--expected-tree',
      tree,
    ],
  };
}

for (const declaration of ['--record', '--context', '--mode', '--mode-source', '--authorization']) {
  test(`rejects missing ${declaration} before mutation`, (t) => {
    // Parser rejection does not need successful synthetic fingerprint samples.
    const f = fixture(t, { failed: true });
    const argv = ['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath];
    const index = argv.indexOf(declaration);
    argv.splice(index, 2);
    let calls = 0;
    assert.throws(
      () =>
        runPublishCli(argv, {
          runner() {
            calls++;
            throw new Error('unexpected IO');
          },
        }),
      /required/
    );
    assert.equal(calls, 0);
  });
}

test('strict options and independent authorization cannot be supplied by an artifact', (t) => {
  // These checks inspect declarations only, never execute the fingerprint scorer.
  const f = fixture(t, { failed: true });
  const argv = ['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath];
  assert.throws(() => parsePublishCli([...argv, '--labels', 'feature']), /unexpected option/);
  assert.throws(() => parsePublishCli([...argv, '--record', f.recordPath]), /duplicate option/);
  assert.throws(
    () =>
      parsePublishCli(
        argv.map((arg) => (arg === 'explicit-current-user' ? 'standing-maintainer-scope' : arg))
      ),
    /standing scopes/
  );
  assert.throws(
    () =>
      parsePublishCli(
        argv
          .map((arg) => (arg === 'human-assisted' ? 'autonomous' : arg))
          .map((arg) => (arg === 'current-user' ? 'schedule' : arg))
      ),
    /autonomous execution/
  );
});

test('missing records are rejected before even a live permission read', (t) => {
  const f = fixture(t, { failed: true });
  const argv = ['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath];
  let calls = 0;
  const runner = () => {
    calls++;
    throw new Error('unexpected IO');
  };
  fs.rmSync(f.recordPath);
  assert.throws(() => runPublishCli(argv, { runner }), /ENOENT/);
  assert.equal(calls, 0);
});

test('expired commit records cannot enter historical reconciliation or attempt git operations', (t) => {
  const f = fixture(t, { failed: true });
  const argv = [
    'commit',
    ...f.args,
    '--message-file',
    f.bodyPath,
    '--branch',
    'fixture-contributor-branch',
    '--expected-head',
    'c'.repeat(40),
    '--expected-tree',
    'd'.repeat(40),
  ];
  let calls = 0;
  const runner = () => {
    calls++;
    throw new Error('unexpected IO');
  };
  assert.throws(
    () => runPublishCli(argv, { runner, now: new Date(f.record.receipt.expiresAt) }),
    /expired/
  );
  assert.equal(calls, 0);
});

test('publishes full-length evidence to a historical CLOSED Issue with a synthetic receipt and exact readback', (t) => {
  const f = fixture(t, {
    body: `Synthetic long evidence\n${'subject evidence '.repeat(3200)}\n\n`,
  });
  const gh = server();
  const argv = ['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath];
  const result = runPublishCli(argv, { runner: gh.runner, now: f.now });
  assert.equal(result.status, 'published');
  assert.equal(gh.writes.length, 1);
  assert.equal(gh.comments[0].body.slice(0, f.body.length), f.body);
  assert.ok(gh.comments[0].body.includes(renderModelTraceDisclosure(f.record.receipt)));
  assert.ok(!gh.comments[0].body.includes(f.context.sessionId));
  assert.equal(gh.target.state, 'closed');
  assert.equal(runPublishCli(argv, { runner: gh.runner, now: f.now }).status, 'already-published');
  assert.equal(gh.writes.length, 1);
});

test('Issue create publishes its authorized evidence body once', (t) => {
  const f = fixture(t, { failed: true });
  const gh = server();
  const result = runPublishCli(
    ['issue', 'create', ...f.args, '--title', 'Synthetic offline issue', '--body-file', f.bodyPath],
    { runner: gh.runner, now: f.now }
  );
  assert.equal(result.status, 'published');
  assert.equal(gh.issues.length, 1);
  assert.equal(gh.writes.length, 1);
  assert.ok(gh.issues[0].body.startsWith(f.body));
  assert.ok(gh.issues[0].body.includes(renderModelTraceDisclosure(f.record.receipt)));
});

test('GitHub repository casing aliases cannot duplicate a prepared comment', (t) => {
  const f = fixture(t, { failed: true });
  const gh = server();
  const runner = (binary, args, options) =>
    gh.runner(
      binary,
      args.map((arg) =>
        arg.replace(
          'repos/FIXTURE-OWNER/FIXTURE-REPOSITORY',
          'repos/fixture-owner/fixture-repository'
        )
      ),
      options
    );
  const argv = ['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath];
  const first = runPublishCli(argv, { runner, now: f.now });
  argv[argv.indexOf('--repository') + 1] = 'github.com:FIXTURE-OWNER/FIXTURE-REPOSITORY';
  const repeated = runPublishCli(argv, { runner, now: f.now });
  assert.equal(repeated.status, 'already-published');
  assert.equal(repeated.url, first.url);
  assert.equal(gh.comments.length, 1);
  assert.equal(gh.writes.length, 1);
});

test('a later compact JSON page preserves multiline evidence and prevents duplicate publication', (t) => {
  const f = fixture(t, {
    failed: true,
    body: 'Synthetic evidence line one.\nLine two remains intact.\n',
  });
  const gh = server();
  const argv = ['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath];
  assert.equal(runPublishCli(argv, { runner: gh.runner, now: f.now }).status, 'published');
  const runner = (binary, args, options) => {
    if (args.some((arg) => arg.includes('/issues/7/comments?'))) {
      return `${JSON.stringify([{ id: 99, body: 'Unrelated earlier page' }])}\n${JSON.stringify(gh.comments)}\n`;
    }
    return gh.runner(binary, args, options);
  };
  assert.equal(runPublishCli(argv, { runner, now: f.now }).status, 'already-published');
  assert.ok(gh.comments[0].body.startsWith(f.body));
  assert.equal(gh.writes.length, 1);
});

test('missing pagination frames are not an empty collection and cannot authorize a duplicate write', (t) => {
  const f = fixture(t, { failed: true });
  const gh = server();
  const runner = (binary, args, options) =>
    args.some((arg) => arg.includes('/issues/7/comments?'))
      ? ' \n\t'
      : gh.runner(binary, args, options);
  assert.throws(
    () =>
      runPublishCli(['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath], {
        runner,
        now: f.now,
      }),
    /page evidence/
  );
  assert.equal(gh.writes.length, 0);
});

test('PR creation preserves authorized collaborative history at the exact pushed source', (t) => {
  const f = fixture(t, { failed: true });
  const gh = server({ pull: true, foreignCommit: true });
  const argv = [
    'pull-request',
    'create',
    ...f.args,
    '--title',
    'Synthetic offline PR',
    '--body-file',
    f.bodyPath,
    '--base',
    'main',
    '--head',
    'fixture-contributor-branch',
  ];
  assert.equal(runPublishCli(argv, { runner: gh.runner, now: f.now }).status, 'published');
  assert.ok(gh.issues[0].body.includes(renderModelTraceDisclosure(f.record.receipt)));
  assert.equal(gh.writes.length, 1);
});

function completeComparisonPages() {
  const commits = Array.from({ length: 251 }, (_, index) => ({
    sha: index === 250 ? 'c'.repeat(40) : index.toString(16).padStart(40, '0'),
    author: { login: LOGIN },
    committer: { login: LOGIN },
  }));
  return [commits.slice(0, 100), commits.slice(100, 200), commits.slice(200)].map((page) => ({
    total_commits: commits.length,
    commits: page,
  }));
}

function createComparedPull(f, gh) {
  return runPublishCli(
    [
      'pull-request',
      'create',
      ...f.args,
      '--title',
      'Synthetic paginated source PR',
      '--body-file',
      f.bodyPath,
      '--base',
      'main',
      '--head',
      'fixture-contributor-branch',
    ],
    { runner: gh.runner, now: f.now }
  );
}

test('complete contributor comparisons beyond the unpaged API limit can publish once', (t) => {
  const f = fixture(t, { failed: true });
  const gh = server({ pull: true, comparisonPages: completeComparisonPages() });
  const first = createComparedPull(f, gh);
  assert.equal(first.status, 'published');
  assert.equal(createComparedPull(f, gh).url, first.url);
  assert.equal(gh.issues.length, 1);
  assert.equal(gh.writes.length, 1);
});

test('a missing comparison page cannot create a partially attributed PR', (t) => {
  const f = fixture(t, { failed: true });
  const gh = server({ pull: true, comparisonPages: completeComparisonPages().slice(0, 2) });
  assert.throws(() => createComparedPull(f, gh), /complete PR contributor commit attribution/);
  assert.equal(gh.issues.length, 0);
  assert.equal(gh.writes.length, 0);
});

test('repeating a comparison page cannot masquerade as complete contributor evidence', (t) => {
  const f = fixture(t, { failed: true });
  const pages = completeComparisonPages();
  const gh = server({ pull: true, comparisonPages: [pages[0], pages[0], pages[2]] });
  assert.throws(() => createComparedPull(f, gh), /complete PR contributor commit attribution/);
  assert.equal(gh.issues.length, 0);
  assert.equal(gh.writes.length, 0);
});

test('a public READ contributor can propose the exact fork head without rewriting protected collaborative history', (t) => {
  const f = fixture(t, { failed: true });
  const gh = server({
    pull: true,
    permission: 'READ',
    sourceOwner: LOGIN,
    protectedBranch: true,
    foreignCommit: true,
  });
  const head = `${LOGIN}:fixture-contributor-branch`;
  const result = runPublishCli(
    [
      'pull-request',
      'create',
      ...f.args,
      '--title',
      'Synthetic fork PR',
      '--body-file',
      f.bodyPath,
      '--base',
      'main',
      '--head',
      head,
    ],
    { runner: gh.runner, now: f.now }
  );
  assert.equal(result.status, 'published');
  assert.equal(gh.writes.length, 1);
});

for (const sourceOwner of [LOGIN, 'fixture-owner']) {
  test(`renamed ${sourceOwner} fork publishes once and reconciles its actual source repository`, (t) => {
    const f = fixture(t, { failed: true });
    const gh = server({ pull: true, sourceOwner, sourceName: 'renamed-fork' });
    const argv = [
      'pull-request',
      'create',
      ...f.args,
      '--title',
      'Synthetic renamed fork',
      '--body-file',
      f.bodyPath,
      '--base',
      'main',
      '--head',
      `${sourceOwner}:fixture-contributor-branch`,
    ];
    const published = runPublishCli(argv, { runner: gh.runner, now: f.now });
    assert.equal(published.status, 'published');
    const repeated = runPublishCli(argv, { runner: gh.runner, now: f.now });
    assert.equal(repeated.status, 'already-published');
    assert.equal(repeated.url, published.url);
    assert.equal(gh.writes.length, 1);
  });
}

test('a fork default branch can propose the same base name or a different upstream base', (t) => {
  for (const [sourceOwner, baseBranch] of [
    [LOGIN, 'main'],
    ['fixture-owner', 'develop'],
  ]) {
    const f = fixture(t, { failed: true });
    const gh = server({
      pull: true,
      sourceOwner,
      sourceName: 'renamed-fork',
      sourceBranch: 'main',
      baseBranch,
    });
    const argv = [
      'pull-request',
      'create',
      ...f.args,
      '--title',
      'Synthetic default branch fork',
      '--body-file',
      f.bodyPath,
      '--base',
      baseBranch,
      '--head',
      `${sourceOwner}:main`,
    ];
    const published = runPublishCli(argv, { runner: gh.runner, now: f.now });
    assert.equal(published.status, 'published');
    assert.equal(
      runPublishCli(argv, { runner: gh.runner, now: f.now }).status,
      'already-published'
    );
    assert.equal(gh.writes.length, 1);
  }
});

test('same-repository base and default branches cannot become contributor PR heads', (t) => {
  for (const [sourceBranch, baseBranch] of [
    ['develop', 'develop'],
    ['main', 'develop'],
  ]) {
    const f = fixture(t, { failed: true });
    const gh = server({ pull: true, sourceBranch, baseBranch });
    assert.throws(() =>
      runPublishCli(
        [
          'pull-request',
          'create',
          ...f.args,
          '--title',
          'Synthetic same repository branch',
          '--body-file',
          f.bodyPath,
          '--base',
          baseBranch,
          '--head',
          sourceBranch,
        ],
        { runner: gh.runner, now: f.now }
      )
    );
    assert.equal(gh.writes.length, 0);
  }
});

test('fork creation rejects a changed live source identity before publication', (t) => {
  const f = fixture(t, { failed: true });
  const gh = server({
    pull: true,
    sourceOwner: LOGIN,
    sourceName: 'renamed-fork',
    liveSourceName: `${LOGIN}/different-repository`,
  });
  assert.throws(
    () =>
      runPublishCli(
        [
          'pull-request',
          'create',
          ...f.args,
          '--title',
          'Synthetic renamed fork',
          '--body-file',
          f.bodyPath,
          '--base',
          'main',
          '--head',
          `${LOGIN}:fixture-contributor-branch`,
        ],
        { runner: gh.runner, now: f.now }
      ),
    /source repository differs/
  );
  assert.equal(gh.writes.length, 0);
});

test('already disclosed approved evidence is published byte-for-byte without another marker', (t) => {
  const f = fixture(t, { failed: true });
  const approvedBody = `Synthetic approved evidence.  \n\n${renderModelTraceDisclosure(f.record.receipt)}\n\n<!-- approved-evidence:fixture -->\n`;
  fs.writeFileSync(f.bodyPath, approvedBody);
  const gh = server({ permission: 'READ' });
  const result = runPublishCli(['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath], {
    runner: gh.runner,
    now: f.now,
  });
  assert.equal(result.status, 'published');
  assert.equal(gh.comments[0].body, approvedBody);
  assert.equal(sha256(gh.comments[0].body), sha256(approvedBody));
});

test('Issue creation can reuse disclosed bytes without borrowing another title or a PR identity', (t) => {
  for (const priorKind of ['different-title-issue', 'same-title-pr']) {
    const f = fixture(t, { failed: true });
    const body = `Synthetic reused template.\n\n${renderModelTraceDisclosure(f.record.receipt)}\n`;
    fs.writeFileSync(f.bodyPath, body);
    const gh = server();
    const title = 'Distinct legitimate Issue';
    gh.issues.push({
      id: 61,
      number: 61,
      node_id: priorKind === 'same-title-pr' ? 'PR_prior' : 'I_prior',
      title: priorKind === 'same-title-pr' ? title : 'Earlier different Issue',
      body,
      state: 'closed',
      locked: false,
      updated_at: '2026-10-04T00:00:00Z',
      user: { login: LOGIN },
      html_url: 'fixture://prior/61',
      ...(priorKind === 'same-title-pr' ? { pull_request: { url: 'fixture://prior-pr/61' } } : {}),
    });
    const argv = ['issue', 'create', ...f.args, '--title', title, '--body-file', f.bodyPath];
    const result = runPublishCli(argv, { runner: gh.runner, now: f.now });
    assert.equal(result.status, 'published');
    assert.equal(gh.writes.length, 1);
    assert.equal(gh.issues[1].title, title);
    assert.equal(gh.issues[1].body, body);
    assert.equal(gh.issues[1].pull_request, undefined);
    const repeated = runPublishCli(argv, { runner: gh.runner, now: f.now });
    assert.equal(repeated.status, 'already-published');
    assert.equal(repeated.url, result.url);
    assert.equal(gh.writes.length, 1);
  }
});

for (const command of ['issue create', 'pull-request create', 'comment', 'update-body']) {
  for (const prior of ['acknowledged', 'disclosed', 'lost-acknowledgement', 'absent']) {
    const outcome =
      prior === 'absent'
        ? 'cannot authorize a new write'
        : `reconciles ${prior} publication without a second write`;
    test(`${command} expired record ${outcome}`, (t) => {
      const f = fixture(t, { failed: true });
      if (prior === 'disclosed')
        fs.writeFileSync(
          f.bodyPath,
          `${f.body}\n${renderModelTraceDisclosure(f.record.receipt)}\n`
        );
      const gh = server({
        pull: command === 'pull-request create',
        unknown: prior === 'lost-acknowledgement',
        applyUnknown: prior === 'lost-acknowledgement',
      });
      const argv = [command.split(' '), f.args, '--body-file', f.bodyPath].flat();
      if (command.endsWith(' create')) argv.push('--title', 'Synthetic historical publication');
      if (command === 'pull-request create')
        argv.push('--base', 'main', '--head', 'fixture-contributor-branch');
      if (command === 'comment' || command === 'update-body') argv.push('--number', '7');
      if (command === 'update-body')
        argv.push(
          '--target-updated-at',
          gh.target.updated_at,
          '--target-body-digest',
          sha256(gh.target.body)
        );
      let acknowledged;
      if (prior === 'lost-acknowledgement')
        assert.throws(
          () => runPublishCli(argv, { runner: gh.runner, now: f.now }),
          PublicationUnknown
        );
      else if (prior !== 'absent') {
        acknowledged = runPublishCli(argv, { runner: gh.runner, now: f.now });
        assert.equal(acknowledged.status, 'published');
      }
      const atExpiry = new Date(f.record.receipt.expiresAt);
      if (prior === 'absent') {
        assert.throws(() => runPublishCli(argv, { runner: gh.runner, now: atExpiry }), /expired/);
        assert.equal(gh.writes.length, 0);
      } else {
        const published =
          command === 'comment'
            ? gh.comments[0]
            : command === 'update-body'
              ? gh.target
              : gh.issues[0];
        const originalBody = published.body;
        const result = runPublishCli(argv, { runner: gh.runner, now: atExpiry });
        assert.equal(result.status, 'already-published');
        assert.equal(result.url, acknowledged?.url ?? published.html_url);
        assert.equal(published.body, originalBody);
        assert.equal(gh.writes.length, 1);
      }
    });
  }

  test(`${command} appends a current visible receipt after prepared Markdown examples`, (t) => {
    const f = fixture(t, { failed: true });
    const disclosure = renderModelTraceDisclosure(f.record.receipt);
    const prepared = `Disclosure format examples, not a live declaration.\n\n\`\`\`\`markdown\n${disclosure}\n\`\`\`\`\n\n<!--\n## ModelTrace\nExample only.\n-->\n\n> ## ModelTrace\n> Quoted example only.\n`;
    fs.writeFileSync(f.bodyPath, prepared);
    const gh = server({ pull: command === 'pull-request create' });
    const argv = [command.split(' '), f.args, '--body-file', f.bodyPath].flat();
    if (command.endsWith(' create')) argv.push('--title', 'Synthetic disclosure examples');
    if (command === 'pull-request create')
      argv.push('--base', 'main', '--head', 'fixture-contributor-branch');
    if (command === 'comment' || command === 'update-body') argv.push('--number', '7');
    if (command === 'update-body')
      argv.push(
        '--target-updated-at',
        gh.target.updated_at,
        '--target-body-digest',
        sha256(gh.target.body)
      );
    const result = runPublishCli(argv, { runner: gh.runner, now: f.now });
    assert.equal(result.status, 'published');
    const published =
      command === 'comment' ? gh.comments[0] : command === 'update-body' ? gh.target : gh.issues[0];
    assert.equal(published.body.slice(0, prepared.length), prepared);
    assertModelTraceDisclosure(published.body, f.record.receipt);
    assert.ok(!published.body.includes(f.context.sessionId));
    assert.equal(gh.writes.length, 1);
    const repeated = runPublishCli(argv, { runner: gh.runner, now: f.now });
    assert.equal(repeated.status, 'already-published');
    assert.equal(repeated.url, result.url);
    assert.equal(gh.writes.length, 1);
  });
}

test('historical publication readback rejects changed private scope and tampered raw records before transport', (t) => {
  for (const changed of ['repository', 'session', 'context', 'route', 'declared', 'record']) {
    const f = fixture(t, { failed: true });
    const gh = server();
    const argv = ['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath];
    assert.equal(runPublishCli(argv, { runner: gh.runner, now: f.now }).status, 'published');
    const context = structuredClone(f.context);
    if (changed === 'repository') context.repositoryId = 'github.com:other-owner/other-repo';
    if (changed === 'session') context.sessionId = randomBytes(32).toString('hex');
    if (changed === 'context') context.contextDigest = 'c'.repeat(64);
    if (changed === 'route') context.routeDigest = 'd'.repeat(64);
    if (changed === 'declared') context.declared.systemModel = 'different-synthetic-fixture';
    fs.writeFileSync(f.contextPath, JSON.stringify(context));
    if (changed === 'record') {
      const record = structuredClone(f.record);
      record.response.completedAt = new Date(
        Date.parse(record.response.completedAt) + 1
      ).toISOString();
      fs.writeFileSync(f.recordPath, JSON.stringify(record));
    }
    let reads = 0;
    const runner = (...args) => {
      reads++;
      return gh.runner(...args);
    };
    assert.throws(
      () => runPublishCli(argv, { runner, now: new Date(f.record.receipt.expiresAt) }),
      changed === 'record'
        ? /does not reproduce/
        : changed === 'declared'
          ? /labels changed/
          : /repository\/session\/context\/provider route changed/
    );
    assert.equal(reads, 0);
    assert.equal(gh.writes.length, 1);
  }
});

test('expired reconciliation cannot borrow a marker with altered full body or a different actor', (t) => {
  for (const changed of ['body', 'actor']) {
    const f = fixture(t, { failed: true });
    const gh = server();
    const argv = ['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath];
    assert.equal(runPublishCli(argv, { runner: gh.runner, now: f.now }).status, 'published');
    if (changed === 'body') gh.comments[0].body = `Altered content\n${gh.comments[0].body}`;
    else gh.comments[0].user.login = 'another-contributor';
    assert.throws(
      () => runPublishCli(argv, { runner: gh.runner, now: new Date(f.record.receipt.expiresAt) }),
      /full body or author does not match/
    );
    assert.equal(gh.writes.length, 1);
  }
});

test('expired reconciliation cannot borrow a PR with a changed published revision', (t) => {
  const f = fixture(t, { failed: true });
  const gh = server({ pull: true });
  const argv = [
    'pull-request',
    'create',
    ...f.args,
    '--title',
    'Synthetic revision-bound publication',
    '--body-file',
    f.bodyPath,
    '--base',
    'main',
    '--head',
    'fixture-contributor-branch',
  ];
  assert.equal(runPublishCli(argv, { runner: gh.runner, now: f.now }).status, 'published');
  gh.issues[0].head.sha = 'e'.repeat(40);
  assert.throws(
    () => runPublishCli(argv, { runner: gh.runner, now: new Date(f.record.receipt.expiresAt) }),
    /existing PR head\/base binding changed/
  );
  assert.equal(gh.writes.length, 1);
});

test('record expiry during read-only preflight prevents the first mutation', (t) => {
  const f = fixture(t, { failed: true });
  const gh = server();
  const clock = new Date(f.now);
  const runner = (binary, args, options) => {
    const result = gh.runner(binary, args, options);
    if (args.some((arg) => arg.includes('/issues/7/comments?')))
      clock.setTime(Date.parse(f.record.receipt.expiresAt));
    return result;
  };
  assert.throws(
    () =>
      runPublishCli(['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath], {
        runner,
        now: clock,
      }),
    /expired/
  );
  assert.equal(gh.writes.length, 0);
});

test('visible wrong malformed or duplicate receipts and still-hidden appends cannot reach a GitHub mutation', (t) => {
  const f = fixture(t, { failed: true });
  const disclosure = renderModelTraceDisclosure(f.record.receipt);
  for (const invalid of [
    disclosure.replace(f.record.receipt.id, `sha256:${'f'.repeat(64)}`),
    disclosure.replace('"result"', '"res<!--x-->ult"'),
    `${disclosure}\n\n${disclosure}`,
    '## ModelTrace\n\n```json\n{}\n```\n',
    `<div>\n<!--\n</div>\n\n${disclosure}`,
    `<hr>\n<!--\n\n${disclosure}`,
    `<p>\n<!--\n</p>\n\n${disclosure}`,
  ]) {
    fs.writeFileSync(f.bodyPath, invalid);
    const gh = server();
    assert.throws(
      () =>
        runPublishCli(['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath], {
          runner: gh.runner,
          now: f.now,
        }),
      /visible.*exact/
    );
    assert.equal(gh.writes.length, 0);
  }
});

for (const applied of [false, true]) {
  test(`lost acknowledgement remains unattributable ${applied ? 'with an exact observed publication' : 'without an observed publication'}`, (t) => {
    const f = fixture(t, { failed: true });
    const gh = server({ unknown: true, applyUnknown: applied });
    const argv = ['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath];
    assert.throws(() => runPublishCli(argv, { runner: gh.runner, now: f.now }), PublicationUnknown);
    if (applied)
      assert.equal(
        runPublishCli(argv, { runner: gh.runner, now: f.now }).status,
        'already-published'
      );
    assert.equal(gh.writes.length, 1);
  });
}

test('truncated or altered acknowledged body is unknown, not compensated with another comment', (t) => {
  const f = fixture(t, { failed: true });
  const gh = server();
  const runner = (binary, args, options) => {
    const result = gh.runner(binary, args, options);
    if (gh.writes.length && gh.comments.length)
      gh.comments[0].body = gh.comments[0].body.replace('Synthetic offline', 'Tampered');
    return result;
  };
  assert.throws(
    () =>
      runPublishCli(['comment', ...f.args, '--number', '7', '--body-file', f.bodyPath], {
        runner,
        now: f.now,
      }),
    PublicationUnknown
  );
  assert.equal(gh.writes.length, 1);
});

for (const changed of [false, true]) {
  test(`body replacement ${changed ? 'rejects a concurrent target edit' : 'changes only owned exact target body'}`, (t) => {
    const f = fixture(t, { failed: true });
    const gh = server({ targetChanged: changed });
    const argv = [
      'update-body',
      ...f.args,
      '--number',
      '7',
      '--body-file',
      f.bodyPath,
      '--target-updated-at',
      gh.target.updated_at,
      '--target-body-digest',
      sha256(gh.target.body),
    ];
    if (changed)
      assert.throws(
        () => runPublishCli(argv, { runner: gh.runner, now: f.now }),
        /changed before write/
      );
    else {
      assert.equal(runPublishCli(argv, { runner: gh.runner, now: f.now }).status, 'published');
      assert.deepEqual(Object.keys(gh.writes[0].input), ['body']);
      assert.equal(gh.target.state, 'closed');
    }
    assert.equal(gh.writes.length, changed ? 0 : 1);
  });
}

test('body replacement rejects stale prepared bindings and another author without compensation', (t) => {
  const f = fixture(t, { failed: true });
  const gh = server();
  const argv = [
    'update-body',
    ...f.args,
    '--number',
    '7',
    '--body-file',
    f.bodyPath,
    '--target-updated-at',
    gh.target.updated_at,
    '--target-body-digest',
    sha256('Not the current body'),
  ];
  assert.throws(
    () => runPublishCli(argv, { runner: gh.runner, now: f.now }),
    /exact current target/
  );
  gh.target.user.login = 'another-contributor';
  assert.throws(() => runPublishCli(argv, { runner: gh.runner, now: f.now }), /credential-owned/);
  assert.equal(gh.writes.length, 0);
});

test('hook exempts human commits and rejects missing or expired Agent disclosures independently', (t) => {
  assert.deepEqual(runCommitMessageHook('/does-not-exist', { env: {} }), {
    status: 'human-exempt',
  });
  const human = spawnSync('sh', [HOOK_SCRIPT, '/does-not-exist'], {
    env: { ...process.env, PUI_AGENT: '0' },
    encoding: 'utf8',
  });
  assert.equal(human.status, 0);
  assert.throws(
    () => runCommitMessageHook('/does-not-exist', { env: { PUI_AGENT: '1' } }),
    /requires PUI_MODELTRACE_RECORD/
  );
  const f = fixture(t, { failed: true });
  const messagePath = path.join(f.directory, 'message.txt');
  const message = `Synthetic commit\n\n${renderModelTraceDisclosure(f.record.receipt, 'commit')}\n`;
  fs.writeFileSync(messagePath, message);
  const runner = () => 'https://github.com/fixture-owner/fixture-repository.git\n';
  assert.equal(
    runCommitMessageHook(messagePath, { env: f.env, runner, now: f.now }).status,
    'validated'
  );
  assert.throws(
    () =>
      runCommitMessageHook(messagePath, {
        env: f.env,
        runner,
        now: new Date(f.record.receipt.expiresAt),
      }),
    /expired/
  );
  fs.writeFileSync(
    messagePath,
    message.replace('Synthetic commit', 'Synthetic commit\nModelTrace: forged')
  );
  assert.throws(
    () => runCommitMessageHook(messagePath, { env: f.env, runner, now: f.now }),
    /exactly one/
  );
  fs.writeFileSync(messagePath, message.trimEnd() + ' forged suffix\n');
  assert.throws(
    () => runCommitMessageHook(messagePath, { env: f.env, runner, now: f.now }),
    /exact current disclosure/
  );
  fs.writeFileSync(messagePath, 'Synthetic commit without identity\n');
  assert.throws(
    () => runCommitMessageHook(messagePath, { env: f.env, runner, now: f.now }),
    /exactly one/
  );
});

test('contributor commit executes git signoff and the independent installed hook in a throwaway repository', (t) => {
  const f = fixture(t, { failed: true });
  const { git, before, runner, args, directory, commitAttempts } = localRepository(f);
  const observedRunner = (binary, argv, options) => {
    if (binary === 'git' && argv[0] === 'commit') {
      const child = execFileSync(
        process.execPath,
        [
          '-e',
          "console.log(JSON.stringify({agent:Object.hasOwn(process.env,'PUI_AGENT_NAME'),exemption:Object.hasOwn(process.env,'PUI_DOT_MODELTRACE_EXEMPTION'),record:process.env.PUI_MODELTRACE_RECORD,context:process.env.PUI_MODELTRACE_CONTEXT}))",
        ],
        { env: options.env, encoding: 'utf8' }
      );
      assert.deepEqual(JSON.parse(child), {
        agent: false,
        exemption: false,
        record: f.recordPath,
        context: f.contextPath,
      });
    }
    return runner(binary, argv, options);
  };
  const result = runPublishCli(['commit', ...f.args, ...args], {
    runner: observedRunner,
    cwd: directory,
  });
  assert.equal(result.status, 'published');
  assert.notEqual(git(['rev-parse', 'HEAD']).trim(), before);
  assert.equal(git(['rev-parse', `${result.head}^1`]).trim(), before);
  assert.equal(commitAttempts.length, 1);
  const committed = git(['log', '-1', '--format=format:%B']);
  const disclosure = renderModelTraceDisclosure(f.record.receipt, 'commit');
  assert.equal(
    committed,
    `feat: synthetic fixture contributor commit\n\n${disclosure}\nSigned-off-by: ${LOGIN} <fixture@example.invalid>\n`
  );
});

test('commit.cleanup=strip cannot alter the authorized message when cleanup=verbatim is used', (t) => {
  const f = fixture(t, { failed: true });
  const { git, before, runner, args, directory, commitAttempts } = localRepository(f);
  git(['config', 'commit.cleanup', 'strip']);
  const messagePath = path.join(directory, 'message.txt');
  fs.writeFileSync(messagePath, 'feat: synthetic fixture\n\n# internal comment\n  indented text\n');
  const result = runPublishCli(['commit', ...f.args, ...args], { runner, cwd: directory });
  assert.equal(result.status, 'published');
  assert.equal(commitAttempts.length, 1);
  const committed = git(['log', '-1', '--format=format:%B']);
  const disclosure = renderModelTraceDisclosure(f.record.receipt, 'commit');
  assert.equal(
    committed,
    `feat: synthetic fixture\n\n# internal comment\n  indented text\n\n${disclosure}\nSigned-off-by: ${LOGIN} <fixture@example.invalid>\n`
  );
});

test('a native commit with an altered authorized body cannot report publication success', (t) => {
  const f = fixture(t, { failed: true });
  const local = localRepository(f);
  const runner = (binary, args, options) => {
    if (binary === 'git' && args[0] === 'commit') {
      const messagePath = args[args.indexOf('--file') + 1];
      fs.writeFileSync(messagePath, `Unapproved body\n${fs.readFileSync(messagePath, 'utf8')}`);
    }
    return local.runner(binary, args, options);
  };
  assert.throws(
    () => runPublishCli(['commit', ...f.args, ...local.args], { runner, cwd: local.directory }),
    PublicationUnknown
  );
  assert.equal(local.commitAttempts.length, 1);
  const committed = local.git(['log', '-1', '--format=format:%B']);
  assert.ok(committed.startsWith('Unapproved body\n'));
  assertModelTraceDisclosure(committed, f.record.receipt, 'commit');
});

test('configured log output encoding cannot change the verified stored message', (t) => {
  const f = fixture(t, { failed: true });
  const local = localRepository(f);
  local.git(['config', 'i18n.commitEncoding', 'UTF-8']);
  local.git(['config', 'i18n.logOutputEncoding', 'ISO-8859-1']);
  fs.writeFileSync(path.join(local.directory, 'message.txt'), 'feat: café\n');
  const result = runPublishCli(['commit', ...f.args, ...local.args], {
    runner: local.runner,
    cwd: local.directory,
  });
  assert.equal(result.status, 'published');
  assert.equal(local.commitAttempts.length, 1);
  const object = local.git(['cat-file', 'commit', result.head]);
  const message = object.slice(object.indexOf('\n\n') + 2);
  assert.equal(
    message,
    `feat: café\n\n${renderModelTraceDisclosure(f.record.receipt, 'commit')}\nSigned-off-by: ${LOGIN} <fixture@example.invalid>\n`
  );
});

for (const defaultBranch of ['develop', 'trunk']) {
  test(`a native commit cannot write the actual repository default ${defaultBranch}`, (t) => {
    const f = fixture(t, { failed: true });
    const local = localRepository(f, { branch: defaultBranch, defaultBranch });
    assert.throws(
      () =>
        runPublishCli(['commit', ...f.args, ...local.args], {
          runner: local.runner,
          cwd: local.directory,
          now: f.now,
        }),
      /not a default branch/
    );
    assert.equal(local.commitAttempts.length, 0);
    assert.equal(local.git(['rev-parse', 'HEAD']).trim(), local.before);
    assert.equal(local.git(['write-tree']).trim(), local.tree);
  });
}

for (const [branch, defaultBranch] of [
  ['main', 'develop'],
  ['master', 'trunk'],
]) {
  test(`an authorized native ${branch} commit publishes once when the actual default is ${defaultBranch}`, (t) => {
    const f = fixture(t, { failed: true });
    const local = localRepository(f, { branch, defaultBranch });
    local.repositoryMetadata.full_name = local.repositoryMetadata.full_name.toUpperCase();
    const result = runPublishCli(['commit', ...f.args, ...local.args], {
      runner: local.runner,
      cwd: local.directory,
      now: f.now,
    });
    assert.equal(result.status, 'published');
    assert.equal(local.commitAttempts.length, 1);
    assert.equal(local.git(['rev-parse', 'HEAD']).trim(), result.head);
    assert.equal(local.git(['rev-list', '--count', `${local.before}..HEAD`]).trim(), '1');
    assert.equal(local.git(['rev-parse', `${result.head}^1`]).trim(), local.before);
    assert.equal(local.git(['rev-parse', `${result.head}^{tree}`]).trim(), local.tree);
    const committed = local.git(['log', '-1', '--format=%B', result.head]);
    assertModelTraceDisclosure(committed, f.record.receipt, 'commit');
    assert.ok(committed.includes(`Signed-off-by: ${LOGIN} <fixture@example.invalid>`));
  });
}

for (const [boundary, metadata] of [
  ['missing repository', null],
  ['missing repository identity', { default_branch: 'develop' }],
  [
    'foreign repository',
    { full_name: 'another-owner/fixture-repository', default_branch: 'develop' },
  ],
  ['missing default branch', { full_name: 'fixture-owner/fixture-repository' }],
  ['empty default branch', { full_name: 'fixture-owner/fixture-repository', default_branch: '' }],
  [
    'non-string default branch',
    { full_name: 'fixture-owner/fixture-repository', default_branch: 7 },
  ],
  [
    'invalid branch name',
    { full_name: 'fixture-owner/fixture-repository', default_branch: 'invalid branch' },
  ],
  [
    'checkout shorthand',
    { full_name: 'fixture-owner/fixture-repository', default_branch: '@{-1}' },
  ],
]) {
  test(`${boundary} REST metadata cannot authorize a native commit`, (t) => {
    const f = fixture(t, { failed: true });
    const local = localRepository(f);
    const runner = (binary, args, options) => {
      if (binary === 'gh') {
        local.runner(binary, args, options);
        return JSON.stringify(metadata);
      }
      return local.runner(binary, args, options);
    };
    assert.throws(() =>
      runPublishCli(['commit', ...f.args, ...local.args], {
        runner,
        cwd: local.directory,
        now: f.now,
      })
    );
    assert.equal(local.commitAttempts.length, 0);
    assert.equal(local.git(['rev-parse', 'HEAD']).trim(), local.before);
    assert.equal(local.git(['write-tree']).trim(), local.tree);
  });
}

test('checkout origin must match the authorized repository before collecting default metadata', (t) => {
  const f = fixture(t, { failed: true });
  const local = localRepository(f);
  local.git([
    'remote',
    'set-url',
    'origin',
    'https://github.com/another-owner/fixture-repository.git',
  ]);
  const runner = (binary, args, options) => {
    assert.notEqual(binary, 'gh', 'foreign checkout must not use requested or source metadata');
    return local.runner(binary, args, options);
  };
  assert.throws(
    () =>
      runPublishCli(['commit', ...f.args, ...local.args], {
        runner,
        cwd: local.directory,
        now: f.now,
      }),
    /commit repository differs from checkout origin/
  );
  assert.equal(local.commitAttempts.length, 0);
  assert.equal(local.git(['rev-parse', 'HEAD']).trim(), local.before);
  assert.equal(local.git(['write-tree']).trim(), local.tree);
});

test('changed default metadata blocks a native commit even when both defaults differ from the authorized branch', (t) => {
  const f = fixture(t, { failed: true });
  const local = localRepository(f, { defaultBranch: 'develop' });
  let repositoryReads = 0;
  const runner = (binary, args, options) => {
    if (binary === 'gh' && ++repositoryReads === 2)
      local.repositoryMetadata.default_branch = 'trunk';
    return local.runner(binary, args, options);
  };
  assert.throws(
    () =>
      runPublishCli(['commit', ...f.args, ...local.args], {
        runner,
        cwd: local.directory,
        now: f.now,
      }),
    /changed before write/
  );
  assert.equal(local.commitAttempts.length, 0);
  assert.equal(local.git(['rev-parse', 'HEAD']).trim(), local.before);
  assert.equal(local.git(['write-tree']).trim(), local.tree);
});

test('a native commit on a concurrently advanced parent is unknown without retry or compensation', (t) => {
  const f = fixture(t, { failed: true });
  const local = localRepository(f);
  let concurrentParent;
  const runner = (binary, args, options) => {
    if (args[0] === 'commit' && !concurrentParent) {
      local.git(['commit', '--allow-empty', '--only', '-m', 'Synthetic concurrent human commit']);
      concurrentParent = local.git(['rev-parse', 'HEAD']).trim();
    }
    return local.runner(binary, args, options);
  };
  assert.throws(
    () =>
      runPublishCli(['commit', ...f.args, ...local.args], {
        runner,
        cwd: local.directory,
        now: f.now,
      }),
    (error) => error instanceof PublicationUnknown && /first parent/.test(error.message)
  );
  const written = local.git(['rev-parse', 'HEAD']).trim();
  assert.notEqual(written, concurrentParent);
  assert.notEqual(concurrentParent, local.before);
  assert.equal(local.git(['rev-parse', `${written}^1`]).trim(), concurrentParent);
  assert.equal(local.git(['rev-parse', `${written}^{tree}`]).trim(), local.tree);
  assertModelTraceDisclosure(
    local.git(['log', '-1', '--format=%B', written]),
    f.record.receipt,
    'commit'
  );
  assert.equal(local.git(['rev-list', '--count', `${local.before}..HEAD`]).trim(), '2');
  assert.equal(local.commitAttempts.length, 1);
});

for (const raced of [false, true]) {
  test(`a native merge commit ${raced ? 'cannot borrow authorization from its second parent' : 'can publish with its exact authorized first parent'}`, (t) => {
    const f = fixture(t, { failed: true });
    const local = localRepository(f);
    local.git(['reset', '--', 'change.txt']);
    local.git(['checkout', '-b', 'fixture-side', local.before]);
    local.git(['commit', '--allow-empty', '--only', '-m', 'Synthetic side-parent commit']);
    const side = local.git(['rev-parse', 'HEAD']).trim();
    local.git(['checkout', 'fixture-contributor-branch']);
    local.git(['commit', '--allow-empty', '--only', '-m', 'Synthetic authorized-parent commit']);
    const authorized = local.git(['rev-parse', 'HEAD']).trim();
    const argv = ['commit', ...f.args, ...local.args];
    argv[argv.indexOf('--expected-head') + 1] = authorized;
    if (!raced) local.git(['merge', '--no-ff', '--no-commit', side]);
    local.git(['add', 'change.txt']);
    const runner = (binary, args, options) => {
      if (raced && args[0] === 'commit') {
        local.git(['update-ref', 'HEAD', side, authorized]);
        local.git(['reset', '--', 'change.txt']);
        local.git(['merge', '--no-ff', '--no-commit', authorized]);
        local.git(['add', 'change.txt']);
      }
      return local.runner(binary, args, options);
    };
    const publish = () => runPublishCli(argv, { runner, cwd: local.directory, now: f.now });
    if (raced) assert.throws(publish, (error) => error instanceof PublicationUnknown);
    else {
      const result = publish();
      assert.equal(result.status, 'published');
      assert.equal(result.head, local.git(['rev-parse', 'HEAD']).trim());
    }
    const written = local.git(['rev-parse', 'HEAD']).trim();
    const parents = local.git(['show', '--no-patch', '--format=%P', written]).trim().split(' ');
    assert.deepEqual(parents, raced ? [side, authorized] : [authorized, side]);
    assert.equal(local.git(['rev-parse', `${written}^{tree}`]).trim(), local.tree);
    assertModelTraceDisclosure(
      local.git(['log', '-1', '--format=%B', written]),
      f.record.receipt,
      'commit'
    );
    assert.equal(local.commitAttempts.length, 1);
  });
}

for (const alias of [false, true]) {
  test(`private record/context ${alias ? 'outside symlinks resolving inside' : 'files inside the checkout'} cannot enter an authorized commit`, (t) => {
    for (const option of ['--record', '--context']) {
      const f = fixture(t, { failed: true });
      const local = localRepository(f);
      const privateName = `${option.slice(2)}.json`;
      const inside = path.join(local.directory, privateName);
      const argv = ['commit', ...f.args, ...local.args];
      fs.copyFileSync(argv[argv.indexOf(option) + 1], inside);
      local.git(['add', privateName]);
      const staged = local.git(['write-tree']).trim();
      argv[argv.indexOf('--expected-tree') + 1] = staged;
      let input = inside;
      let cwd = local.directory;
      if (alias) {
        const parentAlias = path.join(f.directory, 'outside-private-parent');
        fs.symlinkSync(local.directory, parentAlias, 'dir');
        input = path.join(parentAlias, privateName);
        cwd = path.join(f.directory, 'checkout-alias');
        fs.symlinkSync(local.directory, cwd, 'dir');
      }
      argv[argv.indexOf(option) + 1] = input;
      assert.throws(() => runPublishCli(argv, { runner: local.runner, cwd, now: f.now }));
      assert.equal(local.commitAttempts.length, 0);
      assert.equal(local.git(['rev-parse', 'HEAD']).trim(), local.before);
      assert.equal(local.git(['write-tree']).trim(), staged);
      assert.equal(local.git(['ls-tree', '-r', '--name-only', 'HEAD']), 'initial.txt\n');
    }
  });
}

test('private input aliases wholly outside the real checkout remain usable without disclosure leaks', (t) => {
  const f = fixture(t, { failed: true });
  const local = localRepository(f);
  const argv = ['commit', ...f.args, ...local.args];
  const parentAlias = path.join(f.directory, 'private-parent-alias');
  fs.symlinkSync(f.directory, parentAlias, 'dir');
  for (const option of ['--record', '--context']) {
    const input = path.join(parentAlias, path.basename(argv[argv.indexOf(option) + 1]));
    argv[argv.indexOf(option) + 1] = input;
  }
  const cwd = path.join(f.directory, 'checkout-alias');
  fs.symlinkSync(local.directory, cwd, 'dir');
  const result = runPublishCli(argv, { runner: local.runner, cwd, now: f.now });
  assert.equal(result.status, 'published');
  assert.equal(local.commitAttempts.length, 1);
  assert.equal(
    local.git(['ls-tree', '-r', '--name-only', result.head]),
    'change.txt\ninitial.txt\n'
  );
  assert.equal(local.git(['rev-parse', `${result.head}^1`]).trim(), local.before);
  const message = local.git(['log', '-1', '--format=%B', result.head]);
  assertModelTraceDisclosure(message, f.record.receipt, 'commit');
  assert.ok(!message.includes(f.context.sessionId));
  assert.ok(!message.includes('"outputs"'));
});

test('a private alias retargeted into the checkout during preparation prevents commit publication', (t) => {
  const f = fixture(t, { failed: true });
  const local = localRepository(f);
  const inside = path.join(local.directory, path.basename(f.recordPath));
  fs.copyFileSync(f.recordPath, inside);
  local.git(['add', path.basename(inside)]);
  const staged = local.git(['write-tree']).trim();
  const alias = path.join(f.directory, 'record-parent-alias');
  fs.symlinkSync(f.directory, alias, 'dir');
  const argv = ['commit', ...f.args, ...local.args];
  argv[argv.indexOf('--record') + 1] = path.join(alias, path.basename(f.recordPath));
  argv[argv.indexOf('--expected-tree') + 1] = staged;
  let treeReads = 0;
  const runner = (binary, args, options) => {
    if (args[0] === 'write-tree' && ++treeReads === 2) {
      fs.unlinkSync(alias);
      fs.symlinkSync(local.directory, alias, 'dir');
    }
    return local.runner(binary, args, options);
  };
  assert.throws(() => runPublishCli(argv, { runner, cwd: local.directory, now: f.now }));
  assert.equal(local.commitAttempts.length, 0);
  assert.equal(local.git(['rev-parse', 'HEAD']).trim(), local.before);
  assert.equal(local.git(['write-tree']).trim(), staged);
});

test('signed owner delegation reaches commit PR creation and exact Issue comment publishers', (t) => {
  const repositoryId = 'github.com:Proto-UI/Proto-UI';
  const f = fixture(t, { failed: true, repositoryId });
  const owner = ownerFixture(f);
  const local = localRepository(f);
  const committed = runPublishCli(['commit', ...owner.args, ...local.args], {
    runner: local.runner,
    cwd: local.directory,
    now: f.now,
  });
  assert.equal(committed.status, 'published');
  assert.equal(local.git(['rev-parse', 'HEAD^{tree}']).trim(), local.tree);
  const gh = server({ repositoryId, login: 'cyjin-yl', sourceOwner: 'Proto-UI', pull: true });
  const pull = runPublishCli(
    [
      'pull-request',
      'create',
      ...owner.args,
      '--title',
      'Synthetic delegated PR',
      '--body-file',
      f.bodyPath,
      '--base',
      'main',
      '--head',
      'fixture-contributor-branch',
    ],
    { runner: gh.runner, now: f.now }
  );
  assert.equal(pull.status, 'published');
  const comments = server({ repositoryId, login: 'cyjin-yl' });
  const scoped = ownerFixture(f, { scopeIds: ['issue:7'], actions: ['collaborate'] });
  const comment = runPublishCli(
    ['comment', ...scoped.args, '--number', '7', '--body-file', f.bodyPath],
    { runner: comments.runner, now: f.now }
  );
  assert.equal(comment.status, 'published');
  assert.equal(
    comments.comments[0].body.split(renderModelTraceDisclosure(f.record.receipt)).length,
    2
  );
  assert.equal(gh.writes.length, 1);
  assert.equal(comments.writes.length, 1);
});

test('publisher owner grants cannot cross exact target kind actor or action', (t) => {
  const repositoryId = 'github.com:Proto-UI/Proto-UI';
  for (const boundary of ['target-kind', 'actor', 'action']) {
    const f = fixture(t, { failed: true, repositoryId });
    const owner = ownerFixture(f, {
      scopeIds: ['issue:7'],
      actions: boundary === 'action' ? ['implement'] : ['collaborate'],
    });
    const gh = server({ repositoryId, login: boundary === 'actor' ? LOGIN : 'cyjin-yl' });
    if (boundary === 'target-kind') gh.target.pull_request = { url: 'fixture://pull/7' };
    assert.throws(
      () =>
        runPublishCli(['comment', ...owner.args, '--number', '7', '--body-file', f.bodyPath], {
          runner: gh.runner,
          now: f.now,
        }),
      Error
    );
    assert.equal(gh.writes.length, 0, boundary);
    assert.equal(gh.target.body, 'Original body');
  }
});

test('signed revocation after live preflight prevents the final publisher mutation', (t) => {
  const repositoryId = 'github.com:Proto-UI/Proto-UI';
  const f = fixture(t, { failed: true, repositoryId });
  const owner = ownerFixture(f, { scopeIds: ['issue:7'], actions: ['collaborate'] });
  const gh = server({ repositoryId, login: 'cyjin-yl' });
  let viewerReads = 0;
  const runner = (binary, args, options) => {
    if (args.includes('graphql') && ++viewerReads === 2)
      owner.save({ ...owner.grant, generation: 2, status: 'revoked' }, 2);
    return gh.runner(binary, args, options);
  };
  assert.throws(
    () =>
      runPublishCli(['comment', ...owner.args, '--number', '7', '--body-file', f.bodyPath], {
        runner,
        now: f.now,
      }),
    Error
  );
  assert.equal(viewerReads, 2);
  assert.equal(gh.writes.length, 0);
});

test('a commit rejects staged work outside the authorized tree without consuming the index', (t) => {
  const f = fixture(t, { failed: true });
  const local = localRepository(f);
  fs.writeFileSync(path.join(local.directory, 'user.txt'), 'Unrelated synthetic user work\n');
  local.git(['add', 'user.txt']);
  const staged = local.git(['diff', '--cached', '--name-only']);
  assert.throws(
    () =>
      runPublishCli(['commit', ...f.args, ...local.args], {
        runner: local.runner,
        cwd: local.directory,
        now: f.now,
      }),
    Error
  );
  assert.equal(local.git(['rev-parse', 'HEAD']).trim(), local.before);
  assert.equal(local.git(['diff', '--cached', '--name-only']), staged);
});

test('a commit rechecks index changes during preparation before writing HEAD', (t) => {
  const f = fixture(t, { failed: true });
  const local = localRepository(f);
  let treesRead = 0;
  const runner = (binary, args, options) => {
    if (args[0] === 'write-tree' && ++treesRead === 2) {
      fs.writeFileSync(path.join(local.directory, 'user.txt'), 'Concurrent staged fixture\n');
      local.git(['add', 'user.txt']);
    }
    return local.runner(binary, args, options);
  };
  assert.throws(
    () =>
      runPublishCli(['commit', ...f.args, ...local.args], {
        runner,
        cwd: local.directory,
        now: f.now,
      }),
    Error
  );
  assert.equal(local.git(['rev-parse', 'HEAD']).trim(), local.before);
  assert.equal(local.git(['diff', '--cached', '--name-only']), 'change.txt\nuser.txt\n');
});

test('late shared-index user staging stays staged and cannot enter the authorized commit', (t) => {
  const f = fixture(t, { failed: true });
  const local = localRepository(f);
  const runner = (binary, args, options) => {
    if (args[0] === 'commit') {
      fs.writeFileSync(path.join(local.directory, 'user.txt'), 'Late synthetic user staging\n');
      local.git(['add', 'user.txt']);
    }
    return local.runner(binary, args, options);
  };
  const result = runPublishCli(['commit', ...f.args, ...local.args], {
    runner,
    cwd: local.directory,
    now: f.now,
  });
  assert.equal(result.status, 'published');
  assert.equal(local.git(['rev-parse', 'HEAD^{tree}']).trim(), local.tree);
  assert.equal(
    local.git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']),
    'change.txt\n'
  );
  assert.equal(local.git(['diff', '--cached', '--name-only']), 'user.txt\n');
  assert.equal(
    fs.readFileSync(path.join(local.directory, 'user.txt'), 'utf8'),
    'Late synthetic user staging\n'
  );
});

test('reused branch publication binds both exact revisions and keeps each closed PR idempotent', (t) => {
  const f = fixture(t, { failed: true });
  const revision = { headSha: 'c'.repeat(40), baseSha: 'd'.repeat(40) };
  const gh = server({ pull: true, revision });
  const argv = [
    'pull-request',
    'create',
    ...f.args,
    '--title',
    'Synthetic reused contributor branch',
    '--body-file',
    f.bodyPath,
    '--base',
    'main',
    '--head',
    'fixture-contributor-branch',
  ];
  const first = runPublishCli(argv, { runner: gh.runner, now: f.now });
  gh.issues[0].state = 'closed';
  revision.headSha = 'e'.repeat(40);
  const second = runPublishCli(argv, { runner: gh.runner, now: f.now });
  assert.equal(second.status, 'published');
  assert.notEqual(second.url, first.url);
  assert.equal(runPublishCli(argv, { runner: gh.runner, now: f.now }).status, 'already-published');
  assert.equal(gh.writes.length, 2);
  gh.issues[1].state = 'closed';
  revision.baseSha = 'f'.repeat(40);
  const third = runPublishCli(argv, { runner: gh.runner, now: f.now });
  assert.equal(third.status, 'published');
  assert.notEqual(third.url, second.url);
  assert.equal(runPublishCli(argv, { runner: gh.runner, now: f.now }).status, 'already-published');
  assert.equal(gh.writes.length, 3);
});

test('revision idempotency also preserves an already approved PR body byte-for-byte', (t) => {
  const f = fixture(t, { failed: true });
  const prepared = `${f.body}\n${renderModelTraceDisclosure(f.record.receipt)}\n`;
  fs.writeFileSync(f.bodyPath, prepared);
  const revision = { headSha: 'c'.repeat(40), baseSha: 'd'.repeat(40) };
  const gh = server({ pull: true, revision });
  const argv = [
    'pull-request',
    'create',
    ...f.args,
    '--title',
    'Synthetic immutable prepared PR',
    '--body-file',
    f.bodyPath,
    '--base',
    'main',
    '--head',
    'fixture-contributor-branch',
  ];
  const first = runPublishCli(argv, { runner: gh.runner, now: f.now });
  gh.issues[0].state = 'closed';
  revision.headSha = 'e'.repeat(40);
  const second = runPublishCli(argv, { runner: gh.runner, now: f.now });
  assert.equal(second.status, 'published');
  assert.notEqual(second.url, first.url);
  assert.equal(runPublishCli(argv, { runner: gh.runner, now: f.now }).status, 'already-published');
  assert.equal(gh.writes.length, 2);
  for (const issue of gh.issues) assert.equal(issue.body, prepared);
});
