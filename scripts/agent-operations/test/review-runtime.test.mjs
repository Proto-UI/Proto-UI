import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  authorizeReviewSubmission,
  computeReviewInputDigest,
  computeReviewPacketDigest,
  decideReviewRun,
  evaluateReviewEligibility,
  inspectReviewRevision,
  reviewChangesSpecEntities,
  reviewPacketKey,
  validateReviewInputSnapshot,
  validateReviewPacket,
  validateReviewPacketEligibility,
  verifyLiveReviewInput,
  verifyReconciliation,
} from '../review-runtime.mjs';

const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const policy = parseYaml(
  readFileSync(path.join(root, 'internal/agent-operations/capability-policy.yaml'), 'utf8')
);
const sha = (letter) => letter.repeat(40);
const digest = (letter) => letter.repeat(64);

function reviewInput(overrides = {}) {
  return {
    schemaVersion: 3,
    kind: 'proto-ui.review-input',
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    pullRequest: 487,
    pullRequestState: 'OPEN',
    isDraft: false,
    baseRefName: 'main',
    baseSha: sha('a'),
    headSha: sha('b'),
    pullRequestBody: 'Bounded review target',
    changedFiles: [
      {
        path: 'packages/core/src/index.ts',
        previousPath: null,
        status: 'modified',
      },
    ],
    commits: [{ sha: sha('b'), message: 'Bounded change' }],
    reviews: [],
    comments: [],
    replies: [],
    threads: [],
    checks: [
      {
        name: 'test',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        completedAt: '2026-08-23T00:00:00.000Z',
        detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
        source: 'github-actions',
        repository: 'Proto-UI/Proto-UI',
        workflowName: 'CI',
        workflowPath: '.github/workflows/ci.yml',
      },
    ],
    externalEvidence: [],
    ...overrides,
  };
}

function packet(overrides = {}, input = reviewInput()) {
  return {
    schemaVersion: 1,
    kind: 'proto-ui.review-packet',
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    pullRequest: 487,
    baseSha: sha('a'),
    headSha: sha('b'),
    reviewInputDigest: computeReviewInputDigest(input),
    observedAt: '2026-08-23T00:00:00.000Z',
    reviewClass: 'review-governed-implementation-slice',
    scope: ['agent operations'],
    affectedEntities: ['governance:contributor-agent'],
    affectedSurfaces: ['scripts', 'docs'],
    findings: [],
    validation: {
      commands: [
        { command: 'pnpm check:agent-operations', exitCode: 0, result: '26 tests passed' },
      ],
      checksNotRun: [],
    },
    reconciliation: {
      priorReviewedHeadSha: null,
      priorPacketDigest: null,
      resolvedFindingIds: [],
      openFindingIds: [],
      newFindingIds: [],
    },
    limitations: ['Review depth is limited without a fresh local assessment'],
    unknowns: [],
    humanGates: ['pull-request-approval'],
    recommendedAction: 'ABSTAIN',
    ...overrides,
  };
}

function assessment(band, reviewClasses, { fresh = true, validated = true } = {}) {
  return {
    kind: 'proto-ui.agent-capability-self-result',
    fresh,
    validated,
    capability: { band, recommendedReviewClasses: reviewClasses },
  };
}

