import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

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
const allowedMissionGates = new Set(['mission-freezing', 'finding-disposition']);

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

function readMetadataBlock(file) {
  const content = fs.readFileSync(file, 'utf8');
  const match = content.match(/<!-- prettier-ignore -->\s*```yaml\r?\n([\s\S]*?)\r?\n```/);
  if (!match) return null;
  try {
    return YAML.parse(match[1]);
  } catch {
    return null;
  }
}

function validateLedger() {
  const ledger = readYaml(ledgerFile);
  if (!ledger) return new Set();
  if (ledger.schemaVersion !== 1) fail(ledgerFile, 'schemaVersion must be 1');
  if (!Array.isArray(ledger.runs)) {
    fail(ledgerFile, 'runs must be an array');
    return new Set();
  }

  const runIds = new Set();
  for (const [index, run] of ledger.runs.entries()) {
    const label = `runs[${index}]`;
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
          const finding = fs.readFileSync(findingFile, 'utf8');
          if (!finding.includes(`runId: ${run.id}`)) {
            fail(ledgerFile, `${label}.findingPaths[${findingIndex}] does not declare ${run.id}`);
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

    validateDecision(
      ledgerFile,
      run.humanDecisions?.findingDisposition,
      `${label}.humanDecisions.findingDisposition`
    );
    validateDecision(ledgerFile, run.humanDecisions?.semantic, `${label}.humanDecisions.semantic`);
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
    if (run.remediation?.completionRule === 'adequate-independent-review-and-required-validation') {
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
  if (queue.schemaVersion !== 1) fail(queueFile, 'schemaVersion must be 1');
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
    if (mission.executionMode !== 'attended-read-only-fresh-context') {
      fail(queueFile, `${label}.executionMode is invalid: ${mission.executionMode}`);
    }
    if (mission.freshContextRequired !== true) {
      fail(queueFile, `${label}.freshContextRequired must be true`);
    }
    if (!Array.isArray(mission.humanGates)) {
      fail(queueFile, `${label}.humanGates must be an array`);
    } else {
      const gates = new Set();
      for (const gate of mission.humanGates) {
        if (!allowedMissionGates.has(gate)) {
          fail(queueFile, `${label}.humanGates contains an invalid gate: ${gate}`);
        }
        if (gates.has(gate)) fail(queueFile, `${label}.humanGates duplicates ${gate}`);
        gates.add(gate);
      }
      if (!gates.has('mission-freezing')) {
        fail(queueFile, `${label}.humanGates must include mission-freezing`);
      }
    }
    const lease = mission.lease;
    const leaseKeys =
      lease && typeof lease === 'object' && !Array.isArray(lease)
        ? Object.keys(lease).sort().join(',')
        : '';
    if (leaseKeys !== 'acquiredAt,expiresAt,id,owner') {
      fail(queueFile, `${label}.lease must contain only id, owner, acquiredAt, and expiresAt`);
    } else if (mission.status === 'ready' || mission.status === 'running') {
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
    } else if (Object.values(lease).some((value) => value !== null)) {
      fail(queueFile, `${label}.lease must be empty unless the mission is ready or running`);
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
