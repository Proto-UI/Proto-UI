import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertNoTruncation,
  buildLiveReviewInput,
  normalizeCheck,
  submitGitHubMerge,
  submitGitHubReview,
  summarizeLiveChecks,
} from '../collect-live-review-input.mjs';

const sha = (letter) => letter.repeat(40);
const repositoryId = 'github.com:Proto-UI/Proto-UI';
const trustedProvenance = {
  repository: 'Proto-UI/Proto-UI',
  workflowName: 'CI',
  workflowPath: '.github/workflows/ci.yml',
};
const trustedOptions = {
  repositoryId,
  trustedRepositoryId: repositoryId,
  trustedSource: 'github-actions',
  trustedWorkflowNames: ['CI'],
  trustedWorkflowPaths: ['.github/workflows/ci.yml'],
};
const changedFiles = [
  { filename: 'packages/core/src/index.ts', previous_filename: null, status: 'modified' },
  {
    filename: 'internal/records/moved.md',
    previous_filename: 'spec/decisions/D-OLD-0001.yaml',
    status: 'renamed',
  },
];

function payload(overrides = {}) {
  const result = {
    data: {
      viewer: { login: 'reviewer' },
      repository: {
        viewerPermission: 'WRITE',
        pullRequest: {
          state: 'OPEN',
          isDraft: false,
          mergeable: 'MERGEABLE',
          mergeStateStatus: 'CLEAN',
          changedFiles: changedFiles.length,
          body: 'Bounded target',
          baseRefName: 'main',
          baseRefOid: sha('a'),
          headRefOid: sha('b'),
          author: { login: 'contributor' },
          commits: {
            nodes: [{ commit: { oid: sha('b'), messageHeadline: 'Bounded change' } }],
            pageInfo: { hasNextPage: false },
          },
          reviews: {
            nodes: [
              {
                id: 'PRR_review_1',
                author: { login: 'earlier-reviewer' },
                state: 'COMMENTED',
                commit: { oid: sha('b') },
                submittedAt: '2026-08-23T05:00:00Z',
                body: 'Earlier review',
              },
            ],
            pageInfo: { hasNextPage: false },
          },
          comments: {
            nodes: [
              {
                id: 'IC_comment_2001',
                author: { login: 'maintainer' },
                body: 'Top-level conversation note',
                updatedAt: '2026-08-23T05:30:00Z',
              },
            ],
            pageInfo: { hasNextPage: false },
          },
          reviewThreads: {
            nodes: [
              {
                id: 'PRR_kwT1',
                isResolved: true,
                comments: {
                  nodes: [
                    {
                      databaseId: 1001,
                      author: { login: 'maintainer' },
                      body: 'Please bound this',
                      updatedAt: '2026-08-23T06:00:00Z',
                    },
                  ],
                  pageInfo: { hasNextPage: false },
                },
              },
            ],
            pageInfo: { hasNextPage: false },
          },
          headRef: {
            target: {
              statusCheckRollup: {
                contexts: {
                  nodes: [
                    {
                      __typename: 'CheckRun',
                      name: 'test',
                      status: 'COMPLETED',
                      conclusion: 'SUCCESS',
                      completedAt: '2026-08-23T06:00:00Z',
                      detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
                      checkSuite: {
                        app: { slug: 'github-actions' },
                        repository: { nameWithOwner: 'Proto-UI/Proto-UI' },
                        workflowRun: {
                          file: { path: '.github/workflows/ci.yml' },
                          workflow: { name: 'CI' },
                        },
                      },
                    },
                    {
                      __typename: 'StatusContext',
                      context: 'legacy-ci',
                      state: 'FAILURE',
                      targetUrl: 'https://ci.example/1',
                      createdAt: '2026-08-23T06:00:00Z',
                    },
                  ],
                  pageInfo: { hasNextPage: false },
                },
              },
            },
          },
        },
      },
    },
    ...overrides,
  };
  result.data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup =
    result.data.repository.pullRequest.headRef.target.statusCheckRollup;
  return result;
}

