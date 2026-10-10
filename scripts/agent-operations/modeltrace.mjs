import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export const MODELTRACE_POLICY = 'proto-ui.modeltrace.2026-10-04.1';
export const MODELTRACE_REVISION = 'd4131b30243dfa05e70180b5eedde742103f1d73';
const BANK_DIGEST = 'e514c76928ea38d23bc0f14d3935f23c97b1efb6d96b18a19bdc88ad2d830536';
const SCORER_DIGEST = '83fa5bd611e18f8339122582335123c8ea168ed242298bb31f4e363abeeb6e4a';
const scorerBytes = fs.readFileSync(
  new URL('./vendor/modeltrace/fingerprint-core.mjs', import.meta.url)
);
assert(
  createHash('sha256').update(scorerBytes).digest('hex') === SCORER_DIGEST,
  'pinned scorer checksum changed; reviewed update and remeasurement required'
);
// Evaluate these verified bytes, not a pathname that can be replaced after verification.
const { analyzeGlobalOutputs } = await import(
  `data:text/javascript;base64,${scorerBytes.toString('base64')}`
);
const HEX = /^[a-f0-9]{64}$/;
const REPOSITORY = /^github\.com:[^/\s]+\/[^/\s]+$/;
const LABEL = /^[a-zA-Z0-9][a-zA-Z0-9._/+-]{0,119}$/;
const COUNTS = [218, 233, 247];
const HOUR = 60 * 60 * 1000;
const SHORT_TTL = 15 * 60 * 1000;
const METHODS = ['active-model-literals', 'same-context-native-forks'];
const DECLARATION_ANOMALIES = [
  'system-label-mismatch',
  'harness-label-mismatch',
  'declaration-conflict',
  'declared-model-not-in-bank',
  'system-label-unavailable',
  'harness-label-unavailable',
];
const ANOMALIES = [
  'context-uncalibrated',
  'unknown-model-not-excluded',
  'ambiguous-candidates',
  ...DECLARATION_ANOMALIES,
  'retest-inconsistent',
  'probe-failed',
  'sample-validation-failed',
  'count-deviation',
];
const SHORT_TTL_ANOMALIES = new Set([
  'ambiguous-candidates',
  'system-label-mismatch',
  'harness-label-mismatch',
  'declaration-conflict',
  'retest-inconsistent',
  'probe-failed',
  'sample-validation-failed',
]);
const TEMPLATES = [
  'For each of {count} positions, make one separate first-instinct choice of an integer from 1 to 355 inclusive.',
  'Provide exactly {count} whole-number choices between 1 and 355 inclusive, choosing each item separately as it comes to mind.',
  'Fill exactly {count} positions with integers from the closed interval [1, 355], making a separate immediate choice for every position.',
];
const DIRECT =
  ' The current language model must complete this directly without tools, Python, code execution, calculators, search, APIs, or external random generators. Choose every position separately. Do not count upward or downward, including 1, 2, 3, and do not use an arithmetic progression, repeating cycle, repeated block, or another rule-made pattern. Accidental repetitions are valid. Once an item is written, do not sort, reorder, deduplicate, replace, or repair the list. Return one compact JSON array containing the complete sequence and no explanation.';

function assert(condition, message) {
  if (!condition) throw new Error(`ModelTrace: ${message}`);
}

function isHex(value) {
  return typeof value === 'string' && HEX.test(value);
}

function isRepository(value) {
  return typeof value === 'string' && REPOSITORY.test(value);
}

function exact(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  assert(
    isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort()),
    `${label} has unexpected or missing fields`
  );
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash('sha256')
    .update(typeof value === 'string' ? value : canonical(value))
    .digest('hex');
}

function time(value, label) {
  assert(
    typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value),
    `${label} must be UTC RFC3339`
  );
  const ms = Date.parse(value);
  assert(
    Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 19) === value.slice(0, 19),
    `${label} is invalid`
  );
  return ms;
}

function labels(value) {
  exact(value, ['systemModel', 'harnessModel'], 'declared labels');
  for (const label of Object.values(value))
    assert(
      label === null || (typeof label === 'string' && LABEL.test(label)),
      'declared model must be a public model label, not prose or credentials'
    );
}

function normalizedLabel(value) {
  return value?.toLowerCase().split('/').at(-1) ?? null;
}

