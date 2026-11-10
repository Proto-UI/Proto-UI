import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadCapabilityPolicy } from '../assessment-runtime.mjs';
import {
  captureReviewDeltaInput,
  planReviewDelta,
  reconcileReviewDelta,
  replayReviewDeltaCollection,
} from '../review-delta.mjs';
import {
  computeReviewInputDigest,
  computeReviewPacketDigest,
  validatePublishedReviewPacket,
  validateReviewPacket,
  verifyLiveReviewInput,
  verifyReconciliation,
} from '../review-runtime.mjs';
import { paginationFixture } from './fixtures/review-pagination.mjs';
import { reviewPacket } from './fixtures/review-publication.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const cli = fileURLToPath(new URL('../review-delta.mjs', import.meta.url));
const policy = loadCapabilityPolicy(new URL('../../../internal/agent-operations/capability-policy.yaml', import.meta.url));
const timestamp = '2026-11-10T08:00:00.000Z';
const scopes = ['implementation contract', 'review evidence'];
const priorFinding = {
  id: 'OLD-BOUNDARY-001', severity: 'P2', confidence: 'high', file: 'src/file-0.mjs', line: 1,
  authority: 'CONTRIBUTING.md#validate-proportionally', observed: 'Prior bounded observation',
  expected: 'Retain the original source condition', impact: 'Prior condition remains reviewable',
  fix: 'Complete the original bounded condition',
};

