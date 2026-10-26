import assert from 'node:assert/strict';
import test from 'node:test';
import { collectCurrentReviewerPermissions } from '../collect-live-review-input.mjs';
import {
  authorizePullRequestMerge,
  authorizeReviewSubmission,
  reviewerPermissionSubjects,
  validateReviewInputSnapshot,
} from '../review-runtime.mjs';
import {
  publishReview,
  reviewPacket,
  reviewSnapshot,
  sha,
} from './fixtures/review-publication.mjs';

const disposition = (overrides = {}) => ({
  id: 'PRR_a',
  author: 'other-reviewer',
  state: 'CHANGES_REQUESTED',
  commitSha: sha('b'),
  submittedAt: '2026-08-27T06:00:00.000Z',
  body: 'Review disposition',
  ...overrides,
});

function mergeHistory(reviews, inputOverrides = {}) {
  const publication = publishReview(reviewSnapshot({ reviews, ...inputOverrides }));
  return authorizePullRequestMerge({
    ...publication,
    liveInput: structuredClone(publication.input),
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    authorizationId: 'explicit-current-user',
    policy: {},
    selfAssessment: null,
    credentialCanMerge: true,
    credentialPermission: 'MAINTAIN',
    credentialCanBypass: false,
    actor: 'contributor',
    ciConclusion: 'success',
    dcoConclusion: 'success',
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
  });
}

for (const commitSha of [sha('b'), sha('c')]) {
  for (const submittedAt of [
    '2026-08-27T06:00:00.000Z',
    '2026-08-27T06:00:00Z',
    '2026-08-27T06:00:00.0000Z',
    '2026-08-27T08:00:00+02:00',
  ]) {
    test(`merge rejects tied dispositions at ${submittedAt} on ${commitSha.slice(0, 1)} head`, () => {
      for (const [requestId, dismissalId] of [
        ['PRR_a', 'PRR_z'],
        ['PRR_z', 'PRR_a'],
      ]) {
        const request = disposition({ id: requestId, commitSha });
        const dismissal = disposition({
          id: dismissalId,
          author: 'OTHER-REVIEWER',
          state: 'DISMISSED',
          commitSha,
          submittedAt,
        });
        for (const reviews of [
          [request, dismissal],
          [dismissal, request],
        ]) {
          const denied = mergeHistory(reviews);
          assert.equal(denied.allowed, false);
          assert.match(denied.reason, /review order.*(?:unavailable|ambiguous)/);
        }
      }
    });
  }
}

test('merge compares submitted instants across timezones instead of timestamp strings', () => {
  const earlier = disposition({ submittedAt: '2026-08-27T08:00:00+02:00' });
  const later = disposition({
    id: 'PRR_z',
    state: 'DISMISSED',
    submittedAt: '2026-08-27T07:00:00Z',
  });
  assert.equal(mergeHistory([later, earlier]).allowed, true);
  const denied = mergeHistory([
    { ...earlier, state: 'DISMISSED' },
    { ...later, state: 'CHANGES_REQUESTED' },
  ]);
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /not been superseded or dismissed/);
});

test('review chronology preserves every admitted fractional timestamp digit', () => {
  const request = disposition({ submittedAt: '2026-08-27T06:00:00.0001Z' });
  const dismissal = disposition({
    id: 'PRR_z',
    state: 'DISMISSED',
    submittedAt: '2026-08-27T08:00:00.00010+02:00',
  });
  assert.equal(mergeHistory([request, dismissal]).allowed, false);
  assert.equal(
    mergeHistory([request, { ...dismissal, submittedAt: '2026-08-27T06:00:00.0002Z' }]).allowed,
    true
  );
  assert.equal(
    mergeHistory([{ ...request, submittedAt: '2026-08-27T06:00:00.0002Z' }, dismissal]).allowed,
    false
  );
});

