import { createHash } from 'node:crypto';

const SHA = /^[a-f0-9]{40,64}$/;
const BANDS = ['U0', 'C1', 'C2', 'C3', 'C4'];
const RECOMMENDATIONS = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT', 'ABSTAIN'];

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

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function validateReviewPacket(packet) {
  exactKeys(
    packet,
    [
      'schemaVersion',
      'kind',
      'repositoryId',
      'pullRequest',
      'baseSha',
      'headSha',
      'observedAt',
      'scope',
      'affectedEntities',
      'affectedSurfaces',
      'findings',
      'validation',
      'previousFindings',
      'limitations',
      'unknowns',
      'humanGates',
      'recommendedAction',
    ],
    'review packet'
  );
  assert(packet?.schemaVersion === 1, 'review packet schemaVersion is invalid');
  assert(packet.kind === 'proto-ui.review-packet', 'review packet kind is invalid');
  assert(
    typeof packet.repositoryId === 'string' && packet.repositoryId.length > 3,
    'repositoryId is required'
  );
  assert(Number.isInteger(packet.pullRequest) && packet.pullRequest > 0, 'pullRequest is invalid');
  assert(SHA.test(packet.baseSha) && SHA.test(packet.headSha), 'review SHAs are invalid');
  assert(Number.isFinite(Date.parse(packet.observedAt)), 'observedAt is invalid');
  for (const field of [
    'scope',
    'affectedEntities',
    'affectedSurfaces',
    'findings',
    'validation',
    'previousFindings',
    'limitations',
    'unknowns',
    'humanGates',
  ]) {
    assert(Array.isArray(packet[field]), `${field} must be an array`);
  }
  assert(RECOMMENDATIONS.includes(packet.recommendedAction), 'recommendedAction is invalid');
  for (const finding of packet.findings) {
    const fields = [
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
    exactKeys(finding, fields, 'finding');
    for (const field of fields) {
      assert(finding[field] !== undefined && finding[field] !== '', `finding.${field} is required`);
    }
    assert(['P0', 'P1', 'P2', 'P3'].includes(finding.severity), 'finding.severity is invalid');
    assert(['high', 'medium', 'low'].includes(finding.confidence), 'finding.confidence is invalid');
    assert(Number.isInteger(finding.line) && finding.line > 0, 'finding.line is invalid');
  }
  return packet;
}

export function reviewPacketKey(packet) {
  validateReviewPacket(packet);
  return digest([packet.repositoryId, packet.pullRequest, packet.baseSha, packet.headSha]);
}

export function inspectReviewRevision(
  packet,
  currentHeadSha,
  priorReviewedHeadSha = null,
  currentBaseSha = packet.baseSha
) {
  validateReviewPacket(packet);
  assert(SHA.test(currentHeadSha), 'current head SHA is invalid');
  assert(SHA.test(currentBaseSha), 'current base SHA is invalid');
  if (packet.headSha !== currentHeadSha || packet.baseSha !== currentBaseSha) {
    return {
      stale: true,
      incrementalRange: priorReviewedHeadSha ? `${priorReviewedHeadSha}..${currentHeadSha}` : null,
    };
  }
  return { stale: false, incrementalRange: null };
}

export function decideReviewRun(packet, existingPacketKeys = []) {
  const key = reviewPacketKey(packet);
  const duplicate = existingPacketKeys.includes(key);
  return { shouldRun: !duplicate, duplicate, key };
}

export function evaluateReviewEligibility({ executionMode, selfAssessment, requiredBand = 'C3' }) {
  assert(['human-assisted', 'autonomous'].includes(executionMode), 'execution mode is invalid');
  assert(BANDS.includes(requiredBand), 'required review band is invalid');
  if (executionMode === 'human-assisted') {
    const band = selfAssessment?.capability?.band ?? 'U0';
    return {
      eligible: true,
      maximumRecommendation:
        BANDS.indexOf(band) < BANDS.indexOf(requiredBand) ? 'ABSTAIN' : 'APPROVE',
      limitationRequired: BANDS.indexOf(band) < BANDS.indexOf(requiredBand),
    };
  }
  const band =
    selfAssessment?.fresh === true && selfAssessment?.validated === true
      ? selfAssessment?.capability?.band
      : null;
  const eligible = BANDS.includes(band) && BANDS.indexOf(band) >= BANDS.indexOf(requiredBand);
  return {
    eligible,
    maximumRecommendation: eligible ? 'APPROVE' : 'ABSTAIN',
    limitationRequired: !eligible,
  };
}

export function authorizeReviewSubmission({
  explicitAuthorization,
  credentialCanReview,
  reviewer,
  pullRequestAuthor,
  recommendedAction,
  ciConclusion,
}) {
  assert(RECOMMENDATIONS.includes(recommendedAction), 'recommendedAction is invalid');
  if (!explicitAuthorization)
    return { allowed: false, reason: 'current user authorization is required' };
  if (!credentialCanReview)
    return { allowed: false, reason: 'live credential cannot submit reviews' };
  if (recommendedAction === 'APPROVE') {
    return { allowed: false, reason: 'pull-request approval is a human gate' };
  }
  if (reviewer === pullRequestAuthor && recommendedAction === 'APPROVE') {
    return { allowed: false, reason: 'an Agent cannot approve its own work' };
  }
  return {
    allowed: true,
    reason: 'authorized review submission',
    recommendedAction,
    ciConclusion,
  };
}
