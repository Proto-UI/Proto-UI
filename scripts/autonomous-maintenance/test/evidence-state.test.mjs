import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateForwardFindingMetadata,
  validateForwardReviewIndependence,
} from '../evidence-state.mjs';

const baselineCommit = 'a'.repeat(40);
const packetPath = 'internal/autonomous-maintenance/phase-0/reviews/AM-P0-004-F1.md';
const reviewedContentDigest = `sha256:${'b'.repeat(64)}`;

function validForwardFinding() {
  return {
    schemaVersion: 2,
    findingId: 'AM-P0-004-F1',
    runId: 'AM-P0-004',
    mission: 'Bounded test mission',
    baselineCommit,
    scope: ['C-TEST-0001'],
    budgetClass: 'small',
    elapsedMinutes: null,
    claim: 'The observed projection differs from current authority.',
    entities: ['C-TEST-0001'],
    criteria: ['C-TEST-0001-A'],
    lifecycle: 'Current active behavior and its public projection.',
    expected: 'The projection matches the active criterion.',
    observed: 'The projection contradicts the active criterion.',
    reproduction: 'Inspect the authority and projection at the exact baseline.',
    commands: ['node --test focused.test.mjs'],
    evidence: ['exact-baseline reproduction'],
    counterEvidence: [],
    likelyRootCause: 'The projection was not regenerated after the authority changed.',
    impact: 'Agents and readers can infer the wrong behavior.',
    suggestedAction: 'Correct the bounded projection and add focused evidence.',
    observer: {
      actorId: 'agent:observer-1',
      taskId: 'task:observation-1',
    },
    observerConfidence: 0.96,
    verifier: {
      actorId: 'agent:verifier-1',
      taskId: 'task:verification-1',
      status: 'completed',
      classification: 'confirmed',
      evidence: ['independent reproduction'],
      confidence: 0.98,
    },
    findingDisposition: {
      status: 'automatic-governed-remediation',
      evidence: ['active authority and external oracle'],
      factScore: 2,
      previouslyUnknown: true,
      hasExternalOracle: true,
      actionValue: 2,
      reviewMinutes: null,
      notes: 'Confirmed governed drift proceeds to remediation.',
    },
    decisionBoundary: {
      class: 'none',
      status: 'not-required',
      question: null,
      resolution: null,
      evidence: [],
    },
    remediationReview: {
      status: 'completed',
      packet: packetPath,
      authorityResolution: 'governed',
      implementationVerification: 'passed',
      integrationEligibility: 'eligible',
      reviewMinutes: null,
    },
  };
}

function validForwardRun() {
  return {
    schemaVersion: 2,
    id: 'AM-P0-004',
    baselineCommit,
    observer: {
      actorId: 'agent:observer-1',
      taskId: 'task:observation-1',
    },
    verification: {
      actorId: 'agent:verifier-1',
      taskId: 'task:verification-1',
      status: 'completed',
      classification: 'confirmed',
      confidence: 0.98,
    },
    findingDisposition: {
      status: 'automatic-governed-remediation',
      evidence: ['active authority and external oracle'],
    },
    decisionBoundary: {
      class: 'none',
      status: 'not-required',
      question: null,
      resolution: null,
      evidence: [],
    },
    automatedCompletion: {
      status: 'complete',
      validationStatus: 'passed',
      reviewPacket: packetPath,
    },
    integration: {
      status: 'eligible',
    },
    outcome: {
      previouslyUnknown: true,
      actionValue: 2,
    },
  };
}

test('accepts a coherent schema-v2 finding and matching run state', () => {
  const finding = validForwardFinding();
  const errors = validateForwardFindingMetadata(finding, {
    expectedFindingId: finding.findingId,
    expectedRunId: finding.runId,
    run: validForwardRun(),
  });
  assert.deepEqual(errors, []);
});

test('rejects a completed finding that bypasses unresolved product direction', () => {
  const finding = validForwardFinding();
  finding.decisionBoundary = {
    class: 'unresolved-product-direction',
    status: 'pending',
    question: 'Which compatibility rule should become normative?',
    resolution: null,
    evidence: [],
  };
  finding.remediationReview.authorityResolution = 'unresolved';

  const run = validForwardRun();
  run.decisionBoundary = structuredClone(finding.decisionBoundary);
  const errors = validateForwardFindingMetadata(finding, { run });

  assert.ok(errors.includes('unresolved authority cannot claim completed remediation'));
  assert.ok(
    errors.includes(
      'integration eligibility requires completed remediation, passed verification, and no pending decision'
    )
  );
  assert.ok(
    errors.includes('automatic governed remediation cannot bypass unresolved product direction')
  );
});