test('review packet binds revision and input state and supports incremental reconciliation', () => {
  const input = reviewInput();
  const original = packet({}, input);
  const key = reviewPacketKey(original, input);
  assert.equal(reviewPacketKey({ ...original }, input), key);
  assert.deepEqual(decideReviewRun(original, input, [key]), {
    shouldRun: false,
    duplicate: true,
    key,
  });

  const changedInput = reviewInput({ pullRequestBody: 'Bounded review target with a reply' });
  const newEvidence = packet({}, changedInput);
  assert.notEqual(reviewPacketKey(newEvidence, changedInput), key);
  assert.equal(decideReviewRun(newEvidence, changedInput, [key]).shouldRun, true);

  assert.deepEqual(inspectReviewRevision(original, input, sha('b')), {
    stale: false,
    incrementalRange: null,
    reconciliationRequired: false,
  });
  assert.deepEqual(inspectReviewRevision(original, input, sha('d'), sha('b')), {
    stale: true,
    incrementalRange: `${sha('b')}..${sha('d')}`,
    reconciliationRequired: true,
  });
  assert.equal(inspectReviewRevision(original, input, sha('b'), null, sha('c')).stale, true);
  assert.throws(
    () => reviewPacketKey({ ...original, executionMode: 'human-assisted' }, input),
    /unexpected/
  );
  assert.throws(
    () => validateReviewPacket({ ...original, reviewInputDigest: digest('d') }, input),
    /canonical input snapshot/
  );

  const reordered = reviewInput({
    commits: [
      { sha: sha('c'), message: 'Second' },
      { sha: sha('b'), message: 'First' },
    ],
  });
  const reversed = { ...reordered, commits: [...reordered.commits].reverse() };
  assert.equal(computeReviewInputDigest(reordered), computeReviewInputDigest(reversed));
  const reorderedKeys = Object.fromEntries(Object.entries(reordered).reverse());
  reorderedKeys.commits = reorderedKeys.commits.map((commit) => ({
    message: commit.message,
    sha: commit.sha,
  }));
  assert.equal(computeReviewInputDigest(reordered), computeReviewInputDigest(reorderedKeys));
  const tiedChecks = reviewInput({
    checks: [
      {
        name: 'test',
        status: 'COMPLETED',
        conclusion: 'FAILURE',
        completedAt: '2026-08-23T00:01:00.000Z',
        detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
        source: 'github-actions',
        repository: 'Proto-UI/Proto-UI',
        workflowName: 'CI',
        workflowPath: '.github/workflows/ci.yml',
      },
      {
        name: 'test',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        completedAt: '2026-08-23T00:00:00.000Z',
        detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
        source: 'github-actions',
        repository: 'Proto-UI/Proto-UI',
        workflowName: 'CI',
        workflowPath: '.github/workflows/ci.yml',
      },
    ],
  });
  assert.equal(
    computeReviewInputDigest(tiedChecks),
    computeReviewInputDigest({ ...tiedChecks, checks: [...tiedChecks.checks].reverse() })
  );
  assert.notEqual(
    computeReviewInputDigest(tiedChecks),
    computeReviewInputDigest({
      ...tiedChecks,
      checks: tiedChecks.checks.map((check, index) =>
        index === 0
          ? {
              ...check,
              source: 'vercel',
              workflowName: null,
              workflowPath: null,
            }
          : check
      ),
    })
  );
  assert.notEqual(
    computeReviewInputDigest(reordered),
    computeReviewInputDigest({ ...reordered, pullRequestBody: 'Changed body' })
  );
});

test('canonical review input is insensitive to top-level comment connection order', () => {
  const first = reviewInput({
    comments: [
      {
        id: 'IC_2',
        author: 'maintainer',
        body: 'Second comment',
        updatedAt: '2026-08-23T02:00:00.000Z',
      },
      {
        id: 'IC_1',
        author: 'contributor',
        body: 'First comment',
        updatedAt: '2026-08-23T01:00:00.000Z',
      },
    ],
  });
  const reversed = reviewInput({ comments: [...first.comments].reverse() });

  assert.equal(computeReviewInputDigest(first), computeReviewInputDigest(reversed));
  assert.throws(
    () =>
      validateReviewInputSnapshot(
        reviewInput({ comments: [first.comments[0], first.comments[0]] })
      ),
    /duplicates comment id/
  );
});

test('review input v3 binds changed files and check provenance while classifying spec entities', () => {
  const ordinary = reviewInput();
  assert.equal(reviewChangesSpecEntities(ordinary), false);
  assert.equal(
    reviewChangesSpecEntities(
      reviewInput({
        changedFiles: [
          { path: 'spec/contracts/C-EXAMPLE-0001.yaml', previousPath: null, status: 'added' },
        ],
      })
    ),
    true
  );
  assert.equal(
    reviewChangesSpecEntities(
      reviewInput({
        changedFiles: [
          {
            path: 'internal/records/moved.md',
            previousPath: 'spec/decisions/D-EXAMPLE-0001.yaml',
            status: 'renamed',
          },
        ],
      })
    ),
    true
  );
  assert.equal(
    reviewChangesSpecEntities(
      reviewInput({
        changedFiles: [{ path: 'spec/README.md', previousPath: null, status: 'modified' }],
      })
    ),
    false
  );
  assert.notEqual(
    computeReviewInputDigest(ordinary),
    computeReviewInputDigest(
      reviewInput({
        changedFiles: [
          { path: 'packages/runtime/src/index.ts', previousPath: null, status: 'added' },
        ],
      })
    )
  );
  assert.throws(
    () => validateReviewInputSnapshot({ ...ordinary, schemaVersion: 1 }),
    /schemaVersion/
  );
});

