import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  authorizeCollaborationMutation,
  buildCollaborationReceipt,
  collaborationMarker,
  computeCollaborationRequestDigest,
  validateCollaborationHandoffBinding,
  validateCollaborationReceipt,
  validateCollaborationRequest,
} from '../collaboration-runtime.mjs';
import {
  applyGitHubCollaborationMutation,
  collectLiveCollaborationState,
} from '../collect-live-collaboration-state.mjs';
import { parseCollaborationCli, runCollaborationCli } from '../collaboration-packet.mjs';

const HEAD = 'a'.repeat(40);
const NEXT_HEAD = 'b'.repeat(40);
const BASE = 'c'.repeat(40);
const REQUESTED_AT = '2026-08-27T01:00:00.000Z';
const UPDATED_AT = '2026-08-27T00:59:00.000Z';

const policy = {
  bands: {
    C2: { taskClasses: ['maintain-collaboration-state'] },
  },
  mutationClasses: {
    'reversible-github-collaboration': { autonomousMinimumBand: 'C2' },
  },
  collaborationMutationAuthorizations: [
    {
      id: 'proto-ui-scheduled-collaboration-v1',
      status: 'active',
      executionMode: 'autonomous',
      executionModeSource: 'schedule',
      repositoryId: 'github.com:Proto-UI/Proto-UI',
      mutationClass: 'reversible-github-collaboration',
      allowedActions: [
        'update-governed-issue-or-pull-request-metadata',
        'update-pull-request-branch-at-expected-head',
        'mark-exact-head-ready-for-review',
        'request-independent-review',
        'resolve-fixed-review-thread',
        'rerun-exact-trusted-workflow',
        'post-bounded-reconciliation-comment',
      ],
    },
  ],
  trustedCiEvidence: {
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    workflowNames: ['CI'],
    workflowPaths: ['.github/workflows/ci.yml'],
  },
};

const assessment = {
  kind: 'proto-ui.agent-capability-self-result',
  validated: true,
  fresh: true,
  capability: {
    band: 'C2',
    eligibleTaskClasses: ['maintain-collaboration-state'],
  },
};

function seal(request) {
  const value = structuredClone(request);
  value.requestDigest = computeCollaborationRequestDigest(value);
  return value;
}

function metadataRequest(overrides = {}) {
  return seal({
    schemaVersion: 1,
    kind: 'proto-ui.collaboration-request',
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    authorizationId: 'proto-ui-scheduled-collaboration-v1',
    action: 'update-governed-issue-or-pull-request-metadata',
    requestedAt: REQUESTED_AT,
    requestDigest: '0'.repeat(64),
    target: {
      kind: 'pull-request',
      number: 509,
      updatedAt: UPDATED_AT,
      headSha: HEAD,
    },
    expected: {
      title: 'Old title',
      body: 'Old body',
      milestoneNumber: null,
      assignees: [],
      labels: ['governed'],
    },
    desired: {
      title: 'New title',
      body: 'Old body',
      milestoneNumber: null,
      assignees: [],
      labels: ['governed'],
    },
    evidence: [
      {
        type: 'governed-outcome',
        reference: 'artifact://governed-outcome/pr-509',
        digest: `sha256:${'e'.repeat(64)}`,
      },
    ],
    rationale: 'Repair the governed title without changing semantic scope.',
    humanGates: [],
    ...overrides,
  });
}

function metadataLive(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'proto-ui.live-collaboration-state',
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    action: 'update-governed-issue-or-pull-request-metadata',
    observedAt: '2026-08-27T01:00:05.000Z',
    viewerLogin: 'maintainer',
    viewerPermission: 'WRITE',
    current: {
      kind: 'pull-request',
      number: 509,
      nodeId: 'PR_node',
      url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
      state: 'OPEN',
      authorLogin: 'contributor',
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      title: 'Old title',
      body: 'Old body',
      milestoneNumber: null,
      assignees: [],
      labels: ['governed'],
      desiredLabelsExist: true,
      ...overrides,
    },
  };
}

function authorize(request, liveState, overrides = {}) {
  return authorizeCollaborationMutation({
    request,
    liveState,
    executionMode: 'autonomous',
    executionModeSource: 'schedule',
    policy,
    selfAssessment: assessment,
    ...overrides,
  });
}

test('request digest binds every purpose and rejects tampering', () => {
  const request = metadataRequest();
  assert.equal(validateCollaborationRequest(request), request);
  assert.throws(
    () => validateCollaborationRequest({ ...request, rationale: 'Changed after signing.' }),
    /requestDigest does not match/
  );
});

test('autonomous collaboration requires the exact active scope and a fresh C2 task ceiling', () => {
  const request = metadataRequest();
  const live = metadataLive();
  const staleAssessment = {
    ...assessment,
    fresh: false,
  };
  assert.deepEqual(authorize(request, live, { selfAssessment: staleAssessment }), {
    allowed: false,
    outcome: 'rejected',
    reason: 'autonomous collaboration requires a fresh validated self-assessment',
    requestDigest: request.requestDigest,
  });
  const wrongScope = seal({ ...request, authorizationId: 'some-other-scope' });
  assert.match(authorize(wrongScope, live).reason, /active standing authorization/);
});

