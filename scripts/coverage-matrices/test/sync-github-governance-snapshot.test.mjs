import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { test } from 'node:test';
import {
  BODY_HASH_NORMALIZATION,
  governanceBodyHash,
  normalizeLivePullRequest,
  collectDependencyOwners,
  governanceFacts,
  hasGovernanceDrift,
  normalizeLiveIssue,
  reconcileGovernanceSnapshot,
} from '../sync-github-governance-snapshot.mjs';

const headers = [
  'ID',
  'Path',
  'User job',
  'Current owner',
  'Target class',
  'Proto UI chain',
  'Lifecycle',
  'WC host and SSR/no-JS strategy',
  'Dependency and owner',
  'Difficulty',
  'Milestone',
  'State',
  'Evidence',
  'Escape or exemption',
  'Re-review or removal issue',
];

function matrix(dependency, reReview = '#420') {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    `| www.fixture.surface | fixture | job | owner | site-composition | chain | lifecycle | strategy | ${dependency} | F1 | M0 | blocked | evidence | — | ${reReview} |`,
  ].join('\n');
}

test('collects every dependency Issue with normalized reviewed owner tokens', () => {
  const owners = collectDependencyOwners([
    matrix(
      '[#420](https://github.com/Proto-UI/Proto-UI/issues/420) and #519; owners: Search and Input maintainers. Additional prose.'
    ),
  ]);

  assert.deepEqual(
    [...owners].map(([number, values]) => [number, [...values]]),
    [
      [420, ['search and input maintainers']],
      [519, ['search and input maintainers']],
    ]
  );
});

test('collects distinct re-review Issues with the row owner', () => {
  const owners = collectDependencyOwners([
    matrix('No dependency; owner: website team', '#533 when the exemption changes'),
  ]);

  assert.deepEqual(
    [...owners].map(([number, values]) => [number, [...values]]),
    [[533, ['website team']]]
  );
});

test('reconciliation preserves reviewed owners and sorts live repository facts', () => {
  const dependencyOwners = new Map([
    [519, new Set(['scroll maintainer'])],
    [420, new Set(['website team'])],
  ]);
  const currentSnapshot = {
    schemaVersion: 1,
    repository: 'Proto-UI/Proto-UI',
    issues: [
      { number: 420, owners: ['website team'] },
      { number: 519, owners: ['scroll maintainer'] },
    ],
    pullRequests: [{ number: 580 }],
  };
  const liveIssues = [
    {
      number: 519,
      nodeId: 'issue-519',
      url: 'https://github.com/Proto-UI/Proto-UI/issues/519',
      title: 'Scroll',
      state: 'OPEN',
      stateReason: null,
      updatedAt: '2026-09-01T00:00:00Z',
      labels: [],
      assignees: [],
      milestone: null,
    },
    {
      number: 420,
      nodeId: 'issue-420',
      url: 'https://github.com/Proto-UI/Proto-UI/issues/420',
      title: 'Website',
      state: 'OPEN',
      stateReason: null,
      updatedAt: '2026-09-02T00:00:00Z',
      labels: ['area: website'],
      assignees: [],
      milestone: 'Website',
    },
  ];
  const livePullRequests = [
    {
      number: 580,
      nodeId: 'pr-580',
      url: 'https://github.com/Proto-UI/Proto-UI/pull/580',
      title: 'Docs flow',
      state: 'MERGED',
      updatedAt: '2026-09-01T00:00:00Z',
      headSha: '2a6d5f3208d91e5c9862a67408a39ff208d43306',
      mergeCommit: '9841c86a10940267fb30ee25b63c9a5a39f76fe6',
    },
  ];

  const result = reconcileGovernanceSnapshot({
    currentSnapshot,
    dependencyOwners,
    liveIssues,
    livePullRequests,
  });

  assert.deepEqual(
    result.issues.map(({ number, owners }) => ({ number, owners })),
    [
      { number: 420, owners: ['website team'] },
      { number: 519, owners: ['scroll maintainer'] },
    ]
  );
  assert.equal(result.pullRequests[0].headSha, livePullRequests[0].headSha);
  assert.equal('generatedAt' in result, false);
});

test('reconciliation fails rather than guessing changed owner tokens', () => {
  assert.throws(
    () =>
      reconcileGovernanceSnapshot({
        currentSnapshot: {
          schemaVersion: 1,
          repository: 'Proto-UI/Proto-UI',
          issues: [{ number: 420, owners: ['old owner'] }],
          pullRequests: [],
        },
        dependencyOwners: new Map([[420, new Set(['new owner'])]]),
        liveIssues: [],
        livePullRequests: [],
      }),
    /reviewed owners for Issue #420 do not match matrix owner tokens/
  );
});