function declarationAnomalies(declared, result, reference, anomalies = new Set()) {
  for (const [key, label] of Object.entries(declared)) {
    const model = normalizedLabel(label);
    if (model === null)
      anomalies.add(
        key === 'systemModel' ? 'system-label-unavailable' : 'harness-label-unavailable'
      );
    else {
      if (!reference.models.some((item) => item.id === model))
        anomalies.add('declared-model-not-in-bank');
      if (result.modelId !== null && model !== result.modelId)
        anomalies.add(key === 'systemModel' ? 'system-label-mismatch' : 'harness-label-mismatch');
    }
  }
  if (
    declared.systemModel !== null &&
    declared.harnessModel !== null &&
    normalizedLabel(declared.systemModel) !== normalizedLabel(declared.harnessModel)
  )
    anomalies.add('declaration-conflict');
  return anomalies;
}

export function validateModelTraceContext(context, { fresh = false } = {}) {
  exact(
    context,
    [
      'schemaVersion',
      'kind',
      'repositoryId',
      'sessionId',
      'contextDigest',
      'routeDigest',
      'declared',
    ],
    'context'
  );
  assert(
    context.schemaVersion === 1 && context.kind === 'proto-ui.modeltrace-context',
    'invalid context version/kind'
  );
  assert(isRepository(context.repositoryId), 'invalid context repository');
  assert(
    typeof context.sessionId === 'string' &&
      context.sessionId.length > 0 &&
      context.sessionId.length <= 200,
    'invalid private session ID'
  );
  if (fresh) {
    // Shape cannot prove entropy: the operator/runtime must generate this alias
    // with cryptographic randomness, not encode a descriptive session name.
    assert(
      /^[a-f0-9]{64}$/i.test(context.sessionId) ||
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
          context.sessionId
        ),
      'fresh admission requires a cryptographically random opaque 32-byte hex session alias or UUIDv4'
    );
  }
  assert(
    isHex(context.contextDigest) && isHex(context.routeDigest),
    'invalid context/route digest'
  );
  labels(context.declared);
  return context;
}

let bank;
let verifiedFiles;
function loadBank() {
  const bankPath = new URL('./vendor/modeltrace/unified_bank.json', import.meta.url);
  const scorerPath = new URL('./vendor/modeltrace/fingerprint-core.mjs', import.meta.url);
  const stamp = (file) => {
    const stat = fs.statSync(file, { bigint: true });
    return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
  };
  const files = `${stamp(bankPath)}|${stamp(scorerPath)}`;
  if (bank && verifiedFiles === files) return bank;
  const bytes = fs.readFileSync(bankPath);
  const scorer = fs.readFileSync(scorerPath);
  assert(
    createHash('sha256').update(bytes).digest('hex') === BANK_DIGEST,
    'pinned bank checksum changed; reviewed update and remeasurement required'
  );
  assert(
    createHash('sha256').update(scorer).digest('hex') === SCORER_DIGEST,
    'pinned scorer checksum changed; reviewed update and remeasurement required'
  );
  assert(
    files === `${stamp(bankPath)}|${stamp(scorerPath)}`,
    'scoring artifacts changed while reading; retry only after a reviewed source update'
  );
  bank = JSON.parse(bytes.toString('utf8'));
  verifiedFiles = files;
  return bank;
}

function source(challengeDigest) {
  return {
    repository: 'https://github.com/xqy2006/ModelTrace',
    revision: MODELTRACE_REVISION,
    bankDigest: BANK_DIGEST,
    scorerDigest: SCORER_DIGEST,
    challengeDigest,
    policyVersion: MODELTRACE_POLICY,
  };
}

function probes() {
  return COUNTS.map((count, index) => ({
    id: `query-0${index + 1}`,
    count,
    prompt: TEMPLATES[index].replace('{count}', String(count)) + DIRECT,
  }));
}

export function createModelTraceChallenge(context, { now = new Date() } = {}) {
  validateModelTraceContext(context, { fresh: true });
  loadBank();
  return {
    schemaVersion: 1,
    kind: 'proto-ui.modeltrace-challenge',
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    nonce: randomBytes(24).toString('hex'),
    context: structuredClone(context),
    source: source(null),
    probes: probes(),
  };
}

export function computeModelTraceChallengeDigest(challenge) {
  return hash(challenge);
}

