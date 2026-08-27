const findingVerificationStatuses = new Set(['pending', 'completed', 'blocked']);
const findingVerificationClassifications = new Set([
  'pending',
  'confirmed',
  'partially-confirmed',
  'not-reproducible',
  'expected-behavior',
  'unresolved-semantic-question',
  'no-finding',
]);
const findingDispositionStatuses = new Set([
  'pending',
  'automatic-governed-remediation',
  'record-rejected',
  'record-no-finding',
  'bounded-follow-up',
]);
const decisionClasses = new Set([
  'none',
  'unresolved-product-direction',
  'privileged-or-irreversible-operation',
]);
const decisionStatuses = new Set(['not-required', 'pending', 'resolved']);
const remediationReviewStatuses = new Set([
  'not-required',
  'proposal-required',
  'implemented-pending-review',
  'completed',
  'rejected',
]);
const authorityResolutionStatuses = new Set([
  'not-required',
  'governed',
  'decision-resolved',
  'unresolved',
]);
const implementationVerificationStatuses = new Set(['not-required', 'pending', 'passed', 'failed']);
const integrationEligibilityStatuses = new Set([
  'not-required',
  'pending',
  'eligible',
  'blocked',
  'integrated',
]);
const independentReviewClassifications = new Set([
  'adequate',
  'incomplete',
  'misleading',
  'blocked',
]);
const reviewRecommendations = new Set([
  'accept-packet',
  'revise',
  'reject',
  'gather-more-evidence',
]);
const budgetClasses = new Set(['small', 'medium', 'large']);

function recordValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateEvidence(errors, value, label, { required = false } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  if (required && value.length === 0) errors.push(`${label} must not be empty`);
  for (const [index, item] of value.entries()) {
    if (!nonEmptyString(item)) errors.push(`${label}[${index}] must be a non-empty string`);
  }
}

function validateNullablePositiveNumber(errors, value, label) {
  if (value !== null && !(typeof value === 'number' && value > 0)) {
    errors.push(`${label} must be null or a positive number`);
  }
}

function validateDecisionBoundary(errors, boundary, label) {
  if (!recordValue(boundary)) {
    errors.push(`${label} must be an object`);
    return;
  }
  if (!decisionClasses.has(boundary.class)) {
    errors.push(`${label}.class is invalid: ${boundary.class}`);
  }
  if (!decisionStatuses.has(boundary.status)) {
    errors.push(`${label}.status is invalid: ${boundary.status}`);
  }
  validateEvidence(errors, boundary.evidence, `${label}.evidence`, {
    required: boundary.status === 'resolved',
  });

  if (boundary.class === 'none') {
    if (boundary.status !== 'not-required') {
      errors.push(`${label} class none requires status not-required`);
    }
    if (boundary.question !== null || boundary.resolution !== null) {
      errors.push(`${label} class none requires null question and resolution`);
    }
  } else {
    if (boundary.status === 'not-required') {
      errors.push(`${label} exceptional class requires pending or resolved status`);
    }
    if (!nonEmptyString(boundary.question)) {
      errors.push(`${label} exceptional class requires a question`);
    }
    if (boundary.status === 'pending' && boundary.resolution !== null) {
      errors.push(`${label} pending status requires a null resolution`);
    }
    if (boundary.status === 'resolved' && !nonEmptyString(boundary.resolution)) {
      errors.push(`${label} resolved status requires a resolution`);
    }
  }
}

function sameStringArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function compareField(errors, actual, expected, label) {
  if (actual !== expected) errors.push(`${label} does not match the run ledger`);
}

function compareEvidence(errors, actual, expected, label) {
  if (!sameStringArray(actual, expected)) errors.push(`${label} does not match the run ledger`);
}

