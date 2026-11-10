import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { loadCapabilityPolicy } from './assessment-runtime.mjs';
import {
  collectLiveReviewInput,
  MAX_LIVE_COLLECTION_BYTES,
  MAX_LIVE_COLLECTION_REQUESTS,
  summarizeLiveChecks,
  summarizeLiveDco,
} from './collect-live-review-input.mjs';
import {
  computeReviewInputDigest,
  computeReviewPacketDigest,
  validateReviewInputSnapshot,
  validateReviewPacket,
  verifyReconciliation,
} from './review-runtime.mjs';

const COLLECTION_KIND = 'proto-ui.review-delta-collection';
const COLLECTIONS = {
  changedFiles: (item) => item.path,
  commits: (item) => item.sha,
  reviews: (item) => item.id,
  reviewerPermissions: (item) => item.login,
  comments: (item) => item.id,
  replies: (item) => item.id,
  threads: (item) => item.id,
  // Canonical v5 has no native check ID. A name and run URL must be unique;
  // ambiguous/null-URL duplicates fail closed instead of inventing identities.
  checks: (item) => [item.name, item.detailsUrl],
  externalEvidence: (item) => [item.kind, item.locator],
};
const METADATA = [
  'schemaVersion', 'kind', 'repositoryId', 'pullRequest', 'baseRefName', 'baseSha', 'headSha',
  'pullRequestState', 'pullRequestAuthor', 'isDraft', 'pullRequestBody',
];
const TARGET_FIELDS = ['repositoryId', 'pullRequest', 'baseRefName', 'baseSha', 'headSha'];
const UPDATE_FIELDS = [
  'affectedEntities', 'affectedSurfaces', 'validation', 'agentEvidence',
  'limitations', 'unknowns', 'humanGates',
];
const CLASSIFICATIONS = [
  'status-only', 'defect', 'acceptance-change', 'evidence-withdrawal',
  'review-material', 'check-change', 'permission-change', 'thread-change', 'provenance-change',
];
const HEX64 = /^[a-f0-9]{64}$/;
const WRITE_PERMISSIONS = new Set(['WRITE', 'MAINTAIN', 'ADMIN']);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function hash(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function exact(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} has unexpected or missing fields`);
}
function text(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be nonempty`);
}
function unique(values, label) {
  assert(Array.isArray(values), `${label} must be an array`);
  for (const value of values) text(value, label);
  assert.equal(new Set(values).size, values.length, `${label} contains duplicates`);
}
function indexMaterials(input) {
  validateReviewInputSnapshot(input);
  const materials = new Map();
  for (const field of METADATA) materials.set(`metadata:${field}`, { collection: 'metadata', field, value: input[field] });
  for (const [collection, identity] of Object.entries(COLLECTIONS)) {
    for (const value of input[collection]) {
      const id = `${collection}:${JSON.stringify(identity(value))}`;
      assert(!materials.has(id), `ambiguous material identity: ${id}`);
      materials.set(id, { collection, field: null, value });
    }
  }
  const threads = new Set(input.threads.map((thread) => thread.id));
  assert(input.replies.every((reply) => threads.has(reply.threadId)), 'reply references an absent thread');
  return materials;
}

// This captures only the existing collector's bounded gh API reads. A replay
// verifies pagination/count/stability through that same collector, never by
// trusting a caller-provided `complete: true` flag. Saved files are not signed
// attestations; the actual writer must still collect live independently.
export function captureReviewDeltaInput(repositoryId, pullRequest, options = {}) {
  assert(Array.isArray(options.externalEvidence ?? []), 'external evidence must be the canonical array');
  const requests = [];
  const runner = options.runner ?? execFileSync;
  const live = collectLiveReviewInput(repositoryId, pullRequest, {
    externalEvidence: options.externalEvidence ?? [],
    now: options.now,
    runner(command, args, settings) {
      assert.equal(command, 'gh');
      assert.equal(args[0], 'api');
      const response = runner(command, args, settings);
      const bytes = Buffer.isBuffer(response) ? response.toString('utf8') : response;
      assert.equal(typeof bytes, 'string', 'collector response must be UTF-8 JSON');
      requests.push({ args: [...args], response: bytes });
      return response;
    },
  });
  return {
    schemaVersion: 1,
    kind: COLLECTION_KIND,
    input: live.input,
    inputDigest: computeReviewInputDigest(live.input),
    observedAt: live.permissionsObservedAt,
    viewerLogin: live.viewerLogin,
    viewerPermission: live.viewerPermission,
    requests,
  };
}

