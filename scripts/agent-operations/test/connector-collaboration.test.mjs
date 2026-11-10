import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runCollaborationCli } from '../collaboration-packet.mjs';
import {
  collaborationMarker,
  COLLABORATION_ACTIONS,
  computeCollaborationRequestDigest,
  validateCollaborationReceipt,
} from '../collaboration-runtime.mjs';
import {
  applyGitHubCollaborationMutation,
  collectLiveCollaborationState,
  CollaborationMutationUnknown,
} from '../collect-live-collaboration-state.mjs';
import {
  CONNECTOR_COLLABORATION_PROTOCOL,
  CONNECTOR_REQUIRED_FIELDS,
  createConnectorCollaborationRunner,
} from '../connector-collaboration-transport.mjs';
import { ownerDelegationSigningBytes } from '../owner-authorization.mjs';
import { collectThreadRevision } from '../thread-revision.mjs';

// All API responses below are injected offline observations. They do not prove
// that a real connected tool exposes these fields or that a write was sent.
const REPOSITORY = 'github.com:Proto-UI/Proto-UI';
const API = '/repos/Proto-UI/Proto-UI';
const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const NEXT = 'c'.repeat(40);
const UPDATED = '2026-10-05T01:00:00.000Z';
const REQUESTED = '2026-10-05T01:01:00.000Z';
const CREATED = '2026-10-05T01:02:00.000Z';
const LAUNCH = ['--mode', 'human-assisted', '--mode-source', 'current-user'];

function capabilities() {
  return {
    protocol: CONNECTOR_COLLABORATION_PROTOCOL,
    repositoryId: REPOSITORY,
    rest: true,
    graphql: true,
    pagination: 'link-header',
    fields: [...CONNECTOR_REQUIRED_FIELDS],
    supportedActions: [...COLLABORATION_ACTIONS],
  };
}

