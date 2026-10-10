import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { runModelTraceCli } from '../modeltrace-cli.mjs';
import {
  assertModelTraceDisclosure,
  assertModelTraceFresh,
  buildModelTraceRecord,
  computeModelTraceChallengeDigest,
  computeModelTraceReceiptDigest,
  createModelTraceChallenge,
  hasModelTraceDisclosure,
  loadModelTraceRecord,
  readModelTraceJson,
  renderModelTraceDisclosure,
  validateModelTraceSample,
  validateModelTraceContext,
  validateModelTraceReceipt,
} from '../modeltrace.mjs';

const NOW = new Date('2026-10-04T12:00:00.000Z');
const receiptSchema = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../internal/agent-operations/schemas/modeltrace-receipt.schema.json',
      import.meta.url
    ),
    'utf8'
  )
);
const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addFormat('date-time', {
  type: 'string',
  validate: (value) => Number.isFinite(Date.parse(value)),
});
const structuralReceipt = ajv.compile(receiptSchema);
function fixture({ declared = { systemModel: null, harnessModel: null }, failed = false } = {}) {
  const context = {
    schemaVersion: 1,
    kind: 'proto-ui.modeltrace-context',
    repositoryId: 'github.com:fixture/repository',
    // Deterministic opaque shape for a synthetic fixture, not entropy evidence.
    sessionId: 'd'.repeat(64),
    contextDigest: 'a'.repeat(64),
    routeDigest: 'b'.repeat(64),
    declared,
  };
  const challenge = createModelTraceChallenge(context, { now: NOW });
  const response = {
    schemaVersion: 1,
    kind: 'proto-ui.modeltrace-response',
    challengeDigest: computeModelTraceChallengeDigest(challenge),
    startedAt: NOW.toISOString(),
    completedAt: NOW.toISOString(),
    method: 'active-model-literals',
    // Deliberately synthetic fixtures, never self-measurements of an Agent.
    outputs: challenge.probes.map((probe) => ({
      id: probe.id,
      text: failed ? null : JSON.stringify(Array(probe.count).fill(137)),
      error: failed ? 'unavailable' : null,
    })),
  };
  return { context, challenge, response, record: buildModelTraceRecord(challenge, response) };
}

function statusReceipt(status) {
  if (status === 'failed') return fixture({ failed: true }).record.receipt;
  const receipt = fixture().record.receipt;
  // Synthetic ranking controls for receipt validation, not raw-sample provenance or measurements.
  const probabilities = status === 'candidate' ? [0.9, 0.06, 0.04] : [0.6, 0.3, 0.1];
  receipt.result.candidates.forEach((candidate, index) => {
    candidate.probability = probabilities[index];
  });
  receipt.result.status = status;
  receipt.result.modelId = status === 'candidate' ? receipt.result.candidates[0].modelId : null;
  receipt.result.familyId = status === 'candidate' ? receipt.result.candidates[0].familyId : null;
  receipt.result.probability = probabilities[0];
  receipt.result.margin = probabilities[0] - probabilities[1];
  receipt.anomalies = receipt.anomalies.filter((code) => code !== 'ambiguous-candidates');
  if (status === 'ambiguous') receipt.anomalies.push('ambiguous-candidates');
  receipt.anomalies.sort();
  receipt.expiresAt = new Date(
    NOW.getTime() + (status === 'ambiguous' ? 15 : 60) * 60_000
  ).toISOString();
  receipt.id = `sha256:${computeModelTraceReceiptDigest(receipt)}`;
  return receipt;
}

function rejectsStatusReceipt(receipt, expectedError) {
  receipt.id = `sha256:${computeModelTraceReceiptDigest(receipt)}`;
  assert.equal(structuralReceipt(receipt), false, JSON.stringify(receipt));
  assert.throws(() => validateModelTraceReceipt(receipt), expectedError);
}

test('receipt rankings require distinct enrolled model identities even with different statistics', () => {
  const produced = fixture().record.receipt;
  assert.equal(structuralReceipt(produced), true, JSON.stringify(structuralReceipt.errors));
  assert.equal(validateModelTraceReceipt(produced), produced);
  const { models } = JSON.parse(
    fs.readFileSync(new URL('../vendor/modeltrace/unified_bank.json', import.meta.url), 'utf8')
  );
  const template = statusReceipt('candidate');
  for (let index = 0; index < models.length; index++) {
    // Synthetic admission controls, not model measurements or claims about scorer ordering.
    const receipt = structuredClone(template);
    receipt.result.candidates.forEach((candidate, offset) => {
      const model = models[(index + offset) % models.length];
      candidate.modelId = model.id;
      candidate.familyId = model.family;
    });
    const top = receipt.result.candidates[0];
    receipt.result.modelId = top.modelId;
    receipt.result.familyId = top.familyId;
    receipt.id = `sha256:${computeModelTraceReceiptDigest(receipt)}`;
    assert.equal(structuralReceipt(receipt), true, JSON.stringify(structuralReceipt.errors));
    assert.equal(validateModelTraceReceipt(receipt), receipt);

    const forged = structuredClone(receipt);
    const lower = forged.result.candidates[2];
    lower.modelId = top.modelId;
    lower.familyId = top.familyId;
    lower.score = top.score - 1;
    // Complete-object uniqueItems would accept these distinct objects despite their shared identity.
    assert.notEqual(lower.probability, top.probability);
    assert.notEqual(lower.score, top.score);
    rejectsStatusReceipt(forged);
  }
});

test('receipt schema and runtime admit candidate, ambiguous and partial failed controls', () => {
  const partial = fixture();
  partial.response.outputs[2].text = null;
  partial.response.outputs[2].error = 'unavailable';
  const partialFailed = buildModelTraceRecord(partial.challenge, partial.response).receipt;
  assert.deepEqual(partialFailed.sampling.counts, [218, 233, null]);
  assert.equal(partialFailed.sampling.sampleDigests[2], null);
  partial.response.outputs[2].text = 'not a strict sample';
  partial.response.outputs[2].error = null;
  const partialInvalid = buildModelTraceRecord(partial.challenge, partial.response).receipt;
  assert.equal(partialInvalid.sampling.counts[2], null);
  assert.notEqual(partialInvalid.sampling.sampleDigests[2], null);
  partial.response.outputs[0].text = null;
  partial.response.outputs[0].error = 'timeout';
  const mixedFailure = buildModelTraceRecord(partial.challenge, partial.response).receipt;
  assert.deepEqual(mixedFailure.sampling.counts, [null, 233, null]);
  assert.equal(mixedFailure.sampling.sampleDigests[0], null);
  assert.notEqual(mixedFailure.sampling.sampleDigests[2], null);
  for (const [status, receipt] of [
    ['candidate', statusReceipt('candidate')],
    ['ambiguous', statusReceipt('ambiguous')],
    ['failed', statusReceipt('failed')],
    ['failed', partialFailed],
    ['failed', partialInvalid],
    ['failed', mixedFailure],
  ]) {
    assert.equal(structuralReceipt(receipt), true, JSON.stringify(structuralReceipt.errors));
    assert.equal(validateModelTraceReceipt(receipt).result.status, status);
  }
});

