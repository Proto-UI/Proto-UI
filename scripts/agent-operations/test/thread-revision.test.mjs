import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { collectThreadRevision } from '../thread-revision.mjs';
import {
  applyGitHubCollaborationMutation,
  collectLiveCollaborationState,
  collectLiveThreadRevisionTarget,
} from '../collect-live-collaboration-state.mjs';
import {
  authorizeCollaborationMutation,
  buildCollaborationReceipt,
  computeCollaborationRequestDigest,
  desiredCollaborationStateSatisfied,
  validateCollaborationRequest,
  validateCollaborationReceipt,
} from '../collaboration-runtime.mjs';
import { runCollaborationCli } from '../collaboration-packet.mjs';

const AT = '2026-10-01T19:57:22Z';
const HEAD = 'a'.repeat(40);
const REPOSITORY = 'github.com:Proto-UI/Proto-UI';
const THREAD = 'PRRT_test';
const COMMENTS = [
  { databaseId: 1, body: 'addressed finding', author: { login: 'reviewer' }, updatedAt: AT },
  { databaseId: 2, body: 'existing reply', author: { login: 'contributor' }, updatedAt: AT },
];
const authorizationContext = {
  executionMode: 'human-assisted',
  executionModeSource: 'current-user',
  policy: {},
};

function thread(comments = COMMENTS, overrides = {}) {
  return {
    id: THREAD,
    isResolved: false,
    isOutdated: false,
    pullRequest: {
      number: 509,
      updatedAt: AT,
      headRefOid: HEAD,
      state: 'OPEN',
      author: { login: 'contributor' },
      repository: { nameWithOwner: 'Proto-UI/Proto-UI' },
    },
    comments: { nodes: structuredClone(comments), pageInfo: { hasNextPage: false } },
    ...overrides,
  };
}

function runnerFor(readThread, writes = []) {
  return (command, args, options) => {
    assert.equal(command, 'gh');
    assert.ok(args.includes('graphql'));
    const query = options?.input
      ? JSON.parse(options.input).query
      : args.find((arg) => arg.startsWith('query='));
    if (query.includes('mutation ProtoUiResolveThread')) {
      writes.push(query);
      return JSON.stringify({
        data: { resolveReviewThread: { thread: { id: THREAD, isResolved: true } } },
      });
    }
    assert.ok(query.includes('query ProtoUiCollaboration'));
    if (query.includes('ProtoUiCollaborationViewer')) {
      return JSON.stringify({
        data: { viewer: { login: 'maintainer' }, repository: { viewerPermission: 'WRITE' } },
      });
    }
    assert.match(query, /databaseId author \{ login \} body updatedAt/);
    return JSON.stringify({ data: { node: readThread() } });
  };
}

function requestFor(target) {
  const request = {
    schemaVersion: 1,
    kind: 'proto-ui.collaboration-request',
    repositoryId: REPOSITORY,
    authorizationId: 'explicit-current-user',
    action: 'resolve-fixed-review-thread',
    requestedAt: AT,
    target,
    expected: { isResolved: false },
    desired: { isResolved: true },
    evidence: [
      { type: 'current-user-instruction', reference: 'instruction://current-user/pr-509' },
      {
        type: 'review-thread-resolution',
        reference: 'artifact://review/thread',
        digest: `sha256:${'e'.repeat(64)}`,
      },
    ],
    rationale: 'Resolve only the reviewed comment revision.',
    humanGates: [],
  };
  request.requestDigest = computeCollaborationRequestDigest(request);
  return validateCollaborationRequest(request);
}

function authorRequest() {
  return requestFor(
    collectLiveThreadRevisionTarget(
      { repositoryId: REPOSITORY, number: 509, threadId: THREAD },
      {
        runner: runnerFor(() => thread()),
      }
    ).target
  );
}

function live(request, node) {
  return collectLiveCollaborationState(request, { runner: runnerFor(() => node) });
}