function validateForwardFindingAgainstRun(errors, finding, run) {
  compareField(errors, finding.runId, run.id, 'runId');
  compareField(errors, finding.baselineCommit, run.baselineCommit, 'baselineCommit');
  for (const field of ['actorId', 'taskId']) {
    compareField(errors, finding.observer?.[field], run.observer?.[field], `observer.${field}`);
    compareField(errors, finding.verifier?.[field], run.verification?.[field], `verifier.${field}`);
  }
  compareField(errors, finding.verifier?.status, run.verification?.status, 'verifier.status');
  compareField(
    errors,
    finding.verifier?.classification,
    run.verification?.classification,
    'verifier.classification'
  );
  compareField(
    errors,
    finding.verifier?.confidence,
    run.verification?.confidence,
    'verifier.confidence'
  );
  compareField(
    errors,
    finding.findingDisposition?.status,
    run.findingDisposition?.status,
    'findingDisposition.status'
  );
  compareEvidence(
    errors,
    finding.findingDisposition?.evidence,
    run.findingDisposition?.evidence,
    'findingDisposition.evidence'
  );
  compareField(
    errors,
    finding.findingDisposition?.previouslyUnknown,
    run.outcome?.previouslyUnknown,
    'findingDisposition.previouslyUnknown'
  );
  compareField(
    errors,
    finding.findingDisposition?.actionValue,
    run.outcome?.actionValue,
    'findingDisposition.actionValue'
  );
  for (const field of ['class', 'status', 'question', 'resolution']) {
    compareField(
      errors,
      finding.decisionBoundary?.[field],
      run.decisionBoundary?.[field],
      `decisionBoundary.${field}`
    );
  }
  compareEvidence(
    errors,
    finding.decisionBoundary?.evidence,
    run.decisionBoundary?.evidence,
    'decisionBoundary.evidence'
  );

  const expectedCompletionStatuses = {
    'not-required': ['not-required'],
    'proposal-required': ['pending'],
    'implemented-pending-review': ['pending', 'in-progress', 'blocked'],
    completed: ['complete'],
    rejected: ['rejected'],
  };
  if (
    !expectedCompletionStatuses[finding.remediationReview?.status]?.includes(
      run.automatedCompletion?.status
    )
  ) {
    errors.push('remediationReview.status does not match automatedCompletion.status');
  }
  compareField(
    errors,
    finding.remediationReview?.packet,
    run.automatedCompletion?.reviewPacket,
    'remediationReview.packet'
  );
  compareField(
    errors,
    finding.remediationReview?.implementationVerification,
    run.automatedCompletion?.validationStatus,
    'remediationReview.implementationVerification'
  );
  compareField(
    errors,
    finding.remediationReview?.integrationEligibility,
    run.integration?.status,
    'remediationReview.integrationEligibility'
  );
}