test('standing authorization still requires purpose evidence for the current governed outcome', () => {
  const request = seal({ ...metadataRequest(), evidence: [] });
  const decision = authorize(request, metadataLive());
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /current governed outcome/);
});

test('handoff artifacts bind the exact request digest and authorization scope', () => {
  const request = metadataRequest();
  const handoff = {
    artifacts: [
      {
        type: 'collaboration-request',
        reference: 'artifact://collaboration/pr-509',
        digest: `sha256:${request.requestDigest}`,
      },
      {
        type: 'mutation-authorization',
        reference: request.authorizationId,
      },
    ],
  };
  assert.equal(validateCollaborationHandoffBinding(request, handoff), handoff);
  const stale = structuredClone(handoff);
  stale.artifacts[0].digest = `sha256:${'f'.repeat(64)}`;
  assert.throws(
    () => validateCollaborationHandoffBinding(request, stale),
    /collaboration-request artifact does not bind requestDigest/
  );
  const wrongScope = structuredClone(handoff);
  wrongScope.artifacts[1].reference = 'proto-ui-scheduled-review-v1';
  assert.throws(
    () => validateCollaborationHandoffBinding(request, wrongScope),
    /mutation-authorization artifact does not bind authorizationId/
  );
});

test('ready-for-review handoff binds a digested validation-report artifact', () => {
  const request = seal({
    ...metadataRequest(),
    action: 'mark-exact-head-ready-for-review',
    target: {
      kind: 'pull-request',
      number: 509,
      updatedAt: UPDATED_AT,
      headSha: HEAD,
    },
    expected: { isDraft: true },
    desired: { isDraft: false },
    evidence: [
      ...metadataRequest().evidence,
      {
        type: 'validation-report',
        reference: 'artifact://validation/pr-509',
        digest: `sha256:${'d'.repeat(64)}`,
      },
    ],
  });
  const artifacts = [
    {
      type: 'collaboration-request',
      reference: 'artifact://collaboration/pr-509',
      digest: `sha256:${request.requestDigest}`,
    },
    {
      type: 'mutation-authorization',
      reference: request.authorizationId,
    },
    {
      type: 'validation-report',
      reference: 'artifact://validation/pr-509',
      digest: `sha256:${'d'.repeat(64)}`,
    },
  ];
  const handoff = { artifacts };
  assert.equal(validateCollaborationHandoffBinding(request, handoff), handoff);

  const missingDigest = seal({
    ...request,
    evidence: [
      ...request.evidence.slice(0, -1),
      { type: 'validation-report', reference: 'artifact://validation/pr-509' },
    ],
  });
  assert.throws(
    () => validateCollaborationHandoffBinding(missingDigest, { artifacts }),
    /validation-report requires a digest/
  );

  const forged = structuredClone({ artifacts });
  forged.artifacts[2].digest = `sha256:${'c'.repeat(64)}`;
  assert.throws(
    () => validateCollaborationHandoffBinding(request, forged),
    /validation-report artifact does not bind the ready-for-review evidence/
  );
});

test('live preflight fails closed on a stale exact target without authorizing a write', () => {
  const request = metadataRequest();
  const decision = authorize(request, metadataLive({ updatedAt: '2026-08-27T01:00:01.000Z' }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.outcome, 'rejected');
  assert.match(decision.reason, /updatedAt is stale/);
});

test('an already-satisfied desired state is an idempotent no-op despite mutation timestamp drift', () => {
  const request = metadataRequest();
  const decision = authorize(
    request,
    metadataLive({ title: 'New title', updatedAt: '2026-08-27T01:00:09.000Z' })
  );
  assert.equal(decision.allowed, true);
  assert.equal(decision.outcome, 'no-op');
  assert.equal(decision.mutationCount, 0);
});

test('review requests reject every pull-request contributor and fail closed on missing identity', () => {
  const base = metadataRequest();
  const reviewerRequest = seal({
    ...base,
    action: 'request-independent-review',
    target: base.target,
    expected: { requestedReviewerLogins: [] },
    desired: { reviewerLogin: 'contributor' },
    rationale: 'Request an independent exact-head review.',
  });
  const reviewerLive = {
    ...metadataLive(),
    action: reviewerRequest.action,
    current: {
      kind: 'pull-request',
      number: 509,
      nodeId: 'PR_node',
      url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
      state: 'OPEN',
      authorLogin: 'contributor',
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      requestedReviewerLogins: [],
      commitContributorLogins: ['commit-author', 'commit-committer'],
      commitContributorIdentityComplete: true,
    },
  };
  assert.match(authorize(reviewerRequest, reviewerLive).reason, /pull-request author/);
  const selfRequest = seal({
    ...reviewerRequest,
    desired: { reviewerLogin: 'maintainer' },
  });
  assert.match(authorize(selfRequest, reviewerLive).reason, /acting credential/);
  const contributorRequest = seal({
    ...reviewerRequest,
    desired: { reviewerLogin: 'commit-author' },
  });
  assert.match(authorize(contributorRequest, reviewerLive).reason, /commit contributor/);
  const externalRequest = seal({
    ...reviewerRequest,
    desired: { reviewerLogin: 'independent-reviewer' },
  });
  assert.equal(authorize(externalRequest, reviewerLive).outcome, 'mutate');
  assert.match(
    authorize(externalRequest, {
      ...reviewerLive,
      current: { ...reviewerLive.current, commitContributorIdentityComplete: false },
    }).reason,
    /contributor identity is unavailable/
  );
});

test('workflow reruns require the exact trusted workflow identity and diagnosed failure evidence', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'rerun-exact-trusted-workflow',
    target: {
      kind: 'workflow-run',
      runId: 1234,
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      attempt: 1,
      workflowName: 'Untrusted',
      workflowPath: '.github/workflows/untrusted.yml',
    },
    expected: { status: 'completed', conclusion: 'failure' },
    desired: { mode: 'failed-jobs' },
    evidence: [
      {
        type: 'governed-outcome',
        reference: 'artifact://governed-outcome/pr-509',
      },
      {
        type: 'ci-diagnosis',
        reference: 'artifact://ci/1234/diagnosis',
        digest: `sha256:${'d'.repeat(64)}`,
      },
    ],
    rationale: 'Rerun the diagnosed failed jobs on the exact head.',
  });
  const live = {
    ...metadataLive(),
    action: request.action,
    current: {
      kind: 'workflow-run',
      runId: 1234,
      url: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1234',
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      attempt: 1,
      workflowName: 'Untrusted',
      workflowPath: '.github/workflows/untrusted.yml',
      headRepositoryId: 'github.com:Proto-UI/Proto-UI',
      status: 'completed',
      conclusion: 'failure',
    },
  };
  assert.match(authorize(request, live).reason, /trusted workflow/);
});

