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
  desiredCollaborationStateSatisfied,
  validateCollaborationHandoffBinding,
  validateCollaborationReceipt,
  validateCollaborationRequest,
} from '../collaboration-runtime.mjs';
import {
  CollaborationMutationUnknown,
  applyGitHubCollaborationMutation as applyMutationWithContext,
  collectLiveCollaborationState,
} from '../collect-live-collaboration-state.mjs';
import { parseCollaborationCli, runCollaborationCli } from '../collaboration-packet.mjs';
import { collectThreadRevision } from '../thread-revision.mjs';

const HEAD = 'a'.repeat(40);
const NEXT_HEAD = 'b'.repeat(40);
const BASE = 'c'.repeat(40);
const REQUESTED_AT = '2026-08-27T01:00:00.000Z';
const UPDATED_AT = '2026-08-27T00:59:00.000Z';
const THREAD_COMMENTS = [
  { databaseId: 1, author: { login: 'reviewer' }, body: 'Finding', updatedAt: UPDATED_AT },
];
const THREAD_REVISION = collectThreadRevision({
  id: 'PRRT_thread',
  comments: { nodes: THREAD_COMMENTS, pageInfo: { hasNextPage: false } },
}).threadRevisionDigest;

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

function applyGitHubCollaborationMutation(request, preState, options = {}) {
  return applyMutationWithContext(request, preState, {
    authorizationContext: {
      executionMode: 'human-assisted',
      executionModeSource: 'current-user',
      policy,
      selfAssessment: assessment,
    },
    ...options,
  });
}

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
    authorizationId: 'explicit-current-user',
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
        type: 'current-user-instruction',
        reference: 'instruction://current-user/pr-509',
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
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    policy,
    selfAssessment: assessment,
    ...overrides,
  });
}

function assertUnknownComment(callback, request, acknowledgementReceived, reason) {
  let caught;
  assert.throws(callback, (error) => {
    caught = error;
    assert.ok(error instanceof CollaborationMutationUnknown);
    assert.equal(error.name, 'CollaborationMutationUnknown');
    assert.deepEqual(error.result, {
      schemaVersion: 1,
      kind: 'proto-ui.collaboration-unknown',
      repositoryId: request.repositoryId,
      authorizationId: request.authorizationId,
      action: request.action,
      requestDigest: request.requestDigest,
      target: request.target,
      actor: 'maintainer',
      outcome: 'unknown',
      writeAttempts: 1,
      acknowledgementReceived,
      reconciliationReadAttempts: 1,
      reason,
      message:
        'The comment write outcome is unknown; do not retry blindly. Re-inspect the exact target before deciding any later action.',
    });
    assert.throws(() => validateCollaborationReceipt(error.result, request));
    return true;
  });
  return caught;
}

test('request digest binds every purpose and rejects tampering', () => {
  const request = metadataRequest();
  assert.equal(validateCollaborationRequest(request), request);
  assert.throws(
    () => validateCollaborationRequest({ ...request, rationale: 'Changed after signing.' }),
    /requestDigest does not match/
  );
});

function autonomousRequest(overrides = {}) {
  return metadataRequest({
    authorizationId: 'proto-ui-scheduled-collaboration-v1',
    evidence: [
      {
        type: 'governed-outcome',
        reference: 'artifact://governed-outcome/pr-509',
        digest: `sha256:${'e'.repeat(64)}`,
      },
    ],
    ...overrides,
  });
}

function authorizeAutonomous(request, live, overrides = {}) {
  return authorize(request, live, {
    executionMode: 'autonomous',
    executionModeSource: 'schedule',
    ...overrides,
  });
}

test('autonomous collaboration requires the exact active scope and a fresh C2 task ceiling', () => {
  const request = autonomousRequest();
  const live = metadataLive();
  const staleAssessment = {
    ...assessment,
    fresh: false,
  };
  assert.deepEqual(authorizeAutonomous(request, live, { selfAssessment: staleAssessment }), {
    allowed: false,
    outcome: 'rejected',
    reason: 'autonomous collaboration requires a fresh validated self-assessment',
    requestDigest: request.requestDigest,
  });
  const wrongScope = seal({ ...request, authorizationId: 'some-other-scope' });
  assert.match(authorizeAutonomous(wrongScope, live).reason, /active standing authorization/);
});

test('standing authorization still requires purpose evidence for the current governed outcome', () => {
  const request = seal({ ...autonomousRequest(), evidence: [] });
  const decision = authorizeAutonomous(request, metadataLive());
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /current governed outcome/);
});

for (const evidenceKind of ['missing-digest', 'caller-sealed']) {
  test(`an activated standing scope rejects unverified governed-outcome evidence: ${evidenceKind}`, () => {
    const request =
      evidenceKind === 'missing-digest'
        ? autonomousRequest({
            evidence: [{ type: 'governed-outcome', reference: 'artifact://unverified/outcome' }],
          })
        : autonomousRequest();
    assert.equal(authorizeAutonomous(request, metadataLive()).allowed, false);
  });
}

test('an autonomous handoff cannot omit its governed-outcome artifact and publication binding', () => {
  const request = autonomousRequest();
  const result = { ...assessment, resultDigest: 'f'.repeat(64) };
  const handoff = {
    executionMode: 'autonomous',
    artifacts: [
      {
        type: 'collaboration-request',
        reference: 'artifact://collaboration/pr-509',
        digest: `sha256:${request.requestDigest}`,
      },
      { type: 'mutation-authorization', reference: request.authorizationId },
      {
        type: 'capability-envelope',
        reference: 'artifact://assessment/current',
        digest: `sha256:${result.resultDigest}`,
      },
    ],
  };
  assert.throws(
    () => validateCollaborationHandoffBinding(request, handoff, { selfAssessment: result }),
    /governed-outcome|publication/
  );
  handoff.artifacts.push(structuredClone(request.evidence[0]));
  assert.throws(
    () => validateCollaborationHandoffBinding(request, handoff, { selfAssessment: result }),
    /trusted governed-outcome publication verification is not implemented/
  );
});