// Injected transport controls reuse the real complete/double-scan collector.
// They are neither live GitHub observations nor a reproduced product failure.
function capture(change = () => {}, { large = false, viewer = 'reviewer' } = {}) {
  const fixture = paginationFixture({ large });
  const ci = policy.trustedCiEvidence;
  const dco = policy.trustedDcoEvidence;
  fixture.data.checks.splice(0, fixture.data.checks.length,
    ...ci.checkNames.map((name, index) => ({
      id: `CI_${index}`, __typename: 'CheckRun', name, status: 'COMPLETED', conclusion: 'SUCCESS',
      completedAt: timestamp, detailsUrl: `https://github.com/Proto-UI/Proto-UI/actions/runs/${index + 1}`,
      checkSuite: {
        app: { id: 'APP_github_actions', slug: ci.source },
        repository: { nameWithOwner: 'Proto-UI/Proto-UI' },
        workflowRun: { file: { path: ci.workflowPaths[0] }, workflow: { name: ci.workflowNames[0] } },
      },
    })),
    {
      id: 'DCO_1', __typename: 'CheckRun', name: dco.checkName, status: 'COMPLETED', conclusion: 'SUCCESS',
      completedAt: timestamp, detailsUrl: dco.detailsUrl,
      checkSuite: { app: { id: dco.providerId, slug: dco.source }, repository: { nameWithOwner: 'Proto-UI/Proto-UI' }, workflowRun: null },
    });
  change(fixture);
  const checkConnection = {
    nodes: fixture.data.checks, totalCount: fixture.data.checks.length,
    pageInfo: { hasNextPage: false, endCursor: String(fixture.data.checks.length) },
  };
  fixture.data.commits.at(-1).commit.statusCheckRollup.contexts = checkConnection;
  return captureReviewDeltaInput('github.com:Proto-UI/Proto-UI', 487, {
    runner(command, args, settings) {
      const response = JSON.parse(fixture.runner(command, args, settings));
      if (response?.data?.viewer) response.data.viewer.login = viewer;
      return JSON.stringify(response);
    },
    now: () => new Date(timestamp),
  });
}
function statusNote(fixture) {
  fixture.data.comments.push({ id: 'IC_status', author: { login: 'status-bot' }, body: 'Investigation continues; acceptance is unchanged.', updatedAt: timestamp });
}
function setup(change = statusNote, captureOptions = {}) {
  const beforeCollection = capture(() => {}, captureOptions);
  const afterCollection = capture(change, captureOptions);
  const priorPacket = reviewPacket(beforeCollection.input, {
    scope: [...scopes], findings: [structuredClone(priorFinding)], recommendedAction: 'COMMENT',
    reconciliation: { priorReviewedHeadSha: null, priorPacketDigest: null, resolvedFindingIds: [], openFindingIds: [], newFindingIds: [priorFinding.id] },
    unknowns: ['Prior public consumer acceptance is still pending'],
  });
  const options = { before: beforeCollection.input, after: afterCollection.input, priorPacket, beforeCollection, afterCollection, policy };
  return { ...options, currentCollection: structuredClone(afterCollection), plan: planReviewDelta(options) };
}
function decisionsFor(plan, overrides = {}) {
  return {
    schemaVersion: 1, kind: 'proto-ui.review-delta-decisions', planDigest: plan.planDigest,
    reviewer: 'reviewer', observedAt: timestamp, recommendedAction: 'COMMENT',
    deltaDispositions: plan.deltas.map((delta) => ({
      deltaId: delta.id, classification: 'status-only', action: 'retain', scopeIds: [],
      rationale: 'Read the entire changed note and checked it against all prior scopes; it adds no defect, withdrawn evidence or acceptance requirement.',
    })),
    scopeReviews: [], packetUpdates: {}, findingChanges: { added: [], updated: [], resolved: [] },
    workLog: { manualPacketFieldsReentered: 0, repeatedMaterialReads: 0, testExecutions: 0, note: 'Injected status-only control; counts describe this reviewer decision, not an independently observed human session.' },
    ...overrides,
  };
}
function reopened(plan, classification = 'review-material', scopeIds = [scopes[0]]) {
  return plan.deltas.map((delta) => ({ deltaId: delta.id, classification, action: 'reopen', scopeIds, rationale: 'The complete retained delta affects the named original scope and requires renewed judgment.' }));
}
function reviewedScope(plan, findingIds = []) {
  return { scopeId: scopes[0], rationale: 'Reviewed the changed source condition and its current evidence within the original scope.', materialIds: plan.deltas.map((delta) => delta.materialId), findingIds };
}
function runCli(t, options, decisions = null, current = options.currentCollection) {
  const evidenceRoot = process.env.PUI_REVIEW_DELTA_EVIDENCE_DIR;
  if (evidenceRoot) fs.mkdirSync(evidenceRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(evidenceRoot ?? os.tmpdir(), 'pui840-'));
  if (!evidenceRoot) t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const files = {
    before: options.beforeCollection, after: options.afterCollection, prior: options.priorPacket,
    ...(decisions ? { decisions, current } : {}),
  };
  const filenames = {};
  for (const [name, value] of Object.entries(files)) {
    filenames[name] = path.join(directory, `${name}.json`);
    fs.writeFileSync(filenames[name], JSON.stringify(value));
  }
  const preimages = new Map(Object.values(filenames).map((file) => [file, fs.readFileSync(file)]));
  const args = [cli, decisions ? 'reconcile' : 'plan', '--before', filenames.before, '--after', filenames.after, '--prior-packet', filenames.prior,
    ...(decisions ? ['--decisions', filenames.decisions, '--current', filenames.current] : [])];
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (evidenceRoot) {
    const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(path.join(directory, 'stdout.json'), result.stdout ?? '');
    fs.writeFileSync(path.join(directory, 'stderr.txt'), result.stderr ?? '');
    const sources = [cli, fileURLToPath(import.meta.url), ...[
      '../review-runtime.mjs', '../collect-live-review-input.mjs', '../review-pagination.mjs',
      './fixtures/review-pagination.mjs', './fixtures/review-publication.mjs',
      '../../../internal/agent-operations/capability-policy.yaml',
    ].map((name) => fileURLToPath(new URL(name, import.meta.url)))];
    fs.writeFileSync(path.join(directory, 'invocation.json'), JSON.stringify({
      test: t.name, command: [process.execPath, ...args], cwd: root,
      exitCode: result.status, signal: result.signal,
      inputs: Object.fromEntries([...preimages].map(([file, bytes]) => [file, digest(bytes)])),
      sources: Object.fromEntries(sources.map((file) => [file, digest(fs.readFileSync(file))])),
      stdoutSha256: digest(result.stdout ?? ''), stderrSha256: digest(result.stderr ?? ''),
      lineage: 'before + prior → plan; after + bound decisions + current → candidate or preserved blocked result',
      inputKind: 'injected collector/CLI control, not live GitHub evidence',
    }, null, 2));
  }
  for (const [file, bytes] of preimages) assert.deepEqual(fs.readFileSync(file), bytes, 'read-only CLI changed an input');
  assert.equal(result.signal, null, result.stderr);
  return { ...result, output: result.stdout ? JSON.parse(result.stdout) : null };
}

