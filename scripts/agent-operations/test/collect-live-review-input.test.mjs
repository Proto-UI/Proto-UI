import assert from 'node:assert/strict';
import test from 'node:test';
import { computeReviewInputDigest } from '../review-runtime.mjs';
import {
  assertNoTruncation,
  buildLiveReviewInput,
  collectLiveReviewInput,
  collectCurrentReviewerPermissions,
  GITHUB_WEB_FLOW_PLATFORM,
  MAX_LIVE_RESPONSE_BYTES,
  normalizeCheck,
  submitGitHubMerge,
  submitGitHubReview,
  summarizeLiveChecks,
  summarizeLiveDco,
} from '../collect-live-review-input.mjs';

const sha = (letter) => letter.repeat(40);
const repositoryId = 'github.com:Proto-UI/Proto-UI';
const trustedProvenance = {
  providerId: 'APP_github_actions',
  repository: 'Proto-UI/Proto-UI',
  workflowName: 'CI',
  workflowPath: '.github/workflows/ci.yml',
};
const trustedDcoOptions = {
  repositoryId,
  trustedRepositoryId: repositoryId,
  trustedCheckName: 'DCO',
  trustedSource: 'dco',
  trustedProviderId: 'MDM6QXBwMTg2MQ==',
  trustedDetailsUrl: 'https://probot.github.io/apps/dco/',
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
            nodes: [
              {
                commit: {
                  oid: sha('b'),
                  message: 'Bounded change\n\nSigned-off-by: Contributor <contributor@example.com>',
                  author: {
                    name: 'Contributor',
                    email: 'contributor@example.com',
                    user: { login: 'contributor' },
                  },
                  committer: {
                    name: 'GitHub',
                    email: 'noreply@github.com',
                    user: { login: 'web-flow' },
                  },
                },
              },
            ],
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
                        app: { id: 'APP_github_actions', slug: 'github-actions' },
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
  assert.equal(result.input.pullRequestAuthor, 'contributor');
  assert.deepEqual(result.input.commits[0], {
    sha: sha('b'),
    message: 'Bounded change\n\nSigned-off-by: Contributor <contributor@example.com>',
    author: {
      login: 'contributor',
      name: 'Contributor',
      email: 'contributor@example.com',
      platform: null,
    },
    committer: {
      login: 'web-flow',
      name: 'GitHub',
      email: 'noreply@github.com',
      platform: null,
    },
  });
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
  assert.equal(summarizeLiveChecks(result.input.checks, trustedOptions), 'failure');
  assert.deepEqual(result.input.externalEvidence, []);
});

test('live collector records a verified GitHub platform committer without weakening fail-closed identity', () => {
  // Live-realistic GitHub "Update branch" merge modeled on PR #509 commit
  // 60c8bdd: the human author is linked to an account, while the committer is
  // GitHub's web-flow identity (user null) attested by GitHub's own valid
  // GPG signature. The canonical model records that verified platform
  // identity explicitly instead of an unresolved null.
  const updateBranch = payload();
  updateBranch.data.repository.pullRequest.commits.nodes.unshift({
    commit: {
      oid: sha('c'),
      message: "Merge branch 'main' into codex/issue-504-event-shadow",
      author: { name: 'cyjin.yl', email: 'cyjin.yl@gmail.com', user: { login: 'cyjin-yl' } },
      committer: { name: 'GitHub', email: 'noreply@github.com', user: null },
      signature: { __typename: 'GpgSignature', isValid: true, wasSignedByGitHub: true },
    },
  });
  const result = buildLiveReviewInput(
    updateBranch,
    'github.com:Proto-UI/Proto-UI',
    487,
    [],
    changedFiles
  );
  assert.equal(result.input.commits.length, 2);
  assert.deepEqual(result.input.commits[0].committer, {
    login: null,
    name: 'GitHub',
    email: 'noreply@github.com',
    platform: GITHUB_WEB_FLOW_PLATFORM,
  });
  assert.equal(result.input.commits[0].author.login, 'cyjin-yl');
  assert.equal(result.input.commits[0].author.platform, null);
  assert.equal(result.input.commits[1].committer.platform, null);

  // The same committer shape without GitHub's signature attestation is a
  // forgeable human identity claim and must stay an unresolved null.
  const unattested = payload();
  unattested.data.repository.pullRequest.commits.nodes.unshift({
    commit: {
      oid: sha('c'),
      message: "Merge branch 'main' into codex/issue-504-event-shadow",
      author: { name: 'cyjin.yl', email: 'cyjin.yl@gmail.com', user: { login: 'cyjin-yl' } },
      committer: { name: 'GitHub', email: 'noreply@github.com', user: null },
      signature: { __typename: 'SshSignature', isValid: false, wasSignedByGitHub: false },
    },
  });
  const unresolved = buildLiveReviewInput(
    unattested,
    'github.com:Proto-UI/Proto-UI',
    487,
    [],
    changedFiles
  );
  assert.equal(unresolved.input.commits[0].committer.platform, null);

  const unsigned = buildLiveReviewInput(
    payload(),
    'github.com:Proto-UI/Proto-UI',
    487,
    [],
    changedFiles
  );
  assert.equal(unsigned.input.commits[0].committer.platform, null);
});