test('receipt schema and runtime retain producer-admitted positional boundaries and null failures', () => {
  for (const counts of [
    [120, 129, 136],
    [273, 292, 309],
  ]) {
    const f = fixture();
    f.response.outputs.forEach((output, index) => {
      output.text = JSON.stringify(Array(counts[index]).fill(137));
    });
    const complete = buildModelTraceRecord(f.challenge, f.response).receipt;
    assert.deepEqual(complete.sampling.counts, counts);
    assert.notEqual(complete.result.status, 'failed');
    assert(complete.anomalies.includes('count-deviation'));
    assert.equal(structuralReceipt(complete), true, JSON.stringify(structuralReceipt.errors));
    assert.equal(validateModelTraceReceipt(complete), complete);

    for (let missing = 0; missing < 3; missing += 1) {
      for (const invalidSample of [false, true]) {
        const response = structuredClone(f.response);
        response.outputs[missing].text = invalidSample ? 'not a strict sample' : null;
        response.outputs[missing].error = invalidSample ? null : 'unavailable';
        const receipt = buildModelTraceRecord(f.challenge, response).receipt;
        assert.equal(receipt.result.status, 'failed');
        assert.deepEqual(
          receipt.sampling.counts,
          counts.map((n, index) => (index === missing ? null : n))
        );
        assert.equal(receipt.sampling.sampleDigests[missing] === null, !invalidSample);
        assert(
          receipt.anomalies.includes(invalidSample ? 'sample-validation-failed' : 'probe-failed')
        );
        assert(receipt.anomalies.includes('count-deviation'));
        assert.equal(structuralReceipt(receipt), true, JSON.stringify(structuralReceipt.errors));
        assert.equal(validateModelTraceReceipt(receipt), receipt);
      }
    }
  }
});

test('digest-rebound receipts cannot claim counts outside the corresponding producer range', () => {
  const exact = [218, 233, 247];
  const impossible = [
    [80, 80, 80],
    [309, 233, 247],
  ];
  for (const [index, bounds] of [
    [120, 273],
    [129, 292],
    [136, 309],
  ].entries()) {
    for (const count of [bounds[0] - 1, bounds[1] + 1]) {
      const counts = [...exact];
      counts[index] = count;
      impossible.push(counts);
    }
  }
  for (const counts of impossible) {
    const receipt = statusReceipt('candidate');
    receipt.sampling.counts = counts;
    receipt.anomalies.push('count-deviation');
    receipt.anomalies.sort();
    rejectsStatusReceipt(receipt, /invalid sample counts/);
  }

  const partial = fixture();
  partial.response.outputs[2].text = null;
  partial.response.outputs[2].error = 'unavailable';
  const failed = buildModelTraceRecord(partial.challenge, partial.response).receipt;
  failed.sampling.counts[0] = 309;
  failed.anomalies.push('count-deviation');
  failed.anomalies.sort();
  rejectsStatusReceipt(failed, /invalid sample counts/);
});

test('schema consumers cannot suppress either mandatory closed-set limitation', () => {
  const valid = fixture({ failed: true }).record.receipt;
  for (const omitted of [
    ['context-uncalibrated'],
    ['unknown-model-not-excluded'],
    ['context-uncalibrated', 'unknown-model-not-excluded'],
  ]) {
    const receipt = structuredClone(valid);
    receipt.anomalies = receipt.anomalies.filter((code) => !omitted.includes(code));
    // Keep other legitimate codes: this defends membership, not array size.
    assert(receipt.anomalies.includes('probe-failed'));
    assert(receipt.anomalies.includes('system-label-unavailable'));
    rejectsStatusReceipt(receipt, /limitations/);
  }
});

test('receipt schema and runtime reject candidate-empty-null and failed-scored statuses', () => {
  const emptyCandidate = statusReceipt('failed');
  emptyCandidate.result.status = 'candidate';
  rejectsStatusReceipt(emptyCandidate, /invalid candidate count/);

  const scoredFailure = statusReceipt('candidate');
  scoredFailure.result.status = 'failed';
  rejectsStatusReceipt(scoredFailure, /invalid candidate count/);

  const incompleteAmbiguous = statusReceipt('ambiguous');
  incompleteAmbiguous.result.candidates.pop();
  rejectsStatusReceipt(incompleteAmbiguous, /invalid candidate count/);
});

test('failed receipt schema and runtime forbid claimed statistics or a missing diagnostic', () => {
  for (const [key, value] of [
    ['modelId', 'synthetic-model'],
    ['familyId', 'synthetic-family'],
    ['probability', 0.9],
    ['margin', 0.8],
  ]) {
    const receipt = statusReceipt('failed');
    receipt.result[key] = value;
    rejectsStatusReceipt(receipt, /failed measurement cannot claim a model/);
  }
  const receipt = statusReceipt('failed');
  receipt.anomalies = receipt.anomalies.filter((code) => code !== 'probe-failed');
  receipt.expiresAt = new Date(NOW.getTime() + 60 * 60_000).toISOString();
  rejectsStatusReceipt(receipt, /failed measurement lacks diagnostic/);
});

test('digest-rebound failed receipts must retain producer-consistent sampling diagnostics', () => {
  const f = fixture();
  f.response.outputs[2].text = 'not a strict sample';
  const invalid = buildModelTraceRecord(f.challenge, f.response).receipt;
  f.response.outputs[0].text = null;
  f.response.outputs[0].error = 'unavailable';
  const mixed = buildModelTraceRecord(f.challenge, f.response).receipt;

  const completeFailure = statusReceipt('failed');
  completeFailure.sampling = fixture().record.receipt.sampling;
  const missingValidDigest = structuredClone(mixed);
  missingValidDigest.sampling.sampleDigests[1] = null;
  const mislabelledProbe = statusReceipt('failed');
  mislabelledProbe.anomalies = mislabelledProbe.anomalies
    .map((code) => (code === 'probe-failed' ? 'sample-validation-failed' : code))
    .sort();
  const mislabelledInvalid = structuredClone(invalid);
  mislabelledInvalid.anomalies = mislabelledInvalid.anomalies
    .map((code) => (code === 'sample-validation-failed' ? 'probe-failed' : code))
    .sort();
  const missingMixedProbe = structuredClone(mixed);
  missingMixedProbe.anomalies = missingMixedProbe.anomalies.filter(
    (code) => code !== 'probe-failed'
  );
  const missingMixedValidation = structuredClone(mixed);
  missingMixedValidation.anomalies = missingMixedValidation.anomalies.filter(
    (code) => code !== 'sample-validation-failed'
  );
  for (const receipt of [
    completeFailure,
    missingValidDigest,
    mislabelledProbe,
    mislabelledInvalid,
    missingMixedProbe,
    missingMixedValidation,
  ]) {
    receipt.id = `sha256:${computeModelTraceReceiptDigest(receipt)}`;
    // The structural schema permits these shapes; public admission owns the
    // cross-field consistency even after the caller rebinds the content digest.
    assert.equal(structuralReceipt(receipt), true, JSON.stringify(structuralReceipt.errors));
    assert.throws(() => validateModelTraceReceipt(receipt));
  }
});