test('live collector builds a complete canonical input from the GraphQL payload', () => {
  const result = buildLiveReviewInput(
    payload(),
    'github.com:Proto-UI/Proto-UI',
    487,
    [],
    changedFiles
  );
  assert.equal(result.viewerLogin, 'reviewer');
  assert.equal(result.viewerPermission, 'WRITE');
  assert.equal(result.authorLogin, 'contributor');
  assert.equal(result.mergeable, 'MERGEABLE');
  assert.equal(result.mergeStateStatus, 'CLEAN');
  assert.equal(result.input.commits.length, 1);
  assert.equal(result.input.pullRequestState, 'OPEN');
  assert.equal(result.input.isDraft, false);
  assert.equal(result.input.baseRefName, 'main');
  assert.deepEqual(result.input.changedFiles, [
    { path: 'packages/core/src/index.ts', previousPath: null, status: 'modified' },
    {
      path: 'internal/records/moved.md',
      previousPath: 'spec/decisions/D-OLD-0001.yaml',
      status: 'renamed',
    },
  ]);
  assert.equal(result.input.reviews[0].author, 'earlier-reviewer');
  assert.deepEqual(result.input.comments, [
    {
      id: 'IC_comment_2001',
      author: 'maintainer',
      body: 'Top-level conversation note',
      updatedAt: '2026-08-23T05:30:00Z',
    },
  ]);
  assert.equal(result.input.replies.length, 1);
  assert.equal(result.input.replies[0].id, '1001');
  assert.equal(result.input.replies[0].threadId, 'PRR_kwT1');
  assert.equal(result.input.threads[0].updatedAt, '2026-08-23T06:00:00Z');
  assert.equal(result.input.checks.length, 2);
  assert.equal(result.input.checks[0].status, 'COMPLETED');
  assert.equal(result.input.checks[1].name, 'legacy-ci');
  assert.equal(result.input.checks[1].status, 'COMPLETED');
  assert.equal(result.input.checks[1].conclusion, 'FAILURE');
  assert.equal(summarizeLiveChecks(result.input.checks), 'failure');
  assert.deepEqual(result.input.externalEvidence, []);
});

test('live collector derives thread time from comments and never fabricates timestamps', () => {
  const threaded = payload();
  threaded.data.repository.pullRequest.reviewThreads.nodes[0].comments.nodes.push({
    databaseId: 1002,
    author: { login: 'maintainer' },
    body: 'Later note',
    updatedAt: '2026-08-23T07:00:00Z',
  });
  const result = buildLiveReviewInput(
    threaded,
    'github.com:Proto-UI/Proto-UI',
    487,
    [],
    changedFiles
  );
  assert.equal(result.input.threads[0].updatedAt, '2026-08-23T07:00:00Z');
  assert.equal(result.input.replies.length, 2);

  const empty = payload();
  empty.data.repository.pullRequest.reviewThreads.nodes[0].comments.nodes = [];
  assert.throws(
    () => buildLiveReviewInput(empty, 'github.com:Proto-UI/Proto-UI', 487, [], changedFiles),
    /no comment timestamps/
  );
});

test('live collector fails closed on pagination truncation for every connection', () => {
  for (const [label, mutate] of [
    [
      'reviews',
      (p) => {
        p.data.repository.pullRequest.reviews.pageInfo.hasNextPage = true;
      },
    ],
    [
      'commits',
      (p) => {
        p.data.repository.pullRequest.commits.pageInfo.hasNextPage = true;
      },
    ],
    [
      'pull-request comments',
      (p) => {
        p.data.repository.pullRequest.comments.pageInfo.hasNextPage = true;
      },
    ],
    [
      'review threads',
      (p) => {
        p.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage = true;
      },
    ],
    [
      'thread comments',
      (p) => {
        p.data.repository.pullRequest.reviewThreads.nodes[0].comments.pageInfo.hasNextPage = true;
      },
    ],
    [
      'check contexts',
      (p) => {
        p.data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup.contexts.pageInfo.hasNextPage = true;
      },
    ],
  ]) {
    const truncated = payload();
    mutate(truncated);
    assert.throws(
      () => buildLiveReviewInput(truncated, 'github.com:Proto-UI/Proto-UI', 487, [], changedFiles),
      /exceeds one page/,
      `${label} truncation must fail closed`
    );
    assert.throws(() => assertNoTruncation(undefined, { hasNextPage: true }, label), /malformed/);
  }
});

