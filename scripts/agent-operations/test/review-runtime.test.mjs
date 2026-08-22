import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authorizeReviewSubmission,
  decideReviewRun,
  evaluateReviewEligibility,
  inspectReviewRevision,
  reviewPacketKey,
} from '../review-runtime.mjs';

const sha = (letter) => letter.repeat(40);
const packet = {
  schemaVersion: 1,
  kind: 'proto-ui.review-packet',
  repositoryId: 'github.com:Proto-UI/Proto-UI',
  pullRequest: 487,
  baseSha: sha('a'),
  headSha: sha('b'),
  observedAt: '2026-08-23T00:00:00.000Z',
  scope: ['agent operations'],
  affectedEntities: ['governance:contributor-agent'],
  affectedSurfaces: ['scripts', 'docs'],
  findings: [],
  validation: ['check:agent-operations'],
  previousFindings: [],
  limitations: [],
  unknowns: [],
  humanGates: ['pull-request-approval'],
  recommendedAction: 'COMMENT',
};

test('review packet is bound to one base and head and detects stale incremental work', () => {
  assert.equal(reviewPacketKey(packet), reviewPacketKey({ ...packet }));
  const key = reviewPacketKey(packet);
  assert.deepEqual(decideReviewRun(packet, [key]), { shouldRun: false, duplicate: true, key });
  assert.deepEqual(inspectReviewRevision(packet, sha('b')), {
    stale: false,
    incrementalRange: null,
  });
  assert.deepEqual(inspectReviewRevision(packet, sha('c'), sha('b')), {
    stale: true,
    incrementalRange: `${sha('b')}..${sha('c')}`,
  });
  assert.equal(inspectReviewRevision(packet, sha('b'), null, sha('c')).stale, true);
  assert.throws(
    () => reviewPacketKey({ ...packet, executionMode: 'human-assisted' }),
    /unexpected/
  );
});

test('low-band human-assisted review returns ABSTAIN instead of refusing', () => {
  const c1 = { capability: { band: 'C1' } };
  assert.deepEqual(
    evaluateReviewEligibility({ executionMode: 'human-assisted', selfAssessment: c1 }),
    {
      eligible: true,
      maximumRecommendation: 'ABSTAIN',
      limitationRequired: true,
    }
  );
  assert.equal(
    evaluateReviewEligibility({
      executionMode: 'autonomous',
      selfAssessment: { ...c1, fresh: true, validated: true },
    }).eligible,
    false
  );
});

test('review submission needs authorization and permission and rejects self-approval', () => {
  const base = {
    credentialCanReview: true,
    reviewer: 'agent',
    pullRequestAuthor: 'contributor',
    recommendedAction: 'APPROVE',
    ciConclusion: 'success',
  };
  assert.equal(authorizeReviewSubmission({ ...base, explicitAuthorization: false }).allowed, false);
  assert.equal(
    authorizeReviewSubmission({ ...base, explicitAuthorization: true, credentialCanReview: false })
      .allowed,
    false
  );
  assert.equal(authorizeReviewSubmission({ ...base, explicitAuthorization: true }).allowed, false);
  const allowed = authorizeReviewSubmission({
    ...base,
    explicitAuthorization: true,
    ciConclusion: 'failure',
    recommendedAction: 'COMMENT',
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.recommendedAction, 'COMMENT');
  const greenComment = authorizeReviewSubmission({
    ...base,
    explicitAuthorization: true,
    ciConclusion: 'success',
    recommendedAction: 'COMMENT',
  });
  assert.equal(greenComment.recommendedAction, 'COMMENT');
});