function validateChallenge(challenge) {
  exact(
    challenge,
    ['schemaVersion', 'kind', 'issuedAt', 'expiresAt', 'nonce', 'context', 'source', 'probes'],
    'challenge'
  );
  assert(
    challenge.schemaVersion === 1 && challenge.kind === 'proto-ui.modeltrace-challenge',
    'invalid challenge version/kind'
  );
  const start = time(challenge.issuedAt, 'challenge issuedAt');
  assert(
    time(challenge.expiresAt, 'challenge expiresAt') === start + 10 * 60 * 1000,
    'challenge expiry must be ten minutes'
  );
  assert(
    typeof challenge.nonce === 'string' && /^[a-f0-9]{48}$/.test(challenge.nonce),
    'invalid challenge nonce'
  );
  validateModelTraceContext(challenge.context);
  assert(
    isDeepStrictEqual(challenge.source, source(null)),
    'challenge uses another bank/scorer/policy; remeasure'
  );
  assert(
    isDeepStrictEqual(challenge.probes, probes()),
    'challenge prompts changed; remeasure without rewriting the challenge'
  );
  return challenge;
}

function withinSampleCountBounds(count, expectedCount) {
  return (
    count >= Math.max(80, Math.ceil(expectedCount * 0.55)) &&
    count <= Math.ceil(expectedCount * 1.25)
  );
}

// Do not use the upstream permissive parseNumbers for validation: extracting
// integers from prose, decimals or damaged JSON changes the measured sample.
export function validateModelTraceSample(raw, expectedCount) {
  assert(
    typeof raw === 'string' && raw.length > 0 && raw.length <= 5000,
    'sample must be a bounded literal array'
  );
  let text = raw.trim();
  if (text.startsWith('```')) {
    const fence = text.match(/^```(?:json)?\s*\n(\[[\s\S]*\])\s*\n```$/);
    assert(fence, 'sample must be one complete JSON or unlabelled fenced array');
    text = fence[1];
  }
  assert(
    /^\[\s*(?:\d+\s*(?:,\s*\d+\s*)*)?\]$/.test(text),
    'sample must contain only literal integers, without prose, expressions or repair'
  );
  const numbers = JSON.parse(text);
  assert(
    numbers.every((n) => Number.isSafeInteger(n) && n >= 1 && n <= 355),
    'sample integer outside 1..355'
  );
  assert(
    withinSampleCountBounds(numbers.length, expectedCount),
    'sample count outside upstream tolerance'
  );
  return numbers;
}

function validateResponse(response, challenge) {
  exact(
    response,
    ['schemaVersion', 'kind', 'challengeDigest', 'startedAt', 'completedAt', 'method', 'outputs'],
    'response'
  );
  assert(
    response.schemaVersion === 1 && response.kind === 'proto-ui.modeltrace-response',
    'invalid response version/kind'
  );
  assert(response.challengeDigest === hash(challenge), 'response does not bind this challenge');
  const start = time(response.startedAt, 'response startedAt');
  const end = time(response.completedAt, 'response completedAt');
  assert(
    start >= time(challenge.issuedAt, 'challenge issuedAt') &&
      end >= start &&
      end <= time(challenge.expiresAt, 'challenge expiresAt'),
    'response outside challenge time window; remeasure, do not repair timestamps'
  );
  assert(
    METHODS.includes(response.method),
    'unsupported sampler; generic subagent/fresh API output is not active-model self-measurement'
  );
  assert(
    Array.isArray(response.outputs) && response.outputs.length === 3,
    'all three attempted probes must be retained'
  );
  for (const [index, output] of response.outputs.entries()) {
    exact(output, ['id', 'text', 'error'], 'probe output');
    assert(output.id === challenge.probes[index].id, 'probe order/identity changed');
    assert(
      output.error === null ||
        ['unavailable', 'timeout', 'refused', 'tool-conflict'].includes(output.error),
      'unsupported probe failure code'
    );
    assert(
      output.error === null
        ? typeof output.text === 'string' && output.text.length <= 5000
        : output.text === null,
      'failed probe must retain its diagnostic without fabricated output'
    );
  }
}

export function computeModelTraceReceiptDigest(receipt) {
  const { id: _id, ...content } = receipt;
  return hash(content);
}