export function replayReviewDeltaCollection(record, input) {
  exact(record, ['schemaVersion', 'kind', 'input', 'inputDigest', 'observedAt', 'viewerLogin', 'viewerPermission', 'requests'], 'collection');
  assert(record.schemaVersion === 1 && record.kind === COLLECTION_KIND, 'unsupported collection record');
  assert.equal(computeReviewInputDigest(record.input), computeReviewInputDigest(input), 'collection targets another canonical input');
  assert.equal(record.inputDigest, computeReviewInputDigest(input), 'collection digest differs from its input');
  assert(Number.isFinite(Date.parse(record.observedAt)), 'collection observedAt is invalid');
  assert(Array.isArray(record.requests) && record.requests.length > 0 && record.requests.length <= MAX_LIVE_COLLECTION_REQUESTS, 'collection request count is invalid');
  let bytes = 0;
  for (const request of record.requests) {
    exact(request, ['args', 'response'], 'collection request');
    assert(Array.isArray(request.args) && request.args.every((arg) => typeof arg === 'string'), 'collection request arguments are invalid');
    assert.equal(typeof request.response, 'string', 'collection response is invalid');
    bytes += Buffer.byteLength(request.response, 'utf8');
    assert(bytes <= MAX_LIVE_COLLECTION_BYTES, 'collection replay exceeds the collector byte bound');
  }
  let cursor = 0;
  const live = collectLiveReviewInput(input.repositoryId, input.pullRequest, {
    externalEvidence: input.externalEvidence,
    now: () => new Date(record.observedAt),
    runner(command, args) {
      assert.equal(command, 'gh');
      const request = record.requests[cursor++];
      assert(request, 'collection replay is incomplete');
      assert.deepEqual(request.args, args, 'collection replay request order/target differs');
      return request.response;
    },
  });
  assert.equal(cursor, record.requests.length, 'collection replay contains unconsumed requests');
  assert.equal(computeReviewInputDigest(live.input), record.inputDigest, 'replayed collection differs from canonical input');
  assert.equal(live.viewerLogin, record.viewerLogin, 'collection viewer identity differs');
  assert.equal(live.viewerPermission, record.viewerPermission, 'collection viewer permission differs');
  return { digest: hash(record), requests: cursor, bytes, observedAt: record.observedAt, viewerLogin: live.viewerLogin, viewerPermission: live.viewerPermission };
}

function checkState(input, policy) {
  assert(policy?.trustedCiEvidence && policy?.trustedDcoEvidence, 'current trusted CI/DCO policy is required');
  const ci = policy.trustedCiEvidence;
  const dco = policy.trustedDcoEvidence;
  return {
    ci: summarizeLiveChecks(input.checks, {
      repositoryId: input.repositoryId, trustedRepositoryId: ci.repositoryId,
      trustedSource: ci.source, trustedCheckNames: ci.checkNames,
      trustedWorkflowNames: ci.workflowNames, trustedWorkflowPaths: ci.workflowPaths,
    }),
    dco: summarizeLiveDco(input.checks, {
      repositoryId: input.repositoryId, trustedRepositoryId: dco.repositoryId,
      trustedCheckName: dco.checkName, trustedSource: dco.source,
      trustedProviderId: dco.providerId, trustedDetailsUrl: dco.detailsUrl,
    }),
  };
}
function deltaRule(collection, field, change, before, after) {
  if (collection === 'metadata' && TARGET_FIELDS.includes(field)) return 'rescope';
  if (collection === 'changedFiles' || collection === 'commits') return 'rescope';
  if (collection === 'reviewerPermissions') {
    const eligible = (value) => value && ['write', 'admin'].includes(value.permission);
    if (eligible(before) && !eligible(after)) return 'block';
    return 'reopen';
  }
  if (collection === 'checks') {
    const provenance = ['source', 'providerId', 'repository', 'workflowName', 'workflowPath'];
    if (before && after && provenance.some((key) => before[key] !== after[key])) return 'block';
    return 'reopen';
  }
  if (collection === 'threads' && after?.isResolved === false) return 'reopen';
  if (change === 'removed' || collection === 'externalEvidence' || collection === 'reviews' || collection === 'metadata') return 'reopen';
  return 'review';
}