export function validateForwardFindingMetadata(
  finding,
  { expectedFindingId, expectedRunId, run } = {}
) {
  const errors = [];
  if (!recordValue(finding)) return ['metadata must be an object'];
  if (finding.schemaVersion !== 2) errors.push('schemaVersion must be 2');
  if (Object.hasOwn(finding, 'humanDisposition') || Object.hasOwn(finding, 'remediation')) {
    errors.push('schemaVersion 2 must not contain legacy disposition or remediation fields');
  }
  if (!/^AM-P0-\d{3}-F\d+$/.test(finding.findingId ?? '')) {
    errors.push(`findingId is invalid: ${finding.findingId}`);
  }
  if (expectedFindingId !== undefined && finding.findingId !== expectedFindingId) {
    errors.push(`findingId must match filename (${expectedFindingId})`);
  }
  if (!/^AM-P0-\d{3}$/.test(finding.runId ?? '')) {
    errors.push(`runId is invalid: ${finding.runId}`);
  }
  if (expectedRunId !== undefined && finding.runId !== expectedRunId) {
    errors.push(`runId must match the containing run (${expectedRunId})`);
  }
  if (!/^[0-9a-f]{40}$/.test(finding.baselineCommit ?? '')) {
    errors.push('baselineCommit must be a full lowercase commit SHA');
  }
  for (const field of [
    'mission',
    'claim',
    'lifecycle',
    'expected',
    'observed',
    'reproduction',
    'likelyRootCause',
    'impact',
    'suggestedAction',
  ]) {
    if (!nonEmptyString(finding[field])) errors.push(`${field} must be a non-empty string`);
  }
  for (const field of ['scope', 'entities', 'criteria', 'commands', 'evidence']) {
    validateEvidence(errors, finding[field], field, { required: true });
  }
  validateEvidence(errors, finding.counterEvidence, 'counterEvidence');
  if (!budgetClasses.has(finding.budgetClass)) {
    errors.push(`budgetClass is invalid: ${finding.budgetClass}`);
  }
  validateNullablePositiveNumber(errors, finding.elapsedMinutes, 'elapsedMinutes');
  if (
    typeof finding.observerConfidence !== 'number' ||
    finding.observerConfidence < 0 ||
    finding.observerConfidence > 1
  ) {
    errors.push('observerConfidence must be between 0 and 1');
  }

  const verifier = finding.verifier;
  if (!recordValue(verifier)) {
    errors.push('verifier must be an object');
  } else {
    if (!findingVerificationStatuses.has(verifier.status)) {
      errors.push(`verifier.status is invalid: ${verifier.status}`);
    }
    if (!findingVerificationClassifications.has(verifier.classification)) {
      errors.push(`verifier.classification is invalid: ${verifier.classification}`);
    }
    validateEvidence(errors, verifier.evidence, 'verifier.evidence', {
      required: verifier.status !== 'pending',
    });
    if (verifier.status === 'pending') {
      if (verifier.classification !== 'pending') {
        errors.push('pending verifier requires classification pending');
      }
      if (verifier.confidence !== null) {
        errors.push('pending verifier requires null confidence');
      }
    } else {
      if (verifier.classification === 'pending') {
        errors.push('resolved verifier cannot retain classification pending');
      }
      if (
        typeof verifier.confidence !== 'number' ||
        verifier.confidence < 0 ||
        verifier.confidence > 1
      ) {
        errors.push('resolved verifier confidence must be between 0 and 1');
      }
    }
  }
  errors.push(...validateObserverVerifierIndependence(finding.observer, verifier));

  const disposition = finding.findingDisposition;
  if (!recordValue(disposition)) {
    errors.push('findingDisposition must be an object');
  } else {
    if (!findingDispositionStatuses.has(disposition.status)) {
      errors.push(`findingDisposition.status is invalid: ${disposition.status}`);
    }
    validateEvidence(errors, disposition.evidence, 'findingDisposition.evidence', {
      required: disposition.status !== 'pending',
    });
    if (disposition.status === 'pending') {
      for (const field of ['factScore', 'previouslyUnknown', 'hasExternalOracle', 'actionValue']) {
        if (disposition[field] !== null) {
          errors.push(`pending findingDisposition requires null ${field}`);
        }
      }
    } else {
      if (![0, 1, 2].includes(disposition.factScore)) {
        errors.push('findingDisposition.factScore must be 0, 1, or 2');
      }
      if (typeof disposition.previouslyUnknown !== 'boolean') {
        errors.push('findingDisposition.previouslyUnknown must be boolean');
      }
      if (typeof disposition.hasExternalOracle !== 'boolean') {
        errors.push('findingDisposition.hasExternalOracle must be boolean');
      }
      if (![0, 1, 2].includes(disposition.actionValue)) {
        errors.push('findingDisposition.actionValue must be 0, 1, or 2');
      }
      if (!nonEmptyString(disposition.notes)) {
        errors.push('resolved findingDisposition requires notes');
      }
    }
    validateNullablePositiveNumber(
      errors,
      disposition.reviewMinutes,
      'findingDisposition.reviewMinutes'
    );

    if (disposition.status === 'automatic-governed-remediation') {
      if (
        verifier?.status !== 'completed' ||
        !['confirmed', 'partially-confirmed'].includes(verifier?.classification)
      ) {
        errors.push('automatic governed remediation requires a completed confirmed verifier');
      }
      if (disposition.factScore < 1 || disposition.actionValue !== 2) {
        errors.push('automatic governed remediation requires a supported fact and actionValue 2');
      }
      if (disposition.hasExternalOracle !== true) {
        errors.push('automatic governed remediation requires an external oracle');
      }
    }
    if (disposition.status === 'record-rejected' && disposition.actionValue !== 0) {
      errors.push('record-rejected requires actionValue 0');
    }
    if (disposition.status === 'record-rejected' && verifier?.status !== 'completed') {
      errors.push('record-rejected requires completed verification');
    }
    if (disposition.status === 'record-no-finding') {
      if (verifier?.status !== 'completed' || verifier?.classification !== 'no-finding') {
        errors.push('record-no-finding requires completed verifier classification no-finding');
      }
      if (disposition.factScore !== 0 || disposition.actionValue !== 0) {
        errors.push('record-no-finding requires factScore 0 and actionValue 0');
      }
    }
    if (disposition.status === 'bounded-follow-up' && disposition.actionValue !== 1) {
      errors.push('bounded-follow-up requires actionValue 1');
    }
    if (
      disposition.status === 'bounded-follow-up' &&
      !['completed', 'blocked'].includes(verifier?.status)
    ) {
      errors.push('bounded-follow-up requires completed or blocked verification');
    }
    if (disposition.status !== 'pending' && verifier?.status === 'pending') {
      errors.push('a resolved findingDisposition requires a resolved verifier');
    }
  }

  validateDecisionBoundary(errors, finding.decisionBoundary, 'decisionBoundary');

  const remediation = finding.remediationReview;
  if (!recordValue(remediation)) {
    errors.push('remediationReview must be an object');
  } else {
    if (!remediationReviewStatuses.has(remediation.status)) {
      errors.push(`remediationReview.status is invalid: ${remediation.status}`);
    }
    if (!authorityResolutionStatuses.has(remediation.authorityResolution)) {
      errors.push(
        `remediationReview.authorityResolution is invalid: ${remediation.authorityResolution}`
      );
    }
    if (!implementationVerificationStatuses.has(remediation.implementationVerification)) {
      errors.push(
        `remediationReview.implementationVerification is invalid: ${remediation.implementationVerification}`
      );
    }
    if (!integrationEligibilityStatuses.has(remediation.integrationEligibility)) {
      errors.push(
        `remediationReview.integrationEligibility is invalid: ${remediation.integrationEligibility}`
      );
    }
    validateNullablePositiveNumber(
      errors,
      remediation.reviewMinutes,
      'remediationReview.reviewMinutes'
    );

    if (remediation.status === 'not-required') {
      if (remediation.packet !== null) {
        errors.push('remediationReview not-required requires a null packet');
      }
      if (
        remediation.authorityResolution !== 'not-required' ||
        remediation.implementationVerification !== 'not-required' ||
        remediation.integrationEligibility !== 'not-required'
      ) {
        errors.push('remediationReview not-required requires all downstream states not-required');
      }
    } else if (!nonEmptyString(remediation.packet)) {
      errors.push('a routed remediationReview requires a packet path');
    }

    if (
      ['proposal-required', 'implemented-pending-review', 'completed'].includes(
        remediation.status
      ) &&
      disposition?.status !== 'automatic-governed-remediation'
    ) {
      errors.push('active remediation requires automatic-governed-remediation disposition');
    }
    if (remediation.status === 'proposal-required') {
      if (remediation.implementationVerification !== 'pending') {
        errors.push('proposal-required remediation requires pending implementation verification');
      }
      if (!['pending', 'blocked'].includes(remediation.integrationEligibility)) {
        errors.push('proposal-required remediation cannot claim integration eligibility');
      }
    }
    if (remediation.status === 'implemented-pending-review') {
      if (!['pending', 'passed', 'failed'].includes(remediation.implementationVerification)) {
        errors.push('implemented-pending-review has an invalid implementation verification state');
      }
      if (!['pending', 'blocked'].includes(remediation.integrationEligibility)) {
        errors.push('implemented-pending-review cannot claim integration eligibility');
      }
    }
    if (remediation.status === 'completed') {
      if (!['governed', 'decision-resolved'].includes(remediation.authorityResolution)) {
        errors.push('completed remediation requires resolved authority');
      }
      if (remediation.implementationVerification !== 'passed') {
        errors.push('completed remediation requires passed implementation verification');
      }
    }
    if (remediation.status === 'rejected') {
      if (!['failed', 'not-required'].includes(remediation.implementationVerification)) {
        errors.push('rejected remediation requires failed or not-required verification');
      }
      if (!['blocked', 'not-required'].includes(remediation.integrationEligibility)) {
        errors.push('rejected remediation cannot claim integration eligibility');
      }
    }

    if (remediation.authorityResolution === 'unresolved') {
      if (
        finding.decisionBoundary?.class !== 'unresolved-product-direction' ||
        finding.decisionBoundary?.status !== 'pending'
      ) {
        errors.push(
          'unresolved authority requires a pending unresolved-product-direction decision'
        );
      }
      if (remediation.status === 'completed') {
        errors.push('unresolved authority cannot claim completed remediation');
      }
    }
    if (
      remediation.authorityResolution === 'decision-resolved' &&
      (finding.decisionBoundary?.class !== 'unresolved-product-direction' ||
        finding.decisionBoundary?.status !== 'resolved')
    ) {
      errors.push('decision-resolved authority requires a resolved product-direction decision');
    }
    if (
      remediation.authorityResolution === 'governed' &&
      finding.decisionBoundary?.class === 'unresolved-product-direction'
    ) {
      errors.push('governed authority cannot coexist with a product-direction decision boundary');
    }
    if (
      ['eligible', 'integrated'].includes(remediation.integrationEligibility) &&
      (remediation.status !== 'completed' ||
        remediation.implementationVerification !== 'passed' ||
        finding.decisionBoundary?.status === 'pending')
    ) {
      errors.push(
        'integration eligibility requires completed remediation, passed verification, and no pending decision'
      );
    }
  }

  if (
    finding.decisionBoundary?.class === 'unresolved-product-direction' &&
    finding.decisionBoundary?.status === 'pending' &&
    disposition?.status === 'automatic-governed-remediation'
  ) {
    errors.push('automatic governed remediation cannot bypass unresolved product direction');
  }

  if (run) validateForwardFindingAgainstRun(errors, finding, run);
  return errors;
}

