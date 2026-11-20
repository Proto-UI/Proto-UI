import assert from 'node:assert/strict';
import test from 'node:test';
import {
  referencePrefilter,
  prefilterPixels,
  assertGpuPrefilterEvidence,
  collectGpuPrefilter,
  assertProgramIntegration,
  collectProgramIntegration,
} from './liquid-glass-gpu-prefilter.mjs';

test('independent oracle retains edge clamping and round-to-nearest bytes', () => {
  const input = new Uint8Array([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
  const expected = new Uint8Array([58, 58, 58, 255, 128, 128, 128, 255, 197, 197, 197, 255]);
  assert.deepEqual(referencePrefilter(input, 3, 1), expected);
  assert.deepEqual(referencePrefilter(input, 1, 3), expected);
  assert.deepEqual(
    referencePrefilter(new Uint8Array([1, 128, 255, 255]), 1, 1),
    new Uint8Array([1, 128, 255, 255])
  );
});

test('case generator keeps opaque, repeatable and unaligned pixel views', () => {
  const pixels = prefilterPixels(31, 13, 'seeded', 79);
  assert.equal(pixels.byteOffset, 1);
  assert.equal(pixels.length, 31 * 13 * 4);
  assert.deepEqual(pixels, prefilterPixels(31, 13, 'seeded', 79));
  assert.notDeepEqual(pixels, prefilterPixels(31, 13, 'seeded', 80));
  for (let i = 3; i < pixels.length; i += 4) assert.equal(pixels[i], 255);
  const white = prefilterPixels(2, 3, 'white', 81);
  assert.deepEqual(referencePrefilter(white, 2, 3), white);
});

function completeEvidence() {
  return {
    errors: [],
    supported: true,
    cases: [
      [1, 1],
      [1, 9],
      [9, 1],
      [2, 3],
      [3, 2],
      [7, 7],
      [31, 13],
      [256, 128],
      [513, 257],
      [1024, 512],
      [2048, 1],
      [1, 2048],
      [2048, 3],
      [3, 2048],
    ].flatMap(([width, height]) =>
      ['black', 'white', 'checker', 'rounding', 'impulse', 'seeded'].map((pattern) => ({
        width,
        height,
        pattern,
        comparedBytes: width * height * 4,
        mismatches: 0,
        actualSha256: 'f'.repeat(64),
        expectedSha256: 'f'.repeat(64),
        outputReleased: true,
        liveTexturesWithOutput: 3,
        liveTexturesAfterRelease: 2,
      }))
    ),
    capabilityRefusals: ['highp-22', 'highp-null', 'query-unavailable', 'vao-unavailable'].map(
      (name) => ({ name, returnedNull: true, allocations: 0 })
    ),
    stateRestoration: Array.from({ length: 85 }, () => ({ changed: [] })),
    afterDispose: Object.fromEntries(
      ['Buffer', 'Framebuffer', 'Program', 'Shader', 'Texture', 'VertexArray'].map((kind) => [
        kind,
        { created: 1, deleted: 1, live: 0, doubleDeletes: 0 },
      ])
    ),
    disposedFilterRejected: true,
    retainedOutputs: {
      expectedA: '1'.repeat(64),
      actualAAfterB: '1'.repeat(64),
      expectedB: '2'.repeat(64),
      actualBAfterReleaseA: '2'.repeat(64),
      liveTexturesWithBoth: 4,
      liveTexturesAfterReleaseA: 3,
      aReleased: true,
      bReleasedByDispose: true,
    },
    contextLoss: {
      observed: true,
      filterRejected: true,
      disposeThrew: false,
      outputReleaseThrew: false,
    },
  };
}

test('evidence acceptance rejects missing/duplicated bytes, leaks and capability/state failures', () => {
  assert.doesNotThrow(() => assertGpuPrefilterEvidence(completeEvidence()));
  const invalidate = [
    (e) => e.errors.push('readback failure'),
    (e) => {
      e.supported = false;
    },
    (e) => e.cases.pop(),
    (e) => {
      e.cases[1] = e.cases[0];
    },
    (e) => {
      e.cases[0].mismatches = 1;
    },
    (e) => {
      e.cases[0].actualSha256 = '0'.repeat(64);
    },
    (e) => {
      e.cases[0].comparedBytes--;
    },
    (e) => {
      e.cases[0].outputReleased = false;
    },
    (e) => {
      e.cases[0].liveTexturesAfterRelease++;
    },
    (e) => {
      e.retainedOutputs.actualAAfterB = e.retainedOutputs.expectedB;
    },
    (e) => {
      e.retainedOutputs.actualBAfterReleaseA = '0'.repeat(64);
    },
    (e) => {
      e.retainedOutputs.bReleasedByDispose = false;
    },
    (e) => {
      e.contextLoss.outputReleaseThrew = true;
    },
    (e) => {
      e.capabilityRefusals[0].allocations++;
    },
    (e) => {
      e.stateRestoration[1].changed = ['program'];
    },
    (e) => {
      e.afterDispose.Texture.deleted = 0;
    },
    (e) => {
      e.afterDispose.Texture.live = 1;
    },
    (e) => {
      e.afterDispose.VertexArray.doubleDeletes++;
    },
    (e) => {
      e.disposedFilterRejected = false;
    },
    (e) => {
      e.contextLoss.observed = false;
    },
    (e) => {
      e.contextLoss.filterRejected = false;
    },
    (e) => {
      e.contextLoss.disposeThrew = true;
    },
  ];
  for (const change of invalidate) {
    const evidence = completeEvidence();
    change(evidence);
    assert.throws(() => assertGpuPrefilterEvidence(evidence));
  }
});

test('browser collector and independent oracle can be serialized as executable functions', () => {
  // This checks transport syntax only; it does not claim a real GPU observation.
  for (const fn of [
    collectGpuPrefilter,
    collectProgramIntegration,
    referencePrefilter,
    prefilterPixels,
  ])
    assert.equal(typeof Function(`return (${fn.toString()})`)(), 'function');
});

function completeProgramEvidence() {
  const plan = [
    ['initial-a', 0, 1, null, false],
    ['after-clear-a', 0, 1, 'initial-a', false],
    ['source-b-contact', 1, 2, null, false],
    ['source-c-tint', 2, 3, null, false],
    ['source-d-contact-tint', 3, 4, null, false],
    ['cached-a', 0, 4, 'initial-a', true],
    ['revised-a', 0, 4, null, false],
    ['cached-b', 1, 4, 'source-b-contact', true],
    ['after-second-clear-c', 2, 1, 'source-c-tint', false],
  ];
  const evidence = {
    backendSelections: { gpu: 'injected-gpu-factory', cpu: 'production-default' },
    steps: [],
    clearBoundaries: [],
    cleanup: {},
    errors: [],
    sourceCanvasesRetired: true,
  };
  for (const backend of ['gpu', 'cpu']) {
    let metrics = {
      renders: 0,
      sourcePreparations: 0,
      sourcePreparationCacheHits: 0,
      sourcePreparationCacheEntries: 0,
      sourcePreparationCacheBytes: 0,
      cpuSourcePreparations: 0,
      gpuSourcePreparations: 0,
    };
    for (const [index, [name, sourceIndex, entries, sameAs, cacheHit]] of plan.entries()) {
      if (index === 1 || index === 8) {
        metrics = { ...metrics, sourcePreparationCacheEntries: 0, sourcePreparationCacheBytes: 0 };
        let boundary = evidence.clearBoundaries.find((item) => item.beforeCase === name);
        if (!boundary) {
          boundary = { beforeCase: name, backends: {} };
          evidence.clearBoundaries.push(boundary);
        }
        boundary.backends[backend] = {
          width: 0,
          height: 0,
          currentProgramNull: true,
          metrics: { ...metrics },
        };
      }
      const before = { ...metrics };
      metrics.renders++;
      metrics.sourcePreparationCacheEntries = entries;
      metrics.sourcePreparationCacheBytes = entries * 8192;
      if (cacheHit) metrics.sourcePreparationCacheHits++;
      else {
        metrics.sourcePreparations++;
        metrics[backend === 'gpu' ? 'gpuSourcePreparations' : 'cpuSourcePreparations']++;
      }
      evidence.steps[index] ??= {
        name,
        sourceIndex,
        sameAs,
        cacheHit,
        revision: name === 'revised-a' ? 2 : 1,
        geometry: { width: 80 + sourceIndex * 8, height: 38 + sourceIndex * 2, paintOutset: 8 },
        backends: {},
      };
      const geometry = evidence.steps[index].geometry;
      evidence.steps[index].backends[backend] = {
        before,
        after: { ...metrics },
        width: geometry.width + 16,
        height: geometry.height + 16,
        png: true,
        imageCharacters: 4096,
        pngSha256: (name === 'revised-a' ? 'e' : String(sourceIndex + 1)).repeat(64),
        glError: 0,
      };
    }
    evidence.cleanup[backend] = {
      width: 0,
      height: 0,
      contextLost: true,
      metrics: { ...metrics, sourcePreparationCacheEntries: 0, sourcePreparationCacheBytes: 0 },
      resources: Object.fromEntries(
        ['Buffer', 'Framebuffer', 'Program', 'Shader', 'Texture', 'VertexArray'].map((kind) => [
          kind,
          { created: 1, deleted: 1, live: 0, doubleDeletes: 0 },
        ])
      ),
    };
  }
  return evidence;
}

test('program integration rejects a delete-pending clear, rebuild error and incomplete sequence', () => {
  assert.doesNotThrow(() => assertProgramIntegration(completeProgramEvidence()));
  for (const invalidate of [
    (e) => e.errors.push({ stage: 'after-clear-a/gpu/render', message: 'gpu-prefilter-failed' }),
    (e) => {
      e.clearBoundaries[0].backends.gpu.currentProgramNull = false;
    },
    (e) => {
      e.steps[1].backends.gpu.error = 'gpu-frame-failed';
    },
    (e) => {
      e.steps[1].backends.gpu.glError = 1282;
    },
    (e) => e.steps.splice(1, 1),
    (e) => e.clearBoundaries.pop(),
  ]) {
    const evidence = completeProgramEvidence();
    invalidate(evidence);
    assert.throws(() => assertProgramIntegration(evidence));
  }
});

test('program integration retains backend identity, exact output, cache retirement and cleanup', () => {
  for (const invalidate of [
    (e) => {
      e.backendSelections.gpu = 'production-default';
    },
    (e) => {
      e.backendSelections.cpu = 'forced-cpu';
    },
    (e) => {
      e.steps[0].backends.gpu.pngSha256 = 'f'.repeat(64);
    },
    (e) => {
      e.steps[0].backends.gpu.after.gpuSourcePreparations = 0;
    },
    (e) => {
      e.steps[3].backends.cpu.png = false;
    },
    (e) => {
      e.steps[4].backends.gpu.width++;
    },
    (e) => {
      e.steps[5].backends.gpu.after.sourcePreparationCacheHits--;
    },
    (e) => {
      e.steps[6].backends.gpu.after.sourcePreparationCacheEntries = 5;
    },
    (e) => {
      e.steps[6].backends.cpu.after.sourcePreparations--;
    },
    (e) => {
      e.cleanup.gpu.resources.Texture.deleted--;
    },
    (e) => {
      e.cleanup.cpu.resources = {};
    },
    (e) => {
      e.cleanup.gpu.resources.VertexArray.doubleDeletes++;
    },
    (e) => {
      e.cleanup.cpu.contextLost = false;
    },
    (e) => {
      e.sourceCanvasesRetired = false;
    },
  ]) {
    const evidence = completeProgramEvidence();
    invalidate(evidence);
    assert.throws(() => assertProgramIntegration(evidence));
  }
});