export function planReviewDelta({ before, after, priorPacket, beforeCollection = null, afterCollection = null, policy }) {
  const oldMaterials = indexMaterials(before);
  const newMaterials = indexMaterials(after);
  validateReviewPacket(priorPacket, before);
  assert.equal(priorPacket.schemaVersion, 2, 'delta reconciliation requires a current schema v2 prior packet');
  const priorPacketDigest = computeReviewPacketDigest(priorPacket);
  const binding = {
    repositoryId: before.repositoryId, pullRequest: before.pullRequest,
    baseRefName: before.baseRefName, baseSha: before.baseSha, headSha: before.headSha,
    beforeInputDigest: computeReviewInputDigest(before), afterInputDigest: computeReviewInputDigest(after),
    priorPacketDigest,
  };
  const deltas = [];
  for (const materialId of [...new Set([...oldMaterials.keys(), ...newMaterials.keys()])].sort()) {
    const old = oldMaterials.get(materialId);
    const current = newMaterials.get(materialId);
    if (old && current && isDeepStrictEqual(old.value, current.value)) continue;
    const { collection, field } = current ?? old;
    const change = old ? current ? 'modified' : 'removed' : 'added';
    const beforeValue = old?.value ?? null;
    const afterValue = current?.value ?? null;
    const beforeDigest = old ? hash(old) : null;
    const afterDigest = current ? hash(current) : null;
    deltas.push({
      id: hash({ materialId, change, beforeDigest, afterDigest }), materialId, collection, field,
      change, beforeDigest, afterDigest, before: beforeValue, after: afterValue,
      requiredAction: deltaRule(collection, field, change, beforeValue, afterValue),
      suggestedScopeIds: [...priorPacket.scope],
    });
  }
  const collections = {
    before: beforeCollection ? replayReviewDeltaCollection(beforeCollection, before) : null,
    after: afterCollection ? replayReviewDeltaCollection(afterCollection, after) : null,
  };
  const checks = checkState(after, policy);
  const blockers = [];
  if (checks.ci !== 'success') blockers.push(`current-ci-${checks.ci}`);
  if (checks.dco !== 'success') blockers.push(`current-dco-${checks.dco}`);
  if (after.pullRequestState !== 'OPEN' || after.isDraft) blockers.push('target-not-open-and-ready');
  if (!collections.before || !collections.after) blockers.push('complete-collection-unverified');
  if (collections.before && collections.after &&
      (collections.before.viewerLogin.toLowerCase() !== collections.after.viewerLogin.toLowerCase() ||
       (WRITE_PERMISSIONS.has(collections.before.viewerPermission) && !WRITE_PERMISSIONS.has(collections.after.viewerPermission))))
    blockers.push('collector-identity-or-permission-changed');
  const ranks = { none: 0, read: 1, write: 2, admin: 3 };
  for (const old of before.reviewerPermissions) {
    const current = after.reviewerPermissions.find((item) => item.login === old.login);
    if (!current || ranks[current.permission] < ranks[old.permission]) blockers.push(`reviewer-permission-lost:${old.login}`);
  }
  for (const delta of deltas)
    if (delta.requiredAction === 'block') blockers.push(`unsafe-material-change:${delta.materialId}`);
  const rescope = deltas.some((delta) => delta.requiredAction === 'rescope');
  const status = deltas.length === 0 ? 'no-change' : rescope ? 'requires-rescope' : blockers.length ? 'blocked' : 'review-required';
  const report = {
    schemaVersion: 1, kind: 'proto-ui.review-delta-plan', binding, status,
    deltas, collections, checks, blockers,
    priorCoverage: {
      scopeIds: [...priorPacket.scope], reviewClass: priorPacket.reviewClass,
      recommendedAction: priorPacket.recommendedAction,
      affectedEntities: priorPacket.affectedEntities, affectedSurfaces: priorPacket.affectedSurfaces,
      findingIds: priorPacket.findings.map((finding) => finding.id),
      priorReconciliation: priorPacket.reconciliation,
      limitations: priorPacket.limitations, unknowns: priorPacket.unknowns, humanGates: priorPacket.humanGates,
    },
    pendingDeltaIds: deltas.map((delta) => delta.id),
    unchangedMaterialCount: oldMaterials.size - deltas.filter((delta) => delta.change !== 'added').length,
    mutationAuthorized: false, writeOperationsPerformed: 0,
  };
  return { ...report, planDigest: hash(report) };
}

