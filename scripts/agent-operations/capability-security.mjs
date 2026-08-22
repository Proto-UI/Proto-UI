import { createHash, createPublicKey, verify as verifySignatureBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
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
  requireCondition(policy?.schemaVersion === 1, 'capability policy schemaVersion must be 1');
  requireCondition(
    Array.isArray(policy.dimensions) && policy.dimensions.length === 6,
    'capability policy must define six dimensions'
  );
  requireCondition(
    policy.scoring?.bandMustEqualDerivedBand === true,
    'capability policy must require the derived band'
  );
  requireCondition(
    policy.taskProbe?.rejectAutomaticExternalMutationWithoutGlobalConsumption === true,
    'capability policy must reject automatic external mutation'
  );
  requireCondition(
    policy.runtimeSubjectProof?.requiredForMutationAtOrAbove === 'C2' &&
      policy.runtimeSubjectProof?.externalVerifierAvailable === false &&
      Array.isArray(policy.runtimeSubjectProof?.verificationAdapters) &&
      policy.runtimeSubjectProof.verificationAdapters.length === 0,
    'capability policy must fail closed while runtime subject verification is unavailable'
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
      policy.mutationClasses['tracked-maintenance-state']?.trackedWrite === true,
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
  requireCondition(commitType === 'commit', 'attested baseline does not identify a commit');
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
    challenge.responseContract.selfAssessmentCeiling === 'C1',
    'self-assessment ceiling must be C1'
  );
  requireCondition(
    challenge.responseContract.independentEvaluationRequiredAbove === 'C1',
    'independent evaluation boundary must be C1'
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
  const band = BANDS.indexOf(derived) > BANDS.indexOf('C1') ? 'C1' : derived;
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
      mutationCeiling: 'none',
    },
    trust: {
      status: 'unsigned-self-assessment',
      independentlyEvaluated: false,
      authorizesMutation: false,
      substitutesForTrustedAttestation: false,
    },
    derivedAt: response.submittedAt,
  };
  result.resultDigest = computeSelfAssessmentResultDigest(result);
  return result;
}

function validateRegistry(registry) {
  exactKeys(registry, ['schemaVersion', 'issuers'], [], 'issuer registry');
  requireCondition(registry.schemaVersion === 1, 'issuer registry schemaVersion must be 1');
  requireCondition(Array.isArray(registry.issuers), 'issuer registry issuers must be an array');
  const keyIds = new Set();
  for (const [index, issuer] of registry.issuers.entries()) {
    exactKeys(
      issuer,
      [
        'keyId',
        'purposes',
        'evaluatorIds',
        'publicKeySpkiBase64',
        'status',
        'notBefore',
        'expiresAt',
      ],
      [],
      `issuer[${index}]`
    );
    nonEmptyString(issuer.keyId, `issuer[${index}].keyId`, 120);
    requireCondition(!keyIds.has(issuer.keyId), `duplicate issuer keyId ${issuer.keyId}`);
    keyIds.add(issuer.keyId);
    uniqueStrings(issuer.purposes, `issuer[${index}].purposes`, { min: 1 });
    requireCondition(
      issuer.purposes.every((purpose) =>
        ['capability-attestation', 'task-probe'].includes(purpose)
      ),
      `issuer[${index}] has an invalid purpose`
    );
    uniqueStrings(issuer.evaluatorIds, `issuer[${index}].evaluatorIds`, { min: 1 });
    nonEmptyString(issuer.publicKeySpkiBase64, `issuer[${index}].publicKeySpkiBase64`, 4_096);
    requireCondition(
      ['active', 'revoked'].includes(issuer.status),
      `issuer[${index}].status is invalid`
    );
    const notBefore = parseTimestamp(issuer.notBefore, `issuer[${index}].notBefore`);
    const expiresAt = parseTimestamp(issuer.expiresAt, `issuer[${index}].expiresAt`);
    requireCondition(notBefore < expiresAt, `issuer[${index}] validity is invalid`);
  }
  return registry;
}

export function loadTrustedIssuerRegistry(path) {
  return validateRegistry(readJson(path));
}

