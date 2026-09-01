import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';
import {
  validateForwardFindingMetadata,
  validateForwardReviewIndependence,
  validateObserverVerifierIndependence,
} from './evidence-state.mjs';
import { computeReviewedContentDigest } from './reviewed-content-digest.mjs';

const root = process.cwd();
const phaseDirectory = path.join(root, 'internal/autonomous-maintenance/phase-0');
const ledgerFile = path.join(phaseDirectory, 'runs.yaml');
const queueFile = path.join(phaseDirectory, 'mission-queue.yaml');
const errors = [];

const allowedBudgetClasses = new Set(['small', 'medium', 'large']);
const allowedObserverStatuses = new Set(['planned', 'running', 'completed', 'blocked']);
const allowedVerificationStatuses = new Set(['not-required', 'pending', 'completed', 'blocked']);
const allowedClassifications = new Set([
  'confirmed',
  'partially-confirmed',
  'not-reproducible',
  'expected-behavior',
  'unresolved-semantic-question',
  'no-finding',
]);
const allowedDecisionStatuses = new Set([
  'pending',
  'accepted',
  'accepted-with-corrected-scope',
  'rejected',
  'not-required',
]);
const allowedRemediationStatuses = new Set([
  'not-required',
  'pending',
  'in-progress',
  'completed',
  'blocked',
  'rejected',
]);
const allowedCompletionRules = new Set([
  'retrospective-before-review-packet-gate',
  'adequate-independent-review-and-required-validation',
  'not-required',
]);
const allowedMissionClasses = new Set(['discovery', 'control', 'targeted-follow-up']);
const allowedMissionStatuses = new Set(['candidate', 'ready', 'running', 'completed', 'blocked']);
const allowedMissionBands = new Set(['C1', 'C2', 'C3', 'C4']);
const allowedMissionRisks = new Set(['low', 'medium', 'high']);
const allowedMissionDecisionClasses = new Set([
  'unresolved-product-direction',
  'privileged-or-irreversible-operation',
]);
const allowedForwardDispositionStatuses = new Set([
  'automatic-governed-remediation',
  'record-rejected',
  'record-no-finding',
  'bounded-follow-up',
]);
const allowedForwardDecisionClasses = new Set([
  'none',
  'unresolved-product-direction',
  'privileged-or-irreversible-operation',
]);
const allowedForwardDecisionStatuses = new Set(['not-required', 'pending', 'resolved']);
const allowedForwardCompletionStatuses = new Set([
  'not-required',
  'pending',
  'in-progress',
  'complete',
  'blocked',
  'rejected',
]);
const allowedForwardIntegrationStatuses = new Set([
  'not-required',
  'pending',
  'eligible',
  'blocked',
  'integrated',
]);

function fail(file, message) {
  errors.push(`${path.relative(root, file)}: ${message}`);
}

function readYaml(file) {
  if (!fs.existsSync(file)) {
    fail(file, 'file does not exist');
    return null;
  }
  try {
    return YAML.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(file, `invalid YAML: ${error.message}`);
    return null;
  }
}

function resolveRepositoryPath(file, value, label, options = {}) {
  const { nullable = false } = options;
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || value.length === 0) {
    fail(file, `${label} must be a non-empty repository-relative path`);
    return null;
  }
  if (path.isAbsolute(value) || value.split('/').includes('..')) {
    fail(file, `${label} must stay within the repository: ${value}`);
    return null;
  }
  const resolved = path.resolve(root, value);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    fail(file, `${label} escapes the repository: ${value}`);
    return null;
  }
  if (!fs.existsSync(resolved)) {
    fail(file, `${label} does not exist: ${value}`);
    return null;
  }
  return resolved;
}