test('thread revision binds the complete exact comment set and thread domain with stable ordering', () => {
  const before = thread();
  const originalBytes = JSON.stringify(before);
  const revision = collectThreadRevision(before);
  assert.match(revision.threadRevisionDigest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(collectThreadRevision(thread([...COMMENTS].reverse())), revision);
  assert.equal(JSON.stringify(before), originalBytes);
  assert.notEqual(
    collectThreadRevision(thread(COMMENTS, { id: 'PRRT_other' })).threadRevisionDigest,
    revision.threadRevisionDigest
  );
  for (const comments of [
    [...COMMENTS, { ...COMMENTS[0], databaseId: 3 }],
    [COMMENTS[0]],
    COMMENTS.map((comment, index) => (index ? comment : { ...comment, body: `${comment.body}\n` })),
    COMMENTS.map((comment, index) =>
      index ? comment : { ...comment, author: { login: 'other' } }
    ),
    COMMENTS.map((comment, index) =>
      index ? comment : { ...comment, updatedAt: '2026-10-01T19:57:21Z' }
    ),
    COMMENTS.map((comment, index) => (index ? comment : { ...comment, databaseId: 3 })),
  ]) {
    assert.notEqual(
      collectThreadRevision(thread(comments)).threadRevisionDigest,
      revision.threadRevisionDigest
    );
  }
  assert.match(
    collectThreadRevision(thread([{ ...COMMENTS[0], author: null, body: '' }]))
      .threadRevisionDigest,
    /^sha256:/
  );
});

test('thread revision refuses empty, malformed, duplicate, and incomplete comment collections', () => {
  const invalid = [
    thread([]),
    thread(COMMENTS, { id: '' }),
    thread(COMMENTS, { id: undefined }),
    thread([null]),
    ...[undefined, null, '', '1', 0, -1, Number.MAX_SAFE_INTEGER + 1].map((databaseId) =>
      thread([{ ...COMMENTS[0], databaseId }])
    ),
    thread([COMMENTS[0], COMMENTS[0]]),
    thread([{ ...COMMENTS[0], body: null }]),
    thread([{ ...COMMENTS[0], body: undefined }]),
    thread([{ ...COMMENTS[0], author: undefined }]),
    thread([{ ...COMMENTS[0], author: {} }]),
    thread([{ ...COMMENTS[0], author: { login: '' } }]),
    thread([{ ...COMMENTS[0], updatedAt: undefined }]),
    thread([{ ...COMMENTS[0], updatedAt: 'yesterday' }]),
    thread(COMMENTS, { comments: { nodes: COMMENTS, pageInfo: { hasNextPage: true } } }),
    thread(COMMENTS, { comments: { nodes: COMMENTS, pageInfo: {} } }),
    thread(COMMENTS, { comments: { nodes: COMMENTS } }),
    thread(COMMENTS, { comments: { pageInfo: { hasNextPage: false } } }),
  ];
  for (const node of invalid) assert.throws(() => collectThreadRevision(node), /live/);
});

const changedCommentSets = [
  [
    'same-second reply',
    [
      ...COMMENTS,
      { databaseId: 3, body: 'new objection', author: { login: 'reviewer' }, updatedAt: AT },
    ],
  ],
  ['same-second body edit', [{ ...COMMENTS[0], body: 'unaddressed revised finding' }, COMMENTS[1]]],
  ['same-second deletion', [COMMENTS[0]]],
];

for (const [name, comments] of changedCommentSets) {
  test(`${name} is rejected at preflight, final read, and already-resolved no-op`, () => {
    const request = authorRequest();
    const before = live(request, thread());
    const changed = live(request, thread(comments));
    assert.equal(changed.current.threadUpdatedAt, before.current.threadUpdatedAt);
    assert.equal(changed.current.updatedAt, before.current.updatedAt);
    assert.notEqual(changed.current.threadRevisionDigest, before.current.threadRevisionDigest);
    assert.equal(
      authorizeCollaborationMutation({ request, liveState: changed, ...authorizationContext })
        .allowed,
      false
    );
    const resolved = live(request, thread(comments, { isResolved: true }));
    assert.equal(
      authorizeCollaborationMutation({ request, liveState: resolved, ...authorizationContext })
        .allowed,
      false
    );
    assert.equal(desiredCollaborationStateSatisfied(request, resolved), false);
    for (const current of [changed, resolved]) {
      let writes = 0;
      assert.throws(
        () =>
          applyGitHubCollaborationMutation(request, before, {
            authorizationContext,
            runner() {
              writes += 1;
              throw new Error('must not write');
            },
            collectState() {
              return current;
            },
          }),
        /comment revision is stale/
      );
      assert.equal(writes, 0);
    }
  });

  test(`${name} racing the write prevents success and never compensates or retries`, () => {
    const request = authorRequest();
    const before = live(request, thread());
    const writes = [];
    let reads = 0;
    const runner = runnerFor(() => {
      reads += 1;
      return reads === 1 ? thread() : thread(comments, { isResolved: true });
    }, writes);
    assert.throws(
      () =>
        applyGitHubCollaborationMutation(request, before, {
          authorizationContext,
          runner,
        }),
      /desired state was not verified.*do not retry blindly/
    );
    assert.equal(writes.length, 1);
    assert.equal(reads, 3, 'one final read, one post-write read, one read-only reconciliation');
  });
}

test('read-only authoring precedes sealing and an unchanged thread produces a bound receipt', () => {
  const writes = [];
  const authored = runCollaborationCli(
    ['thread-revision', '--repository', REPOSITORY, '--pull-request', '509', '--thread', THREAD],
    {
      runner: runnerFor(() => thread(), writes),
      now: () => new Date(AT),
      loadPolicy() {
        throw new Error('read-only authoring must not load mutation admission');
      },
    }
  );
  assert.equal(writes.length, 0);
  assert.equal(authored.isResolved, false);
  assert.equal(authored.observedAt, new Date(AT).toISOString());
  const request = requestFor(authored.target);
  const before = live(request, thread());
  let reads = 0;
  const applied = applyGitHubCollaborationMutation(request, before, {
    authorizationContext,
    runner: runnerFor(() => thread(COMMENTS, { isResolved: ++reads > 1 }), writes),
  });
  assert.equal(applied.mutationCount, 1);
  assert.equal(writes.length, 1);
  const receipt = buildCollaborationReceipt({
    request,
    preState: before,
    postState: applied.postState,
    actor: 'maintainer',
    outcome: 'applied',
    mutationCount: 1,
    reconciliationCount: 0,
    platformObject: applied.platformObject,
    verifiedAt: applied.postState.observedAt,
    verification: 'live-state-matches-desired',
    note: 'Exact collected comment revision verified.',
  });
  assert.equal(receipt.target.threadRevisionDigest, authored.target.threadRevisionDigest);
  assert.throws(
    () =>
      validateCollaborationReceipt({
        ...receipt,
        target: { ...receipt.target, threadRevisionDigest: [receipt.target.threadRevisionDigest] },
      }),
    /threadRevisionDigest/
  );
  const noOp = authorizeCollaborationMutation({
    request,
    liveState: applied.postState,
    ...authorizationContext,
  });
  assert.equal(noOp.outcome, 'no-op');
});

test('old thread requests require recollection without changing their historical bytes', () => {
  const request = authorRequest();
  delete request.target.threadRevisionDigest;
  request.requestDigest = computeCollaborationRequestDigest(request);
  const bytes = `${JSON.stringify(request, null, 2)}\n`;
  const directory = mkdtempSync(join(tmpdir(), 'thread-revision-'));
  const path = join(directory, 'historical-request.json');
  try {
    writeFileSync(path, bytes);
    assert.throws(
      () => validateCollaborationRequest(request),
      /threadRevisionDigest is required; re-collect/
    );
    assert.throws(
      () => runCollaborationCli(['request-digest', '--request', path]),
      /threadRevisionDigest is required; re-collect/
    );
    let calls = 0;
    assert.throws(
      () =>
        collectLiveCollaborationState(request, {
          runner() {
            calls += 1;
          },
        }),
      /re-collect/
    );
    assert.equal(calls, 0);
    assert.equal(readFileSync(path, 'utf8'), bytes);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('thread revision cannot replace head, permission, timestamp, or resolution evidence boundaries', () => {
  const request = authorRequest();
  const before = live(request, thread());
  const states = [
    { ...before, viewerPermission: 'READ' },
    { ...before, current: { ...before.current, headSha: 'b'.repeat(40) } },
    { ...before, current: { ...before.current, updatedAt: '2026-10-01T19:57:23Z' } },
    { ...before, current: { ...before.current, threadUpdatedAt: '2026-10-01T19:57:23Z' } },
    { ...before, current: { ...before.current, threadRevisionDigest: undefined } },
  ];
  for (const liveState of states) {
    assert.equal(
      authorizeCollaborationMutation({ request, liveState, ...authorizationContext }).allowed,
      false
    );
  }
  const noEvidence = {
    ...request,
    evidence: request.evidence.filter((item) => item.type !== 'review-thread-resolution'),
  };
  noEvidence.requestDigest = computeCollaborationRequestDigest(noEvidence);
  assert.throws(() => validateCollaborationRequest(noEvidence), /resolution evidence/);
  const arrayDigest = {
    ...request,
    target: { ...request.target, threadRevisionDigest: [request.target.threadRevisionDigest] },
  };
  arrayDigest.requestDigest = computeCollaborationRequestDigest(arrayDigest);
  assert.throws(() => validateCollaborationRequest(arrayDigest), /threadRevisionDigest/);
  const invalidDigest = {
    ...request,
    target: { ...request.target, threadRevisionDigest: 'default' },
  };
  invalidDigest.requestDigest = computeCollaborationRequestDigest(invalidDigest);
  assert.throws(
    () => validateCollaborationRequest(invalidDigest),
    /threadRevisionDigest is invalid/
  );
});

test('authoring rejects wrong targets, malformed state, partial GraphQL errors, and invalid IDs', () => {
  const selection = { repositoryId: REPOSITORY, number: 509, threadId: THREAD };
  for (const node of [
    thread(COMMENTS, { id: 'PRRT_other' }),
    thread(COMMENTS, { pullRequest: { ...thread().pullRequest, number: 510 } }),
    thread(COMMENTS, { isResolved: undefined }),
    thread(COMMENTS, { pullRequest: { ...thread().pullRequest, headRefOid: null } }),
    thread(COMMENTS, { comments: { nodes: COMMENTS, pageInfo: { hasNextPage: true } } }),
  ])
    assert.throws(() =>
      collectLiveThreadRevisionTarget(selection, { runner: runnerFor(() => node) })
    );
  assert.throws(
    () =>
      collectLiveThreadRevisionTarget(selection, {
        runner() {
          return JSON.stringify({
            data: { node: thread() },
            errors: [{ message: 'partial failure' }],
          });
        },
      }),
    /GraphQL errors/
  );
  assert.throws(
    () =>
      runCollaborationCli([
        'thread-revision',
        '--repository',
        REPOSITORY,
        '--pull-request',
        '509garbage',
        '--thread',
        THREAD,
      ]),
    /positive integer/
  );
});