test('review packet requires real scope, evidence accounting, and finding reconciliation', () => {
  const finding = {
    id: 'F-1',
    severity: 'P1',
    confidence: 'high',
    file: 'scripts/example.mjs',
    line: 10,
    authority: 'AGENTS.md',
    observed: 'Observed drift',
    expected: 'Expected governed behavior',
    impact: 'Review result is misleading',
    fix: 'Restore the governed boundary',
  };
  const input = reviewInput();
  const priorPacket = {
    ...packet({}, reviewInput()),
    headSha: sha('9'),
    findings: [{ ...finding, id: 'F-0' }],
  };
  const valid = packet(
    {
      findings: [finding],
      reconciliation: {
        priorReviewedHeadSha: sha('9'),
        priorPacketDigest: computeReviewPacketDigest(priorPacket),
        resolvedFindingIds: ['F-0'],
        openFindingIds: [],
        newFindingIds: ['F-1'],
      },
    },
    input
  );
  assert.equal(validateReviewPacket(valid, input), valid);
  assert.equal(verifyReconciliation(valid, priorPacket), true);
  assert.equal(validateReviewInputSnapshot(input), input);

  const boundTo = (prior) =>
    packet(
      {
        reconciliation: {
          ...valid.reconciliation,
          priorPacketDigest: computeReviewPacketDigest(prior),
        },
      },
      input
    );
  const digestMismatch = { ...priorPacket, recommendedAction: 'COMMENT' };
  assert.throws(
    () => verifyReconciliation(valid, digestMismatch),
    /does not match the recorded priorPacketDigest/
  );
  const differentRepository = {
    ...priorPacket,
    repositoryId: 'github.com:Proto-UI/Other',
  };
  assert.throws(
    () => verifyReconciliation(boundTo(differentRepository), differentRepository),
    /different repository/
  );
  const differentPullRequest = { ...priorPacket, pullRequest: 999 };
  assert.throws(
    () => verifyReconciliation(boundTo(differentPullRequest), differentPullRequest),
    /different pull request/
  );
  const differentHead = { ...priorPacket, headSha: sha('8') };
  assert.throws(
    () => verifyReconciliation(boundTo(differentHead), differentHead),
    /does not match priorReviewedHeadSha/
  );

  // Finding state transitions must be real against the prior packet's findings.
  const resolvedAbsentFromPrior = packet(
    {
      reconciliation: {
        ...valid.reconciliation,
        priorPacketDigest: computeReviewPacketDigest(priorPacket),
        resolvedFindingIds: ['F-9'],
      },
    },
    input
  );
  assert.throws(
    () => verifyReconciliation(resolvedAbsentFromPrior, priorPacket),
    /resolved reconciliation references a finding absent from the prior packet/
  );
  const openAbsentFromPrior = packet(
    {
      reconciliation: {
        ...valid.reconciliation,
        priorPacketDigest: computeReviewPacketDigest(priorPacket),
        newFindingIds: [],
        openFindingIds: ['F-1'],
      },
    },
    input
  );
  assert.throws(
    () => verifyReconciliation(openAbsentFromPrior, priorPacket),
    /open reconciliation references a finding absent from the prior packet/
  );
  const newAlreadyInPrior = packet(
    {
      findings: [{ ...finding, id: 'F-0' }],
      reconciliation: {
        ...valid.reconciliation,
        resolvedFindingIds: [],
        openFindingIds: [],
        newFindingIds: ['F-0'],
      },
    },
    input
  );
  assert.throws(
    () => verifyReconciliation(newAlreadyInPrior, priorPacket),
    /new reconciliation reuses a finding id/
  );
  const unboundIncremental = packet(
    {
      findings: [finding],
      reconciliation: {
        priorReviewedHeadSha: sha('9'),
        priorPacketDigest: null,
        resolvedFindingIds: ['F-0'],
        openFindingIds: [],
        newFindingIds: ['F-1'],
      },
    },
    input
  );
  assert.throws(
    () => validateReviewPacket(unboundIncremental, input),
    /must bind both the prior head and the prior packet digest/
  );
  assert.throws(() => validateReviewPacket(packet({ scope: [] }, input), input), /scope/);
  assert.throws(
    () =>
      validateReviewPacket(
        packet({ validation: { commands: [], checksNotRun: [] } }, input),
        input
      ),
    /validation command/
  );
  const absentFinding = structuredClone(valid);
  absentFinding.reconciliation.newFindingIds = ['F-2'];
  assert.throws(() => validateReviewPacket(absentFinding, input), /absent current finding/);

  const absentOpenFinding = structuredClone(valid);
  absentOpenFinding.reconciliation.newFindingIds = [];
  absentOpenFinding.reconciliation.openFindingIds = ['F-2'];
  assert.throws(() => validateReviewPacket(absentOpenFinding, input), /absent current finding/);

  const unreconciledFinding = structuredClone(valid);
  unreconciledFinding.reconciliation.newFindingIds = [];
  assert.throws(() => validateReviewPacket(unreconciledFinding, input), /reconciled exactly once/);

  const stillCurrentResolvedFinding = structuredClone(valid);
  stillCurrentResolvedFinding.reconciliation.newFindingIds = [];
  stillCurrentResolvedFinding.reconciliation.resolvedFindingIds = ['F-1'];
  assert.throws(() => validateReviewPacket(stillCurrentResolvedFinding, input), /still references/);
});