test('scored receipt schema and runtime enforce complete sampling and status-specific identity', () => {
  for (const status of ['candidate', 'ambiguous']) {
    for (const code of ['probe-failed', 'sample-validation-failed']) {
      const receipt = statusReceipt(status);
      receipt.anomalies.push(code);
      receipt.anomalies.sort();
      // Rebind TTL as well as content so policy freshness cannot hide a
      // successful result's spurious sampling-failure diagnostic.
      receipt.expiresAt = statusReceipt('failed').expiresAt;
      receipt.id = `sha256:${computeModelTraceReceiptDigest(receipt)}`;
      assert.equal(structuralReceipt(receipt), true, JSON.stringify(structuralReceipt.errors));
      assert.throws(() => validateModelTraceReceipt(receipt));
    }
    for (const key of ['probability', 'margin']) {
      const receipt = statusReceipt(status);
      receipt.result[key] = null;
      rejectsStatusReceipt(receipt, /result statistics differ from candidates/);
    }
    for (const key of ['counts', 'sampleDigests']) {
      const receipt = statusReceipt(status);
      receipt.sampling[key][2] = null;
      rejectsStatusReceipt(receipt, /successful scoring requires all three strict samples/);
    }
    for (const key of ['modelId', 'familyId']) {
      const receipt = statusReceipt(status);
      receipt.result[key] = status === 'ambiguous' ? receipt.result.candidates[0][key] : null;
      rejectsStatusReceipt(receipt, /measured identity must derive only from fingerprint ranking/);
    }
  }
  for (const key of ['modelId', 'familyId']) {
    const receipt = statusReceipt('candidate');
    receipt.result[key] = '';
    rejectsStatusReceipt(receipt, /measured identity must derive only from fingerprint ranking/);
  }
});

test('strict samples reject extraction, repair, decimals and out-of-range integers', () => {
  const raw = JSON.stringify(Array(218).fill(137));
  assert.equal(validateModelTraceSample(raw, 218).length, 218);
  assert.equal(validateModelTraceSample(`\`\`\`json\n${raw}\n\`\`\``, 218).length, 218);
  for (const invalid of [
    `prefix ${raw}`,
    raw.replace('137', '1.5'),
    raw.replace('137', '1e2'),
    raw.replace('137', '356'),
    raw.slice(0, -1),
    `${raw}\n${raw}`,
  ]) {
    assert.throws(() => validateModelTraceSample(invalid, 218));
  }
  assert.throws(() => validateModelTraceSample(JSON.stringify(Array(119).fill(137)), 218), /count/);
  assert.throws(() => validateModelTraceSample(JSON.stringify(Array(274).fill(137)), 218), /count/);
});

test('model declarations cannot select the fingerprint or become a failed-probe fallback', () => {
  const first = fixture({ declared: { systemModel: 'gpt-5.4', harnessModel: 'gpt-5.4' } });
  const second = fixture({ declared: { systemModel: 'gpt-6-astra', harnessModel: 'gpt-6-astra' } });
  assert.deepEqual(first.record.receipt.result, second.record.receipt.result);
  const failed = fixture({
    declared: { systemModel: 'gpt-6.1-sol', harnessModel: 'gpt-6-astra' },
    failed: true,
  });
  assert.equal(failed.record.receipt.result.status, 'failed');
  assert.equal(failed.record.receipt.result.modelId, null);
  assert(failed.record.receipt.anomalies.includes('declared-model-not-in-bank'));
  assert(failed.record.receipt.anomalies.includes('declaration-conflict'));
  assert(failed.record.receipt.anomalies.includes('unknown-model-not-excluded'));
  assert.equal(failed.record.receipt.trust.backendAuthenticated, false);
});

test('public receipts reject suppressed declaration anomalies after digest and TTL rebinding', () => {
  const candidate = statusReceipt('candidate');
  const measured = candidate.result.modelId;
  const other = candidate.result.candidates.find((item) => item.modelId !== measured).modelId;
  const declarationCodes = [
    'system-label-mismatch',
    'harness-label-mismatch',
    'declaration-conflict',
    'declared-model-not-in-bank',
    'system-label-unavailable',
    'harness-label-unavailable',
  ];
  for (const [status, declared, expected, omitted, ttl] of [
    [
      'candidate',
      { systemModel: other, harnessModel: measured },
      ['system-label-mismatch', 'declaration-conflict'],
      'system-label-mismatch',
      15,
    ],
    [
      'candidate',
      { systemModel: measured, harnessModel: other },
      ['harness-label-mismatch', 'declaration-conflict'],
      'harness-label-mismatch',
      15,
    ],
    [
      'candidate',
      { systemModel: null, harnessModel: measured },
      ['system-label-unavailable'],
      'system-label-unavailable',
      60,
    ],
    [
      'candidate',
      { systemModel: measured, harnessModel: null },
      ['harness-label-unavailable'],
      'harness-label-unavailable',
      60,
    ],
    [
      'failed',
      { systemModel: 'synthetic-unlisted-model', harnessModel: 'synthetic-unlisted-model' },
      ['declared-model-not-in-bank'],
      'declared-model-not-in-bank',
      15,
    ],
    [
      'failed',
      { systemModel: measured, harnessModel: other },
      ['declaration-conflict'],
      'declaration-conflict',
      15,
    ],
  ]) {
    const receipt = statusReceipt(status);
    receipt.declared = declared;
    receipt.anomalies = [
      ...receipt.anomalies.filter((code) => !declarationCodes.includes(code)),
      ...expected,
    ].sort();
    receipt.expiresAt = new Date(NOW.getTime() + ttl * 60_000).toISOString();
    receipt.id = `sha256:${computeModelTraceReceiptDigest(receipt)}`;
    assert.equal(validateModelTraceReceipt(receipt), receipt);
    receipt.anomalies = receipt.anomalies.filter((code) => code !== omitted);
    receipt.id = `sha256:${computeModelTraceReceiptDigest(receipt)}`;
    assert.equal(structuralReceipt(receipt), true, JSON.stringify(structuralReceipt.errors));
    assert.throws(() => validateModelTraceReceipt(receipt));
  }

  // A digest is unkeyed: changing a supported declaration must not hide its
  // mismatch or keep the original one-hour validity window.
  const receipt = structuredClone(candidate);
  receipt.declared = { systemModel: measured, harnessModel: null };
  receipt.anomalies = receipt.anomalies.filter((code) => code !== 'system-label-unavailable');
  receipt.id = `sha256:${computeModelTraceReceiptDigest(receipt)}`;
  assert.equal(validateModelTraceReceipt(receipt), receipt);
  receipt.declared.systemModel = other;
  receipt.id = `sha256:${computeModelTraceReceiptDigest(receipt)}`;
  assert.equal(Date.parse(receipt.expiresAt) - Date.parse(receipt.measuredAt), 60 * 60_000);
  assert.equal(structuralReceipt(receipt), true, JSON.stringify(structuralReceipt.errors));
  assert.throws(() => validateModelTraceReceipt(receipt));
});