function validateSignature(signature, label = 'signature') {
  exactKeys(signature, ['algorithm', 'keyId', 'canonicalization', 'value'], [], label);
  requireCondition(signature.algorithm === 'Ed25519', `${label}.algorithm must be Ed25519`);
  requireCondition(
    signature.canonicalization === 'RFC8785',
    `${label}.canonicalization must be RFC8785`
  );
  requireCondition(/^[A-Za-z0-9._:-]{3,120}$/.test(signature.keyId), `${label}.keyId is invalid`);
  requireCondition(
    /^[A-Za-z0-9+/]{86}==$/.test(signature.value),
    `${label}.value is not an Ed25519 signature`
  );
}

function verifyTrustedSignature(artifact, registry, purpose, evaluatorId, now) {
  validateSignature(artifact.signature);
  const issuer = registry.issuers.find((candidate) => candidate.keyId === artifact.signature.keyId);
  requireCondition(issuer, `untrusted capability issuer: ${artifact.signature.keyId}`);
  requireCondition(issuer.status === 'active', `capability issuer is not active: ${issuer.keyId}`);
  requireCondition(
    issuer.purposes.includes(purpose),
    `issuer ${issuer.keyId} is not trusted for ${purpose}`
  );
  if (evaluatorId !== null) {
    requireCondition(
      issuer.evaluatorIds.includes(evaluatorId),
      `issuer ${issuer.keyId} cannot sign for evaluator ${evaluatorId}`
    );
  }
  requireCondition(
    now >= Date.parse(issuer.notBefore) && now <= Date.parse(issuer.expiresAt),
    `issuer ${issuer.keyId} is outside its validity window`
  );
  let publicKey;
  try {
    publicKey = createPublicKey({
      key: Buffer.from(issuer.publicKeySpkiBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
  } catch {
    fail(`issuer ${issuer.keyId} has an invalid public key`);
  }
  requireCondition(
    publicKey.asymmetricKeyType === 'ed25519',
    `issuer ${issuer.keyId} key is not Ed25519`
  );
  const valid = verifySignatureBytes(
    null,
    Buffer.from(canonicalize(artifact.payload)),
    publicKey,
    Buffer.from(artifact.signature.value, 'base64')
  );
  requireCondition(valid, 'capability artifact signature verification failed');
  return issuer;
}

export function deriveCapabilityBand(evaluation, policy) {
  const scores = DIMENSION_KEYS.map((key) => evaluation.dimensions[key].score);
  let derived = 'U0';
  for (const band of ['C1', 'C2', 'C3', 'C4']) {
    const minimum = policy.bands[band].minimumDimensionScore;
    if (scores.every((score) => score >= minimum)) derived = band;
  }
  if (evaluation.criticalFailures.length > 0 && BANDS.indexOf(derived) > BANDS.indexOf('C1'))
    return 'C1';
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

function validateDimensionScores(evaluation, policy) {
  exactKeys(evaluation.dimensions, DIMENSION_KEYS, [], 'attestation.payload.evaluation.dimensions');
  for (const key of DIMENSION_KEYS) {
    const dimension = evaluation.dimensions[key];
    exactKeys(dimension, ['score', 'evidence'], [], `dimension.${key}`);
    requireCondition(
      Number.isInteger(dimension.score) && dimension.score >= 0 && dimension.score <= 4,
      `dimension.${key}.score is invalid`
    );
    uniqueStrings(dimension.evidence, `dimension.${key}.evidence`, { min: 1 });
  }
  uniqueStrings(evaluation.criticalFailures, 'attestation.payload.evaluation.criticalFailures');
  const allowedFailures = new Set(policy.scoring.criticalFailureCodes);
  for (const failure of evaluation.criticalFailures)
    requireCondition(allowedFailures.has(failure), `unknown critical failure: ${failure}`);
}

export function verifyCapabilityAttestation({
  attestation,
  challenge,
  response,
  registry,
  policy,
  expectedSubject,
  expectedRepositoryId,
  expectedSnapshot,
  expectedGeneratorDigest,
  now = Date.now(),
}) {
  validateChallenge(challenge, { now });
  validateCapabilityResponse(response, challenge);
  exactKeys(attestation, ['payload', 'signature'], [], 'attestation');
  const payload = attestation.payload;
  exactKeys(
    payload,
    [
      'schemaVersion',
      'kind',
      'assessmentId',
      'challenge',
      'subject',
      'scope',
      'evaluation',
      'capability',
      'validity',
    ],
    ['permissionObservation'],
    'attestation.payload'
  );
  requireCondition(payload.schemaVersion === 1, 'attestation schemaVersion must be 1');
  requireCondition(
    payload.kind === 'proto-ui.agent-capability-attestation',
    'attestation kind is invalid'
  );
  requireCondition(
    /^assessment:[a-f0-9]{64}$/.test(payload.assessmentId),
    'assessmentId is invalid'
  );

  exactKeys(
    payload.challenge,
    ['challengeId', 'challengeDigest', 'nonceDigest', 'responseDigest'],
    [],
    'attestation.payload.challenge'
  );
  requireCondition(
    payload.challenge.challengeId === challenge.challengeId,
    'attestation challengeId mismatch'
  );
  requireCondition(
    payload.challenge.challengeDigest === challenge.challengeDigest,
    'attestation challenge digest mismatch'
  );
  requireCondition(
    payload.challenge.nonceDigest === challenge.scope.nonceDigest,
    'attestation challenge nonce mismatch'
  );
  requireCondition(
    payload.challenge.responseDigest === digestJson(response),
    'attestation response digest mismatch'
  );

  exactKeys(
    payload.subject,
    ['agentKeyFingerprint', 'runtimeAttestation'],
    ['modelClaim'],
    'attestation.payload.subject'
  );
  requireCondition(
    FINGERPRINT.test(payload.subject.agentKeyFingerprint),
    'attestation subject fingerprint is invalid'
  );
  requireCondition(
    payload.subject.agentKeyFingerprint === challenge.subject.agentKeyFingerprint,
    'attestation subject does not match challenge'
  );
  if (expectedSubject)
    requireCondition(
      payload.subject.agentKeyFingerprint === expectedSubject,
      'attestation subject does not match current Agent'
    );
  requireCondition(
    isObject(payload.subject.runtimeAttestation),
    'attestation runtime subject proof state is required'
  );
  const runtime = payload.subject.runtimeAttestation;
  requireCondition(
    ['unavailable', 'verified'].includes(runtime.status),
    'attestation runtime subject proof status is invalid'
  );
  if (runtime.status === 'unavailable') {
    exactKeys(runtime, ['status'], [], 'attestation runtime subject proof');
  } else {
    exactKeys(
      runtime,
      ['status', 'provider', 'proofDigest', 'verifiedAt', 'expiresAt'],
      [],
      'attestation runtime subject proof'
    );
    nonEmptyString(runtime.provider, 'attestation runtime subject proof provider', 120);
    requireCondition(HEX64.test(runtime.proofDigest), 'runtime subject proof digest is invalid');
    const runtimeVerifiedAt = parseTimestamp(
      runtime.verifiedAt,
      'runtime subject proof verifiedAt'
    );
    const runtimeExpiresAt = parseTimestamp(runtime.expiresAt, 'runtime subject proof expiresAt');
    requireCondition(
      runtimeVerifiedAt < runtimeExpiresAt,
      'runtime subject proof expiry must follow verification'
    );
  }

  exactKeys(
    payload.scope,
    [
      'repositoryId',
      'snapshotMode',
      'baseSha',
      'treeSha',
      'worktreeDigest',
      'catalogDigest',
      'policyDigest',
      'generatorDigest',
    ],
    [],
    'attestation.payload.scope'
  );
  requireCondition(
    challenge.scope.assessmentMode === 'independent',
    'trusted attestation requires an independent challenge'
  );
  requireCondition(
    payload.scope.snapshotMode === 'committed-clean',
    'trusted attestation requires a clean committed snapshot'
  );
  const scopeKeys = [
    'repositoryId',
    'snapshotMode',
    'baseSha',
    'treeSha',
    'worktreeDigest',
    'catalogDigest',
    'policyDigest',
    'generatorDigest',
  ];
  for (const key of scopeKeys)
    requireCondition(
      payload.scope[key] === challenge.scope[key],
      `attestation scope mismatch: ${key}`
    );
  if (expectedRepositoryId)
    requireCondition(
      payload.scope.repositoryId === expectedRepositoryId,
      'attestation repository mismatch'
    );
  requireCondition(
    payload.scope.policyDigest === policy.__digest,
    'attestation policy digest does not match the verifier policy'
  );
  if (expectedGeneratorDigest) {
    requireCondition(
      payload.scope.generatorDigest === expectedGeneratorDigest,
      'attestation generator digest is stale'
    );
  }
  if (expectedSnapshot) {
    for (const key of [
      'repositoryId',
      'snapshotMode',
      'baseSha',
      'treeSha',
      'worktreeDigest',
      'catalogDigest',
      'policyDigest',
      'generatorDigest',
    ]) {
      requireCondition(
        payload.scope[key] === expectedSnapshot[key],
        `current repository snapshot mismatch: ${key}`
      );
    }
  }

  exactKeys(
    payload.evaluation,
    [
      'evaluatorId',
      'evaluatorVersion',
      'rubricVersion',
      'method',
      'dimensions',
      'criticalFailures',
    ],
    [],
    'attestation.payload.evaluation'
  );
  nonEmptyString(payload.evaluation.evaluatorId, 'evaluation.evaluatorId', 200);
  nonEmptyString(payload.evaluation.evaluatorVersion, 'evaluation.evaluatorVersion', 100);
  nonEmptyString(payload.evaluation.rubricVersion, 'evaluation.rubricVersion', 100);
  requireCondition(
    ['independent-agent', 'human-reviewed', 'hybrid'].includes(payload.evaluation.method),
    'evaluation method is invalid'
  );
  validateDimensionScores(payload.evaluation, policy);

  exactKeys(
    payload.capability,
    ['band', 'eligibleTaskClasses', 'forbiddenActionClasses'],
    ['limitations'],
    'attestation.payload.capability'
  );
  requireCondition(
    ['C1', 'C2', 'C3', 'C4'].includes(payload.capability.band),
    'attestation band is invalid'
  );
  const derivedBand = deriveCapabilityBand(payload.evaluation, policy);
  requireCondition(derivedBand !== 'U0', 'dimension scores do not qualify for C1');
  requireCondition(
    payload.capability.band === derivedBand,
    `claimed band ${payload.capability.band} does not match derived band ${derivedBand}`
  );
  uniqueStrings(payload.capability.eligibleTaskClasses, 'capability.eligibleTaskClasses');
  const allowedTasks = allowedTaskClasses(policy, derivedBand);
  for (const taskClass of payload.capability.eligibleTaskClasses)
    requireCondition(
      allowedTasks.has(taskClass),
      `task class ${taskClass} exceeds band ${derivedBand}`
    );
  uniqueStrings(payload.capability.forbiddenActionClasses, 'capability.forbiddenActionClasses', {
    min: policy.alwaysHuman.length,
  });
  requireCondition(
    policy.alwaysHuman.every((action) =>
      payload.capability.forbiddenActionClasses.includes(action)
    ) &&
      payload.capability.forbiddenActionClasses.every((action) =>
        policy.alwaysHuman.includes(action)
      ),
    'forbiddenActionClasses must exactly preserve all always-human gates'
  );

  exactKeys(
    payload.validity,
    ['issuedAt', 'notBefore', 'expiresAt', 'invalidationTriggers'],
    [],
    'attestation.payload.validity'
  );
  const issuedAt = parseTimestamp(payload.validity.issuedAt, 'attestation.validity.issuedAt');
  const notBefore = parseTimestamp(payload.validity.notBefore, 'attestation.validity.notBefore');
  const expiresAt = parseTimestamp(payload.validity.expiresAt, 'attestation.validity.expiresAt');
  requireCondition(
    issuedAt <= notBefore && notBefore < expiresAt,
    'attestation validity order is invalid'
  );
  requireCondition(now >= notBefore && now <= expiresAt, 'attestation is not currently valid');
  requireCondition(
    issuedAt >= Date.parse(challenge.validity.issuedAt) &&
      issuedAt <= Date.parse(challenge.validity.expiresAt),
    'attestation was not issued during the challenge validity window'
  );
  uniqueStrings(payload.validity.invalidationTriggers, 'attestation.validity.invalidationTriggers');
  requireCondition(
    policy.attestation.invalidateOn.every((trigger) =>
      payload.validity.invalidationTriggers.includes(trigger)
    ),
    'attestation omits mandatory invalidation triggers'
  );

  const issuer = verifyTrustedSignature(
    attestation,
    registry,
    'capability-attestation',
    payload.evaluation.evaluatorId,
    now
  );
  return {
    band: derivedBand,
    eligibleTaskClasses: new Set(payload.capability.eligibleTaskClasses),
    assessmentId: payload.assessmentId,
    attestationDigest: digestJson(attestation),
    subject: payload.subject.agentKeyFingerprint,
    runtimeSubjectProof: payload.subject.runtimeAttestation,
    scopeBaseSha: payload.scope.baseSha,
    issuerKeyId: issuer.keyId,
  };
}

const MUTATION_OPERATIONS = new Set([
  'create',
  'modify',
  'delete',
  'rename',
  'external-github-metadata',
  'tracked-maintenance-state',
]);

function normalizeScopedPath(path, label) {
  nonEmptyString(path, label, 500);
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '');
  requireCondition(
    !normalized.startsWith('/') && !/^[A-Za-z]:/.test(normalized),
    `${label} must be repository-relative`
  );
  requireCondition(
    !normalized.split('/').includes('..'),
    `${label} must not escape the repository`
  );
  return normalized;
}

export function validateMutationScope(scope) {
  exactKeys(
    scope,
    [
      'authorityAnchors',
      'acceptance',
      'exclusions',
      'affectedSurfaces',
      'allowedPaths',
      'allowedOperations',
      'evidence',
      'stopConditions',
      'humanGates',
      'ownershipDigest',
      'linkedWorkDigest',
    ],
    [],
    'task probe scope'
  );
  for (const key of [
    'authorityAnchors',
    'acceptance',
    'exclusions',
    'affectedSurfaces',
    'evidence',
    'stopConditions',
  ]) {
    uniqueStrings(scope[key], `task probe scope.${key}`, { min: 1 });
  }
  uniqueStrings(scope.humanGates, 'task probe scope.humanGates');
  requireCondition(
    Array.isArray(scope.allowedPaths) && scope.allowedPaths.length > 0,
    'task probe scope.allowedPaths must not be empty'
  );
  const pathKeys = new Set();
  for (const [index, entry] of scope.allowedPaths.entries()) {
    exactKeys(entry, ['path', 'mode'], [], `task probe scope.allowedPaths[${index}]`);
    const normalized = normalizeScopedPath(
      entry.path,
      `task probe scope.allowedPaths[${index}].path`
    );
    requireCondition(
      ['exact', 'tree'].includes(entry.mode),
      `task probe scope.allowedPaths[${index}].mode is invalid`
    );
    const key = `${entry.mode}:${normalized}`;
    requireCondition(
      !pathKeys.has(key),
      'task probe scope.allowedPaths must not contain duplicates'
    );
    pathKeys.add(key);
  }
  uniqueStrings(scope.allowedOperations, 'task probe scope.allowedOperations', { min: 1 });
  for (const operation of scope.allowedOperations)
    requireCondition(MUTATION_OPERATIONS.has(operation), `unknown allowed operation: ${operation}`);
  requireCondition(
    HEX64.test(scope.ownershipDigest),
    'task probe scope ownershipDigest is invalid'
  );
  requireCondition(
    HEX64.test(scope.linkedWorkDigest),
    'task probe scope linkedWorkDigest is invalid'
  );
  return scope;
}

function scopedPathAllows(entries, actualPath) {
  const path = normalizeScopedPath(actualPath, 'postflight changed path');
  return entries.some((entry) => {
    const allowed = normalizeScopedPath(entry.path, 'task probe allowed path');
    return entry.mode === 'exact'
      ? path === allowed
      : path === allowed || path.startsWith(`${allowed}/`);
  });
}

export function verifyTaskPostflight({ probe, changedPaths, operations }) {
  const scope = validateMutationScope(probe?.payload?.scope);
  uniqueStrings(changedPaths, 'postflight changedPaths');
  uniqueStrings(operations, 'postflight operations');
  for (const path of changedPaths)
    requireCondition(
      scopedPathAllows(scope.allowedPaths, path),
      `postflight path is outside probe scope: ${path}`
    );
  for (const operation of operations)
    requireCondition(
      scope.allowedOperations.includes(operation),
      `postflight operation is outside probe scope: ${operation}`
    );
  return { valid: true, changedPaths: [...changedPaths], operations: [...operations] };
}

export function verifyTaskProbe({
  probe,
  verifiedAttestation,
  registry,
  policy,
  expected,
  leaf,
  verifiedRuntimeSubject,
  consumeDirectory,
  now = Date.now(),
}) {
  exactKeys(probe, ['payload', 'signature'], [], 'task probe');
  const payload = probe.payload;
  exactKeys(
    payload,
    [
      'schemaVersion',
      'kind',
      'probeId',
      'subject',
      'repository',
      'task',
      'scope',
      'authorization',
      'validity',
    ],
    [],
    'task probe payload'
  );
  requireCondition(payload.schemaVersion === 1, 'task probe schemaVersion must be 1');
  requireCondition(payload.kind === 'proto-ui.agent-task-probe', 'task probe kind is invalid');
  requireCondition(/^probe:[a-f0-9]{64}$/.test(payload.probeId), 'task probe ID is invalid');
  exactKeys(payload.subject, ['agentKeyFingerprint'], [], 'task probe subject');
  requireCondition(
    payload.subject.agentKeyFingerprint === verifiedAttestation.subject,
    'task probe subject mismatch'
  );

  exactKeys(
    payload.repository,
    [
      'repositoryId',
      'baseSha',
      'headSha',
      'treeSha',
      'worktreeDigest',
      'diffDigest',
      'entityGraphDigest',
    ],
    [],
    'task probe repository'
  );
  requireCondition(
    REPOSITORY_ID.test(payload.repository.repositoryId),
    'task probe repositoryId is invalid'
  );
  for (const key of ['baseSha', 'headSha', 'treeSha'])
    requireCondition(GIT_SHA.test(payload.repository[key]), `task probe ${key} is invalid`);
  for (const key of ['worktreeDigest', 'diffDigest', 'entityGraphDigest'])
    requireCondition(HEX64.test(payload.repository[key]), `task probe ${key} is invalid`);

  exactKeys(
    payload.task,
    ['taskId', 'updatedAt', 'leafId', 'taskClass', 'mutation', 'risk', 'executionMode'],
    [],
    'task probe task'
  );
  nonEmptyString(payload.task.taskId, 'task probe taskId', 240);
  parseTimestamp(payload.task.updatedAt, 'task probe task.updatedAt');
  nonEmptyString(payload.task.leafId, 'task probe leafId', 120);
  nonEmptyString(payload.task.mutation, 'task probe mutation', 120);
  requireCondition(
    ['low', 'medium', 'high'].includes(payload.task.risk),
    'task probe risk is invalid'
  );
  requireCondition(
    ['automatic', 'attended-human'].includes(payload.task.executionMode),
    'task probe executionMode is invalid'
  );
  validateMutationScope(payload.scope);
  requireCondition(isObject(leaf), 'task probe verification requires a registry leaf');
  requireCondition(
    payload.task.leafId === leaf.id,
    'task probe leaf does not match the selected registry leaf'
  );
  requireCondition(
    payload.task.taskClass === leaf.taskClass,
    'task probe task class does not match the selected leaf'
  );
  requireCondition(
    payload.task.mutation === leaf.mutation,
    'task probe mutation does not match the selected leaf'
  );
  if (leaf.mutation === 'reversible-github-metadata') {
    requireCondition(
      payload.scope.allowedOperations.includes('external-github-metadata'),
      'GitHub metadata mutation must declare external-github-metadata in scope'
    );
  }
  if (
    payload.task.executionMode === 'automatic' &&
    (leaf.mutation === 'reversible-github-metadata' ||
      payload.scope.allowedOperations.includes('external-github-metadata'))
  ) {
    fail('automatic external mutation is unavailable without a global atomic consumption service');
  }
  requireCondition(
    BANDS.indexOf(verifiedAttestation.band) >= BANDS.indexOf(leaf.minimumBand),
    `attestation band does not meet ${leaf.id} minimumBand`
  );
  requireCondition(
    verifiedAttestation.eligibleTaskClasses.has(payload.task.taskClass),
    `task class ${payload.task.taskClass} is not authorized by the attestation`
  );
  requireCondition(
    policy.runtimeSubjectProof.externalVerifierAvailable === true,
    'runtime subject proof verification is unavailable; C2+ mutation is denied'
  );
  requireCondition(
    verifiedAttestation.runtimeSubjectProof?.status === 'verified',
    'attestation does not contain a verified runtime subject proof'
  );
  requireCondition(
    verifiedRuntimeSubject?.verified === true &&
      verifiedRuntimeSubject.subject === verifiedAttestation.subject &&
      verifiedRuntimeSubject.provider === verifiedAttestation.runtimeSubjectProof.provider &&
      verifiedRuntimeSubject.proofDigest === verifiedAttestation.runtimeSubjectProof.proofDigest,
    'current runtime subject proof is unavailable or does not match the attestation'
  );
  requireCondition(
    now <= Date.parse(verifiedAttestation.runtimeSubjectProof.expiresAt),
    'runtime subject proof has expired'
  );

  exactKeys(
    payload.authorization,
    [
      'capabilityAssessmentId',
      'capabilityAttestationDigest',
      'permissionSnapshotDigest',
      'humanAuthorizationDigest',
    ],
    [],
    'task probe authorization'
  );
  requireCondition(
    payload.authorization.capabilityAssessmentId === verifiedAttestation.assessmentId,
    'task probe assessment mismatch'
  );
  requireCondition(
    payload.authorization.capabilityAttestationDigest === verifiedAttestation.attestationDigest,
    'task probe attestation digest mismatch'
  );
  requireCondition(
    payload.repository.baseSha === verifiedAttestation.scopeBaseSha,
    'task probe baseSha does not match the attested repository baseline'
  );

  exactKeys(
    payload.validity,
    ['issuedAt', 'notBefore', 'expiresAt', 'singleUse'],
    [],
    'task probe validity'
  );
  requireCondition(payload.validity.singleUse === true, 'task probe must be single-use');
  const issuedAt = parseTimestamp(payload.validity.issuedAt, 'task probe issuedAt');
  const notBefore = parseTimestamp(payload.validity.notBefore, 'task probe notBefore');
  const expiresAt = parseTimestamp(payload.validity.expiresAt, 'task probe expiresAt');
  requireCondition(
    issuedAt <= notBefore && notBefore < expiresAt,
    'task probe validity order is invalid'
  );
  requireCondition(now >= notBefore && now <= expiresAt, 'task probe is not currently valid');

  const expectedPairs = [
    ['taskId', payload.task.taskId],
    ['taskUpdatedAt', payload.task.updatedAt],
    ['leafId', payload.task.leafId],
    ['taskClass', payload.task.taskClass],
    ['mutation', payload.task.mutation],
    ['scopeDigest', digestJson(payload.scope)],
    ['repositoryId', payload.repository.repositoryId],
    ['baseSha', payload.repository.baseSha],
    ['headSha', payload.repository.headSha],
    ['treeSha', payload.repository.treeSha],
    ['worktreeDigest', payload.repository.worktreeDigest],
    ['diffDigest', payload.repository.diffDigest],
    ['entityGraphDigest', payload.repository.entityGraphDigest],
    ['permissionSnapshotDigest', payload.authorization.permissionSnapshotDigest],
    ['humanAuthorizationDigest', payload.authorization.humanAuthorizationDigest],
  ];
  for (const [key, actual] of expectedPairs)
    requireCondition(expected?.[key] === actual, `task probe live binding mismatch: ${key}`);

  verifyTrustedSignature(probe, registry, 'task-probe', null, now);
  requireCondition(
    typeof consumeDirectory === 'string' && consumeDirectory.length > 0,
    'task probe verification requires an atomic local consume directory'
  );
  mkdirSync(consumeDirectory, { recursive: true });
  const consumptionPath = join(consumeDirectory, `${payload.probeId.slice('probe:'.length)}.json`);
  let descriptor;
  try {
    descriptor = openSync(consumptionPath, 'wx');
    writeFileSync(
      descriptor,
      `${JSON.stringify({
        probeId: payload.probeId,
        consumedAt: new Date(now).toISOString(),
        taskId: payload.task.taskId,
        leafId: payload.task.leafId,
        scopeDigest: digestJson(payload.scope),
      })}\n`
    );
  } catch (error) {
    if (error?.code === 'EEXIST') fail(`task probe replay detected: ${payload.probeId}`);
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return {
    probeId: payload.probeId,
    leafId: payload.task.leafId,
    scopeDigest: digestJson(payload.scope),
    consumedAt: new Date(now).toISOString(),
    consumptionPath,
  };
}

export function repositoryRelative(root, path) {
  return relative(root, path).replaceAll('\\', '/');
}

export function ensureParentDirectory(path) {
  mkdirSync(dirname(path), { recursive: true });
}