function assertModelTraceScope(receipt, context, repositoryId = context.repositoryId) {
  // Compare GitHub owner/repo casing without changing any content-bound artifact.
  const repository = isRepository(repositoryId) ? repositoryId.toLowerCase() : null;
  assert(
    repository !== null &&
      receipt.scope.repositoryId.toLowerCase() === repository &&
      context.repositoryId.toLowerCase() === repository &&
      receipt.scope.sessionDigest === hash(context.sessionId) &&
      receipt.scope.contextDigest === context.contextDigest &&
      receipt.scope.routeDigest === context.routeDigest,
    'repository/session/context/provider route changed; repeat all three probes'
  );
  assert(
    isDeepStrictEqual(receipt.declared, context.declared),
    'declared system/harness labels changed; repeat all three probes'
  );
}

export function buildModelTraceRecord(challenge, response, { previous = null } = {}) {
  validateChallenge(challenge);
  validateResponse(response, challenge);
  if (previous !== null) {
    validateModelTraceReceipt(previous);
    assertModelTraceScope(previous, challenge.context);
    assert(
      time(previous.measuredAt, 'prior measuredAt') <=
        time(response.startedAt, 'response startedAt'),
      'prior measurement occurs after the current response started'
    );
  }
  const reference = loadBank();
  const anomalies = new Set(['context-uncalibrated', 'unknown-model-not-excluded']);
  const counts = [];
  const sampleDigests = [];
  const valid = [];
  for (const [index, output] of response.outputs.entries()) {
    sampleDigests.push(output.text === null ? null : hash(output.text));
    if (output.error !== null) {
      anomalies.add('probe-failed');
      counts.push(null);
      continue;
    }
    try {
      const numbers = validateModelTraceSample(output.text, COUNTS[index]);
      counts.push(numbers.length);
      if (numbers.length !== COUNTS[index]) anomalies.add('count-deviation');
      valid.push({ text: JSON.stringify(numbers), expected_count: COUNTS[index] });
    } catch {
      counts.push(null);
      anomalies.add('sample-validation-failed');
    }
  }
  let result = {
    status: 'failed',
    modelId: null,
    familyId: null,
    probability: null,
    margin: null,
    candidates: [],
  };
  if (valid.length === 3) {
    const scored = analyzeGlobalOutputs(valid, reference);
    const candidates = scored.results.slice(0, 3).map((item) => ({
      modelId: item.model,
      familyId: item.family,
      probability: item.probability,
      score: item.score,
    }));
    assert(
      candidates.every((item) => Number.isFinite(item.probability) && Number.isFinite(item.score)),
      'scorer produced non-finite output'
    );
    const margin = candidates[0].probability - candidates[1].probability;
    // These are conservative disclosure thresholds, NOT calibrated confidence
    // that the active backend is this model, and NOT an open-set detector.
    const ambiguous = candidates[0].probability < 0.8 || margin < 0.2;
    if (ambiguous) anomalies.add('ambiguous-candidates');
    result = {
      status: ambiguous ? 'ambiguous' : 'candidate',
      modelId: ambiguous ? null : candidates[0].modelId,
      familyId: ambiguous ? null : candidates[0].familyId,
      probability: candidates[0].probability,
      margin,
      candidates,
    };
  }
  const declared = structuredClone(challenge.context.declared);
  declarationAnomalies(declared, result, reference, anomalies);
  if (
    previous?.result.modelId !== null &&
    previous?.result.modelId !== undefined &&
    result.modelId !== null &&
    previous.result.modelId !== result.modelId
  )
    anomalies.add('retest-inconsistent');
  const ttl = [...anomalies].some((code) => SHORT_TTL_ANOMALIES.has(code)) ? SHORT_TTL : HOUR;
  const receipt = {
    schemaVersion: 1,
    kind: 'proto-ui.modeltrace-receipt',
    id: '',
    measuredAt: response.completedAt,
    expiresAt: new Date(Date.parse(response.completedAt) + ttl).toISOString(),
    scope: {
      repositoryId: challenge.context.repositoryId,
      sessionDigest: hash(challenge.context.sessionId),
      contextDigest: challenge.context.contextDigest,
      routeDigest: challenge.context.routeDigest,
    },
    source: source(hash(challenge)),
    sampling: {
      method: response.method,
      queries: 3,
      counts,
      sampleDigests,
      contextCalibrated: false,
    },
    result,
    declared,
    anomalies: [...anomalies].sort(),
    priorReceiptDigest: previous === null ? null : computeModelTraceReceiptDigest(previous),
    trust: {
      signed: false,
      backendAuthenticated: false,
      grantsPermission: false,
      unknownModelDetectable: false,
    },
  };
  receipt.id = `sha256:${computeModelTraceReceiptDigest(receipt)}`;
  validateModelTraceReceipt(receipt);
  return {
    schemaVersion: 1,
    kind: 'proto-ui.modeltrace-record',
    challenge,
    response,
    previous,
    receipt,
  };
}

