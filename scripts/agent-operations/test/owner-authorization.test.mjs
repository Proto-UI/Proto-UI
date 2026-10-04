import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  loadOwnerAuthorization,
  ownerAuthorizationAllows,
  ownerDelegationSigningBytes,
  ownerSkillEligibility,
} from '../owner-authorization.mjs';
import { loadSkillRegistry } from '../skill-registry.mjs';
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pui-owner-grant-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const statePath = path.join(dir, 'state.json'),
    publicKeyPath = path.join(dir, 'owner.pub');
  fs.writeFileSync(publicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }));
  const grant = {
    id: 'owner-test',
    status: 'active',
    grantor: { login: 'cyjin-yl', id: 19223209 },
    actor: 'cyjin-yl',
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    actions: ['observe', 'implement', 'collaborate', 'review', 'integrate'],
    scopeIds: ['*'],
    baseRefName: 'main',
    decisionReference: 'fixture:trusted-owner-decision',
  };
  const save = (g = grant, revision = 1) => {
    const payload = {
      schemaVersion: 1,
      kind: 'proto-ui.owner-delegation-state',
      revision,
      grants: [g],
    };
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        payload,
        signature: sign(null, ownerDelegationSigningBytes(payload), privateKey).toString('base64'),
      })
    );
  };
  save();
  return {
    grant,
    save,
    statePath,
    publicKeyPath,
    load: () => loadOwnerAuthorization({ statePath, publicKeyPath, grantId: grant.id }),
  };
}
const context = {
  repositoryId: 'github.com:Proto-UI/Proto-UI',
  scopeId: 'issue:813',
  action: 'collaborate',
  actor: 'cyjin-yl',
  authorizationId: 'owner-test',
  executionModeSource: 'schedule',
};
test('owner authorization persists across contexts and authenticates actor, repo and action', (t) => {
  const f = fixture(t);
  for (const source of ['schedule', 'governed-queue', 'maintainer-invocation'])
    assert.equal(
      ownerAuthorizationAllows(f.load(), { ...context, executionModeSource: source }),
      true
    );
  for (const change of [
    { actor: 'someone-else' },
    { repositoryId: 'github.com:other/repo' },
    { action: 'release' },
    { authorizationId: 'another' },
    { executionModeSource: 'issue-body' },
  ])
    assert.equal(ownerAuthorizationAllows(f.load(), { ...context, ...change }), false);
  assert.equal(ownerAuthorizationAllows({ ...f.load() }, context), false);
});
test('revocation and narrowing apply to an already loaded proof without another approval cycle', (t) => {
  const f = fixture(t),
    p = f.load();
  f.save({ ...f.grant, status: 'revoked' }, 2);
  assert.equal(ownerAuthorizationAllows(p, context), false);
  f.save({ ...f.grant, scopeIds: ['issue:814'] }, 3);
  assert.equal(ownerAuthorizationAllows(p, context), false);
  const narrowed = f.load();
  assert.equal(ownerAuthorizationAllows(narrowed, context), false);
  assert.equal(ownerAuthorizationAllows(narrowed, { ...context, scopeId: 'issue:814' }), true);
});
test('tampered state, untrusted signing key and privileged scope reject', (t) => {
  const f = fixture(t);
  const doc = JSON.parse(fs.readFileSync(f.statePath, 'utf8'));
  doc.payload.grants[0].actions.push('release');
  fs.writeFileSync(f.statePath, JSON.stringify(doc));
  assert.throws(() => f.load(), /signature/);
  f.save({ ...f.grant, actions: ['release'] });
  assert.throws(() => f.load(), /privileged/);
  f.save();
  const other = generateKeyPairSync('ed25519');
  fs.writeFileSync(f.publicKeyPath, other.publicKey.export({ type: 'spki', format: 'pem' }));
  assert.throws(() => f.load(), /signature/);
});
test('covered ordinary leaves avoid repeated assessment while release remains excluded', (t) => {
  const f = fixture(t),
    registry = loadSkillRegistry();
  for (const id of ['pui-module', 'pui-review', 'pui-integrate', 'pui-collaborate'])
    assert.equal(
      ownerSkillEligibility(registry.byId.get(id), { ownerAuthorization: f.load(), ...context })
        .eligible,
      true
    );
  assert.equal(
    ownerSkillEligibility(registry.byId.get('pui-release-prep'), {
      ownerAuthorization: f.load(),
      ...context,
    }),
    null
  );
});

