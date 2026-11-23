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
    cpuPreparations: 0,
    imageSize: { width: 64, height: 32 },
    imageSha256: 'a'.repeat(64),
  };
  const shared = {
    profile: 'fixed-regular-neutral',
    frame: {
      sourceWidth: 416,
      sourceHeight: 161,
      sourceBytes: 267904,
      sourcePixelsSha256: '882792770227550d7a446738f645a4507c679ca3d041ce4c209af9db6fa055ed',
      geometry: { width: 64, height: 32, radius: 16, dpr: 1, bounds: [0, 0, 1, 1] },
      pressed: false,
      variant: 'regular',
      tint: null,
      contact: null,
      fill: [0, 0, 0, 1],
      foreground: [1, 1, 1, 1],
    },
    shaders: ['first', 'second'].flatMap((phase) => [
      {
        phase,
        kind: 'vertex',
        sha256: 'c61427a859d0a9e4c8ce0bed53ba989b4c8f2cd33be07400ae163d400ba515d9',
      },
      {
        phase,
        kind: 'fragment',
        sha256: 'bfff4f7c27c5dff34bd8f491e544a837b3f600696f9c54da9f87a86b6089c7f1',
      },
    ]),
    first,
    afterClear: { sourcePreparationCacheEntries: 0 },
    afterDispose: { sourcePreparationCacheEntries: 0, sourcePreparationGpuCacheBytes: 0 },
    disposalError: null,
    experimentalGpuControl: true,
  };
  return [
    {
      ...structuredClone(shared),
      label: 'before',
      prefilterSelection: 'historical-auto',
      second: { success: false, error: 'Error: gpu-prefilter-failed' },
      errors: [{ phase: 'second', code: 1281 }],
      reboundRetiredProgram: true,
      lastProgramUseAfterClear: 2,
    },
    {
      ...structuredClone(shared),
      label: 'after',
      prefilterSelection: 'injected-gpu-factory',
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
      rows[0].prefilterSelection = 'injected-gpu-factory';
    },
    (rows) => {
      rows[1].prefilterSelection = 'default-cpu';
    },
    (rows) => {
      rows[1].experimentalGpuControl = false;
    },
    (rows) => {
      rows[1].first.cpuPreparations = 1;
    },
    (rows) => {
      rows[1].second.cpuPreparations = 1;
    },
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
      // Same-generation recovery alone must not replace the cross-source
      // first-render equality control.
      rows[1].first.imageSha256 = rows[1].second.imageSha256 = 'b'.repeat(64);
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

test('lifecycle equality requires the shared neutral profile and exact admitted frame', () => {
  const invalidators = [
    (rows) => {
      rows[0].profile = 'style-fill';
    },
    (rows) => {
      rows[1].frame.tint = 'style-fill';
    },
    (rows) => {
      rows[0].frame.variant = 'clear';
    },
    (rows) => {
      rows[1].frame.contact = { x: 0.5, y: 0.5, deltaX: 0, deltaY: 0, strength: 0 };
    },
    (rows) => {
      rows[1].frame.pressed = true;
    },
    (rows) => {
      rows[0].frame.sourcePixelsSha256 = 'b'.repeat(64);
    },
    (rows) => {
      rows[1].frame.geometry.radius = 0;
    },
    (rows) => {
      rows[1].frame.foreground = [0, 0, 0, 1];
    },
    (rows) => {
      delete rows[1].frame;
    },
  ];
  for (const invalidate of invalidators) {
    const rows = validEvidence();
    invalidate(rows);
    assert.throws(() => assertProgramClearEvidence(rows));
  }
});

test('lifecycle equality binds the actual submitted shaders in each render phase', () => {
  for (const index of [0, 1]) {
    for (const phase of ['first', 'second']) {
      for (const kind of ['vertex', 'fragment']) {
        const rows = validEvidence();
        rows[index].shaders.find((entry) => entry.phase === phase && entry.kind === kind).sha256 =
          'b'.repeat(64);
        assert.throws(() => assertProgramClearEvidence(rows));
      }
    }
  }
  const missing = validEvidence();
  missing[1].shaders = missing[1].shaders.filter((entry) => entry.phase !== 'second');
  assert.throws(() => assertProgramClearEvidence(missing));
});

test('program lifecycle collector has valid standalone browser transport syntax', () => {
  assert.equal(
    typeof Function(`return (${collectProgramClearRegression.toString()})`)(),
    'function'
  );
});