test('candidate governance reconciliation stays secret-free and read-only', () => {
  const text = fs.readFileSync(
    new URL('../../../.github/workflows/coverage-governance.yml', import.meta.url),
    'utf8'
  );
  const workflow = parseYaml(text);
  assert.deepEqual(workflow.permissions, {
    contents: 'read',
    issues: 'read',
    'pull-requests': 'read',
  });
  assert.equal(workflow.on.pull_request_target, undefined);
  assert.doesNotMatch(text, /secrets\./);
  const paths = workflow.on.pull_request.paths;
  for (const required of [
    '.github/workflows/coverage-governance.yml',
    'internal/coverage-matrices/**',
    'internal/website/self-hosting-coverage-matrix.md',
    'internal/agent-harness/dogfood-coverage-matrix.md',
    'scripts/coverage-matrices/**',
    'packages/spec/schema/**',
    '**/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.npmrc',
    '.prettier*',
  ]) {
    assert.ok(paths.includes(required), required);
  }
  const steps = workflow.jobs.reconcile.steps;
  const checkout = steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with['persist-credentials'], false);
  assert.equal(checkout.with.ref, undefined, 'the PR event must inspect its candidate checkout');
  const compare = steps.find((step) => step.run?.includes('sync-github-governance-snapshot.mjs'));
  assert.equal(
    compare.run,
    'node scripts/coverage-matrices/sync-github-governance-snapshot.mjs --check'
  );
  assert.deepEqual(compare.env, { GH_TOKEN: '${{ github.token }}' });
  assert.ok(steps.some((step) => step.run?.includes('install --frozen-lockfile --ignore-scripts')));
});

test('live Issues endpoint does not certify a pull request as a dependency Issue', () => {
  const raw = {
    number: 563,
    node_id: 'I_fixture',
    html_url: 'https://github.com/Proto-UI/Proto-UI/pull/563',
    title: 'Pull request',
    state: 'open',
    updated_at: '2026-10-01T00:00:00Z',
    labels: [],
    assignees: [],
    milestone: null,
    pull_request: { url: 'https://api.github.com/repos/Proto-UI/Proto-UI/pulls/563' },
  };
  assert.throws(() => normalizeLiveIssue(563, raw), /pull request.*dependency Issue/);
});

test('live Issues endpoint rejects every own pull_request marker while retaining actual Issue metadata', () => {
  const raw = {
    number: 420,
    node_id: 'I_fixture',
    html_url: 'https://github.com/Proto-UI/Proto-UI/issues/420',
    title: 'Website',
    body: null,
    state: 'open',
    state_reason: null,
    updated_at: '2026-10-01T00:00:00Z',
    labels: [{ name: 'z' }, { name: 'a' }],
    assignees: [{ login: 'z' }, { login: 'a' }],
    milestone: { title: 'Website' },
  };
  const expected = {
    number: 420,
    nodeId: 'I_fixture',
    url: raw.html_url,
    title: 'Website',
    bodySha256: governanceBodyHash(null),
    state: 'OPEN',
    stateReason: null,
    updatedAt: raw.updated_at,
    labels: ['a', 'z'],
    assignees: ['a', 'z'],
    milestone: 'Website',
  };
  assert.deepEqual(normalizeLiveIssue(420, raw), expected);
  for (const marker of [null, {}, false])
    assert.throws(
      () => normalizeLiveIssue(420, { ...raw, pull_request: marker }),
      /pull request.*dependency Issue/
    );
});