test('I0 to I1 reports exact additions/edits/removals, all authors and unchanged prior scope/finding coverage', () => {
  const options = setup((fixture) => {
    statusNote(fixture);
    fixture.data.comments[0].body = 'A concrete defect replaces the earlier status.';
    fixture.data.reviews.splice(0, 1);
    fixture.data.reviewThreads[0].isResolved = false;
  });
  const { plan } = options;
  assert(plan.deltas.some((delta) => delta.materialId === 'comments:"IC_status"' && delta.change === 'added' && delta.after.author === 'status-bot'));
  assert(plan.deltas.some((delta) => delta.materialId === 'comments:"IC_0"' && delta.change === 'modified' && delta.before.body === 'Comment 0' && delta.after.body.includes('concrete defect')));
  assert(plan.deltas.some((delta) => delta.collection === 'reviews' && delta.change === 'removed' && delta.before.body === 'Review 0'));
  assert(plan.deltas.some((delta) => delta.collection === 'threads' && delta.requiredAction === 'reopen'));
  assert(plan.deltas.some((delta) => delta.collection === 'reviewerPermissions' && delta.change === 'removed'));
  assert.deepEqual(plan.priorCoverage.scopeIds, scopes);
  assert.deepEqual(plan.priorCoverage.findingIds, [priorFinding.id]);
  assert.deepEqual(plan.pendingDeltaIds, plan.deltas.map((delta) => delta.id));
  assert.equal(plan.binding.beforeInputDigest, computeReviewInputDigest(options.before));
  assert.equal(plan.binding.afterInputDigest, computeReviewInputDigest(options.after));
  assert.equal(plan.binding.priorPacketDigest, computeReviewPacketDigest(options.priorPacket));
  assert.equal(plan.writeOperationsPerformed, 0);
});

test('fixed inputs replay deterministically and identical/reordered canonical input is no-change', () => {
  const options = setup();
  assert.deepEqual(planReviewDelta(options), options.plan);
  const after = structuredClone(options.before);
  for (const field of ['checks', 'comments', 'reviews', 'threads', 'replies', 'commits']) after[field].reverse();
  const plan = planReviewDelta({ ...options, after, afterCollection: null });
  assert.equal(plan.status, 'no-change');
  assert.deepEqual(plan.deltas, []);
  assert.equal(plan.binding.beforeInputDigest, plan.binding.afterInputDigest);
  assert.equal(reconcileReviewDelta({ ...options, after, afterCollection: null }).candidate, null);
});

test('CLI positive control carries all prior packet fields, evidence, finding chain and unrun work after one explicit delta disposition', (t) => {
  const options = setup();
  const planRun = runCli(t, options);
  assert.equal(planRun.status, 0, planRun.stderr);
  assert.equal(planRun.output.status, 'review-required');
  assert.equal(planRun.output.deltas.length, 1);
  const result = runCli(t, options, decisionsFor(planRun.output));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output.status, 'candidate');
  const { candidate, work } = result.output;
  validateReviewPacket(candidate, options.after);
  verifyReconciliation(candidate, options.priorPacket);
  verifyLiveReviewInput(candidate, options.after);
  assert.throws(() => verifyLiveReviewInput(options.priorPacket, options.after), /canonical review input/);
  assert.throws(() => validatePublishedReviewPacket(candidate, options.priorPacket), /changed published review content/);
  assert.deepEqual(candidate.findings, options.priorPacket.findings);
  assert.deepEqual(candidate.validation, options.priorPacket.validation);
  assert.deepEqual(candidate.agentEvidence, options.priorPacket.agentEvidence);
  assert.deepEqual(candidate.unknowns, options.priorPacket.unknowns);
  assert.deepEqual(candidate.scope, scopes);
  assert.deepEqual(candidate.reconciliation.openFindingIds, [priorFinding.id]);
  assert.deepEqual(candidate.reconciliation.newFindingIds, []);
  assert.equal(candidate.reconciliation.priorPacketDigest, computeReviewPacketDigest(options.priorPacket));
  assert(result.output.scopeDisposition.every((scope) => scope.action === 'retained'));
  assert.equal(work.packetFieldsSupplied, 0);
  assert.equal(work.findingChangesSupplied, 0);
  assert.equal(work.deltaDispositionsSupplied, 1);
  assert(work.unchangedMaterialCount > 10);
  assert.deepEqual(work.reviewerReported, decisionsFor(options.plan).workLog);
  assert.equal(result.output.mutationAuthorized, false);
  assert.equal(result.output.writeOperationsPerformed, 0);
});