test('human-assisted review remains open while autonomous review obeys the exact class ceiling', () => {
  const c1 = assessment('C1', ['review-facts-and-ci', 'review-docs-and-links']);
  assert.deepEqual(
    evaluateReviewEligibility({
      executionMode: 'human-assisted',
      selfAssessment: c1,
      reviewClass: 'review-cross-domain-semantics',
      policy,
    }),
    {
      eligible: true,
      reviewDepth: 'partial',
      maximumRecommendation: 'ABSTAIN',
      limitationRequired: true,
      approvalDecisionRequired: true,
    }
  );
  assert.equal(
    evaluateReviewEligibility({
      executionMode: 'autonomous',
      selfAssessment: c1,
      reviewClass: 'review-facts-and-ci',
      policy,
    }).eligible,
    true
  );
  assert.equal(
    evaluateReviewEligibility({
      executionMode: 'autonomous',
      selfAssessment: c1,
      reviewClass: 'review-tests',
      policy,
    }).eligible,
    false
  );
  const c2 = assessment('C2', [
    'review-facts-and-ci',
    'review-docs-and-links',
    'review-tests',
    'review-bounded-regression',
  ]);
  const bounded = evaluateReviewEligibility({
    executionMode: 'autonomous',
    selfAssessment: c2,
    reviewClass: 'review-bounded-regression',
    policy,
  });
  assert.equal(bounded.eligible, true);
  assert.equal(bounded.maximumRecommendation, 'APPROVE');
  assert.equal(bounded.approvalDecisionRequired, 'when-spec-entities-change');
  assert.equal(
    evaluateReviewEligibility({
      executionMode: 'autonomous',
      selfAssessment: { ...c2, fresh: false },
      reviewClass: 'review-bounded-regression',
      policy,
    }).eligible,
    false
  );

  const highClassPacket = packet({ reviewClass: 'review-cross-domain-semantics' });
  const c1HighClass = evaluateReviewEligibility({
    executionMode: 'autonomous',
    selfAssessment: c1,
    reviewClass: highClassPacket.reviewClass,
    policy,
  });
  assert.throws(
    () => validateReviewPacketEligibility(highClassPacket, c1HighClass, 'autonomous'),
    /exceeds the autonomous ceiling/
  );
  assert.throws(
    () =>
      validateReviewPacketEligibility(
        packet({ recommendedAction: 'REQUEST_CHANGES', limitations: [] }),
        evaluateReviewEligibility({
          executionMode: 'human-assisted',
          selfAssessment: null,
          reviewClass: 'review-governed-implementation-slice',
          policy,
        }),
        'human-assisted'
      ),
    /eligible maximum|limitation/
  );
});

