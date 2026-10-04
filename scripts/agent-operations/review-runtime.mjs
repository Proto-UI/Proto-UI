import {
  ownerAuthorizationFromArgs,
  ownerAuthorizationAllows,
  ownerSkillEligibility,
} from './owner-authorization.mjs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

// Match the existing governed live-response bound for this supplied artifact.
export const MAX_PUBLISHED_REVIEW_PACKET_BYTES = 64 * 1024 * 1024;

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
const PULL_REQUEST_STATES = new Set(['OPEN', 'CLOSED', 'MERGED']);
const ATTENDED_DECISION_CLASSES = new Set([
  'unresolved-product-direction',
  'privileged-or-irreversible-operation',
]);
const CHANGED_FILE_STATUSES = new Set([
  'added',
  'removed',
  'modified',
  'renamed',
  'copied',
  'changed',
  'unchanged',
]);
const SPEC_ENTITY_PATH =
  /^spec\/(contracts|prototypes|modules|adapters|decisions|host-caps|tests|versions|knowledge)\/[^/]+\.yaml$/;
const PREVIEW_AUTHORIZATION_URL = /^https:\/\/vercel\.com\/git\/authorize(?:\?[^#]*)?(?:#.*)?$/;

// An external preview authorization prompt is not evidence about repository CI.
// Keep its status in the canonical input and require explicit publication debt
// before approving; actual deployment failures remain blocking checks.
export function isExternalPreviewAuthorizationFailure(check) {
  if (
    check?.name !== 'Vercel' ||
    check.source !== 'vercel' ||
    check.conclusion !== 'FAILURE' ||
    typeof check.detailsUrl !== 'string'
  ) {
    return false;
  }
  try {
    const url = new URL(check.detailsUrl);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'vercel.com' &&
      url.pathname === '/git/authorize'
    );
  } catch {
    return false;
  }
}

function hasUndisclosedPreviewAuthorizationDebt(packet, input) {
  return input.checks.some(
    (check) =>
      isExternalPreviewAuthorizationFailure(check) &&
      !packet.agentEvidence.debt.some(
        (item) =>
          item.kind === 'publication' &&
          item.previewAuthorization?.provider === check.source &&
          item.previewAuthorization.checkName === check.name &&
          item.previewAuthorization.authorizationUrl === check.detailsUrl
      )
  );
}

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

function validateReviewInputVersion(input, legacy) {
  assert(
    input?.schemaVersion === (legacy ? 3 : 5),
    input?.schemaVersion === 4
      ? 'legacy review input v4 must be re-collected as v5 with current reviewer permission observations'
      : 'review input schemaVersion is invalid'
  );
  exactKeys(
    input,
    [
      'schemaVersion',
      'kind',
      'repositoryId',
      'pullRequest',
      'pullRequestState',
      ...(legacy ? [] : ['pullRequestAuthor']),
      'isDraft',
      'baseRefName',
      'baseSha',
      'headSha',
      'pullRequestBody',
      'changedFiles',
      'commits',
      'reviews',
      ...(legacy ? [] : ['reviewerPermissions']),
      'comments',
      'replies',
      'threads',
      'checks',
      'externalEvidence',
    ],
    'review input'
  );
  assert(input.kind === 'proto-ui.review-input', 'review input kind is invalid');
  assert(
    typeof input.repositoryId === 'string' && input.repositoryId.length > 3,
    'review input repositoryId is required'
  );
  assert(
    Number.isInteger(input.pullRequest) && input.pullRequest > 0,
    'review input PR is invalid'
  );
  assert(PULL_REQUEST_STATES.has(input.pullRequestState), 'review input PR state is invalid');
  if (!legacy) {
    assert(
      typeof input.pullRequestAuthor === 'string' && input.pullRequestAuthor.length > 0,
      'review input pull-request author identity is invalid'
    );
  }
  assert(typeof input.isDraft === 'boolean', 'review input draft state is invalid');
  assert(
    typeof input.baseRefName === 'string' && input.baseRefName.length > 0,
    'review input base ref name is invalid'
  );
  assert(SHA.test(input.baseSha) && SHA.test(input.headSha), 'review input SHAs are invalid');
  assert(typeof input.pullRequestBody === 'string', 'review input PR body is invalid');
  validateInputItems(
    input.changedFiles,
    ['path', 'previousPath', 'status'],
    'review input changedFiles',
    (item) => {
      for (const [field, value] of [
        ['path', item.path],
        ['previousPath', item.previousPath],
      ]) {
        if (field === 'previousPath' && value === null) continue;
        assert(
          typeof value === 'string' &&
            value.length > 0 &&
            !value.startsWith('/') &&
            !value.includes('\\') &&
            !value.split('/').includes('..'),
          `changed file ${field} is invalid`
        );
      }
      assert(CHANGED_FILE_STATUSES.has(item.status), 'changed file status is invalid');
    }
  );
  assert(input.changedFiles.length > 0, 'review input changedFiles must not be empty');
  validateInputItems(
    input.commits,
    legacy ? ['sha', 'message'] : ['sha', 'message', 'author', 'committer'],
    'review input commits',
    (item) => {
      assert(SHA.test(item.sha), 'review input commit SHA is invalid');
      assert(typeof item.message === 'string', 'review input commit message is invalid');
      if (legacy) return;
      for (const role of ['author', 'committer']) {
        exactKeys(
          item[role],
          ['login', 'name', 'email', 'platform'],
          `review input commit ${role}`
        );
        assert(
          item[role].login === null ||
            (typeof item[role].login === 'string' && item[role].login.length > 0),
          `review input commit ${role} login is invalid`
        );
        assert(typeof item[role].name === 'string', `review input commit ${role} name is invalid`);
        assert(
          typeof item[role].email === 'string',
          `review input commit ${role} email is invalid`
        );
        // A platform-generated actor (GitHub's web-flow committer) carries an
        // explicit verified platform identity instead of an unresolved null
        // login; the collector may only set it from GitHub's own signature
        // attestation, so a forged entry cannot weaken the fail-closed rule.
        if (item[role].platform !== null) {
          exactKeys(
            item[role].platform,
            ['kind', 'attestation'],
            `review input commit ${role} platform`
          );
          assert(
            item[role].platform.kind === 'github-web-flow' &&
              item[role].platform.attestation === 'valid-github-signature',
            `review input commit ${role} platform identity is invalid`
          );
        }
      }
    }
  );
  validateInputItems(
    input.reviews,
    ['id', 'author', 'state', 'commitSha', 'submittedAt', 'body'],
    'review input reviews',
    (item) => {
      for (const field of ['id', 'state']) {
        assert(
          typeof item[field] === 'string' && item[field].length > 0,
          `review ${field} is invalid`
        );
      }
      assert(
        (!legacy && item.author === null) ||
          (typeof item.author === 'string' && item.author.length > 0),
        'review author is invalid'
      );
      assert(item.commitSha === null || SHA.test(item.commitSha), 'review commitSha is invalid');
      validateTimestamp(item.submittedAt, 'review submittedAt', { nullable: true });
      assert(typeof item.body === 'string', 'review body is invalid');
    }
  );
  if (!legacy)
    validateInputItems(
      input.reviewerPermissions,
      ['login', 'permission', 'source', 'endpoint', 'repositoryId', 'headSha'],
      'review input reviewerPermissions',
      (item) => {
        assert(
          typeof item.login === 'string' &&
            item.login.length > 0 &&
            item.login === item.login.toLowerCase(),
          'reviewer permission login is invalid'
        );
        assert(
          ['admin', 'write', 'read', 'none'].includes(item.permission),
          'reviewer permission is invalid'
        );
        assert(
          item.source === 'github-rest-collaborator-permission',
          'reviewer permission source is invalid'
        );
        assert(
          item.repositoryId === input.repositoryId && item.headSha === input.headSha,
          'reviewer permission target binding is invalid'
        );
        const repository = input.repositoryId.replace(/^github\.com:/, '');
        assert(
          item.endpoint ===
            `repos/${repository}/collaborators/${encodeURIComponent(item.login)}/permission`,
          'reviewer permission endpoint is invalid'
        );
        assert(
          input.reviews.some(
            (review) =>
              review.author?.toLowerCase() === item.login &&
              review.state === 'APPROVED' &&
              review.commitSha === input.headSha
          ),
          'reviewer permission has no exact-head approval subject'
        );
      }
    );
  validateInputItems(
    input.comments,
    ['id', 'author', 'body', 'updatedAt'],
    'review input comments',
    (item) => {
      for (const field of ['id', 'author']) {
        assert(
          typeof item[field] === 'string' && item[field].length > 0,
          `comment ${field} is invalid`
        );
      }
      assert(typeof item.body === 'string', 'comment body is invalid');
      validateTimestamp(item.updatedAt, 'comment updatedAt');
    }
  );
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
    [
      'name',
      'status',
      'conclusion',
      'completedAt',
      'detailsUrl',
      'source',
      ...(legacy ? [] : ['providerId']),
      'repository',
      'workflowName',
      'workflowPath',
    ],
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
      assert(typeof item.source === 'string' && item.source.length > 0, 'check source is invalid');
      if (!legacy)
        assert(
          item.providerId === null ||
            (typeof item.providerId === 'string' && item.providerId.length > 0),
          'check providerId is invalid'
        );
      for (const field of ['repository', 'workflowName', 'workflowPath']) {
        assert(
          item[field] === null || (typeof item[field] === 'string' && item[field].length > 0),
          `check ${field} is invalid`
        );
      }
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
    [input.reviews, (item) => item.id, 'review id'],
    ...(legacy
      ? []
      : [[input.reviewerPermissions, (item) => item.login, 'reviewer permission login']]),
    [input.comments, (item) => item.id, 'comment id'],
    [input.replies, (item) => item.id, 'reply id'],
    [input.threads, (item) => item.id, 'thread id'],
  ]) {
    const values = items.map(key);
    assert(new Set(values).size === values.length, `review input duplicates ${label}`);
  }
  return input;
}