test('a GitHub-valid commit signature cannot promote the author role to platform identity', () => {
  // The commit signature attests the actor that created the commit object
  // (the committer). The author block is metadata the committer supplies,
  // so an unlinked author named `GitHub` must not be promoted to the
  // trusted platform identity from the same attestation; only the
  // committer role is identified by the commit signature
  // (PR509-PLATFORM-AUTHOR-IDENTITY-008).
  const forged = payload();
  forged.data.repository.pullRequest.commits.nodes.unshift({
    commit: {
      oid: sha('d'),
      message: "Merge branch 'main' into fixture",
      author: { name: 'GitHub', email: 'noreply@github.com', user: null },
      committer: { name: 'GitHub', email: 'noreply@github.com', user: null },
      signature: { __typename: 'GpgSignature', isValid: true, wasSignedByGitHub: true },
    },
  });
  const result = buildLiveReviewInput(
    forged,
    'github.com:Proto-UI/Proto-UI',
    487,
    [],
    changedFiles
  );
  assert.equal(result.input.commits[0].author.login, null);
  assert.equal(result.input.commits[0].author.platform, null);
  assert.deepEqual(result.input.commits[0].committer.platform, GITHUB_WEB_FLOW_PLATFORM);
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

test('live collector preserves unavailable review identity as null', () => {
  const deletedReviewer = payload();
  deletedReviewer.data.repository.pullRequest.reviews.nodes[0].author = null;
  const result = buildLiveReviewInput(
    deletedReviewer,
    'github.com:Proto-UI/Proto-UI',
    487,
    [],
    changedFiles
  );
  assert.equal(result.input.reviews[0].author, null);
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

test('lost review POST stays unknown despite a matching concurrent same-credential review', () => {
  const calls = [];
  const result = submitGitHubReview(
    repositoryId,
    487,
    { commitId: sha('b'), event: 'APPROVE', body: 'review body' },
    (command, args) => {
      calls.push({ command, args });
      if (args[2] === 'POST') throw new Error('connection lost after write');
      return JSON.stringify([
        [
          {
            id: 5678,
            node_id: 'PRR_review_3',
            user: { login: 'reviewer' },
            state: 'APPROVED',
            commit_id: sha('b'),
            body: 'review body',
            html_url: 'https://github.com/Proto-UI/Proto-UI/pull/487#pullrequestreview-5678',
          },
        ],
      ]);
    },
    { reviewerLogin: 'reviewer', invocationId: 'invocation-1' }
  );

  assert.equal(calls.length, 2);
  assert.ok(calls[1].args.includes('--slurp'));
  assert.equal(calls[1].args[1], '--method');
  assert.equal(calls[1].args[2], 'GET');
  assert.equal(result.status, 'unknown');
  assert.equal(result.reconciled, false);
  assert.equal(result.invocationId, 'invocation-1');
  assert.equal(result.commitId, sha('b'));
});

test('lost review reconciliation preserves the documented buffer and unknown outcome', () => {
  // A review-heavy pull request can push the paginated reconciliation
  // response far above the implicit 1 MiB child-process buffer. The
  // reconciliation (and submission) calls must carry the same documented
  // MAX_LIVE_RESPONSE_BYTES bound, so live state is read
  // exactly once instead of surfacing as an unattributed ENOBUFS
  // (PR509-REVIEW-RECONCILIATION-BUFFER-007).
  const reviewBody = 'review body';
  const paddingReviews = Array.from({ length: 2400 }, (_, index) => ({
    id: 90000 + index,
    node_id: `PRR_pad_${index}`,
    user: { login: 'padding-reviewer' },
    state: 'COMMENTED',
    commit_id: sha('c'),
    body: `padding review ${index}\n${'line'.repeat(200)}`,
  }));
  const reconciliationJson = JSON.stringify([
    [
      {
        id: 5679,
        node_id: 'PRR_review_4',
        user: { login: 'reviewer' },
        state: 'APPROVED',
        commit_id: sha('b'),
        body: reviewBody,
        html_url: 'https://github.com/Proto-UI/Proto-UI/pull/487#pullrequestreview-5679',
      },
      ...paddingReviews,
    ],
  ]);
  assert.ok(
    reconciliationJson.length > 1024 * 1024,
    'the regression reconciliation response must exceed the legacy 1 MiB default'
  );
  const seenOptions = [];
  const result = submitGitHubReview(
    repositoryId,
    487,
    { commitId: sha('b'), event: 'APPROVE', body: reviewBody },
    (command, args, options) => {
      seenOptions.push(options);
      if (args[2] === 'POST') throw new Error('connection lost after write');
      return reconciliationJson;
    },
    { reviewerLogin: 'reviewer', invocationId: 'invocation-large' }
  );
  assert.equal(seenOptions.length, 2);
  assert.ok(
    seenOptions.every((options) => options.maxBuffer === MAX_LIVE_RESPONSE_BYTES),
    'submission and reconciliation must both carry the documented payload bound'
  );
  assert.equal(result.status, 'unknown');
  assert.equal(result.reconciled, false);
  assert.equal(result.invocationId, 'invocation-large');
});

test('returns an explicit unknown receipt when review reconciliation cannot prove the write', () => {
  const calls = [];
  const result = submitGitHubReview(
    repositoryId,
    487,
    { commitId: sha('b'), event: 'REQUEST_CHANGES', body: 'review body' },
    (command, args) => {
      calls.push({ command, args });
      if (args[2] === 'POST') throw new Error('connection lost after write');
      return JSON.stringify([[]]);
    },
    { reviewerLogin: 'reviewer', invocationId: 'invocation-2' }
  );

  assert.equal(calls.length, 2);
  assert.equal(result.status, 'unknown');
  assert.equal(result.invocationId, 'invocation-2');
  assert.equal(result.commitId, sha('b'));
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
        user: { login: 'reviewer' },
        body: '',
        node_id: 'PRR_review_2',
        state: 'APPROVED',
        commit_id: sha('b'),
        html_url: 'https://github.com/Proto-UI/Proto-UI/pull/487#pullrequestreview-1234',
      });
    },
    { reviewerLogin: 'reviewer' }
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
        () => JSON.stringify({ id: 1234, state: 'APPROVED', commit_id: sha('c') }),
        { reviewerLogin: 'reviewer' }
      ),
    /does not match the inspected head/
  );
  assert.throws(
    () =>
      submitGitHubReview(
        'github.com:Proto-UI/Proto-UI',
        487,
        { commitId: sha('b'), event: 'APPROVE', body: '' },
        () => JSON.stringify({ id: 1234, state: 'COMMENTED', commit_id: sha('b') }),
        { reviewerLogin: 'reviewer' }
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
      if (args.some((arg) => arg.endsWith('/merge'))) {
        return JSON.stringify({
          sha: sha('c'),
          merged: true,
          message: 'Pull Request successfully merged',
        });
      }
      return JSON.stringify({
        merged: true,
        head: { sha: sha('b') },
        merge_commit_sha: sha('c'),
        merged_at: '2026-08-27T01:00:10Z',
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
  assert.equal(calls.length, 2);
  assert.equal(result.liveHeadSha, sha('b'));
  assert.equal(result.mergedAt, '2026-08-27T01:00:10Z');
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
      providerId: null,
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
      providerId: null,
      repository: null,
      workflowName: null,
      workflowPath: null,
    }
  );
});

test('trusted DCO status requires the exact check, app provider, repository, and URL', () => {
  const trustedDco = {
    name: 'DCO',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    completedAt: '2026-08-23T06:00:00Z',
    detailsUrl: 'https://probot.github.io/apps/dco/',
    source: 'dco',
    providerId: 'MDM6QXBwMTg2MQ==',
    repository: 'Proto-UI/Proto-UI',
    workflowName: null,
    workflowPath: null,
  };
  assert.equal(summarizeLiveDco([trustedDco], trustedDcoOptions), 'success');
  assert.equal(
    summarizeLiveDco([{ ...trustedDco, conclusion: 'FAILURE' }], trustedDcoOptions),
    'failure'
  );
  const trustedCi = {
    name: 'test',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    completedAt: '2026-08-23T06:00:00Z',
    detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
    source: 'github-actions',
    ...trustedProvenance,
  };
  const failedDco = { ...trustedDco, conclusion: 'FAILURE' };
  assert.equal(
    summarizeLiveChecks([trustedCi, failedDco], trustedOptions),
    'failure',
    'main keeps failed external checks blocking in addition to the separately trusted DCO gate'
  );
  assert.equal(summarizeLiveDco([trustedCi, failedDco], trustedDcoOptions), 'failure');
  assert.equal(
    summarizeLiveDco(
      [{ ...trustedDco, status: 'IN_PROGRESS', conclusion: null }],
      trustedDcoOptions
    ),
    'unknown'
  );
  for (const [field, value] of [
    ['name', 'DCO lookalike'],
    ['source', 'github-actions'],
    ['providerId', 'APP_lookalike'],
    ['repository', 'fork/Proto-UI'],
    ['detailsUrl', 'https://example.com/dco'],
    ['workflowName', 'CI'],
    ['workflowPath', '.github/workflows/ci.yml'],
  ]) {
    assert.equal(
      summarizeLiveDco([{ ...trustedDco, [field]: value }], trustedDcoOptions),
      'unknown',
      `${field} drift must not be trusted as DCO status evidence`
    );
  }
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
          detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/2',
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
          providerId: 'APP_vercel',
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

test('live collector consumes a canonical changed-file response above the legacy 1 MiB buffer', () => {
  // PR509-LIVE-INPUT-BUFFER-001: PR #509's paginated changed-file JSON is over
  // 1 MiB; collection must not die on Node's incidental child-process default.
  const graphqlPayload = payload();
  const files = Array.from({ length: 100 }, (_, index) => ({
    filename: `packages/core/src/file-${index}.ts`,
    previous_filename: null,
    status: 'modified',
    patch: `+${'changed line\n'.repeat(1000)}`,
  }));
  graphqlPayload.data.repository.pullRequest.changedFiles = files.length;
  const filePagesJson = JSON.stringify([files]);
  assert.ok(
    filePagesJson.length > 1024 * 1024,
    'the regression changed-file response must exceed the legacy 1 MiB default'
  );
  const seenOptions = [];
  const result = collectLiveReviewInput('github.com:Proto-UI/Proto-UI', 487, {
    runner(command, args, options) {
      seenOptions.push(options);
      return args.includes('graphql') ? JSON.stringify(graphqlPayload) : filePagesJson;
    },
  });
  assert.equal(result.input.changedFiles.length, files.length);
  assert.ok(
    seenOptions.length === 2 &&
      seenOptions.every((options) => options.maxBuffer === MAX_LIVE_RESPONSE_BYTES),
    'every live collection call must carry the documented payload bound'
  );
});

test('live collector paginates reviews and review threads before canonical validation', () => {
  const initial = payload();
  initial.data.repository.pullRequest.reviews.pageInfo = {
    hasNextPage: true,
    endCursor: 'reviews-page-1',
  };
  initial.data.repository.pullRequest.reviewThreads.pageInfo = {
    hasNextPage: true,
    endCursor: 'threads-page-1',
  };
  const calls = [];
  const result = collectLiveReviewInput(repositoryId, 487, {
    runner(_command, args, options) {
      calls.push({ args, options });
      if (args.includes('repos/Proto-UI/Proto-UI/collaborators/later-reviewer/permission'))
        return JSON.stringify({
          user: { login: 'later-reviewer' },
          permission: 'write',
          role_name: 'maintain',
        });
      if (!args.includes('graphql')) return JSON.stringify([changedFiles]);
      const query = args.find((value) => value.startsWith('query='));
      if (query.includes('reviews(first: 100, after: $cursor)')) {
        return JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                reviews: {
                  nodes: [
                    {
                      id: 'PRR_review_2',
                      author: { login: 'later-reviewer' },
                      state: 'APPROVED',
                      commit: { oid: sha('b') },
                      submittedAt: '2026-08-23T07:00:00Z',
                      body: 'Later review',
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: 'reviews-page-2' },
                },
              },
            },
          },
        });
      }
      if (query.includes('reviewThreads(first: 100, after: $cursor)')) {
        return JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  nodes: [
                    {
                      id: 'PRR_kwT2',
                      isResolved: false,
                      comments: {
                        nodes: [
                          {
                            databaseId: 1002,
                            author: { login: 'later-reviewer' },
                            body: 'Later thread',
                            updatedAt: '2026-08-23T07:30:00Z',
                          },
                        ],
                        pageInfo: { hasNextPage: false },
                      },
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: 'threads-page-2' },
                },
              },
            },
          },
        });
      }
      return JSON.stringify(initial);
    },
  });

  assert.equal(result.input.reviews.length, 2);
  assert.equal(result.input.threads.length, 2);
  assert.equal(result.input.replies.length, 2);
  assert.equal(calls.length, 5);
  assert.equal(result.input.reviewerPermissions[0].permission, 'write');
  assert.ok(calls.slice(1, 3).every(({ args }) => args.includes('-F')));
  assert.ok(calls.slice(1, 3).every(({ args }) => args.some((value) => value.includes('cursor='))));
});