test('review submission preserves explicit authorization and activates the bounded scheduled scope', () => {
  const input = reviewInput();
  const base = {
    packet: packet(
      {
        limitations: [],
        humanGates: [],
        recommendedAction: 'APPROVE',
      },
      input
    ),
    input,
    liveInput: structuredClone(input),
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    authorizationId: 'explicit-current-user',
    policy,
    credentialCanReview: true,
    reviewer: 'agent',
    pullRequestAuthor: 'contributor',
    ciConclusion: 'success',
  };
  assert.equal(authorizeReviewSubmission({ ...base, authorizationId: 'wrong' }).allowed, false);
  assert.equal(authorizeReviewSubmission({ ...base, credentialCanReview: false }).allowed, false);
  assert.equal(authorizeReviewSubmission(base).allowed, true);
  assert.equal(
    authorizeReviewSubmission({ ...base, executionModeSource: 'active-human-loop' }).allowed,
    true
  );
  assert.equal(
    authorizeReviewSubmission({
      ...base,
      reviewer: 'contributor',
      pullRequestAuthor: 'contributor',
      packet: packet(
        {
          findings: [
            {
              id: 'F-1',
              severity: 'P1',
              confidence: 'high',
              file: 'src/a.ts',
              line: 1,
              authority: 'governed rule',
              observed: 'broken',
              expected: 'working',
              impact: 'regression',
              fix: 'repair',
            },
          ],
          limitations: [],
          unknowns: [],
          humanGates: [],
          recommendedAction: 'REQUEST_CHANGES',
          reconciliation: {
            priorReviewedHeadSha: null,
            priorPacketDigest: null,
            resolvedFindingIds: [],
            openFindingIds: [],
            newFindingIds: ['F-1'],
          },
        },
        input
      ),
    }).allowed,
    false
  );
  assert.equal(authorizeReviewSubmission({ ...base, ciConclusion: 'failure' }).allowed, false);

  const requestChangesPacket = packet(
    {
      findings: [
        {
          id: 'F-2',
          severity: 'P1',
          confidence: 'high',
          file: 'src/b.ts',
          line: 2,
          authority: 'governed rule',
          observed: 'broken',
          expected: 'working',
          impact: 'regression',
          fix: 'repair',
        },
      ],
      limitations: [],
      unknowns: [],
      humanGates: [],
      recommendedAction: 'REQUEST_CHANGES',
      reconciliation: {
        priorReviewedHeadSha: null,
        priorPacketDigest: null,
        resolvedFindingIds: [],
        openFindingIds: [],
        newFindingIds: ['F-2'],
      },
    },
    input
  );
  const scheduledBase = {
    ...base,
    executionMode: 'autonomous',
    executionModeSource: 'schedule',
    authorizationId: 'proto-ui-scheduled-review-v1',
    selfAssessment: assessment('C4', Object.keys(policy.reviewClasses)),
  };
  const requestChanges = authorizeReviewSubmission({
    ...scheduledBase,
    packet: requestChangesPacket,
  });
  assert.equal(requestChanges.allowed, true);
  assert.equal(requestChanges.recommendedAction, 'REQUEST_CHANGES');
  const scheduledApproval = authorizeReviewSubmission(scheduledBase);
  assert.equal(scheduledApproval.allowed, true);
  assert.equal(scheduledApproval.recommendedAction, 'APPROVE');
  const reviewEligibleC3 = assessment('C3', [
    'review-facts-and-ci',
    'review-docs-and-links',
    'review-tests',
    'review-bounded-regression',
    'review-governed-implementation-slice',
  ]);
  assert.equal(
    evaluateReviewEligibility({
      executionMode: 'autonomous',
      selfAssessment: reviewEligibleC3,
      reviewClass: scheduledBase.packet.reviewClass,
      policy,
    }).eligible,
    true
  );
  assert.equal(
    authorizeReviewSubmission({
      ...scheduledBase,
      selfAssessment: reviewEligibleC3,
    }).allowed,
    false
  );
  assert.equal(
    authorizeReviewSubmission({ ...scheduledBase, selfAssessment: null }).allowed,
    false
  );
  assert.equal(
    authorizeReviewSubmission({
      ...scheduledBase,
      selfAssessment: { ...scheduledBase.selfAssessment, fresh: false },
    }).allowed,
    false
  );
  assert.equal(
    authorizeReviewSubmission({ ...scheduledBase, executionModeSource: 'governed-queue' }).allowed,
    false
  );

  const duplicateInput = reviewInput({
    reviews: [
      {
        id: 'PRR_existing',
        author: 'agent',
        state: 'APPROVED',
        commitSha: sha('b'),
        submittedAt: '2026-08-23T03:00:00.000Z',
        body: 'Already approved',
      },
    ],
  });
  const duplicateApproval = authorizeReviewSubmission({
    ...scheduledBase,
    input: duplicateInput,
    liveInput: structuredClone(duplicateInput),
    packet: packet(
      { limitations: [], humanGates: [], recommendedAction: 'APPROVE' },
      duplicateInput
    ),
  });
  assert.equal(duplicateApproval.allowed, false);
  assert.equal(duplicateApproval.duplicate, true);

  const specInput = reviewInput({
    changedFiles: [
      { path: 'spec/contracts/C-EXAMPLE-0001.yaml', previousPath: null, status: 'modified' },
    ],
  });
  const specApproval = authorizeReviewSubmission({
    ...scheduledBase,
    input: specInput,
    liveInput: structuredClone(specInput),
    packet: packet(
      {
        limitations: [],
        humanGates: ['pull-request-approval'],
        recommendedAction: 'APPROVE',
      },
      specInput
    ),
  });
  assert.equal(specApproval.allowed, false);
  assert.equal(specApproval.humanReviewRequired, true);
  assert.equal(
    authorizeReviewSubmission({
      ...base,
      input: specInput,
      liveInput: structuredClone(specInput),
      packet: packet(
        {
          limitations: [],
          humanGates: ['pull-request-approval'],
          recommendedAction: 'APPROVE',
        },
        specInput
      ),
    }).allowed,
    true
  );

  assert.equal(
    authorizeReviewSubmission({
      ...scheduledBase,
      packet: packet({ limitations: [], humanGates: [], recommendedAction: 'COMMENT' }, input),
    }).allowed,
    false
  );
  assert.equal(
    authorizeReviewSubmission({
      ...scheduledBase,
      input: reviewInput({ isDraft: true }),
      liveInput: reviewInput({ isDraft: true }),
      packet: packet(
        { limitations: [], humanGates: [], recommendedAction: 'APPROVE' },
        reviewInput({ isDraft: true })
      ),
    }).allowed,
    false
  );
});

