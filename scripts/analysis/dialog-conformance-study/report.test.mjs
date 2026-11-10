import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyCell, summarize } from './report.mjs';

// Synthetic classifier controls only. These receipts are never product observations.
const plan = {
  studyId: 'classifier-controls-only', visibility: 'no-product-results',
  expectationReview: 'not-an-independent-review',
  cases: [{ id: 'FOCUS', criterion: 'draft-focus', existingCheckFragments: ['Tab loop'] }],
  variants: [
    { id: 'baseline', kind: 'valid-control', patch: null },
    { id: 'broken', kind: 'injected-broken', caseId: 'FOCUS', patch: { path: 'synthetic' } },
    { id: 'legal', kind: 'legal-customization', patch: { path: 'synthetic' } },
  ],
};
const baseline = () => ({
  ready: true, transformed: false,
  existing: [
    { fullName: 'existing Tab loop', status: 'passed', diagnostics: [] },
    { fullName: 'existing unrelated close', status: 'passed', diagnostics: [] },
  ],
  oracle: [{ id: 'FOCUS', finished: true, firstDivergence: null, error: null, cleanupError: null }],
});
function broken({ mappedFailure = false, unrelatedFailure = false, effective = true } = {}) {
  const cell = baseline();
  cell.transformed = true;
  if (mappedFailure) cell.existing[0] = { ...cell.existing[0], status: 'failed', diagnostics: ['focus escaped'] };
  if (unrelatedFailure) cell.existing[1] = { ...cell.existing[1], status: 'failed', diagnostics: ['different behavior'] };
  if (effective) cell.oracle[0] = {
    ...cell.oracle[0], error: 'consumer assertion',
    firstDivergence: { step: 'reverse loop', actual: 'outside', expected: 'inside' },
  };
  return cell;
}

test('a new criterion-linked failure counts only with an observed consumer violation', () => {
  const result = classifyCell(plan, plan.variants[1], baseline(), broken({ mappedFailure: true }));
  assert.equal(result.verdict, 'caught');
  assert.equal(result.firstDivergence.step, 'reverse loop');
  assert.deepEqual(result.criterionLinkedExistingDiagnostics[0].diagnostics, ['focus escaped']);
});

test('unrelated failures do not masquerade as detection of the selected criterion', () => {
  const result = classifyCell(plan, plan.variants[1], baseline(), broken({ unrelatedFailure: true }));
  assert.equal(result.verdict, 'missed');
  assert.equal(result.unrelatedExistingFailures.length, 1);
});

test('a passing target oracle excludes a repaired or ineffective mutation even if a check fails', () => {
  assert.equal(classifyCell(plan, plan.variants[1], baseline(), broken({ mappedFailure: true, effective: false })).verdict, 'ineffective-mutation');
});

test('untransformed input cannot become a caught behavioral regression', () => {
  const cell = broken({ mappedFailure: true });
  cell.transformed = false;
  assert.equal(classifyCell(plan, plan.variants[1], baseline(), cell).verdict, 'ineffective-mutation');
});

test('a baseline failure is excluded instead of being credited again on a mutant', () => {
  const old = baseline();
  old.existing[0].status = 'failed';
  const result = summarize(plan, { baseline: old, broken: broken({ mappedFailure: true }), legal: baseline() });
  assert.equal(result.detection.denominator, 0);
  assert.equal(result.falseAlarms.denominator, 0);
  assert.equal(result.detection.rate, null);
  assert.equal(result.outcomes[1].verdict, 'baseline-failure');
});

test('legal customization rejects are separate false alarms, with a legal oracle positive control', () => {
  const legal = broken({ mappedFailure: true, effective: false });
  assert.equal(classifyCell(plan, plan.variants[2], baseline(), legal).verdict, 'false-alarm');
  legal.oracle[0].firstDivergence = { step: 'content missing', actual: false, expected: true };
  legal.oracle[0].error = 'disputed legal premise';
  assert.equal(classifyCell(plan, plan.variants[2], baseline(), legal).verdict, 'unresolved');
});

test('setup, compilation and cleanup failures never supply behavioral detection', () => {
  assert.equal(classifyCell(plan, plan.variants[1], baseline(), { ready: false, reason: 'compilation failed' }).verdict, 'unresolved');
  for (const field of ['error', 'cleanupError']) {
    const cell = broken({ mappedFailure: true, effective: false });
    cell.oracle[0][field] = 'fixture unavailable';
    assert.equal(classifyCell(plan, plan.variants[1], baseline(), cell).verdict, 'unresolved');
  }
});

test('detection and false-alarm denominators do not absorb missing or excluded cases', () => {
  const legal = broken({ mappedFailure: true, effective: false });
  const result = summarize(plan, { baseline: baseline(), broken: broken(), legal });
  assert.deepEqual(result.detection, { caught: 0, missed: 1, denominator: 1, rate: 0 });
  assert.deepEqual(result.falseAlarms, { rejectedLegal: 1, acceptedLegal: 0, denominator: 1, rate: 1 });
  assert.equal(result.heldOut.denominator, null);
  assert.equal(result.repairs.failed, null);
});

test('check identity changes are unresolved even if aggregate pass/fail counts match', () => {
  const cell = broken({ mappedFailure: true });
  cell.existing[0].fullName = 'substituted check';
  assert.equal(classifyCell(plan, plan.variants[1], baseline(), cell).verdict, 'unresolved');
});