test('live collector fails on the explicit documented payload bound instead of an incidental ENOBUFS', () => {
  assert.throws(
    () =>
      collectLiveReviewInput('github.com:Proto-UI/Proto-UI', 487, {
        runner() {
          const error = new Error('spawnSync gh ENOBUFS');
          error.code = 'ENOBUFS';
          throw error;
        },
      }),
    /exceeds the documented \d+-byte payload bound/
  );
});

test('Vercel authorization failure is not trusted CI, but real CI failures still block', () => {
  const ci = {
    name: 'test',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    completedAt: '2026-09-23T03:00:00Z',
    detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
    source: 'github-actions',
    ...trustedProvenance,
  };
  const previewStatus = {
    __typename: 'StatusContext',
    context: 'Vercel',
    state: 'FAILURE',
    createdAt: '2026-09-23T03:00:00Z',
    targetUrl: 'https://vercel.com/git/authorize?team=external',
    creator: { login: 'vercel', __typename: 'Bot' },
  };
  const preview = normalizeCheck(previewStatus);
  const options = { ...trustedOptions, trustedCheckNames: ['test'] };

  assert.equal(summarizeLiveChecks([ci, preview], options), 'success');
  assert.equal(
    summarizeLiveChecks(
      [ci, normalizeCheck({ ...previewStatus, creator: { login: 'other', __typename: 'Bot' } })],
      options
    ),
    'failure',
    'a non-Vercel publisher cannot forge an authorization-only preview debt'
  );
  assert.equal(
    summarizeLiveChecks([{ ...ci, conclusion: 'FAILURE' }, preview], options),
    'failure'
  );
  assert.equal(
    summarizeLiveChecks([ci, preview, { ...preview, name: 'DCO' }], options),
    'failure',
    'repository-required DCO failure cannot be hidden by preview authorization debt'
  );
  assert.equal(
    summarizeLiveChecks([{ ...ci, status: 'IN_PROGRESS', conclusion: null }, preview], options),
    'unknown'
  );
  assert.equal(
    summarizeLiveChecks(
      [ci, { ...preview, detailsUrl: 'https://vercel.com/deployments/failed' }],
      options
    ),
    'failure',
    'a real deployment failure is not an authorization-only preview debt'
  );
});

