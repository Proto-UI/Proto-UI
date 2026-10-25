import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeSelfAssessmentResultDigest,
  isSelfAssessmentFresh,
} from '../assessment-runtime.mjs';
import { assessmentSnapshot, createConnectorAssessment } from './fixtures/connector-assessment.mjs';

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