test('public receipts reject spurious declarations without changing normalized label semantics', () => {
  const receipt = statusReceipt('candidate');
  const measured = receipt.result.modelId;
  receipt.declared = { systemModel: `fixture/${measured.toUpperCase()}`, harnessModel: measured };
  receipt.anomalies = receipt.anomalies.filter(
    (code) => !['system-label-unavailable', 'harness-label-unavailable'].includes(code)
  );
  receipt.id = `sha256:${computeModelTraceReceiptDigest(receipt)}`;
  assert.equal(validateModelTraceReceipt(receipt), receipt);
  for (const code of [
    'system-label-mismatch',
    'harness-label-mismatch',
    'declaration-conflict',
    'declared-model-not-in-bank',
    'system-label-unavailable',
    'harness-label-unavailable',
  ]) {
    const forged = structuredClone(receipt);
    forged.anomalies.push(code);
    forged.anomalies.sort();
    const short = ['system-label-mismatch', 'harness-label-mismatch', 'declaration-conflict'];
    forged.expiresAt = new Date(
      NOW.getTime() + (short.includes(code) ? 15 : 60) * 60_000
    ).toISOString();
    forged.id = `sha256:${computeModelTraceReceiptDigest(forged)}`;
    assert.equal(structuralReceipt(forged), true, JSON.stringify(structuralReceipt.errors));
    assert.throws(() => validateModelTraceReceipt(forged));
  }
});

test('an invalid third probe cannot be scored as a two-query identity', () => {
  const f = fixture();
  f.response.outputs[2].text = 'prose containing 1, 2, 3';
  const record = buildModelTraceRecord(f.challenge, f.response);
  assert.equal(record.receipt.result.status, 'failed');
  assert.equal(record.receipt.result.modelId, null);
  assert.equal(record.response.outputs[2].text, 'prose containing 1, 2, 3');
  assert(record.receipt.anomalies.includes('sample-validation-failed'));
  assert.equal(record.receipt.sampling.counts[2], null);
});

test('natural count deviations are retained without repair', () => {
  const f = fixture();
  f.response.outputs[1].text = JSON.stringify(Array(230).fill(137));
  const record = buildModelTraceRecord(f.challenge, f.response);
  assert.equal(record.receipt.sampling.counts[1], 230);
  assert(record.receipt.anomalies.includes('count-deviation'));
  assert.equal(record.response.outputs[1].text, f.response.outputs[1].text);
});

test('stored count deviations cannot be omitted or invented by rebinding the digest', () => {
  const f = fixture();
  const exact = f.record.receipt;
  f.response.outputs[1].text = JSON.stringify(Array(230).fill(137));
  const deviated = buildModelTraceRecord(f.challenge, f.response).receipt;
  f.response.outputs[0].text = null;
  f.response.outputs[0].error = 'unavailable';
  f.response.outputs[2].text = 'not a strict sample';
  const nullable = buildModelTraceRecord(f.challenge, f.response).receipt;
  const absent = fixture({ failed: true }).record.receipt;

  for (const [receipt, fabricate] of [
    [deviated, false],
    [exact, true],
    [nullable, false],
    [absent, true],
  ]) {
    validateModelTraceReceipt(receipt);
    const forged = structuredClone(receipt);
    forged.anomalies = forged.anomalies.filter((code) => code !== 'count-deviation');
    if (fabricate) forged.anomalies.push('count-deviation');
    forged.anomalies.sort();
    forged.id = `sha256:${computeModelTraceReceiptDigest(forged)}`;
    assert.equal(structuralReceipt(forged), true, JSON.stringify(structuralReceipt.errors));
    assert.throws(() => validateModelTraceReceipt(forged));
  }
});

test('expiry, changed task/provider/session and future clocks require a new measurement', () => {
  const f = fixture({ failed: true });
  const receipt = f.record.receipt;
  assertModelTraceFresh(receipt, f.context, { now: NOW });
  assertModelTraceFresh(receipt, f.context, { now: new Date(Date.parse(receipt.expiresAt) - 1) });
  assert.throws(
    () => assertModelTraceFresh(receipt, f.context, { now: new Date(receipt.expiresAt) }),
    /expired/
  );
  assert.throws(
    () => assertModelTraceFresh(receipt, f.context, { now: new Date(NOW.getTime() - 1) }),
    /future/
  );
  for (const context of [
    { ...f.context, repositoryId: 'github.com:another/repository' },
    { ...f.context, sessionId: 'e'.repeat(64) },
    { ...f.context, contextDigest: 'c'.repeat(64) },
    { ...f.context, routeDigest: 'c'.repeat(64) },
    { ...f.context, declared: { systemModel: 'gpt-5.4', harnessModel: null } },
  ])
    assert.throws(() => assertModelTraceFresh(receipt, context, { now: NOW }), /changed/);
  assert.throws(
    () =>
      assertModelTraceFresh(receipt, f.context, {
        repositoryId: 'github.com:another/repository',
        now: NOW,
      }),
    /repository\/session\/context\/provider route changed/
  );
});

test('freshness accepts equivalent GitHub casing without rewriting the receipt or context', () => {
  const f = fixture({ failed: true });
  const original = JSON.stringify(f.record);
  for (const repositoryId of ['github.com:FiXtUrE/repository', 'github.com:fixture/RePoSiToRy']) {
    const context = { ...f.context, repositoryId };
    const originalContext = JSON.stringify(context);
    assert.equal(assertModelTraceFresh(f.record.receipt, context, { now: NOW }), f.record.receipt);
    assert.equal(
      assertModelTraceFresh(f.record.receipt, f.context, { repositoryId, now: NOW }),
      f.record.receipt
    );
    assert.equal(JSON.stringify(context), originalContext);
    assert.equal(JSON.stringify(f.record), original);
  }
});