for (const [name, change] of [
  [
    'wrong actor',
    (r) => {
      r.user.login = 'other-reviewer';
    },
  ],
  [
    'missing actor',
    (r) => {
      delete r.user;
    },
  ],
  [
    'wrong body',
    (r) => {
      r.body = 'another review';
    },
  ],
  [
    'missing body',
    (r) => {
      delete r.body;
    },
  ],
]) {
  test(`successful review POST rejects ${name} provenance`, () => {
    const response = {
      id: 1234,
      state: 'APPROVED',
      commit_id: sha('b'),
      body: 'review body',
      user: { login: 'reviewer' },
    };
    change(response);
    let writes = 0;
    assert.throws(
      () =>
        submitGitHubReview(
          repositoryId,
          487,
          { commitId: sha('b'), event: 'APPROVE', body: 'review body' },
          () => {
            writes += 1;
            return JSON.stringify(response);
          },
          { reviewerLogin: 'reviewer' }
        ),
      /provenance/
    );
    assert.equal(writes, 1);
  });
}

test('review submission requires the verified acting identity before writing', () => {
  let writes = 0;
  assert.throws(
    () =>
      submitGitHubReview(
        repositoryId,
        487,
        { commitId: sha('b'), event: 'COMMENT', body: 'body' },
        () => {
          writes += 1;
          return JSON.stringify({ id: 1, commit_id: sha('b'), state: 'COMMENTED' });
        }
      ),
    /reviewer identity/
  );
  assert.equal(writes, 0);
});