test('an active scheduled standing authorization can submit an exact-head review disposition', () => {
  const input = reviewInput();
  const activePolicy = structuredClone(policy);
  const authorization = activePolicy.reviewSubmissionAuthorizations.find(
    (candidate) => candidate.id === 'proto-ui-scheduled-review-v1'
  );
  authorization.status = 'active';
  delete authorization.blockedBy;
  const approval = authorizeReviewSubmission({
    packet: packet({ limitations: [], humanGates: [], recommendedAction: 'APPROVE' }, input),
    input,
    liveInput: structuredClone(input),
    executionMode: 'autonomous',
    executionModeSource: 'schedule',
    authorizationId: 'proto-ui-scheduled-review-v1',
    policy: activePolicy,
    selfAssessment: assessment('C4', Object.keys(activePolicy.reviewClasses)),
    credentialCanReview: true,
    reviewer: 'agent',
    pullRequestAuthor: 'contributor',
    ciConclusion: 'success',
  });
  assert.equal(approval.allowed, true);
  assert.equal(approval.recommendedAction, 'APPROVE');
});

test('submission preflight re-collects live canonical input and rejects drift and forged identities', () => {
  const input = reviewInput();
  const base = {
    packet: packet({ recommendedAction: 'COMMENT', limitations: [] }, input),
    input,
    liveInput: structuredClone(input),
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    authorizationId: 'explicit-current-user',
    policy,
    credentialCanReview: true,
    reviewer: 'agent',
    pullRequestAuthor: 'contributor',
    ciConclusion: 'success',
  };

  // A new reply on the same head changes the canonical input digest: submission must reject.
  const driftedLiveInput = reviewInput({
    replies: [
      {
        id: 'r1',
        threadId: 't1',
        updatedAt: '2026-08-23T01:00:00.000Z',
        author: 'maintainer',
        body: 'New question on the same head',
      },
    ],
  });
  assert.throws(
    () => authorizeReviewSubmission({ ...base, liveInput: driftedLiveInput }),
    /live canonical review input does not match/
  );

  const retargetedLiveInput = reviewInput({ baseRefName: 'release' });
  assert.throws(
    () => authorizeReviewSubmission({ ...base, liveInput: retargetedLiveInput }),
    /live canonical review input does not match/
  );

  const topLevelCommentDrift = reviewInput({
    comments: [
      {
        id: '2001',
        updatedAt: '2026-08-23T01:30:00.000Z',
        author: 'maintainer',
        body: 'New top-level question on the same head',
      },
    ],
  });
  assert.throws(
    () => authorizeReviewSubmission({ ...base, liveInput: topLevelCommentDrift }),
    /live canonical review input does not match/
  );
  assert.equal(verifyLiveReviewInput(base.packet, base.liveInput), true);
  assert.throws(
    () => verifyLiveReviewInput(base.packet, driftedLiveInput),
    /live canonical review input does not match/
  );

  // A CI rerun with a new check run also changes the digest.
  const rerunChecks = reviewInput({
    checks: [
      {
        name: 'test',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        completedAt: '2026-08-23T02:00:00.000Z',
        detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/2',
        source: 'github-actions',
        repository: 'Proto-UI/Proto-UI',
        workflowName: 'CI',
        workflowPath: '.github/workflows/ci.yml',
      },
    ],
  });
  assert.throws(
    () => authorizeReviewSubmission({ ...base, liveInput: rerunChecks }),
    /live canonical review input does not match/
  );

  // Live input must bind to the same repository and pull request.
  const differentPullRequest = reviewInput({ pullRequest: 999 });
  assert.throws(
    () => verifyLiveReviewInput(base.packet, differentPullRequest),
    /different repository or pull request/
  );

  // Reviewer and author identities must come from the trusted live context.
  assert.throws(() => authorizeReviewSubmission({ ...base, reviewer: '' }), /viewer identity/);
  assert.throws(
    () => authorizeReviewSubmission({ ...base, pullRequestAuthor: undefined }),
    /pull-request author identity/
  );

  // Staleness is derived from the live revision, never from caller-supplied SHAs.
  const pushedLiveInput = { ...structuredClone(input), headSha: sha('d') };
  assert.throws(
    () => authorizeReviewSubmission({ ...base, liveInput: pushedLiveInput }),
    /live canonical review input does not match/
  );
});

