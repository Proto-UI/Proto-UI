import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

export const DIMENSION_KEYS = [
  'sourceAuthority',
  'relationTracing',
  'semanticReasoning',
  'verificationDesign',
  'governanceSafety',
  'epistemicDiscipline',
];

const QUESTION_IDS = [
  'authority',
  'relations',
  'boundary',
  'validation',
  'governance',
  'permission',
];
const BANDS = ['U0', 'C1', 'C2', 'C3', 'C4'];
const HEX64 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40,64}$/;
const FINGERPRINT = /^sha256:[a-f0-9]{64}$/;
const REPOSITORY_ID = /^[a-z][a-z0-9+.-]*:\S{3,200}$/;

function fail(message) {
  throw new Error(message);
}

function requireCondition(condition, message) {
  if (!condition) fail(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, required, optional, label) {
  requireCondition(isObject(value), `${label} must be an object`);
  const allowed = new Set([...required, ...optional]);
  for (const key of required)
    requireCondition(Object.hasOwn(value, key), `${label}.${key} is required`);
  for (const key of Object.keys(value))
    requireCondition(allowed.has(key), `${label}.${key} is not allowed`);
}

function nonEmptyString(value, label, maxLength = 500) {
  requireCondition(
    typeof value === 'string' && value.length > 0 && value.length <= maxLength,
    `${label} must be a non-empty string`
  );
}

function uniqueStrings(value, label, { min = 0 } = {}) {
  requireCondition(
    Array.isArray(value) && value.length >= min,
    `${label} must be an array with at least ${min} items`
  );
  requireCondition(
    value.every((item) => typeof item === 'string' && item.length > 0),
    `${label} must contain non-empty strings`
  );
  requireCondition(new Set(value).size === value.length, `${label} must not contain duplicates`);
}

function parseTimestamp(value, label) {
  nonEmptyString(value, label);
  const timestamp = Date.parse(value);
  requireCondition(Number.isFinite(timestamp), `${label} must be an RFC 3339 timestamp`);
  return timestamp;
}

export function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    requireCondition(Number.isFinite(value), 'RFC8785 input cannot contain non-finite numbers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  requireCondition(isObject(value), 'RFC8785 input must contain only JSON values');
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(',')}}`;
}

export function sha256(...parts) {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest('hex');
}

export function digestJson(value) {
  return sha256(canonicalize(value));
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseCapabilityPolicy(source) {
  const policy = parseYaml(source.toString('utf8'));
  requireCondition(policy?.schemaVersion === 2, 'capability policy schemaVersion must be 2');
  requireCondition(
    Array.isArray(policy.dimensions) && policy.dimensions.length === 6,
    'capability policy must define six dimensions'
  );
  requireCondition(
    policy.scoring?.bandMustEqualDerivedBand === true,
    'capability policy must require the derived band'
  );
  requireCondition(
    isObject(policy.mutationClasses) &&
      ['none', 'proposal-only', 'disposable-output-only'].every(
        (name) =>
          policy.mutationClasses[name]?.trackedWrite === false &&
          policy.mutationClasses[name]?.externalWrite === false
      ) &&
      policy.mutationClasses['reversible-github-metadata']?.externalWrite === true &&
      policy.mutationClasses['feature-branch']?.trackedWrite === true &&
      policy.mutationClasses['tracked-maintenance-state']?.trackedWrite === true &&
      policy.executionModes?.['human-assisted']?.assessmentEffect === 'advisory' &&
      policy.executionModes?.autonomous?.assessmentEffect === 'binding-ceiling' &&
      policy.selfAssessment?.maximumBand === 'C4' &&
      policy.selfAssessment?.grantsPermission === false,
    'capability policy mutation classes are incomplete'
  );
  Object.defineProperty(policy, '__digest', { value: sha256(source), enumerable: false });
  return policy;
}

export function loadCapabilityPolicy(path) {
  return parseCapabilityPolicy(readFileSync(path));
}

export function loadCommittedCapabilityPolicy(root, baseSha) {
  requireCondition(GIT_SHA.test(baseSha), 'committed policy baseSha is invalid');
  return parseCapabilityPolicy(
    readCommittedPath(root, baseSha, 'internal/agent-operations/capability-policy.yaml')
  );
}

export function loadCapabilityRubric(path) {
  const source = readFileSync(path);
  const rubric = parseYaml(source.toString('utf8'));
  requireCondition(rubric?.schemaVersion === 1, 'capability rubric schemaVersion must be 1');
  nonEmptyString(rubric.rubricVersion, 'capability rubric rubricVersion', 120);
  requireCondition(
    rubric.publishesAnswerKey === false,
    'capability rubric must not publish an answer key'
  );
  exactKeys(rubric.scale, ['0', '1', '2', '3', '4'], [], 'capability rubric scale');
  for (const score of ['0', '1', '2', '3', '4']) {
    nonEmptyString(rubric.scale[score], `capability rubric scale.${score}`, 2_000);
  }
  exactKeys(rubric.dimensions, DIMENSION_KEYS, [], 'capability rubric dimensions');
  for (const key of DIMENSION_KEYS) {
    exactKeys(
      rubric.dimensions[key],
      ['questionIds', 'criterion'],
      [],
      `capability rubric dimensions.${key}`
    );
    uniqueStrings(
      rubric.dimensions[key].questionIds,
      `capability rubric dimensions.${key}.questionIds`,
      { min: 1 }
    );
    requireCondition(
      rubric.dimensions[key].questionIds.every((id) => QUESTION_IDS.includes(id)),
      `capability rubric dimensions.${key}.questionIds contains an unknown question`
    );
    nonEmptyString(
      rubric.dimensions[key].criterion,
      `capability rubric dimensions.${key}.criterion`,
      2_000
    );
  }
  exactKeys(
    rubric.criticalFailures,
    [
      'fabricated-evidence',
      'answer-provenance-failure',
      'source-authority-inversion',
      'permission-escalation',
      'hidden-uncertainty',
      'snapshot-binding-failure',
      'evaluator-independence-failure',
    ],
    [],
    'capability rubric criticalFailures'
  );
  for (const [code, description] of Object.entries(rubric.criticalFailures)) {
    nonEmptyString(description, `capability rubric criticalFailures.${code}`, 2_000);
  }
  Object.defineProperty(rubric, '__digest', { value: sha256(source), enumerable: false });
  return rubric;
}

function git(root, args, options = {}) {
  const encoding = Object.hasOwn(options, 'encoding') ? options.encoding : 'utf8';
  return execFileSync('git', args, { cwd: root, encoding });
}

function normalizeRemote(remote) {
  const trimmed = remote.trim().replace(/\.git$/, '');
  const https = trimmed.match(/^https?:\/\/([^/]+)\/(.+)$/i);
  if (https) return `${https[1].toLowerCase()}:${https[2]}`;
  const ssh = trimmed.match(/^(?:ssh:\/\/)?git@([^:/]+)[:/](.+)$/i);
  if (ssh) return `${ssh[1].toLowerCase()}:${ssh[2]}`;
  fail('Cannot derive repositoryId from remote.origin.url; pass --repository-id explicitly');
}

export function deriveRepositoryId(root) {
  return normalizeRemote(git(root, ['config', '--get', 'remote.origin.url']).trim());
}

function listWorktreeFiles(root) {
  const output = git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    encoding: null,
  });
  return output.toString('utf8').split('\0').filter(Boolean).sort();
}

function hashWorktreePaths(root, paths) {
  const hash = createHash('sha256');
  for (const repoPath of paths) {
    const absolute = resolve(root, repoPath);
    hash.update(repoPath.replaceAll('\\', '/'));
    hash.update('\0');
    if (!existsSync(absolute)) {
      hash.update('missing\0');
      continue;
    }
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      hash.update('symlink\0');
      hash.update(readlinkSync(absolute));
    } else if (stat.isFile()) {
      hash.update('file\0');
      hash.update(readFileSync(absolute));
    } else if (stat.isDirectory()) {
      hash.update('directory-or-gitlink\0');
    } else {
      hash.update('unsupported\0');
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function collectRepositorySnapshot(
  root,
  { assessmentMode = 'independent', repositoryId } = {}
) {
  requireCondition(
    ['independent', 'self-assessment'].includes(assessmentMode),
    'assessmentMode is invalid'
  );
  const resolvedRoot = resolve(root);
  const status = git(resolvedRoot, ['status', '--porcelain=v1', '--untracked-files=all']).trim();
  const clean = status.length === 0;
  if (assessmentMode === 'independent' && !clean) {
    fail('Independent capability challenges require a clean committed worktree');
  }

  const baseSha = git(resolvedRoot, ['rev-parse', 'HEAD']).trim();
  const treeSha = git(resolvedRoot, ['rev-parse', 'HEAD^{tree}']).trim();
  const paths = listWorktreeFiles(resolvedRoot);
  const snapshotMode = clean ? 'committed-clean' : 'worktree';
  const worktreeDigest = clean
    ? sha256('committed-clean\0', baseSha, '\0', treeSha)
    : hashWorktreePaths(resolvedRoot, paths);
  const specPaths = paths.filter((path) => path === 'spec' || path.startsWith('spec/'));
  const catalogDigest = clean
    ? hashCommittedCatalog(resolvedRoot, baseSha)
    : hashWorktreePaths(resolvedRoot, specPaths);
  const diffDigest = sha256(
    git(resolvedRoot, ['diff', '--binary', 'HEAD', '--']),
    '\0',
    worktreeDigest
  );
  const policyPath = resolve(resolvedRoot, 'internal/agent-operations/capability-policy.yaml');
  const generatorPath = resolve(
    resolvedRoot,
    'scripts/agent-operations/create-capability-challenge.mjs'
  );

  return {
    repositoryId: repositoryId ?? deriveRepositoryId(resolvedRoot),
    assessmentMode,
    snapshotMode,
    baseSha,
    treeSha,
    worktreeDigest,
    catalogDigest,
    diffDigest,
    policyDigest: clean
      ? sha256(
          readCommittedPath(
            resolvedRoot,
            baseSha,
            'internal/agent-operations/capability-policy.yaml'
          )
        )
      : sha256(readFileSync(policyPath)),
    generatorDigest: clean
      ? sha256(
          readCommittedPath(
            resolvedRoot,
            baseSha,
            'scripts/agent-operations/create-capability-challenge.mjs'
          )
        )
      : sha256(readFileSync(generatorPath)),
    clean,
  };
}

function readCommittedPath(root, commit, path) {
  return git(root, ['show', `${commit}:${path}`], { encoding: null });
}

function hashCommittedCatalog(root, commit) {
  const entries = git(root, ['ls-tree', '-r', '-z', commit, '--', 'spec'], {
    encoding: null,
  })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  const hash = createHash('sha256');
  for (const entry of entries) {
    const match = entry.match(/^(\d+)\s+\w+\s+[a-f0-9]+\t(.+)$/s);
    requireCondition(match, `cannot parse committed catalog entry: ${entry}`);
    const [, mode, path] = match;
    hash.update(path.replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(mode === '120000' ? 'symlink\0' : 'file\0');
    hash.update(readCommittedPath(root, commit, path));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function collectCommittedAssessmentBaseline(root, baseSha, { repositoryId } = {}) {
  requireCondition(GIT_SHA.test(baseSha), 'committed baseline baseSha is invalid');
  const resolvedRoot = resolve(root);
  const commitType = git(resolvedRoot, ['cat-file', '-t', baseSha]).trim();
  requireCondition(commitType === 'commit', 'assessment baseline does not identify a commit');
  const treeSha = git(resolvedRoot, ['rev-parse', `${baseSha}^{tree}`]).trim();
  const policyPath = 'internal/agent-operations/capability-policy.yaml';
  const generatorPath = 'scripts/agent-operations/create-capability-challenge.mjs';
  return {
    repositoryId: repositoryId ?? deriveRepositoryId(resolvedRoot),
    snapshotMode: 'committed-clean',
    baseSha,
    treeSha,
    worktreeDigest: sha256('committed-clean\0', baseSha, '\0', treeSha),
    catalogDigest: hashCommittedCatalog(resolvedRoot, baseSha),
    policyDigest: sha256(readCommittedPath(resolvedRoot, baseSha, policyPath)),
    generatorDigest: sha256(readCommittedPath(resolvedRoot, baseSha, generatorPath)),
  };
}

export function computeChallengeDigest(challenge) {
  const { challengeDigest: _ignored, ...unsigned } = challenge;
  return digestJson(unsigned);
}

export function validateChallenge(challenge, { now = Date.now() } = {}) {
  exactKeys(
    challenge,
    [
      'schemaVersion',
      'kind',
      'challengeId',
      'challengeDigest',
      'subject',
      'scope',
      'validity',
      'questions',
      'responseContract',
    ],
    [],
    'challenge'
  );
  requireCondition(challenge.schemaVersion === 1, 'challenge.schemaVersion must be 1');
  requireCondition(
    challenge.kind === 'proto-ui.agent-capability-challenge',
    'challenge.kind is invalid'
  );
  requireCondition(
    /^challenge:[a-f0-9]{64}$/.test(challenge.challengeId),
    'challenge.challengeId is invalid'
  );
  requireCondition(HEX64.test(challenge.challengeDigest), 'challenge.challengeDigest is invalid');
  requireCondition(
    computeChallengeDigest(challenge) === challenge.challengeDigest,
    'challenge digest mismatch'
  );

  exactKeys(challenge.subject, ['agentKeyFingerprint'], [], 'challenge.subject');
  requireCondition(
    FINGERPRINT.test(challenge.subject.agentKeyFingerprint),
    'challenge subject fingerprint is invalid'
  );
  exactKeys(
    challenge.scope,
    [
      'repositoryId',
      'assessmentMode',
      'snapshotMode',
      'baseSha',
      'treeSha',
      'worktreeDigest',
      'catalogDigest',
      'policyDigest',
      'generatorDigest',
      'nonceDigest',
    ],
    [],
    'challenge.scope'
  );
  requireCondition(
    REPOSITORY_ID.test(challenge.scope.repositoryId),
    'challenge repositoryId is invalid'
  );
  requireCondition(
    ['self-assessment', 'independent'].includes(challenge.scope.assessmentMode),
    'challenge assessmentMode is invalid'
  );
  requireCondition(
    ['worktree', 'committed-clean'].includes(challenge.scope.snapshotMode),
    'challenge snapshotMode is invalid'
  );
  if (challenge.scope.assessmentMode === 'independent') {
    requireCondition(
      challenge.scope.snapshotMode === 'committed-clean',
      'independent challenge must bind a clean committed snapshot'
    );
  }
  for (const key of ['baseSha', 'treeSha'])
    requireCondition(GIT_SHA.test(challenge.scope[key]), `challenge.scope.${key} is invalid`);
  for (const key of [
    'worktreeDigest',
    'catalogDigest',
    'policyDigest',
    'generatorDigest',
    'nonceDigest',
  ]) {
    requireCondition(HEX64.test(challenge.scope[key]), `challenge.scope.${key} is invalid`);
  }

  exactKeys(challenge.validity, ['issuedAt', 'expiresAt'], [], 'challenge.validity');
  const issuedAt = parseTimestamp(challenge.validity.issuedAt, 'challenge.validity.issuedAt');
  const expiresAt = parseTimestamp(challenge.validity.expiresAt, 'challenge.validity.expiresAt');
  requireCondition(issuedAt < expiresAt, 'challenge expiry must follow issuance');
  requireCondition(
    expiresAt - issuedAt <= 240 * 60_000,
    'challenge lifetime exceeds policy maximum'
  );
  requireCondition(now <= expiresAt, 'challenge has expired');

  requireCondition(
    Array.isArray(challenge.questions) && challenge.questions.length === 6,
    'challenge must contain exactly six questions'
  );
  const ids = challenge.questions.map((question) => question.id);
  requireCondition(
    QUESTION_IDS.every((id) => ids.includes(id)) && new Set(ids).size === 6,
    'challenge question IDs are invalid'
  );
  for (const [index, question] of challenge.questions.entries()) {
    exactKeys(
      question,
      ['id', 'dimensions', 'prompt', 'requiredEvidence'],
      [],
      `challenge.questions[${index}]`
    );
    nonEmptyString(question.prompt, `challenge.questions[${index}].prompt`, 20_000);
    uniqueStrings(question.dimensions, `challenge.questions[${index}].dimensions`, { min: 1 });
    uniqueStrings(question.requiredEvidence, `challenge.questions[${index}].requiredEvidence`, {
      min: 4,
    });
  }
  exactKeys(
    challenge.responseContract,
    [
      'format',
      'schema',
      'requiredPerQuestion',
      'selfAssessmentCeiling',
      'independentEvaluationRequiredAbove',
    ],
    [],
    'challenge.responseContract'
  );
  requireCondition(
    challenge.responseContract.format === 'json',
    'challenge response format must be json'
  );
  requireCondition(
    challenge.responseContract.schema ===
      'internal/agent-operations/schemas/capability-response.schema.json',
    'challenge response schema is invalid'
  );
  requireCondition(
    challenge.responseContract.selfAssessmentCeiling === 'C4',
    'self-assessment ceiling must be C4'
  );
  requireCondition(
    challenge.responseContract.independentEvaluationRequiredAbove ===
      'none-for-local-self-governance',
    'local self-governance must not require an external evaluator'
  );
  return challenge;
}

export function validateCapabilityResponse(response, challenge) {
  exactKeys(
    response,
    [
      'schemaVersion',
      'kind',
      'challengeId',
      'challengeDigest',
      'subject',
      'submittedAt',
      'answers',
    ],
    [],
    'capability response'
  );
  requireCondition(response.schemaVersion === 1, 'capability response schemaVersion must be 1');
  requireCondition(
    response.kind === 'proto-ui.agent-capability-response',
    'capability response kind is invalid'
  );
  requireCondition(
    response.challengeId === challenge.challengeId &&
      response.challengeDigest === challenge.challengeDigest,
    'capability response challenge binding mismatch'
  );
  exactKeys(response.subject, ['agentKeyFingerprint'], [], 'capability response subject');
  requireCondition(
    response.subject.agentKeyFingerprint === challenge.subject.agentKeyFingerprint,
    'capability response subject mismatch'
  );
  const submittedAt = parseTimestamp(response.submittedAt, 'capability response submittedAt');
  requireCondition(
    submittedAt >= Date.parse(challenge.validity.issuedAt) &&
      submittedAt <= Date.parse(challenge.validity.expiresAt),
    'capability response was not submitted during the challenge validity window'
  );
  requireCondition(
    Array.isArray(response.answers) && response.answers.length === QUESTION_IDS.length,
    'capability response must contain exactly one answer per question'
  );
  const answerIds = new Set();
  for (const [index, answer] of response.answers.entries()) {
    exactKeys(
      answer,
      ['questionId', 'answer', 'evidence', 'unknowns', 'humanGates'],
      [],
      `capability response answers[${index}]`
    );
    requireCondition(
      QUESTION_IDS.includes(answer.questionId) && !answerIds.has(answer.questionId),
      `capability response questionId is invalid or duplicated: ${answer.questionId}`
    );
    answerIds.add(answer.questionId);
    nonEmptyString(answer.answer, `capability response answers[${index}].answer`, 100_000);
    requireCondition(
      Array.isArray(answer.evidence) && answer.evidence.length > 0,
      `capability response answers[${index}].evidence must not be empty`
    );
    for (const [evidenceIndex, evidence] of answer.evidence.entries()) {
      exactKeys(
        evidence,
        ['source', 'locator', 'observation'],
        [],
        `capability response answers[${index}].evidence[${evidenceIndex}]`
      );
      for (const key of ['source', 'locator', 'observation']) {
        nonEmptyString(
          evidence[key],
          `capability response answers[${index}].evidence[${evidenceIndex}].${key}`,
          20_000
        );
      }
    }
    uniqueStrings(answer.unknowns, `capability response answers[${index}].unknowns`);
    uniqueStrings(answer.humanGates, `capability response answers[${index}].humanGates`);
  }
  return response;
}

export function createCapabilityResponseTemplate(challenge) {
  validateChallenge(challenge);
  return {
    schemaVersion: 1,
    kind: 'proto-ui.agent-capability-response',
    challengeId: challenge.challengeId,
    challengeDigest: challenge.challengeDigest,
    subject: { agentKeyFingerprint: challenge.subject.agentKeyFingerprint },
    submittedAt: '',
    answers: challenge.questions.map((question) => ({
      questionId: question.id,
      answer: '',
      evidence: [],
      unknowns: [],
      humanGates: [],
    })),
  };
}

export function validateSelfEvaluation(evaluation, rubric, policy) {
  exactKeys(evaluation, ['dimensions', 'criticalFailures'], [], 'self evaluation');
  exactKeys(evaluation.dimensions, DIMENSION_KEYS, [], 'self evaluation dimensions');
  for (const key of DIMENSION_KEYS) {
    const dimension = evaluation.dimensions[key];
    exactKeys(
      dimension,
      ['score', 'rationale', 'evidenceQuestionIds'],
      [],
      `self evaluation dimensions.${key}`
    );
    requireCondition(
      Number.isInteger(dimension.score) && dimension.score >= 0 && dimension.score <= 4,
      `self evaluation dimensions.${key}.score must be an integer from 0 through 4`
    );
    nonEmptyString(dimension.rationale, `self evaluation dimensions.${key}.rationale`, 20_000);
    uniqueStrings(
      dimension.evidenceQuestionIds,
      `self evaluation dimensions.${key}.evidenceQuestionIds`,
      { min: 1 }
    );
    const permitted = new Set(rubric.dimensions[key].questionIds);
    requireCondition(
      dimension.evidenceQuestionIds.every((id) => permitted.has(id)),
      `self evaluation dimensions.${key}.evidenceQuestionIds exceeds the rubric mapping`
    );
  }
  uniqueStrings(evaluation.criticalFailures, 'self evaluation criticalFailures');
  const allowedFailures = new Set(policy.scoring.criticalFailureCodes);
  for (const failure of evaluation.criticalFailures) {
    requireCondition(allowedFailures.has(failure), `unknown critical failure: ${failure}`);
    requireCondition(
      Object.hasOwn(rubric.criticalFailures, failure),
      `critical failure is absent from the rubric: ${failure}`
    );
  }
  return evaluation;
}

export function computeSelfAssessmentResultDigest(result) {
  const { resultDigest: _ignored, ...unsigned } = result;
  return digestJson(unsigned);
}

export function deriveSelfAssessmentResult({ challenge, response, evaluation, rubric, policy }) {
  validateChallenge(challenge);
  requireCondition(
    challenge.scope.assessmentMode === 'self-assessment',
    'an unsigned self result requires a self-assessment challenge'
  );
  validateCapabilityResponse(response, challenge);
  validateSelfEvaluation(evaluation, rubric, policy);
  const derived = deriveCapabilityBand(evaluation, policy);
  const band = derived;
  const resultSeed = {
    challengeId: challenge.challengeId,
    challengeDigest: challenge.challengeDigest,
    responseDigest: digestJson(response),
    rubricVersion: rubric.rubricVersion,
    rubricDigest: rubric.__digest,
    subject: challenge.subject.agentKeyFingerprint,
    evaluation,
  };
  const result = {
    schemaVersion: 1,
    kind: 'proto-ui.agent-capability-self-result',
    resultId: `self-result:${digestJson(resultSeed)}`,
    challenge: {
      challengeId: challenge.challengeId,
      challengeDigest: challenge.challengeDigest,
      responseDigest: digestJson(response),
    },
    subject: { agentKeyFingerprint: challenge.subject.agentKeyFingerprint },
    scope: {
      repositoryId: challenge.scope.repositoryId,
      baseSha: challenge.scope.baseSha,
      treeSha: challenge.scope.treeSha,
      worktreeDigest: challenge.scope.worktreeDigest,
      catalogDigest: challenge.scope.catalogDigest,
      policyDigest: challenge.scope.policyDigest,
    },
    rubric: { version: rubric.rubricVersion, digest: rubric.__digest },
    evaluation,
    capability: {
      band,
      eligibleTaskClasses: [...allowedTaskClasses(policy, band)],
      recommendedTaskClasses: [...allowedTaskClasses(policy, band)],
      recommendedReviewClasses: [policy.bands[band].autonomousReviewCeiling],
      autonomousTaskCeiling: band,
      autonomousReviewCeiling: policy.bands[band].autonomousReviewCeiling,
      autonomousMutationCeiling: policy.bands[band].autonomousMutationCeiling,
    },
    trust: {
      status: 'unsigned-self-assessment',
      independentlyEvaluated: false,
      projectTrusted: false,
      cryptographicallyTrusted: false,
      grantsPermission: false,
      predictsAcceptance: false,
    },
    validity: {
      derivedAt: response.submittedAt,
      expiresAt: challenge.validity.expiresAt,
    },
    derivedAt: response.submittedAt,
  };
  result.resultDigest = computeSelfAssessmentResultDigest(result);
  return result;
}

export function validateSelfAssessmentResult(result, policy) {
  exactKeys(
    result,
    [
      'schemaVersion',
      'kind',
      'resultId',
      'resultDigest',
      'challenge',
      'subject',
      'scope',
      'rubric',
      'evaluation',
      'capability',
      'trust',
      'validity',
      'derivedAt',
    ],
    [],
    'self result'
  );
  requireCondition(result.schemaVersion === 1, 'self result schemaVersion is invalid');
  requireCondition(
    result.kind === 'proto-ui.agent-capability-self-result',
    'self result kind is invalid'
  );
  requireCondition(
    /^self-result:[a-f0-9]{64}$/.test(result.resultId) && HEX64.test(result.resultDigest),
    'self result identity is invalid'
  );
  requireCondition(
    computeSelfAssessmentResultDigest(result) === result.resultDigest,
    'self result digest mismatch'
  );
  exactKeys(
    result.capability,
    [
      'band',
      'eligibleTaskClasses',
      'recommendedTaskClasses',
      'recommendedReviewClasses',
      'autonomousTaskCeiling',
      'autonomousReviewCeiling',
      'autonomousMutationCeiling',
    ],
    [],
    'self result capability'
  );
  const derivedBand = deriveCapabilityBand(result.evaluation, policy);
  requireCondition(result.capability.band === derivedBand, 'self result band was not derived');
  const expectedTasks = [...allowedTaskClasses(policy, derivedBand)];
  requireCondition(
    canonicalize(result.capability.eligibleTaskClasses) === canonicalize(expectedTasks) &&
      canonicalize(result.capability.recommendedTaskClasses) === canonicalize(expectedTasks),
    'self result task classes do not match policy'
  );
  requireCondition(
    result.capability.autonomousTaskCeiling === derivedBand &&
      result.capability.autonomousReviewCeiling ===
        policy.bands[derivedBand].autonomousReviewCeiling &&
      result.capability.autonomousMutationCeiling ===
        policy.bands[derivedBand].autonomousMutationCeiling,
    'self result ceilings do not match policy'
  );
  exactKeys(
    result.trust,
    [
      'status',
      'independentlyEvaluated',
      'projectTrusted',
      'cryptographicallyTrusted',
      'grantsPermission',
      'predictsAcceptance',
    ],
    [],
    'self result trust'
  );
  requireCondition(
    result.trust.status === 'unsigned-self-assessment' &&
      result.trust.independentlyEvaluated === false &&
      result.trust.projectTrusted === false &&
      result.trust.cryptographicallyTrusted === false &&
      result.trust.grantsPermission === false &&
      result.trust.predictsAcceptance === false,
    'self result trust boundary is invalid'
  );
  exactKeys(result.validity, ['derivedAt', 'expiresAt'], [], 'self result validity');
  const derivedAt = parseTimestamp(result.validity.derivedAt, 'self result derivedAt');
  const expiresAt = parseTimestamp(result.validity.expiresAt, 'self result expiresAt');
  requireCondition(derivedAt < expiresAt, 'self result expiry must follow derivation');
  requireCondition(result.derivedAt === result.validity.derivedAt, 'self result time mismatch');
  return result;
}

export function deriveCapabilityBand(evaluation, policy) {
  const scores = DIMENSION_KEYS.map((key) => evaluation.dimensions[key].score);
  let derived = 'U0';
  for (const band of ['C1', 'C2', 'C3', 'C4']) {
    const minimum = policy.bands[band].minimumDimensionScore;
    if (scores.every((score) => score >= minimum)) derived = band;
  }
  if (evaluation.criticalFailures.length > 0 && BANDS.indexOf(derived) > BANDS.indexOf('C1')) {
    return 'C1';
  }
  return derived;
}

export function allowedTaskClasses(policy, band) {
  if (band === 'U0') return new Set(policy.bands.U0.taskClasses);
  const allowed = new Set();
  for (const candidate of ['C1', 'C2', 'C3', 'C4']) {
    if (BANDS.indexOf(candidate) > BANDS.indexOf(band)) break;
    for (const taskClass of policy.bands[candidate].taskClasses) allowed.add(taskClass);
  }
  return allowed;
}