function fixture(t, action = 'update-governed-issue-or-pull-request-metadata') {
  const directory = mkdtempSync(join(tmpdir(), 'pui-connector-collaboration-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const expected = { title: 'Original title', body: 'Preserve this body', milestoneNumber: null, assignees: [], labels: [] };
  const request = {
    schemaVersion: 1,
    kind: 'proto-ui.collaboration-request',
    repositoryId: REPOSITORY,
    authorizationId: 'explicit-current-user',
    action,
    requestedAt: REQUESTED,
    requestDigest: '0'.repeat(64),
    target: { kind: 'pull-request', number: 839, updatedAt: UPDATED, headSha: HEAD },
    expected: action === 'post-bounded-reconciliation-comment' ? { markerAbsent: true } : expected,
    desired: action === 'post-bounded-reconciliation-comment' ? { body: 'Bounded authorized result' } : { ...expected, title: 'Corrected title' },
    evidence: [{ type: 'current-user-instruction', reference: 'fixture://independent-user-instruction' }],
    rationale: 'Apply only the requested reversible collaboration change.',
    humanGates: [],
  };
  const state = {
    permission: 'WRITE',
    actor: 'cyjin-yl',
    title: expected.title,
    head: HEAD,
    updated: UPDATED,
    comments: [],
    apiCalls: [],
    viewerReads: 0,
    targetReads: 0,
    writeAttempts: 0,
    rootName: 'Proto-UI/Proto-UI',
    capabilities: capabilities(),
    beforeFinalRead: () => {},
    pageResponse: null,
    loseAcknowledgment: false,
  };
  const seal = () => {
    request.requestDigest = computeCollaborationRequestDigest(request);
    const handoff = {
      schemaVersion: 2,
      kind: 'proto-ui.skill-handoff',
      entrypoint: 'development',
      executionMode: 'human-assisted',
      executionModeSource: 'current-user',
      fromId: 'pui-pr',
      nextSkillId: 'pui-collaborate',
      outcome: 'completed',
      binding: { repositoryId: REPOSITORY, scopeId: 'pull-request:839', headSha: HEAD, reviewInputDigest: null },
      artifacts: [
        { type: 'pull-request-report', reference: 'fixture://report' },
        { type: 'review-input', reference: 'fixture://review' },
        { type: 'capability-envelope', reference: 'fixture://capability' },
        { type: 'github-snapshot', reference: 'fixture://snapshot' },
        { type: 'mutation-authorization', reference: request.authorizationId },
        { type: 'collaboration-request', reference: 'fixture://request', digest: `sha256:${request.requestDigest}` },
      ],
      humanGates: [],
      notes: ['Injected offline transport observations only.'],
    };
    writeFileSync(join(directory, 'request.json'), JSON.stringify(request));
    writeFileSync(join(directory, 'handoff.json'), JSON.stringify(handoff));
  };
  seal();
  function target() {
    return {
      number: 839, node_id: 'PR_fixture', id: 839,
      html_url: 'https://github.com/Proto-UI/Proto-UI/pull/839',
      state: 'open', user: { login: 'original-contributor' },
      updated_at: state.updated, head: { sha: state.head }, base: { sha: BASE },
      title: state.title, body: expected.body, milestone: null, assignees: [], labels: [],
    };
  }
  function api(method, path, body) {
    state.apiCalls.push({ method, path, body });
    if (path === API) return { status: 200, body: { full_name: state.rootName } };
    if (path === '/graphql') {
      state.viewerReads += 1;
      if (state.viewerReads === 2) state.beforeFinalRead();
      return { status: 200, body: { data: { viewer: { login: state.actor }, repository: { viewerPermission: state.permission } } } };
    }
    if (method === 'GET' && path === `${API}/pulls/839`) {
      state.targetReads += 1;
      return { status: 200, body: target() };
    }
    if (method === 'GET' && path.startsWith(`${API}/issues/839/comments?`)) {
      if (state.pageResponse) return state.pageResponse(path);
      const page = new URL(path, 'https://api.github.com').searchParams.get('page');
      return page === '2'
        ? { status: 200, body: state.comments, headers: { link: null } }
        : { status: 200, body: [{ id: 10, body: 'Unrelated human comment' }], headers: { link: `<https://api.github.com${API}/issues/839/comments?per_page=100&page=2>; rel="next"` } };
    }
    if (method === 'PATCH' && path === `${API}/issues/839`) {
      state.writeAttempts += 1;
      state.title = body.title;
      state.updated = CREATED;
      if (state.loseAcknowledgment) throw new Error('injected lost PATCH acknowledgment');
      return { status: 200, body: target() };
    }
    if (method === 'POST' && path === `${API}/issues/839/comments`) {
      state.writeAttempts += 1;
      const comment = { id: 100, node_id: 'IC_fixture', html_url: 'https://github.com/Proto-UI/Proto-UI/pull/839#issuecomment-100', body: body.body, user: { login: state.actor }, created_at: CREATED, updated_at: CREATED };
      state.comments.push(comment);
      if (state.loseAcknowledgment) throw new Error('injected lost POST acknowledgment');
      return { status: 201, body: comment };
    }
    throw new Error(`unexpected offline API call: ${method} ${path}`);
  }
  const exchange = (message) => ({
    kind: 'tool-result', id: message.id,
    result: { isError: false, structuredContent: message.operation === 'github-collaboration-capabilities' ? state.capabilities : api(message.arguments.method, message.arguments.path, message.arguments.body) },
  });
  // This fixture models gh's already-complete --paginate --slurp output. The
  // connector must reach the same result by following actual next links.
  const gh = (command, args, options = {}) => {
    assert.equal(command, 'gh');
    if (args.includes('graphql')) return JSON.stringify(api('POST', '/graphql', null).body);
    const path = `/${args.find((arg) => arg.startsWith('repos/'))}`;
    if (args.includes('--paginate')) {
      const first = api('GET', path, null);
      const second = api('GET', `${path}&page=2`, null);
      return JSON.stringify([first.body, second.body]);
    }
    const methodIndex = args.indexOf('--method');
    const response = api(methodIndex === -1 ? 'GET' : args[methodIndex + 1], path, options.input === undefined ? null : JSON.parse(options.input));
    return response.body === null ? '' : JSON.stringify(response.body);
  };
  const run = (transport = 'connector', extra = []) => runCollaborationCli([
    'apply', ...LAUNCH, ...(transport === 'connector' ? ['--transport', 'connector'] : []),
    '--request', join(directory, 'request.json'), '--handoff', join(directory, 'handoff.json'), ...extra,
  ], transport === 'connector' ? { connectorExchange: exchange } : { runner: gh });
  return { directory, state, request, api, exchange, run, seal };
}

for (const action of ['update-governed-issue-or-pull-request-metadata', 'post-bounded-reconciliation-comment']) {
  test(`${action}: gh and connector preserve the same canonical consumer outcome and idempotent no-op`, (t) => {
    const receipts = [];
    for (const transport of ['gh', 'connector']) {
      const f = fixture(t, action);
      const receipt = f.run(transport);
      validateCollaborationReceipt(receipt, f.request);
      assert.equal(receipt.outcome, 'applied');
      assert.equal(receipt.mutationCount, 1);
      assert.equal(receipt.actor, 'cyjin-yl');
      assert.equal(f.state.writeAttempts, 1);
      assert.equal(f.state.targetReads, 3, 'initial, final admission, and post-write observations');
      if (action === 'post-bounded-reconciliation-comment') {
        assert.equal(f.state.comments.length, 1);
        assert.equal(f.state.comments[0].body, `${f.request.desired.body}\n\n${collaborationMarker(f.request)}`);
        assert.equal(receipt.platformObject.id, '100');
        assert.equal(f.state.apiCalls.filter((call) => call.path.endsWith('&page=2')).length, 3, 'short first pages must not truncate later marker observations');
      } else {
        assert.equal(f.state.title, 'Corrected title');
        assert.equal(receipt.platformObject.url, 'https://github.com/Proto-UI/Proto-UI/pull/839');
      }
      receipts.push({ requestDigest: receipt.requestDigest, outcome: receipt.outcome, mutationCount: receipt.mutationCount, actor: receipt.actor, platformObject: receipt.platformObject });
      const duplicate = f.run(transport);
      validateCollaborationReceipt(duplicate, f.request);
      assert.equal(duplicate.outcome, 'no-op');
      assert.equal(duplicate.mutationCount, 0);
      assert.equal(f.state.writeAttempts, 1, 'the second request must observe the achieved state without writing');
    }
    assert.deepEqual(receipts[0], receipts[1]);
  });
}

for (const [name, change] of [
  ['permission revoked', (state) => { state.permission = 'READ'; }],
  ['head changed', (state) => { state.head = NEXT; }],
  ['metadata revision changed', (state) => { state.updated = CREATED; }],
  ['actor changed', (state) => { state.actor = 'another-maintainer'; }],
]) {
  test(`connector final live admission refuses ${name} with zero writes`, (t) => {
    const f = fixture(t);
    f.state.beforeFinalRead = () => change(f.state);
    const receipt = f.run();
    validateCollaborationReceipt(receipt, f.request);
    assert.equal(receipt.outcome, 'rejected');
    assert.equal(receipt.mutationCount, 0);
    assert.equal(f.state.writeAttempts, 0);
    assert.equal(f.state.title, 'Original title');
  });
}

test('durable owner revocation remains effective at connector final admission', (t) => {
  const f = fixture(t);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const statePath = join(f.directory, 'owner-state.json');
  const publicKeyPath = join(f.directory, 'owner.pub');
  writeFileSync(publicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }));
  const grant = { id: 'connector-owner-fixture', generation: 1, status: 'active', grantor: { login: 'cyjin-yl', id: 19223209 }, actor: 'cyjin-yl', repositoryId: REPOSITORY, actions: ['collaborate'], scopeIds: ['pull-request:839'], baseRefName: 'main', decisionReference: 'fixture://trusted-owner-decision' };
  const save = (revoked) => {
    const payload = { schemaVersion: 1, kind: 'proto-ui.owner-delegation-state', revision: revoked ? 2 : 1, grants: [{ ...grant, generation: revoked ? 2 : 1, status: revoked ? 'revoked' : 'active' }] };
    writeFileSync(statePath, JSON.stringify({ payload, signature: sign(null, ownerDelegationSigningBytes(payload), privateKey).toString('base64') }));
  };
  save(false);
  f.request.authorizationId = grant.id;
  f.seal();
  f.state.beforeFinalRead = () => save(true);
  const receipt = f.run('connector', ['--owner-authorization', statePath, '--owner-key', publicKeyPath, '--owner-grant', grant.id]);
  assert.equal(receipt.outcome, 'rejected');
  assert.equal(receipt.mutationCount, 0);
  assert.equal(f.state.writeAttempts, 0);
  assert.equal(f.state.title, 'Original title');
});