test('all seven autonomous writers stay blocked even after scope activation and caller sealing', () => {
  const cases = [
    { request: metadataRequest(), before: metadataLive().current },
    ...nonMetadataMutationCases(),
  ];
  for (const fixture of cases) {
    const request = seal({
      ...fixture.request,
      authorizationId: 'proto-ui-scheduled-collaboration-v1',
      evidence: [
        ...fixture.request.evidence.filter(
          (entry) => !['current-user-instruction', 'governed-outcome'].includes(entry.type)
        ),
        ...autonomousRequest().evidence,
      ],
    });
    const live = { ...metadataLive(), action: request.action, current: fixture.before };
    const decision = authorizeAutonomous(request, live);
    assert.equal(decision.allowed, false, request.action);
    assert.match(
      decision.reason,
      /trusted governed-outcome publication verification is not implemented/
    );
    let calls = 0;
    assert.throws(
      () =>
        applyMutationWithContext(request, live, {
          authorizationContext: {
            executionMode: 'autonomous',
            executionModeSource: 'schedule',
            policy,
            selfAssessment: assessment,
          },
          runner() {
            calls += 1;
            throw new Error('unexpected external runner');
          },
          collectState() {
            calls += 1;
            throw new Error('unexpected live read');
          },
        }),
      /trusted governed-outcome publication verification is not implemented/
    );
    assert.equal(calls, 0);
  }
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

test('metadata authorization permits TRIAGE only for reversible metadata fields', () => {
  const base = metadataRequest();
  const triageRequest = seal({
    ...base,
    desired: {
      ...base.desired,
      title: base.expected.title,
      labels: ['governed', 'triaged'],
    },
    rationale: 'Apply reversible triage metadata without editing governed prose.',
  });
  const triageLive = {
    ...metadataLive(),
    viewerPermission: 'TRIAGE',
  };

  assert.equal(authorize(triageRequest, triageLive).outcome, 'mutate');
  assert.match(
    authorize(triageRequest, { ...triageLive, viewerPermission: 'READ' }).reason,
    /triage permission/
  );
  assert.match(authorize(base, triageLive).reason, /write permission/);
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
      ...base.evidence,
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

test('workflow rerun requests reject successful outcomes before live authorization', () => {
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
      workflowName: 'CI',
      workflowPath: '.github/workflows/ci.yml',
    },
    expected: { status: 'completed', conclusion: 'success' },
    desired: { mode: 'all' },
    evidence: [
      ...base.evidence,
      { type: 'ci-diagnosis', reference: 'artifact://ci/1234/diagnosis' },
    ],
    rationale: 'A successful run must not be rerun as diagnosed failure recovery.',
  });

  assert.throws(() => validateCollaborationRequest(request), /failure conclusion/);
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
      threadRevisionDigest: THREAD_REVISION,
    },
    expected: { isResolved: false },
    desired: { isResolved: true },
    evidence: [],
    rationale: 'Resolve the exact thread after its finding is fixed.',
  };
  request.requestDigest = computeCollaborationRequestDigest(request);
  assert.throws(() => validateCollaborationRequest(request), /resolution evidence/);
});
test('thread collection binds the GraphQL node to the exact pull request', () => {
  const request = seal({
    ...metadataRequest(),
    action: 'resolve-fixed-review-thread',
    target: {
      kind: 'review-thread',
      number: 509,
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      threadId: 'PRRT_thread',
      threadUpdatedAt: UPDATED_AT,
      threadRevisionDigest: THREAD_REVISION,
    },
    expected: { isResolved: false },
    desired: { isResolved: true },
    evidence: [{ type: 'review-thread-resolution', reference: 'artifact://review-thread/fix' }],
    rationale: 'Resolve the exact fixed thread revision.',
  });
  const response = (repository = 'Proto-UI/Proto-UI') => ({
    data: {
      node: {
        id: 'PRRT_thread',
        isResolved: false,
        isOutdated: false,
        pullRequest: {
          number: 509,
          updatedAt: UPDATED_AT,
          headRefOid: HEAD,
          state: 'OPEN',
          author: { login: 'contributor' },
          repository: { nameWithOwner: repository },
        },
        comments: {
          nodes: THREAD_COMMENTS,
          pageInfo: { hasNextPage: false },
        },
      },
    },
  });
  const runner = (command, args) => {
    const query = args.find((arg) => arg.startsWith('query=')) ?? '';
    if (query.includes('ProtoUiCollaborationViewer')) {
      return JSON.stringify({
        data: { viewer: { login: 'maintainer' }, repository: { viewerPermission: 'WRITE' } },
      });
    }
    return JSON.stringify(response());
  };
  const live = collectLiveCollaborationState(request, { runner });
  assert.deepEqual(live.current, {
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
    threadRevisionDigest: THREAD_REVISION,
    isResolved: false,
    isOutdated: false,
  });
  assert.throws(
    () =>
      collectLiveCollaborationState(request, {
        runner(command, args) {
          const query = args.find((arg) => arg.startsWith('query=')) ?? '';
          if (query.includes('ProtoUiCollaborationViewer')) return runner(command, args);
          return JSON.stringify(response('Proto-UI/Other'));
        },
      }),
    /does not bind to the exact pull request/
  );
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
      threadRevisionDigest: THREAD_REVISION,
    },
    expected: { isResolved: false },
    desired: { isResolved: true },
    evidence: [
      ...base.evidence,
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
    threadRevisionDigest: THREAD_REVISION,
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

test('a thread reply racing the resolution stays at one write and reports the race read-only', () => {
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
      threadRevisionDigest: THREAD_REVISION,
    },
    expected: { isResolved: false },
    desired: { isResolved: true },
    evidence: [
      ...base.evidence,
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
    threadRevisionDigest: THREAD_REVISION,
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
  const mutations = [];
  let collections = 0;
  let failure;
  try {
    applyGitHubCollaborationMutation(request, preState, {
      runner(command, args, options) {
        mutations.push(options?.input ? JSON.parse(options.input).query : args.join(' '));
        return JSON.stringify({
          data: { resolveReviewThread: { thread: { id: 'PRRT_thread', isResolved: true } } },
        });
      },
      collectState() {
        collections += 1;
        // Boundary revalidation sees the authorized revision; the race lands
        // between the boundary check and the resolve mutation.
        return collections === 1 ? preState : racedState;
      },
    });
    assert.fail('a raced post-write verification must fail closed');
  } catch (error) {
    failure = error;
  }
  assert.match(failure.message, /desired state was not verified.*do not retry blindly/);
  // PR509-COLLAB-MUTATION-COUNT-001: one purpose-bound request attempts at
  // most its single authorized mutation; the raced state is reported through
  // read-only reconciliation and any compensation needs a separate request.
  assert.equal(mutations.length, 1);
  assert.match(mutations[0], /resolveReviewThread/);
  assert.ok(
    !mutations.some((mutation) => /unresolveReviewThread/.test(mutation)),
    'an unrequested compensating unresolve mutation must not be issued'
  );
  assert.equal(failure.raced, true);
  assert.match(failure.message, /separately authorized exact-target request/);
  assert.match(failure.message, /2026-08-27T01:00:09.000Z/);
});

test('a push racing ready-for-review stays at one write and reports the race read-only', () => {
  const base = metadataRequest();
  const request = seal({
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
    isDraft: true,
  };
  const preState = { ...metadataLive(), action: request.action, current };
  const racedState = {
    ...preState,
    current: { ...current, headSha: NEXT_HEAD, isDraft: false },
  };
  const mutations = [];
  let collections = 0;
  assert.throws(
    () =>
      applyGitHubCollaborationMutation(request, preState, {
        runner(command, args, options) {
          mutations.push(options?.input ? JSON.parse(options.input).query : args.join(' '));
          return JSON.stringify({
            data: {
              markPullRequestReadyForReview: {
                pullRequest: {
                  id: 'PR_node',
                  isDraft: false,
                  updatedAt: UPDATED_AT,
                  headRefOid: HEAD,
                },
              },
            },
          });
        },
        collectState() {
          collections += 1;
          return collections === 1 ? preState : racedState;
        },
      }),
    /desired state was not verified.*do not retry blindly/
  );
  // PR509-COLLAB-MUTATION-COUNT-001: no unrequested compensating write.
  assert.equal(mutations.length, 1);
  assert.match(mutations[0], /markPullRequestReadyForReview/);
  assert.ok(
    !mutations.some((mutation) => /convertPullRequestToDraft/.test(mutation)),
    'an unrequested compensating draft conversion must not be issued'
  );
});

test('metadata PATCH fails closed when the target drifts at the mutation boundary', () => {
  const request = metadataRequest();
  const preState = metadataLive();
  let writes = 0;
  assert.throws(
    () =>
      applyGitHubCollaborationMutation(request, preState, {
        runner() {
          writes += 1;
          return JSON.stringify({});
        },
        collectState() {
          return metadataLive({ updatedAt: '2026-08-27T01:00:09.000Z' });
        },
      }),
    /desired state was not verified before mutation.*do not retry blindly/
  );
  assert.equal(writes, 0);
});

for (const [name, change] of [
  ['head', (live) => (live.current.headSha = NEXT_HEAD)],
  ['title', (live) => (live.current.title = 'Concurrent title')],
  ['body', (live) => (live.current.body = 'Concurrent body')],
  ['labels', (live) => (live.current.labels = ['concurrent-label'])],
  ['assignees', (live) => (live.current.assignees = ['another-maintainer'])],
  ['milestone', (live) => (live.current.milestoneNumber = 2)],
  ['closed target', (live) => (live.current.state = 'CLOSED')],
  ['target node', (live) => (live.current.nodeId = 'PR_replacement')],
  ['target number', (live) => (live.current.number = 510)],
  ['viewer identity', (live) => (live.viewerLogin = 'another-maintainer')],
  ['viewer permission', (live) => (live.viewerPermission = 'READ')],
  ['desired label availability', (live) => (live.current.desiredLabelsExist = false)],
]) {
  test(`metadata PATCH rejects ${name} drift even when updatedAt is unchanged`, () => {
    const request = metadataRequest();
    const preState = metadataLive();
    const latestState = structuredClone(preState);
    change(latestState);
    assert.equal(latestState.current.updatedAt, preState.current.updatedAt);
    let writes = 0;
    assert.throws(() =>
      applyGitHubCollaborationMutation(request, preState, {
        runner() {
          writes += 1;
          return JSON.stringify({});
        },
        collectState() {
          return latestState;
        },
      })
    );
    assert.equal(writes, 0, 'changed live state must be rejected before the mutation runner');
  });
}

test('review requests revalidate identity and exact-head state before writing', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'request-independent-review',
    expected: { requestedReviewerLogins: [] },
    desired: { reviewerLogin: 'independent-reviewer' },
    rationale: 'Request an independent exact-head review.',
  });
  const preState = {
    ...metadataLive(),
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
      requestedReviewerLogins: [],
      commitContributorLogins: ['commit-author', 'commit-committer'],
      commitContributorIdentityComplete: true,
    },
  };
  const races = [
    { name: 'head', state: { current: { ...preState.current, headSha: NEXT_HEAD } } },
    {
      name: 'updatedAt',
      state: { current: { ...preState.current, updatedAt: '2026-08-27T01:00:09.000Z' } },
    },
    {
      name: 'requested reviewers',
      state: { current: { ...preState.current, requestedReviewerLogins: ['other-reviewer'] } },
    },
    {
      name: 'contributors',
      state: {
        current: {
          ...preState.current,
          commitContributorLogins: [...preState.current.commitContributorLogins, 'new-contributor'],
        },
      },
    },
    {
      name: 'contributor completeness',
      state: { current: { ...preState.current, commitContributorIdentityComplete: false } },
    },
    { name: 'author', state: { current: { ...preState.current, authorLogin: 'new-author' } } },
    { name: 'viewer', state: { viewerLogin: 'different-maintainer' } },
  ];

  for (const race of races) {
    let writes = 0;
    const racedState = {
      ...preState,
      ...race.state,
    };
    assert.throws(
      () =>
        applyGitHubCollaborationMutation(request, preState, {
          runner() {
            writes += 1;
            return JSON.stringify({});
          },
          collectState() {
            return racedState;
          },
        }),
      /desired state was not verified before mutation.*do not retry blindly/,
      race.name
    );
    assert.equal(writes, 0, `${race.name} race must fail before any write`);
  }
});