export function validateModelTraceReceipt(receipt) {
  exact(
    receipt,
    [
      'schemaVersion',
      'kind',
      'id',
      'measuredAt',
      'expiresAt',
      'scope',
      'source',
      'sampling',
      'result',
      'declared',
      'anomalies',
      'priorReceiptDigest',
      'trust',
    ],
    'receipt'
  );
  assert(
    receipt.schemaVersion === 1 && receipt.kind === 'proto-ui.modeltrace-receipt',
    'invalid receipt version/kind'
  );
  assert(
    receipt.id === `sha256:${computeModelTraceReceiptDigest(receipt)}`,
    'receipt digest mismatch'
  );
  const measured = time(receipt.measuredAt, 'measuredAt');
  const expires = time(receipt.expiresAt, 'expiresAt');
  assert(
    Array.isArray(receipt.anomalies) &&
      receipt.anomalies.every((code) => ANOMALIES.includes(code)) &&
      isDeepStrictEqual(receipt.anomalies, [...new Set(receipt.anomalies)].sort()),
    'unknown, duplicate or unsorted anomaly codes'
  );
  assert(
    receipt.anomalies.includes('context-uncalibrated') &&
      receipt.anomalies.includes('unknown-model-not-excluded'),
    'closed-set/context limitations must remain explicit'
  );
  const ttl = receipt.anomalies.some((code) => SHORT_TTL_ANOMALIES.has(code)) ? SHORT_TTL : HOUR;
  assert(expires === measured + ttl, 'receipt TTL violates policy');
  exact(
    receipt.scope,
    ['repositoryId', 'sessionDigest', 'contextDigest', 'routeDigest'],
    'receipt scope'
  );
  assert(
    isRepository(receipt.scope.repositoryId) &&
      ['sessionDigest', 'contextDigest', 'routeDigest'].every((key) => isHex(receipt.scope[key])),
    'invalid receipt scope'
  );
  assert(
    isHex(receipt.source?.challengeDigest) &&
      isDeepStrictEqual(receipt.source, source(receipt.source.challengeDigest)),
    'receipt source differs from pinned policy'
  );
  exact(
    receipt.sampling,
    ['method', 'queries', 'counts', 'sampleDigests', 'contextCalibrated'],
    'sampling'
  );
  assert(
    METHODS.includes(receipt.sampling.method) &&
      receipt.sampling.queries === 3 &&
      receipt.sampling.contextCalibrated === false,
    'invalid sampling claim'
  );
  assert(
    Array.isArray(receipt.sampling.counts) &&
      receipt.sampling.counts.length === 3 &&
      receipt.sampling.counts.every(
        (n, index) =>
          n === null || (Number.isInteger(n) && withinSampleCountBounds(n, COUNTS[index]))
      ),
    'invalid sample counts'
  );
  assert(
    Array.isArray(receipt.sampling.sampleDigests) &&
      receipt.sampling.sampleDigests.length === 3 &&
      receipt.sampling.sampleDigests.every((d) => d === null || isHex(d)),
    'invalid sample digests'
  );
  exact(
    receipt.result,
    ['status', 'modelId', 'familyId', 'probability', 'margin', 'candidates'],
    'result'
  );
  const result = receipt.result;
  assert(['candidate', 'ambiguous', 'failed'].includes(result.status), 'invalid result status');
  assert(
    Array.isArray(result.candidates) &&
      (result.status === 'failed'
        ? result.candidates.length === 0
        : result.candidates.length === 3),
    'invalid candidate count'
  );
  const reference = loadBank();
  for (const candidate of result.candidates) {
    exact(candidate, ['modelId', 'familyId', 'probability', 'score'], 'candidate');
    assert(
      reference.models.some(
        (item) => item.id === candidate.modelId && item.family === candidate.familyId
      ),
      'candidate absent from pinned bank'
    );
    assert(
      Number.isFinite(candidate.probability) &&
        candidate.probability >= 0 &&
        candidate.probability <= 1 &&
        Number.isFinite(candidate.score),
      'invalid candidate statistics'
    );
  }
  for (let index = 0; index < result.candidates.length; index += 1) {
    for (let previous = 0; previous < index; previous += 1) {
      assert(
        result.candidates[index].modelId !== result.candidates[previous].modelId,
        'candidate model identities must be distinct'
      );
    }
  }
  if (result.status === 'failed') {
    assert(
      ['modelId', 'familyId', 'probability', 'margin'].every((key) => result[key] === null),
      'failed measurement cannot claim a model'
    );
    assert(
      receipt.anomalies.some((code) => ['probe-failed', 'sample-validation-failed'].includes(code)),
      'failed measurement lacks diagnostic'
    );
    assert(
      receipt.sampling.counts.some((n) => n === null),
      'failed measurement requires a missing valid sample'
    );
  } else {
    assert(
      result.candidates.every(
        (item, index, all) => index === 0 || all[index - 1].probability >= item.probability
      ),
      'candidates must be score-ordered'
    );
    assert(
      result.probability === result.candidates[0].probability &&
        result.margin === result.candidates[0].probability - result.candidates[1].probability,
      'result statistics differ from candidates'
    );
    const ambiguous = result.probability < 0.8 || result.margin < 0.2;
    assert(
      (result.status === 'ambiguous') === ambiguous &&
        receipt.anomalies.includes('ambiguous-candidates') === ambiguous,
      'ambiguity classification was changed'
    );
    assert(
      ambiguous
        ? result.modelId === null && result.familyId === null
        : result.modelId === result.candidates[0].modelId &&
            result.familyId === result.candidates[0].familyId,
      'measured identity must derive only from fingerprint ranking'
    );
    assert(
      receipt.sampling.counts.every((n) => n !== null) &&
        receipt.sampling.sampleDigests.every((d) => d !== null),
      'successful scoring requires all three strict samples'
    );
  }
  assert(
    receipt.sampling.counts.every(
      (count, index) => count === null || receipt.sampling.sampleDigests[index] !== null
    ),
    'valid sample counts require retained sample digests'
  );
  assert(
    receipt.anomalies.includes('probe-failed') ===
      receipt.sampling.counts.some(
        (count, index) => count === null && receipt.sampling.sampleDigests[index] === null
      ) &&
      receipt.anomalies.includes('sample-validation-failed') ===
        receipt.sampling.counts.some(
          (count, index) => count === null && receipt.sampling.sampleDigests[index] !== null
        ),
    'failure diagnostics differ from retained sampling facts'
  );
  assert(
    receipt.anomalies.includes('count-deviation') ===
      receipt.sampling.counts.some((count, index) => count !== null && count !== COUNTS[index]),
    'count deviation anomaly differs from retained valid sample counts'
  );
  labels(receipt.declared);
  const expectedDeclarations = declarationAnomalies(receipt.declared, result, reference);
  assert(
    DECLARATION_ANOMALIES.every(
      (code) => receipt.anomalies.includes(code) === expectedDeclarations.has(code)
    ),
    'declaration anomalies differ from declared labels and measured result'
  );
  assert(
    receipt.priorReceiptDigest === null || isHex(receipt.priorReceiptDigest),
    'invalid previous receipt digest'
  );
  assert(
    receipt.priorReceiptDigest !== null || !receipt.anomalies.includes('retest-inconsistent'),
    'retest inconsistency requires a prior receipt digest'
  );
  assert(
    receipt.result.status === 'candidate' || !receipt.anomalies.includes('retest-inconsistent'),
    'retest inconsistency requires a measured candidate result'
  );
  assert(
    isDeepStrictEqual(receipt.trust, {
      signed: false,
      backendAuthenticated: false,
      grantsPermission: false,
      unknownModelDetectable: false,
    }),
    'fingerprint cannot claim authentication, open-set detection or permission'
  );
  return receipt;
}