function validateIdentity(errors, value, label) {
  if (!recordValue(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  let valid = true;
  for (const field of ['actorId', 'taskId']) {
    if (!nonEmptyString(value[field])) {
      errors.push(`${label}.${field} must be a non-empty string`);
      valid = false;
    }
  }
  return valid;
}

function sameIdentity(left, right) {
  return left?.actorId === right?.actorId && left?.taskId === right?.taskId;
}

function validateIndependentIdentity(errors, remediator, reviewer, label) {
  if (!recordValue(remediator) || !recordValue(reviewer)) return;
  if (remediator.actorId === reviewer.actorId) {
    errors.push(`${label}.actorId must differ from remediationAuthor.actorId`);
  }
  if (remediator.taskId === reviewer.taskId) {
    errors.push(`${label}.taskId must differ from remediationAuthor.taskId`);
  }
}

export function validateObserverVerifierIndependence(observer, verifier) {
  const errors = [];
  const observerValid = validateIdentity(errors, observer, 'observer');
  const verifierValid = validateIdentity(errors, verifier, 'verifier');
  if (!observerValid || !verifierValid) return errors;

  if (observer.actorId === verifier.actorId) {
    errors.push('verifier.actorId must differ from observer.actorId');
  }
  if (observer.taskId === verifier.taskId) {
    errors.push('verifier.taskId must differ from observer.taskId');
  }
  return errors;
}

export function validateForwardReviewIndependence(metadata) {
  const errors = [];
  const authorValid = validateIdentity(errors, metadata.remediationAuthor, 'remediationAuthor');
  const review = metadata.independentReview;
  if (!recordValue(review)) return [...errors, 'independentReview must be an object'];

  if (!Object.hasOwn(review, 'reviewer')) {
    errors.push('independentReview.reviewer is required');
  }
  if (!Object.hasOwn(review, 'history')) {
    errors.push('independentReview.history is required');
  }
  if (!Array.isArray(review.history)) {
    errors.push('independentReview.history must be an array');
    return errors;
  }

  if (review.status === 'pending') {
    if (review.reviewer !== null) {
      errors.push('pending independentReview requires a null reviewer');
    }
    if (review.reviewedContentDigest !== null) {
      errors.push('pending independentReview requires a null reviewedContentDigest');
    }
    if (review.history.length !== 0) {
      errors.push('pending independentReview requires empty history');
    }
    return errors;
  }

  const reviewerValid = validateIdentity(errors, review.reviewer, 'independentReview.reviewer');
  if (review.history.length === 0) {
    errors.push('resolved independentReview requires non-empty history');
    return errors;
  }
  if (!nonEmptyString(review.decision)) {
    errors.push('resolved independentReview requires a decision');
  }
  if (
    metadata.stage !== 'proposal' &&
    !/^sha256:[0-9a-f]{64}$/.test(review.reviewedContentDigest ?? '')
  ) {
    errors.push('resolved post-implementation independentReview requires reviewedContentDigest');
  }
  if (authorValid && reviewerValid) {
    validateIndependentIdentity(
      errors,
      metadata.remediationAuthor,
      review.reviewer,
      'independentReview.reviewer'
    );
  }

  let previousRound = 0;
  for (const [index, entry] of review.history.entries()) {
    const label = `independentReview.history[${index}]`;
    if (!recordValue(entry)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    if (!Number.isInteger(entry.round) || entry.round <= previousRound) {
      errors.push(`${label}.round must be a positive, strictly increasing integer`);
    } else {
      previousRound = entry.round;
    }
    if (!independentReviewClassifications.has(entry.classification)) {
      errors.push(`${label}.classification is invalid: ${entry.classification}`);
    }
    if (typeof entry.confidence !== 'number' || entry.confidence < 0 || entry.confidence > 1) {
      errors.push(`${label}.confidence must be between 0 and 1`);
    }
    if (!reviewRecommendations.has(entry.recommendedAction)) {
      errors.push(`${label}.recommendedAction is invalid: ${entry.recommendedAction}`);
    }
    if (!nonEmptyString(entry.summary)) {
      errors.push(`${label}.summary must be a non-empty string`);
    }
    if (
      metadata.stage !== 'proposal' &&
      !/^sha256:[0-9a-f]{64}$/.test(entry.reviewedContentDigest ?? '')
    ) {
      errors.push(`${label}.reviewedContentDigest must be sha256:<64 lowercase hex>`);
    }
    const historyReviewerValid = validateIdentity(errors, entry.reviewer, `${label}.reviewer`);
    if (authorValid && historyReviewerValid) {
      validateIndependentIdentity(
        errors,
        metadata.remediationAuthor,
        entry.reviewer,
        `${label}.reviewer`
      );
    }
  }

  const latest = review.history.at(-1);
  if (latest?.classification !== review.status) {
    errors.push('independentReview.status must match the last history classification');
  }
  if (reviewerValid && !sameIdentity(review.reviewer, latest?.reviewer)) {
    errors.push('independentReview.reviewer must match the last history reviewer');
  }
  if (review.reviewedContentDigest !== latest?.reviewedContentDigest) {
    errors.push('independentReview.reviewedContentDigest must match the last history review');
  }
  if (
    review.status === 'adequate' &&
    review.reviewedContentDigest !== metadata.changeInventory?.reviewedContentDigest
  ) {
    errors.push(
      'adequate independentReview must bind the current changeInventory.reviewedContentDigest'
    );
  }
  if (metadata.reviewStatus === 'ready-for-independent-review' && review.status !== 'pending') {
    errors.push('ready-for-independent-review requires pending independentReview status');
  }
  if (
    metadata.reviewStatus === 'revision-required' &&
    !['incomplete', 'misleading', 'blocked'].includes(review.status)
  ) {
    errors.push('revision-required must reflect an incomplete, misleading, or blocked review');
  }
  if (metadata.reviewStatus === 'completed' && review.status !== 'adequate') {
    errors.push('completed reviewStatus requires adequate independentReview status');
  }

  return errors;
}