test('review requests perform mutation-boundary collection before their single write', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'request-independent-review',
    expected: { requestedReviewerLogins: [] },
    desired: { reviewerLogin: 'independent-reviewer' },
    rationale: 'Request an independent exact-head review.',
  });
  const preState = {
    ...metadataLive(),
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
      requestedReviewerLogins: [],
      commitContributorLogins: ['commit-author', 'commit-committer'],
      commitContributorIdentityComplete: true,
    },
  };
  const postState = {
    ...preState,
    current: {
      ...preState.current,
      updatedAt: '2026-08-27T01:00:10.000Z',
      requestedReviewerLogins: ['independent-reviewer'],
    },
  };
  const events = [];
  let collections = 0;

  const result = applyGitHubCollaborationMutation(request, preState, {
    runner() {
      events.push('write');
      return JSON.stringify({ number: 509, node_id: 'PR_node' });
    },
    collectState() {
      events.push('read');
      collections += 1;
      return collections === 1 ? preState : postState;
    },
  });

  assert.deepEqual(events, ['read', 'write', 'read']);
  assert.equal(result.mutationCount, 1);
});

test('metadata PATCH sends only fields whose desired values changed', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    desired: {
      ...base.expected,
      labels: ['governed', 'triaged'],
    },
    rationale: 'Apply one reversible metadata change.',
  });
  const preState = metadataLive();
  const postState = metadataLive({
    labels: ['governed', 'triaged'],
    updatedAt: '2026-08-27T01:00:10.000Z',
  });
  let input;
  let collections = 0;

  applyGitHubCollaborationMutation(request, preState, {
    runner(_command, _args, options) {
      input = JSON.parse(options.input);
      return JSON.stringify({ number: 509, node_id: 'PR_node' });
    },
    collectState() {
      collections += 1;
      return collections === 1 ? preState : postState;
    },
  });

  assert.deepEqual(input, { labels: ['governed', 'triaged'] });
});

test('mutation adapter performs exactly one write and one post-write verification', () => {
  const request = metadataRequest();
  const preState = metadataLive();
  const calls = [];
  const postState = metadataLive({
    title: 'New title',
    updatedAt: '2026-08-27T01:00:10.000Z',
  });
  let collections = 0;
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
      collections += 1;
      return collections === 1 ? preState : postState;
    },
  });
  assert.equal(calls.filter((call) => call.command === 'gh').length, 1);
  assert.equal(calls.filter((call) => call.collect).length, 2);
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
          // First read is the mutation-boundary revalidation; the failed write
          // then reconciles exactly once.
          return reconciliations === 1 ? metadataLive() : metadataLive({ title: 'New title' });
        },
      }),
    /ambiguous after one live reconciliation.*do not retry blindly/
  );
  assert.equal(writes, 1);
  assert.equal(reconciliations, 2);
});

test('an unknown comment POST stays ambiguous even when the same credential publishes the exact request', () => {
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
    observedAt: '2026-08-27T01:00:11.000Z',
    current: {
      ...current,
      updatedAt: '2026-08-27T01:00:10.000Z',
      markerComment: {
        id: '9001',
        authorLogin: 'maintainer',
        nodeId: 'IC_node',
        url: 'https://github.com/Proto-UI/Proto-UI/pull/509#issuecomment-9001',
        createdAt: '2026-08-27T01:00:09.000Z',
        body: `Exact-head reconciliation is complete.\n\n${marker}`,
      },
    },
  };
  let writes = 0;
  let reconciliations = 0;
  assertUnknownComment(
    () =>
      applyGitHubCollaborationMutation(request, preState, {
        runner() {
          writes += 1;
          throw new Error('socket closed');
        },
        collectState() {
          if (writes === 0) return preState;
          reconciliations += 1;
          return postState;
        },
      }),
    request,
    false,
    'comment-post-response-unavailable'
  );
  assert.equal(writes, 1);
  assert.equal(reconciliations, 1);
});
test('bounded comment idempotency requires the complete canonical body', () => {
  const base = metadataRequest();
  const request = seal({
    ...base,
    action: 'post-bounded-reconciliation-comment',
    target: base.target,
    expected: { markerAbsent: true },
    desired: { body: 'Exact-head reconciliation is complete.' },
  });
  const marker = collaborationMarker(request);
  const live = {
    ...metadataLive(),
    action: request.action,
    current: {
      ...metadataLive().current,
      markerComment: {
        id: '9002',
        nodeId: 'IC_node',
        url: 'https://github.com/Proto-UI/Proto-UI/pull/509#issuecomment-9002',
        createdAt: '2026-08-27T01:00:09.000Z',
        body: `Exact-head reconciliation is complete.\nadditional text\n\n${marker}`,
      },
    },
  };
  assert.equal(desiredCollaborationStateSatisfied(request, live), false);
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
  for (const updatedAt of [UPDATED_AT, live.current.updatedAt]) {
    const staleSatisfied = {
      ...live,
      current: { ...live.current, updatedAt, containsBaseSha: true },
    };
    const staleDecision = authorize(request, staleSatisfied);
    assert.equal(staleDecision.allowed, false);
    assert.match(staleDecision.reason, /head SHA is stale/);
    let writes = 0;
    const preState = {
      ...live,
      current: { ...live.current, updatedAt: UPDATED_AT, headSha: HEAD },
    };
    assert.throws(
      () =>
        applyGitHubCollaborationMutation(request, preState, {
          collectState: () => staleSatisfied,
          runner() {
            writes += 1;
            throw new Error('stale head must not write');
          },
        }),
      /head SHA is stale/
    );
    assert.equal(writes, 0);
  }
  const satisfied = authorize(request, {
    ...live,
    current: { ...live.current, headSha: HEAD, containsBaseSha: true },
  });
  assert.equal(satisfied.outcome, 'no-op');
});

test('update-branch post-write state requires ancestry from the requested head and base', () => {
  const fixture = nonMetadataMutationCases().find((item) => item.name === 'update branch');
  const postState = {
    ...metadataLive(),
    action: fixture.request.action,
    current: {
      ...fixture.before,
      ...fixture.after,
      containsRequestedHeadSha: true,
    },
  };
  assert.equal(desiredCollaborationStateSatisfied(fixture.request, postState), true);
  for (const containsRequestedHeadSha of [false, undefined, null, 'true']) {
    assert.equal(
      desiredCollaborationStateSatisfied(fixture.request, {
        ...postState,
        current: { ...postState.current, containsRequestedHeadSha },
      }),
      false,
      `a replacement head requires verified requested-head ancestry: ${containsRequestedHeadSha}`
    );
  }
  assert.equal(
    desiredCollaborationStateSatisfied(fixture.request, {
      ...postState,
      current: { ...postState.current, containsBaseSha: false },
    }),
    false
  );
});