for (const [key, value] of [
  ['repositoryId', 'github.com:another/repository'],
  ['sessionDigest', 'c'.repeat(64)],
  ['contextDigest', 'c'.repeat(64)],
  ['routeDigest', 'c'.repeat(64)],
]) {
  test(`a structurally valid prior receipt with a foreign ${key} cannot become a retest`, () => {
    const f = fixture({ failed: true });
    const prior = structuredClone(f.record.receipt);
    prior.scope[key] = value;
    prior.id = `sha256:${computeModelTraceReceiptDigest(prior)}`;
    validateModelTraceReceipt(prior);
    assert.throws(
      () => buildModelTraceRecord(f.challenge, f.response, { previous: prior }),
      /repository\/session\/context\/provider route changed/
    );
  });
}

for (const key of ['systemModel', 'harnessModel']) {
  test(`prior admission and freshness require exact ${key} declarations`, () => {
    const f = fixture({
      declared: { systemModel: 'gpt-5.4', harnessModel: 'gpt-5.4' },
      failed: true,
    });
    const context = { ...f.context, declared: { ...f.context.declared, [key]: 'GPT-5.4' } };
    const prior = structuredClone(f.record.receipt);
    prior.declared[key] = context.declared[key];
    prior.id = `sha256:${computeModelTraceReceiptDigest(prior)}`;
    validateModelTraceReceipt(prior);
    assert.throws(
      () => buildModelTraceRecord(f.challenge, f.response, { previous: prior }),
      /declared system\/harness labels changed/
    );
    assert.throws(
      () => assertModelTraceFresh(f.record.receipt, context, { now: NOW }),
      /declared system\/harness labels changed/
    );
  });
}

test('public receipts reject retest inconsistency without a prior after digest and TTL rebinding', () => {
  const receipt = statusReceipt('candidate');
  assert.equal(receipt.priorReceiptDigest, null);
  assert.equal(structuralReceipt(receipt), true, JSON.stringify(structuralReceipt.errors));
  assert.equal(validateModelTraceReceipt(receipt), receipt);

  receipt.anomalies.push('retest-inconsistent');
  receipt.anomalies.sort();
  receipt.expiresAt = new Date(Date.parse(receipt.measuredAt) + 15 * 60_000).toISOString();
  rejectsStatusReceipt(receipt, /prior receipt digest/);
});

test('retest inconsistency rejects ambiguous and failed current results', () => {
  for (const status of ['ambiguous', 'failed']) {
    const receipt = statusReceipt(status);
    receipt.priorReceiptDigest = computeModelTraceReceiptDigest(statusReceipt('candidate'));
    receipt.anomalies.push('retest-inconsistent');
    receipt.anomalies.sort();
    receipt.expiresAt = new Date(Date.parse(receipt.measuredAt) + 15 * 60_000).toISOString();
    rejectsStatusReceipt(receipt, /measured candidate result/);
  }
});

test('a conflicting retest with a linked prior remains a valid public receipt', () => {
  const prior = statusReceipt('candidate');
  const receipt = structuredClone(prior);
  const first = receipt.result.candidates[0];
  const second = receipt.result.candidates[1];
  [first.modelId, second.modelId] = [second.modelId, first.modelId];
  [first.familyId, second.familyId] = [second.familyId, first.familyId];
  receipt.result.modelId = first.modelId;
  receipt.result.familyId = first.familyId;
  receipt.priorReceiptDigest = computeModelTraceReceiptDigest(prior);
  receipt.anomalies.push('retest-inconsistent');
  receipt.anomalies.sort();
  receipt.expiresAt = new Date(Date.parse(receipt.measuredAt) + 15 * 60_000).toISOString();
  receipt.id = `sha256:${computeModelTraceReceiptDigest(receipt)}`;
  assert.notEqual(receipt.result.modelId, prior.result.modelId);
  assert.equal(structuralReceipt(receipt), true, JSON.stringify(structuralReceipt.errors));
  assert.equal(validateModelTraceReceipt(receipt), receipt);
});

test('same-scope expired prior evidence retains its digest across equivalent GitHub casing', () => {
  const f = fixture({ failed: true });
  for (const repositoryId of [
    f.context.repositoryId,
    'github.com:FiXtUrE/repository',
    'github.com:fixture/RePoSiToRy',
  ]) {
    const prior = structuredClone(f.record.receipt);
    prior.scope.repositoryId = repositoryId;
    prior.measuredAt = new Date(Date.parse(prior.measuredAt) - 60 * 60_000).toISOString();
    prior.expiresAt = new Date(Date.parse(prior.expiresAt) - 60 * 60_000).toISOString();
    prior.id = `sha256:${computeModelTraceReceiptDigest(prior)}`;
    const original = JSON.stringify(prior);
    const record = buildModelTraceRecord(f.challenge, f.response, { previous: prior });
    assert.equal(record.receipt.priorReceiptDigest, prior.id.slice(7));
    assert.equal(record.receipt.anomalies.includes('retest-inconsistent'), false);
    assert.equal(structuralReceipt(record.receipt), true, JSON.stringify(structuralReceipt.errors));
    assert.equal(JSON.stringify(record.previous), original);
    assert.equal(assertModelTraceFresh(record.receipt, f.context, { now: NOW }), record.receipt);
  }
});

test('prior chronology is bounded by response start, not scoring order or challenge issuance', () => {
  const f = fixture({ failed: true });
  const start = NOW.getTime() + 60_000;
  f.response.startedAt = new Date(start).toISOString();
  f.response.completedAt = new Date(start + 60_000).toISOString();
  for (const offset of [-1, 0, 1, 60_001]) {
    const prior = structuredClone(f.record.receipt);
    const ttl = Date.parse(prior.expiresAt) - Date.parse(prior.measuredAt);
    prior.measuredAt = new Date(start + offset).toISOString();
    prior.expiresAt = new Date(start + offset + ttl).toISOString();
    prior.id = `sha256:${computeModelTraceReceiptDigest(prior)}`;
    validateModelTraceReceipt(prior);
    if (offset <= 0) {
      const record = buildModelTraceRecord(f.challenge, f.response, { previous: prior });
      assert.equal(record.receipt.priorReceiptDigest, prior.id.slice(7));
      assert.equal(record.receipt.anomalies.includes('retest-inconsistent'), false);
    } else {
      assert.throws(
        () => buildModelTraceRecord(f.challenge, f.response, { previous: prior }),
        /prior measurement.*after/
      );
    }
  }
});