for (const action of ['update-governed-issue-or-pull-request-metadata', 'post-bounded-reconciliation-comment']) {
  test(`${action}: a lost connector response causes one read-only reconciliation and no resend`, (t) => {
    const f = fixture(t, action);
    f.state.loseAcknowledgment = true;
    assert.throws(() => f.run(), (error) => {
      if (action === 'post-bounded-reconciliation-comment') {
        assert.ok(error instanceof CollaborationMutationUnknown);
        assert.equal(error.result.outcome, 'unknown');
        assert.equal(error.result.writeAttempts, 1);
        assert.equal(error.result.reconciliationReadAttempts, 1);
      } else assert.match(error.message, /ambiguous after one live reconciliation/);
      return true;
    });
    assert.equal(f.state.writeAttempts, 1);
    assert.equal(f.state.targetReads, 3);
    assert.equal(f.state.viewerReads, 3);
  });
}

for (const [name, page] of [
  ['missing Link metadata', () => ({ status: 200, body: [] })],
  ['skipped next page', () => ({ status: 200, body: [], headers: { link: `<https://api.github.com${API}/issues/839/comments?per_page=100&page=3>; rel="next"` } })],
  ['different collection', () => ({ status: 200, body: [], headers: { link: `<https://api.github.com${API}/issues/840/comments?per_page=100&page=2>; rel="next"` } })],
  ['repeated comment identity', (path) => ({ status: 200, body: [{ id: 10, body: 'Comment' }], headers: { link: path.endsWith('&page=2') ? null : `<https://api.github.com${API}/issues/839/comments?per_page=100&page=2>; rel="next"` } })],
]) {
  test(`connector refuses incomplete discussion: ${name}`, (t) => {
    const f = fixture(t, 'post-bounded-reconciliation-comment');
    f.state.pageResponse = page;
    assert.throws(() => f.run(), /pagination/);
    assert.equal(f.state.writeAttempts, 0);
    assert.equal(f.state.comments.length, 0);
  });
}