test('update-branch rejects an unrelated replacement head after one PUT and bounded reads', () => {
  const fixture = nonMetadataMutationCases().find((item) => item.name === 'update branch');
  const preState = { ...metadataLive(), action: fixture.request.action, current: fixture.before };
  const postState = {
    ...preState,
    current: {
      ...fixture.before,
      ...fixture.after,
      containsRequestedHeadSha: false,
    },
  };
  let reads = 0;
  let writes = 0;
  let waits = 0;
  assert.throws(
    () =>
      applyGitHubCollaborationMutation(fixture.request, preState, {
        runner(command, args, options) {
          writes += 1;
          assert.equal(command, 'gh');
          assert.ok(args.includes(fixture.endpoint));
          assert.equal(args[args.indexOf('--method') + 1], 'PUT');
          assert.deepEqual(JSON.parse(options.input), { expected_head_sha: HEAD });
          return fixture.response;
        },
        collectState() {
          reads += 1;
          return reads === 1 ? preState : postState;
        },
        asyncVerificationAttempts: 3,
        wait() {
          waits += 1;
        },
      }),
    /bounded post-write verification polling.*do not retry blindly/
  );
  assert.equal(writes, 1);
  assert.equal(reads, 4);
  assert.equal(waits, 2);
});

test('update-branch unknown outcome remains ambiguous even with both ancestries verified', () => {
  const fixture = nonMetadataMutationCases().find((item) => item.name === 'update branch');
  const preState = { ...metadataLive(), action: fixture.request.action, current: fixture.before };
  let reads = 0;
  let writes = 0;
  assert.throws(
    () =>
      applyGitHubCollaborationMutation(fixture.request, preState, {
        runner() {
          writes += 1;
          throw new Error('connection reset after request body was sent');
        },
        collectState() {
          reads += 1;
          return writes === 0
            ? preState
            : {
                ...preState,
                current: {
                  ...fixture.before,
                  ...fixture.after,
                  containsRequestedHeadSha: true,
                },
              };
        },
        wait() {
          assert.fail('an unknown outcome permits one reconciliation, not polling');
        },
      }),
    /ambiguous after one live reconciliation.*do not retry blindly/
  );
  assert.equal(writes, 1);
  assert.equal(reads, 2);
});

test('live update-branch collection compares both requested ancestors with the observed head', () => {
  const fixture = nonMetadataMutationCases().find((item) => item.name === 'update branch');
  for (const [headSha, comparisonStatus, containsRequestedHeadSha] of [
    [HEAD, null, true],
    [NEXT_HEAD, 'ahead', true],
    [NEXT_HEAD, 'diverged', false],
    [NEXT_HEAD, 'behind', false],
    [NEXT_HEAD, undefined, false],
  ]) {
    const comparisons = [];
    const live = collectLiveCollaborationState(fixture.request, {
      runner(command, args) {
        assert.equal(command, 'gh');
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
            state: 'open',
            user: { login: 'contributor' },
            updated_at: UPDATED_AT,
            head: { sha: headSha },
            base: { sha: BASE },
            maintainer_can_modify: true,
          });
        }
        const endpoint = args[1];
        comparisons.push(endpoint);
        if (endpoint === `repos/Proto-UI/Proto-UI/compare/${BASE}...${headSha}`)
          return JSON.stringify({ status: 'ahead' });
        if (endpoint === `repos/Proto-UI/Proto-UI/compare/${HEAD}...${headSha}`)
          return JSON.stringify({ status: comparisonStatus });
        throw new Error(`unexpected fake GitHub call: ${args.join(' ')}`);
      },
    });
    assert.equal(live.current.containsBaseSha, true);
    assert.equal(live.current.containsRequestedHeadSha, containsRequestedHeadSha);
    assert.deepEqual(comparisons, [
      `repos/Proto-UI/Proto-UI/compare/${BASE}...${headSha}`,
      ...(headSha === HEAD ? [] : [`repos/Proto-UI/Proto-UI/compare/${HEAD}...${headSha}`]),
    ]);
  }
});