// Current collection and every mutation remain v5-only. Legacy parsing is a
// separate read-only surface; it never supplies missing identity/permission facts.
export function validateReviewInputSnapshot(input) {
  return validateReviewInputVersion(input, false);
}

export function validateReviewInputForIngestion(input) {
  return validateReviewInputVersion(input, input?.schemaVersion === 3);
}

function canonicalReviewInput(input, validate = validateReviewInputSnapshot) {
  validate(input);
  const clone = structuredClone(input);
  const compareCanonical = (left, right) => {
    const leftKey = JSON.stringify(canonicalJson(left));
    const rightKey = JSON.stringify(canonicalJson(right));
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  };
  for (const field of [
    'changedFiles',
    'commits',
    'reviews',
    ...(input.schemaVersion === 5 ? ['reviewerPermissions'] : []),
    'comments',
    'replies',
    'threads',
    'checks',
    'externalEvidence',
  ]) {
    clone[field].sort(compareCanonical);
  }
  return clone;
}

export function computeReviewInputDigest(input) {
  return digest(canonicalReviewInput(input));
}

export function computeReviewIngestionInputDigest(input) {
  return digest(canonicalReviewInput(input, validateReviewInputForIngestion));
}

export function reviewChangesSpecEntities(input) {
  validateReviewInputSnapshot(input);
  return input.changedFiles.some(
    (file) =>
      SPEC_ENTITY_PATH.test(file.path) ||
      (file.previousPath !== null && SPEC_ENTITY_PATH.test(file.previousPath))
  );
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

// The supplied file is content, not authority. Its complete packet/evidence
// tokens must also occur in the same qualified live approval below.
export function validatePublishedReviewPacket(packet, publishedPacket) {
  assert(
    publishedPacket && typeof publishedPacket === 'object' && !Array.isArray(publishedPacket),
    'the original published review packet is required'
  );
  let serialized;
  try {
    serialized = JSON.stringify(publishedPacket);
  } catch {
    throw new Error('the published review packet cannot be serialized');
  }
  assert(
    typeof serialized === 'string' &&
      Buffer.byteLength(serialized, 'utf8') <= MAX_PUBLISHED_REVIEW_PACKET_BYTES,
    `the published review packet exceeds the ${MAX_PUBLISHED_REVIEW_PACKET_BYTES}-byte bound`
  );
  assert(publishedPacket.schemaVersion === 2, 'the published review packet must use schema v2');
  exactKeys(publishedPacket, Object.keys(packet), 'published review packet');
  assert(
    typeof publishedPacket.reviewInputDigest === 'string' &&
      HEX64.test(publishedPacket.reviewInputDigest),
    'the published review input digest is invalid'
  );
  validateTimestamp(publishedPacket.observedAt, 'published review observedAt');
  // Only these two transport fields change after publishing the review. All
  // content, base/head, scope, evidence, findings and reconciliation stay exact.
  assert(
    isDeepStrictEqual(packet, {
      ...publishedPacket,
      reviewInputDigest: packet.reviewInputDigest,
      observedAt: packet.observedAt,
    }),
    'the merge packet changed published review content beyond reviewInputDigest/observedAt'
  );
  return publishedPacket;
}

/**
 * Stable publication receipt marker embedded in every rendered review body and
 * evidence comment. Duplicate detection and merge authorization bind to this
 * exact packet digest instead of reviewer/head/disposition triples, so a
 * legacy or superseded same-head review never blocks a changed evidence
 * packet, and a merge can prove the packet's evidence was actually published.
 */
export function reviewPacketMarker(packet) {
  return `proto-ui:review-packet:sha256=${computeReviewPacketDigest(packet)}`;
}

export function reviewPacketMarkerPresent(packet, bodies) {
  const marker = reviewPacketMarker(packet);
  return bodies.some((body) => typeof body === 'string' && body.includes(marker));
}

/** Preserve disclosure; only pure receipt comments are transport metadata. */
function normalizedReviewBody(body) {
  const source = body.replace(/\r\n/g, '\n');
  const content = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('<!--', cursor);
    if (start === -1) break;
    const end = source.indexOf('-->', start + 4);
    if (end === -1) break;
    content.push(source.slice(cursor, start));
    const tokens = source
      .slice(start + 4, end)
      .trim()
      .split(/\s+/);
    if (
      !tokens.every((token) =>
        /^proto-ui:(?:review-packet|agent-evidence):sha256=[a-f0-9]{64}$/.test(token)
      )
    ) {
      content.push(source.slice(start, end + 3));
    }
    cursor = end + 3;
  }
  content.push(source.slice(cursor));
  return content.join('').trim();
}

