import assert from 'node:assert/strict';
import { withReviewTransportMetadata } from './review-pagination.mjs';
import { collectLiveReviewInput, submitGitHubReview } from '../../collect-live-review-input.mjs';
import {
  computeReviewInputDigest,
  renderReviewBody,
  reviewPacketMarker,
  reviewerPermissionSubjects,
} from '../../review-runtime.mjs';
import { agentEvidence } from './agent-evidence.mjs';
import { modelTraceFixture } from './modeltrace.mjs';

export const sha = (letter) => letter.repeat(40);
const publishedPackets = new Map();
const inputPublications = new WeakMap();

export function reviewSnapshot(overrides = {}) {
  const input = {
    schemaVersion: 5,
    kind: 'proto-ui.review-input',
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    pullRequest: 487,
    pullRequestState: 'OPEN',
    pullRequestAuthor: 'contributor',
    isDraft: false,
    baseRefName: 'main',
    baseSha: sha('a'),
    headSha: sha('b'),
    pullRequestBody: 'Bounded integration target',
    changedFiles: [{ path: 'packages/core/src/index.ts', previousPath: null, status: 'modified' }],
    commits: [
      {
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
      },
    ],
    reviews: [],
    comments: [],
    replies: [],
    threads: [{ id: 'thread-1', isResolved: true, updatedAt: '2026-08-27T06:00:00.000Z' }],
    checks: [
      {
        name: 'test',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        completedAt: '2026-08-27T06:00:00.000Z',
        detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
        source: 'github-actions',
        providerId: 'APP_github_actions',
        repository: 'Proto-UI/Proto-UI',
        workflowName: 'CI',
        workflowPath: '.github/workflows/ci.yml',
      },
    ],
    externalEvidence: [],
    ...overrides,
  };
  input.reviewerPermissions ??= [
    ...new Set(
      input.reviews
        .filter(
          (review) =>
            review.author !== null &&
            review.state === 'APPROVED' &&
            review.commitSha === input.headSha
        )
        .map((review) => review.author.toLowerCase())
    ),
  ].map((login) => reviewerPermission(input, login));
  return input;
}

export function reviewPacket(input, overrides = {}) {
  return {
    schemaVersion: 2,
    kind: 'proto-ui.review-packet',
    repositoryId: input.repositoryId,
    pullRequest: input.pullRequest,
    baseSha: input.baseSha,
    headSha: input.headSha,
    reviewInputDigest: computeReviewInputDigest(input),
    observedAt: '2026-08-27T06:00:00.000Z',
    reviewClass: 'review-governance-and-release-evidence',
    scope: ['exact-head pull-request integration'],
    affectedEntities: [],
    affectedSurfaces: ['GitHub pull request'],
    agentEvidence: agentEvidence(input.headSha, input.repositoryId),
    findings: [],
    validation: {
      commands: [{ command: 'pnpm test', exitCode: 0, result: 'passed' }],
      checksNotRun: [],
    },
    reconciliation: {
      priorReviewedHeadSha: null,
      priorPacketDigest: null,
      resolvedFindingIds: [],
      openFindingIds: [],
      newFindingIds: [],
    },
    limitations: [],
    unknowns: [],
    humanGates: [],
    recommendedAction: 'APPROVE',
    ...overrides,
  };
}

export function reviewerPermission(input, login = 'independent-reviewer', permission = 'write') {
  const repository = input.repositoryId.slice('github.com:'.length);
  return {
    login,
    permission,
    source: 'github-rest-collaborator-permission',
    endpoint: `repos/${repository}/collaborators/${encodeURIComponent(login)}/permission`,
    repositoryId: input.repositoryId,
    headSha: input.headSha,
  };
}

// Publish once, before any adversarial mutation. Later packet refreshes never
// manufacture another reviewer disposition or change this original artifact.
export function publishReview(before, packetOverrides = {}, reviewOverrides = {}) {
  const originalInput = structuredClone(before);
  const publishedPacket = reviewPacket(originalInput, packetOverrides);
  const input = structuredClone(originalInput);
  const review = {
    id: 'PRR_published',
    author: 'independent-reviewer',
    state: 'APPROVED',
    commitSha: before.headSha,
    submittedAt: '2026-08-27T08:00:00.000Z',
    body: renderReviewBody(publishedPacket),
    ...reviewOverrides,
  };
  input.reviews.push(review);
  for (const login of reviewerPermissionSubjects(input)) {
    if (!input.reviewerPermissions.some((observation) => observation.login === login)) {
      input.reviewerPermissions.push(reviewerPermission(input, login));
    }
  }
  publishedPackets.set(reviewPacketMarker(publishedPacket), structuredClone(publishedPacket));
  inputPublications.set(input, structuredClone(publishedPacket));
  return {
    before: originalInput,
    publishedPacket,
    input,
    packet: refreshPacket(publishedPacket, input),
  };
}

