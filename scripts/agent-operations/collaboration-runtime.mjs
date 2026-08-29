import { createHash } from 'node:crypto';

const SHA = /^[a-f0-9]{40,64}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const REPOSITORY_ID = /^github\.com:[^/\s]+\/[^/\s]+$/;
const RFC3339 = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;
const BANDS = ['U0', 'C1', 'C2', 'C3', 'C4'];

export const COLLABORATION_ACTIONS = Object.freeze([
  'update-governed-issue-or-pull-request-metadata',
  'update-pull-request-branch-at-expected-head',
  'mark-exact-head-ready-for-review',
  'request-independent-review',
  'resolve-fixed-review-thread',
  'rerun-exact-trusted-workflow',
  'post-bounded-reconciliation-comment',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys, label) {
  assert(isObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} has unexpected or missing fields`
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalJson(value[key])])
  );
}

function sha256(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

function timestamp(value, label) {
  assert(typeof value === 'string' && RFC3339.test(value), `${label} must be an RFC3339 timestamp`);
  assert(Number.isFinite(Date.parse(value)), `${label} must be a real timestamp`);
}

function string(value, label, { min = 1, max = 4_000 } = {}) {
  assert(
    typeof value === 'string' && value.length >= min && value.length <= max,
    `${label} must be a string between ${min} and ${max} characters`
  );
}

function nullableString(value, label, options) {
  if (value === null) return;
  string(value, label, options);
}

function sha(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return;
  assert(typeof value === 'string' && SHA.test(value), `${label} must be a Git SHA`);
}

function sortedUniqueStrings(value, label, { min = 0 } = {}) {
  assert(Array.isArray(value) && value.length >= min, `${label} must be an array`);
  for (const item of value) string(item, `${label} item`, { max: 200 });
  const sorted = [...value].sort((left, right) => left.localeCompare(right));
  assert(new Set(value).size === value.length, `${label} must not contain duplicates`);
  assert(JSON.stringify(sorted) === JSON.stringify(value), `${label} must be sorted`);
}

function validateEvidence(evidence, { required = false, purpose = 'collaboration' } = {}) {
  assert(Array.isArray(evidence), 'request.evidence must be an array');
  if (required) assert(evidence.length > 0, `${purpose} evidence is required`);
  const types = new Set();
  for (const [index, artifact] of evidence.entries()) {
    assert(isObject(artifact), `request.evidence[${index}] must be an object`);
    const keys = Object.keys(artifact);
    assert(
      keys.every((key) => ['type', 'reference', 'digest'].includes(key)) &&
        keys.includes('type') &&
        keys.includes('reference'),
      `request.evidence[${index}] has an invalid shape`
    );
    assert(
      typeof artifact.type === 'string' && /^[a-z][a-z0-9-]*$/.test(artifact.type),
      `request.evidence[${index}].type is invalid`
    );
    assert(!types.has(artifact.type), `request.evidence duplicates type ${artifact.type}`);
    types.add(artifact.type);
    string(artifact.reference, `request.evidence[${index}].reference`, { max: 1_000 });
    if (artifact.digest !== undefined) {
      assert(DIGEST.test(artifact.digest), `request.evidence[${index}].digest is invalid`);
    }
  }
}


function requireEvidenceType(evidence, type, purpose) {
  assert(
    evidence.some((artifact) => artifact.type === type),
    `${purpose} evidence of type ${type} is required`
  );
}

function requireEvidenceDigest(evidence, type, purpose) {
  const artifact = evidence.find((entry) => entry.type === type);
  assert(artifact, `${purpose} evidence of type ${type} is required`);
  assert(DIGEST.test(artifact.digest ?? ''), `${purpose} evidence of type ${type} requires a digest`);
  return artifact;
}

function validateCommonTarget(target, { head = true } = {}) {
  exactKeys(target, ['kind', 'number', 'updatedAt', 'headSha'], 'request.target');
  assert(['issue', 'pull-request'].includes(target.kind), 'request.target.kind is invalid');
  assert(Number.isInteger(target.number) && target.number > 0, 'request.target.number is invalid');
  timestamp(target.updatedAt, 'request.target.updatedAt');
  sha(target.headSha, 'request.target.headSha', { nullable: !head || target.kind === 'issue' });
  if (target.kind === 'issue') {
    assert(target.headSha === null, 'Issue targets must use a null headSha');
  } else {
    sha(target.headSha, 'request.target.headSha');
  }
}

function validateMetadata(value, label) {
  exactKeys(value, ['title', 'body', 'milestoneNumber', 'assignees', 'labels'], label);
  string(value.title, `${label}.title`, { max: 256 });
  nullableString(value.body, `${label}.body`, { min: 0, max: 65_536 });
  assert(
    value.milestoneNumber === null ||
      (Number.isInteger(value.milestoneNumber) && value.milestoneNumber > 0),
    `${label}.milestoneNumber is invalid`
  );
  sortedUniqueStrings(value.assignees, `${label}.assignees`);
  sortedUniqueStrings(value.labels, `${label}.labels`);
}

function validateRequestAction(request) {
  const { action, target, expected, desired } = request;
  if (action === 'update-governed-issue-or-pull-request-metadata') {
    validateCommonTarget(target);
    validateMetadata(expected, 'request.expected');
    validateMetadata(desired, 'request.desired');
    assert(
      JSON.stringify(expected) !== JSON.stringify(desired),
      'metadata request must change at least one field'
    );
  } else if (action === 'update-pull-request-branch-at-expected-head') {
    exactKeys(target, ['kind', 'number', 'updatedAt', 'headSha', 'baseSha'], 'request.target');
    assert(target.kind === 'pull-request', 'update-branch target must be a pull request');
    assert(
      Number.isInteger(target.number) && target.number > 0,
      'request.target.number is invalid'
    );
    timestamp(target.updatedAt, 'request.target.updatedAt');
    sha(target.headSha, 'request.target.headSha');
    sha(target.baseSha, 'request.target.baseSha');
    exactKeys(expected, ['containsBaseSha'], 'request.expected');
    exactKeys(desired, ['containsBaseSha'], 'request.desired');
    assert(expected.containsBaseSha === false, 'update-branch expected state must be behind');
    assert(desired.containsBaseSha === true, 'update-branch desired state must contain baseSha');
    } else if (action === 'mark-exact-head-ready-for-review') {
    validateCommonTarget(target);
    assert(target.kind === 'pull-request', 'ready-for-review target must be a pull request');
    exactKeys(expected, ['isDraft'], 'request.expected');
    exactKeys(desired, ['isDraft'], 'request.desired');
    assert(expected.isDraft === true, 'ready-for-review expected state must be draft');
    assert(desired.isDraft === false, 'ready-for-review desired state must not be draft');
    requireEvidenceType(request.evidence, 'validation-report', 'ready-for-review validation');
    requireEvidenceDigest(request.evidence, 'validation-report', 'ready-for-review validation');
  } else if (action === 'request-independent-review') {
    validateCommonTarget(target);
    assert(target.kind === 'pull-request', 'review-request target must be a pull request');
    exactKeys(expected, ['requestedReviewerLogins'], 'request.expected');
    sortedUniqueStrings(
      expected.requestedReviewerLogins,
      'request.expected.requestedReviewerLogins'
    );
    exactKeys(desired, ['reviewerLogin'], 'request.desired');
    string(desired.reviewerLogin, 'request.desired.reviewerLogin', { max: 100 });
    assert(
      !expected.requestedReviewerLogins.includes(desired.reviewerLogin),
      'reviewer is already present in the expected state'
    );
  } else if (action === 'resolve-fixed-review-thread') {
    exactKeys(
      target,
      ['kind', 'number', 'updatedAt', 'headSha', 'threadId', 'threadUpdatedAt'],
      'request.target'
    );
    assert(target.kind === 'review-thread', 'thread-resolution target kind is invalid');
    assert(
      Number.isInteger(target.number) && target.number > 0,
      'request.target.number is invalid'
    );
    timestamp(target.updatedAt, 'request.target.updatedAt');
    timestamp(target.threadUpdatedAt, 'request.target.threadUpdatedAt');
    sha(target.headSha, 'request.target.headSha');
    string(target.threadId, 'request.target.threadId', { max: 200 });
    exactKeys(expected, ['isResolved'], 'request.expected');
    exactKeys(desired, ['isResolved'], 'request.desired');
    assert(expected.isResolved === false, 'thread expected state must be unresolved');
    assert(desired.isResolved === true, 'thread desired state must be resolved');
    validateEvidence(request.evidence, { required: true, purpose: 'resolution' });
    requireEvidenceType(request.evidence, 'review-thread-resolution', 'review-thread resolution');
  } else if (action === 'rerun-exact-trusted-workflow') {
    exactKeys(
      target,
      ['kind', 'runId', 'updatedAt', 'headSha', 'attempt', 'workflowName', 'workflowPath'],
      'request.target'
    );
    assert(target.kind === 'workflow-run', 'workflow target kind is invalid');
    assert(Number.isInteger(target.runId) && target.runId > 0, 'request.target.runId is invalid');
    assert(
      Number.isInteger(target.attempt) && target.attempt > 0,
      'request.target.attempt is invalid'
    );
    timestamp(target.updatedAt, 'request.target.updatedAt');
    sha(target.headSha, 'request.target.headSha');
    string(target.workflowName, 'request.target.workflowName', { max: 256 });
    string(target.workflowPath, 'request.target.workflowPath', { max: 500 });
    assert(
      target.workflowPath.startsWith('.github/workflows/'),
      'request.target.workflowPath must be a repository workflow path'
    );
    exactKeys(expected, ['status', 'conclusion'], 'request.expected');
    assert(expected.status === 'completed', 'workflow rerun expected status must be completed');
    string(expected.conclusion, 'request.expected.conclusion', { max: 100 });
    exactKeys(desired, ['mode'], 'request.desired');
    assert(['all', 'failed-jobs'].includes(desired.mode), 'request.desired.mode is invalid');
    validateEvidence(request.evidence, { required: true, purpose: 'CI diagnosis' });
    requireEvidenceType(request.evidence, 'ci-diagnosis', 'CI diagnosis');
  } else {
    validateCommonTarget(target);
    exactKeys(expected, ['markerAbsent'], 'request.expected');
    assert(expected.markerAbsent === true, 'comment expected state must require an absent marker');
    exactKeys(desired, ['body'], 'request.desired');
    string(desired.body, 'request.desired.body', { max: 4_000 });
    assert(
      !desired.body.includes('<!-- proto-ui-collaboration:'),
      'comment body must not forge a marker'
    );
  }
}

export function computeCollaborationRequestDigest(request) {
  assert(isObject(request), 'collaboration request must be an object');
  const canonical = structuredClone(request);
  delete canonical.requestDigest;
  return sha256(canonical);
}

export function validateCollaborationRequest(request) {
  exactKeys(
    request,
    [
      'schemaVersion',
      'kind',
      'repositoryId',
      'authorizationId',
      'action',
      'requestedAt',
      'requestDigest',
      'target',
      'expected',
      'desired',
      'evidence',
      'rationale',
      'humanGates',
    ],
    'collaboration request'
  );
  assert(request.schemaVersion === 1, 'request.schemaVersion must be 1');
  assert(request.kind === 'proto-ui.collaboration-request', 'request.kind is invalid');
  assert(REPOSITORY_ID.test(request.repositoryId), 'request.repositoryId is invalid');
  string(request.authorizationId, 'request.authorizationId', { max: 200 });
  assert(
    COLLABORATION_ACTIONS.includes(request.action),
    'request.action is outside the collaboration scope'
  );
  timestamp(request.requestedAt, 'request.requestedAt');
  assert(HEX64.test(request.requestDigest), 'request.requestDigest is invalid');
  string(request.rationale, 'request.rationale', { max: 2_000 });
  assert(Array.isArray(request.humanGates), 'request.humanGates must be an array');
  assert(
    request.humanGates.length === 0,
    'collaboration request cannot carry an attended decision'
  );
  validateEvidence(request.evidence);
  validateRequestAction(request);
  assert(
    request.requestDigest === computeCollaborationRequestDigest(request),
    'request.requestDigest does not match the canonical request'
  );
  return request;
}

export function validateCollaborationHandoffBinding(
  request,
  handoff,
  { selfAssessment = null } = {}
) {
  validateCollaborationRequest(request);
  assert(isObject(handoff), 'collaboration handoff must be an object');
  assert(Array.isArray(handoff.artifacts), 'collaboration handoff artifacts must be an array');
  const requestArtifact = handoff.artifacts.find(
    (artifact) => artifact.type === 'collaboration-request'
  );
  assert(requestArtifact, 'collaboration handoff is missing the collaboration-request artifact');
  assert(
    requestArtifact.digest === `sha256:${request.requestDigest}`,
    'collaboration-request artifact does not bind requestDigest'
  );
  const authorizationArtifact = handoff.artifacts.find(
    (artifact) => artifact.type === 'mutation-authorization'
  );
  assert(
    authorizationArtifact,
    'collaboration handoff is missing the mutation-authorization artifact'
  );
  assert(
    authorizationArtifact.reference === request.authorizationId,
    'mutation-authorization artifact does not bind authorizationId'
  );
  if (request.action === 'mark-exact-head-ready-for-review') {
    const validationReport = request.evidence?.find(
      (entry) => entry.type === 'validation-report'
    );
    assert(
      validationReport && DIGEST.test(validationReport.digest ?? ''),
      'ready-for-review requires validation-report evidence with a digest'
    );
    const validationArtifact = handoff.artifacts.find(
      (artifact) => artifact.type === 'validation-report'
    );
    assert(
      validationArtifact,
      'collaboration handoff is missing the validation-report artifact'
    );
    assert(
      validationArtifact.reference === validationReport.reference &&
        validationArtifact.digest === validationReport.digest,
      'validation-report artifact does not bind the ready-for-review evidence'
    );
  }
  if (handoff.executionMode === 'autonomous') {
    assert(
      selfAssessment?.kind === 'proto-ui.agent-capability-self-result' &&
        HEX64.test(selfAssessment.resultDigest ?? ''),
      'autonomous collaboration handoff requires the loaded self-assessment result'
    );
    const capabilityArtifact = handoff.artifacts.find(
      (artifact) => artifact.type === 'capability-envelope'
    );
    assert(
      capabilityArtifact?.digest === `sha256:${selfAssessment.resultDigest}`,
      'capability-envelope artifact does not bind the loaded self-assessment'
    );
  }
  return handoff;
}

function validateLiveCommon(liveState, request) {
  exactKeys(
    liveState,
    [
      'schemaVersion',
      'kind',
      'repositoryId',
      'action',
      'observedAt',
      'viewerLogin',
      'viewerPermission',
      'current',
    ],
    'live collaboration state'
  );
  assert(liveState.schemaVersion === 1, 'live state schemaVersion must be 1');
  assert(liveState.kind === 'proto-ui.live-collaboration-state', 'live state kind is invalid');
  assert(liveState.repositoryId === request.repositoryId, 'live repository does not match request');
  assert(liveState.action === request.action, 'live action does not match request');
  timestamp(liveState.observedAt, 'live state observedAt');
  string(liveState.viewerLogin, 'live state viewerLogin', { max: 100 });
  assert(
    ['NONE', 'READ', 'TRIAGE', 'WRITE', 'MAINTAIN', 'ADMIN'].includes(liveState.viewerPermission),
    'live state viewerPermission is invalid'
  );
  assert(isObject(liveState.current), 'live state current must be an object');
}

function validateCurrentIdentity(current, target, { thread = false, workflow = false } = {}) {
  if (workflow) {
    assert(current.kind === 'workflow-run', 'live workflow kind does not match request');
    assert(current.runId === target.runId, 'live workflow run does not match request');
    return;
  }
  if (thread) {
    assert(current.kind === 'review-thread', 'live review-thread kind does not match request');
  } else {
    assert(current.kind === target.kind, 'live target kind does not match request');
  }
  assert(current.number === target.number, 'live target number does not match request');
}

function equalMetadata(current, desired) {
  return (
    current.title === desired.title &&
    current.body === desired.body &&
    current.milestoneNumber === desired.milestoneNumber &&
    JSON.stringify(current.assignees) === JSON.stringify(desired.assignees) &&
    JSON.stringify(current.labels) === JSON.stringify(desired.labels)
  );
}

function rejected(request, reason) {
  return {
    allowed: false,
    outcome: 'rejected',
    reason,
    requestDigest: request.requestDigest,
  };
}

function noOp(request, reason) {
  return {
    allowed: true,
    outcome: 'no-op',
    reason,
    requestDigest: request.requestDigest,
    mutationCount: 0,
  };
}

function mutate(request) {
  return {
    allowed: true,
    outcome: 'mutate',
    reason: 'exact live preflight and purpose-bound authorization are satisfied',
    requestDigest: request.requestDigest,
    mutationCount: 1,
  };
}

function validateAuthority({
  request,
  executionMode,
  executionModeSource,
  policy,
  selfAssessment,
}) {
  if (executionMode === 'human-assisted') {
    if (!['current-user', 'active-human-loop'].includes(executionModeSource)) {
      return 'human-assisted collaboration source is invalid';
    }
    if (request.authorizationId !== 'explicit-current-user') {
      return 'human-assisted collaboration requires explicit-current-user authorization';
    }
    if (
      !request.evidence.some((artifact) =>
        ['current-user-instruction', 'governed-outcome'].includes(artifact.type)
      )
    ) {
      return 'human-assisted collaboration requires purpose evidence for the current user instruction';
    }
    return null;
  }
  if (executionMode !== 'autonomous') return 'execution mode is invalid';
  if (
    selfAssessment?.kind !== 'proto-ui.agent-capability-self-result' ||
    selfAssessment?.validated !== true ||
    selfAssessment?.fresh !== true
  ) {
    return 'autonomous collaboration requires a fresh validated self-assessment';
  }
  const authorization = policy?.collaborationMutationAuthorizations?.find(
    (candidate) => candidate.id === request.authorizationId
  );
  if (
    authorization?.status !== 'active' ||
    authorization?.executionMode !== 'autonomous' ||
    authorization?.executionModeSource !== executionModeSource ||
    authorization?.repositoryId !== request.repositoryId ||
    authorization?.mutationClass !== 'reversible-github-collaboration' ||
    !authorization?.allowedActions?.includes(request.action)
  ) {
    return 'request is not covered by an active standing authorization';
  }
  if (!request.evidence.some((artifact) => artifact.type === 'governed-outcome')) {
    return 'standing collaboration requires purpose evidence for the current governed outcome';
  }
  const requiredBand =
    policy?.mutationClasses?.[authorization.mutationClass]?.autonomousMinimumBand;
  const actualBand = selfAssessment?.capability?.band;
  if (
    !BANDS.includes(requiredBand) ||
    !BANDS.includes(actualBand) ||
    BANDS.indexOf(actualBand) < BANDS.indexOf(requiredBand) ||
    !selfAssessment.capability.eligibleTaskClasses?.includes('maintain-collaboration-state')
  ) {
    return 'collaboration mutation exceeds the autonomous capability ceiling';
  }
  return null;
}

function targetHeadMatches(request, current) {
  return request.target.kind === 'issue' || current.headSha === request.target.headSha;
}

function requireOpen(request, current) {
  return current.state === 'OPEN' ? null : rejected(request, 'live target is not open');
}

export function collaborationMarker(request) {
  validateCollaborationRequest(request);
  return `<!-- proto-ui-collaboration:${request.requestDigest} -->`;
}

export function desiredCollaborationStateSatisfied(request, liveState) {
  validateCollaborationRequest(request);
  validateLiveCommon(liveState, request);
  const current = liveState.current;
  const action = request.action;
  if (action === 'update-governed-issue-or-pull-request-metadata') {
    return targetHeadMatches(request, current) && equalMetadata(current, request.desired);
  }
  if (action === 'update-pull-request-branch-at-expected-head') {
    return current.baseSha === request.target.baseSha && current.containsBaseSha === true;
  }
  if (action === 'mark-exact-head-ready-for-review') {
    return current.headSha === request.target.headSha && current.isDraft === false;
  }
  if (action === 'request-independent-review') {
    return (
      current.headSha === request.target.headSha &&
      current.requestedReviewerLogins.includes(request.desired.reviewerLogin)
    );
  }
  if (action === 'resolve-fixed-review-thread') {
    return (
      current.headSha === request.target.headSha &&
      current.threadId === request.target.threadId &&
      current.threadUpdatedAt === request.target.threadUpdatedAt &&
      current.isResolved === true
    );
  }
  if (action === 'rerun-exact-trusted-workflow') {
    return (
      current.headSha === request.target.headSha &&
      current.workflowName === request.target.workflowName &&
      current.workflowPath === request.target.workflowPath &&
      current.headRepositoryId === request.repositoryId &&
      current.attempt > request.target.attempt
    );
  }
  const marker = collaborationMarker(request);
  return (
    targetHeadMatches(request, current) &&
    current.markerComment?.body?.includes(marker) === true &&
    current.markerComment.body.startsWith(request.desired.body)
  );
}

export function authorizeCollaborationMutation({
  request,
  liveState,
  executionMode,
  executionModeSource,
  policy,
  selfAssessment = null,
}) {
  validateCollaborationRequest(request);
  validateLiveCommon(liveState, request);
  const authorityFailure = validateAuthority({
    request,
    executionMode,
    executionModeSource,
    policy,
    selfAssessment,
  });
  if (authorityFailure) return rejected(request, authorityFailure);
  if (!['WRITE', 'MAINTAIN', 'ADMIN'].includes(liveState.viewerPermission)) {
    return rejected(request, 'live credential lacks write permission');
  }

  const current = liveState.current;
  const action = request.action;
  if (action === 'update-governed-issue-or-pull-request-metadata') {
    validateCurrentIdentity(current, request.target);
    const closed = requireOpen(request, current);
    if (closed) return closed;
    if (!targetHeadMatches(request, current)) return rejected(request, 'live head SHA is stale');
    if (current.desiredLabelsExist !== true) {
      return rejected(request, 'desired metadata contains a label that does not exist');
    }
    if (equalMetadata(current, request.desired)) {
      return noOp(request, 'desired metadata state is already live');
    }
    if (current.updatedAt !== request.target.updatedAt) {
      return rejected(request, 'live target updatedAt is stale');
    }
    if (!equalMetadata(current, request.expected)) {
      return rejected(request, 'live metadata does not match the exact expected state');
    }
    return mutate(request);
  }

  if (action === 'update-pull-request-branch-at-expected-head') {
    validateCurrentIdentity(current, request.target);
    const closed = requireOpen(request, current);
    if (closed) return closed;
    if (current.baseSha !== request.target.baseSha)
      return rejected(request, 'live base SHA is stale');
    if (current.containsBaseSha === true) {
      return noOp(request, 'pull-request branch already contains the exact base SHA');
    }
    if (current.headSha !== request.target.headSha)
      return rejected(request, 'live head SHA is stale');
    if (current.updatedAt !== request.target.updatedAt) {
      return rejected(request, 'live target updatedAt is stale');
    }
    const viewerOwnsPullRequest =
      current.authorLogin.toLowerCase() === liveState.viewerLogin.toLowerCase();
    if (!viewerOwnsPullRequest && current.maintainerCanModify !== true) {
      return rejected(
        request,
        'pull-request branch is neither author-owned by the acting credential nor maintainer-editable'
      );
    }
    if (current.containsBaseSha !== request.expected.containsBaseSha) {
      return rejected(request, 'live branch ancestry does not match the expected state');
    }
    return mutate(request);
  }

  if (action === 'mark-exact-head-ready-for-review') {
    validateCurrentIdentity(current, request.target);
    const closed = requireOpen(request, current);
    if (closed) return closed;
    if (current.headSha !== request.target.headSha)
      return rejected(request, 'live head SHA is stale');
    if (current.isDraft === false) return noOp(request, 'exact head is already ready for review');
    if (current.updatedAt !== request.target.updatedAt) {
      return rejected(request, 'live target updatedAt is stale');
    }
    if (current.isDraft !== request.expected.isDraft) {
      return rejected(request, 'live draft state does not match the expected state');
    }
    return mutate(request);
  }

  if (action === 'request-independent-review') {
    validateCurrentIdentity(current, request.target);
    const closed = requireOpen(request, current);
    if (closed) return closed;
    if (current.headSha !== request.target.headSha)
      return rejected(request, 'live head SHA is stale');
    const reviewer = request.desired.reviewerLogin;
    if (reviewer.toLowerCase() === current.authorLogin.toLowerCase()) {
      return rejected(request, 'independent reviewer cannot be the pull-request author');
    }
    if (reviewer.toLowerCase() === liveState.viewerLogin.toLowerCase()) {
      return rejected(request, 'independent reviewer cannot be the acting credential');
    }
    if (current.commitContributorIdentityComplete !== true) {
      return rejected(request, 'pull-request commit contributor identity is unavailable');
    }
    if (
      current.commitContributorLogins.some(
        (login) => login.toLowerCase() === reviewer.toLowerCase()
      )
    ) {
      return rejected(request, 'independent reviewer cannot be a pull-request commit contributor');
    }
    if (current.requestedReviewerLogins.includes(reviewer)) {
      return noOp(request, 'reviewer is already requested for the exact head');
    }
    if (current.updatedAt !== request.target.updatedAt) {
      return rejected(request, 'live target updatedAt is stale');
    }
    if (
      JSON.stringify(current.requestedReviewerLogins) !==
      JSON.stringify(request.expected.requestedReviewerLogins)
    ) {
      return rejected(request, 'live requested-reviewer state does not match the expected state');
    }
    return mutate(request);
  }

  if (action === 'resolve-fixed-review-thread') {
    validateCurrentIdentity(current, request.target, { thread: true });
    const closed = requireOpen(request, current);
    if (closed) return closed;
    if (current.headSha !== request.target.headSha)
      return rejected(request, 'live head SHA is stale');
    if (current.threadId !== request.target.threadId) {
      return rejected(request, 'live review-thread identity does not match request');
    }
    if (current.isResolved === true)
      return noOp(request, 'exact review thread is already resolved');
    if (current.updatedAt !== request.target.updatedAt) {
      return rejected(request, 'live target updatedAt is stale');
    }
    if (current.threadUpdatedAt !== request.target.threadUpdatedAt) {
      return rejected(request, 'live review-thread revision is stale');
    }
    if (current.isResolved !== request.expected.isResolved) {
      return rejected(request, 'live review-thread state does not match expected state');
    }
    return mutate(request);
  }

  if (action === 'rerun-exact-trusted-workflow') {
    validateCurrentIdentity(current, request.target, { workflow: true });
    const trusted = policy?.trustedCiEvidence;
    if (
      trusted?.repositoryId !== request.repositoryId ||
      !trusted?.workflowNames?.includes(request.target.workflowName) ||
      !trusted?.workflowPaths?.includes(request.target.workflowPath)
    ) {
      return rejected(request, 'workflow is not an exact trusted workflow');
    }
    if (
      current.headRepositoryId !== request.repositoryId ||
      current.headSha !== request.target.headSha ||
      current.workflowName !== request.target.workflowName ||
      current.workflowPath !== request.target.workflowPath
    ) {
      return rejected(request, 'live workflow identity does not match the exact trusted target');
    }
    if (current.attempt > request.target.attempt) {
      return noOp(request, 'exact workflow run has already advanced to a later attempt');
    }
    if (current.attempt !== request.target.attempt) {
      return rejected(request, 'live workflow attempt is stale');
    }
    if (current.updatedAt !== request.target.updatedAt) {
      return rejected(request, 'live workflow updatedAt is stale');
    }
    if (
      current.status !== request.expected.status ||
      current.conclusion !== request.expected.conclusion
    ) {
      return rejected(request, 'live workflow outcome does not match the diagnosed expected state');
    }
    return mutate(request);
  }

  validateCurrentIdentity(current, request.target);
  const closed = requireOpen(request, current);
  if (closed) return closed;
  if (!targetHeadMatches(request, current)) return rejected(request, 'live head SHA is stale');
  if (current.markerComment !== null) {
    if (desiredCollaborationStateSatisfied(request, liveState)) {
      return noOp(request, 'bounded comment with this exact request marker already exists');
    }
    return rejected(request, 'request marker exists with unexpected comment content');
  }
  if (current.updatedAt !== request.target.updatedAt) {
    return rejected(request, 'live target updatedAt is stale');
  }
  return mutate(request);
}

export function liveCollaborationStateDigest(liveState) {
  assert(isObject(liveState), 'live collaboration state must be an object');
  return sha256(liveState);
}

function validatePlatformObject(value) {
  exactKeys(
    value,
    ['id', 'nodeId', 'url', 'updatedAt', 'headSha', 'workflowRunId', 'workflowAttempt'],
    'receipt.platformObject'
  );
  if (value.id !== null) string(value.id, 'receipt.platformObject.id', { max: 200 });
  if (value.nodeId !== null) string(value.nodeId, 'receipt.platformObject.nodeId', { max: 200 });
  if (value.url !== null) string(value.url, 'receipt.platformObject.url', { max: 2_000 });
  if (value.updatedAt !== null) timestamp(value.updatedAt, 'receipt.platformObject.updatedAt');
  if (value.headSha !== null) sha(value.headSha, 'receipt.platformObject.headSha');
  assert(
    value.workflowRunId === null ||
      (Number.isInteger(value.workflowRunId) && value.workflowRunId > 0),
    'receipt.platformObject.workflowRunId is invalid'
  );
  assert(
    value.workflowAttempt === null ||
      (Number.isInteger(value.workflowAttempt) && value.workflowAttempt > 0),
    'receipt.platformObject.workflowAttempt is invalid'
  );
}

export function validateCollaborationReceipt(receipt, request = null) {
  exactKeys(
    receipt,
    [
      'schemaVersion',
      'kind',
      'repositoryId',
      'authorizationId',
      'action',
      'requestDigest',
      'target',
      'outcome',
      'mutationCount',
      'reconciliationCount',
      'preStateDigest',
      'postStateDigest',
      'actor',
      'platformObject',
      'verifiedAt',
      'verification',
      'note',
    ],
    'collaboration receipt'
  );
  assert(receipt.schemaVersion === 1, 'receipt.schemaVersion must be 1');
  assert(receipt.kind === 'proto-ui.collaboration-receipt', 'receipt.kind is invalid');
  assert(REPOSITORY_ID.test(receipt.repositoryId), 'receipt.repositoryId is invalid');
  string(receipt.authorizationId, 'receipt.authorizationId', { max: 200 });
  assert(COLLABORATION_ACTIONS.includes(receipt.action), 'receipt.action is invalid');
  assert(HEX64.test(receipt.requestDigest), 'receipt.requestDigest is invalid');
  assert(['applied', 'no-op'].includes(receipt.outcome), 'receipt.outcome is invalid');
  assert([0, 1].includes(receipt.mutationCount), 'receipt.mutationCount is invalid');
  assert([0, 1].includes(receipt.reconciliationCount), 'receipt.reconciliationCount is invalid');
  assert(HEX64.test(receipt.preStateDigest), 'receipt.preStateDigest is invalid');
  assert(HEX64.test(receipt.postStateDigest), 'receipt.postStateDigest is invalid');
  string(receipt.actor, 'receipt.actor', { max: 100 });
  timestamp(receipt.verifiedAt, 'receipt.verifiedAt');
  assert(
    ['live-state-matches-desired', 'idempotency-marker-present'].includes(receipt.verification),
    'receipt.verification is invalid'
  );
  string(receipt.note, 'receipt.note', { max: 2_000 });
  if (receipt.outcome === 'no-op') {
    assert(
      receipt.mutationCount === 0 && receipt.reconciliationCount === 0,
      'no-op receipt cannot record a mutation or reconciliation'
    );
    assert(receipt.platformObject === null, 'no-op receipt platformObject must be null');
  } else {
    assert(receipt.mutationCount === 1, 'applied receipt must record exactly one mutation');
    assert(isObject(receipt.platformObject), 'applied receipt requires a platformObject');
    validatePlatformObject(receipt.platformObject);
  }
  if (request !== null) {
    validateCollaborationRequest(request);
    assert(
      receipt.repositoryId === request.repositoryId,
      'receipt repository does not match request'
    );
    assert(
      receipt.authorizationId === request.authorizationId,
      'receipt authorization does not match request'
    );
    assert(receipt.action === request.action, 'receipt action does not match request');
    assert(
      receipt.requestDigest === request.requestDigest,
      'receipt digest does not match request'
    );
    assert(
      JSON.stringify(canonicalJson(receipt.target)) ===
        JSON.stringify(canonicalJson(request.target)),
      'receipt target does not match request'
    );
  }
  return receipt;
}

export function buildCollaborationReceipt({
  request,
  preState,
  postState,
  actor,
  outcome,
  mutationCount,
  reconciliationCount,
  platformObject,
  verifiedAt = new Date().toISOString(),
  verification,
  note,
}) {
  validateCollaborationRequest(request);
  const receipt = {
    schemaVersion: 1,
    kind: 'proto-ui.collaboration-receipt',
    repositoryId: request.repositoryId,
    authorizationId: request.authorizationId,
    action: request.action,
    requestDigest: request.requestDigest,
    target: structuredClone(request.target),
    outcome,
    mutationCount,
    reconciliationCount,
    preStateDigest: liveCollaborationStateDigest(preState),
    postStateDigest: liveCollaborationStateDigest(postState),
    actor,
    platformObject,
    verifiedAt,
    verification,
    note,
  };
  return validateCollaborationReceipt(receipt, request);
}