for (const [name, change, error] of [
  ['missing live permission field', (state) => { state.capabilities.fields = state.capabilities.fields.filter((field) => field !== 'repository-permission'); }, /missing required live fields: repository-permission/],
  ['unsupported action', (state) => { state.capabilities.supportedActions = []; }, /does not support/],
  ['missing API support', (state) => { state.capabilities.graphql = false; }, /capabilities/],
  ['wrong live repository', (state) => { state.rootName = 'Other/Repository'; }, /repository identity/],
  ['missing live viewer', (state) => { state.actor = null; }, /viewer identity/],
]) {
  test(`connector refuses ${name} before any write`, (t) => {
    const f = fixture(t);
    change(f.state);
    assert.throws(() => f.run(), error);
    assert.equal(f.state.writeAttempts, 0);
    assert.equal(f.state.title, 'Original title');
  });
}

test('unbound or failed connector result never becomes a live identity', (t) => {
  const f = fixture(t);
  for (const exchange of [
    () => ({ kind: 'tool-result', id: 'replayed', result: { isError: false, structuredContent: capabilities() } }),
    (message) => ({ kind: 'tool-result', id: message.id, result: { isError: true, structuredContent: capabilities() } }),
    () => Promise.resolve(capabilities()),
  ]) assert.throws(() => createConnectorCollaborationRunner(f.request, { exchange }), /unbound structured result/);
  assert.equal(f.state.apiCalls.length, 0);
});

test('connector write-attempt latch stays consumed after a lost acknowledgment', (t) => {
  const f = fixture(t);
  f.state.loseAcknowledgment = true;
  const { runner } = createConnectorCollaborationRunner(f.request, { exchange: f.exchange });
  const args = ['api', '--method', 'PATCH', 'repos/Proto-UI/Proto-UI/issues/839', '--input', '-'];
  const options = { input: JSON.stringify({ title: 'Corrected title' }) };
  assert.throws(() => runner('gh', args, options), /lost PATCH/);
  assert.throws(() => runner('gh', args, options), /second mutation or resend/);
  assert.equal(f.state.writeAttempts, 1);
  assert.equal(f.state.title, 'Corrected title');
});