test('fresh private admission rejects descriptive sessions without breaking historical recomputation', (t) => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'modeltrace-legacy-session-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const f = fixture({ failed: true });
  for (const sessionId of ['x', 'synthetic-unit-test-not-a-model-measurement']) {
    const context = { ...f.context, sessionId };
    validateModelTraceContext(context);
    assert.throws(() => createModelTraceChallenge(context, { now: NOW }), /opaque.*session/);
    const challenge = { ...f.challenge, context };
    const response = {
      ...f.response,
      challengeDigest: computeModelTraceChallengeDigest(challenge),
    };
    const historical = buildModelTraceRecord(challenge, response);
    const recordPath = path.join(directory, 'legacy.json');
    const contextPath = path.join(directory, 'legacy-context.json');
    fs.writeFileSync(recordPath, JSON.stringify(historical));
    fs.writeFileSync(contextPath, JSON.stringify(context));
    const readback = readModelTraceJson(recordPath, 'historical record');
    assert.deepEqual(
      buildModelTraceRecord(readback.challenge, readback.response).receipt,
      historical.receipt
    );
    assert.equal(validateModelTraceReceipt(readback.receipt), readback.receipt);
    assertModelTraceDisclosure(renderModelTraceDisclosure(readback.receipt), readback.receipt);
    assert.deepEqual(
      loadModelTraceRecord({ recordPath, contextPath, now: NOW, fresh: false }),
      historical.receipt
    );
    assert.throws(() => loadModelTraceRecord({ recordPath, contextPath, now: NOW }));
    assert.throws(
      () => assertModelTraceFresh(readback.receipt, context, { now: NOW }),
      /opaque.*session/
    );
    const challengePath = path.join(directory, 'legacy-challenge.json');
    const responsePath = path.join(directory, 'legacy-response.json');
    const out = path.join(directory, 'fresh-record.json');
    fs.writeFileSync(challengePath, JSON.stringify(challenge));
    fs.writeFileSync(responsePath, JSON.stringify(response));
    let stdout = '';
    assert.throws(
      () =>
        runModelTraceCli(
          ['score', '--challenge', challengePath, '--response', responsePath, '--out', out],
          {
            now: NOW,
            stdout: {
              write(text) {
                stdout += text;
              },
            },
          }
        ),
      /opaque.*session/
    );
    assert.equal(fs.existsSync(out), false);
    assert.equal(stdout, '');
  }
  const uuidContext = { ...f.context, sessionId: '12345678-1234-4123-8123-123456789abc' };
  const challenge = createModelTraceChallenge(uuidContext, { now: NOW });
  const record = buildModelTraceRecord(challenge, {
    ...f.response,
    challengeDigest: computeModelTraceChallengeDigest(challenge),
  });
  assert.equal(assertModelTraceFresh(record.receipt, uuidContext, { now: NOW }), record.receipt);
  assert.throws(
    () =>
      createModelTraceChallenge(
        { ...uuidContext, sessionId: uuidContext.sessionId.replace('-4123-', '-1123-') },
        { now: NOW }
      ),
    /opaque.*session/
  );
});

test('failed retests remain failed, not a fabricated model mismatch', () => {
  const prior = fixture().record.receipt;
  const f = fixture({ failed: true });
  const record = buildModelTraceRecord(f.challenge, f.response, { previous: prior });
  assert.equal(record.receipt.result.modelId, null);
  assert.equal(record.receipt.anomalies.includes('retest-inconsistent'), false);
  assert(record.receipt.anomalies.includes('probe-failed'));
  assert.equal(record.receipt.priorReceiptDigest, prior.id.slice(7));
});

test('raw samples are re-scored before use and never appear in public disclosure', (t) => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'modeltrace-boundary-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const f = fixture();
  const recordPath = path.join(directory, 'record.json');
  const contextPath = path.join(directory, 'context.json');
  fs.writeFileSync(recordPath, JSON.stringify(f.record));
  fs.writeFileSync(contextPath, JSON.stringify(f.context));
  const receipt = loadModelTraceRecord({ recordPath, contextPath, now: NOW });
  const disclosure = renderModelTraceDisclosure(receipt);
  assert.equal(disclosure.includes(f.context.sessionId), false);
  assert.equal(disclosure.includes(f.response.outputs[0].text), false);
  f.record.response.outputs[0].text = JSON.stringify(Array(218).fill(138));
  fs.writeFileSync(recordPath, JSON.stringify(f.record));
  assert.throws(
    () => loadModelTraceRecord({ recordPath, contextPath, now: NOW }),
    /does not reproduce/
  );
  fs.symlinkSync(contextPath, path.join(directory, 'linked-context'));
  assert.throws(() =>
    loadModelTraceRecord({
      recordPath,
      contextPath: path.join(directory, 'linked-context'),
      now: NOW,
    })
  );
});

test('historical loading skips expiry but retains exact scope and raw-sample recomputation', (t) => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'modeltrace-historical-loader-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const f = fixture();
  const recordPath = path.join(directory, 'record.json');
  const contextPath = path.join(directory, 'context.json');
  fs.writeFileSync(recordPath, JSON.stringify(f.record));
  fs.writeFileSync(contextPath, JSON.stringify(f.context));
  const now = new Date(f.record.receipt.expiresAt);
  const options = { recordPath, contextPath, now };
  assert.throws(() => loadModelTraceRecord(options));
  assert.deepEqual(loadModelTraceRecord({ ...options, fresh: false }), f.record.receipt);

  for (const context of [
    { ...f.context, repositoryId: 'github.com:another/repository' },
    { ...f.context, sessionId: 'e'.repeat(64) },
    { ...f.context, contextDigest: 'c'.repeat(64) },
    { ...f.context, routeDigest: 'c'.repeat(64) },
    { ...f.context, declared: { systemModel: 'gpt-5.4', harnessModel: null } },
    { ...f.context, declared: { systemModel: null, harnessModel: 'gpt-5.4' } },
    { ...f.context, sessionId: null },
  ]) {
    fs.writeFileSync(contextPath, JSON.stringify(context));
    assert.throws(() => loadModelTraceRecord({ ...options, fresh: false }));
  }
  fs.writeFileSync(contextPath, JSON.stringify(f.context));
  assert.throws(() =>
    loadModelTraceRecord({
      ...options,
      fresh: false,
      repositoryId: 'github.com:another/repository',
    })
  );

  const tampered = structuredClone(f.record);
  tampered.response.outputs[0].text = JSON.stringify(Array(218).fill(138));
  fs.writeFileSync(recordPath, JSON.stringify(tampered));
  assert.throws(() => loadModelTraceRecord({ ...options, fresh: false }));
});

test('public receipt bytes and sealed disclosures survive nested JSON key reordering', () => {
  const receipt = fixture().record.receipt;
  const reorder = (value) =>
    Array.isArray(value)
      ? value.map(reorder)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .reverse()
              .map((key) => [key, reorder(value[key])])
          )
        : value;
  const reordered = reorder(receipt);
  validateModelTraceReceipt(reordered);
  assert.equal(computeModelTraceReceiptDigest(reordered), computeModelTraceReceiptDigest(receipt));
  for (const format of ['commit', 'json', 'markdown']) {
    const sealed = renderModelTraceDisclosure(receipt, format);
    assert.equal(renderModelTraceDisclosure(reordered, format), sealed);
    if (format !== 'json') assertModelTraceDisclosure(sealed, reordered, format);
  }
  assert.deepEqual(JSON.parse(renderModelTraceDisclosure(reordered, 'json')), receipt);
});