function validateDecisions(decisions, plan) {
  exact(decisions, [
    'schemaVersion', 'kind', 'planDigest', 'reviewer', 'observedAt', 'recommendedAction',
    'deltaDispositions', 'scopeReviews', 'packetUpdates', 'findingChanges', 'workLog',
  ], 'delta decisions');
  assert(decisions.schemaVersion === 1 && decisions.kind === 'proto-ui.review-delta-decisions', 'unsupported delta decisions');
  assert(HEX64.test(decisions.planDigest) && decisions.planDigest === plan.planDigest, 'decisions target another delta plan');
  text(decisions.reviewer, 'reviewer');
  assert(Number.isFinite(Date.parse(decisions.observedAt)), 'decision observedAt is invalid');
  assert(['APPROVE', 'REQUEST_CHANGES', 'COMMENT', 'ABSTAIN'].includes(decisions.recommendedAction), 'an explicit final review judgment is required');
  assert(Array.isArray(decisions.deltaDispositions), 'delta dispositions must be an array');
  assert(Array.isArray(decisions.scopeReviews), 'scope reviews must be an array');
  const scopes = new Set(plan.priorCoverage.scopeIds);
  const seen = new Set();
  for (const disposition of decisions.deltaDispositions) {
    exact(disposition, ['deltaId', 'classification', 'action', 'scopeIds', 'rationale'], 'delta disposition');
    const delta = plan.deltas.find((item) => item.id === disposition.deltaId);
    assert(delta && !seen.has(delta.id), 'unknown or duplicate delta disposition');
    seen.add(delta.id);
    assert(CLASSIFICATIONS.includes(disposition.classification), 'unknown reviewer delta classification');
    assert(['retain', 'reopen'].includes(disposition.action), 'unknown delta action');
    unique(disposition.scopeIds, 'disposition scopeIds');
    assert(disposition.scopeIds.every((scope) => scopes.has(scope)), 'delta retargets a prior scope');
    text(disposition.rationale, 'delta rationale');
    if (disposition.action === 'retain') {
      assert.equal(delta.requiredAction, 'review', 'this material change requires reopening or blocks reconciliation');
      assert.equal(disposition.classification, 'status-only', 'substantive delta cannot retain all prior judgments');
      assert.equal(disposition.scopeIds.length, 0, 'retained status delta must explicitly declare no affected scopes');
    } else assert(disposition.scopeIds.length > 0, 'reopened delta requires affected scopes');
    if (delta.requiredAction === 'reopen') assert.equal(disposition.action, 'reopen', 'mandatory scope reopening cannot be waived');
  }
  const reopened = new Set(decisions.deltaDispositions.filter((item) => item.action === 'reopen').flatMap((item) => item.scopeIds));
  const reviewed = new Set();
  for (const review of decisions.scopeReviews) {
    exact(review, ['scopeId', 'rationale', 'materialIds', 'findingIds'], 'scope review');
    assert(reopened.has(review.scopeId) && !reviewed.has(review.scopeId), 'scope review is duplicate, retargeted or was not reopened');
    reviewed.add(review.scopeId);
    text(review.rationale, 'scope review rationale');
    unique(review.materialIds, 'scope review materialIds');
    assert(review.materialIds.length > 0, 'completed scope review needs inspected material references');
    unique(review.findingIds, 'scope review findingIds');
  }
  assert(decisions.packetUpdates && typeof decisions.packetUpdates === 'object' && !Array.isArray(decisions.packetUpdates), 'packetUpdates must be an object');
  assert(Object.keys(decisions.packetUpdates).every((key) => UPDATE_FIELDS.includes(key)), 'packet update retargets scope, identity or protected packet fields');
  exact(decisions.findingChanges, ['added', 'updated', 'resolved'], 'finding changes');
  for (const values of Object.values(decisions.findingChanges)) assert(Array.isArray(values), 'finding changes must be arrays');
  const changed = Object.keys(decisions.packetUpdates).length + Object.values(decisions.findingChanges).reduce((count, items) => count + items.length, 0);
  assert(reopened.size > 0 || changed === 0, 'changed judgments/materials require a reopened scope');
  exact(decisions.workLog, ['manualPacketFieldsReentered', 'repeatedMaterialReads', 'testExecutions', 'note'], 'reviewer work log');
  for (const field of ['manualPacketFieldsReentered', 'repeatedMaterialReads', 'testExecutions'])
    assert(Number.isSafeInteger(decisions.workLog[field]) && decisions.workLog[field] >= 0, 'work log counts must be nonnegative integers');
  text(decisions.workLog.note, 'work log note');
  return { reopened, reviewed, seen };
}