for (const pageInfo of [undefined, null, {}, { hasNextPage: 'false' }, { hasNextPage: null }]) {
  test(`connection completeness requires a boolean page flag: ${JSON.stringify(pageInfo)}`, () => {
    assert.throws(() => assertNoTruncation([], pageInfo, 'reviews'), /pagination.*malformed/);
  });
}

test('live review pagination rejects repeated continuation cursors', () => {
  const initial = payload();
  initial.data.repository.pullRequest.reviews.pageInfo = { hasNextPage: true, endCursor: 'repeat' };
  let reads = 0;
  assert.throws(
    () =>
      collectLiveReviewInput(repositoryId, 487, {
        runner(_command, args) {
          reads += 1;
          if (reads > 3) throw new Error('test safety guard: cursor never advances');
          if (reads === 1) return JSON.stringify(initial);
          return JSON.stringify({
            data: {
              repository: {
                pullRequest: {
                  reviews: {
                    nodes: [],
                    pageInfo: { hasNextPage: true, endCursor: 'repeat' },
                  },
                },
              },
            },
          });
        },
      }),
    /repeated.*cursor/
  );
  assert.equal(reads, 2);
});

function approvalPayload() {
  const value = payload();
  value.data.repository.pullRequest.reviews.nodes[0].state = 'APPROVED';
  return value;
}