test('connector keeps the server expected-head condition on an update-branch consumer', (t) => {
  const f = fixture(t);
  const request = { ...f.request, action: 'update-pull-request-branch-at-expected-head', target: { ...f.request.target, baseSha: BASE }, expected: { containsBaseSha: false }, desired: { containsBaseSha: true } };
  request.requestDigest = computeCollaborationRequestDigest(request);
  let updated = false;
  let attempts = 0;
  const exchange = (message) => {
    const { method, path, body } = message.arguments;
    if (message.operation === 'github-collaboration-capabilities') return f.exchange(message);
    let response;
    if (path?.includes('/compare/')) response = { status: 200, body: { status: updated ? 'ahead' : 'behind' } };
    else if (method === 'PUT') {
      attempts += 1;
      if (body.expected_head_sha !== f.state.head) response = { status: 422, body: {} };
      else { updated = true; f.state.head = NEXT; response = { status: 202, body: { message: 'Updating' } }; }
    } else response = f.api(method, path, body);
    return { kind: 'tool-result', id: message.id, result: { isError: false, structuredContent: response } };
  };
  const { runner, capabilities: report } = createConnectorCollaborationRunner(request, { exchange });
  const before = collectLiveCollaborationState(request, { runner });
  const result = applyGitHubCollaborationMutation(request, before, { runner, authorizationContext: { executionMode: 'human-assisted', executionModeSource: 'current-user', policy: {} } });
  assert.equal(result.mutationCount, 1);
  assert.equal(attempts, 1);
  assert.equal(result.postState.current.headSha, NEXT);
  assert.equal(result.postState.current.containsBaseSha, true);
  assert.equal(report.endpointBoundaries[request.action].expectedHead, true);
  assert.equal(report.endpointBoundaries['update-governed-issue-or-pull-request-metadata'].atomicMetadataRevision, false);
});

function applyConnectorRequest(request, exchange, policy = {}) {
  request.requestDigest = computeCollaborationRequestDigest(request);
  const { runner } = createConnectorCollaborationRunner(request, { exchange });
  const before = collectLiveCollaborationState(request, { runner });
  return applyGitHubCollaborationMutation(request, before, {
    runner,
    authorizationContext: { executionMode: 'human-assisted', executionModeSource: 'current-user', policy },
  });
}

for (const partialGraphqlError of [false, true]) {
  test(`connector thread resolution ${partialGraphqlError ? 'does not attribute partial GraphQL data as success' : 'retains its complete live comment revision'}`, (t) => {
    const f = fixture(t);
    const thread = {
      id: 'PRRT_fixture', isResolved: false, isOutdated: false,
      pullRequest: { number: 839, updatedAt: UPDATED, headRefOid: HEAD, state: 'OPEN', author: { login: 'original-contributor' }, repository: { nameWithOwner: 'Proto-UI/Proto-UI' } },
      comments: { nodes: [{ databaseId: 1, author: { login: 'independent-reviewer' }, body: 'Original finding', updatedAt: UPDATED }], pageInfo: { hasNextPage: false } },
    };
    const revision = collectThreadRevision(thread);
    const request = { ...f.request, action: 'resolve-fixed-review-thread', target: { ...f.request.target, kind: 'review-thread', threadId: thread.id, threadUpdatedAt: revision.threadUpdatedAt, threadRevisionDigest: revision.threadRevisionDigest }, expected: { isResolved: false }, desired: { isResolved: true }, evidence: [...f.request.evidence, { type: 'review-thread-resolution', reference: 'fixture://source-bound-fix', digest: `sha256:${'d'.repeat(64)}` }] };
    let writes = 0;
    const exchange = (message) => {
      if (message.operation === 'github-collaboration-capabilities') return f.exchange(message);
      const { method, path, body } = message.arguments;
      let response;
      if (body?.query.includes('query ProtoUiCollaborationThread')) response = { status: 200, body: { data: { node: thread } } };
      else if (body?.query.includes('mutation ProtoUiResolveThread')) {
        writes += 1;
        thread.isResolved = true;
        response = { status: 200, body: { data: { resolveReviewThread: { thread: { id: thread.id, isResolved: true } } }, ...(partialGraphqlError ? { errors: [{ message: 'Injected partial response' }] } : {}) } };
      } else response = f.api(method, path, body);
      return { kind: 'tool-result', id: message.id, result: { isError: false, structuredContent: response } };
    };
    if (partialGraphqlError) assert.throws(() => applyConnectorRequest(request, exchange), /ambiguous after one live reconciliation/);
    else {
      const result = applyConnectorRequest(request, exchange);
      assert.equal(result.mutationCount, 1);
      assert.equal(result.postState.current.isResolved, true);
      assert.equal(result.postState.current.threadRevisionDigest, revision.threadRevisionDigest);
      assert.equal(result.platformObject.id, thread.id);
    }
    assert.equal(writes, 1);
    assert.equal(thread.isResolved, true);
  });
}