export function reconcileReviewDelta(options) {
  const { before, after, priorPacket, currentCollection, decisions } = options;
  const plan = planReviewDelta(options);
  if (plan.status === 'no-change') return { plan, status: 'no-change', candidate: null, mutationAuthorized: false, writeOperationsPerformed: 0 };
  const { reopened, reviewed, seen } = validateDecisions(decisions, plan);
  const pendingDeltaIds = plan.deltas.filter((delta) => !seen.has(delta.id)).map((delta) => delta.id);
  const pendingScopeIds = [...reopened].filter((scope) => !reviewed.has(scope));
  const blockers = [...plan.blockers];
  let current = null;
  if (currentCollection) {
    current = replayReviewDeltaCollection(currentCollection, currentCollection.input);
    if (computeReviewInputDigest(currentCollection.input) !== plan.binding.afterInputDigest)
      blockers.push('concurrent-input-change-replan-required');
    if (plan.collections.after &&
        (current.viewerLogin !== plan.collections.after.viewerLogin || current.viewerPermission !== plan.collections.after.viewerPermission))
      blockers.push('current-reviewer-identity-or-permission-changed');
    if (current.viewerLogin.toLowerCase() !== decisions.reviewer.toLowerCase()) blockers.push('reviewer-does-not-match-current-collector');
    if (Date.parse(decisions.observedAt) < Date.parse(current.observedAt)) blockers.push('judgment-predates-current-collection');
  } else blockers.push('current-complete-collection-required');
  const result = {
    plan, status: 'incomplete', pendingDeltaIds, pendingScopeIds, blockers, currentCollection: current,
    scopeDisposition: plan.priorCoverage.scopeIds.map((scopeId) => ({
      scopeId,
      action: pendingDeltaIds.length ? 'pending' : reopened.has(scopeId) ? 'reopened' : 'retained',
    })),
    reviewer: decisions.reviewer, deltaDispositions: decisions.deltaDispositions, scopeReviews: decisions.scopeReviews,
    work: {
      packetFieldsSupplied: Object.keys(decisions.packetUpdates).length,
      deltaDispositionsSupplied: decisions.deltaDispositions.length,
      findingChangesSupplied: Object.values(decisions.findingChanges).reduce((count, items) => count + items.length, 0),
      unchangedMaterialCount: plan.unchangedMaterialCount,
      reviewerReported: decisions.workLog,
      counterLimit: 'Reviewer-reported human work is not instrumented execution evidence. This CLI launches no product tests.',
    },
    candidate: null, mutationAuthorized: false, writeOperationsPerformed: 0,
  };
  if (plan.status === 'requires-rescope' || blockers.length) return { ...result, status: plan.status === 'requires-rescope' ? 'requires-rescope' : 'blocked' };
  if (pendingDeltaIds.length || pendingScopeIds.length) return result;

  const materialIds = new Set(indexMaterials(after).keys());
  for (const delta of plan.deltas) materialIds.add(delta.materialId); // withdrawn material remains inspected evidence
  for (const review of decisions.scopeReviews)
    assert(review.materialIds.every((id) => materialIds.has(id)), 'scope review cites unavailable material');
  const candidate = { ...structuredClone(priorPacket), ...structuredClone(decisions.packetUpdates) };
  for (const field of ['limitations', 'unknowns', 'humanGates'])
    assert(priorPacket[field].every((item) => candidate[field].includes(item)), `prior unfinished ${field} cannot be discarded by delta preparation`);
  const findings = new Map(candidate.findings.map((finding) => [finding.id, finding]));
  const historicIds = new Set([
    ...findings.keys(), ...priorPacket.reconciliation.resolvedFindingIds,
    ...priorPacket.reconciliation.openFindingIds, ...priorPacket.reconciliation.newFindingIds,
  ]);
  const changedFindingIds = new Set();
  for (const finding of decisions.findingChanges.updated) {
    const old = findings.get(finding.id);
    assert(old && !changedFindingIds.has(finding.id), 'updated finding is absent or duplicated');
    for (const field of ['file', 'line', 'authority', 'expected'])
      assert.equal(finding[field], old[field], `prior finding ${finding.id} cannot retarget ${field}`);
    changedFindingIds.add(finding.id);
    findings.set(finding.id, structuredClone(finding));
  }
  for (const finding of decisions.findingChanges.added) {
    assert(!historicIds.has(finding.id) && !changedFindingIds.has(finding.id), 'new finding reuses a current or historical finding ID');
    changedFindingIds.add(finding.id);
    findings.set(finding.id, structuredClone(finding));
  }
  const resolved = [];
  for (const resolution of decisions.findingChanges.resolved) {
    exact(resolution, ['id', 'rationale', 'scopeIds'], 'finding resolution');
    text(resolution.rationale, 'finding resolution rationale');
    unique(resolution.scopeIds, 'finding resolution scopeIds');
    assert(resolution.scopeIds.length > 0 && resolution.scopeIds.every((scope) => reviewed.has(scope)), 'finding resolution needs completed reopened scopes');
    assert(findings.has(resolution.id) && historicIds.has(resolution.id) && !changedFindingIds.has(resolution.id), 'resolved finding is absent, new or duplicated');
    changedFindingIds.add(resolution.id);
    findings.delete(resolution.id);
    resolved.push(resolution.id);
  }
  const reviewedFindingIds = new Set(decisions.scopeReviews.flatMap((review) => review.findingIds));
  assert([...reviewedFindingIds].every((id) => findings.has(id)), 'scope review cites an absent current finding');
  for (const finding of [...decisions.findingChanges.added, ...decisions.findingChanges.updated])
    assert(reviewedFindingIds.has(finding.id), 'new or updated finding needs completed scope review');
  for (const disposition of decisions.deltaDispositions.filter((item) => item.classification === 'defect'))
    assert(decisions.scopeReviews.some((review) => disposition.scopeIds.includes(review.scopeId) && review.findingIds.length > 0), 'defect disposition requires a current finding in a reviewed affected scope');
  candidate.findings = [...findings.values()];
  candidate.reviewInputDigest = plan.binding.afterInputDigest;
  candidate.observedAt = decisions.observedAt;
  candidate.recommendedAction = decisions.recommendedAction;
  candidate.reconciliation = {
    priorReviewedHeadSha: priorPacket.headSha, priorPacketDigest: plan.binding.priorPacketDigest,
    resolvedFindingIds: resolved,
    openFindingIds: priorPacket.findings.filter((finding) => findings.has(finding.id)).map((finding) => finding.id),
    newFindingIds: candidate.findings.filter((finding) => !historicIds.has(finding.id)).map((finding) => finding.id),
  };
  if (['APPROVE', 'REQUEST_CHANGES'].includes(candidate.recommendedAction)) {
    assert(current && WRITE_PERMISSIONS.has(current.viewerPermission), 'disposition requires current repository review permission');
    const reviewer = decisions.reviewer.toLowerCase();
    assert.notEqual(reviewer, after.pullRequestAuthor.toLowerCase(), 'candidate cannot be a self disposition');
    for (const commit of after.commits) for (const role of ['author', 'committer']) {
      assert(commit[role].login !== null || commit[role].platform !== null, 'unavailable contributor identity blocks a disposition');
      assert.notEqual(commit[role].login?.toLowerCase(), reviewer, 'candidate reviewer contributed to the change');
    }
  }
  validateReviewPacket(candidate, after);
  verifyReconciliation(candidate, priorPacket);
  return { ...result, status: 'candidate', candidate, candidateDigest: computeReviewPacketDigest(candidate) };
}