for (const permission of ['admin', 'write', 'read', 'none']) {
  test(`permission collection binds live ${permission} facts and ignores caller-provided upgrades`, () => {
    const calls = [];
    const live = collectLiveReviewInput(repositoryId, 487, {
      reviewerPermissions: [{ login: 'earlier-reviewer', permission: 'admin' }],
      now: () => new Date('2026-10-01T15:00:00Z'),
      runner(_command, args) {
        calls.push(args);
        if (args.includes('graphql')) return JSON.stringify(approvalPayload());
        if (args.includes('repos/Proto-UI/Proto-UI/collaborators/earlier-reviewer/permission'))
          return JSON.stringify({
            user: { login: 'earlier-reviewer' },
            permission,
            role_name: 'admin',
          });
        return JSON.stringify([changedFiles]);
      },
    });
    assert.deepEqual(live.input.reviewerPermissions, [
      {
        login: 'earlier-reviewer',
        permission,
        source: 'github-rest-collaborator-permission',
        endpoint: 'repos/Proto-UI/Proto-UI/collaborators/earlier-reviewer/permission',
        repositoryId,
        headSha: sha('b'),
      },
    ]);
    assert.equal(live.permissionsObservedAt, '2026-10-01T15:00:00.000Z');
    assert.equal(calls.length, 3);
  });
}

