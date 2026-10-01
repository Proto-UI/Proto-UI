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
  validateReviewInputSnapshot,
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
  ].map((login) => ({
    login,
    permission: 'write',
    source: 'github-rest-collaborator-permission',
    endpoint: `repos/Proto-UI/Proto-UI/collaborators/${encodeURIComponent(login)}/permission`,
    repositoryId: input.repositoryId,
    headSha: input.headSha,
  }));
  return input;
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

test('merge requires published preview-authorization debt even after independent approval', () => {
  const preview = {
    name: 'Vercel',
    status: 'COMPLETED',
    conclusion: 'FAILURE',
    completedAt: '2026-09-23T03:00:00.000Z',
    detailsUrl: 'https://vercel.com/git/authorize?team=external',
    source: 'vercel',
    providerId: null,
    repository: null,
    workflowName: null,
    workflowPath: null,
  };
  const input = reviewInput({ checks: [...reviewInput().checks, preview] });
  const denied = scheduledMerge({ input, packet: packet(input) });
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /preview authorization debt/);

  const evidence = agentEvidence(input.headSha);
  evidence.debt.push({
    kind: 'publication',
    missing: 'Vercel preview deployment',
    reason: 'The external team has not authorized the contributor; repository CI passed.',
    nextAction: 'Authorize deployment and verify the preview independently.',
  });
  const disclosed = reviewInput({
    checks: input.checks,
    reviews: [
      {
        ...input.reviews[0],
        body: `Approved exact head with preview debt\n\n<!-- ${agentEvidenceMarker({ schemaVersion: 2, agentEvidence: evidence })} -->`,
      },
    ],
  });
  assert.equal(
    scheduledMerge({ input: disclosed, packet: packet(disclosed, { agentEvidence: evidence }) })
      .allowed,
    true
  );
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
  const commentResult = scheduledMerge({ input: viaComment, packet: packet(viaComment) });
  assert.equal(commentResult.allowed, false);
  assert.match(commentResult.reason, /comment.*publication.*authorization.*receipt/);
});

for (const [name, fields] of [
  ['untrusted comment review', { author: 'unrelated-participant', state: 'COMMENTED' }],
  ['dismissed review', { author: 'independent-reviewer', state: 'DISMISSED' }],
  ['unavailable reviewer identity', { author: null, state: 'APPROVED' }],
  ['pull-request author review', { author: 'contributor', state: 'APPROVED' }],
  ['commit contributor review', { author: 'web-flow', state: 'APPROVED' }],
  ['old-head review', { author: 'independent-reviewer', state: 'APPROVED', commitSha: sha('c') }],
]) {
  test(`merge does not accept an evidence marker from ${name}`, () => {
    const input = reviewInput();
    const source = {
      ...input.reviews[0],
      id: 'untrusted-source',
      submittedAt: '2026-08-27T05:00:00.000Z',
      ...fields,
    };
    input.reviews[0].body = 'Independent approval without this evidence receipt';
    input.reviews.push(source);
    const result = scheduledMerge({ input, packet: packet(input) });
    assert.equal(result.allowed, false);
    assert.match(result.reason, /published Agent evidence receipt/);
  });
}

test('merge requires the complete governed evidence marker rather than a matching prefix', () => {
  const input = reviewInput();
  input.reviews[0].body = input.reviews[0].body.replace(' -->', 'forged-suffix -->');
  const result = scheduledMerge({ input, packet: packet(input) });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /published Agent evidence receipt/);
});

for (const permission of ['read', 'none', null]) {
  test(`an outsider approval with ${permission} permission cannot bootstrap merge credit`, () => {
    const input = reviewInput();
    input.reviewerPermissions =
      permission === null ? [] : input.reviewerPermissions.map((item) => ({ ...item, permission }));
    const result = scheduledMerge({ input, packet: packet(input) });
    assert.equal(result.allowed, false);
    assert.match(result.reason, /verified current repository write permission/);
  });
  test(`an outsider evidence publisher with ${permission} permission cannot borrow another reviewer's approval`, () => {
    const input = reviewInput();
    input.reviews[0].body = 'Real independent approval, without the evidence marker';
    input.reviews.push({
      ...input.reviews[0],
      id: 'outside-review',
      author: 'outside-reader',
      body: `<!-- ${evidenceReceiptMarker(input.headSha)} -->`,
    });
    if (permission !== null)
      input.reviewerPermissions.push({
        ...input.reviewerPermissions[0],
        login: 'outside-reader',
        endpoint: 'repos/Proto-UI/Proto-UI/collaborators/outside-reader/permission',
        permission,
      });
    const result = scheduledMerge({ input, packet: packet(input) });
    assert.equal(result.allowed, false);
    assert.match(result.reason, /published Agent evidence receipt/);
  });
}

test('revocation during an operation invalidates the previously sealed canonical input', () => {
  const input = reviewInput();
  const liveInput = structuredClone(input);
  liveInput.reviewerPermissions[0].permission = 'read';
  assert.notEqual(computeReviewInputDigest(input), computeReviewInputDigest(liveInput));
  assert.throws(
    () => scheduledMerge({ input, liveInput, packet: packet(input) }),
    /live canonical review input does not match/
  );
});

for (const [field, value] of [
  ['repositoryId', 'github.com:Other/Repo'],
  ['headSha', sha('c')],
  ['login', 'other-person'],
  ['endpoint', 'repos/Other/Repo/collaborators/independent-reviewer/permission'],
  ['source', 'caller-assertion'],
]) {
  test(`reviewer permission observation rejects wrong ${field}`, () => {
    const input = reviewInput();
    input.reviewerPermissions[0][field] = value;
    assert.throws(() => validateReviewInputSnapshot(input), /permission/);
  });
}

test('legacy v4 input must be re-collected without mutating the historical input', () => {
  const input = reviewInput();
  input.schemaVersion = 4;
  delete input.reviewerPermissions;
  const prior = structuredClone(input);
  assert.throws(
    () => validateReviewInputSnapshot(input),
    /legacy review input v4.*re-collected as v5/
  );
  assert.deepEqual(input, prior);
});

test('permission observation order is canonical and duplicate identities fail closed', () => {
  const input = reviewInput();
  input.reviews.push({ ...input.reviews[0], id: 'other', author: 'second-reviewer' });
  input.reviewerPermissions.push({
    ...input.reviewerPermissions[0],
    login: 'second-reviewer',
    endpoint: 'repos/Proto-UI/Proto-UI/collaborators/second-reviewer/permission',
  });
  const reversed = structuredClone(input);
  reversed.reviewerPermissions.reverse();
  assert.equal(computeReviewInputDigest(input), computeReviewInputDigest(reversed));
  input.reviewerPermissions.push(input.reviewerPermissions[0]);
  assert.throws(() => validateReviewInputSnapshot(input), /duplicates reviewer permission login/);
});
