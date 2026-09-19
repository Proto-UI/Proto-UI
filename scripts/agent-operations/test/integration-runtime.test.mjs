import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import {
  agentEvidenceMarker,
  authorizePullRequestMerge,
  computeReviewInputDigest,
} from '../review-runtime.mjs';
import { agentEvidence } from './fixtures/agent-evidence.mjs';

const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const policy = parseYaml(
  readFileSync(path.join(root, 'internal/agent-operations/capability-policy.yaml'), 'utf8')
);
const activePolicy = structuredClone(policy);
for (const authorization of [
  ...(activePolicy.collaborationMutationAuthorizations ?? []),
  ...(activePolicy.reviewSubmissionAuthorizations ?? []),
  ...(activePolicy.pullRequestMergeAuthorizations ?? []),
]) {
  authorization.status = 'active';
  delete authorization.blockedBy;
}
const sha = (letter) => letter.repeat(40);

function reviewInput(overrides = {}) {
  return {
    schemaVersion: 4,
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
        },
        committer: {
          login: 'web-flow',
          name: 'GitHub',
          email: 'noreply@github.com',
        },
      },
    ],
    reviews: [
      {
        id: 'PRR_approved',
        author: 'independent-reviewer',
        state: 'APPROVED',
        commitSha: sha('b'),
        submittedAt: '2026-08-27T06:00:00.000Z',
        body: `Approved exact head\n\n<!-- ${evidenceReceiptMarker(sha('b'))} -->`,
      },
    ],
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
}

// The merge gate requires a live published receipt carrying the digest of the
// packet's Agent evidence; the fixture evidence depends only on the head SHA.
function evidenceReceiptMarker(headSha) {
  return agentEvidenceMarker({ schemaVersion: 2, agentEvidence: agentEvidence(headSha) });
}

function packet(input, overrides = {}) {
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
    agentEvidence: agentEvidence(input.headSha),
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

function scheduledMerge(overrides = {}) {
  const input = overrides.input ?? reviewInput();
  return authorizePullRequestMerge({
    packet: overrides.packet ?? packet(input),
    input,
    liveInput: overrides.liveInput ?? structuredClone(input),
    executionMode: 'autonomous',
    executionModeSource: 'schedule',
    authorizationId: 'proto-ui-scheduled-merge-v1',
    policy: overrides.policy ?? activePolicy,
    selfAssessment: {
      kind: 'proto-ui.agent-capability-self-result',
      fresh: true,
      validated: true,
      capability: { band: 'C2' },
    },
    credentialCanMerge: true,
    actor: 'contributor',
    ciConclusion: 'success',
    dcoConclusion: 'success',
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    ...overrides,
  });
}

test('standing authorization permits an exact-head merge after independent approval', () => {
  const unverified = packet(reviewInput());
  unverified.agentEvidence.debt[0].kind = 'verification';
  const denied = scheduledMerge({ packet: unverified });
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /verification debt/);
  const result = scheduledMerge();
  assert.equal(result.allowed, true);
  assert.equal(result.headSha, sha('b'));
  assert.equal(result.mergeMethod, 'squash');
  assert.equal(result.actor, 'contributor');
});
test('pending scheduled merge authorization rejects forged schedule metadata', () => {
  const result = scheduledMerge({ policy });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /unavailable/);
});

test('merge authorization fails closed on unresolved review, CI, state, or permission', () => {
  const noApproval = reviewInput({ reviews: [] });
  assert.match(
    scheduledMerge({ input: noApproval, packet: packet(noApproval) }).reason,
    /approval/
  );

  const activeChangeRequest = reviewInput({
    reviews: [
      {
        id: 'PRR_changes',
        author: 'reviewer',
        state: 'CHANGES_REQUESTED',
        commitSha: sha('b'),
        submittedAt: '2026-08-27T06:00:00.000Z',
        body: 'Blocking',
      },
    ],
  });
  assert.match(
    scheduledMerge({ input: activeChangeRequest, packet: packet(activeChangeRequest) }).reason,
    /change request/
  );

  const unresolved = reviewInput({
    threads: [{ id: 'thread-1', isResolved: false, updatedAt: '2026-08-27T06:00:00.000Z' }],
  });
  assert.match(scheduledMerge({ input: unresolved, packet: packet(unresolved) }).reason, /thread/);
  assert.match(scheduledMerge({ ciConclusion: 'unknown' }).reason, /trusted live checks/);
  assert.match(scheduledMerge({ dcoConclusion: 'unknown' }).reason, /DCO status/);
  assert.match(scheduledMerge({ mergeStateStatus: 'BLOCKED' }).reason, /merge-ready/);
  assert.match(scheduledMerge({ credentialCanMerge: false }).reason, /credential/);
  assert.match(
    scheduledMerge({
      packet: packet(reviewInput(), { humanGates: ['unresolved-product-direction'] }),
    }).reason,
    /clean review packet/
  );
  const wrongBase = reviewInput({ baseRefName: 'release' });
  assert.match(
    scheduledMerge({ input: wrongBase, packet: packet(wrongBase) }).reason,
    /base branch/
  );
  const drifted = reviewInput({ pullRequestBody: 'Changed after review' });
  assert.throws(() => scheduledMerge({ liveInput: drifted }), /canonical review input/);
});