for (const response of [
  null,
  {},
  { user: { login: 'other-person' }, permission: 'admin' },
  { user: { login: 'earlier-reviewer' } },
  { user: { login: 'earlier-reviewer' }, permission: 'maintain' },
]) {
  test(`permission collection rejects an unavailable or mismatched observation: ${JSON.stringify(response)}`, () => {
    const input = buildLiveReviewInput(
      approvalPayload(),
      repositoryId,
      487,
      [],
      changedFiles
    ).input;
    assert.throws(
      () => collectCurrentReviewerPermissions(input, { runner: () => JSON.stringify(response) }),
      /permission identity or value is unavailable/
    );
  });
}

test('permission read denial remains a fail-closed read error with no alternate query', () => {
  const input = buildLiveReviewInput(approvalPayload(), repositoryId, 487, [], changedFiles).input;
  let reads = 0;
  assert.throws(
    () =>
      collectCurrentReviewerPermissions(input, {
        runner() {
          reads += 1;
          throw new Error('HTTP 403 Forbidden');
        },
      }),
    /403/
  );
  assert.equal(reads, 1);
});

test('fresh permission observations change the receipt clock but not unchanged canonical facts', () => {
  const runner = (_command, args) => {
    if (args.includes('graphql')) return JSON.stringify(approvalPayload());
    if (args.some((arg) => arg.endsWith('/permission')))
      return JSON.stringify({ user: { login: 'earlier-reviewer' }, permission: 'write' });
    return JSON.stringify([changedFiles]);
  };
  const first = collectLiveReviewInput(repositoryId, 487, {
    runner,
    now: () => new Date('2026-10-01T15:00:00Z'),
  });
  const second = collectLiveReviewInput(repositoryId, 487, {
    runner,
    now: () => new Date('2026-10-01T15:01:00Z'),
  });
  assert.notEqual(first.permissionsObservedAt, second.permissionsObservedAt);
  assert.equal(computeReviewInputDigest(first.input), computeReviewInputDigest(second.input));
});

for (const [name, mutate] of [
  [
    'pull-request author',
    (p) => {
      p.reviews.nodes[0].author.login = 'contributor';
    },
  ],
  [
    'commit committer',
    (p) => {
      p.reviews.nodes[0].author.login = 'web-flow';
    },
  ],
  [
    'old-head approval',
    (p) => {
      p.reviews.nodes[0].commit.oid = sha('c');
    },
  ],
  [
    'unavailable reviewer',
    (p) => {
      p.reviews.nodes[0].author = null;
    },
  ],
  [
    'superseded approval',
    (p) => {
      p.reviews.nodes.push({
        ...p.reviews.nodes[0],
        id: 'newer-review',
        state: 'CHANGES_REQUESTED',
        submittedAt: '2026-08-23T06:00:00Z',
      });
    },
  ],
  [
    'dismissed approval',
    (p) => {
      p.reviews.nodes[0].state = 'DISMISSED';
    },
  ],
]) {
  test(`permission collection skips an already ineligible ${name}`, () => {
    const source = approvalPayload();
    mutate(source.data.repository.pullRequest);
    const input = buildLiveReviewInput(source, repositoryId, 487, [], changedFiles).input;
    let reads = 0;
    assert.deepEqual(
      collectCurrentReviewerPermissions(input, {
        runner() {
          reads += 1;
          throw new Error('irrelevant permission lookup must not occur');
        },
      }),
      []
    );
    assert.equal(reads, 0);
  });
}