export function assertModelTraceFresh(
  receipt,
  context,
  { repositoryId = context?.repositoryId, now = new Date() } = {}
) {
  validateModelTraceReceipt(receipt);
  validateModelTraceContext(context, { fresh: true });
  assert(
    time(receipt.measuredAt, 'measuredAt') <= now.getTime() &&
      now.getTime() < time(receipt.expiresAt, 'expiresAt'),
    'measurement expired or is from the future; repeat all three probes'
  );
  assertModelTraceScope(receipt, context, repositoryId);
  return receipt;
}

export function assertModelTraceInputsOutsideCheckout({
  recordPath,
  contextPath,
  checkoutRoot,
  forbiddenPaths = [],
}) {
  assert(typeof recordPath === 'string' && recordPath.length > 0, 'record path is required');
  assert(typeof contextPath === 'string' && contextPath.length > 0, 'context path is required');
  const checkout = fs.realpathSync(checkoutRoot);
  const resolvedInputs = new Map();
  for (const [label, input] of [
    ['record', recordPath],
    ['context', contextPath],
  ]) {
    const resolved = fs.realpathSync(input);
    const relative = path.relative(checkout, resolved);
    assert(
      relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative),
      'private ModelTrace record/context inputs must remain outside the checkout and must not alias pre-admission artifacts'
    );
    assert(
      !resolvedInputs.has(resolved),
      'private ModelTrace record/context inputs must not alias each other or pre-admission artifacts'
    );
    resolvedInputs.set(resolved, label);
  }
  for (const forbidden of forbiddenPaths) {
    if (typeof forbidden !== 'string' || forbidden.length === 0) continue;
    const resolved = fs.realpathSync(forbidden);
    assert(
      !resolvedInputs.has(resolved),
      'private ModelTrace record/context inputs must not alias each other or pre-admission artifacts'
    );
  }
}

