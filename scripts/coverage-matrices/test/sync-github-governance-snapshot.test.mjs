import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectDependencyOwners,
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