function readJson(file) {
  assert(file, 'required input file is missing');
  const stat = fs.statSync(file);
  assert(stat.isFile() && stat.size <= MAX_LIVE_COLLECTION_BYTES, 'input file is not regular or exceeds collection byte bound');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function readSnapshot(file) {
  const value = readJson(file);
  const collection = value?.kind === COLLECTION_KIND ? value : null;
  return { input: validateReviewInputSnapshot(collection ? collection.input : value), collection };
}
const USAGE = [
  'Read-only review delta preparation; stdout only, never review/merge publication.',
  'node scripts/agent-operations/review-delta.mjs capture --repository github.com:owner/repo --pull-request N [--external-evidence evidence.json]',
  'node scripts/agent-operations/review-delta.mjs plan --before I0.json --after I1.json --prior-packet packet.json',
  'node scripts/agent-operations/review-delta.mjs reconcile --before I0.json --after I1.json --prior-packet packet.json --decisions decisions.json --current current-collection.json',
  'plan accepts canonical v5 inputs or complete capture records. reconcile requires complete before/after/current capture replays.',
  'No-change emits no candidate. Incomplete/blocked/rescope reconciliation exits2. Existing live review preflight still applies.',
].join('\n');

export function runReviewDeltaCli(argv) {
  const [command, ...rest] = argv[0] === '--' ? argv.slice(1) : argv;
  const allowed = command === 'capture' ? ['--repository', '--pull-request', '--external-evidence'] :
    command === 'plan' ? ['--before', '--after', '--prior-packet'] :
    command === 'reconcile' ? ['--before', '--after', '--prior-packet', '--decisions', '--current'] : null;
  assert(allowed && rest.length % 2 === 0, USAGE);
  const args = new Map();
  for (let index = 0; index < rest.length; index += 2) {
    assert(allowed.includes(rest[index]) && !args.has(rest[index]) && rest[index + 1], USAGE);
    args.set(rest[index], rest[index + 1]);
  }
  if (command === 'capture') {
    assert(args.has('--repository') && args.has('--pull-request'), USAGE);
    return { exitCode: 0, output: captureReviewDeltaInput(args.get('--repository'), Number(args.get('--pull-request')), {
      externalEvidence: args.has('--external-evidence') ? readJson(args.get('--external-evidence')) : [],
    }) };
  }
  const before = readSnapshot(args.get('--before'));
  const after = readSnapshot(args.get('--after'));
  const options = {
    before: before.input, after: after.input, priorPacket: readJson(args.get('--prior-packet')),
    beforeCollection: before.collection, afterCollection: after.collection,
    policy: loadCapabilityPolicy(new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)),
  };
  if (command === 'plan') return { exitCode: 0, output: planReviewDelta(options) };
  const output = reconcileReviewDelta({ ...options, decisions: readJson(args.get('--decisions')), currentCollection: readJson(args.get('--current')) });
  return { exitCode: ['candidate', 'no-change'].includes(output.status) ? 0 : 2, output };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runReviewDeltaCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result.output, null, 2)}\n`);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`[review-delta] ${error.message}\n`);
    process.exitCode = 1;
  }
}