for (const delayedAncestry of ['containsBaseSha', 'containsRequestedHeadSha']) {
  test(`update-branch polls until the new head and delayed ${delayedAncestry} are visible`, () => {
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
      containsRequestedHeadSha: true,
      maintainerCanModify: true,
    };
    const preState = { ...metadataLive(), action: request.action, current };
    const states = [
      preState, // Final authorization read precedes bounded post-write polling.
      preState,
      {
        ...preState,
        current: {
          ...current,
          headSha: NEXT_HEAD,
          containsBaseSha: true,
          [delayedAncestry]: false,
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

    assert.equal(reads, 4);
    assert.deepEqual(waits, [25, 25]);
    assert.equal(result.mutationCount, 1);
    assert.equal(result.reconciliationCount, 0);
    assert.equal(result.postState.current.headSha, NEXT_HEAD);
    assert.equal(result.postState.current.containsBaseSha, true);
    assert.equal(result.postState.current.containsRequestedHeadSha, true);
  });
}

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
            if (reads === 1) return preState;
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
    assert.equal(reads, 2);
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
  assert.equal(reads, 4);
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

for (const scenario of [
  {
    name: 'an idempotent human-assisted request',
    kind: 'no-op',
    states: [metadataLive({ title: 'New title', updatedAt: '2026-08-27T01:00:09.000Z' })],
  },
  {
    name: 'desired state achieved before the final write',
    kind: 'no-op',
    states: [
      metadataLive(),
      metadataLive({ title: 'New title', updatedAt: '2026-08-27T01:00:09.000Z' }),
    ],
  },
  {
    name: 'initial authorization rejection',
    kind: 'rejected',
    states: [metadataLive({ state: 'CLOSED' })],
  },
  {
    name: 'final authorization rejection',
    kind: 'rejected',
    states: [
      metadataLive(),
      metadataLive({ state: 'CLOSED', updatedAt: '2026-08-27T01:00:09.000Z' }),
    ],
  },
]) {
  test(`collaboration CLI emits a validated zero-write receipt for ${scenario.name}`, () => {
    const request = seal({
      ...metadataRequest(),
      authorizationId: 'explicit-current-user',
      evidence: [{ type: 'current-user-instruction', reference: 'conversation://current-request' }],
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
      let reads = 0;
      let writes = 0;
      const output = runCollaborationCli(
        [
          'apply',
          '--mode',
          'human-assisted',
          '--mode-source',
          'current-user',
          '--request',
          requestPath,
          '--handoff',
          handoffPath,
        ],
        {
          collectState() {
            return scenario.states[Math.min(reads++, scenario.states.length - 1)];
          },
          runner() {
            writes += 1;
            throw new Error('zero-write path must not invoke the mutation runner');
          },
        }
      );
      validateCollaborationReceipt(output, request);
      assert.equal(output.kind, 'proto-ui.collaboration-receipt');
      assert.equal(output.outcome, scenario.kind);
      assert.equal(output.mutationCount, 0);
      assert.equal(writes, 0);
      assert.equal(output.requestDigest, request.requestDigest);
      if (scenario.states.length > 1)
        assert.notEqual(output.preStateDigest, output.postStateDigest);
      if (scenario.kind === 'rejected') {
        assert.throws(
          () => validateCollaborationReceipt({ ...output, mutationCount: 1 }, request),
          /no-write/
        );
        assert.throws(
          () =>
            validateCollaborationReceipt(
              { ...output, verification: 'live-state-matches-desired' },
              request
            ),
          /rejected verification/
        );
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('the mutation adapter requires execution authorization as well as matching live metadata', () => {
  const request = metadataRequest();
  const preState = metadataLive();
  let writes = 0;
  const options = {
    runner() {
      writes += 1;
      return '{}';
    },
    collectState() {
      return preState;
    },
  };
  assert.throws(
    () => applyMutationWithContext(request, preState, options),
    /execution authorization context/
  );
  assert.throws(
    () =>
      applyMutationWithContext(request, preState, {
        ...options,
        authorizationContext: {
          executionMode: 'human-assisted',
          executionModeSource: 'repository-issue',
          policy,
        },
      }),
    /authorization|source/
  );
  assert.equal(writes, 0);
});

function nonMetadataMutationCases() {
  const base = metadataRequest();
  const commentRequest = seal({
    ...base,
    action: 'post-bounded-reconciliation-comment',
    expected: { markerAbsent: true },
    desired: { body: 'Exact reviewed revision and its remaining gate.' },
    rationale: 'Publish the authorized bounded reconciliation.',
  });
  return [
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
      after: { headSha: NEXT_HEAD, containsBaseSha: true, containsRequestedHeadSha: true },
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
          threadRevisionDigest: THREAD_REVISION,
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
        threadRevisionDigest: THREAD_REVISION,
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
    {
      name: 'post comment',
      request: commentRequest,
      before: {
        kind: 'pull-request',
        number: 509,
        nodeId: 'PR_node',
        url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
        state: 'OPEN',
        authorLogin: 'contributor',
        updatedAt: UPDATED_AT,
        headSha: HEAD,
        markerComment: null,
      },
      after: {
        markerComment: {
          id: '271',
          authorLogin: 'maintainer',
          createdAt: '2026-08-27T01:00:09.000Z',
          nodeId: 'IC_271',
          url: 'https://github.com/Proto-UI/Proto-UI/pull/509#issuecomment-271',
          body: `${commentRequest.desired.body}\n\n${collaborationMarker(commentRequest)}`,
        },
      },
      response: JSON.stringify({
        id: 271,
        node_id: 'IC_271',
        user: { login: 'maintainer' },
        created_at: '2026-08-27T01:00:09.000Z',
        body: `${commentRequest.desired.body}\n\n${collaborationMarker(commentRequest)}`,
      }),
      endpoint: 'repos/Proto-UI/Proto-UI/issues/509/comments',
      method: 'POST',
      input: { body: `${commentRequest.desired.body}\n\n${collaborationMarker(commentRequest)}` },
    },
  ];
}

function runCollaborationFixture(fixture, states) {
  const directory = mkdtempSync(join(tmpdir(), 'proto-ui-collaboration-preflight-'));
  try {
    const request = fixture.request;
    const requestPath = join(directory, 'request.json');
    const handoffPath = join(directory, 'handoff.json');
    writeFileSync(requestPath, JSON.stringify(request));
    writeFileSync(
      handoffPath,
      JSON.stringify({
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
            reference: requestPath,
            digest: `sha256:${request.requestDigest}`,
          },
        ],
        humanGates: [],
        notes: [],
      })
    );
    let reads = 0;
    let writes = 0;
    const receipt = runCollaborationCli(
      [
        'apply',
        '--mode',
        'human-assisted',
        '--mode-source',
        'current-user',
        '--request',
        requestPath,
        '--handoff',
        handoffPath,
      ],
      {
        collectState: () => states[Math.min(reads++, states.length - 1)],
        runner: () => {
          writes += 1;
          return fixture.response;
        },
      }
    );
    validateCollaborationReceipt(receipt, request);
    return { receipt, reads, writes };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

for (const scenario of [
  'initial future request',
  'subsecond future request',
  'clock rollback at final preflight',
  'equal live observation',
]) {
  test(`comment timestamp admission handles ${scenario} before the write`, () => {
    const fixture = nonMetadataMutationCases().find((item) => item.name === 'post comment');
    fixture.request = seal({
      ...fixture.request,
      requestedAt:
        scenario === 'initial future request'
          ? '2026-08-27T01:00:12.000Z'
          : '2026-08-27T01:00:05.000Z',
    });
    const preState = { ...metadataLive(), action: fixture.request.action, current: fixture.before };
    const finalState = structuredClone(preState);
    if (scenario === 'subsecond future request') preState.observedAt = '2026-08-27T01:00:04.999Z';
    if (scenario === 'clock rollback at final preflight')
      finalState.observedAt = '2026-08-27T01:00:04.999Z';
    const postState = {
      ...preState,
      observedAt: '2026-08-27T01:00:11.000Z',
      current: { ...fixture.before, ...structuredClone(fixture.after) },
    };
    postState.current.markerComment.body = `${fixture.request.desired.body}\n\n${collaborationMarker(fixture.request)}`;
    fixture.response = JSON.stringify({
      ...JSON.parse(fixture.response),
      body: postState.current.markerComment.body,
    });
    const { receipt, reads, writes } = runCollaborationFixture(fixture, [
      preState,
      finalState,
      postState,
    ]);
    if (scenario === 'equal live observation') {
      assert.equal(receipt.outcome, 'applied');
      assert.equal(receipt.mutationCount, 1);
      assert.equal(writes, 1);
    } else {
      assert.equal(receipt.outcome, 'rejected');
      assert.equal(receipt.mutationCount, 0);
      assert.equal(writes, 0);
      assert.match(receipt.note, /requestedAt is later than the live preflight observation/);
      assert.equal(reads, scenario === 'clock rollback at final preflight' ? 2 : 1);
    }
  });
}

for (const [name, requestedAt, initialAt, finalAt, expectedOutcome, expectedReads] of [
  [
    'fractional future',
    '2026-08-27T01:00:05.0001Z',
    '2026-08-27T01:00:05.000Z',
    '2026-08-27T01:00:05.000Z',
    'rejected',
    1,
  ],
  [
    'offset fractional future',
    '2026-08-27T02:00:05.0001+01:00',
    '2026-08-27T01:00:05.000Z',
    '2026-08-27T01:00:05.000Z',
    'rejected',
    1,
  ],
  [
    'final fractional rollback',
    '2026-08-27T01:00:05.0001Z',
    '2026-08-27T01:00:05.0002Z',
    '2026-08-27T01:00:05.000Z',
    'rejected',
    2,
  ],
  [
    'equal padded fraction',
    '2026-08-27T01:00:05.0001000Z',
    '2026-08-27T01:00:05.0001Z',
    '2026-08-27T01:00:05.0001Z',
    'applied',
    3,
  ],
  [
    'equal offset instant',
    '2026-08-27T02:00:05.0001+01:00',
    '2026-08-27T01:00:05.000100Z',
    '2026-08-27T01:00:05.000100Z',
    'applied',
    3,
  ],
  [
    'earlier second with longer fraction',
    '2026-08-27T01:00:04.999999Z',
    '2026-08-27T01:00:05.000Z',
    '2026-08-27T01:00:05.000Z',
    'applied',
    3,
  ],
]) {
  test(`comment timestamp admission preserves RFC3339 precision: ${name}`, () => {
    const fixture = nonMetadataMutationCases().find((item) => item.name === 'post comment');
    fixture.request = seal({ ...fixture.request, requestedAt });
    const preState = {
      ...metadataLive(),
      observedAt: initialAt,
      action: fixture.request.action,
      current: fixture.before,
    };
    const finalState = { ...preState, observedAt: finalAt };
    const postState = {
      ...preState,
      observedAt: '2026-08-27T01:00:11.000Z',
      current: { ...fixture.before, ...structuredClone(fixture.after) },
    };
    postState.current.markerComment.body = `${fixture.request.desired.body}\n\n${collaborationMarker(fixture.request)}`;
    fixture.response = JSON.stringify({
      ...JSON.parse(fixture.response),
      body: postState.current.markerComment.body,
    });
    const { receipt, reads, writes } = runCollaborationFixture(fixture, [
      preState,
      finalState,
      postState,
    ]);
    assert.equal(receipt.outcome, expectedOutcome);
    assert.equal(reads, expectedReads);
    assert.equal(writes, expectedOutcome === 'applied' ? 1 : 0);
    assert.equal(receipt.mutationCount, writes);
  });
}

for (const maintainerCanModify of [true, false]) {
  test(`null PR author uses maintainer edit permission ${maintainerCanModify} without throwing`, () => {
    const fixture = nonMetadataMutationCases().find((item) => item.name === 'update branch');
    fixture.before.authorLogin = null;
    fixture.before.maintainerCanModify = maintainerCanModify;
    const preState = { ...metadataLive(), action: fixture.request.action, current: fixture.before };
    const postState = {
      ...preState,
      observedAt: '2026-08-27T01:00:11.000Z',
      current: { ...fixture.before, ...fixture.after },
    };
    const { receipt, writes } = runCollaborationFixture(fixture, [preState, preState, postState]);
    assert.equal(receipt.outcome, maintainerCanModify ? 'applied' : 'rejected');
    assert.equal(receipt.mutationCount, maintainerCanModify ? 1 : 0);
    assert.equal(writes, maintainerCanModify ? 1 : 0);
    if (!maintainerCanModify)
      assert.match(receipt.note, /neither author-owned.*maintainer-editable/);
  });
}

test('missing PR author rejects independent-review requests with a zero-write receipt', () => {
  const fixture = nonMetadataMutationCases().find((item) => item.name === 'request reviewer');
  fixture.before.authorLogin = null;
  const preState = { ...metadataLive(), action: fixture.request.action, current: fixture.before };
  const { receipt, writes } = runCollaborationFixture(fixture, [preState]);
  assert.equal(receipt.outcome, 'rejected');
  assert.equal(receipt.mutationCount, 0);
  assert.equal(writes, 0);
  assert.match(receipt.note, /pull-request author identity is unavailable/);
});

test('each non-metadata collaboration action maps to one exact GitHub mutation primitive', () => {
  const cases = nonMetadataMutationCases();
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
    let collectionCount = 0;
    const result = applyGitHubCollaborationMutation(fixture.request, preState, {
      runner(command, args, options) {
        calls.push({ command, args, options });
        return fixture.response;
      },
      collectState() {
        collectionCount += 1;
        return collectionCount === 1 ? preState : postState;
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

for (const fixture of nonMetadataMutationCases()) {
  const changes = [
    ['viewer identity', (s) => (s.viewerLogin = 'another-actor')],
    ['permission', (s) => (s.viewerPermission = 'READ')],
    ['head', (s) => (s.current.headSha = NEXT_HEAD)],
    ['revision timestamp', (s) => (s.current.updatedAt = '2026-08-27T01:01:00.000Z')],
  ];
  if (fixture.name === 'update branch')
    changes.push(
      ['base', (s) => (s.current.baseSha = 'd'.repeat(40))],
      ['maintainer edit permission', (s) => (s.current.maintainerCanModify = false)],
      ['closed target', (s) => (s.current.state = 'CLOSED')]
    );
  if (fixture.name === 'ready for review')
    changes.push(['closed target', (s) => (s.current.state = 'CLOSED')]);
  if (fixture.name === 'request reviewer')
    changes.push(
      ['incomplete contributors', (s) => (s.current.commitContributorIdentityComplete = false)],
      ['new contributor', (s) => s.current.commitContributorLogins.push('reviewer')],
      ['closed target', (s) => (s.current.state = 'CLOSED')]
    );
  if (fixture.name === 'resolve thread')
    changes.push(
      ['thread identity', (s) => (s.current.threadId = 'PRRT_other')],
      ['closed target', (s) => (s.current.state = 'CLOSED')]
    );
  if (fixture.name === 'post comment')
    changes.push(['closed target', (s) => (s.current.state = 'CLOSED')]);
  if (fixture.name === 'rerun failed jobs')
    changes.push(
      ['earlier attempt', (s) => (s.current.attempt = 0)],
      ['successful result', (s) => (s.current.conclusion = 'success')],
      ['running status', (s) => (s.current.status = 'in_progress')],
      ['workflow identity', (s) => (s.current.workflowName = 'Untrusted workflow')],
      ['head repository', (s) => (s.current.headRepositoryId = 'github.com:Other/Repo')]
    );
  for (const [name, change] of changes) {
    test(`${fixture.name} revalidates ${name} immediately before its single write`, () => {
      const preState = {
        ...metadataLive(),
        action: fixture.request.action,
        current: structuredClone(fixture.before),
      };
      const latest = structuredClone(preState);
      change(latest);
      let writes = 0;
      assert.throws(() =>
        applyGitHubCollaborationMutation(fixture.request, preState, {
          runner() {
            writes += 1;
            return fixture.response;
          },
          collectState() {
            return latest;
          },
          asyncVerificationAttempts: 1,
        })
      );
      assert.equal(writes, 0, 'raced authorization must fail before any mutation');
    });
  }
}

test('workflow rerun verification polls until GitHub exposes the advanced attempt', () => {
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
      workflowName: 'CI',
      workflowPath: '.github/workflows/ci.yml',
    },
    expected: { status: 'completed', conclusion: 'failure' },
    desired: { mode: 'failed-jobs' },
    evidence: [
      ...base.evidence,
      { type: 'ci-diagnosis', reference: 'artifact://ci/1234/diagnosis' },
    ],
  });
  const preState = {
    ...metadataLive(),
    action: request.action,
    current: {
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
  };
  const postState = {
    ...preState,
    observedAt: '2026-08-27T01:00:11.000Z',
    current: { ...preState.current, attempt: 2, status: 'queued', conclusion: null },
  };
  let collections = 0;
  let waits = 0;
  const result = applyGitHubCollaborationMutation(request, preState, {
    runner() {
      return '';
    },
    collectState() {
      collections += 1;
      return collections < 4 ? preState : postState;
    },
    wait() {
      waits += 1;
    },
  });

  assert.equal(result.mutationCount, 1);
  assert.equal(collections, 4);
  assert.equal(waits, 2);
  assert.equal(result.postState.current.attempt, 2);
});

test('rerun receipts do not attribute an attempt jump to the single authorized POST', () => {
  const fixture = nonMetadataMutationCases().find((item) => item.name === 'rerun failed jobs');
  const preState = { ...metadataLive(), action: fixture.request.action, current: fixture.before };
  let writes = 0;
  assert.throws(
    () =>
      applyGitHubCollaborationMutation(fixture.request, preState, {
        runner() {
          writes += 1;
          return '';
        },
        collectState() {
          return writes === 0
            ? preState
            : {
                ...preState,
                current: {
                  ...preState.current,
                  attempt: 3,
                  status: 'completed',
                  conclusion: 'success',
                },
              };
        },
        asyncVerificationAttempts: 1,
      }),
    /attributable next attempt/
  );
  assert.equal(writes, 1);
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

test('live collaboration collection uses a governed output bound and reports overflow', () => {
  const request = metadataRequest();
  const seenOptions = [];
  const runner = (command, args, options) => {
    seenOptions.push(options);
    if (args.includes('graphql')) {
      return JSON.stringify({
        data: { viewer: { login: 'maintainer' }, repository: { viewerPermission: 'WRITE' } },
      });
    }
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
  };

  collectLiveCollaborationState(request, { runner });
  assert.ok(seenOptions.every((options) => options.maxBuffer === 64 * 1024 * 1024));

  assert.throws(
    () =>
      collectLiveCollaborationState(request, {
        runner() {
          const error = new Error('spawnSync gh ENOBUFS');
          error.code = 'ENOBUFS';
          throw error;
        },
      }),
    /documented 67108864-byte payload bound/
  );
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

function collectReviewRequestWithPlatformCommit(change = () => {}) {
  const request = seal({
    ...metadataRequest(),
    action: 'request-independent-review',
    expected: { requestedReviewerLogins: [] },
    desired: { reviewerLogin: 'independent-reviewer' },
  });
  const commit = {
    sha: HEAD,
    author: { login: 'platform-commit-author' },
    committer: null,
    commit: {
      author: { name: 'GitHub', email: 'noreply@github.com' },
      committer: { name: 'GitHub', email: 'noreply@github.com' },
      verification: { verified: true, reason: 'valid' },
    },
  };
  const attestation = {
    data: {
      repository: {
        nameWithOwner: 'Proto-UI/Proto-UI',
        object: {
          __typename: 'Commit',
          oid: HEAD,
          committer: { name: 'GitHub', email: 'noreply@github.com', user: null },
          signature: { __typename: 'GpgSignature', isValid: true, wasSignedByGitHub: true },
        },
      },
    },
  };
  change({ commit, attestation });
  const calls = [];
  const live = collectLiveCollaborationState(request, {
    now: () => new Date('2026-08-27T01:00:05.000Z'),
    runner(command, args) {
      calls.push({ command, args });
      assert.equal(command, 'gh');
      assert.equal(args.includes('--method'), false);
      if (args.some((arg) => arg.includes('ProtoUiCollaborationCommitter'))) {
        assert.ok(args.includes('owner=Proto-UI'));
        assert.ok(args.includes('name=Proto-UI'));
        assert.ok(args.includes(`oid=${HEAD}`));
        const query = args.find((arg) => arg.startsWith('query='));
        assert.match(query, /object\(oid: \$oid\)/);
        assert.match(query, /isValid wasSignedByGitHub/);
        assert.doesNotMatch(query, /\bmutation\b/);
        return JSON.stringify(attestation);
      }
      if (args.includes('graphql')) {
        return JSON.stringify({
          data: { viewer: { login: 'maintainer' }, repository: { viewerPermission: 'WRITE' } },
        });
      }
      if (args.includes('repos/Proto-UI/Proto-UI/pulls/509')) {
        return JSON.stringify({
          number: 509,
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
              sha: BASE,
              author: { login: 'human-author' },
              committer: { login: 'human-committer' },
            },
          ],
          [commit],
        ]);
      }
      throw new Error(`unexpected fake GitHub call: ${args.join(' ')}`);
    },
  });
  return { request, live, calls };
}

test('live review-request preflight accepts an attested GitHub committer and retains human contributors', () => {
  const { request, live, calls } = collectReviewRequestWithPlatformCommit();
  assert.equal(live.current.commitContributorIdentityComplete, true);
  assert.deepEqual(live.current.commitContributorLogins, [
    'human-author',
    'human-committer',
    'platform-commit-author',
  ]);
  assert.equal(authorize(request, live).outcome, 'mutate');
  for (const login of live.current.commitContributorLogins) {
    const contributorRequest = seal({ ...request, desired: { reviewerLogin: login } });
    assert.match(authorize(contributorRequest, live).reason, /commit contributor/);
  }
  assert.equal(calls.length, 4);
});

for (const [name, change] of [
  ['missing author', ({ commit }) => (commit.author = null)],
  [
    'invalid signature',
    ({ attestation }) => (attestation.data.repository.object.signature.isValid = false),
  ],
  [
    'foreign signer',
    ({ attestation }) => (attestation.data.repository.object.signature.wasSignedByGitHub = false),
  ],
  ['missing signature', ({ attestation }) => (attestation.data.repository.object.signature = null)],
  ['missing committer', ({ attestation }) => (attestation.data.repository.object.committer = null)],
  [
    'unattested committer name',
    ({ attestation }) => (attestation.data.repository.object.committer.name = 'Human'),
  ],
  [
    'unattested committer email',
    ({ attestation }) => (attestation.data.repository.object.committer.email = 'human@example.com'),
  ],
  [
    'foreign repository',
    ({ attestation }) => (attestation.data.repository.nameWithOwner = 'other/repository'),
  ],
  ['exact SHA mismatch', ({ attestation }) => (attestation.data.repository.object.oid = NEXT_HEAD)],
  ['missing commit object', ({ attestation }) => (attestation.data.repository.object = null)],
  [
    'wrong object type',
    ({ attestation }) => (attestation.data.repository.object.__typename = 'Tag'),
  ],
  [
    'partial GraphQL errors',
    ({ attestation }) => (attestation.errors = [{ message: 'Unavailable signature' }]),
  ],
]) {
  test(`live review-request preflight fails closed on ${name} despite REST verification`, () => {
    const { request, live } = collectReviewRequestWithPlatformCommit(change);
    assert.equal(live.current.commitContributorIdentityComplete, false);
    assert.ok(live.current.commitContributorLogins.includes('human-author'));
    assert.ok(live.current.commitContributorLogins.includes('human-committer'));
    assert.match(authorize(request, live).reason, /contributor identity is unavailable/);
  });
}

test('live review-request preflight retains a linked committer returned by exact-commit GraphQL', () => {
  const { request, live } = collectReviewRequestWithPlatformCommit(({ attestation }) => {
    attestation.data.repository.object.committer.user = { login: 'linked-committer' };
  });
  assert.equal(live.current.commitContributorIdentityComplete, true);
  assert.ok(live.current.commitContributorLogins.includes('linked-committer'));
  const contributorRequest = seal({ ...request, desired: { reviewerLogin: 'linked-committer' } });
  assert.match(authorize(contributorRequest, live).reason, /commit contributor/);
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

for (const fixture of [
  {
    name: 'metadata',
    request: metadataRequest(),
    before: metadataLive().current,
    after: { title: 'New title' },
  },
  ...nonMetadataMutationCases(),
]) {
  test(`${fixture.name}: a fully authorized final desired state is a zero-write no-op`, () => {
    const preState = { ...metadataLive(), action: fixture.request.action, current: fixture.before };
    const postState = {
      ...preState,
      observedAt: '2026-08-27T01:00:11.000Z',
      // A pre-write no-op must retain the requested head. A successful branch
      // update may publish a new head only after this invocation's write.
      current: { ...fixture.before, ...fixture.after, headSha: fixture.before.headSha },
    };
    let writes = 0;
    const result = applyGitHubCollaborationMutation(fixture.request, preState, {
      collectState: () => postState,
      runner() {
        writes += 1;
        throw new Error('no-op must not write');
      },
    });
    assert.equal(result.mutationCount, 0);
    assert.equal(result.reconciliationCount, 0);
    assert.equal(result.platformObject, null);
    assert.deepEqual(result.postState, postState);
    assert.equal(writes, 0);
    assert.throws(
      () => applyMutationWithContext(fixture.request, postState),
      /execution authorization context/
    );
    assert.throws(
      () =>
        applyGitHubCollaborationMutation(fixture.request, preState, {
          collectState: () => ({ ...postState, viewerLogin: 'another-maintainer' }),
          runner() {
            throw new Error('identity drift must not write');
          },
        }),
      /identity changed|unexpected comment/
    );
  });
}

for (const [name, change] of [
  [
    'wrong actor',
    (comment) => {
      comment.authorLogin = 'other-maintainer';
    },
  ],
  [
    'missing actor',
    (comment) => {
      delete comment.authorLogin;
    },
  ],
  [
    'old timestamp',
    (comment) => {
      comment.createdAt = '2026-08-26T00:00:00.000Z';
    },
  ],
  [
    'missing timestamp',
    (comment) => {
      delete comment.createdAt;
    },
  ],
  [
    'future timestamp',
    (comment) => {
      comment.createdAt = '2026-08-28T00:00:00.000Z';
    },
  ],
  [
    'wrong request marker',
    (comment) => {
      comment.body = comment.body.replace('proto-ui-collaboration:', 'another-request:');
    },
  ],
]) {
  test(`bounded comment idempotency rejects ${name}`, () => {
    const fixture = nonMetadataMutationCases().find((item) => item.name === 'post comment');
    const live = {
      ...metadataLive(),
      observedAt: '2026-08-27T01:00:11.000Z',
      action: fixture.request.action,
      current: { ...fixture.before, ...structuredClone(fixture.after) },
    };
    assert.equal(desiredCollaborationStateSatisfied(fixture.request, live), true);
    change(live.current.markerComment);
    assert.equal(desiredCollaborationStateSatisfied(fixture.request, live), false);
    assert.equal(authorize(fixture.request, live).allowed, false);
  });
}

for (const createdAt of [
  '2026-08-27T00:59:30.000Z',
  '2026-08-27T01:00:01.000Z',
  '2026-08-27T01:01:30.000Z',
  '2026-08-27T02:00:09.0001+01:00',
  '2024-02-29T01:00:09Z',
]) {
  test(`acknowledged comment attribution tolerates server clock skew: ${createdAt}`, () => {
    const fixture = nonMetadataMutationCases().find((item) => item.name === 'post comment');
    const preState = { ...metadataLive(), action: fixture.request.action, current: fixture.before };
    const postState = {
      ...preState,
      observedAt: '2026-08-27T01:00:11.000Z',
      current: { ...fixture.before, ...structuredClone(fixture.after) },
    };
    postState.current.markerComment.createdAt = createdAt;
    fixture.response = JSON.stringify({ ...JSON.parse(fixture.response), created_at: createdAt });
    // The successful POST ID and exact readback bind this invocation. Collector
    // and request clocks are deliberately unchanged and are not server clocks.
    const { receipt, reads, writes } = runCollaborationFixture(fixture, [
      preState,
      preState,
      postState,
    ]);
    assert.equal(receipt.outcome, 'applied');
    assert.equal(receipt.platformObject.id, '271');
    assert.equal(receipt.mutationCount, 1);
    assert.equal(reads, 3);
    assert.equal(writes, 1);
  });
}

for (const [name, change] of [
  [
    'a different comment ID',
    (raw) => {
      raw.id = 999;
    },
  ],
  [
    'a missing comment ID',
    (raw) => {
      delete raw.id;
    },
  ],
  [
    'a different response actor',
    (raw) => {
      raw.user.login = 'other-maintainer';
    },
  ],
  [
    'a missing response actor',
    (raw) => {
      delete raw.user;
    },
  ],
  [
    'a different response timestamp',
    (raw) => {
      raw.created_at = '2026-08-27T01:00:08.000Z';
    },
  ],
  [
    'a missing response timestamp',
    (raw) => {
      delete raw.created_at;
    },
  ],
  [
    'a different response body',
    (raw) => {
      raw.body = 'Different response body';
    },
  ],
  [
    'a missing response body',
    (raw) => {
      delete raw.body;
    },
  ],
  ...['2026-02-30T01:00:09Z', '2026-08-27T24:00:00Z', '2026-08-27 01:00:09Z'].map((createdAt) => [
    `an invalid matching timestamp ${createdAt}`,
    (raw, post) => {
      raw.created_at = post.current.markerComment.createdAt = createdAt;
    },
  ]),
]) {
  test(`successful comment POST cannot be attributed with ${name}`, () => {
    const fixture = nonMetadataMutationCases().find((item) => item.name === 'post comment');
    const preState = { ...metadataLive(), action: fixture.request.action, current: fixture.before };
    const postState = {
      ...preState,
      observedAt: '2026-08-27T01:00:11.000Z',
      current: { ...fixture.before, ...structuredClone(fixture.after) },
    };
    const raw = JSON.parse(fixture.response);
    change(raw, postState);
    let writes = 0;
    assertUnknownComment(
      () =>
        applyGitHubCollaborationMutation(fixture.request, preState, {
          collectState: () => (writes === 0 ? preState : postState),
          runner() {
            writes += 1;
            return JSON.stringify(raw);
          },
        }),
      fixture.request,
      true,
      'comment-post-provenance-unverified'
    );
    assert.equal(writes, 1);
  });
}

for (const [name, change] of [
  ['missing readback', () => null],
  ['malformed readback', () => ({})],
  [
    'read failure',
    () => {
      throw new Error('secret upstream stderr');
    },
  ],
  [
    'changed head',
    (post) => {
      post.current.headSha = NEXT_HEAD;
      return post;
    },
  ],
  [
    'changed target',
    (post) => {
      post.current.number = 510;
      return post;
    },
  ],
  [
    'wrong actor',
    (post) => {
      post.current.markerComment.authorLogin = 'other';
      return post;
    },
  ],
  [
    'missing ID',
    (post) => {
      delete post.current.markerComment.id;
      return post;
    },
  ],
  [
    'wrong body',
    (post) => {
      post.current.markerComment.body = 'another comment';
      return post;
    },
  ],
  [
    'invalid timestamp',
    (post) => {
      post.current.markerComment.createdAt = 'not-a-date';
      return post;
    },
  ],
]) {
  test(`acknowledged comment reports structured unknown for ${name}`, () => {
    const fixture = nonMetadataMutationCases().find((item) => item.name === 'post comment');
    const preState = { ...metadataLive(), action: fixture.request.action, current: fixture.before };
    const postState = {
      ...preState,
      observedAt: '2026-08-27T01:00:11.000Z',
      current: { ...fixture.before, ...structuredClone(fixture.after) },
    };
    let writes = 0;
    let reads = 0;
    const error = assertUnknownComment(
      () =>
        applyGitHubCollaborationMutation(fixture.request, preState, {
          collectState() {
            if (writes === 0) return preState;
            reads += 1;
            return change(postState);
          },
          runner() {
            writes += 1;
            return fixture.response;
          },
        }),
      fixture.request,
      true,
      name === 'read failure'
        ? 'comment-post-readback-unavailable'
        : 'comment-post-provenance-unverified'
    );
    assert.equal(writes, 1);
    assert.equal(reads, 1);
    assert.doesNotMatch(JSON.stringify(error.result), /secret upstream/);
  });
}

for (const [name, change] of [
  [
    'wrong actor',
    (comment) => {
      comment.authorLogin = 'other-maintainer';
    },
  ],
  [
    'missing actor',
    (comment) => {
      delete comment.authorLogin;
    },
  ],
  [
    'old timestamp',
    (comment) => {
      comment.createdAt = '2026-08-26T00:00:00.000Z';
    },
  ],
  [
    'missing timestamp',
    (comment) => {
      delete comment.createdAt;
    },
  ],
  [
    'wrong request marker',
    (comment) => {
      comment.body = comment.body.replace('proto-ui-collaboration:', 'another-request:');
    },
  ],
]) {
  test(`an unknown comment POST stays ambiguous with ${name}`, () => {
    const fixture = nonMetadataMutationCases().find((item) => item.name === 'post comment');
    const preState = { ...metadataLive(), action: fixture.request.action, current: fixture.before };
    const postState = {
      ...preState,
      observedAt: '2026-08-27T01:00:11.000Z',
      current: { ...fixture.before, ...structuredClone(fixture.after) },
    };
    change(postState.current.markerComment);
    let writes = 0;
    let reconciliations = 0;
    assertUnknownComment(
      () =>
        applyGitHubCollaborationMutation(fixture.request, preState, {
          collectState() {
            if (writes === 0) return preState;
            reconciliations += 1;
            return postState;
          },
          runner() {
            writes += 1;
            throw new Error('socket closed');
          },
        }),
      fixture.request,
      false,
      'comment-post-response-unavailable'
    );
    assert.equal(writes, 1);
    assert.equal(reconciliations, 1);
  });
}

test('comment collection retains the platform author and creation time', () => {
  const fixture = nonMetadataMutationCases().find((item) => item.name === 'post comment');
  const comment = fixture.after.markerComment;
  const live = collectLiveCollaborationState(fixture.request, {
    now: () => new Date('2026-08-27T01:00:11.000Z'),
    runner(command, args) {
      if (args.includes('graphql'))
        return JSON.stringify({
          data: { viewer: { login: 'maintainer' }, repository: { viewerPermission: 'WRITE' } },
        });
      if (args.includes('repos/Proto-UI/Proto-UI/pulls/509'))
        return JSON.stringify({
          number: 509,
          node_id: 'PR_node',
          state: 'open',
          user: { login: 'contributor' },
          updated_at: UPDATED_AT,
          head: { sha: HEAD },
        });
      if (args.some((arg) => arg.includes('/issues/509/comments?per_page=100')))
        return JSON.stringify([
          [
            {
              id: 271,
              node_id: 'IC_271',
              body: comment.body,
              created_at: comment.createdAt,
              user: { login: comment.authorLogin },
            },
          ],
        ]);
      throw new Error('unexpected fake GitHub call');
    },
  });
  assert.equal(live.current.markerComment.authorLogin, 'maintainer');
  assert.equal(live.current.markerComment.createdAt, comment.createdAt);
  assert.equal(desiredCollaborationStateSatisfied(fixture.request, live), true);
});

for (const pages of [
  null,
  {},
  [],
  [null],
  [[], { id: 271, body: 'marker hidden in a malformed page' }],
  [[null]],
  [[{ id: 271 }]],
  [[{ body: 'missing identity' }]],
]) {
  test(`comment marker collection rejects malformed complete-page data: ${JSON.stringify(pages)}`, () => {
    const fixture = nonMetadataMutationCases().find((item) => item.name === 'post comment');
    assert.throws(
      () =>
        collectLiveCollaborationState(fixture.request, {
          runner(_command, args) {
            if (args.includes('graphql'))
              return JSON.stringify({
                data: {
                  viewer: { login: 'maintainer' },
                  repository: { viewerPermission: 'WRITE' },
                },
              });
            if (args.includes('repos/Proto-UI/Proto-UI/pulls/509'))
              return JSON.stringify({
                number: 509,
                node_id: 'PR_node',
                state: 'open',
                user: { login: 'contributor' },
                updated_at: UPDATED_AT,
                head: { sha: HEAD },
              });
            return JSON.stringify(pages);
          },
        }),
      /comment.*(invalid|malformed)/
    );
  });
}

test('thread collection rejects a missing timestamp instead of retaining an older revision', () => {
  const fixture = nonMetadataMutationCases().find((item) => item.name === 'resolve thread');
  assert.throws(
    () =>
      collectLiveCollaborationState(fixture.request, {
        runner(_command, args) {
          const query = args.find((x) => x.startsWith('query='));
          if (query.includes('ProtoUiCollaborationViewer'))
            return JSON.stringify({
              data: { viewer: { login: 'maintainer' }, repository: { viewerPermission: 'WRITE' } },
            });
          return JSON.stringify({
            data: {
              node: {
                id: fixture.request.target.threadId,
                isResolved: false,
                isOutdated: false,
                pullRequest: {
                  number: 509,
                  state: 'OPEN',
                  author: { login: 'contributor' },
                  updatedAt: UPDATED_AT,
                  headRefOid: HEAD,
                  repository: { nameWithOwner: 'Proto-UI/Proto-UI' },
                },
                comments: {
                  nodes: [{ updatedAt: UPDATED_AT }, { updatedAt: null }],
                  pageInfo: { hasNextPage: false },
                },
              },
            },
          });
        },
      }),
    /comment timestamps/
  );
});