function comparisonFixture() {
  return {
    schemaVersion: 1,
    bodyHashNormalization: BODY_HASH_NORMALIZATION,
    repository: 'Proto-UI/Proto-UI',
    issues: [
      {
        number: 377,
        nodeId: 'I-377',
        url: 'https://github.com/Proto-UI/Proto-UI/issues/377',
        title: 'Coverage',
        bodySha256: governanceBodyHash('Coverage criteria'),
        state: 'OPEN',
        stateReason: null,
        updatedAt: '2026-09-27T00:53:27Z',
        labels: ['documentation'],
        assignees: ['cyjin-yl'],
        milestone: null,
        owners: ['maintainers'],
      },
    ],
    pullRequests: [
      {
        number: 580,
        nodeId: 'PR-580',
        url: 'https://github.com/Proto-UI/Proto-UI/pull/580',
        title: 'Docs',
        bodySha256: governanceBodyHash('Docs acceptance'),
        state: 'MERGED',
        updatedAt: '2026-09-01T00:00:00Z',
        headSha: 'a'.repeat(40),
        mergeCommit: 'b'.repeat(40),
      },
    ],
  };
}
test('observation-only updatedAt changes do not produce governance drift or mutate snapshots', () => {
  const before = comparisonFixture();
  const current = structuredClone(before);
  const live = structuredClone(before);
  live.issues[0].updatedAt = '2026-10-06T17:14:14Z';
  live.pullRequests[0].updatedAt = '2026-10-06T17:14:14Z';
  assert.equal(hasGovernanceDrift(current, live), false);
  assert.deepEqual(current, before);
  assert.equal(live.issues[0].updatedAt, '2026-10-06T17:14:14Z');
  assert.equal('updatedAt' in governanceFacts(current).issues[0], false);
});
for (const [field, value] of Object.entries({
  number: 378,
  nodeId: 'another-issue',
  url: 'https://github.com/Proto-UI/Proto-UI/issues/378',
  title: 'Changed',
  state: 'CLOSED',
  stateReason: 'COMPLETED',
  labels: ['different'],
  assignees: ['different'],
  milestone: 'new milestone',
  owners: ['other owner'],
})) {
  test(`Issue ${field} drift remains blocking even with timestamp churn`, () => {
    const current = comparisonFixture();
    const live = structuredClone(current);
    live.issues[0][field] = value;
    live.issues[0].updatedAt = '2026-10-06T17:14:14Z';
    assert.equal(hasGovernanceDrift(current, live), true);
  });
}
for (const [field, value] of Object.entries({
  number: 581,
  nodeId: 'another-pr',
  url: 'https://github.com/Proto-UI/Proto-UI/pull/581',
  title: 'Changed',
  state: 'CLOSED',
  headSha: 'c'.repeat(40),
  mergeCommit: null,
})) {
  test(`PR ${field} drift remains blocking even with timestamp churn`, () => {
    const current = comparisonFixture();
    const live = structuredClone(current);
    live.pullRequests[0][field] = value;
    live.pullRequests[0].updatedAt = '2026-10-06T17:14:14Z';
    assert.equal(hasGovernanceDrift(current, live), true);
  });
}
test('new, removed or unknown governed fields remain blocking', () => {
  for (const mutate of [
    (s) => {
      s.issues = [];
    },
    (s) => {
      s.pullRequests = [];
    },
    (s) => {
      s.issues[0].newDecision = 'changed';
    },
    (s) => {
      s.repository = 'Other/Repo';
    },
    (s) => {
      s.schemaVersion = 2;
    },
  ]) {
    const current = comparisonFixture();
    const live = structuredClone(current);
    mutate(live);
    assert.equal(hasGovernanceDrift(current, live), true);
  }
});
test('invalid or missing observation timestamps remain invalid metadata', () => {
  for (const value of [undefined, null, 123, 'invalid']) {
    const current = comparisonFixture();
    current.issues[0].updatedAt = value;
    assert.throws(() => governanceFacts(current), /invalid observation timestamp/);
  }
});
test('explicit reconciliation retains the real new observation timestamp', () => {
  const current = comparisonFixture();
  const live = structuredClone(current);
  live.issues[0].updatedAt = '2026-10-06T17:14:14Z';
  const result = reconcileGovernanceSnapshot({
    currentSnapshot: current,
    dependencyOwners: new Map([[377, new Set(['maintainers'])]]),
    liveIssues: live.issues,
    livePullRequests: live.pullRequests,
  });
  assert.equal(result.issues[0].updatedAt, '2026-10-06T17:14:14Z');
  assert.equal(hasGovernanceDrift(current, result), false);
});

test('body hashing normalizes only CRLF and explicit null/empty, preserving Markdown bytes', () => {
  assert.equal(governanceBodyHash(null), governanceBodyHash(''));
  assert.equal(governanceBodyHash('a\r\nb'), governanceBodyHash('a\nb'));
  for (const body of ['a\nb ', ' a\nb', 'a\n\nb', 'a\rb'])
    assert.notEqual(governanceBodyHash(body), governanceBodyHash('a\nb'));
  for (const body of [undefined, 1, {}, false])
    assert.throws(() => governanceBodyHash(body), /string or null/);
});
for (const collection of ['issues', 'pullRequests']) {
  test(`${collection} body edits fail even at an unchanged observation timestamp`, () => {
    const current = comparisonFixture();
    const live = structuredClone(current);
    live[collection][0].bodySha256 = governanceBodyHash('New acceptance criteria');
    assert.equal(hasGovernanceDrift(current, live), true);
  });
}
test('legacy snapshots require explicit body-baseline migration without inventing prior coverage', () => {
  const current = comparisonFixture();
  const legacy = structuredClone(current);
  delete legacy.bodyHashNormalization;
  for (const row of [...legacy.issues, ...legacy.pullRequests]) delete row.bodySha256;
  assert.equal(hasGovernanceDrift(legacy, current), true);
  assert.equal(hasGovernanceDrift(legacy, legacy), true);
  assert.equal(hasGovernanceDrift(current, current), false);
});
test('body digest and normalization metadata fail closed when malformed', () => {
  for (const digest of [undefined, null, '', 'a'.repeat(63), 'A'.repeat(64)]) {
    const current = comparisonFixture();
    current.issues[0].bodySha256 = digest;
    assert.throws(() => governanceFacts(current), /body digest/);
  }
  const current = comparisonFixture();
  current.bodyHashNormalization = 'trimmed';
  assert.throws(() => governanceFacts(current), /normalization/);
});
test('raw pull request normalization includes its body rather than relying on updatedAt', () => {
  const raw = {
    number: 580,
    node_id: 'PR580',
    html_url: 'https://github.com/Proto-UI/Proto-UI/pull/580',
    title: 'Docs',
    body: 'Acceptance\r\n- Keep criteria',
    state: 'closed',
    merged_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    head: { sha: 'a'.repeat(40) },
    merge_commit_sha: 'b'.repeat(40),
  };
  assert.equal(normalizeLivePullRequest(580, raw).bodySha256, governanceBodyHash(raw.body));
  assert.throws(() => normalizeLivePullRequest(580, { ...raw, body: undefined }), /missing body/);
});