test('unhandled deltas and unfinished reopened scopes cannot produce a packet through the actual CLI', (t) => {
  const options = setup();
  const unhandled = runCli(t, options, decisionsFor(options.plan, { deltaDispositions: [] }));
  assert.equal(unhandled.status, 2, unhandled.stderr);
  assert.equal(unhandled.output.candidate, null);
  assert.equal(unhandled.output.pendingDeltaIds.length, 1);
  const reopenedRun = runCli(t, options, decisionsFor(options.plan, { deltaDispositions: reopened(options.plan, 'defect') }));
  assert.equal(reopenedRun.status, 2, reopenedRun.stderr);
  assert.equal(reopenedRun.output.candidate, null);
  assert.deepEqual(reopenedRun.output.pendingScopeIds, [scopes[0]]);
});

test('reviewer-classified defect reopens its original scope, requires a finding, and retains the other completed scope', () => {
  const options = setup((fixture) => {
    fixture.data.comments[0].body = 'A concrete failure violates the original retained condition.';
  });
  const added = { ...priorFinding, id: 'NEW-DEFECT-002', observed: 'New defect described by the edited comment' };
  const decisions = decisionsFor(options.plan, {
    deltaDispositions: reopened(options.plan, 'defect'),
    scopeReviews: [reviewedScope(options.plan, [added.id])], findingChanges: { added: [added], updated: [], resolved: [] },
  });
  const result = reconcileReviewDelta({ ...options, decisions });
  assert.equal(result.status, 'candidate');
  assert.deepEqual(result.candidate.findings.map((finding) => finding.id), [priorFinding.id, added.id]);
  assert.deepEqual(result.candidate.reconciliation.openFindingIds, [priorFinding.id]);
  assert.deepEqual(result.candidate.reconciliation.newFindingIds, [added.id]);
  assert.deepEqual(result.scopeDisposition, [{ scopeId: scopes[0], action: 'reopened' }, { scopeId: scopes[1], action: 'retained' }]);
  assert.throws(() => reconcileReviewDelta({ ...options, decisions: { ...decisions, scopeReviews: [reviewedScope(options.plan)], findingChanges: { added: [], updated: [], resolved: [] } } }), /defect disposition requires a current finding/);
  const retainingDefect = decisionsFor(options.plan);
  retainingDefect.deltaDispositions[0].classification = 'defect';
  assert.throws(() => reconcileReviewDelta({ ...options, decisions: retainingDefect }), /substantive delta cannot retain/);
});