export function readModelTraceJson(path, label = 'artifact') {
  assert(typeof path === 'string' && path.length > 0, `${label} path is required`);
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    assert(stat.isFile() && stat.size <= 128 * 1024, `${label} must be a bounded regular file`);
    const text = fs.readFileSync(fd, 'utf8');
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `ModelTrace: ${label} is not valid JSON; raw content is not included in diagnostics`
      );
    }
  } finally {
    fs.closeSync(fd);
  }
}

export function loadModelTraceRecord({
  recordPath,
  contextPath,
  repositoryId,
  now = new Date(),
  fresh = true,
}) {
  const context = readModelTraceJson(contextPath, 'context');
  const record = readModelTraceJson(recordPath, 'record');
  exact(
    record,
    ['schemaVersion', 'kind', 'challenge', 'response', 'previous', 'receipt'],
    'record'
  );
  assert(
    record.schemaVersion === 1 && record.kind === 'proto-ui.modeltrace-record',
    'invalid local record version/kind'
  );
  const recomputed = buildModelTraceRecord(record.challenge, record.response, {
    previous: record.previous,
  });
  assert(
    isDeepStrictEqual(record.receipt, recomputed.receipt),
    'record does not reproduce its raw-sample fingerprint and anomalies'
  );
  if (fresh === false) {
    validateModelTraceContext(context);
    assertModelTraceScope(record.receipt, context, repositoryId ?? context.repositoryId);
    return record.receipt;
  }
  return assertModelTraceFresh(record.receipt, context, {
    repositoryId: repositoryId ?? context.repositoryId,
    now,
  });
}

export function renderModelTraceDisclosure(receipt, format = 'markdown') {
  validateModelTraceReceipt(receipt);
  if (format === 'commit') return `ModelTrace: ${canonical(receipt)}`;
  assert(format === 'json' || format === 'markdown', 'unsupported disclosure format');
  const json = JSON.stringify(
    receipt,
    (_key, value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      const ordered = {};
      for (const key of Object.keys(value).sort()) ordered[key] = value[key];
      return ordered;
    },
    2
  );
  if (format === 'json') return json;
  return `## ModelTrace\n\nClosed-set fingerprint attribution only; not authenticated backend identity, permission or acceptance. Unknown models are not excluded.\n\n\`\`\`json\n${json}\n\`\`\``;
}

let markdownVisibilityTools;
let lastVisibilityText;
let lastVisibilityOffsets;

function htmlText(node) {
  if (node.type === 'text') return node.value;
  let text = '';
  if (node.children) {
    for (const child of node.children) text += htmlText(child);
  }
  return text;
}