/** Evidence identity shared by every packet and publication carrying it. */
export function agentEvidenceMarker(packet) {
  assert(packet.schemaVersion === 2, 'schema v1 packets carry no Agent evidence');
  return `proto-ui:agent-evidence:sha256=${digest(packet.agentEvidence)}`;
}

function receiptMarkerTokens(body) {
  const tokens = [];
  if (typeof body !== 'string') return tokens;
  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf('<!--', cursor);
    if (start === -1) break;
    const end = body.indexOf('-->', start + 4);
    if (end === -1) break;
    // renderReviewBody combines packet and evidence markers in one comment.
    // Match a complete whitespace-delimited token, never a prefix or suffix.
    tokens.push(
      ...body
        .slice(start + 4, end)
        .trim()
        .split(/\s+/)
    );
    cursor = end + 3;
  }
  return tokens;
}

function hasReceiptMarker(body, marker) {
  return receiptMarkerTokens(body).includes(marker);
}

function hasUniquePublishedPacketReceipts(body, packet) {
  const tokens = receiptMarkerTokens(body);
  const packetTokens = [
    ...new Set(
      tokens.filter((token) => /^proto-ui:review-packet:sha256=[a-f0-9]{64}$/.test(token))
    ),
  ];
  const evidenceTokens = [
    ...new Set(
      tokens.filter((token) => /^proto-ui:agent-evidence:sha256=[a-f0-9]{64}$/.test(token))
    ),
  ];
  return (
    packetTokens.length === 1 &&
    packetTokens[0] === reviewPacketMarker(packet) &&
    evidenceTokens.length === 1 &&
    evidenceTokens[0] === agentEvidenceMarker(packet)
  );
}

// Invert exactly one normal publication. Do not discard unrelated reviews,
// comments, checks or files in search of a matching historical digest.
function matchesPublishedReviewInput(publishedPacket, input, review) {
  try {
    const positions = input.reviews.flatMap((entry, index) =>
      entry.id === review.id ? [index] : []
    );
    if (positions.length !== 1 || review.author === null) return false;
    const reconstructed = {
      ...input,
      reviews: input.reviews.toSpliced(positions[0], 1),
      reviewerPermissions: [...input.reviewerPermissions],
    };
    const publisher = review.author.toLowerCase();
    // The collector adds this fact only when publication newly introduces an
    // eligible approval subject. Existing subjects keep their exact fact.
    if (!reviewerPermissionSubjects(reconstructed).includes(publisher)) {
      reconstructed.reviewerPermissions = reconstructed.reviewerPermissions.filter(
        (entry) => entry.login !== publisher
      );
    }
    if (computeReviewInputDigest(reconstructed) !== publishedPacket.reviewInputDigest) return false;
    validateReviewPacket(publishedPacket, reconstructed);
    return true;
  } catch {
    return false;
  }
}

function uniqueLatestReview(reviews) {
  let latest = null;
  let tied = false;
  for (const review of reviews) {
    const timestamp = review.submittedAt;
    if (typeof timestamp !== 'string' || !RFC3339.test(timestamp)) return null;
    const milliseconds = Date.parse(timestamp);
    if (!Number.isFinite(milliseconds)) return null;
    // Normalize timezone offsets without truncating admitted fractional digits.
    // An opaque review ID and input array position supply no chronological order.
    const second = Math.floor(milliseconds / 1000);
    const fraction = timestamp.match(/\.(\d+)/)?.[1] ?? '';
    const precision = Math.max(fraction.length, latest?.fraction.length ?? 0);
    const paddedFraction = fraction.padEnd(precision, '0');
    const latestFraction = latest?.fraction.padEnd(precision, '0');
    if (
      latest === null ||
      second > latest.second ||
      (second === latest.second && paddedFraction > latestFraction)
    ) {
      latest = { review, second, fraction };
      tied = false;
    } else if (second === latest.second && paddedFraction === latestFraction) {
      tied = true;
    }
  }
  return tied ? null : (latest?.review ?? null);
}

function requiredPriorReview(input, reviewer) {
  const candidates = input.reviews
    .filter(
      (review) =>
        review.author?.toLowerCase() === reviewer.toLowerCase() &&
        ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)
    )
    .map((review) => ({
      ...review,
      packetDigests: [
        ...new Set(
          receiptMarkerTokens(review.body)
            .filter((token) => /^proto-ui:review-packet:sha256=[a-f0-9]{64}$/.test(token))
            .map((token) => token.slice('proto-ui:review-packet:sha256='.length))
        ),
      ],
    }))
    // A COMMENT cannot replace findings from a disposition. Dismissals keep
    // their existing clearing behavior, without certifying old publications.
    .filter((review) => review.packetDigests.length > 0 || review.state === 'DISMISSED');
  if (!candidates.some((review) => review.state !== 'DISMISSED')) return null;
  const review = uniqueLatestReview(candidates);
  assert(
    review !== null,
    'the governed prior review order is unavailable or ambiguous; reconcile live history before a disposition'
  );
  if (review.state === 'DISMISSED') return null;
  assert(review.packetDigests.length === 1, 'the governed prior review packet marker is ambiguous');
  assert(SHA.test(review.commitSha), 'the governed prior review head is unavailable');
  return { ...review, packetDigest: review.packetDigests[0] };
}