test('thread resolution requires evidence and the exact unresolved thread revision', () => {
  const base = metadataRequest();
  const request = {
    ...base,
    action: 'resolve-fixed-review-thread',
    target: {
      kind: 'review-thread',
      number: 509,
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      threadId: 'PRRT_thread',
      threadUpdatedAt: UPDATED_AT,
    },
    expected: { isResolved: false },
    desired: { isResolved: true },
    evidence: [],
    rationale: 'Resolve the exact thread after its finding is fixed.',
  };
  request.requestDigest = computeCollaborationRequestDigest(request);
  assert.throws(() => validateCollaborationRequest(request), /resolution evidence/);
});

test('thread resolution refuses a verified receipt when a new reply races the mutation', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'resolve-fixed-review-thread',
    target: {
      kind: 'review-thread',
      number: 509,
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      threadId: 'PRRT_thread',
      threadUpdatedAt: UPDATED_AT,
    },
    expected: { isResolved: false },
    desired: { isResolved: true },
    evidence: [
      {
        type: 'review-thread-resolution',
        reference: 'The exact finding is fixed on the target head.',
      },
    ],
    rationale: 'Resolve only the reviewed thread revision.',
  });
  const current = {
    kind: 'review-thread',
    number: 509,
    nodeId: null,
    url: null,
    state: 'OPEN',
    authorLogin: 'contributor',
    updatedAt: UPDATED_AT,
    headSha: HEAD,
    threadId: 'PRRT_thread',
    threadUpdatedAt: UPDATED_AT,
    isResolved: false,
    isOutdated: false,
  };
  const preState = { ...metadataLive(), action: request.action, current };
  const racedState = {
    ...preState,
    current: {
      ...current,
      threadUpdatedAt: '2026-08-27T01:00:09.000Z',
      isResolved: true,
    },
  };
  assert.throws(
    () =>
      applyGitHubCollaborationMutation(request, preState, {
        runner() {
          return JSON.stringify({
            data: { resolveReviewThread: { thread: { id: 'PRRT_thread', isResolved: true } } },
          });
        },
        collectState() {
          return racedState;
        },
      }),
    /desired state was not verified.*do not retry blindly/
  );
});

test('mutation adapter performs exactly one write and one post-write verification', () => {
  const request = metadataRequest();
  const preState = metadataLive();
  const calls = [];
  const postState = metadataLive({
    title: 'New title',
    updatedAt: '2026-08-27T01:00:10.000Z',
  });
  const result = applyGitHubCollaborationMutation(request, preState, {
    runner(command, args, options) {
      calls.push({ command, args, options });
      return JSON.stringify({
        id: 509,
        node_id: 'PR_node',
        html_url: postState.current.url,
        updated_at: postState.current.updatedAt,
        title: 'New title',
      });
    },
    collectState() {
      calls.push({ collect: true });
      return postState;
    },
  });
  assert.equal(calls.filter((call) => call.command === 'gh').length, 1);
  assert.equal(calls.filter((call) => call.collect).length, 1);
  assert.equal(result.mutationCount, 1);
  assert.equal(result.reconciliationCount, 0);
  assert.equal(result.postState.current.title, 'New title');
});