export function refreshPacket(publishedPacket, input, overrides = {}) {
  return {
    ...structuredClone(publishedPacket),
    reviewInputDigest: computeReviewInputDigest(input),
    observedAt: '2026-08-27T09:00:00.000Z',
    ...overrides,
  };
}

// Only recover an artifact already rendered by publishReview. No input or
// packet supplied to a merge call is ever approved implicitly by this helper.
export function fixturePublishedPacket(input) {
  if (inputPublications.has(input)) return structuredClone(inputPublications.get(input));
  for (const review of input.reviews) {
    for (const [marker, packet] of publishedPackets) {
      if (review.body?.includes(marker)) return structuredClone(packet);
    }
  }
  return null;
}

export function publicationRoundTrip({ existingApproval = false } = {}) {
  let before = reviewSnapshot({ reviews: [], threads: [] });
  const complete = (nodes) => ({ nodes, pageInfo: { hasNextPage: false } });
  const githubPayload = {
    data: {
      viewer: { login: 'contributor' },
      repository: {
        viewerPermission: 'WRITE',
        pullRequest: {
          state: before.pullRequestState,
          isDraft: before.isDraft,
          mergeable: 'MERGEABLE',
          mergeStateStatus: 'CLEAN',
          changedFiles: before.changedFiles.length,
          body: before.pullRequestBody,
          baseRefName: before.baseRefName,
          baseRefOid: before.baseSha,
          headRefOid: before.headSha,
          author: { login: before.pullRequestAuthor },
          commits: complete(
            before.commits.map((commit) => ({
              commit: {
                oid: commit.sha,
                message: commit.message,
                author: {
                  name: commit.author.name,
                  email: commit.author.email,
                  user: { login: commit.author.login },
                },
                committer: {
                  name: commit.committer.name,
                  email: commit.committer.email,
                  user: { login: commit.committer.login },
                },
                statusCheckRollup: {
                  contexts: complete([
                    {
                      __typename: 'CheckRun',
                      name: 'test',
                      status: 'COMPLETED',
                      conclusion: 'SUCCESS',
                      completedAt: '2026-08-27T06:00:00Z',
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
                  ]),
                },
              },
            }))
          ),
          reviews: complete([]),
          comments: complete([]),
          reviewThreads: complete([]),
        },
      },
    },
  };

  if (existingApproval) {
    githubPayload.data.repository.pullRequest.reviews.nodes = [
      {
        id: 'older-plain-review',
        author: { login: 'independent-reviewer' },
        state: 'APPROVED',
        commit: { oid: before.headSha },
        submittedAt: '2026-08-27T06:00:00Z',
        body: 'Earlier plain approval',
      },
    ];
  }
  const reads = [];
  const collect = () =>
    collectLiveReviewInput(before.repositoryId, before.pullRequest, {
      runner(_command, args) {
        reads.push(args);
        if (args.includes('graphql'))
          return JSON.stringify(withReviewTransportMetadata(githubPayload));
        if (args.includes('repos/Proto-UI/Proto-UI/pulls/487/files?per_page=100&page=1'))
          return JSON.stringify(
            before.changedFiles.map((file) => ({ filename: file.path, status: file.status }))
          );
        if (args.includes('repos/Proto-UI/Proto-UI/collaborators/independent-reviewer/permission'))
          return JSON.stringify({ user: { login: 'independent-reviewer' }, permission: 'write' });
        throw new Error(`unexpected fake read: ${args.join(' ')}`);
      },
    }).input;
  before = collect();
  const reviewed = reviewPacket(before);
  const body = renderReviewBody(reviewed);
  assert.match(
    body,
    /<!-- proto-ui:review-packet:sha256=[a-f0-9]{64} proto-ui:agent-evidence:sha256=[a-f0-9]{64} -->/
  );
  let writes = 0;
  const receipt = submitGitHubReview(
    before.repositoryId,
    before.pullRequest,
    { commitId: before.headSha, event: 'APPROVE', body },
    (_command, _args, options) => {
      writes += 1;
      assert.equal(JSON.parse(options.input).body, body);
      return JSON.stringify({
        id: 9001,
        state: 'APPROVED',
        commit_id: before.headSha,
        user: { login: 'independent-reviewer' },
        body,
      });
    },
    { reviewerLogin: 'independent-reviewer', ...modelTraceFixture(before.repositoryId) }
  );
  assert.equal(receipt.status, 'applied');
  assert.equal(writes, 1);

  githubPayload.data.repository.pullRequest.reviews.nodes.push({
    id: receipt.id,
    author: { login: 'independent-reviewer' },
    state: receipt.state,
    commit: { oid: receipt.commitId },
    submittedAt: '2026-08-27T06:01:00Z',
    body,
  });
  const collected = collect();
  const mergePacket = {
    ...reviewed,
    reviewInputDigest: computeReviewInputDigest(collected),
    observedAt: '2026-08-27T06:02:00Z',
  };
  assert.equal(reads.length, existingApproval ? 16 : 14);
  return { before, reviewed, collected, mergePacket, body };
}