test('responses cannot be relabelled as a fresh challenge or another sampler', () => {
  const f = fixture();
  const next = createModelTraceChallenge(f.context, { now: NOW });
  assert.throws(() => buildModelTraceRecord(next, f.response), /does not bind/);
  f.response.method = 'fresh-api-model';
  assert.throws(() => buildModelTraceRecord(f.challenge, f.response), /unsupported sampler/);
});

test('hidden and duplicate disclosures cannot satisfy visible publication', () => {
  const receipt = fixture({ failed: true }).record.receipt;
  const disclosure = renderModelTraceDisclosure(receipt);
  assertModelTraceDisclosure(`Evidence\n\n${disclosure}`, receipt);
  assert.equal(hasModelTraceDisclosure(`Evidence\n\n${disclosure}`, receipt), true);
  assert.equal(hasModelTraceDisclosure(`<!--\n${disclosure}\n-->`, receipt), false);
  assert.equal(hasModelTraceDisclosure(`<!--\n${disclosure}`, receipt), false);
  assert.throws(() => assertModelTraceDisclosure(`<!--\n${disclosure}\n-->`, receipt));
  assert.throws(() => assertModelTraceDisclosure(`<!--\n${disclosure}`, receipt));
  assert.throws(() => assertModelTraceDisclosure(`${disclosure}\n\n${disclosure}`, receipt));
  assert.throws(() => hasModelTraceDisclosure(`${disclosure}\n\n${disclosure}`, receipt));
});

test('visible disclosure detection admits literal examples but rejects a present wrong receipt', () => {
  const receipt = fixture({ failed: true }).record.receipt;
  const disclosure = renderModelTraceDisclosure(receipt);
  for (const example of [
    'Ordinary evidence with no disclosure.',
    '~~~markdown\n## ModelTrace\n~~~',
    '<!--\n## ModelTrace\n-->',
    '    ## ModelTrace',
    '> ## ModelTrace',
    '`## ModelTrace`',
    '\\## ModelTrace',
  ]) {
    assert.equal(hasModelTraceDisclosure(example, receipt), false);
    assert.equal(hasModelTraceDisclosure(`${example}\n\n${disclosure}`, receipt), true);
  }
  const wrong = fixture({
    failed: true,
    declared: { systemModel: 'gpt-5.4', harnessModel: null },
  }).record.receipt;
  assert.throws(() => hasModelTraceDisclosure(renderModelTraceDisclosure(wrong), receipt));
  assert.throws(() => hasModelTraceDisclosure('## ModelTrace\n\nNot a receipt.', receipt));
});

test('raw HTML ModelTrace sections cannot compete with a canonical visible disclosure', () => {
  const receipt = fixture({ failed: true }).record.receipt;
  const disclosure = renderModelTraceDisclosure(receipt);
  for (const heading of [
    '<h2>ModelTrace</h2>',
    '<h2><span>ModelTrace</span></h2>',
    '<div><h2>ModelTrace</h2></div>',
    '<section><div><h2><span>Model</span>Trace</h2></div></section>',
  ]) {
    assert.throws(() => hasModelTraceDisclosure(heading, receipt));
    assert.throws(() => assertModelTraceDisclosure(`${heading}\n\n${disclosure}`, receipt));
    assert.throws(() => assertModelTraceDisclosure(`${disclosure}\n\n${heading}`, receipt));
    for (const example of [
      `~~~html\n${heading}\n~~~`,
      `<!-- ${heading} -->`,
      `> ${heading}`,
      `<blockquote>${heading}</blockquote>`,
      `<div><blockquote>${heading}</blockquote></div>`,
      `\`${heading}\``,
      heading.replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    ]) {
      assert.equal(hasModelTraceDisclosure(example, receipt), false);
      assert.equal(hasModelTraceDisclosure(`${example}\n\n${disclosure}`, receipt), true);
    }
  }
  for (const example of [
    '<div><h2>Other evidence</h2></div>',
    '- ## ModelTrace',
    '<div>\n\n## ModelTrace\n\n</div>',
    `> ${disclosure.replaceAll('\n', '\n> ')}`,
  ]) {
    assert.equal(hasModelTraceDisclosure(example, receipt), false);
    assert.equal(hasModelTraceDisclosure(`${example}\n\n${disclosure}`, receipt), true);
  }
});

test('digest and repository bindings reject regex-coercible singleton arrays', () => {
  const context = fixture({ failed: true }).context;
  assert.throws(
    () => validateModelTraceContext({ ...context, repositoryId: [context.repositoryId] }),
    /repository/
  );
  assert.throws(
    () => validateModelTraceContext({ ...context, contextDigest: [context.contextDigest] }),
    /digest/
  );
  assert.throws(
    () => validateModelTraceContext({ ...context, routeDigest: [context.routeDigest] }),
    /digest/
  );
});

test('non-rendered HTML and enclosing code cannot impersonate a standalone disclosure', () => {
  const receipt = fixture({ failed: true }).record.receipt;
  const disclosure = renderModelTraceDisclosure(receipt);
  assertModelTraceDisclosure(`Evidence <!-- harmless comment -->\n\n${disclosure}`, receipt);
  assertModelTraceDisclosure(`The delimiter is \`<!--\`.\n\n${disclosure}`, receipt);
  assertModelTraceDisclosure(`The escaped delimiter is \\<!--.\n\n${disclosure}`, receipt);
  for (const wrapped of [
    `<?\n${disclosure}\n?>`,
    `<script>\n${disclosure}\n</script>`,
    `<![CDATA[\n${disclosure}\n]]>`,
    `~~~text\n${disclosure}\n~~~`,
    `<div>\n<!--\n</div>\n\n${disclosure}\n-->`,
    `<hr>\n<!--\n\n${disclosure}\n-->`,
    `<p>\n<!--\n</p>\n\n${disclosure}\n-->`,
  ]) {
    assert.equal(hasModelTraceDisclosure(wrapped, receipt), false);
    assert.throws(() => assertModelTraceDisclosure(wrapped, receipt), /visible/);
  }
});

test('canonical fenced receipt bytes cannot be reconstructed by stripping literal comments', () => {
  const receipt = fixture({ failed: true }).record.receipt;
  const disclosure = renderModelTraceDisclosure(receipt);
  assert.throws(
    () => assertModelTraceDisclosure(disclosure.replace('"result"', '"res<!--x-->ult"'), receipt),
    /exact/
  );
  assert.throws(
    () => assertModelTraceDisclosure(`${disclosure}not-a-closing-fence`, receipt),
    /exact/
  );
  assert.throws(
    () => hasModelTraceDisclosure(disclosure.replace('"result"', '"res<!--x-->ult"'), receipt),
    /exact/
  );
});

