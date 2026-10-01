import assert from 'node:assert/strict';
import test from 'node:test';

import { applyGitHubCollaborationMutation } from '../collect-live-collaboration-state.mjs';
import { computeCollaborationRequestDigest } from '../collaboration-runtime.mjs';

const HEAD = 'a'.repeat(40);
const UPDATED_AT = '2026-08-27T00:59:00.000Z';
const OBSERVED_AT = '2026-08-27T01:00:05.000Z';
const authorizationContext = {
  executionMode: 'human-assisted',
  executionModeSource: 'current-user',
  policy: {},
};

function fixture(action) {
  const ready = action === 'mark-exact-head-ready-for-review';
  const stateKey = ready ? 'isDraft' : 'isResolved';
  const field = ready ? 'markPullRequestReadyForReview' : 'resolveReviewThread';
  const objectField = ready ? 'pullRequest' : 'thread';
  const nodeId = ready ? 'PR_node' : 'PRRT_thread';
  const target = {
    kind: ready ? 'pull-request' : 'review-thread',
    number: 509,
    updatedAt: UPDATED_AT,
    headSha: HEAD,
    ...(ready ? {} : { threadId: nodeId, threadUpdatedAt: UPDATED_AT }),
  };
  const request = {
    schemaVersion: 1,
    kind: 'proto-ui.collaboration-request',
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    authorizationId: 'explicit-current-user',
    action,
    requestedAt: '2026-08-27T01:00:00.000Z',
    target,
    expected: { [stateKey]: ready },
    desired: { [stateKey]: !ready },
    evidence: [
      { type: 'current-user-instruction', reference: 'instruction://current-user/pr-509' },
      {
        type: ready ? 'validation-report' : 'review-thread-resolution',
        reference: 'artifact://evidence/pr-509',
        digest: `sha256:${'e'.repeat(64)}`,
      },
    ],
    rationale: 'Apply only the exact authorized collaboration transition.',
    humanGates: [],
  };
  request.requestDigest = computeCollaborationRequestDigest(request);
  const preState = {
    schemaVersion: 1,
    kind: 'proto-ui.live-collaboration-state',
    repositoryId: request.repositoryId,
    action,
    observedAt: OBSERVED_AT,
    viewerLogin: 'maintainer',
    viewerPermission: 'WRITE',
    current: {
      ...target,
      nodeId: ready ? nodeId : null,
      url: ready ? 'https://github.com/Proto-UI/Proto-UI/pull/509' : null,
      state: 'OPEN',
      authorLogin: 'contributor',
      ...request.expected,
      ...(ready ? {} : { isOutdated: false }),
    },
  };
  const postState = {
    ...preState,
    current: { ...preState.current, ...request.desired },
  };
  const object = {
    id: nodeId,
    ...request.desired,
    ...(ready ? { headRefOid: HEAD, updatedAt: UPDATED_AT, url: preState.current.url } : {}),
  };
  const payload = (value = object) => ({ data: { [field]: { [objectField]: value } } });
  return { request, preState, postState, field, objectField, object, payload, nodeId, stateKey };
}

function harness(f, response, { lost = false, reconciliationFails = false } = {}) {
  const calls = [];
  let reads = 0;
  const apply = () =>
    applyGitHubCollaborationMutation(f.request, f.preState, {
      authorizationContext,
      runner(command, args) {
        calls.push({ command, args });
        if (lost) throw new Error('connection closed before the response arrived');
        return JSON.stringify(response);
      },
      collectState() {
        reads += 1;
        if (reads === 1) return f.preState;
        if (reconciliationFails) throw new Error('live read is unavailable');
        // This injected state may come from another actor, even under the same
        // credential and observation timestamp. It cannot prove our write won.
        return f.postState;
      },
    });
  const assertOneWriteAndTwoReads = () => {
    assert.equal(calls.length, 1, 'never retry or compensate an ambiguous write');
    assert.equal(reads, 2, 'one boundary read and exactly one read after the write attempt');
    assert.ok(calls[0].args.includes('graphql'));
    assert.ok(
      calls[0].args.includes(
        `${f.objectField === 'pullRequest' ? 'pullRequestId' : 'threadId'}=${f.nodeId}`
      ),
      'the attempted write must bind the exact node'
    );
  };
  return { apply, assertOneWriteAndTwoReads };
}