function commitExists(file, value, label) {
  if (!/^[0-9a-f]{40}$/.test(value ?? '')) {
    fail(file, `${label} must be a full lowercase commit SHA`);
    return false;
  }
  try {
    execFileSync('git', ['cat-file', '-e', `${value}^{commit}`], {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch {
    fail(file, `${label} is not a local commit: ${value}`);
    return false;
  }
}

function repositoryPath(value) {
  return value.split(path.sep).join('/');
}

function committedChangedPaths(baseline, head) {
  return execFileSync('git', ['diff', '--name-only', '--no-renames', baseline, head, '--'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();
}

function validateExactInventoryPaths(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(ledgerFile, `${label} must be a non-empty array`);
    return [];
  }

  const paths = [];
  const seen = new Set();
  for (const [index, entry] of value.entries()) {
    if (
      !nonEmptyString(entry) ||
      path.isAbsolute(entry) ||
      entry.includes('\\') ||
      entry.split('/').includes('..')
    ) {
      fail(ledgerFile, `${label}[${index}] must be a normalized repository-relative path`);
      continue;
    }
    if (seen.has(entry)) {
      fail(ledgerFile, `${label} duplicates ${entry}`);
      continue;
    }
    seen.add(entry);
    paths.push(entry);
  }
  return paths.sort();
}

function validateExactIntegrationBinding(run, label, reviewFile, currentReview) {
  const baseline = run.baselineCommit;
  const head = run.integration.exactHeadSha;
  if (head === baseline) {
    fail(ledgerFile, `${label}.integration.exactHeadSha must differ from baselineCommit`);
    return;
  }

  try {
    execFileSync('git', ['merge-base', '--is-ancestor', baseline, head], {
      cwd: root,
      stdio: 'ignore',
    });
  } catch {
    fail(ledgerFile, `${label}.integration.exactHeadSha must descend from baselineCommit`);
    return;
  }

  if (!reviewFile) {
    fail(ledgerFile, `${label}.integration exact-head binding requires a review packet`);
    return;
  }
  const reviewPath = repositoryPath(path.relative(root, reviewFile));
  let committedPacket;
  try {
    committedPacket = execFileSync('git', ['show', `${head}:${reviewPath}`], {
      cwd: root,
      encoding: 'utf8',
    });
  } catch {
    fail(ledgerFile, `${label}.integration.exactHeadSha does not contain ${reviewPath}`);
    return;
  }

  const committedReview = parseMetadataBlock(committedPacket);
  if (!committedReview) {
    fail(
      ledgerFile,
      `${label}.integration exact-head review packet has no valid schema-v2 metadata`
    );
    return;
  }
  if (
    committedReview.schemaVersion !== 2 ||
    committedReview.runId !== run.id ||
    committedReview.baselineCommit !== baseline ||
    committedReview.reviewStatus !== 'completed' ||
    committedReview.automatedCompletion?.status !== 'complete' ||
    committedReview.automatedCompletion?.validationStatus !== 'passed' ||
    committedReview.independentReview?.status !== 'adequate'
  ) {
    fail(
      ledgerFile,
      `${label}.integration.exactHeadSha must contain the completed independently reviewed packet for ${run.id}`
    );
  }
  for (const message of validateForwardReviewIndependence(committedReview)) {
    fail(ledgerFile, `${label}.integration exact-head packet: ${message}`);
  }

  const expectedPaths = validateExactInventoryPaths(
    committedReview.changeInventory?.exactPaths,
    `${label}.integration exact-head packet changeInventory.exactPaths`
  );
  if (!expectedPaths.includes(reviewPath)) {
    fail(
      ledgerFile,
      `${label}.integration exact-head inventory must include its independent review packet: ${reviewPath}`
    );
  }
  const reviewedPaths = expectedPaths.filter((entry) => entry !== reviewPath);
  if (reviewedPaths.length === 0) {
    fail(
      ledgerFile,
      `${label}.integration exact-head inventory must include reviewed remediation content outside the packet`
    );
  }
  const expectedDigest = committedReview.changeInventory?.reviewedContentDigest;
  if (!/^sha256:[0-9a-f]{64}$/.test(expectedDigest ?? '')) {
    fail(
      ledgerFile,
      `${label}.integration exact-head packet changeInventory.reviewedContentDigest is invalid`
    );
  }
  const currentExactPaths = currentReview?.changeInventory?.exactPaths;
  if (
    currentReview &&
    (!Array.isArray(currentExactPaths) ||
      JSON.stringify([...currentExactPaths].sort()) !== JSON.stringify(expectedPaths) ||
      currentReview.changeInventory?.reviewedContentDigest !== expectedDigest)
  ) {
    fail(
      ledgerFile,
      `${label}.integration exact-head inventory differs from the current ledger-linked packet`
    );
  }

  let actualPaths = [];
  try {
    actualPaths = committedChangedPaths(baseline, head);
  } catch (error) {
    fail(
      ledgerFile,
      `${label}.integration exact-head inventory could not be read: ${error.message}`
    );
    return;
  }
  const missing = expectedPaths.filter((entry) => !actualPaths.includes(entry));
  const undeclared = actualPaths.filter((entry) => !expectedPaths.includes(entry));
  if (missing.length > 0 || undeclared.length > 0) {
    fail(
      ledgerFile,
      `${label}.integration.exactHeadSha changed inventory does not match the independent packet` +
        ` (missing: ${missing.join(', ') || 'none'}; undeclared: ${undeclared.join(', ') || 'none'})`
    );
  }
  if (reviewedPaths.length > 0 && /^sha256:[0-9a-f]{64}$/.test(expectedDigest ?? '')) {
    let actualDigest;
    try {
      actualDigest = computeReviewedContentDigest({
        root,
        baseline,
        head,
        exactPaths: expectedPaths,
        reviewPath,
      });
    } catch (error) {
      fail(
        ledgerFile,
        `${label}.integration reviewed-content digest could not be computed: ${error.message}`
      );
      return;
    }
    if (actualDigest !== expectedDigest) {
      fail(
        ledgerFile,
        `${label}.integration.exactHeadSha reviewed-content digest does not match the independent packet`
      );
    }
  }
}

function nullableNonNegativeInteger(value) {
  return value === null || (Number.isInteger(value) && value >= 0);
}

function nullablePositiveNumber(value) {
  return value === null || (typeof value === 'number' && value > 0);
}

function validateDecision(file, decision, label) {
  if (!allowedDecisionStatuses.has(decision?.status)) {
    fail(file, `${label}.status is invalid: ${decision?.status}`);
  }
  if (!nullablePositiveNumber(decision?.reviewMinutes)) {
    fail(file, `${label}.reviewMinutes must be null or a positive number`);
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function validateStringEvidence(file, value, label, { required = false } = {}) {
  if (!Array.isArray(value)) {
    fail(file, `${label} must be an array`);
    return;
  }
  if (required && value.length === 0) fail(file, `${label} must not be empty`);
  for (const [index, item] of value.entries()) {
    if (!nonEmptyString(item)) fail(file, `${label}[${index}] must be a non-empty string`);
  }
}

function validateForwardRunState(run, label) {
  if (Object.hasOwn(run, 'humanDecisions')) {
    fail(ledgerFile, `${label} schemaVersion 2 must not contain legacy humanDecisions`);
  }

  for (const message of validateObserverVerifierIndependence(run.observer, run.verification)) {
    fail(ledgerFile, `${label}.${message}`);
  }

  const disposition = run.findingDisposition;
  if (!allowedForwardDispositionStatuses.has(disposition?.status)) {
    fail(ledgerFile, `${label}.findingDisposition.status is invalid: ${disposition?.status}`);
  }
  validateStringEvidence(
    ledgerFile,
    disposition?.evidence,
    `${label}.findingDisposition.evidence`,
    { required: true }
  );
  if (disposition?.status === 'automatic-governed-remediation') {
    if (
      run.verification?.status !== 'completed' ||
      !['confirmed', 'partially-confirmed'].includes(run.verification?.classification)
    ) {
      fail(
        ledgerFile,
        `${label}.findingDisposition automatic remediation requires completed confirmed verification`
      );
    }
    if (run.outcome?.actionValue !== 2) {
      fail(ledgerFile, `${label}.findingDisposition automatic remediation requires actionValue 2`);
    }
  }
  if (disposition?.status === 'record-no-finding') {
    if (
      run.verification?.status !== 'completed' ||
      run.verification?.classification !== 'no-finding'
    ) {
      fail(
        ledgerFile,
        `${label}.findingDisposition record-no-finding requires completed no-finding verification`
      );
    }
    if (run.outcome?.actionValue !== 0) {
      fail(ledgerFile, `${label}.findingDisposition record-no-finding requires actionValue 0`);
    }
  }
  if (disposition?.status === 'record-rejected' && run.outcome?.actionValue !== 0) {
    fail(ledgerFile, `${label}.findingDisposition record-rejected requires actionValue 0`);
  }
  if (disposition?.status === 'record-rejected' && run.verification?.status !== 'completed') {
    fail(ledgerFile, `${label}.findingDisposition record-rejected requires completed verification`);
  }
  if (disposition?.status === 'bounded-follow-up' && run.outcome?.actionValue !== 1) {
    fail(ledgerFile, `${label}.findingDisposition bounded-follow-up requires actionValue 1`);
  }
  if (
    disposition?.status === 'bounded-follow-up' &&
    !['completed', 'blocked'].includes(run.verification?.status)
  ) {
    fail(
      ledgerFile,
      `${label}.findingDisposition bounded-follow-up requires completed or blocked verification`
    );
  }

  const boundary = run.decisionBoundary;
  if (!allowedForwardDecisionClasses.has(boundary?.class)) {
    fail(ledgerFile, `${label}.decisionBoundary.class is invalid: ${boundary?.class}`);
  }
  if (!allowedForwardDecisionStatuses.has(boundary?.status)) {
    fail(ledgerFile, `${label}.decisionBoundary.status is invalid: ${boundary?.status}`);
  }
  validateStringEvidence(ledgerFile, boundary?.evidence, `${label}.decisionBoundary.evidence`, {
    required: boundary?.status === 'resolved',
  });
  if (boundary?.class === 'none' && boundary?.status !== 'not-required') {
    fail(ledgerFile, `${label}.decisionBoundary class none requires status not-required`);
  }
  if (
    boundary?.class === 'none' &&
    (boundary?.question !== null || boundary?.resolution !== null)
  ) {
    fail(ledgerFile, `${label}.decisionBoundary class none requires null question and resolution`);
  }
  if (boundary?.class !== 'none' && boundary?.status === 'not-required') {
    fail(ledgerFile, `${label}.decisionBoundary exceptional class requires pending or resolved`);
  }
  if (boundary?.class !== 'none' && !nonEmptyString(boundary?.question)) {
    fail(ledgerFile, `${label}.decisionBoundary exceptional class requires a question`);
  }
  if (boundary?.status === 'resolved' && !nonEmptyString(boundary?.resolution)) {
    fail(ledgerFile, `${label}.decisionBoundary resolved status requires a resolution`);
  }
  if (boundary?.status === 'pending' && boundary?.resolution !== null) {
    fail(ledgerFile, `${label}.decisionBoundary pending status requires a null resolution`);
  }
  if (
    disposition?.status === 'automatic-governed-remediation' &&
    boundary?.class === 'unresolved-product-direction' &&
    boundary?.status === 'pending'
  ) {
    fail(
      ledgerFile,
      `${label}.findingDisposition cannot bypass pending unresolved product direction`
    );
  }

  const completion = run.automatedCompletion;
  if (!allowedForwardCompletionStatuses.has(completion?.status)) {
    fail(ledgerFile, `${label}.automatedCompletion.status is invalid: ${completion?.status}`);
  }
  if (!allowedCompletionRules.has(completion?.completionRule)) {
    fail(
      ledgerFile,
      `${label}.automatedCompletion.completionRule is invalid: ${completion?.completionRule}`
    );
  }
  if (!['pending', 'passed', 'failed', 'not-required'].includes(completion?.validationStatus)) {
    fail(ledgerFile, `${label}.automatedCompletion.validationStatus is invalid`);
  }
  if (
    completion?.completedOn !== null &&
    !/^\d{4}-\d{2}-\d{2}$/.test(completion?.completedOn ?? '')
  ) {
    fail(ledgerFile, `${label}.automatedCompletion.completedOn must be null or YYYY-MM-DD`);
  }
  const reviewFile = resolveRepositoryPath(
    ledgerFile,
    completion?.reviewPacket,
    `${label}.automatedCompletion.reviewPacket`,
    { nullable: true }
  );
  let reviewMetadata = null;
  if (completion?.status === 'not-required') {
    if (
      completion.completionRule !== 'not-required' ||
      completion.validationStatus !== 'not-required' ||
      completion.completedOn !== null ||
      completion.reviewPacket !== null
    ) {
      fail(
        ledgerFile,
        `${label}.automatedCompletion not-required requires all completion evidence not-required`
      );
    }
    if (disposition?.status === 'automatic-governed-remediation') {
      fail(
        ledgerFile,
        `${label}.automatedCompletion cannot be not-required for automatic remediation`
      );
    }
  } else {
    if (completion?.completionRule !== 'adequate-independent-review-and-required-validation') {
      fail(
        ledgerFile,
        `${label}.automatedCompletion schemaVersion 2 active state requires independent-review completion rule`
      );
    }
    if (completion?.validationStatus === 'not-required') {
      fail(ledgerFile, `${label}.automatedCompletion active state requires validation state`);
    }
    if (disposition?.status !== 'automatic-governed-remediation') {
      fail(
        ledgerFile,
        `${label}.automatedCompletion active state requires automatic governed remediation`
      );
    }
  }
  if (completion?.status === 'complete') {
    if (completion.validationStatus !== 'passed') {
      fail(ledgerFile, `${label} automated completion requires passed validation`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(completion.completedOn ?? '')) {
      fail(ledgerFile, `${label} automated completion requires completedOn`);
    }
    if (completion.completionRule === 'adequate-independent-review-and-required-validation') {
      if (!reviewFile) {
        fail(ledgerFile, `${label} automated completion requires a review packet`);
      } else {
        const review = readMetadataBlock(reviewFile);
        reviewMetadata = review;
        if (
          review?.schemaVersion !== 2 ||
          review?.runId !== run.id ||
          review?.reviewStatus !== 'completed'
        ) {
          fail(
            ledgerFile,
            `${label}.automatedCompletion.reviewPacket is not completed for ${run.id}`
          );
        }
        if (review?.independentReview?.status !== 'adequate') {
          fail(ledgerFile, `${label}.automatedCompletion.reviewPacket lacks adequate review`);
        }
      }
    }
    if (boundary?.class === 'unresolved-product-direction' && boundary?.status !== 'resolved') {
      fail(
        ledgerFile,
        `${label}.automatedCompletion cannot complete with unresolved product direction`
      );
    }
  } else if (completion?.completedOn !== null) {
    fail(ledgerFile, `${label}.automatedCompletion incomplete state requires null completedOn`);
  }

  const integration = run.integration;
  if (!allowedForwardIntegrationStatuses.has(integration?.status)) {
    fail(ledgerFile, `${label}.integration.status is invalid: ${integration?.status}`);
  }
  validateStringEvidence(ledgerFile, integration?.evidence, `${label}.integration.evidence`, {
    required: ['eligible', 'blocked', 'integrated'].includes(integration?.status),
  });
  if (
    disposition?.status !== 'automatic-governed-remediation' &&
    integration?.status !== 'not-required'
  ) {
    fail(
      ledgerFile,
      `${label}.integration must be not-required without automatic governed remediation`
    );
  }
  if (
    disposition?.status === 'automatic-governed-remediation' &&
    integration?.status === 'not-required'
  ) {
    fail(ledgerFile, `${label}.integration requires an explicit pending or terminal state`);
  }
  if (['eligible', 'integrated'].includes(integration?.status)) {
    if (boundary?.status === 'pending') {
      fail(ledgerFile, `${label}.integration cannot proceed with a pending attended decision`);
    }
    if (completion?.status !== 'complete') {
      fail(ledgerFile, `${label}.integration requires automatedCompletion.status complete`);
    }
    if (commitExists(ledgerFile, integration?.exactHeadSha, `${label}.integration.exactHeadSha`)) {
      validateExactIntegrationBinding(run, label, reviewFile, reviewMetadata);
    }
  } else if (integration?.exactHeadSha !== null) {
    fail(ledgerFile, `${label}.integration.exactHeadSha must be null before eligibility`);
  }

  const receipt = integration?.receipt;
  if (integration?.status === 'integrated') {
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
      fail(ledgerFile, `${label}.integration.receipt is required after integration`);
    } else {
      if (receipt.repositoryId !== 'github.com:Proto-UI/Proto-UI') {
        fail(ledgerFile, `${label}.integration.receipt.repositoryId is invalid`);
      }
      if (!Number.isInteger(receipt.pullRequest) || receipt.pullRequest <= 0) {
        fail(ledgerFile, `${label}.integration.receipt.pullRequest must be a positive integer`);
      }
      if (receipt.headSha !== integration.exactHeadSha) {
        fail(ledgerFile, `${label}.integration.receipt.headSha must match exactHeadSha`);
      }
      commitExists(
        ledgerFile,
        receipt.mergeCommitSha,
        `${label}.integration.receipt.mergeCommitSha`
      );
      if (!['merge', 'squash', 'rebase'].includes(receipt.mergeMethod)) {
        fail(ledgerFile, `${label}.integration.receipt.mergeMethod is invalid`);
      }
      if (!Number.isFinite(Date.parse(receipt.mergedAt ?? ''))) {
        fail(ledgerFile, `${label}.integration.receipt.mergedAt must be an RFC 3339 timestamp`);
      }
    }
  } else if (receipt !== null) {
    fail(ledgerFile, `${label}.integration.receipt must be null before integration`);
  }
}

function parseMetadataBlock(content) {
  const match = content.match(/<!-- prettier-ignore -->\s*```yaml\r?\n([\s\S]*?)\r?\n```/);
  if (!match) return null;
  try {
    return YAML.parse(match[1]);
  } catch {
    return null;
  }
}

function readMetadataBlock(file) {
  return parseMetadataBlock(fs.readFileSync(file, 'utf8'));
}

function readFindingMetadataBlock(file) {
  const content = fs.readFileSync(file, 'utf8');
  const match = content.match(/(?:<!-- prettier-ignore -->\s*)?```yaml\r?\n([\s\S]*?)\r?\n```/);
  if (!match) {
    fail(file, 'missing YAML finding metadata block');
    return null;
  }
  try {
    const metadata = YAML.parse(match[1]);
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      fail(file, 'finding metadata must be an object');
      return null;
    }
    return metadata;
  } catch (error) {
    fail(file, `invalid finding YAML metadata: ${error.message}`);
    return null;
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

function validateForwardFindingPacket(findingFile, findingPath, finding, run, label) {
  const packetPath = finding.remediationReview?.packet;
  if (packetPath === null || packetPath === undefined) return;
  const reviewFile = resolveRepositoryPath(
    findingFile,
    packetPath,
    `${label}.remediationReview.packet`
  );
  if (!reviewFile) return;
  const review = readMetadataBlock(reviewFile);
  if (!review) {
    fail(findingFile, `${label}.remediationReview.packet has no valid review metadata`);
    return;
  }

  if (review.schemaVersion !== 2) {
    fail(findingFile, `${label}.remediationReview.packet must use schemaVersion 2`);
  }
  if (review.findingId !== finding.findingId) {
    fail(findingFile, `${label}.remediationReview.packet findingId does not match`);
  }
  if (review.findingPath !== findingPath) {
    fail(findingFile, `${label}.remediationReview.packet findingPath does not match`);
  }
  if (review.runId !== run.id) {
    fail(findingFile, `${label}.remediationReview.packet runId does not match`);
  }
  if (review.baselineCommit !== run.baselineCommit) {
    fail(findingFile, `${label}.remediationReview.packet baselineCommit does not match`);
  }
  for (const field of ['class', 'status', 'question', 'resolution']) {
    if (review.decisionBoundary?.[field] !== finding.decisionBoundary?.[field]) {
      fail(
        findingFile,
        `${label}.remediationReview.packet decisionBoundary.${field} does not match`
      );
    }
  }
  if (!sameStringArray(review.decisionBoundary?.evidence, finding.decisionBoundary?.evidence)) {
    fail(findingFile, `${label}.remediationReview.packet decisionBoundary.evidence does not match`);
  }
  if (
    review.automatedCompletion?.validationStatus !==
    finding.remediationReview?.implementationVerification
  ) {
    fail(
      findingFile,
      `${label}.remediationReview.packet automatedCompletion.validationStatus does not match`
    );
  }
  if (review.integrationEligibility?.status !== finding.remediationReview?.integrationEligibility) {
    fail(
      findingFile,
      `${label}.remediationReview.packet integrationEligibility.status does not match`
    );
  }

  const reviewStatusByRemediation = {
    'proposal-required': new Set(['draft', 'ready-for-independent-review']),
    'implemented-pending-review': new Set([
      'draft',
      'ready-for-independent-review',
      'revision-required',
    ]),
    completed: new Set(['completed']),
    rejected: new Set(['rejected']),
  };
  if (!reviewStatusByRemediation[finding.remediationReview?.status]?.has(review.reviewStatus)) {
    fail(findingFile, `${label}.remediationReview.status does not match packet reviewStatus`);
  }
}

function validateLedger() {
  const ledger = readYaml(ledgerFile);
  if (!ledger) return new Set();
  if (![1, 2].includes(ledger.schemaVersion)) fail(ledgerFile, 'schemaVersion must be 1 or 2');
  if (!Array.isArray(ledger.runs)) {
    fail(ledgerFile, 'runs must be an array');
    return new Set();
  }

  const runIds = new Set();
  for (const [index, run] of ledger.runs.entries()) {
    const label = `runs[${index}]`;
    const runSchema = run?.schemaVersion === 2 ? 2 : 1;
    if (![undefined, 1, 2].includes(run?.schemaVersion)) {
      fail(ledgerFile, `${label}.schemaVersion must be 1, 2, or omitted for legacy evidence`);
    }
    if (ledger.schemaVersion === 1 && runSchema === 2) {
      fail(ledgerFile, `${label} schemaVersion 2 requires ledger schemaVersion 2`);
    }
    if (!/^AM-P0-\d{3}$/.test(run?.id ?? '')) {
      fail(ledgerFile, `${label}.id is invalid: ${run?.id}`);
      continue;
    }
    if (runIds.has(run.id)) fail(ledgerFile, `${label}.id is duplicated: ${run.id}`);
    runIds.add(run.id);

    const missionFile = resolveRepositoryPath(ledgerFile, run.missionPath, `${label}.missionPath`);
    if (missionFile && !fs.readFileSync(missionFile, 'utf8').includes(`Run ID: \`${run.id}\``)) {
      fail(ledgerFile, `${label}.missionPath does not declare ${run.id}`);
    }

    const forwardFindings = [];
    if (!Array.isArray(run.findingPaths)) {
      fail(ledgerFile, `${label}.findingPaths must be an array`);
    } else {
      for (const [findingIndex, findingPath] of run.findingPaths.entries()) {
        const findingFile = resolveRepositoryPath(
          ledgerFile,
          findingPath,
          `${label}.findingPaths[${findingIndex}]`
        );
        if (findingFile) {
          const findingContent = fs.readFileSync(findingFile, 'utf8');
          const finding = readFindingMetadataBlock(findingFile);
          const expectedFindingId = path.basename(findingFile, '.md');
          if (!findingContent.includes(`# ${expectedFindingId}:`)) {
            fail(
              ledgerFile,
              `${label}.findingPaths[${findingIndex}] does not contain heading ${expectedFindingId}`
            );
          }
          if (!finding) continue;
          if (finding.runId !== run.id) {
            fail(ledgerFile, `${label}.findingPaths[${findingIndex}] does not declare ${run.id}`);
          }
          const findingSchema = finding.schemaVersion === 2 ? 2 : 1;
          if (![undefined, 1, 2].includes(finding.schemaVersion)) {
            fail(
              findingFile,
              `schemaVersion must be 1, 2, or omitted for legacy evidence: ${finding.schemaVersion}`
            );
          }
          if (findingSchema !== runSchema) {
            fail(
              findingFile,
              `finding schemaVersion ${findingSchema} does not match run schemaVersion ${runSchema}`
            );
          }
          if (findingSchema === 2) {
            forwardFindings.push({
              file: findingFile,
              path: findingPath,
              metadata: finding,
              expectedFindingId,
              label: `${label}.findingPaths[${findingIndex}]`,
            });
          }
        }
      }
    }

    commitExists(ledgerFile, run.baselineCommit, `${label}.baselineCommit`);
    if (!allowedBudgetClasses.has(run.budgetClass)) {
      fail(ledgerFile, `${label}.budgetClass is invalid: ${run.budgetClass}`);
    }

    if (!allowedObserverStatuses.has(run.observer?.status)) {
      fail(ledgerFile, `${label}.observer.status is invalid: ${run.observer?.status}`);
    }
    if (!nullablePositiveNumber(run.observer?.elapsedMinutes)) {
      fail(ledgerFile, `${label}.observer.elapsedMinutes must be null or a positive number`);
    }
    if (!nullableNonNegativeInteger(run.observer?.tokenUsage)) {
      fail(ledgerFile, `${label}.observer.tokenUsage must be null or a non-negative integer`);
    }
    if (
      !Number.isInteger(run.observer?.candidateFindingCount) ||
      run.observer.candidateFindingCount < 0
    ) {
      fail(ledgerFile, `${label}.observer.candidateFindingCount must be a non-negative integer`);
    }
    if (run.observer?.trackedMutationCount !== 0) {
      fail(ledgerFile, `${label}.observer.trackedMutationCount must be zero in Phase 0`);
    }

    if (!allowedVerificationStatuses.has(run.verification?.status)) {
      fail(ledgerFile, `${label}.verification.status is invalid: ${run.verification?.status}`);
    }
    if (!allowedClassifications.has(run.verification?.classification)) {
      fail(
        ledgerFile,
        `${label}.verification.classification is invalid: ${run.verification?.classification}`
      );
    }
    if (
      typeof run.verification?.confidence !== 'number' ||
      run.verification.confidence < 0 ||
      run.verification.confidence > 1
    ) {
      fail(ledgerFile, `${label}.verification.confidence must be between 0 and 1`);
    }

    if (runSchema === 2) {
      validateForwardRunState(run, label);
      if (run.findingDisposition?.status === 'record-no-finding') {
        if (run.findingPaths?.length !== 0) {
          fail(ledgerFile, `${label} record-no-finding requires an empty findingPaths array`);
        }
      } else if (run.findingPaths?.length === 0) {
        fail(ledgerFile, `${label} resolved finding disposition requires a finding path`);
      }
      for (const finding of forwardFindings) {
        for (const message of validateForwardFindingMetadata(finding.metadata, {
          expectedFindingId: finding.expectedFindingId,
          expectedRunId: run.id,
          run,
        })) {
          fail(finding.file, message);
        }
        validateForwardFindingPacket(
          finding.file,
          finding.path,
          finding.metadata,
          run,
          finding.label
        );
      }
    } else {
      if (
        Object.hasOwn(run, 'findingDisposition') ||
        Object.hasOwn(run, 'decisionBoundary') ||
        Object.hasOwn(run, 'automatedCompletion') ||
        Object.hasOwn(run, 'integration')
      ) {
        fail(ledgerFile, `${label} forward run fields require schemaVersion 2`);
      }
      validateDecision(
        ledgerFile,
        run.humanDecisions?.findingDisposition,
        `${label}.humanDecisions.findingDisposition`
      );
      validateDecision(
        ledgerFile,
        run.humanDecisions?.semantic,
        `${label}.humanDecisions.semantic`
      );
      validateDecision(
        ledgerFile,
        run.humanDecisions?.integration,
        `${label}.humanDecisions.integration`
      );
      if (run.humanDecisions?.integration?.status === 'accepted') {
        commitExists(
          ledgerFile,
          run.humanDecisions.integration.commit,
          `${label}.humanDecisions.integration.commit`
        );
      }

      if (!allowedRemediationStatuses.has(run.remediation?.status)) {
        fail(ledgerFile, `${label}.remediation.status is invalid: ${run.remediation?.status}`);
      }
      if (!allowedCompletionRules.has(run.remediation?.completionRule)) {
        fail(
          ledgerFile,
          `${label}.remediation.completionRule is invalid: ${run.remediation?.completionRule}`
        );
      }
      if (
        !['pending', 'passed', 'failed', 'not-required'].includes(run.remediation?.validationStatus)
      ) {
        fail(ledgerFile, `${label}.remediation.validationStatus is invalid`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(run.remediation?.completedOn ?? '')) {
        fail(ledgerFile, `${label}.remediation.completedOn must use YYYY-MM-DD`);
      }
      const reviewFile = resolveRepositoryPath(
        ledgerFile,
        run.remediation?.reviewPacket,
        `${label}.remediation.reviewPacket`,
        { nullable: true }
      );
      if (
        run.remediation?.completionRule === 'adequate-independent-review-and-required-validation'
      ) {
        if (!reviewFile) {
          fail(ledgerFile, `${label} automated completion requires a review packet`);
        } else {
          const review = readMetadataBlock(reviewFile);
          if (review?.runId !== run.id || review?.reviewStatus !== 'completed') {
            fail(
              ledgerFile,
              `${label}.remediation.reviewPacket is not a completed packet for ${run.id}`
            );
          }
          if (review?.independentReview?.status !== 'adequate') {
            fail(
              ledgerFile,
              `${label}.remediation.reviewPacket lacks an adequate independent review`
            );
          }
        }
      }
    }

    if (typeof run.outcome?.previouslyUnknown !== 'boolean') {
      fail(ledgerFile, `${label}.outcome.previouslyUnknown must be boolean`);
    }
    if (![0, 1, 2].includes(run.outcome?.actionValue)) {
      fail(ledgerFile, `${label}.outcome.actionValue must be 0, 1, or 2`);
    }
    if (!nullableNonNegativeInteger(run.outcome?.residualRiskCount)) {
      fail(ledgerFile, `${label}.outcome.residualRiskCount must be a non-negative integer`);
    }
  }
  return runIds;
}

function validateQueue(runIds) {
  const queue = readYaml(queueFile);
  if (!queue) return;
  if (queue.schemaVersion !== 2) fail(queueFile, 'schemaVersion must be 2');
  if (!Array.isArray(queue.missions)) {
    fail(queueFile, 'missions must be an array');
    return;
  }

  const missionIds = new Set();
  const activeLeaseIds = new Set();
  for (const [index, mission] of queue.missions.entries()) {
    const label = `missions[${index}]`;
    if (!/^AM-P0-\d{3}$/.test(mission?.id ?? '')) {
      fail(queueFile, `${label}.id is invalid: ${mission?.id}`);
      continue;
    }
    if (runIds.has(mission.id) || missionIds.has(mission.id)) {
      fail(queueFile, `${label}.id is already used: ${mission.id}`);
    }
    missionIds.add(mission.id);
    if (!allowedMissionClasses.has(mission.class)) {
      fail(queueFile, `${label}.class is invalid: ${mission.class}`);
    }
    if (!allowedMissionStatuses.has(mission.status)) {
      fail(queueFile, `${label}.status is invalid: ${mission.status}`);
    }
    if (!Number.isInteger(mission.priority) || mission.priority <= 0) {
      fail(queueFile, `${label}.priority must be a positive integer`);
    }
    for (const field of ['title', 'objective', 'scopeHint', 'source']) {
      if (typeof mission[field] !== 'string' || mission[field].length === 0) {
        fail(queueFile, `${label}.${field} must be non-empty`);
      }
    }
    if (!Array.isArray(mission.oracle) || mission.oracle.length === 0) {
      fail(queueFile, `${label}.oracle must not be empty`);
    }
    if (!allowedBudgetClasses.has(mission.budgetClass)) {
      fail(queueFile, `${label}.budgetClass is invalid: ${mission.budgetClass}`);
    }
    if (!allowedMissionBands.has(mission.requiredBand)) {
      fail(queueFile, `${label}.requiredBand is invalid: ${mission.requiredBand}`);
    }
    if (mission.taskClass !== 'observe') {
      fail(queueFile, `${label}.taskClass must be observe in Phase 0`);
    }
    if (!allowedMissionRisks.has(mission.risk)) {
      fail(queueFile, `${label}.risk is invalid: ${mission.risk}`);
    }
    if (mission.executionMode !== 'autonomous-read-only-fresh-context') {
      fail(queueFile, `${label}.executionMode is invalid: ${mission.executionMode}`);
    }
    if (mission.freshContextRequired !== true) {
      fail(queueFile, `${label}.freshContextRequired must be true`);
    }
    if (Object.hasOwn(mission, 'humanGates')) {
      fail(queueFile, `${label}.humanGates is obsolete; use attendedDecisions`);
    }
    if (!Array.isArray(mission.attendedDecisions)) {
      fail(queueFile, `${label}.attendedDecisions must be an array`);
    } else {
      const decisions = new Set();
      for (const decisionClass of mission.attendedDecisions) {
        if (!allowedMissionDecisionClasses.has(decisionClass)) {
          fail(
            queueFile,
            `${label}.attendedDecisions contains an invalid decision class: ${decisionClass}`
          );
        }
        if (decisions.has(decisionClass)) {
          fail(queueFile, `${label}.attendedDecisions duplicates ${decisionClass}`);
        }
        decisions.add(decisionClass);
      }
      if (decisions.size > 0 && mission.status !== 'blocked') {
        fail(queueFile, `${label} with attendedDecisions must be blocked`);
      }
    }
    const lease = mission.lease;
    const leaseKeys =
      lease && typeof lease === 'object' && !Array.isArray(lease)
        ? Object.keys(lease).sort().join(',')
        : '';
    if (leaseKeys !== 'acquiredAt,expiresAt,id,mode,owner,scope,target') {
      fail(
        queueFile,
        `${label}.lease must contain only scope, target, mode, id, owner, acquiredAt, and expiresAt`
      );
    } else {
      if (lease.scope !== 'exact-item') {
        fail(queueFile, `${label}.lease.scope must be exact-item`);
      }
      if (lease.target !== mission.id) {
        fail(queueFile, `${label}.lease.target must equal ${mission.id}`);
      }
      if (lease.mode !== 'single-runner') {
        fail(queueFile, `${label}.lease.mode must be single-runner`);
      }
    }
    if (leaseKeys === 'acquiredAt,expiresAt,id,mode,owner,scope,target') {
      if (mission.status === 'ready' || mission.status === 'running') {
        if (!/^lease:[a-f0-9]{64}$/.test(lease.id ?? '')) {
          fail(queueFile, `${label}.lease.id is invalid for an active mission`);
        } else if (activeLeaseIds.has(lease.id)) {
          fail(queueFile, `${label}.lease.id is duplicated: ${lease.id}`);
        } else {
          activeLeaseIds.add(lease.id);
        }
        if (typeof lease.owner !== 'string' || lease.owner.length === 0) {
          fail(queueFile, `${label}.lease.owner is required for an active mission`);
        }
        const acquired = Date.parse(lease.acquiredAt ?? '');
        const expires = Date.parse(lease.expiresAt ?? '');
        if (!Number.isFinite(acquired) || !Number.isFinite(expires) || acquired >= expires) {
          fail(queueFile, `${label}.lease timestamps are invalid`);
        }
      } else if (
        [lease.id, lease.owner, lease.acquiredAt, lease.expiresAt].some((value) => value !== null)
      ) {
        fail(
          queueFile,
          `${label}.lease runtime fields must be empty unless the mission is ready or running`
        );
      }
    }
    if (mission.mutationPolicy !== 'read-only') {
      fail(queueFile, `${label}.mutationPolicy must be read-only in Phase 0`);
    }
    if (mission.status === 'blocked' && !mission.blockedBy) {
      fail(queueFile, `${label}.blockedBy is required for blocked missions`);
    }
  }
}

const runIds = validateLedger();
validateQueue(runIds);

if (errors.length > 0) {
  console.error(`[autonomous-runs] ${errors.length} issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('[autonomous-runs] OK');
}
