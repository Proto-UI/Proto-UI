import { createHash } from 'node:crypto';

const SHA = /^[a-f0-9]{40,64}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const RFC3339 = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;
const BANDS = ['U0', 'C1', 'C2', 'C3', 'C4'];
const RECOMMENDATIONS = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT', 'ABSTAIN'];
const REVIEW_CLASSES = [
  'review-facts-and-ci',
  'review-docs-and-links',
  'review-tests',
  'review-bounded-regression',
  'review-governed-implementation-slice',
  'review-cross-domain-semantics',
  'review-governance-and-release-evidence',
];
const RECOMMENDATION_RANK = new Map([
  ['ABSTAIN', 0],
  ['COMMENT', 1],
  ['REQUEST_CHANGES', 2],
  ['APPROVE', 3],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} is invalid`);
  assert(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    `${label} has unexpected or missing fields`
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])])
    );
  }
  return value;
}

function digest(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

function validateStrings(value, label, { min = 0 } = {}) {
  assert(
    Array.isArray(value) && value.length >= min,
    `${label} must contain at least ${min} item(s)`
  );
  assert(
    value.every((item) => typeof item === 'string' && item.length > 0),
    `${label} must contain non-empty strings`
  );
  assert(new Set(value).size === value.length, `${label} must not contain duplicates`);
}

function validateTimestamp(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return;
  assert(
    typeof value === 'string' && RFC3339.test(value) && Number.isFinite(Date.parse(value)),
    `${label} is invalid`
  );
}

function validateInputItems(items, fields, label, validator) {
  assert(Array.isArray(items), `${label} must be an array`);
  for (const item of items) {
    exactKeys(item, fields, `${label} item`);
    validator(item);
  }
}

export function validateReviewInputSnapshot(input) {
  exactKeys(
    input,
    [
      'schemaVersion',
      'kind',
      'repositoryId',
      'pullRequest',
      'baseSha',
      'headSha',
      'pullRequestBody',
      'commits',
      'replies',
      'threads',
      'checks',
      'externalEvidence',
    ],
    'review input'
  );
  assert(input.schemaVersion === 1, 'review input schemaVersion is invalid');
  assert(input.kind === 'proto-ui.review-input', 'review input kind is invalid');
  assert(
    typeof input.repositoryId === 'string' && input.repositoryId.length > 3,
    'review input repositoryId is required'
  );
  assert(
    Number.isInteger(input.pullRequest) && input.pullRequest > 0,
    'review input PR is invalid'
  );
  assert(SHA.test(input.baseSha) && SHA.test(input.headSha), 'review input SHAs are invalid');
  assert(typeof input.pullRequestBody === 'string', 'review input PR body is invalid');
  validateInputItems(input.commits, ['sha', 'message'], 'review input commits', (item) => {
    assert(SHA.test(item.sha), 'review input commit SHA is invalid');
    assert(typeof item.message === 'string', 'review input commit message is invalid');
  });
  validateInputItems(
    input.replies,
    ['id', 'threadId', 'updatedAt', 'author', 'body'],
    'review input replies',
    (item) => {
      for (const field of ['id', 'threadId', 'author']) {
        assert(
          typeof item[field] === 'string' && item[field].length > 0,
          `reply ${field} is invalid`
        );
      }
      assert(typeof item.body === 'string', 'reply body is invalid');
      validateTimestamp(item.updatedAt, 'reply updatedAt');
    }
  );
  validateInputItems(
    input.threads,
    ['id', 'isResolved', 'updatedAt'],
    'review input threads',
    (item) => {
      assert(typeof item.id === 'string' && item.id.length > 0, 'thread id is invalid');
      assert(typeof item.isResolved === 'boolean', 'thread resolution is invalid');
      validateTimestamp(item.updatedAt, 'thread updatedAt');
    }
  );
  validateInputItems(
    input.checks,
    ['name', 'status', 'conclusion', 'completedAt', 'detailsUrl'],
    'review input checks',
    (item) => {
      for (const field of ['name', 'status']) {
        assert(
          typeof item[field] === 'string' && item[field].length > 0,
          `check ${field} is invalid`
        );
      }
      // CheckRun.detailsUrl and StatusContext.targetUrl are nullable in the
      // GitHub GraphQL schema; a check without a details link is valid input.
      assert(
        item.detailsUrl === null ||
          (typeof item.detailsUrl === 'string' && item.detailsUrl.length > 0),
        'check detailsUrl is invalid'
      );
      assert(
        item.conclusion === null ||
          (typeof item.conclusion === 'string' && item.conclusion.length > 0),
        'check conclusion is invalid'
      );
      validateTimestamp(item.completedAt, 'check completedAt', { nullable: true });
    }
  );
  validateInputItems(
    input.externalEvidence,
    ['kind', 'locator', 'digest'],
    'review input externalEvidence',
    (item) => {
      for (const field of ['kind', 'locator']) {
        assert(
          typeof item[field] === 'string' && item[field].length > 0,
          `external evidence ${field} is invalid`
        );
      }
      assert(HEX64.test(item.digest), 'external evidence digest is invalid');
    }
  );
  for (const [items, key, label] of [
    [input.commits, (item) => item.sha, 'commit SHA'],
    [input.replies, (item) => item.id, 'reply id'],
    [input.threads, (item) => item.id, 'thread id'],
  ]) {
    const values = items.map(key);
    assert(new Set(values).size === values.length, `review input duplicates ${label}`);
  }
  return input;
}

function canonicalReviewInput(input) {
  validateReviewInputSnapshot(input);
  const clone = structuredClone(input);
  const compareCanonical = (left, right) => {
    const leftKey = JSON.stringify(canonicalJson(left));
    const rightKey = JSON.stringify(canonicalJson(right));
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  };
  for (const field of ['commits', 'replies', 'threads', 'checks', 'externalEvidence']) {
    clone[field].sort(compareCanonical);
  }
  return clone;
}

export function computeReviewInputDigest(input) {
  return digest(canonicalReviewInput(input));
}

function validateValidation(validation) {
  exactKeys(validation, ['commands', 'checksNotRun'], 'review packet validation');
  assert(Array.isArray(validation.commands), 'validation.commands must be an array');
  assert(Array.isArray(validation.checksNotRun), 'validation.checksNotRun must be an array');
  assert(
    validation.commands.length + validation.checksNotRun.length > 0,
    'review packet must record a validation command or an explicitly skipped check'
  );
  for (const command of validation.commands) {
    exactKeys(command, ['command', 'exitCode', 'result'], 'validation command');
    assert(
      typeof command.command === 'string' && command.command.length > 0,
      'validation command is required'
    );
    assert(Number.isInteger(command.exitCode), 'validation command exitCode is invalid');
    assert(
      typeof command.result === 'string' && command.result.length > 0,
      'validation command result is required'
    );
  }
  for (const skipped of validation.checksNotRun) {
    exactKeys(skipped, ['check', 'reason'], 'skipped check');
    assert(
      typeof skipped.check === 'string' && skipped.check.length > 0,
      'skipped check name is required'
    );
    assert(
      typeof skipped.reason === 'string' && skipped.reason.length > 0,
      'skipped check reason is required'
    );
  }
}

function validateReconciliation(reconciliation, findingIds) {
  exactKeys(
    reconciliation,
    [
      'priorReviewedHeadSha',
      'priorPacketDigest',
      'resolvedFindingIds',
      'openFindingIds',
      'newFindingIds',
    ],
    'review packet reconciliation'
  );
  assert(
    reconciliation.priorReviewedHeadSha === null || SHA.test(reconciliation.priorReviewedHeadSha),
    'priorReviewedHeadSha is invalid'
  );
  assert(
    reconciliation.priorPacketDigest === null || HEX64.test(reconciliation.priorPacketDigest),
    'priorPacketDigest is invalid'
  );
  assert(
    (reconciliation.priorReviewedHeadSha === null) === (reconciliation.priorPacketDigest === null),
    'incremental reconciliation must bind both the prior head and the prior packet digest'
  );
  for (const field of ['resolvedFindingIds', 'openFindingIds', 'newFindingIds']) {
    validateStrings(reconciliation[field], `reconciliation.${field}`);
  }
  const allStates = [
    ...reconciliation.resolvedFindingIds,
    ...reconciliation.openFindingIds,
    ...reconciliation.newFindingIds,
  ];
  assert(new Set(allStates).size === allStates.length, 'finding reconciliation states overlap');
  assert(
    reconciliation.openFindingIds.every((id) => findingIds.has(id)),
    'open finding reconciliation references an absent current finding'
  );
  assert(
    reconciliation.newFindingIds.every((id) => findingIds.has(id)),
    'new finding reconciliation references an absent current finding'
  );
  assert(
    reconciliation.resolvedFindingIds.every((id) => !findingIds.has(id)),
    'resolved finding reconciliation still references a current finding'
  );
  const currentStates = new Set([
    ...reconciliation.openFindingIds,
    ...reconciliation.newFindingIds,
  ]);
  assert(
    currentStates.size === findingIds.size && [...findingIds].every((id) => currentStates.has(id)),
    'each current finding must be reconciled exactly once as open or new'
  );
}

export function computeReviewPacketDigest(priorPacket) {
  assert(
    priorPacket && typeof priorPacket === 'object' && !Array.isArray(priorPacket),
    'prior review packet is invalid'
  );
  return digest(priorPacket);
}

export function verifyReconciliation(packet, priorPacket) {
  assert(
    packet && typeof packet.reconciliation === 'object',
    'review packet reconciliation is invalid'
  );
  assert(
    HEX64.test(packet.reconciliation.priorPacketDigest),
    'packet records no prior packet digest'
  );
  assert(
    priorPacket && typeof priorPacket === 'object' && !Array.isArray(priorPacket),
    'a prior review packet is required'
  );
  assert(
    computeReviewPacketDigest(priorPacket) === packet.reconciliation.priorPacketDigest,
    'the provided prior review packet does not match the recorded priorPacketDigest'
  );
  assert(
    priorPacket.repositoryId === packet.repositoryId,
    'the prior review packet targets a different repository'
  );
  assert(
    priorPacket.pullRequest === packet.pullRequest,
    'the prior review packet targets a different pull request'
  );
  assert(
    priorPacket.headSha === packet.reconciliation.priorReviewedHeadSha,
    'the prior review packet head does not match priorReviewedHeadSha'
  );
  assert(Array.isArray(priorPacket.findings), 'the prior review packet has no findings array');
  const priorIds = new Set(priorPacket.findings.map((finding) => finding.id));
  assert(
    packet.reconciliation.resolvedFindingIds.every((id) => priorIds.has(id)),
    'resolved reconciliation references a finding absent from the prior packet'
  );
  assert(
    packet.reconciliation.openFindingIds.every((id) => priorIds.has(id)),
    'open reconciliation references a finding absent from the prior packet'
  );
  assert(
    packet.reconciliation.newFindingIds.every((id) => !priorIds.has(id)),
    'new reconciliation reuses a finding id already present in the prior packet'
  );
  return true;
}

export function validateReviewPacket(packet, input) {
  exactKeys(
    packet,
    [
      'schemaVersion',
      'kind',
      'repositoryId',
      'pullRequest',
      'baseSha',
      'headSha',
      'reviewInputDigest',
      'observedAt',
      'reviewClass',
      'scope',
      'affectedEntities',
      'affectedSurfaces',
      'findings',
      'validation',
      'reconciliation',
      'limitations',
      'unknowns',
      'humanGates',
      'recommendedAction',
    ],
    'review packet'
  );
  assert(packet.schemaVersion === 1, 'review packet schemaVersion is invalid');
  assert(packet.kind === 'proto-ui.review-packet', 'review packet kind is invalid');
  assert(
    typeof packet.repositoryId === 'string' && packet.repositoryId.length > 3,
    'repositoryId is required'
  );
  assert(Number.isInteger(packet.pullRequest) && packet.pullRequest > 0, 'pullRequest is invalid');
  assert(SHA.test(packet.baseSha) && SHA.test(packet.headSha), 'review SHAs are invalid');
  assert(HEX64.test(packet.reviewInputDigest), 'reviewInputDigest is invalid');
  validateReviewInputSnapshot(input);
  assert(
    packet.repositoryId === input.repositoryId &&
      packet.pullRequest === input.pullRequest &&
      packet.baseSha === input.baseSha &&
      packet.headSha === input.headSha,
    'review packet does not match its input snapshot'
  );
  assert(
    packet.reviewInputDigest === computeReviewInputDigest(input),
    'reviewInputDigest does not match the canonical input snapshot'
  );
  validateTimestamp(packet.observedAt, 'observedAt');
  assert(REVIEW_CLASSES.includes(packet.reviewClass), 'reviewClass is invalid');
  validateStrings(packet.scope, 'scope', { min: 1 });
  validateStrings(packet.affectedEntities, 'affectedEntities');
  validateStrings(packet.affectedSurfaces, 'affectedSurfaces', { min: 1 });
  for (const field of ['findings', 'limitations', 'unknowns', 'humanGates']) {
    assert(Array.isArray(packet[field]), `${field} must be an array`);
  }
  for (const field of ['limitations', 'unknowns', 'humanGates']) {
    validateStrings(packet[field], field);
  }
  assert(RECOMMENDATIONS.includes(packet.recommendedAction), 'recommendedAction is invalid');
  const findingIds = new Set();
  for (const finding of packet.findings) {
    const fields = [
      'id',
      'severity',
      'confidence',
      'file',
      'line',
      'authority',
      'observed',
      'expected',
      'impact',
      'fix',
    ];
    const stringFields = ['id', 'file', 'authority', 'observed', 'expected', 'impact', 'fix'];
    exactKeys(finding, fields, 'finding');
    for (const field of stringFields) {
      assert(
        typeof finding[field] === 'string' && finding[field].length > 0,
        `finding.${field} must be a non-empty string`
      );
    }
    assert(!findingIds.has(finding.id), `finding id is duplicated: ${finding.id}`);
    findingIds.add(finding.id);
    assert(['P0', 'P1', 'P2', 'P3'].includes(finding.severity), 'finding.severity is invalid');
    assert(['high', 'medium', 'low'].includes(finding.confidence), 'finding.confidence is invalid');
    assert(Number.isInteger(finding.line) && finding.line > 0, 'finding.line is invalid');
  }
  validateValidation(packet.validation);
  validateReconciliation(packet.reconciliation, findingIds);
  return packet;
}

export function reviewPacketKey(packet, input) {
  validateReviewPacket(packet, input);
  return digest([
    packet.repositoryId,
    packet.pullRequest,
    packet.baseSha,
    packet.headSha,
    packet.reviewInputDigest,
    packet.reviewClass,
  ]);
}

export function inspectReviewRevision(
  packet,
  input,
  currentHeadSha,
  priorReviewedHeadSha = null,
  currentBaseSha = packet.baseSha
) {
  validateReviewPacket(packet, input);
  assert(SHA.test(currentHeadSha), 'current head SHA is invalid');
  assert(SHA.test(currentBaseSha), 'current base SHA is invalid');
  if (packet.headSha !== currentHeadSha || packet.baseSha !== currentBaseSha) {
    return {
      stale: true,
      incrementalRange: priorReviewedHeadSha ? `${priorReviewedHeadSha}..${currentHeadSha}` : null,
      reconciliationRequired: true,
    };
  }
  return { stale: false, incrementalRange: null, reconciliationRequired: false };
}

export function decideReviewRun(packet, input, existingPacketKeys = []) {
  const key = reviewPacketKey(packet, input);
  const duplicate = existingPacketKeys.includes(key);
  return { shouldRun: !duplicate, duplicate, key };
}

export function evaluateReviewEligibility({ executionMode, selfAssessment, reviewClass, policy }) {
  assert(['human-assisted', 'autonomous'].includes(executionMode), 'execution mode is invalid');
  assert(REVIEW_CLASSES.includes(reviewClass), 'review class is invalid');
  const requiredBand = policy?.reviewClasses?.[reviewClass]?.autonomousMinimumBand;
  assert(BANDS.includes(requiredBand), 'review class is absent from capability policy');
  const band = selfAssessment?.capability?.band ?? 'U0';
  const withinSelfAssessedDepth =
    BANDS.includes(band) && BANDS.indexOf(band) >= BANDS.indexOf(requiredBand);
  if (executionMode === 'human-assisted') {
    return {
      eligible: true,
      reviewDepth: withinSelfAssessedDepth ? 'full' : 'partial',
      maximumRecommendation: withinSelfAssessedDepth ? 'REQUEST_CHANGES' : 'ABSTAIN',
      limitationRequired: !withinSelfAssessedDepth,
      approvalDecisionRequired: true,
    };
  }
  const eligible =
    selfAssessment?.fresh === true &&
    selfAssessment?.validated === true &&
    withinSelfAssessedDepth &&
    selfAssessment.capability.recommendedReviewClasses?.includes(reviewClass);
  return {
    eligible,
    reviewDepth: eligible ? 'full' : 'none',
    maximumRecommendation: eligible ? 'REQUEST_CHANGES' : 'ABSTAIN',
    limitationRequired: !eligible,
    approvalDecisionRequired: true,
  };
}

export function validateReviewPacketEligibility(packet, eligibility, executionMode) {
  assert(['human-assisted', 'autonomous'].includes(executionMode), 'execution mode is invalid');
  assert(eligibility && typeof eligibility === 'object', 'review eligibility is required');
  if (executionMode === 'autonomous') {
    assert(eligibility.eligible === true, 'review class exceeds the autonomous ceiling');
  }
  assert(
    RECOMMENDATION_RANK.get(packet.recommendedAction) <=
      RECOMMENDATION_RANK.get(eligibility.maximumRecommendation),
    'review recommendation exceeds the eligible maximum'
  );
  if (eligibility.limitationRequired) {
    assert(packet.limitations.length > 0, 'partial review must record a limitation');
  }
  return packet;
}

export function verifyLiveReviewInput(packet, freshInput) {
  validateReviewInputSnapshot(freshInput);
  assert(
    freshInput.repositoryId === packet.repositoryId &&
      freshInput.pullRequest === packet.pullRequest,
    'live review input targets a different repository or pull request'
  );
  assert(
    computeReviewInputDigest(freshInput) === packet.reviewInputDigest,
    'live canonical review input does not match the recorded reviewInputDigest'
  );
  return true;
}

export function authorizeReviewSubmission({
  packet,
  input,
  liveInput,
  executionMode,
  explicitAuthorization,
  credentialCanReview,
  reviewer,
  pullRequestAuthor,
  ciConclusion,
}) {
  assert(['human-assisted', 'autonomous'].includes(executionMode), 'execution mode is invalid');
  if (executionMode === 'autonomous') {
    return { allowed: false, reason: 'review submission requires a new human-assisted run' };
  }
  validateReviewPacket(packet, input);
  verifyLiveReviewInput(packet, liveInput);
  const revision = inspectReviewRevision(packet, input, liveInput.headSha, null, liveInput.baseSha);
  if (revision.stale) {
    return { allowed: false, reason: 'review packet is stale at the submission boundary' };
  }
  assert(
    typeof reviewer === 'string' && reviewer.length > 0,
    'live viewer identity is required for submission'
  );
  assert(
    typeof pullRequestAuthor === 'string' && pullRequestAuthor.length > 0,
    'live pull-request author identity is required for submission'
  );
  const recommendedAction = packet.recommendedAction;
  assert(RECOMMENDATIONS.includes(recommendedAction), 'recommendedAction is invalid');
  if (!explicitAuthorization)
    return { allowed: false, reason: 'current user authorization is required' };
  if (!credentialCanReview)
    return { allowed: false, reason: 'live credential cannot submit reviews' };
  if (recommendedAction === 'APPROVE') {
    return { allowed: false, reason: 'pull-request approval is a human gate' };
  }
  if (reviewer === pullRequestAuthor && recommendedAction === 'REQUEST_CHANGES') {
    return { allowed: false, reason: 'an Agent cannot issue a disposition on its own work' };
  }
  return {
    allowed: true,
    reason: 'authorized review submission',
    recommendedAction,
    ciConclusion,
  };
}