test('rejects finding state that disagrees with the run ledger', () => {
  const finding = validForwardFinding();
  const run = validForwardRun();
  run.verification.classification = 'partially-confirmed';
  run.automatedCompletion.status = 'in-progress';
  run.integration.status = 'pending';

  const errors = validateForwardFindingMetadata(finding, { run });
  assert.ok(errors.includes('verifier.classification does not match the run ledger'));
  assert.ok(errors.includes('remediationReview.status does not match automatedCompletion.status'));
  assert.ok(
    errors.includes('remediationReview.integrationEligibility does not match the run ledger')
  );
});

test('rejects Observer and Verifier evidence from the same actor or task', () => {
  const sameActor = validForwardFinding();
  sameActor.verifier.actorId = sameActor.observer.actorId;
  const sameActorErrors = validateForwardFindingMetadata(sameActor);
  assert.ok(sameActorErrors.includes('verifier.actorId must differ from observer.actorId'));

  const sameTask = validForwardFinding();
  sameTask.verifier.taskId = sameTask.observer.taskId;
  const sameTaskErrors = validateForwardFindingMetadata(sameTask);
  assert.ok(sameTaskErrors.includes('verifier.taskId must differ from observer.taskId'));
});

test('rejects Observer or Verifier identity that disagrees with the run ledger', () => {
  const finding = validForwardFinding();
  const run = validForwardRun();
  run.observer.actorId = 'agent:other-observer';
  run.verification.taskId = 'task:other-verification';

  const errors = validateForwardFindingMetadata(finding, { run });
  assert.ok(errors.includes('observer.actorId does not match the run ledger'));
  assert.ok(errors.includes('verifier.taskId does not match the run ledger'));
});

function validForwardReview() {
  return {
    schemaVersion: 2,
    stage: 'post-implementation',
    reviewStatus: 'completed',
    changeInventory: {
      reviewedContentDigest,
    },
    remediationAuthor: {
      actorId: 'agent:remediator-1',
      taskId: 'task:remediation-1',
    },
    independentReview: {
      required: true,
      status: 'adequate',
      reviewer: {
        actorId: 'agent:reviewer-1',
        taskId: 'task:review-1',
      },
      reviewedContentDigest,
      decision: 'Implementation is technically complete.',
      history: [
        {
          round: 1,
          reviewer: {
            actorId: 'agent:reviewer-1',
            taskId: 'task:review-1',
          },
          reviewedContentDigest,
          classification: 'adequate',
          confidence: 0.97,
          recommendedAction: 'accept-packet',
          summary: 'The bounded diff and required evidence agree.',
        },
      ],
    },
  };
}

test('accepts independently attributed schema-v2 review evidence', () => {
  assert.deepEqual(validateForwardReviewIndependence(validForwardReview()), []);
});

test('accepts an explicit pending review with no fabricated reviewer history', () => {
  const review = validForwardReview();
  review.reviewStatus = 'ready-for-independent-review';
  review.independentReview.status = 'pending';
  review.independentReview.reviewer = null;
  review.independentReview.reviewedContentDigest = null;
  review.independentReview.decision = null;
  review.independentReview.history = [];
  assert.deepEqual(validateForwardReviewIndependence(review), []);
});

test('rejects self-review and a current status that contradicts history', () => {
  const review = validForwardReview();
  review.independentReview.status = 'incomplete';
  review.independentReview.reviewer = structuredClone(review.remediationAuthor);
  review.independentReview.history[0].reviewer = structuredClone(review.remediationAuthor);

  const errors = validateForwardReviewIndependence(review);
  assert.ok(
    errors.includes('independentReview.reviewer.actorId must differ from remediationAuthor.actorId')
  );
  assert.ok(
    errors.includes('independentReview.reviewer.taskId must differ from remediationAuthor.taskId')
  );
  assert.ok(errors.includes('independentReview.status must match the last history classification'));
});

test('rejects a resolved review without reviewer history evidence', () => {
  const review = validForwardReview();
  delete review.independentReview.reviewer;
  delete review.independentReview.history;
  const errors = validateForwardReviewIndependence(review);
  assert.ok(errors.includes('independentReview.reviewer is required'));
  assert.ok(errors.includes('independentReview.history is required'));
});