test('withdrawn/edited evidence, acceptance body changes and reopened threads cannot be silently retained', () => {
  for (const change of [
    (fixture) => fixture.data.comments.splice(0, 1),
    (fixture) => { fixture.state.body = 'Changed acceptance requires a new consumer outcome.'; },
    (fixture) => { fixture.data.reviewThreads[0].isResolved = false; },
    (fixture) => { fixture.data.replies.get('PRRT_0')[0].body = 'Original evidence is withdrawn.'; fixture.data.reviewThreads[0].comments.nodes[0].body = 'Original evidence is withdrawn.'; },
  ]) {
    const options = setup(change);
    const review = decisionsFor(options.plan, { deltaDispositions: reopened(options.plan, 'evidence-withdrawal') });
    const result = reconcileReviewDelta({ ...options, decisions: review });
    assert.equal(result.status, 'incomplete');
    assert.equal(result.candidate, null);
    assert.deepEqual(result.pendingScopeIds, [scopes[0]]);
    for (const delta of options.plan.deltas.filter((item) => item.requiredAction === 'reopen')) {
      const invalid = decisionsFor(options.plan);
      assert(invalid.deltaDispositions.some((item) => item.deltaId === delta.id));
      assert.throws(() => reconcileReviewDelta({ ...options, decisions: invalid }), /requires reopening|cannot be waived/);
    }
  }
});

test('failing/unknown trusted CI or DCO, permission revocation, draft and provider/workflow changes block even completed reviewer decisions', async (t) => {
  const controls = {
    'failed-CI': (fixture) => { fixture.data.checks[0].conclusion = 'FAILURE'; },
    'unknown-CI': (fixture) => { fixture.data.checks[0].conclusion = null; fixture.data.checks[0].status = 'IN_PROGRESS'; },
    'failed-DCO': (fixture) => { fixture.data.checks.at(-1).conclusion = 'FAILURE'; },
    'unknown-DCO-provider': (fixture) => { fixture.data.checks.at(-1).checkSuite.app.id = 'APP_untrusted'; },
    'changed-workflow': (fixture) => { fixture.data.checks[0].checkSuite.workflowRun.file.path = '.github/workflows/other.yml'; },
    'changed-source': (fixture) => { fixture.data.checks[0].checkSuite.app.slug = 'untrusted-ci'; },
    'draft-target': (fixture) => { fixture.state.isDraft = true; },
    'revoked-reviewer': (fixture) => { fixture.data.reviews.splice(0, 1); },
    'downgraded-reviewer': (fixture) => {
      const runner = fixture.runner;
      fixture.runner = (...args) => {
        const response = JSON.parse(runner(...args));
        if (response?.permission === 'write') response.permission = 'read';
        return JSON.stringify(response);
      };
    },
  };
  for (const [name, change] of Object.entries(controls)) await t.test(name, () => {
    const options = setup(change);
    assert.equal(options.plan.status, 'blocked', name);
    assert(options.plan.blockers.length > 0);
    const decisions = decisionsFor(options.plan, { deltaDispositions: reopened(options.plan), scopeReviews: [reviewedScope(options.plan)] });
    assert.equal(reconcileReviewDelta({ ...options, decisions }).candidate, null);
  });
});

test('head/base/ref and same-head source-list changes require rescoping rather than inheriting old green evidence', () => {
  const options = setup();
  for (const field of ['baseSha', 'headSha', 'baseRefName']) {
    const after = structuredClone(options.after);
    after[field] = field === 'baseRefName' ? 'other-base' : 'c'.repeat(40);
    if (field === 'headSha') for (const permission of after.reviewerPermissions) permission.headSha = after.headSha;
    if (field === 'headSha') after.reviewerPermissions = [];
    const plan = planReviewDelta({ ...options, after, afterCollection: null });
    assert.equal(plan.status, 'requires-rescope');
    assert(plan.deltas.some((delta) => delta.requiredAction === 'rescope'));
  }
  const after = structuredClone(options.after);
  after.changedFiles[0].path = 'src/retargeted.mjs';
  assert.equal(planReviewDelta({ ...options, after, afterCollection: null }).status, 'requires-rescope');
});