function verifySubmissionReconciliation(packet, input, reviewer, priorPacket) {
  if (['APPROVE', 'REQUEST_CHANGES'].includes(packet.recommendedAction)) {
    const prior = requiredPriorReview(input, reviewer);
    if (prior !== null) {
      assert(
        packet.reconciliation.priorPacketDigest === prior.packetDigest &&
          packet.reconciliation.priorReviewedHeadSha === prior.commitSha,
        'the disposition must reconcile the latest governed prior review from this reviewer'
      );
      assert(priorPacket, 'the governed prior review artifact is required before a disposition');
    }
  }
  if (packet.reconciliation.priorPacketDigest !== null) {
    verifyReconciliation(packet, priorPacket);
  }
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
    priorIds.size === priorPacket.findings.length,
    'the prior review packet contains duplicate finding ids'
  );
  const { resolvedFindingIds, openFindingIds, newFindingIds } = packet.reconciliation;
  // PR509-RECONCILIATION-COVERAGE-001: membership alone is insufficient. The
  // union of resolved and open must account for every prior finding exactly
  // once, no state may repeat a finding id, and new ids must be current
  // findings absent from the prior packet.
  const accounted = [...resolvedFindingIds, ...openFindingIds, ...newFindingIds];
  assert(
    new Set(accounted).size === accounted.length,
    'finding reconciliation states overlap or repeat a finding id'
  );
  assert(
    resolvedFindingIds.every((id) => priorIds.has(id)),
    'resolved reconciliation references a finding absent from the prior packet'
  );
  assert(
    openFindingIds.every((id) => priorIds.has(id)),
    'open reconciliation references a finding absent from the prior packet'
  );
  const currentIds = new Set(packet.findings.map((finding) => finding.id));
  assert(
    newFindingIds.every((id) => currentIds.has(id)),
    'new reconciliation references a finding absent from the current packet'
  );
  assert(
    newFindingIds.every((id) => !priorIds.has(id)),
    'new reconciliation reuses a finding id already present in the prior packet'
  );
  const coveredPriorIds = new Set([...resolvedFindingIds, ...openFindingIds]);
  assert(
    coveredPriorIds.size === priorIds.size && [...priorIds].every((id) => coveredPriorIds.has(id)),
    'resolved and open reconciliation must cover every prior finding exactly once'
  );
  return true;
}