test('missing timestamps cannot establish a clearing dismissal or an approval', () => {
  for (const state of ['CHANGES_REQUESTED', 'APPROVED', 'DISMISSED']) {
    const reviews = [
      disposition({ state, submittedAt: null }),
      disposition({ id: 'PRR_z', state: 'DISMISSED' }),
    ];
    assert.doesNotThrow(() => validateReviewInputSnapshot(reviewSnapshot({ reviews })));
    const denied = mergeHistory(reviews);
    assert.equal(denied.allowed, false);
    assert.match(denied.reason, /review order.*(?:unavailable|ambiguous)/);
    assert.deepEqual(reviewerPermissionSubjects(reviewSnapshot({ reviews })), []);
  }
  assert.deepEqual(
    reviewerPermissionSubjects(
      reviewSnapshot({
        reviews: [disposition({ state: 'APPROVED', submittedAt: null })],
      })
    ),
    []
  );
});

test('a unique later disposition supersedes ordinary reviews and earlier ties', () => {
  for (const state of ['APPROVED', 'DISMISSED']) {
    const latest = disposition({
      id: 'PRR_0',
      state,
      submittedAt: '2026-08-27T07:00:00.000Z',
    });
    const older = disposition();
    assert.equal(mergeHistory([latest, older]).allowed, true);
    assert.equal(
      mergeHistory([latest, older, disposition({ id: 'PRR_z', state: 'DISMISSED' })]).allowed,
      true
    );
  }
});

test('a unique later publication preserves permission reconstruction after earlier ties', () => {
  const reviews = [
    disposition({ author: 'independent-reviewer' }),
    disposition({ id: 'PRR_z', author: 'independent-reviewer', state: 'APPROVED' }),
  ];
  assert.deepEqual(reviewerPermissionSubjects(reviewSnapshot({ reviews })), []);
  // Actual collection has no eligible subject until the later publication.
  // Inverting that publication must remove the newly collected permission too.
  assert.equal(mergeHistory(reviews, { reviewerPermissions: [] }).allowed, true);
});

test('ambiguous approval subjects do not trigger permission queries or block COMMENT collection', () => {
  const input = reviewSnapshot({
    reviews: [
      disposition({ state: 'DISMISSED' }),
      disposition({ id: 'PRR_z', state: 'APPROVED' }),
      disposition({ id: 'PRR_stable', author: 'stable-reviewer', state: 'APPROVED' }),
    ],
    reviewerPermissions: [],
  });
  assert.deepEqual(reviewerPermissionSubjects(input), ['stable-reviewer']);
  const queries = [];
  input.reviewerPermissions = collectCurrentReviewerPermissions(input, {
    runner: (_command, args) => {
      queries.push(args);
      assert.deepEqual(args, [
        'api',
        'repos/Proto-UI/Proto-UI/collaborators/stable-reviewer/permission',
      ]);
      return JSON.stringify({ user: { login: 'stable-reviewer' }, permission: 'write' });
    },
  });
  assert.equal(queries.length, 1);
  const result = authorizeReviewSubmission({
    packet: reviewPacket(input, {
      recommendedAction: 'COMMENT',
      limitations: ['Disposition chronology is ambiguous; merge remains blocked'],
    }),
    input,
    liveInput: structuredClone(input),
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    authorizationId: 'explicit-current-user',
    policy: {},
    selfAssessment: null,
    credentialCanReview: true,
    reviewer: 'observer',
    ciConclusion: 'success',
    dcoConclusion: 'success',
  });
  assert.equal(result.allowed, true);
});

test('permission subjects retain ordinary successive approval and dismissal behavior', () => {
  const old = disposition({ state: 'APPROVED' });
  const latest = disposition({
    id: 'PRR_0',
    submittedAt: '2026-08-27T07:00:00Z',
  });
  for (const state of ['CHANGES_REQUESTED', 'DISMISSED', 'APPROVED']) {
    const input = reviewSnapshot({ reviews: [{ ...latest, state }, old] });
    assert.deepEqual(
      reviewerPermissionSubjects(input),
      state === 'APPROVED' ? ['other-reviewer'] : []
    );
  }
});

test('malformed review timestamps remain invalid and cannot supply permission subjects', () => {
  for (const submittedAt of [undefined, '', 'not-a-date', '2026-08-27']) {
    const input = reviewSnapshot({
      reviews: [disposition({ state: 'APPROVED', submittedAt })],
    });
    assert.throws(() => validateReviewInputSnapshot(input), /review submittedAt is invalid/);
    assert.deepEqual(reviewerPermissionSubjects(input), []);
  }
});
