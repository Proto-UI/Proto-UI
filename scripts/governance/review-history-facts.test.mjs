import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPullRequestFacts } from './review-history-facts.mjs';

function fixture() {
  const object = {
    number: 1676,
    state: 'closed',
    pull_request: { merged_at: '2026-11-21T21:51:54Z' },
  };
  const nodes = (rows) => ({
    nodes: rows,
    totalCount: rows.length,
    pageInfo: { hasNextPage: false },
  });
  const pr = {
    headRefOid: 'candidate',
    baseRefOid: 'base',
    mergedAt: object.pull_request.merged_at,
    mergedBy: { login: 'maintainer' },
    mergeCommit: { oid: 'actual-merge' },
    files: nodes([{ path: 'packages/prototypes/base/src/select/item.proto.ts' }]),
    commits: nodes([
      {
        commit: {
          message: 'Own work\n\nSigned-off-by: Contributor <contributor@example.test>',
          author: { name: 'Contributor', email: 'contributor@example.test' },
        },
      },
    ]),
    reviews: nodes([]),
    head: {
      nodes: [
        {
          commit: {
            statusCheckRollup: {
              state: 'FAILURE',
              contexts: nodes([
                {
                  name: 'DCO',
                  conclusion: 'SUCCESS',
                  detailsUrl: 'https://example.test/native-dco',
                },
                {
                  name: 'browser',
                  conclusion: 'SKIPPED',
                  detailsUrl: 'https://example.test/skipped',
                },
                { name: 'types', conclusion: 'FAILURE', detailsUrl: 'https://example.test/failed' },
              ]),
            },
          },
        },
      ],
    },
  };
  const decision = {
    group: 'merged-with-explicit-evidence-gaps',
    pullRequestFacts: {
      head: 'candidate',
      base: 'base',
      merge: 'actual-merge',
      terminalState: 'MERGED',
      mergedAt: object.pull_request.merged_at,
      mergedBy: 'maintainer',
      filePaths: ['packages/prototypes/base/src/select/item.proto.ts'],
      reviewIds: [],
      observedExactHeadApprovalIds: [],
      observedChangesRequestedIds: [],
      observedHeadRollup: 'FAILURE',
      observedContextCounts: { SUCCESS: 1, SKIPPED: 1, FAILURE: 1 },
      contextCount: 3,
      contextPaginationComplete: true,
      nativeDco: [{ name: 'DCO', state: 'SUCCESS', url: 'https://example.test/native-dco' }],
      originalCommitTrailers: {
        authorMatched: 1,
        presentButNotAuthorMatched: 0,
        absent: 0,
        total: 1,
      },
    },
  };
  return { object, capture: { pullRequest: pr }, decision };
}

test('native merge can coexist with failed, skipped and absent independent-review evidence', () => {
  const { object, capture, decision } = fixture();
  assert.doesNotThrow(() => verifyPullRequestFacts(object, capture, decision));
  assert.equal(decision.pullRequestFacts.observedHeadRollup, 'FAILURE');
  assert.deepEqual(decision.pullRequestFacts.observedExactHeadApprovalIds, []);
});

test('merge state cannot wash failed or skipped contexts into technical passes', () => {
  const { object, capture, decision } = fixture();
  decision.pullRequestFacts.observedContextCounts = { SUCCESS: 3 };
  assert.throws(
    () => verifyPullRequestFacts(object, capture, decision),
    /exact SUCCESS\/FAILURE\/SKIPPED/
  );
});

test('a recorded approval on another head cannot become exact-head approval', () => {
  const { object, capture, decision } = fixture();
  capture.pullRequest.reviews = {
    nodes: [{ databaseId: 10, state: 'APPROVED', commit: { oid: 'older-head' } }],
    totalCount: 1,
    pageInfo: { hasNextPage: false },
  };
  decision.group = 'merged-with-preserved-native-evidence';
  decision.pullRequestFacts.reviewIds = [10];
  decision.pullRequestFacts.observedExactHeadApprovalIds = [10];
  assert.throws(
    () => verifyPullRequestFacts(object, capture, decision),
    /observedExactHeadApprovalIds/
  );
});

test('a present trailer for another author is not an author-matched certificate', () => {
  const { object, capture, decision } = fixture();
  capture.pullRequest.commits.nodes[0].commit.author.email = 'different@example.test';
  assert.throws(
    () => verifyPullRequestFacts(object, capture, decision),
    /literal original author\/signoff matches/
  );
});

test('incomplete native pagination cannot acquire a complete-history disposition', () => {
  const { object, capture, decision } = fixture();
  capture.pullRequest.files.pageInfo.hasNextPage = true;
  assert.throws(() => verifyPullRequestFacts(object, capture, decision), /files terminal/);
});