export function validateReviewPacket(packet, input) {
  assert(
    packet && typeof packet === 'object' && !Array.isArray(packet),
    'review packet is invalid'
  );
  assert(
    packet.schemaVersion === 1 || packet.schemaVersion === 2,
    'review packet schemaVersion must be 1 (legacy, without Agent evidence) or 2 (Agent evidence required)'
  );
  const packetKeys = [
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
  ];
  if (packet.schemaVersion === 2) packetKeys.push('agentEvidence');
  packetKeys.push('reconciliation', 'limitations', 'unknowns', 'humanGates', 'recommendedAction');
  exactKeys(packet, packetKeys, 'review packet');
  assert(packet.kind === 'proto-ui.review-packet', 'review packet kind is invalid');
  assert(
    typeof packet.repositoryId === 'string' && packet.repositoryId.length > 3,
    'repositoryId is required'
  );
  assert(Number.isInteger(packet.pullRequest) && packet.pullRequest > 0, 'pullRequest is invalid');
  assert(SHA.test(packet.baseSha) && SHA.test(packet.headSha), 'review SHAs are invalid');
  assert(HEX64.test(packet.reviewInputDigest), 'reviewInputDigest is invalid');
  if (input?.schemaVersion === 3) {
    assert(
      packet.schemaVersion === 1 && packet.recommendedAction === 'COMMENT',
      'legacy review input v3 may only ingest a schema v1 COMMENT packet'
    );
  }
  validateReviewInputForIngestion(input);
  assert(
    packet.repositoryId === input.repositoryId &&
      packet.pullRequest === input.pullRequest &&
      packet.baseSha === input.baseSha &&
      packet.headSha === input.headSha,
    'review packet does not match its input snapshot'
  );
  assert(
    packet.reviewInputDigest === computeReviewIngestionInputDigest(input),
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
  assert(
    packet.humanGates.every((gate) => ATTENDED_DECISION_CLASSES.has(gate)),
    'humanGates contains an unknown attended decision class'
  );
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
  if (packet.schemaVersion === 2) validateAgentEvidence(packet.agentEvidence, packet.headSha);
  validateReconciliation(packet.reconciliation, findingIds);
  return packet;
}

function validatePublicUrl(value, label) {
  assert(
    typeof value === 'string' && /^https:\/\/[^\s<>]+$/.test(value),
    `${label} must be an HTTPS URL`
  );
  const url = new URL(value);
  assert(!url.username && !url.password, `${label} must not contain credentials`);
}

export function validateAgentEvidence(evidence, headSha) {
  exactKeys(
    evidence,
    [
      'requestParaphrase',
      'source',
      'scope',
      'baseline',
      'headSha',
      'environment',
      'observedAt',
      'procedure',
      'observations',
      'visuals',
      'supportingUrls',
      'disposition',
      'debt',
    ],
    'agentEvidence'
  );
  for (const field of ['requestParaphrase', 'source', 'scope', 'baseline', 'environment']) {
    assert(
      typeof evidence[field] === 'string' && evidence[field].trim().length > 0,
      `agentEvidence.${field} is required`
    );
  }
  assert(
    SHA.test(evidence.headSha) && evidence.headSha === headSha,
    'agentEvidence must bind the reviewed head'
  );
  validateTimestamp(evidence.observedAt, 'agentEvidence.observedAt');
  for (const field of ['procedure', 'observations'])
    validateStrings(evidence[field], `agentEvidence.${field}`, { min: 1 });
  validateStrings(evidence.supportingUrls, 'agentEvidence.supportingUrls');
  for (const url of evidence.supportingUrls) validatePublicUrl(url, 'agentEvidence.supportingUrls');
  assert(Array.isArray(evidence.visuals), 'agentEvidence.visuals must be an array');
  for (const visual of evidence.visuals) {
    exactKeys(visual, ['url', 'alt', 'caption'], 'agentEvidence.visual');
    validatePublicUrl(visual.url, 'agentEvidence.visual.url');
    for (const field of ['alt', 'caption'])
      assert(
        typeof visual[field] === 'string' && visual[field].trim().length > 0,
        `agentEvidence.visual.${field} is required`
      );
  }
  assert(
    ['complete', 'partial', 'blocked'].includes(evidence.disposition),
    'agentEvidence.disposition is invalid'
  );
  assert(Array.isArray(evidence.debt), 'agentEvidence.debt must be an array');
  for (const debt of evidence.debt) {
    const hasPreviewAuthorization = Object.hasOwn(debt, 'previewAuthorization');
    exactKeys(
      debt,
      [
        'kind',
        'missing',
        'reason',
        'nextAction',
        ...(hasPreviewAuthorization ? ['previewAuthorization'] : []),
      ],
      'agentEvidence.debt item'
    );
    assert(
      ['publication', 'verification', 'outside-scope'].includes(debt.kind),
      'agentEvidence.debt.kind is invalid'
    );
    for (const field of ['missing', 'reason', 'nextAction'])
      assert(
        typeof debt[field] === 'string' && debt[field].trim().length > 0,
        `agentEvidence.debt.${field} is required`
      );
    if (hasPreviewAuthorization) {
      exactKeys(
        debt.previewAuthorization,
        ['provider', 'checkName', 'authorizationUrl'],
        'agentEvidence.debt.previewAuthorization'
      );
      assert(
        debt.kind === 'publication' &&
          typeof debt.previewAuthorization.authorizationUrl === 'string' &&
          PREVIEW_AUTHORIZATION_URL.test(debt.previewAuthorization.authorizationUrl) &&
          isExternalPreviewAuthorizationFailure({
            name: debt.previewAuthorization.checkName,
            source: debt.previewAuthorization.provider,
            conclusion: 'FAILURE',
            detailsUrl: debt.previewAuthorization.authorizationUrl,
          }),
        'agentEvidence.debt.previewAuthorization must identify a Vercel authorization publication debt'
      );
    }
  }
  assert(
    evidence.disposition === 'complete' ? evidence.debt.length === 0 : evidence.debt.length > 0,
    'agentEvidence disposition must agree with declared debt'
  );
  return evidence;
}

// This exact body is passed to the head-bound GitHub Review API. Empty findings
// must not discard evidence or turn a bounded review into an unqualified verdict.
export function renderReviewBody(packet) {
  const list = (items) => items.map((item) => `- ${item}`).join('\n');
  const marker =
    packet.schemaVersion === 2
      ? `<!-- ${reviewPacketMarker(packet)} ${agentEvidenceMarker(packet)} -->`
      : `<!-- ${reviewPacketMarker(packet)} -->`;
  if (packet.schemaVersion !== 2) {
    return [
      `Reviewed exact head \`${packet.headSha}\`.`,
      `Review class: ${packet.reviewClass}. Scope: ${packet.scope.join('; ')}.`,
      packet.findings.length
        ? list(
            packet.findings.map(
              (finding) =>
                `**[${finding.severity}] ${finding.id}** (${finding.file}:${finding.line}) ${finding.observed} Expected: ${finding.expected} Impact: ${finding.impact} Authority: ${finding.authority} Fix: ${finding.fix}`
            )
          )
        : 'No actionable findings within the stated review scope.',
      '## Agent evidence',
      'None recorded. This legacy schema v1 packet carries no Agent evidence and cannot authorize a review disposition or merge.',
      marker,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  validateAgentEvidence(packet.agentEvidence, packet.headSha);
  const evidence = packet.agentEvidence;
  return [
    `Reviewed exact head \`${packet.headSha}\`.`,
    `Reviewed exact base \`${packet.baseSha}\`.`,
    `Review class: ${packet.reviewClass}. Scope: ${packet.scope.join('; ')}.`,
    packet.findings.length
      ? list(
          packet.findings.map(
            (finding) =>
              `**[${finding.severity}] ${finding.id}** (${finding.file}:${finding.line}) ${finding.observed} Expected: ${finding.expected} Impact: ${finding.impact} Authority: ${finding.authority} Fix: ${finding.fix}`
          )
        )
      : 'No actionable findings within the stated review scope.',
    '## Agent evidence',
    `Agent request paraphrase: ${evidence.requestParaphrase}\n\nSource: ${evidence.source}`,
    `Evidence scope: ${evidence.scope}\n\nBaseline: ${evidence.baseline}\n\nCandidate: \`${evidence.headSha}\`\n\nEnvironment: ${evidence.environment}\n\nObserved: ${evidence.observedAt}`,
    `### Procedure\n\n${list(evidence.procedure)}`,
    `### Observations\n\n${list(evidence.observations)}`,
    ...evidence.visuals.map(
      ({ url, alt, caption }) => `![${alt.replace(/[\[\]\r\n]/g, ' ')}](<${url}>)\n\n${caption}`
    ),
    evidence.supportingUrls.length
      ? `Supporting evidence:\n\n${list(evidence.supportingUrls.map((url) => `<${url}>`))}`
      : 'No additional public evidence links recorded.',
    `Evidence disposition: **${evidence.disposition}** for the named scope only; not Issue closure or acceptance.`,
    evidence.debt.length
      ? list(
          evidence.debt.map(
            (item) =>
              `[${item.kind}] ${item.missing}. Reason: ${item.reason} Next Agent action: ${item.nextAction}` +
              (item.previewAuthorization
                ? ` Preview authorization: ${item.previewAuthorization.provider}/${item.previewAuthorization.checkName} <${item.previewAuthorization.authorizationUrl}>.`
                : '')
          )
        )
      : 'No known debt within that evidence scope.',
    '### Validation and review limits',
    list(
      packet.validation.commands.map(
        (item) => `${item.command} — exit ${item.exitCode}: ${item.result}`
      )
    ),
    list(packet.validation.checksNotRun.map((item) => `Not run: ${item.check}. ${item.reason}`)),
    ...['limitations', 'unknowns', 'humanGates'].map((field) =>
      packet[field].length ? `${field}:\n\n${list(packet[field])}` : `${field}: none recorded.`
    ),
    marker,
  ]
    .filter(Boolean)
    .join('\n\n');
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

export function evaluateReviewEligibility({
  executionMode,
  selfAssessment,
  reviewClass,
  policy,
  ownerAuthorization = null,
  repositoryId = null,
  scopeId = null,
  executionModeSource = null,
}) {
  assert(['human-assisted', 'autonomous'].includes(executionMode), 'execution mode is invalid');
  assert(REVIEW_CLASSES.includes(reviewClass), 'review class is invalid');
  const requiredBand = policy?.reviewClasses?.[reviewClass]?.autonomousMinimumBand;
  assert(BANDS.includes(requiredBand), 'review class is absent from capability policy');
  const band = selfAssessment?.capability?.band ?? 'U0';
  const withinSelfAssessedDepth =
    BANDS.includes(band) && BANDS.indexOf(band) >= BANDS.indexOf(requiredBand);
  if (
    executionMode === 'human-assisted' ||
    ownerAuthorizationAllows(ownerAuthorization, {
      repositoryId,
      scopeId,
      action: 'review',
      executionMode,
      executionModeSource,
    })
  ) {
    return {
      eligible: true,
      reviewDepth: 'full',
      maximumRecommendation: 'APPROVE',
      limitationRequired: false,
      approvalDecisionRequired: false,
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
    maximumRecommendation: eligible ? 'APPROVE' : 'ABSTAIN',
    limitationRequired: !eligible,
    approvalDecisionRequired: 'when-unresolved-product-direction',
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

function validateReviewMutationInput(input) {
  assert(
    input?.schemaVersion !== 3,
    'legacy review input v3 is read-only; re-collect v5 before a review submission or merge'
  );
  return validateReviewInputSnapshot(input);
}

function standingAuthorizationMatches(
  authorization,
  { executionMode, executionModeSource, repositoryId }
) {
  return (
    authorization?.status === 'active' &&
    authorization.executionMode === executionMode &&
    authorization.executionModeSource === executionModeSource &&
    authorization.repositoryId === repositoryId
  );
}

function assessmentAllowsMutation(selfAssessment, policy, mutationClass) {
  const requiredBand = policy?.mutationClasses?.[mutationClass]?.autonomousMinimumBand;
  const actualBand = selfAssessment?.capability?.band;
  return (
    selfAssessment?.fresh === true &&
    selfAssessment?.validated === true &&
    BANDS.includes(requiredBand) &&
    BANDS.includes(actualBand) &&
    BANDS.indexOf(actualBand) >= BANDS.indexOf(requiredBand)
  );
}

function dispositionIneligibleLogins(input) {
  const logins = new Set([input.pullRequestAuthor.toLowerCase()]);
  for (const commit of input.commits) {
    for (const actor of [commit.author, commit.committer]) {
      if (actor.login !== null) logins.add(actor.login.toLowerCase());
    }
  }
  return logins;
}

function hasVerifiedCommitActorIdentity(actor) {
  return actor.login !== null || actor.platform !== null;
}

function hasCompleteCommitContributorIdentity(input) {
  return input.commits.every(
    (commit) =>
      hasVerifiedCommitActorIdentity(commit.author) &&
      hasVerifiedCommitActorIdentity(commit.committer)
  );
}

export function authorizeReviewSubmission({
  packet,
  input,
  liveInput,
  executionMode,
  executionModeSource,
  authorizationId,
  policy,
  selfAssessment,
  credentialCanReview,
  reviewer,
  ciConclusion,
  dcoConclusion,
  ownerAuthorization = null,
  priorPacket = null,
}) {
  assert(['human-assisted', 'autonomous'].includes(executionMode), 'execution mode is invalid');
  validateReviewMutationInput(input);
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
  const recommendedAction = packet.recommendedAction;
  assert(RECOMMENDATIONS.includes(recommendedAction), 'recommendedAction is invalid');
  const explicitCurrentUser =
    executionMode === 'human-assisted' &&
    ['current-user', 'active-human-loop'].includes(executionModeSource) &&
    authorizationId === 'explicit-current-user';
  const standingAuthorization = policy?.reviewSubmissionAuthorizations?.find(
    (authorization) => authorization.id === authorizationId
  );
  const activeStandingAuthorization = standingAuthorizationMatches(standingAuthorization, {
    executionMode,
    executionModeSource,
    repositoryId: packet.repositoryId,
  });
  if (
    activeStandingAuthorization &&
    (!assessmentAllowsMutation(selfAssessment, policy, standingAuthorization.mutationClass) ||
      !evaluateReviewEligibility({
        executionMode,
        selfAssessment,
        reviewClass: packet.reviewClass,
        policy,
      }).eligible)
  ) {
    return { allowed: false, reason: 'review submission exceeds the autonomous ceiling' };
  }
  const delegated = ownerAuthorizationAllows(ownerAuthorization, {
    repositoryId: packet.repositoryId,
    scopeId: 'pull-request:' + packet.pullRequest,
    action: 'review',
    executionMode,
    actor: reviewer,
    authorizationId,
    executionModeSource,
  });
  if (!explicitCurrentUser && !activeStandingAuthorization && !delegated) {
    return { allowed: false, reason: 'review submission authorization is unavailable' };
  }
  if (!credentialCanReview)
    return { allowed: false, reason: 'live credential cannot submit reviews' };
  if (liveInput.pullRequestState !== 'OPEN') {
    return { allowed: false, reason: 'pull request is not open' };
  }
  if (
    ['APPROVE', 'REQUEST_CHANGES'].includes(recommendedAction) &&
    !hasCompleteCommitContributorIdentity(liveInput)
  ) {
    return {
      allowed: false,
      reason: 'a commit author or committer lacks a verifiable platform identity',
    };
  }
  if (
    ['APPROVE', 'REQUEST_CHANGES'].includes(recommendedAction) &&
    dispositionIneligibleLogins(liveInput).has(reviewer.toLowerCase())
  ) {
    return {
      allowed: false,
      reason: 'the reviewer is the pull-request author or a commit contributor',
    };
  }
  if (recommendedAction === 'ABSTAIN') {
    return { allowed: false, reason: 'ABSTAIN is not a GitHub review submission' };
  }
  if (
    activeStandingAuthorization &&
    !standingAuthorization.allowedRecommendations?.includes(recommendedAction)
  ) {
    return { allowed: false, reason: 'review recommendation is outside standing authorization' };
  }
  if (['APPROVE', 'REQUEST_CHANGES'].includes(recommendedAction) && packet.schemaVersion !== 2) {
    return {
      allowed: false,
      reason:
        'review dispositions require a schema v2 packet with Agent evidence; legacy v1 packets may only COMMENT',
    };
  }
  // Duplicate detection binds the exact rendered body, not the
  // reviewer/head/disposition triple: a legacy or superseded same-disposition
  // review must never block a changed evidence packet, while resubmitting a
  // packet whose rendered body is already live stays an idempotent no-op.
  const sameDispositionState = {
    APPROVE: 'APPROVED',
    REQUEST_CHANGES: 'CHANGES_REQUESTED',
    COMMENT: 'COMMENTED',
  }[recommendedAction];
  const renderedBody = normalizedReviewBody(renderReviewBody(packet));
  if (
    liveInput.reviews.some(
      (review) =>
        review.author !== null &&
        review.author.toLowerCase() === reviewer.toLowerCase() &&
        review.commitSha === liveInput.headSha &&
        review.state === sameDispositionState &&
        typeof review.body === 'string' &&
        (() => {
          const publishedBody = normalizedReviewBody(review.body);
          if (recommendedAction === 'COMMENT') return publishedBody === renderedBody;
          if (
            hasUniquePublishedPacketReceipts(review.body, packet) &&
            publishedBody === renderedBody
          ) {
            return true;
          }
          if (!priorPacket) return false;
          try {
            validatePublishedReviewPacket(packet, priorPacket);
            return (
              hasUniquePublishedPacketReceipts(review.body, priorPacket) &&
              publishedBody === normalizedReviewBody(renderReviewBody(priorPacket)) &&
              matchesPublishedReviewInput(priorPacket, liveInput, review)
            );
          } catch {
            return false;
          }
        })()
    )
  ) {
    return {
      allowed: false,
      duplicate: true,
      reason: 'the live head already carries this exact rendered review from this reviewer',
      recommendedAction,
    };
  }
  // The packet cannot opt out by clearing its prior pointers. Derive the
  // required predecessor from canonical live history and the actual viewer,
  // then bind the supplied artifact before permitting another disposition.
  try {
    verifySubmissionReconciliation(packet, liveInput, reviewer, priorPacket);
  } catch (error) {
    return { allowed: false, reason: error.message };
  }
  if (
    ['REQUEST_CHANGES', 'APPROVE'].includes(recommendedAction) &&
    packet.agentEvidence.debt.some((item) => item.kind === 'verification')
  ) {
    return { allowed: false, reason: 'review disposition has unresolved verification debt' };
  }
  if (recommendedAction === 'REQUEST_CHANGES') {
    if (packet.findings.length === 0) {
      return { allowed: false, reason: 'REQUEST_CHANGES requires at least one finding' };
    }
    if (
      packet.limitations.length > 0 ||
      packet.unknowns.length > 0 ||
      packet.humanGates.length > 0
    ) {
      return {
        allowed: false,
        reason: 'REQUEST_CHANGES requires complete evidence and no attended decision',
      };
    }
  }
  if (recommendedAction === 'APPROVE') {
    if (
      packet.findings.length > 0 ||
      packet.limitations.length > 0 ||
      packet.unknowns.length > 0 ||
      packet.humanGates.length > 0
    ) {
      return { allowed: false, reason: 'APPROVE requires a complete clean review packet' };
    }
    if (hasUndisclosedPreviewAuthorizationDebt(packet, liveInput)) {
      return { allowed: false, reason: 'external preview authorization debt must be disclosed' };
    }
    if (ciConclusion !== 'success') {
      return { allowed: false, reason: 'APPROVE requires successful live checks' };
    }
    if (dcoConclusion !== 'success') {
      return { allowed: false, reason: 'APPROVE requires a successful trusted DCO status' };
    }
  }
  return {
    allowed: true,
    reason: 'authorized review submission',
    recommendedAction,
    ciConclusion,
    dcoConclusion,
    authorizationId,
  };
}

function latestReviewStatesByAuthor(input, { exactHead = false } = {}) {
  const reviews = input.reviews.filter(
    (review) =>
      (!exactHead || review.commitSha === input.headSha) &&
      ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)
  );
  const byAuthor = new Map();
  for (const review of reviews) {
    const identityKey =
      review.author === null
        ? `unknown-reviewer:${review.id}`
        : `login:${review.author.toLowerCase()}`;
    if (!byAuthor.has(identityKey)) byAuthor.set(identityKey, []);
    byAuthor.get(identityKey).push(review);
  }
  return new Map(
    [...byAuthor].map(([identity, history]) => [
      identity,
      uniqueLatestReview(history)?.state ?? null,
    ])
  );
}

export function reviewerPermissionSubjects(input) {
  if (!hasCompleteCommitContributorIdentity(input)) return [];
  const ineligible = dispositionIneligibleLogins(input);
  return [...latestReviewStatesByAuthor(input, { exactHead: true }).entries()]
    .filter(
      ([identity, state]) =>
        state === 'APPROVED' &&
        identity.startsWith('login:') &&
        !ineligible.has(identity.slice('login:'.length))
    )
    .map(([identity]) => identity.slice('login:'.length))
    .sort();
}

function hasCurrentReviewWritePermission(input, login) {
  return input.reviewerPermissions.some(
    (item) => item.login === login.toLowerCase() && ['write', 'admin'].includes(item.permission)
  );
}

export function authorizePullRequestMerge({
  packet,
  publishedPacket = null,
  input,
  liveInput,
  executionMode,
  executionModeSource,
  authorizationId,
  policy,
  selfAssessment,
  credentialCanMerge,
  credentialPermission,
  credentialCanBypass,
  actor,
  ciConclusion,
  dcoConclusion,
  mergeable,
  mergeStateStatus,
  ownerAuthorization = null,
}) {
  assert(['human-assisted', 'autonomous'].includes(executionMode), 'execution mode is invalid');
  validateReviewMutationInput(input);
  validateReviewPacket(packet, input);
  verifyLiveReviewInput(packet, liveInput);
  const revision = inspectReviewRevision(packet, input, liveInput.headSha, null, liveInput.baseSha);
  if (revision.stale) {
    return { allowed: false, reason: 'review packet is stale at the merge boundary' };
  }
  assert(typeof actor === 'string' && actor.length > 0, 'live actor identity is required');
  const explicitCurrentUser =
    executionMode === 'human-assisted' &&
    ['current-user', 'active-human-loop'].includes(executionModeSource) &&
    authorizationId === 'explicit-current-user';
  const standingAuthorization = policy?.pullRequestMergeAuthorizations?.find(
    (authorization) => authorization.id === authorizationId
  );
  const activeStandingAuthorization = standingAuthorizationMatches(standingAuthorization, {
    executionMode,
    executionModeSource,
    repositoryId: packet.repositoryId,
  });
  if (
    activeStandingAuthorization &&
    !assessmentAllowsMutation(selfAssessment, policy, standingAuthorization.mutationClass)
  ) {
    return { allowed: false, reason: 'pull-request merge exceeds the autonomous ceiling' };
  }
  const delegated = ownerAuthorizationAllows(ownerAuthorization, {
    repositoryId: packet.repositoryId,
    scopeId: 'pull-request:' + packet.pullRequest,
    action: 'integrate',
    executionMode,
    actor,
    authorizationId,
    executionModeSource,
  });
  if (!explicitCurrentUser && !activeStandingAuthorization && !delegated) {
    return { allowed: false, reason: 'pull-request merge authorization is unavailable' };
  }
  if (!credentialCanMerge) {
    return { allowed: false, reason: 'live credential cannot merge pull requests' };
  }
  if (liveInput.pullRequestState !== 'OPEN') {
    return { allowed: false, reason: 'pull request is not open' };
  }
  if (liveInput.isDraft) return { allowed: false, reason: 'draft pull request cannot be merged' };

  const expectedBaseRefName = activeStandingAuthorization
    ? standingAuthorization.baseRefName
    : 'main';
  if (liveInput.baseRefName !== expectedBaseRefName) {
    return { allowed: false, reason: 'pull request targets an unauthorized base branch' };
  }
  if (packet.recommendedAction !== 'APPROVE') {
    return { allowed: false, reason: 'merge requires a clean APPROVE review packet' };
  }
  if (packet.schemaVersion !== 2) {
    return {
      allowed: false,
      reason: 'merge requires a schema v2 review packet with Agent evidence',
    };
  }
  if (packet.agentEvidence.debt.some((item) => item.kind === 'verification')) {
    return { allowed: false, reason: 'merge has unresolved verification debt' };
  }
  if (hasUndisclosedPreviewAuthorizationDebt(packet, liveInput)) {
    return { allowed: false, reason: 'merge has undisclosed external preview authorization debt' };
  }
  if (
    packet.findings.length > 0 ||
    packet.limitations.length > 0 ||
    packet.unknowns.length > 0 ||
    packet.humanGates.length > 0
  ) {
    return { allowed: false, reason: 'merge requires a complete clean review packet' };
  }
  if (ciConclusion !== 'success') {
    return { allowed: false, reason: 'merge requires successful trusted live checks' };
  }
  if (dcoConclusion !== 'success') {
    return { allowed: false, reason: 'merge requires a successful trusted DCO status' };
  }
  if (liveInput.threads.some((thread) => thread.isResolved !== true)) {
    return { allowed: false, reason: 'merge requires every review thread to be resolved' };
  }
  // GitHub marks a mergeable head UNSTABLE even when its only non-passing
  // context is the verified Vercel preview-authorization prompt. That exact
  // publication debt is already excluded from trusted CI; do not reintroduce
  // it through the aggregate merge state. Every other context must be terminal
  // and successful, and the final non-admin merge API still enforces GitHub rules.
  const previewAuthorizationOnlyUnstable =
    mergeStateStatus === 'UNSTABLE' &&
    ['MAINTAIN', 'WRITE'].includes(credentialPermission) &&
    credentialCanBypass === false &&
    liveInput.checks.some(isExternalPreviewAuthorizationFailure) &&
    liveInput.checks.every(
      (check) =>
        check.status === 'COMPLETED' &&
        (isExternalPreviewAuthorizationFailure(check) ||
          ['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(check.conclusion))
    );
  if (
    mergeable !== 'MERGEABLE' ||
    (mergeStateStatus !== 'CLEAN' && !previewAuthorizationOnlyUnstable)
  ) {
    return { allowed: false, reason: 'GitHub does not report the exact head as merge-ready' };
  }

  const allHeadReviewStates = latestReviewStatesByAuthor(liveInput);
  if ([...allHeadReviewStates.values()].includes(null)) {
    return {
      allowed: false,
      reason: 'review order is unavailable or ambiguous; reconcile live history before merging',
    };
  }
  const activeChangeRequest = [...allHeadReviewStates.values()].includes('CHANGES_REQUESTED');
  if (activeChangeRequest) {
    return {
      allowed: false,
      reason: 'an active change request has not been superseded or dismissed',
    };
  }
  const headReviewStates = latestReviewStatesByAuthor(liveInput, { exactHead: true });
  if (!hasCompleteCommitContributorIdentity(liveInput)) {
    return {
      allowed: false,
      reason: 'a commit author or committer lacks a verifiable platform identity',
    };
  }
  const ineligibleApprovalLogins = dispositionIneligibleLogins(liveInput);
  const independentApproval = [...headReviewStates.entries()].some(
    ([reviewer, state]) =>
      state === 'APPROVED' &&
      reviewer.startsWith('login:') &&
      !ineligibleApprovalLogins.has(reviewer.slice('login:'.length)) &&
      hasCurrentReviewWritePermission(liveInput, reviewer.slice('login:'.length))
  );
  if (!independentApproval) {
    return {
      allowed: false,
      reason:
        'the exact head lacks an approval independent of the pull-request author and commit contributors with verified current repository write permission',
    };
  }

  // The publication source must itself be a valid independent approval.
  // A matching digest in arbitrary participant-authored text is not authority.
  try {
    validatePublishedReviewPacket(packet, publishedPacket);
  } catch (error) {
    return { allowed: false, reason: error.message };
  }
  const evidenceReceipt = agentEvidenceMarker(publishedPacket);
  const renderedPublication = normalizedReviewBody(renderReviewBody(publishedPacket));
  const publicationReceipt = liveInput.reviews.some(
    (review) =>
      review.commitSha === liveInput.headSha &&
      review.state === 'APPROVED' &&
      review.author !== null &&
      !ineligibleApprovalLogins.has(review.author.toLowerCase()) &&
      hasCurrentReviewWritePermission(liveInput, review.author) &&
      headReviewStates.get(`login:${review.author.toLowerCase()}`) === 'APPROVED' &&
      typeof review.body === 'string' &&
      hasUniquePublishedPacketReceipts(review.body, publishedPacket) &&
      normalizedReviewBody(review.body) === renderedPublication &&
      matchesPublishedReviewInput(publishedPacket, liveInput, review)
  );
  if (!publicationReceipt) {
    const unboundComment = liveInput.comments.some(
      (comment) =>
        typeof comment.body === 'string' && hasReceiptMarker(comment.body, evidenceReceipt)
    );
    return {
      allowed: false,
      reason: unboundComment
        ? 'comment evidence marker lacks a governed publication authorization receipt; publish through a valid exact-head independent APPROVE review and re-collect'
        : 'merge requires a live published review packet and Agent evidence receipt from the same valid exact-head independent APPROVE review, with only its publication delta since the reviewed input',
    };
  }

  return {
    allowed: true,
    reason: 'authorized exact-head pull-request merge',
    authorizationId,
    headSha: liveInput.headSha,
    mergeMethod: activeStandingAuthorization ? standingAuthorization.mergeMethod : 'squash',
    actor,
  };
}