test('runtime validation matches the review-packet JSON Schema for types and timestamps', () => {
  const input = reviewInput();
  const finding = {
    id: 'F-1',
    severity: 'P1',
    confidence: 'high',
    file: 'scripts/example.mjs',
    line: 10,
    authority: 'AGENTS.md',
    observed: 'Observed drift',
    expected: 'Expected governed behavior',
    impact: 'Review result is misleading',
    fix: 'Restore the governed boundary',
  };
  for (const [field, value] of [
    ['file', 123],
    ['authority', { source: 'AGENTS.md' }],
    ['observed', ['drift']],
    ['expected', false],
    ['impact', 0],
    ['fix', null],
    ['id', ''],
  ]) {
    const invalidFinding = packet({ findings: [{ ...finding, [field]: value }] }, input);
    assert.throws(
      () => validateReviewPacket(invalidFinding, input),
      new RegExp(`finding\\.${field}`),
      `expected finding.${field} to be rejected`
    );
  }

  for (const observedAt of [0, 'August 23, 2026', '2026/08/23', '2026-08-23']) {
    assert.throws(
      () => validateReviewPacket(packet({ observedAt }, input), input),
      /observedAt/,
      `expected observedAt ${String(observedAt)} to be rejected`
    );
  }
  assert.doesNotThrow(() =>
    validateReviewPacket(packet({ observedAt: '2026-08-23T00:00:00+08:00' }, input), input)
  );
  assert.doesNotThrow(() =>
    validateReviewPacket(packet({ observedAt: '2026-08-23T00:00:00.123456Z' }, input), input)
  );

  const looseReplyTimestamp = reviewInput({
    replies: [
      {
        id: 'r1',
        threadId: 't1',
        updatedAt: '2026-08-23 00:00 UTC',
        author: 'maintainer',
        body: 'Loose timestamp',
      },
    ],
  });
  assert.throws(() => validateReviewInputSnapshot(looseReplyTimestamp), /reply updatedAt/);
  const epochThreadUpdate = reviewInput({
    threads: [{ id: 't1', isResolved: true, updatedAt: 1755907200000 }],
  });
  assert.throws(() => validateReviewInputSnapshot(epochThreadUpdate), /thread updatedAt/);
  assert.throws(() => validateReviewPacket(packet({ observedAt: 0 }, input), input), /observedAt/);
});

test('review input validation accepts nullable check details links but rejects empty ones', () => {
  const withCheck = (detailsUrl) =>
    reviewInput({
      checks: [
        {
          name: 'test',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
          completedAt: '2026-08-23T00:00:00.000Z',
          detailsUrl,
          source: 'github-actions',
          repository: 'Proto-UI/Proto-UI',
          workflowName: 'CI',
          workflowPath: '.github/workflows/ci.yml',
        },
      ],
    });

  assert.doesNotThrow(() => validateReviewInputSnapshot(withCheck(null)));
  assert.throws(() => validateReviewInputSnapshot(withCheck('')), /check detailsUrl/);
  assert.throws(() => validateReviewInputSnapshot(withCheck(undefined)), /check detailsUrl/);
});