test('finding resolution is explicit, cumulative and scoped; old identities and unfinished work cannot be retargeted or erased', () => {
  const options = setup();
  const decisions = decisionsFor(options.plan, {
    deltaDispositions: reopened(options.plan), scopeReviews: [reviewedScope(options.plan)],
    findingChanges: { added: [], updated: [], resolved: [{ id: priorFinding.id, rationale: 'Current evidence resolves this exact original condition.', scopeIds: [scopes[0]] }] },
  });
  const result = reconcileReviewDelta({ ...options, decisions });
  assert.equal(result.status, 'candidate');
  assert.deepEqual(result.candidate.findings, []);
  assert.deepEqual(result.candidate.reconciliation.resolvedFindingIds, [priorFinding.id]);
  verifyReconciliation(result.candidate, options.priorPacket);
  const retarget = structuredClone(decisions);
  retarget.findingChanges = { added: [], updated: [{ ...priorFinding, file: 'src/other.mjs' }], resolved: [] };
  assert.throws(() => reconcileReviewDelta({ ...options, decisions: retarget }), /cannot retarget file/);
  const dropped = structuredClone(decisions);
  dropped.packetUpdates.unknowns = [];
  assert.throws(() => reconcileReviewDelta({ ...options, decisions: dropped }), /prior unfinished unknowns/);
  const changedScope = structuredClone(decisions);
  changedScope.packetUpdates.scope = ['easier replacement'];
  assert.throws(() => reconcileReviewDelta({ ...options, decisions: changedScope }), /retargets scope/);
  const oldResolved = { ...priorFinding, id: 'OLD-RESOLVED-000' };
  const ancestor = reviewPacket(options.before, {
    findings: [oldResolved, priorFinding],
    reconciliation: { priorReviewedHeadSha: null, priorPacketDigest: null, resolvedFindingIds: [], openFindingIds: [], newFindingIds: [oldResolved.id, priorFinding.id] },
  });
  const priorPacket = {
    ...options.priorPacket,
    reconciliation: {
      priorReviewedHeadSha: ancestor.headSha, priorPacketDigest: computeReviewPacketDigest(ancestor),
      resolvedFindingIds: [oldResolved.id], openFindingIds: [priorFinding.id], newFindingIds: [],
    },
  };
  const chained = { ...options, priorPacket };
  const plan = planReviewDelta(chained);
  const reusedId = decisionsFor(plan, {
    deltaDispositions: reopened(plan), scopeReviews: [reviewedScope(plan, [oldResolved.id])],
    findingChanges: { added: [oldResolved], updated: [], resolved: [] },
  });
  assert.throws(() => reconcileReviewDelta({ ...chained, decisions: reusedId }), /historical finding ID/);
});

test('deleted and edited external sources retain both literal versions/digests and require reopened scope', () => {
  const options = setup();
  const before = structuredClone(options.before);
  before.externalEvidence = [{ kind: 'source', locator: 'https://example.org/original', digest: '1'.repeat(64) }, { kind: 'receipt', locator: 'https://example.org/old', digest: '2'.repeat(64) }];
  const after = structuredClone(before);
  after.externalEvidence[0].digest = '3'.repeat(64);
  after.externalEvidence.pop();
  const priorPacket = reviewPacket(before, { scope: [...scopes] });
  const plan = planReviewDelta({ ...options, before, after, priorPacket, beforeCollection: null, afterCollection: null });
  assert.equal(plan.deltas.length, 2);
  assert(plan.deltas.every((delta) => delta.requiredAction === 'reopen'));
  assert(plan.deltas.some((delta) => delta.before.digest === '1'.repeat(64) && delta.after?.digest === '3'.repeat(64)));
  assert(plan.deltas.some((delta) => delta.before.digest === '2'.repeat(64) && delta.after === null));
});