test('challenge and score require new private outputs and expose only public summaries on stdout', (t) => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'modeltrace-private-cli-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const f = fixture();
  const contextPath = path.join(directory, 'context.json');
  const challengePath = path.join(directory, 'challenge.json');
  const responsePath = path.join(directory, 'response.json');
  fs.writeFileSync(contextPath, JSON.stringify(f.context));
  fs.writeFileSync(challengePath, JSON.stringify(f.challenge));
  fs.writeFileSync(responsePath, JSON.stringify(f.response));
  for (const [command, inputs] of [
    ['challenge', ['--context', contextPath]],
    ['score', ['--challenge', challengePath, '--response', responsePath]],
  ]) {
    let stdout = '';
    const options = {
      now: NOW,
      stdout: {
        write(text) {
          stdout += text;
        },
      },
    };
    assert.throws(() => runModelTraceCli([command, ...inputs], options), /private --out/);
    assert.equal(stdout, '');
    const out = path.join(directory, `${command}-output.json`);
    const artifact = runModelTraceCli([command, ...inputs, '--out', out], options);
    assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), artifact);
    assert.equal(fs.statSync(out).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(stdout), {
      written: out,
      kind: artifact.kind,
      receiptId: artifact.receipt?.id ?? null,
    });
    assert.equal(stdout.includes(f.context.sessionId), false);
    assert.equal(stdout.includes(f.response.outputs[0].text), false);
    const original = fs.readFileSync(out, 'utf8');
    stdout = '';
    assert.throws(() => runModelTraceCli([command, ...inputs, '--out', out], options), /new file/);
    assert.equal(fs.readFileSync(out, 'utf8'), original);
    assert.equal(stdout, '');
  }
});

test('private output preflight precedes context reads and challenge creation', (t) => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'modeltrace-output-preflight-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const existing = path.join(directory, 'occupied.json');
  fs.writeFileSync(existing, 'existing private content');
  assert.throws(
    () =>
      runModelTraceCli([
        'challenge',
        '--context',
        path.join(directory, 'absent-context.json'),
        '--out',
        existing,
      ]),
    /new file/
  );
  assert.equal(fs.readFileSync(existing, 'utf8'), 'existing private content');
});

test('private --out storage cannot enter the repository through a parent symlink', (t) => {
  const outside = fs.mkdtempSync(path.join(tmpdir(), 'modeltrace-private-output-'));
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const inside = fs.mkdtempSync(path.join(root, '.modeltrace-output-fixture-'));
  t.after(() => {
    fs.rmSync(outside, { recursive: true, force: true });
    fs.rmSync(inside, { recursive: true, force: true });
  });
  const contextPath = path.join(outside, 'context.json');
  fs.writeFileSync(contextPath, JSON.stringify(fixture({ failed: true }).context));
  fs.symlinkSync(inside, path.join(outside, 'linked-parent'));
  assert.throws(
    () =>
      runModelTraceCli(
        [
          'challenge',
          '--context',
          contextPath,
          '--out',
          path.join(outside, 'linked-parent', 'private.json'),
        ],
        { now: NOW, stdout: { write() {} } }
      ),
    /outside the repository/
  );
  assert.equal(fs.existsSync(path.join(inside, 'private.json')), false);
});

test('score rejects checkout inputs and directory aliases without writing a private record', (t) => {
  const outside = fs.mkdtempSync(path.join(tmpdir(), 'modeltrace-private-input-'));
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const inside = fs.mkdtempSync(path.join(root, '.modeltrace-input-fixture-'));
  t.after(() => {
    fs.rmSync(outside, { recursive: true, force: true });
    fs.rmSync(inside, { recursive: true, force: true });
  });
  const f = fixture();
  for (const directory of [inside, outside]) {
    fs.writeFileSync(path.join(directory, 'challenge.json'), JSON.stringify(f.challenge));
    fs.writeFileSync(path.join(directory, 'response.json'), JSON.stringify(f.response));
    fs.writeFileSync(path.join(directory, 'previous.json'), JSON.stringify(f.record));
  }
  const insideAlias = path.join(outside, 'checkout-alias');
  const outsideAlias = path.join(outside, 'private-alias');
  fs.symlinkSync(inside, insideAlias);
  fs.symlinkSync(outside, outsideAlias);
  for (const name of ['challenge', 'response', 'previous']) {
    for (const directory of [inside, insideAlias]) {
      const out = path.join(
        outside,
        `denied-${name}-${directory === inside ? 'direct' : 'alias'}.json`
      );
      let stdout = '';
      assert.throws(() =>
        runModelTraceCli(
          [
            'score',
            '--challenge',
            path.join(name === 'challenge' ? directory : outside, 'challenge.json'),
            '--response',
            path.join(name === 'response' ? directory : outside, 'response.json'),
            '--previous',
            path.join(name === 'previous' ? directory : outside, 'previous.json'),
            '--out',
            out,
          ],
          {
            now: NOW,
            stdout: {
              write(text) {
                stdout += text;
              },
            },
          }
        )
      );
      assert.equal(fs.existsSync(out), false);
      assert.equal(stdout, '');
    }
  }
  const out = path.join(outside, 'admitted.json');
  let stdout = '';
  const record = runModelTraceCli(
    [
      'score',
      '--challenge',
      path.join(outsideAlias, 'challenge.json'),
      '--response',
      path.join(outsideAlias, 'response.json'),
      '--previous',
      path.join(outsideAlias, 'previous.json'),
      '--out',
      out,
    ],
    {
      now: NOW,
      stdout: {
        write(text) {
          stdout += text;
        },
      },
    }
  );
  assert.deepEqual(record.receipt.result, f.record.receipt.result);
  assert.equal(record.receipt.priorReceiptDigest, f.record.receipt.id.slice(7));
  assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), record);
  assert.equal(fs.statSync(out).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(stdout), {
    written: out,
    kind: record.kind,
    receiptId: record.receipt.id,
  });
});

test('canonical-equivalent prior receipts remain usable for bounded retests', (t) => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'modeltrace-prior-order-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const f = fixture({ failed: true });
  f.record.receipt = Object.fromEntries(Object.entries(f.record.receipt).reverse());
  const previous = path.join(directory, 'previous.json');
  const challenge = path.join(directory, 'challenge.json');
  const response = path.join(directory, 'response.json');
  fs.writeFileSync(previous, JSON.stringify(f.record));
  const next = createModelTraceChallenge(f.context, { now: NOW });
  fs.writeFileSync(challenge, JSON.stringify(next));
  fs.writeFileSync(
    response,
    JSON.stringify({ ...f.response, challengeDigest: computeModelTraceChallengeDigest(next) })
  );
  const record = runModelTraceCli(
    [
      'score',
      '--challenge',
      challenge,
      '--response',
      response,
      '--previous',
      previous,
      '--out',
      path.join(directory, 'record.json'),
    ],
    { now: NOW, stdout: { write() {} } }
  );
  assert.equal(record.receipt.priorReceiptDigest, f.record.receipt.id.slice(7));
  assert.equal(record.receipt.result.status, 'failed');
});