test('unknown outcomes reconcile once and never retry a non-attributable mutation', () => {
  const request = metadataRequest();
  let writes = 0;
  let reconciliations = 0;
  assert.throws(
    () =>
      applyGitHubCollaborationMutation(request, metadataLive(), {
        runner() {
          writes += 1;
          throw new Error('connection reset after request body was sent');
        },
        collectState() {
          reconciliations += 1;
          return metadataLive({ title: 'New title' });
        },
      }),
    /ambiguous after one live reconciliation.*do not retry blindly/
  );
  assert.equal(writes, 1);
  assert.equal(reconciliations, 1);
});

test('a bounded comment can reconcile an unknown outcome through its unique request marker', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'post-bounded-reconciliation-comment',
    target: base.target,
    expected: { markerAbsent: true },
    desired: { body: 'Exact-head reconciliation is complete.' },
    rationale: 'Post the bounded reconciliation result.',
  });
  const marker = collaborationMarker(request);
  const current = {
    kind: 'pull-request',
    number: 509,
    nodeId: 'PR_node',
    url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
    state: 'OPEN',
    authorLogin: 'contributor',
    updatedAt: UPDATED_AT,
    headSha: HEAD,
    markerComment: null,
  };
  const preState = { ...metadataLive(), action: request.action, current };
  const postState = {
    ...preState,
    current: {
      ...current,
      updatedAt: '2026-08-27T01:00:10.000Z',
      markerComment: {
        id: '9001',
        nodeId: 'IC_node',
        url: 'https://github.com/Proto-UI/Proto-UI/pull/509#issuecomment-9001',
        createdAt: '2026-08-27T01:00:09.000Z',
        body: `Exact-head reconciliation is complete.\n\n${marker}`,
      },
    },
  };
  let writes = 0;
  let reconciliations = 0;
  const result = applyGitHubCollaborationMutation(request, preState, {
    runner() {
      writes += 1;
      throw new Error('socket closed');
    },
    collectState() {
      reconciliations += 1;
      return postState;
    },
  });
  assert.equal(writes, 1);
  assert.equal(reconciliations, 1);
  assert.equal(result.reconciliationCount, 1);
  assert.equal(result.reconciled, true);
});

test('receipt validation binds the request and rejects impossible mutation counts', () => {
  const request = metadataRequest();
  const preState = metadataLive();
  const postState = metadataLive({ title: 'New title' });
  const receipt = buildCollaborationReceipt({
    request,
    preState,
    postState,
    actor: 'maintainer',
    outcome: 'applied',
    mutationCount: 1,
    reconciliationCount: 0,
    platformObject: {
      id: '509',
      nodeId: 'PR_node',
      url: postState.current.url,
      updatedAt: postState.current.updatedAt,
      headSha: HEAD,
      workflowRunId: null,
      workflowAttempt: null,
    },
    verifiedAt: '2026-08-27T01:00:11.000Z',
    verification: 'live-state-matches-desired',
    note: 'The exact desired metadata state was observed after one write.',
  });
  assert.equal(validateCollaborationReceipt(receipt, request), receipt);
  assert.throws(
    () => validateCollaborationReceipt({ ...receipt, mutationCount: 0 }, request),
    /applied receipt must record exactly one mutation/
  );
});

test('update-branch no-op is bound to the exact base and rejects an unrelated stale head', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'update-pull-request-branch-at-expected-head',
    target: {
      kind: 'pull-request',
      number: 509,
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      baseSha: BASE,
    },
    expected: { containsBaseSha: false },
    desired: { containsBaseSha: true },
    rationale: 'Bring the exact branch head up to the exact current base.',
  });
  const live = {
    ...metadataLive(),
    action: request.action,
    current: {
      kind: 'pull-request',
      number: 509,
      nodeId: 'PR_node',
      url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
      state: 'OPEN',
      authorLogin: 'contributor',
      updatedAt: '2026-08-27T01:00:10.000Z',
      headSha: NEXT_HEAD,
      baseSha: BASE,
      containsBaseSha: false,
      maintainerCanModify: true,
    },
  };
  assert.match(authorize(request, live).reason, /head SHA is stale/);
  const satisfied = authorize(request, {
    ...live,
    current: { ...live.current, containsBaseSha: true },
  });
  assert.equal(satisfied.outcome, 'no-op');
});

test('update-branch polls until both the new head and its ancestry are visible', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'update-pull-request-branch-at-expected-head',
    target: {
      kind: 'pull-request',
      number: 509,
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      baseSha: BASE,
    },
    expected: { containsBaseSha: false },
    desired: { containsBaseSha: true },
    rationale: 'Bring the exact branch head up to the exact current base.',
  });
  const current = {
    kind: 'pull-request',
    number: 509,
    nodeId: 'PR_node',
    url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
    state: 'OPEN',
    authorLogin: 'contributor',
    updatedAt: UPDATED_AT,
    headSha: HEAD,
    baseSha: BASE,
    containsBaseSha: false,
    maintainerCanModify: true,
  };
  const preState = { ...metadataLive(), action: request.action, current };
  const states = [
    preState,
    {
      ...preState,
      current: {
        ...current,
        headSha: NEXT_HEAD,
        containsBaseSha: false,
      },
    },
    {
      ...preState,
      observedAt: '2026-08-27T01:00:11.000Z',
      current: {
        ...current,
        updatedAt: '2026-08-27T01:00:10.000Z',
        headSha: NEXT_HEAD,
        containsBaseSha: true,
      },
    },
  ];
  let reads = 0;
  const waits = [];
  const result = applyGitHubCollaborationMutation(request, preState, {
    runner() {
      return JSON.stringify({ message: 'Updating pull request branch.' });
    },
    collectState() {
      return states[reads++];
    },
    asyncVerificationAttempts: 3,
    asyncVerificationDelayMs: 25,
    wait(delayMs) {
      waits.push(delayMs);
    },
  });

  assert.equal(reads, 3);
  assert.deepEqual(waits, [25, 25]);
  assert.equal(result.mutationCount, 1);
  assert.equal(result.reconciliationCount, 0);
  assert.equal(result.postState.current.headSha, NEXT_HEAD);
});