test('exact-head approval excludes every commit author and committer platform identity', () => {
  for (const reviewer of ['contributor', 'web-flow']) {
    const input = reviewInput({
      pullRequestAuthor: 'different-pr-author',
      reviews: [
        {
          id: `PRR_${reviewer}`,
          author: reviewer,
          state: 'APPROVED',
          commitSha: sha('b'),
          submittedAt: '2026-08-27T06:00:00.000Z',
          body: 'Approved exact head',
        },
      ],
    });
    assert.match(scheduledMerge({ input, packet: packet(input) }).reason, /commit contributors/);
  }
  const unlinkedContributor = reviewInput();
  unlinkedContributor.commits[0].committer.login = null;
  assert.match(
    scheduledMerge({ input: unlinkedContributor, packet: packet(unlinkedContributor) }).reason,
    /verifiable platform identity/
  );
  const unknownApprover = reviewInput({
    reviews: [
      {
        id: 'PRR_unknown_approver',
        author: null,
        state: 'APPROVED',
        commitSha: sha('b'),
        submittedAt: '2026-08-27T06:00:00.000Z',
        body: 'Approval whose platform identity is unavailable',
      },
    ],
  });
  assert.match(
    scheduledMerge({ input: unknownApprover, packet: packet(unknownApprover) }).reason,
    /independent/
  );
});

test('old-head change requests remain active until the same reviewer supersedes or dismisses them', () => {
  const blocked = reviewInput({
    reviews: [
      {
        id: 'PRR_changes_old_head',
        author: 'blocking-reviewer',
        state: 'CHANGES_REQUESTED',
        commitSha: sha('c'),
        submittedAt: '2026-08-27T05:00:00.000Z',
        body: 'Blocking on an earlier head',
      },
      {
        id: 'PRR_approved_current_head',
        author: 'independent-reviewer',
        state: 'APPROVED',
        commitSha: sha('b'),
        submittedAt: '2026-08-27T06:00:00.000Z',
        body: `Approved exact head\n\n<!-- ${evidenceReceiptMarker(sha('b'))} -->`,
      },
    ],
  });
  assert.match(
    scheduledMerge({ input: blocked, packet: packet(blocked) }).reason,
    /not been superseded or dismissed/
  );

  const unknownBlockingReviewer = structuredClone(blocked);
  unknownBlockingReviewer.reviews[0].author = null;
  assert.match(
    scheduledMerge({
      input: unknownBlockingReviewer,
      packet: packet(unknownBlockingReviewer),
    }).reason,
    /not been superseded or dismissed/
  );

  const superseded = structuredClone(blocked);
  superseded.reviews.push({
    id: 'PRR_blocker_approved_current_head',
    author: 'blocking-reviewer',
    state: 'APPROVED',
    commitSha: sha('b'),
    submittedAt: '2026-08-27T07:00:00.000Z',
    body: `Prior request is resolved; approved exact head\n\n<!-- ${evidenceReceiptMarker(sha('b'))} -->`,
  });
  assert.equal(scheduledMerge({ input: superseded, packet: packet(superseded) }).allowed, true);

  const dismissed = structuredClone(blocked);
  dismissed.reviews[0].state = 'DISMISSED';
  dismissed.reviews[0].submittedAt = '2026-08-27T07:00:00.000Z';
  assert.equal(scheduledMerge({ input: dismissed, packet: packet(dismissed) }).allowed, true);
});

test('spec changes may be mechanically merged only after an independent exact-head approval', () => {
  const input = reviewInput({
    changedFiles: [
      { path: 'spec/contracts/C-EXAMPLE-0001.yaml', previousPath: null, status: 'modified' },
    ],
  });
  assert.equal(scheduledMerge({ input, packet: packet(input) }).allowed, true);
});

test('merge requires a published Agent evidence receipt and a v2 packet', () => {
  const unpublished = reviewInput({
    reviews: [
      {
        id: 'PRR_approved_no_receipt',
        author: 'independent-reviewer',
        state: 'APPROVED',
        commitSha: sha('b'),
        submittedAt: '2026-08-27T06:00:00.000Z',
        body: 'Approved exact head without any governed evidence receipt',
      },
    ],
  });
  const denied = scheduledMerge({ input: unpublished, packet: packet(unpublished) });
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /published Agent evidence receipt/);

  const legacyPacket = packet(reviewInput());
  delete legacyPacket.agentEvidence;
  legacyPacket.schemaVersion = 1;
  const legacy = scheduledMerge({ packet: legacyPacket });
  assert.equal(legacy.allowed, false);
  assert.match(legacy.reason, /schema v2/);

  const viaComment = reviewInput({
    reviews: [
      {
        id: 'PRR_approved_plain',
        author: 'independent-reviewer',
        state: 'APPROVED',
        commitSha: sha('b'),
        submittedAt: '2026-08-27T06:00:00.000Z',
        body: 'Approved exact head',
      },
    ],
    comments: [
      {
        id: 'IC_evidence',
        author: 'agent',
        body: `Additive Agent evidence publication\n\n<!-- ${evidenceReceiptMarker(sha('b'))} -->`,
        updatedAt: '2026-08-27T06:30:00.000Z',
      },
    ],
  });
  assert.equal(scheduledMerge({ input: viaComment, packet: packet(viaComment) }).allowed, true);
});