test('connector marks the live exact draft head ready through the shared GraphQL writer', (t) => {
  const f = fixture(t);
  const request = { ...f.request, action: 'mark-exact-head-ready-for-review', expected: { isDraft: true }, desired: { isDraft: false }, evidence: [...f.request.evidence, { type: 'validation-report', reference: 'fixture://validation', digest: `sha256:${'e'.repeat(64)}` }] };
  let draft = true;
  let writes = 0;
  const exchange = (message) => {
    if (message.operation === 'github-collaboration-capabilities') return f.exchange(message);
    const { method, path, body } = message.arguments;
    let response;
    if (body?.query.includes('mutation ProtoUiMarkReady')) {
      writes += 1;
      draft = false;
      response = { status: 200, body: { data: { markPullRequestReadyForReview: { pullRequest: { id: 'PR_fixture', isDraft: false, headRefOid: HEAD, updatedAt: CREATED, url: 'https://github.com/Proto-UI/Proto-UI/pull/839' } } } } };
    } else {
      response = f.api(method, path, body);
      if (path === `${API}/pulls/839`) response.body.draft = draft;
    }
    return { kind: 'tool-result', id: message.id, result: { isError: false, structuredContent: response } };
  };
  const result = applyConnectorRequest(request, exchange);
  assert.equal(result.mutationCount, 1);
  assert.equal(writes, 1);
  assert.equal(result.postState.current.isDraft, false);
  assert.equal(result.postState.current.headSha, HEAD);
});

test('connector review requests retain later-page contributor checks before one reversible request', (t) => {
  const f = fixture(t);
  const request = { ...f.request, action: 'request-independent-review', expected: { requestedReviewerLogins: [] }, desired: { reviewerLogin: 'independent-reviewer' } };
  let requested = false;
  let writes = 0;
  let laterPageReads = 0;
  const exchange = (message) => {
    if (message.operation === 'github-collaboration-capabilities') return f.exchange(message);
    const { method, path, body } = message.arguments;
    let response;
    if (path.includes('/commits?')) {
      const later = path.endsWith('&page=2');
      if (later) laterPageReads += 1;
      response = { status: 200, body: [{ sha: (later ? '2' : '1').repeat(40), author: { login: 'original-contributor' }, committer: { login: later ? 'later-contributor' : 'original-contributor' } }], headers: { link: later ? null : `<https://api.github.com${API}/pulls/839/commits?per_page=100&page=2>; rel="next"` } };
    } else if (method === 'POST' && path.endsWith('/requested_reviewers')) {
      writes += 1;
      requested = body.reviewers.includes('independent-reviewer');
      response = { status: 201, body: { id: 839 } };
    } else {
      response = f.api(method, path, body);
      if (path === `${API}/pulls/839`) response.body.requested_reviewers = requested ? [{ login: 'independent-reviewer' }] : [];
    }
    return { kind: 'tool-result', id: message.id, result: { isError: false, structuredContent: response } };
  };
  const result = applyConnectorRequest(request, exchange);
  assert.equal(writes, 1);
  assert.equal(result.postState.current.requestedReviewerLogins.includes('independent-reviewer'), true);
  assert.equal(result.postState.current.commitContributorLogins.includes('later-contributor'), true);
  assert.equal(laterPageReads, 3);
});