function standaloneModelTraceOffsets(text) {
  if (text === lastVisibilityText) return lastVisibilityOffsets;
  if (!markdownVisibilityTools) {
    // Node 24 can synchronously load these ESM modules. Loading only on a
    // Markdown write keeps measurement/scoring independent of the renderer.
    const require = createRequire(import.meta.url);
    markdownVisibilityTools = {
      fromMarkdown: require('mdast-util-from-markdown').fromMarkdown,
      toHast: require('mdast-util-to-hast').toHast,
      toHtml: require('hast-util-to-html').toHtml,
      fromHtml: require('hast-util-from-html').fromHtml,
    };
  }
  const { fromMarkdown, toHast, toHtml, fromHtml } = markdownVisibilityTools;
  const ast = fromMarkdown(text);
  const headings = [];
  // Ephemeral AST-only markers bind original headings through HTML parsing.
  // Raw HTML cannot forge them or rescue a canonical field hidden in a comment.
  const marker = `pui-modeltrace-${randomBytes(16).toString('hex')}-`;
  function markHeadings(parent) {
    if (!parent.children) return;
    for (const node of parent.children) {
      if (
        node.type === 'heading' &&
        node.depth === 2 &&
        node.children.length === 1 &&
        node.children[0].type === 'text' &&
        node.children[0].value === 'ModelTrace'
      ) {
        node.data = { hProperties: { id: `${marker}${node.position.start.offset}` } };
        // Nested Markdown examples are not raw HTML, but only root sections
        // can supply the canonical standalone disclosure.
        if (parent === ast) headings.push(node);
      }
      markHeadings(node);
    }
  }
  markHeadings(ast);
  // Parse one continuous serialization. Per-node raw AST reparsing resets HTML
  // tokenizer state and can lose a comment spanning Markdown node boundaries.
  const html = fromHtml(
    toHtml(toHast(ast, { allowDangerousHtml: true }), { allowDangerousHtml: true }),
    { fragment: true }
  );
  const visible = new Set();
  function inspectHtml(parent) {
    if (!parent.children) return;
    for (const node of parent.children) {
      // Explicit quoted examples remain non-disclosures, including raw HTML.
      if (node.type === 'element' && node.tagName === 'blockquote') continue;
      if (node.type === 'element' && node.tagName === 'h2') {
        const id = node.properties.id;
        assert(
          (typeof id === 'string' && id.startsWith(marker)) ||
            htmlText(node).trim() !== 'ModelTrace',
          'visible raw HTML ModelTrace headings cannot supply or compete with the canonical disclosure'
        );
        if (parent === html) visible.add(id);
      }
      inspectHtml(node);
    }
  }
  inspectHtml(html);
  const offsets = headings
    .filter((node) => visible.has(`${marker}${node.position.start.offset}`))
    .map((node) => node.position.start.offset);
  lastVisibilityText = text;
  lastVisibilityOffsets = offsets;
  return offsets;
}

export function hasModelTraceDisclosure(text, receipt, format = 'markdown') {
  assert(typeof text === 'string', 'publication is missing its exact ModelTrace disclosure');
  const expected = renderModelTraceDisclosure(receipt, format);
  if (format === 'markdown') {
    const headings = standaloneModelTraceOffsets(text);
    if (headings.length === 0) return false;
    const start = headings[0];
    const after = start === undefined ? '' : text.slice(start + expected.length);
    assert(
      headings.length === 1 &&
        text.startsWith(expected, start) &&
        (after === '' || after.startsWith('\n') || after.startsWith('\r\n')),
      'publication requires one visible, standalone exact ModelTrace disclosure'
    );
  } else if (format === 'commit') {
    const trailers = text.split(/\r?\n/).filter((line) => /^ModelTrace:/i.test(line));
    if (trailers.length === 0) return false;
    assert(
      trailers.length === 1 && trailers[0] === expected,
      'commit requires one exact ModelTrace trailer'
    );
  } else {
    if (text === '') return false;
    assert(text === expected, 'publication is missing its exact ModelTrace disclosure');
  }
  return true;
}

export function assertModelTraceDisclosure(text, receipt, format = 'markdown') {
  assert(
    hasModelTraceDisclosure(text, receipt, format),
    'publication requires one visible, standalone exact ModelTrace disclosure'
  );
  return receipt;
}