test('update-branch stops bounded polling when base or pull-request state changes', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'update-pull-request-branch-at-expected-head',
    target: {
      kind: 'pull-request',
      number: 509,
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      baseSha: BASE,
    },
    expected: { containsBaseSha: false },
    desired: { containsBaseSha: true },
    rationale: 'Bring the exact branch head up to the exact current base.',
  });
  const current = {
    kind: 'pull-request',
    number: 509,
    nodeId: 'PR_node',
    url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
    state: 'OPEN',
    authorLogin: 'contributor',
    updatedAt: UPDATED_AT,
    headSha: HEAD,
    baseSha: BASE,
    containsBaseSha: false,
    maintainerCanModify: true,
  };
  const preState = { ...metadataLive(), action: request.action, current };

  for (const drift of [{ baseSha: 'd'.repeat(40) }, { state: 'CLOSED' }]) {
    let reads = 0;
    let waits = 0;
    assert.throws(
      () =>
        applyGitHubCollaborationMutation(request, preState, {
          runner() {
            return JSON.stringify({ message: 'Updating pull request branch.' });
          },
          collectState() {
            reads += 1;
            return { ...preState, current: { ...current, ...drift } };
          },
          asyncVerificationAttempts: 3,
          asyncVerificationDelayMs: 25,
          wait() {
            waits += 1;
          },
        }),
      /bounded post-write verification polling.*do not retry blindly/
    );
    assert.equal(reads, 1);
    assert.equal(waits, 0);
  }
});

test('update-branch polling stops at the configured maximum without another write', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'update-pull-request-branch-at-expected-head',
    target: {
      kind: 'pull-request',
      number: 509,
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      baseSha: BASE,
    },
    expected: { containsBaseSha: false },
    desired: { containsBaseSha: true },
    rationale: 'Bring the exact branch head up to the exact current base.',
  });
  const current = {
    kind: 'pull-request',
    number: 509,
    nodeId: 'PR_node',
    url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
    state: 'OPEN',
    authorLogin: 'contributor',
    updatedAt: UPDATED_AT,
    headSha: HEAD,
    baseSha: BASE,
    containsBaseSha: false,
    maintainerCanModify: true,
  };
  const preState = { ...metadataLive(), action: request.action, current };
  let writes = 0;
  let reads = 0;
  let waits = 0;

  assert.throws(
    () =>
      applyGitHubCollaborationMutation(request, preState, {
        runner() {
          writes += 1;
          return JSON.stringify({ message: 'Updating pull request branch.' });
        },
        collectState() {
          reads += 1;
          return preState;
        },
        asyncVerificationAttempts: 3,
        asyncVerificationDelayMs: 25,
        wait() {
          waits += 1;
        },
      }),
    /bounded post-write verification polling.*do not retry blindly/
  );
  assert.equal(writes, 1);
  assert.equal(reads, 3);
  assert.equal(waits, 2);
});

test('update-branch allows the acting pull-request author when maintainer edits are disabled', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'update-pull-request-branch-at-expected-head',
    target: {
      kind: 'pull-request',
      number: 509,
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      baseSha: BASE,
    },
    expected: { containsBaseSha: false },
    desired: { containsBaseSha: true },
    rationale: 'Bring the author-owned exact branch head up to the exact current base.',
  });
  const live = {
    ...metadataLive(),
    viewerLogin: 'contributor',
    action: request.action,
    current: {
      kind: 'pull-request',
      number: 509,
      nodeId: 'PR_node',
      url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
      state: 'OPEN',
      authorLogin: 'contributor',
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      baseSha: BASE,
      containsBaseSha: false,
      maintainerCanModify: false,
    },
  };
  assert.equal(authorize(request, live).outcome, 'mutate');

  const unrelatedViewer = {
    ...live,
    viewerLogin: 'unrelated-maintainer',
  };
  assert.match(
    authorize(request, unrelatedViewer).reason,
    /neither author-owned.*maintainer-editable/
  );
});