test('connector workflow rerun preserves exact workflow identity and verifies the next attempt', (t) => {
  const f = fixture(t);
  const request = { ...f.request, action: 'rerun-exact-trusted-workflow', target: { kind: 'workflow-run', runId: 99, updatedAt: UPDATED, headSha: HEAD, attempt: 1, workflowName: 'CI', workflowPath: '.github/workflows/ci.yml' }, expected: { status: 'completed', conclusion: 'failure' }, desired: { mode: 'failed-jobs' }, evidence: [...f.request.evidence, { type: 'ci-diagnosis', reference: 'fixture://failure-diagnosis', digest: `sha256:${'e'.repeat(64)}` }] };
  let attempt = 1;
  let writes = 0;
  const exchange = (message) => {
    if (message.operation === 'github-collaboration-capabilities') return f.exchange(message);
    const { method, path, body } = message.arguments;
    let response;
    if (method === 'GET' && path.endsWith('/actions/runs/99')) response = { status: 200, body: { id: 99, updated_at: UPDATED, head_sha: HEAD, run_attempt: attempt, name: 'CI', path: '.github/workflows/ci.yml', head_repository: { full_name: 'Proto-UI/Proto-UI' }, status: attempt === 1 ? 'completed' : 'queued', conclusion: attempt === 1 ? 'failure' : null } };
    else if (method === 'POST' && path.endsWith('/actions/runs/99/rerun-failed-jobs')) { writes += 1; attempt += 1; response = { status: 201, body: null }; }
    else response = f.api(method, path, body);
    return { kind: 'tool-result', id: message.id, result: { isError: false, structuredContent: response } };
  };
  const result = applyConnectorRequest(request, exchange, { trustedCiEvidence: { repositoryId: REPOSITORY, workflowNames: ['CI'], workflowPaths: ['.github/workflows/ci.yml'] } });
  assert.equal(writes, 1);
  assert.equal(result.postState.current.attempt, 2);
  assert.equal(result.platformObject.workflowRunId, 99);
  assert.equal(result.platformObject.workflowAttempt, 2);
});

test('connector invocation declarations reject before any bridge call', () => {
  let bridgeCalls = 0;
  assert.throws(() => runCollaborationCli(['apply', '--transport', 'connector', '--request', '/missing/request.json', '--handoff', '/missing/handoff.json'], { connectorExchange: () => { bridgeCalls += 1; } }), /--mode is required/);
  assert.throws(() => runCollaborationCli(['apply', '--transport', 'invalid', ...LAUNCH], {}), /--transport must be gh or connector/);
  assert.equal(bridgeCalls, 0);
});

for (const lostAcknowledgment of [false, true]) {
  test(`formal child CLI bridge keeps one comment attempt with ${lostAcknowledgment ? 'a lost' : 'a bound'} acknowledgment`, { timeout: 15_000 }, async (t) => {
    const f = fixture(t, 'post-bounded-reconciliation-comment');
    f.state.loseAcknowledgment = lostAcknowledgment;
    const child = spawn(process.execPath, [
      fileURLToPath(new URL('../collaboration-packet.mjs', import.meta.url)),
      'apply', ...LAUNCH, '--transport', 'connector',
      '--request', join(f.directory, 'request.json'), '--handoff', join(f.directory, 'handoff.json'),
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    t.after(() => child.kill());
    let stdout = '';
    const diagnostics = [];
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    const lines = createInterface({ input: child.stderr });
    lines.on('line', (line) => {
      let message;
      try { message = JSON.parse(line); }
      catch { diagnostics.push(line); return; }
      if (message.kind !== 'tool-call') { diagnostics.push(line); return; }
      let response;
      try { response = f.exchange(message); }
      catch { response = { kind: 'tool-result', id: message.id, result: { isError: true } }; }
      child.stdin.write(`${JSON.stringify(response)}\n`);
    });
    const [code] = await once(child, 'close');
    const result = JSON.parse(stdout);
    assert.equal(f.state.writeAttempts, 1);
    assert.equal(f.state.targetReads, 3);
    assert.equal(f.state.comments.length, 1);
    if (lostAcknowledgment) {
      assert.equal(code, 1);
      assert.equal(result.kind, 'proto-ui.collaboration-unknown');
      assert.equal(result.outcome, 'unknown');
      assert.equal(result.writeAttempts, 1);
      assert.equal(result.reconciliationReadAttempts, 1);
      assert.equal(diagnostics.length, 1);
      assert.match(diagnostics[0], /unknown/);
    } else {
      assert.equal(code, 0);
      validateCollaborationReceipt(result, f.request);
      assert.equal(result.outcome, 'applied');
      assert.equal(result.platformObject.id, '100');
      assert.deepEqual(diagnostics, []);
    }
  });
}
