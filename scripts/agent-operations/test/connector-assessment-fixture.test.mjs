import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeSelfAssessmentResultDigest,
  isSelfAssessmentFresh,
} from '../assessment-runtime.mjs';
import { assessmentSnapshot, createConnectorAssessment } from './fixtures/connector-assessment.mjs';
import { assertModelTraceFresh } from '../modeltrace.mjs';
import { modelTraceFixture } from './fixtures/modeltrace.mjs';

test('independent connector fixture generation stays fresh after a long-lived runner', (t) => {
  const startedAt = Date.now();
  const first = createConnectorAssessment();
  const original = structuredClone(first);
  const lifetime = Date.parse(first.validity.expiresAt) - Date.parse(first.validity.issuedAt);
  assert(isSelfAssessmentFresh(first, assessmentSnapshot));
  t.mock.method(Date, 'now', () => startedAt + 11 * 60_000);
  assert.equal(isSelfAssessmentFresh(first, assessmentSnapshot), false);
  const next = createConnectorAssessment();
  assert(
    isSelfAssessmentFresh(next, assessmentSnapshot),
    'a new fixture must use its invocation clock'
  );
  assert.equal(Date.parse(next.validity.expiresAt) - Date.parse(next.validity.issuedAt), lifetime);
  assert.equal(next.scope.worktreeDigest, first.scope.worktreeDigest);
  assert.notEqual(next.resultDigest, first.resultDigest);
  assert.deepEqual(first, original, 'generating a new fixture must not renew the old proof');
});

test('old and explicitly expired connector proofs remain rejected after fixture generation', (t) => {
  const first = createConnectorAssessment();
  const original = structuredClone(first);
  t.mock.method(Date, 'now', () => Date.parse(original.validity.expiresAt) + 1);
  const next = createConnectorAssessment();
  assert.deepEqual(first, original);
  assert.equal(isSelfAssessmentFresh(first, assessmentSnapshot), false);
  const expired = structuredClone(next);
  expired.validity.expiresAt = new Date(Date.now() - 1000).toISOString();
  expired.resultDigest = computeSelfAssessmentResultDigest(expired);
  assert.equal(isSelfAssessmentFresh(expired, assessmentSnapshot), false);
});

test('new synthetic ModelTrace fixtures use the invocation clock without renewing expired proofs', (t) => {
  const first = modelTraceFixture();
  const original = structuredClone(first);
  const expiredAt = Date.parse(first.modelTrace.expiresAt);
  t.mock.method(Date, 'now', () => expiredAt + 1);
  const next = modelTraceFixture();
  const now = new Date(Date.now());
  assertModelTraceFresh(next.modelTrace, next.modelTraceContext, { now });
  assert.throws(
    () => assertModelTraceFresh(first.modelTrace, first.modelTraceContext, { now }),
    /measurement expired/
  );
  assert.deepEqual(first, original);
  assert.notEqual(next.modelTrace.id, first.modelTrace.id);
  t.mock.restoreAll();
  const current = modelTraceFixture();
  assertModelTraceFresh(current.modelTrace, current.modelTraceContext);
  assert.throws(
    () => assertModelTraceFresh(next.modelTrace, next.modelTraceContext),
    /from the future/
  );
});