test('collaboration CLI is strict and can seal a request without touching GitHub', () => {
  assert.throws(
    () => parseCollaborationCli(['apply', '--request', 'request.json', '--unknown', 'value']),
    /unexpected option/
  );
  assert.throws(
    () => parseCollaborationCli(['apply', '--request', 'one.json', '--request', 'two.json']),
    /Usage:/
  );

  const directory = mkdtempSync(join(tmpdir(), 'proto-ui-collaboration-'));
  try {
    const path = join(directory, 'request.json');
    const draft = metadataRequest();
    delete draft.requestDigest;
    writeFileSync(path, JSON.stringify(draft));
    const output = runCollaborationCli(['request-digest', '--request', path]);
    assert.equal(output.valid, true);
    assert.match(output.requestDigest, /^[a-f0-9]{64}$/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('collaboration CLI emits a validated zero-write receipt for an idempotent human-assisted request', () => {
  const request = seal({
    ...metadataRequest(),
    authorizationId: 'explicit-current-user',
    evidence: [
      {
        type: 'current-user-instruction',
        reference: 'conversation://current-request',
      },
    ],
  });
  const handoff = {
    schemaVersion: 1,
    kind: 'proto-ui.skill-handoff',
    entrypoint: 'development',
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    fromId: 'pui-pr',
    nextSkillId: 'pui-collaborate',
    artifacts: [
      { type: 'pull-request-report', reference: 'artifact://pr/509/report' },
      { type: 'review-input', reference: 'artifact://pr/509/review-input' },
      { type: 'capability-envelope', reference: 'artifact://capability/current' },
      { type: 'github-snapshot', reference: 'artifact://github/pr-509' },
      { type: 'mutation-authorization', reference: 'explicit-current-user' },
      {
        type: 'collaboration-request',
        reference: 'artifact://collaboration/pr-509',
        digest: `sha256:${request.requestDigest}`,
      },
    ],
    humanGates: [],
    notes: [],
  };
  const directory = mkdtempSync(join(tmpdir(), 'proto-ui-collaboration-'));
  try {
    const requestPath = join(directory, 'request.json');
    const handoffPath = join(directory, 'handoff.json');
    writeFileSync(requestPath, JSON.stringify(request));
    writeFileSync(handoffPath, JSON.stringify(handoff));
    const output = runCollaborationCli(
      ['apply', '--request', requestPath, '--handoff', handoffPath],
      {
        collectState() {
          return metadataLive({
            title: 'New title',
            updatedAt: '2026-08-27T01:00:09.000Z',
          });
        },
        applyMutation() {
          throw new Error('idempotent CLI path must not invoke the mutation adapter');
        },
      }
    );
    assert.equal(output.kind, 'proto-ui.collaboration-receipt');
    assert.equal(output.outcome, 'no-op');
    assert.equal(output.mutationCount, 0);
    assert.equal(output.requestDigest, request.requestDigest);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('each non-metadata collaboration action maps to one exact GitHub mutation primitive', () => {
  const base = metadataRequest();
  const cases = [
    {
      name: 'update branch',
      request: seal({
        ...base,
        action: 'update-pull-request-branch-at-expected-head',
        target: {
          kind: 'pull-request',
          number: 509,
          updatedAt: UPDATED_AT,
          headSha: HEAD,
          baseSha: BASE,
        },
        expected: { containsBaseSha: false },
        desired: { containsBaseSha: true },
      }),
      before: {
        kind: 'pull-request',
        number: 509,
        nodeId: 'PR_node',
        url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
        state: 'OPEN',
        authorLogin: 'contributor',
        updatedAt: UPDATED_AT,
        headSha: HEAD,
        baseSha: BASE,
        containsBaseSha: false,
        maintainerCanModify: true,
      },
      after: { headSha: NEXT_HEAD, containsBaseSha: true },
      response: JSON.stringify({ message: 'Updating pull request branch.' }),
      endpoint: 'repos/Proto-UI/Proto-UI/pulls/509/update-branch',
      method: 'PUT',
      input: { expected_head_sha: HEAD },
    },
    {
      name: 'ready for review',
      request: seal({
        ...base,
        action: 'mark-exact-head-ready-for-review',
        expected: { isDraft: true },
        desired: { isDraft: false },
        evidence: [
          ...base.evidence,
          {
            type: 'validation-report',
            reference: 'artifact://validation/pr-509',
            digest: `sha256:${'0'.repeat(64)}`,
          },
        ],
      }),
      before: {
        kind: 'pull-request',
        number: 509,
        nodeId: 'PR_node',
        url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
        state: 'OPEN',
        authorLogin: 'contributor',
        updatedAt: UPDATED_AT,
        headSha: HEAD,
        isDraft: true,
      },
      after: { isDraft: false },
      response: JSON.stringify({
        data: {
          markPullRequestReadyForReview: {
            pullRequest: {
              id: 'PR_node',
              isDraft: false,
              updatedAt: '2026-08-27T01:00:10.000Z',
              headRefOid: HEAD,
              url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
            },
          },
        },
      }),
      endpoint: 'graphql',
      variable: 'pullRequestId=PR_node',
    },
    {
      name: 'request reviewer',
      request: seal({
        ...base,
        action: 'request-independent-review',
        expected: { requestedReviewerLogins: [] },
        desired: { reviewerLogin: 'reviewer' },
      }),
      before: {
        kind: 'pull-request',
        number: 509,
        nodeId: 'PR_node',
        url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
        state: 'OPEN',
        authorLogin: 'contributor',
        updatedAt: UPDATED_AT,
        headSha: HEAD,
        requestedReviewerLogins: [],
        commitContributorLogins: ['commit-author', 'commit-committer'],
        commitContributorIdentityComplete: true,
      },
      after: { requestedReviewerLogins: ['reviewer'] },
      response: JSON.stringify({ number: 509, node_id: 'PR_node' }),
      endpoint: 'repos/Proto-UI/Proto-UI/pulls/509/requested_reviewers',
      method: 'POST',
      input: { reviewers: ['reviewer'] },
    },
    {
      name: 'resolve thread',
      request: seal({
        ...base,
        action: 'resolve-fixed-review-thread',
        target: {
          kind: 'review-thread',
          number: 509,
          updatedAt: UPDATED_AT,
          headSha: HEAD,
          threadId: 'PRRT_thread',
          threadUpdatedAt: UPDATED_AT,
        },
        expected: { isResolved: false },
        desired: { isResolved: true },
        evidence: [
          ...base.evidence,
          {
            type: 'review-thread-resolution',
            reference: 'artifact://review-thread/PRRT_thread/fix',
          },
        ],
      }),
      before: {
        kind: 'review-thread',
        number: 509,
        nodeId: null,
        url: null,
        state: 'OPEN',
        authorLogin: 'contributor',
        updatedAt: UPDATED_AT,
        headSha: HEAD,
        threadId: 'PRRT_thread',
        threadUpdatedAt: UPDATED_AT,
        isResolved: false,
        isOutdated: false,
      },
      after: { isResolved: true },
      response: JSON.stringify({
        data: { resolveReviewThread: { thread: { id: 'PRRT_thread', isResolved: true } } },
      }),
      endpoint: 'graphql',
      variable: 'threadId=PRRT_thread',
    },
    {
      name: 'rerun failed jobs',
      request: seal({
        ...base,
        action: 'rerun-exact-trusted-workflow',
        target: {
          kind: 'workflow-run',
          runId: 1234,
          updatedAt: UPDATED_AT,
          headSha: HEAD,
          attempt: 1,
          workflowName: 'CI',
          workflowPath: '.github/workflows/ci.yml',
        },
        expected: { status: 'completed', conclusion: 'failure' },
        desired: { mode: 'failed-jobs' },
        evidence: [
          ...base.evidence,
          { type: 'ci-diagnosis', reference: 'artifact://ci/1234/diagnosis' },
        ],
      }),
      before: {
        kind: 'workflow-run',
        runId: 1234,
        url: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1234',
        updatedAt: UPDATED_AT,
        headSha: HEAD,
        attempt: 1,
        workflowName: 'CI',
        workflowPath: '.github/workflows/ci.yml',
        headRepositoryId: 'github.com:Proto-UI/Proto-UI',
        status: 'completed',
        conclusion: 'failure',
      },
      after: { attempt: 2, status: 'queued', conclusion: null },
      response: '',
      endpoint: 'repos/Proto-UI/Proto-UI/actions/runs/1234/rerun-failed-jobs',
      method: 'POST',
    },
  ];

  for (const fixture of cases) {
    const preState = {
      ...metadataLive(),
      action: fixture.request.action,
      current: fixture.before,
    };
    const postState = {
      ...preState,
      observedAt: '2026-08-27T01:00:11.000Z',
      current: {
        ...fixture.before,
        updatedAt: '2026-08-27T01:00:10.000Z',
        ...fixture.after,
      },
    };
    const calls = [];
    const result = applyGitHubCollaborationMutation(fixture.request, preState, {
      runner(command, args, options) {
        calls.push({ command, args, options });
        return fixture.response;
      },
      collectState() {
        return postState;
      },
    });
    assert.equal(calls.length, 1, `${fixture.name} must perform one mutation call`);
    assert.ok(calls[0].args.includes(fixture.endpoint), `${fixture.name} endpoint`);
    if (fixture.method) {
      const methodIndex = calls[0].args.indexOf('--method');
      assert.equal(calls[0].args[methodIndex + 1], fixture.method, `${fixture.name} method`);
    }
    if (fixture.variable) {
      assert.ok(calls[0].args.includes(fixture.variable), `${fixture.name} exact node variable`);
    }
    if (fixture.input) {
      assert.deepEqual(JSON.parse(calls[0].options.input), fixture.input, `${fixture.name} input`);
    }
    assert.equal(result.mutationCount, 1, `${fixture.name} receipt count`);
  }
});

test('live metadata preflight derives credential permission and the exact pull-request state', () => {
  const request = metadataRequest();
  const calls = [];
  const live = collectLiveCollaborationState(request, {
    now: () => new Date('2026-08-27T01:00:05.000Z'),
    runner(command, args) {
      calls.push({ command, args });
      if (args.includes('graphql')) {
        return JSON.stringify({
          data: {
            viewer: { login: 'maintainer' },
            repository: { viewerPermission: 'WRITE' },
          },
        });
      }
      if (args.includes('repos/Proto-UI/Proto-UI/pulls/509')) {
        return JSON.stringify({
          number: 509,
          node_id: 'PR_node',
          html_url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
          state: 'open',
          user: { login: 'contributor' },
          updated_at: UPDATED_AT,
          head: { sha: HEAD },
          title: 'Old title',
          body: 'Old body',
          milestone: null,
          assignees: [],
          labels: [{ name: 'governed' }],
        });
      }
      throw new Error(`unexpected fake GitHub call: ${args.join(' ')}`);
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(live.viewerLogin, 'maintainer');
  assert.equal(live.viewerPermission, 'WRITE');
  assert.equal(live.current.headSha, HEAD);
  assert.deepEqual(live.current.labels, ['governed']);
  assert.equal(live.current.desiredLabelsExist, true);
});

test('live review-request preflight collects every commit contributor identity', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'request-independent-review',
    expected: { requestedReviewerLogins: [] },
    desired: { reviewerLogin: 'independent-reviewer' },
  });
  const calls = [];
  const live = collectLiveCollaborationState(request, {
    now: () => new Date('2026-08-27T01:00:05.000Z'),
    runner(command, args) {
      calls.push({ command, args });
      if (args.includes('graphql')) {
        return JSON.stringify({
          data: {
            viewer: { login: 'maintainer' },
            repository: { viewerPermission: 'WRITE' },
          },
        });
      }
      if (args.includes('repos/Proto-UI/Proto-UI/pulls/509')) {
        return JSON.stringify({
          number: 509,
          node_id: 'PR_node',
          html_url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
          state: 'open',
          user: { login: 'contributor' },
          updated_at: UPDATED_AT,
          head: { sha: HEAD },
          requested_reviewers: [],
        });
      }
      if (args.some((arg) => arg.includes('/pulls/509/commits?per_page=100'))) {
        assert.ok(args.includes('--paginate'));
        assert.ok(args.includes('--slurp'));
        return JSON.stringify([
          [
            {
              sha: '1'.repeat(40),
              author: { login: 'commit-author' },
              committer: { login: 'commit-committer' },
            },
          ],
          [
            {
              sha: '2'.repeat(40),
              author: { login: 'commit-author' },
              committer: { login: 'second-committer' },
            },
          ],
        ]);
      }
      throw new Error(`unexpected fake GitHub call: ${args.join(' ')}`);
    },
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(live.current.commitContributorLogins, [
    'commit-author',
    'commit-committer',
    'second-committer',
  ]);
  assert.equal(live.current.commitContributorIdentityComplete, true);
});

test('live review-request preflight rejects a malformed commit page without dropping contributors', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'request-independent-review',
    expected: { requestedReviewerLogins: [] },
    desired: { reviewerLogin: 'independent-reviewer' },
  });
  assert.throws(
    () =>
      collectLiveCollaborationState(request, {
        runner(command, args) {
          if (args.includes('graphql')) {
            return JSON.stringify({
              data: {
                viewer: { login: 'maintainer' },
                repository: { viewerPermission: 'WRITE' },
              },
            });
          }
          if (args.includes('repos/Proto-UI/Proto-UI/pulls/509')) {
            return JSON.stringify({
              number: 509,
              node_id: 'PR_node',
              html_url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
              state: 'open',
              user: { login: 'contributor' },
              updated_at: UPDATED_AT,
              head: { sha: HEAD },
              requested_reviewers: [],
            });
          }
          if (args.some((arg) => arg.includes('/pulls/509/commits?per_page=100'))) {
            return JSON.stringify([
              [
                {
                  sha: '1'.repeat(40),
                  author: { login: 'commit-author' },
                  committer: { login: 'commit-committer' },
                },
              ],
              {
                sha: '2'.repeat(40),
                author: { login: 'skipped-contributor' },
                committer: { login: 'second-committer' },
              },
            ]);
          }
          throw new Error(`unexpected fake GitHub call: ${args.join(' ')}`);
        },
      }),
    /commit pagination returned an invalid page/
  );
});

test('comment preflight scans every page and rejects duplicate idempotency markers', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'post-bounded-reconciliation-comment',
    expected: { markerAbsent: true },
    desired: { body: 'Exact-head reconciliation is complete.' },
  });
  const marker = collaborationMarker(request);
  assert.throws(
    () =>
      collectLiveCollaborationState(request, {
        runner(command, args) {
          if (args.includes('graphql')) {
            return JSON.stringify({
              data: {
                viewer: { login: 'maintainer' },
                repository: { viewerPermission: 'WRITE' },
              },
            });
          }
          if (args.includes('repos/Proto-UI/Proto-UI/pulls/509')) {
            return JSON.stringify({
              number: 509,
              node_id: 'PR_node',
              html_url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
              state: 'open',
              user: { login: 'contributor' },
              updated_at: UPDATED_AT,
              head: { sha: HEAD },
            });
          }
          if (args.some((arg) => arg.includes('/issues/509/comments?per_page=100'))) {
            assert.ok(args.includes('--paginate'));
            assert.ok(args.includes('--slurp'));
            return JSON.stringify([
              [{ id: 1, body: `first\n${marker}` }],
              [{ id: 2, body: `second\n${marker}` }],
            ]);
          }
          throw new Error(`unexpected fake GitHub call: ${args.join(' ')}`);
        },
      }),
    /multiple comments use the exact collaboration marker/
  );
});