test('collection replay rejects incomplete pagination, duplicate IDs, unconsumed pages and changes between complete scans', () => {
  const collected = capture(() => {}, { large: true });
  const proof = replayReviewDeltaCollection(collected, collected.input);
  assert(proof.requests > 10);
  const short = structuredClone(collected);
  short.requests.splice(1, 1);
  assert.throws(() => replayReviewDeltaCollection(short, short.input), /request order|incomplete/);
  const incomplete = structuredClone(collected);
  const raw = JSON.parse(incomplete.requests[0].response);
  raw.data.repository.pullRequest.comments.pageInfo.hasNextPage = false;
  incomplete.requests[0].response = JSON.stringify(raw);
  assert.throws(() => replayReviewDeltaCollection(incomplete, incomplete.input), /unique count does not match total count/);
  const duplicated = structuredClone(collected);
  const payload = JSON.parse(duplicated.requests[0].response);
  payload.data.repository.pullRequest.comments.nodes[1].id = payload.data.repository.pullRequest.comments.nodes[0].id;
  duplicated.requests[0].response = JSON.stringify(payload);
  assert.throws(() => replayReviewDeltaCollection(duplicated, duplicated.input), /duplicates an item identity/);
  const extra = structuredClone(collected);
  extra.requests.push(structuredClone(extra.requests.at(-1)));
  assert.throws(() => replayReviewDeltaCollection(extra, extra.input), /unconsumed requests/);
  const changed = structuredClone(collected);
  const starts = changed.requests.filter((request) => request.args.some((arg) => arg.startsWith('query=query ProtoUiReviewInput(')));
  assert.equal(starts.length, 2);
  const second = JSON.parse(starts[1].response);
  second.data.repository.pullRequest.comments.nodes[0].body = 'Edited between complete scans';
  starts[1].response = JSON.stringify(second);
  assert.throws(() => replayReviewDeltaCollection(changed, changed.input), /changed between complete collection scans/);
});

test('ambiguous canonical IDs and legacy inputs fail closed instead of filtering material', () => {
  const options = setup();
  for (const field of ['checks', 'changedFiles', 'externalEvidence']) {
    const after = structuredClone(options.after);
    if (field === 'externalEvidence') after.externalEvidence = [{ kind: 'source', locator: 'same', digest: '1'.repeat(64) }];
    after[field].push(structuredClone(after[field][0]));
    assert.throws(() => planReviewDelta({ ...options, after, afterCollection: null }), /ambiguous material identity/);
  }
  const legacy = structuredClone(options.before);
  legacy.schemaVersion = 4;
  assert.throws(() => planReviewDelta({ ...options, before: legacy }), /must be re-collected/);
});

test('stale decisions, same-head concurrent drift and missing complete source records never produce a candidate', (t) => {
  const options = setup();
  const stale = decisionsFor(options.plan);
  stale.planDigest = '0'.repeat(64);
  assert.throws(() => reconcileReviewDelta({ ...options, decisions: stale }), /another delta plan/);
  const current = capture((fixture) => { statusNote(fixture); fixture.data.comments[0].body = 'A later same-head change'; });
  const drift = runCli(t, options, decisionsFor(options.plan), current);
  assert.equal(drift.status, 2, drift.stderr);
  assert.equal(drift.output.candidate, null);
  assert(drift.output.blockers.includes('concurrent-input-change-replan-required'));
  const raw = { ...options, beforeCollection: null, afterCollection: null };
  const plan = planReviewDelta(raw);
  const missing = reconcileReviewDelta({ ...raw, decisions: decisionsFor(plan) });
  assert.equal(missing.status, 'blocked');
  assert(missing.blockers.includes('complete-collection-unverified'));
  assert.equal(missing.candidate, null);
});

test('candidate generation cannot create a contributor self-disposition or manufacture a publication', () => {
  const options = setup();
  const current = structuredClone(options.currentCollection);
  const self = decisionsFor(options.plan, { reviewer: 'author', recommendedAction: 'APPROVE' });
  const blocked = reconcileReviewDelta({ ...options, currentCollection: current, decisions: self });
  assert.equal(blocked.status, 'blocked');
  assert(blocked.blockers.includes('reviewer-does-not-match-current-collector'));
  const selfOptions = setup(statusNote, { viewer: 'author' });
  assert.throws(() => reconcileReviewDelta({
    ...selfOptions,
    decisions: decisionsFor(selfOptions.plan, { reviewer: 'author', recommendedAction: 'APPROVE' }),
  }), /cannot be a self disposition/);
  const candidate = reconcileReviewDelta({ ...options, decisions: decisionsFor(options.plan) }).candidate;
  assert.equal(candidate.kind, 'proto-ui.review-packet');
  assert.notEqual(computeReviewPacketDigest(candidate), computeReviewPacketDigest(options.priorPacket));
  assert.throws(() => verifyLiveReviewInput(candidate, options.before), /canonical review input/);
  assert.throws(() => validatePublishedReviewPacket(candidate, options.priorPacket), /changed published review content/);
});