test('review submission binds the GitHub Review API write to the inspected commit', () => {
  const calls = [];
  const result = submitGitHubReview(
    'github.com:Proto-UI/Proto-UI',
    487,
    {
      commitId: sha('b'),
      event: 'APPROVE',
      body: '',
    },
    (command, args, options) => {
      calls.push({ command, args, options });
      return JSON.stringify({
        id: 1234,
        node_id: 'PRR_review_2',
        state: 'APPROVED',
        commit_id: sha('b'),
        html_url: 'https://github.com/Proto-UI/Proto-UI/pull/487#pullrequestreview-1234',
      });
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'gh');
  assert.deepEqual(calls[0].args.slice(0, 5), [
    'api',
    '--method',
    'POST',
    'repos/Proto-UI/Proto-UI/pulls/487/reviews',
    '--input',
  ]);
  assert.deepEqual(JSON.parse(calls[0].options.input), {
    commit_id: sha('b'),
    event: 'APPROVE',
    body: '',
  });
  assert.equal(result.commitId, sha('b'));
  assert.equal(result.state, 'APPROVED');

  assert.throws(
    () =>
      submitGitHubReview(
        'github.com:Proto-UI/Proto-UI',
        487,
        { commitId: sha('b'), event: 'APPROVE', body: '' },
        () => JSON.stringify({ id: 1234, state: 'APPROVED', commit_id: sha('c') })
      ),
    /does not match the inspected head/
  );
  assert.throws(
    () =>
      submitGitHubReview(
        'github.com:Proto-UI/Proto-UI',
        487,
        { commitId: sha('b'), event: 'APPROVE', body: '' },
        () => JSON.stringify({ id: 1234, state: 'COMMENTED', commit_id: sha('b') })
      ),
    /unexpected state/
  );
});

test('pull-request merge binds GitHub integration to the inspected exact head', () => {
  const calls = [];
  const result = submitGitHubMerge(
    'github.com:Proto-UI/Proto-UI',
    487,
    { headSha: sha('b'), mergeMethod: 'squash' },
    (command, args, options) => {
      calls.push({ command, args, options });
      return JSON.stringify({
        sha: sha('c'),
        merged: true,
        message: 'Pull Request successfully merged',
      });
    }
  );
  assert.deepEqual(JSON.parse(calls[0].options.input), {
    sha: sha('b'),
    merge_method: 'squash',
  });
  assert.deepEqual(calls[0].args.slice(0, 5), [
    'api',
    '--method',
    'PUT',
    'repos/Proto-UI/Proto-UI/pulls/487/merge',
    '--input',
  ]);
  assert.equal(result.headSha, sha('b'));
  assert.equal(result.mergeCommitSha, sha('c'));
  assert.equal(result.reconciled, false);

  assert.throws(
    () =>
      submitGitHubMerge(
        'github.com:Proto-UI/Proto-UI',
        487,
        { headSha: sha('b'), mergeMethod: 'squash' },
        () => JSON.stringify({ merged: false, message: 'Head branch was modified' })
      ),
    /merge was rejected/
  );

  let attempt = 0;
  assert.throws(
    () =>
      submitGitHubMerge(
        'github.com:Proto-UI/Proto-UI',
        487,
        { headSha: sha('b'), mergeMethod: 'squash' },
        () => {
          attempt += 1;
          if (attempt === 1) throw new Error('connection closed after write');
          return JSON.stringify({
            merged: true,
            head: { sha: sha('b') },
            merge_commit_sha: sha('c'),
          });
        }
      ),
    /cannot be attributed; do not retry blindly/
  );
  assert.equal(attempt, 2);
});

test('live collector fails closed when the REST changed-file list is incomplete', () => {
  const truncated = payload();
  truncated.data.repository.pullRequest.changedFiles = changedFiles.length + 1;
  assert.throws(
    () => buildLiveReviewInput(truncated, 'github.com:Proto-UI/Proto-UI', 487, [], changedFiles),
    /changed-file collection is incomplete/
  );
});

test('live collector passes external evidence through verbatim and validates its shape', () => {
  const evidence = [
    { kind: 'artifact', locator: 'https://example.com/a.txt', digest: 'd'.repeat(64) },
  ];
  const result = buildLiveReviewInput(
    payload(),
    'github.com:Proto-UI/Proto-UI',
    487,
    evidence,
    changedFiles
  );
  assert.deepEqual(result.input.externalEvidence, evidence);

  assert.throws(
    () =>
      buildLiveReviewInput(
        payload(),
        'github.com:Proto-UI/Proto-UI',
        487,
        [{ kind: 'artifact', locator: 'https://example.com/a.txt', digest: 'short' }],
        changedFiles
      ),
    /external evidence digest/
  );
});

test('live collector accepts nullable check links without treating them as trusted CI evidence', () => {
  const nullableUrls = payload();
  nullableUrls.data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup.contexts.nodes =
    [
      {
        __typename: 'CheckRun',
        name: 'test',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        completedAt: '2026-08-23T06:00:00Z',
        detailsUrl: null,
      },
      {
        __typename: 'StatusContext',
        context: 'legacy-ci',
        state: 'SUCCESS',
        targetUrl: null,
        createdAt: '2026-08-23T06:00:00Z',
      },
    ];
  const result = buildLiveReviewInput(
    nullableUrls,
    'github.com:Proto-UI/Proto-UI',
    487,
    [],
    changedFiles
  );
  assert.equal(result.input.checks.length, 2);
  assert.equal(result.input.checks[0].detailsUrl, null);
  assert.equal(result.input.checks[1].detailsUrl, null);
  assert.equal(summarizeLiveChecks(result.input.checks), 'unknown');
});

test('live collector reads checks from the exact head commit when headRef target rollup is absent', () => {
  const forkPullRequest = payload();
  forkPullRequest.data.repository.pullRequest.headRef.target.statusCheckRollup = null;
  const result = buildLiveReviewInput(forkPullRequest, repositoryId, 487, [], changedFiles);
  assert.equal(result.input.headSha, sha('b'));
  assert.equal(result.input.checks.length, 2);
});

test('live collector fails closed when the collected final commit is not the pull-request head', () => {
  const mismatched = payload();
  mismatched.data.repository.pullRequest.commits.nodes[0].commit.oid = sha('c');
  assert.throws(
    () => buildLiveReviewInput(mismatched, repositoryId, 487, [], changedFiles),
    /head commit collection does not match/
  );
});

test('check context normalization matches both connection node kinds', () => {
  assert.deepEqual(
    normalizeCheck({
      __typename: 'CheckRun',
      name: 'test',
      status: 'IN_PROGRESS',
      conclusion: null,
      completedAt: null,
      detailsUrl: 'https://example.com',
    }),
    {
      name: 'test',
      status: 'IN_PROGRESS',
      conclusion: null,
      completedAt: null,
      detailsUrl: 'https://example.com',
      source: 'unknown-check-run',
      repository: null,
      workflowName: null,
      workflowPath: null,
    }
  );
  assert.deepEqual(
    normalizeCheck({
      __typename: 'StatusContext',
      context: 'ci',
      state: 'PENDING',
      targetUrl: null,
      createdAt: '2026-08-23T06:00:00Z',
    }),
    {
      name: 'ci',
      status: 'PENDING',
      conclusion: null,
      completedAt: '2026-08-23T06:00:00Z',
      detailsUrl: null,
      source: 'status-context',
      repository: null,
      workflowName: null,
      workflowPath: null,
    }
  );
});

test('live check summary accepts neutral terminal conclusions but not pending checks', () => {
  const successCompatible = ['SUCCESS', 'SKIPPED', 'NEUTRAL'].map((conclusion) => ({
    name: conclusion.toLowerCase(),
    status: 'COMPLETED',
    conclusion,
    completedAt: '2026-08-23T06:00:00Z',
    detailsUrl:
      conclusion === 'SUCCESS' ? 'https://github.com/Proto-UI/Proto-UI/actions/runs/1' : null,
    source: 'github-actions',
    ...trustedProvenance,
  }));
  assert.equal(summarizeLiveChecks(successCompatible, trustedOptions), 'success');
  assert.equal(
    summarizeLiveChecks(
      [
        ...successCompatible,
        {
          name: 'pending',
          status: 'IN_PROGRESS',
          conclusion: null,
          completedAt: null,
          detailsUrl: null,
          source: 'github-actions',
          ...trustedProvenance,
        },
      ],
      trustedOptions
    ),
    'unknown'
  );
});

test('external success cannot substitute for trusted repository CI evidence', () => {
  assert.equal(
    summarizeLiveChecks(
      [
        {
          name: 'Vercel',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
          completedAt: '2026-08-23T06:00:00Z',
          detailsUrl: 'https://vercel.com/example',
          source: 'vercel',
          repository: 'Proto-UI/Proto-UI',
          workflowName: null,
          workflowPath: null,
        },
        {
          name: 'test',
          status: 'COMPLETED',
          conclusion: 'SKIPPED',
          completedAt: '2026-08-23T06:00:00Z',
          detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
          source: 'github-actions',
          ...trustedProvenance,
        },
      ],
      trustedOptions
    ),
    'unknown'
  );
  const options = {
    ...trustedOptions,
    trustedCheckNames: ['test'],
  };
  const neutralRepositoryTest = {
    name: 'test',
    status: 'COMPLETED',
    conclusion: 'SKIPPED',
    completedAt: '2026-08-23T06:00:00Z',
    detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
    source: 'github-actions',
    ...trustedProvenance,
  };
  const unrelatedRepositorySuccess = {
    ...neutralRepositoryTest,
    name: 'Build docs preview',
    conclusion: 'SUCCESS',
    workflowName: 'Poppy preview build',
    workflowPath: '.github/workflows/poppy-preview-build.yml',
  };
  assert.equal(
    summarizeLiveChecks([neutralRepositoryTest, unrelatedRepositorySuccess], options),
    'unknown'
  );
  assert.equal(
    summarizeLiveChecks(
      [neutralRepositoryTest, { ...neutralRepositoryTest, conclusion: 'SUCCESS' }],
      options
    ),
    'success'
  );
  assert.equal(
    summarizeLiveChecks(
      [
        neutralRepositoryTest,
        {
          ...neutralRepositoryTest,
          conclusion: 'SUCCESS',
          repository: 'fork/Proto-UI',
        },
      ],
      options
    ),
    'unknown'
  );
  assert.equal(
    summarizeLiveChecks(
      [
        neutralRepositoryTest,
        {
          ...neutralRepositoryTest,
          conclusion: 'SUCCESS',
          workflowPath: '.github/workflows/lookalike.yml',
        },
      ],
      options
    ),
    'unknown'
  );
});
