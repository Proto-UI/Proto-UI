import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProgramClearEvidence,
  collectProgramClearRegression,
} from './liquid-glass-program-clear.mjs';

function validEvidence() {
  const first = {
    success: true,
    gpuPreparations: 1,
    imageSize: { width: 64, height: 32 },
    imageSha256: 'a'.repeat(64),
  };
  const shared = {
    first,
    afterClear: { sourcePreparationCacheEntries: 0 },
    afterDispose: { sourcePreparationCacheEntries: 0, sourcePreparationGpuCacheBytes: 0 },
    disposalError: null,
  };
  return [
    {
      ...structuredClone(shared),
      label: 'before',
      second: { success: false, error: 'Error: gpu-prefilter-failed' },
      errors: [{ phase: 'second', code: 1281 }],
      reboundRetiredProgram: true,
      lastProgramUseAfterClear: 2,
    },
    {
      ...structuredClone(shared),
      label: 'after',
      second: { ...structuredClone(first), gpuPreparations: 2 },
      errors: [],
      reboundRetiredProgram: false,
      lastProgramUseAfterClear: null,
    },
  ];
}

test('program lifecycle evidence requires the exact old failure and valid optical first renders', () => {
  assert.doesNotThrow(() => assertProgramClearEvidence(validEvidence()));
  const invalidators = [
    (rows) => {
      rows[0].first.success = false;
    },
    (rows) => {
      rows[0].first.gpuPreparations = 0;
    },
    (rows) => {
      rows[0].second.success = true;
    },
    (rows) => {
      rows[0].second.error = 'Error: unsafe-pixel-contrast';
    },
    (rows) => {
      rows[0].second.error = 'Error: gpu-frame-failed';
    },
    (rows) => {
      rows[0].errors[0].phase = 'first';
    },
    (rows) => {
      rows[0].errors[0].code = 0;
    },
    (rows) => {
      rows[0].reboundRetiredProgram = false;
    },
    (rows) => {
      rows[1].lastProgramUseAfterClear = 2;
    },
    (rows) => {
      rows[1].second.success = false;
    },
    (rows) => {
      rows[1].second.imageSha256 = 'b'.repeat(64);
    },
    (rows) => {
      rows[1].afterDispose.sourcePreparationCacheEntries = 1;
    },
    (rows) => {
      rows[1].errors.push({ phase: 'second', code: 1281 });
    },
    (rows) => {
      rows[1].disposalError = 'failed';
    },
  ];
  for (const invalidate of invalidators) {
    const rows = validEvidence();
    invalidate(rows);
    assert.throws(() => assertProgramClearEvidence(rows));
  }
});

test('program lifecycle collector has valid standalone browser transport syntax', () => {
  assert.equal(
    typeof Function(`return (${collectProgramClearRegression.toString()})`)(),
    'function'
  );
});