for (const action of ['mark-exact-head-ready-for-review', 'resolve-fixed-review-thread']) {
  const f = fixture(action);
  const invalidResponses = [
    ['GraphQL errors with no data', { errors: [{ message: 'permission denied' }] }],
    ['GraphQL errors with null data', { data: null, errors: [{ message: 'permission denied' }] }],
    [
      'partial data with GraphQL errors',
      { ...f.payload(), errors: [{ message: 'partial error' }] },
    ],
    ['malformed errors object', { ...f.payload(), errors: { message: 'permission denied' } }],
    ['malformed null errors', { ...f.payload(), errors: null }],
    ['missing data', {}],
    ['null response', null],
    ['scalar response', 'unexpected'],
    ['array response', []],
    ['missing mutation payload', { data: {} }],
    ['wrong mutation payload', { data: { anotherMutation: { [f.objectField]: f.object } } }],
    ['null mutation payload', { data: { [f.field]: null } }],
    ['missing returned object', { data: { [f.field]: {} } }],
    ['null returned object', f.payload(null)],
    ['malformed returned object', f.payload([])],
    ['missing target identity', f.payload({ ...f.object, id: undefined })],
    ['wrong target identity', f.payload({ ...f.object, id: 'another_node' })],
    ['missing desired state', f.payload({ ...f.object, [f.stateKey]: undefined })],
    ['opposite desired state', f.payload({ ...f.object, [f.stateKey]: !f.object[f.stateKey] })],
    [
      'non-boolean desired state',
      f.payload({ ...f.object, [f.stateKey]: String(f.object[f.stateKey]) }),
    ],
    ...(f.objectField === 'pullRequest'
      ? [
          ['missing head', f.payload({ ...f.object, headRefOid: undefined })],
          ['wrong head', f.payload({ ...f.object, headRefOid: 'b'.repeat(40) })],
        ]
      : []),
  ];

  for (const [description, response] of invalidResponses) {
    test(`${action}: ${description} cannot borrow concurrent desired state for an applied receipt`, () => {
      const h = harness(f, response);
      assert.throws(
        h.apply,
        /outcome is ambiguous after one live reconciliation; do not retry blindly/
      );
      h.assertOneWriteAndTwoReads();
    });
  }

  test(`${action}: a lost response remains ambiguous when the desired state is observed`, () => {
    const h = harness(f, undefined, { lost: true });
    assert.throws(
      h.apply,
      /outcome is ambiguous after one live reconciliation; do not retry blindly/
    );
    h.assertOneWriteAndTwoReads();
  });

  test(`${action}: invalid acknowledgment and failed reconciliation remain unknown`, () => {
    const h = harness(
      f,
      { errors: [{ message: 'permission denied' }] },
      { reconciliationFails: true }
    );
    assert.throws(
      h.apply,
      /outcome is unknown and live reconciliation failed; do not retry blindly/
    );
    h.assertOneWriteAndTwoReads();
  });

  for (const errors of [undefined, []]) {
    test(`${action}: correct target acknowledgment with ${errors ? 'empty' : 'absent'} errors permits verified attribution`, () => {
      const response = { ...f.payload(), ...(errors ? { errors } : {}) };
      const h = harness(f, response);
      const result = h.apply();
      assert.equal(result.mutationCount, 1);
      assert.equal(result.reconciliationCount, 0);
      assert.equal(result.reconciled, false);
      assert.equal(result.platformObject.id, f.nodeId);
      assert.equal(result.platformObject.nodeId, f.nodeId);
      assert.equal(result.platformObject.headSha, HEAD);
      assert.deepEqual(result.rawResponse, response);
      assert.deepEqual(result.postState, f.postState);
      h.assertOneWriteAndTwoReads();
    });
  }
}