test('review input validation rejects malformed changed-file and review identity state', () => {
  assert.throws(
    () => validateReviewInputSnapshot(reviewInput({ changedFiles: [] })),
    /changedFiles/
  );
  assert.throws(
    () =>
      validateReviewInputSnapshot(
        reviewInput({
          changedFiles: [
            { path: '../spec/contracts/C-X.yaml', previousPath: null, status: 'added' },
          ],
        })
      ),
    /changed file path/
  );
  assert.throws(
    () =>
      validateReviewInputSnapshot(
        reviewInput({
          reviews: [
            {
              id: 'r1',
              author: 'reviewer',
              state: 'APPROVED',
              commitSha: 'short',
              submittedAt: '2026-08-23T00:00:00Z',
              body: '',
            },
          ],
        })
      ),
    /commitSha/
  );
});

test('agent:review CLI validates and inspects the same packet contract used by the skill', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-review-packet-'));
  const packetPath = path.join(directory, 'packet.json');
  const inputPath = path.join(directory, 'input.json');
  const handoffPath = path.join(directory, 'handoff.json');
  const command = path.join(root, 'scripts/agent-operations/review-packet.mjs');
  try {
    const input = reviewInput();
    writeFileSync(inputPath, JSON.stringify(input));
    writeFileSync(packetPath, JSON.stringify(packet({}, input)));
    writeFileSync(
      handoffPath,
      JSON.stringify({
        schemaVersion: 1,
        kind: 'proto-ui.skill-handoff',
        entrypoint: 'development',
        executionMode: 'human-assisted',
        executionModeSource: 'current-user',
        fromId: 'pui-validate',
        nextSkillId: 'pui-review',
        artifacts: [
          { type: 'authority-map', reference: 'review authority map' },
          { type: 'candidate-change', reference: 'bounded candidate change' },
          { type: 'evidence-report', reference: 'validation evidence' },
          { type: 'review-input', reference: inputPath },
        ],
        humanGates: [],
        notes: [],
      })
    );
    const validation = JSON.parse(
      execFileSync(
        process.execPath,
        [
          command,
          'validate',
          '--packet',
          packetPath,
          '--input',
          inputPath,
          '--handoff',
          handoffPath,
        ],
        {
          cwd: root,
          encoding: 'utf8',
        }
      )
    );
    assert.equal(validation.valid, true);
    const inspection = JSON.parse(
      execFileSync(
        process.execPath,
        [
          command,
          'inspect',
          '--packet',
          packetPath,
          '--input',
          inputPath,
          '--handoff',
          handoffPath,
          '--current-base',
          sha('a'),
          '--current-head',
          sha('b'),
          '--seen-keys',
          validation.key,
        ],
        { cwd: root, encoding: 'utf8' }
      )
    );
    assert.equal(inspection.run.duplicate, true);
    assert.equal(inspection.revision.stale, false);
    assert.equal(inspection.reconciliationBound, null);

    const eligibility = JSON.parse(
      execFileSync(
        process.execPath,
        [
          command,
          'eligibility',
          '--handoff',
          handoffPath,
          '--review-class',
          'review-cross-domain-semantics',
        ],
        { cwd: root, encoding: 'utf8' }
      )
    );
    assert.equal(eligibility.eligible, true);
    assert.equal(eligibility.reviewDepth, 'partial');

    const inputDigest = JSON.parse(
      execFileSync(process.execPath, [command, 'input-digest', '--input', inputPath], {
        cwd: root,
        encoding: 'utf8',
      })
    );
    assert.equal(inputDigest.reviewInputDigest, computeReviewInputDigest(input));

    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            command,
            'eligibility',
            '--mode',
            'human-assisted',
            '--review-class',
            'review-cross-domain-semantics',
          ],
          { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        ),
      /Command failed/
    );
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            command,
            'submit-review',
            '--packet',
            packetPath,
            '--input',
            inputPath,
            '--reviewer',
            'forged-login',
            '--pr-author',
            'forged-author',
            '--credential',
            'can-review',
            '--ci-conclusion',
            'success',
          ],
          { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        ),
      /unexpected option/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