import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import {
  authorizeReviewSubmission,
  authorizePullRequestMerge,
  evaluateReviewEligibility,
} from '../review-runtime.mjs';
import {
  authorizeCollaborationMutation,
  computeCollaborationRequestDigest,
} from '../collaboration-runtime.mjs';
import { runCollaborationCli } from '../collaboration-packet.mjs';
import {
  reviewSnapshot,
  reviewPacket,
  publishReview,
  fixturePublishedPacket,
} from './fixtures/review-publication.mjs';
const policy = YAML.parse(
  fs.readFileSync(
    new URL('../../../internal/agent-operations/capability-policy.yaml', import.meta.url),
    'utf8'
  )
);
test('real resolver CLI continues owner-delegated schedule without a repeated assessment', (t) => {
  const f = fixture(t),
    root = new URL('../../../', import.meta.url);
  const options = [
    'scripts/agent-operations/resolve-skill.mjs',
    'pui-module',
    '--mode',
    'autonomous',
    '--mode-source',
    'schedule',
    '--owner-authorization',
    f.statePath,
    '--owner-key',
    f.publicKeyPath,
    '--owner-grant',
    f.grant.id,
  ];
  const first = JSON.parse(
    execFileSync(process.execPath, options, { cwd: root, encoding: 'utf8' })
  );
  assert.equal(first.blocked, false);
  assert.equal(first.skill.id, 'pui-module');
  assert.equal(first.eligibility.assessmentEffect, 'advisory');
  f.save({ ...f.grant, status: 'revoked' }, 2);
  assert.throws(() => execFileSync(process.execPath, options, { cwd: root, stdio: 'pipe' }));
});
function collaboration() {
  const timestamp = '2026-10-04T10:00:00.000Z',
    head = 'a'.repeat(40);
  const expected = {
    title: 'Original',
    body: 'Original body',
    milestoneNumber: null,
    assignees: [],
    labels: [],
  };
  const request = {
    schemaVersion: 1,
    kind: 'proto-ui.collaboration-request',
    repositoryId: context.repositoryId,
    authorizationId: 'owner-test',
    action: 'update-governed-issue-or-pull-request-metadata',
    requestedAt: timestamp,
    requestDigest: '0'.repeat(64),
    target: { kind: 'pull-request', number: 813, updatedAt: timestamp, headSha: head },
    expected,
    desired: { ...expected, title: 'Corrected' },
    evidence: [{ type: 'owner-decision', reference: 'fixture:trusted-owner-decision' }],
    rationale: 'Repair the title within an existing owner delegation.',
    humanGates: [],
  };
  request.requestDigest = computeCollaborationRequestDigest(request);
  const liveState = {
    schemaVersion: 1,
    kind: 'proto-ui.live-collaboration-state',
    repositoryId: request.repositoryId,
    action: request.action,
    observedAt: timestamp,
    viewerLogin: 'cyjin-yl',
    viewerPermission: 'MAINTAIN',
    current: {
      kind: 'pull-request',
      number: 813,
      nodeId: 'PR_test',
      url: 'https://github.com/Proto-UI/Proto-UI/pull/813',
      state: 'OPEN',
      authorLogin: 'contributor',
      updatedAt: timestamp,
      headSha: head,
      desiredLabelsExist: true,
      ...expected,
    },
  };
  return { request, liveState };
}
test('owner-delegated collaboration passes actual handoff CLI and exact-state admission', (t) => {
  const f = fixture(t),
    { request, liveState } = collaboration(),
    p = f.load();
  const params = {
    request,
    liveState,
    executionMode: 'autonomous',
    executionModeSource: 'schedule',
    policy,
    selfAssessment: null,
    ownerAuthorization: p,
  };
  assert.equal(authorizeCollaborationMutation(params).outcome, 'mutate');
  for (const change of [
    { viewerLogin: 'other' },
    { viewerPermission: 'READ' },
    { current: { ...liveState.current, headSha: 'b'.repeat(40) } },
  ])
    assert.equal(
      authorizeCollaborationMutation({ ...params, liveState: { ...liveState, ...change } }).allowed,
      false
    );
  const dir = path.dirname(f.statePath),
    requestPath = path.join(dir, 'request.json'),
    handoffPath = path.join(dir, 'handoff.json');
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const artifacts = [
    { type: 'capability-envelope', reference: 'fixture:context' },
    { type: 'github-snapshot', reference: 'fixture:live' },
    { type: 'mutation-authorization', reference: f.grant.id },
    {
      type: 'collaboration-request',
      reference: requestPath,
      digest: 'sha256:' + request.requestDigest,
    },
  ];
  fs.writeFileSync(
    handoffPath,
    JSON.stringify({
      schemaVersion: 1,
      kind: 'proto-ui.skill-handoff',
      entrypoint: 'development',
      executionMode: 'autonomous',
      executionModeSource: 'schedule',
      fromId: 'pui-dev',
      nextSkillId: 'pui-collaborate',
      artifacts,
      humanGates: [],
      notes: [],
    })
  );
  const result = runCollaborationCli([
    'validate',
    '--mode',
    'autonomous',
    '--mode-source',
    'schedule',
    '--request',
    requestPath,
    '--handoff',
    handoffPath,
    '--owner-authorization',
    f.statePath,
    '--owner-key',
    f.publicKeyPath,
    '--owner-grant',
    f.grant.id,
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.executionMode, 'autonomous');
  f.save({ ...f.grant, status: 'revoked' }, 2);
  assert.equal(authorizeCollaborationMutation(params).allowed, false);
});
test('owner delegation admits a real review packet but cannot remove CI or independent identity checks', (t) => {
  const f = fixture(t),
    input = reviewSnapshot(),
    packet = reviewPacket(input),
    ownerAuthorization = f.load();
  const params = {
    packet,
    input,
    liveInput: input,
    executionMode: 'autonomous',
    executionModeSource: 'schedule',
    authorizationId: f.grant.id,
    policy,
    selfAssessment: null,
    ownerAuthorization,
    credentialCanReview: true,
    reviewer: 'cyjin-yl',
    ciConclusion: 'success',
    dcoConclusion: 'success',
  };
  assert.equal(
    evaluateReviewEligibility({
      executionMode: 'autonomous',
      executionModeSource: 'schedule',
      ownerAuthorization,
      repositoryId: input.repositoryId,
      scopeId: 'pull-request:' + input.pullRequest,
      reviewClass: packet.reviewClass,
      policy,
    }).eligible,
    true
  );
  assert.equal(authorizeReviewSubmission(params).allowed, true);
  for (const change of [
    { reviewer: 'other' },
    { credentialCanReview: false },
    { ciConclusion: 'failure' },
    { dcoConclusion: 'failure' },
  ])
    assert.equal(authorizeReviewSubmission({ ...params, ...change }).allowed, false);
  const self = reviewSnapshot({ pullRequestAuthor: 'cyjin-yl' }),
    own = { ...params, input: self, liveInput: self, packet: reviewPacket(self) };
  assert.equal(authorizeReviewSubmission(own).allowed, false);
});
test('owner-delegated merge still requires exact live publication, trusted green CI and independent review', (t) => {
  const f = fixture(t),
    input = publishReview(reviewSnapshot()).input,
    packet = reviewPacket(input);
  const params = {
    packet,
    publishedPacket: fixturePublishedPacket(input),
    input,
    liveInput: input,
    executionMode: 'autonomous',
    executionModeSource: 'schedule',
    authorizationId: f.grant.id,
    policy,
    selfAssessment: null,
    ownerAuthorization: f.load(),
    credentialCanMerge: true,
    credentialPermission: 'MAINTAIN',
    credentialCanBypass: false,
    actor: 'cyjin-yl',
    ciConclusion: 'success',
    dcoConclusion: 'success',
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
  };
  assert.equal(authorizePullRequestMerge(params).allowed, true);
  for (const change of [
    { actor: 'other' },
    { credentialCanMerge: false },
    { ciConclusion: 'failure' },
    { dcoConclusion: 'failure' },
    { publishedPacket: null },
  ])
    assert.equal(authorizePullRequestMerge({ ...params, ...change }).allowed, false);
});

test('delegation never permits runtime mode/source drift or an invented mode', (t) => {
  const f = fixture(t),
    { request, liveState } = collaboration();
  const p = f.load();
  for (const [executionMode, executionModeSource] of [
    ['human-assisted', 'schedule'],
    ['autonomous', 'current-user'],
    ['invalid', 'schedule'],
  ]) {
    assert.equal(
      authorizeCollaborationMutation({
        request,
        liveState,
        executionMode,
        executionModeSource,
        policy,
        ownerAuthorization: p,
      }).allowed,
      false
    );
  }
  assert.equal(ownerAuthorizationAllows(p, { ...context, executionMode: 'human-assisted' }), false);
  assert.equal(ownerAuthorizationAllows(p, { ...context, executionMode: 'autonomous' }), true);
});
