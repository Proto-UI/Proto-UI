import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// This is a separate real-WebGL correctness experiment. It never joins the
// frame-budget timed windows, changes their cadence, or claims display FPS.
const HELPER = 'packages/adapters/base/src/material/prefilter.ts';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/** Independent historical oracle: the original two rounded seven-tap passes.
 * Do not import either optimized CPU packing or the GPU shader as the oracle. */
export function referencePrefilter(pixels, width, height) {
  const weights = [1, 6, 15, 20, 15, 6, 1];
  let input = pixels;
  for (const horizontal of [true, false]) {
    const output = new Uint8Array(input.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const at = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          let sum = 0;
          for (let tap = -3; tap <= 3; tap++) {
            const sx = horizontal ? Math.max(0, Math.min(width - 1, x + tap)) : x;
            const sy = horizontal ? y : Math.max(0, Math.min(height - 1, y + tap));
            sum += input[(sy * width + sx) * 4 + channel] * weights[tap + 3];
          }
          output[at + channel] = Math.round(sum / 64);
        }
        output[at + 3] = 255;
      }
    }
    input = output;
  }
  return input;
}

export function prefilterPixels(width, height, pattern, seed) {
  // Keep an unaligned byte view: texture upload must honor its byteOffset.
  const storage = new Uint8Array(width * height * 4 + 3);
  const pixels = storage.subarray(1, storage.length - 2);
  let random = seed >>> 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        random ^= random << 13;
        random ^= random >>> 17;
        random ^= random << 5;
        pixels[at + channel] =
          pattern === 'black'
            ? 0
            : pattern === 'white'
              ? 255
              : pattern === 'checker'
                ? ((x + y + channel) % 2) * 255
                : pattern === 'rounding'
                  ? (x * 17 + y * 31 + channel * 23) % 256
                  : pattern === 'impulse'
                    ? (x === 0 && y === 0) || (x === width - 1 && y === height - 1)
                      ? 255
                      : 0
                    : random & 255;
      }
      pixels[at + 3] = 255;
    }
  }
  return pixels;
}

export function assertGpuPrefilterEvidence(evidence) {
  assert.deepEqual(evidence.errors, []);
  assert.equal(evidence.supported, true, 'This runner did not execute the GPU prefilter');
  assert.equal(evidence.cases.length, 84, 'Incomplete GPU byte matrix');
  const cases = new Set();
  for (const row of evidence.cases) {
    const key = `${row.width}x${row.height}/${row.pattern}`;
    assert.equal(cases.has(key), false, `Duplicate GPU case ${key}`);
    cases.add(key);
    assert.equal(row.comparedBytes, row.width * row.height * 4);
    assert.equal(
      row.mismatches,
      0,
      `${row.width}x${row.height}/${row.pattern}: ${JSON.stringify(row.firstMismatch)}`
    );
    assert.equal(row.actualSha256, row.expectedSha256);
    assert.match(row.actualSha256, /^[a-f0-9]{64}$/);
    assert.equal(row.outputReleased, true);
    assert.equal(row.liveTexturesWithOutput, 3, 'Two workspace textures and one owned output');
    assert.equal(row.liveTexturesAfterRelease, 2);
  }
  const expectedCases = [
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
    ['black', 'white', 'checker', 'rounding', 'impulse', 'seeded'].map(
      (pattern) => `${width}x${height}/${pattern}`
    )
  );
  assert.deepEqual([...cases].sort(), expectedCases.sort());
  assert.deepEqual(
    evidence.capabilityRefusals.map((row) => row.name),
    ['highp-22', 'highp-null', 'query-unavailable', 'vao-unavailable']
  );
  for (const refusal of evidence.capabilityRefusals) {
    assert.equal(refusal.returnedNull, true);
    assert.equal(refusal.allocations, 0);
  }
  assert.equal(evidence.stateRestoration.length, 85);
  for (const row of evidence.stateRestoration) assert.deepEqual(row.changed, [], row.case);
  assert.deepEqual(
    Object.keys(evidence.afterDispose).sort(),
    ['Buffer', 'Framebuffer', 'Program', 'Shader', 'Texture', 'VertexArray'].sort()
  );
  for (const resource of Object.values(evidence.afterDispose)) {
    assert.ok(resource.created > 0);
    assert.equal(resource.created, resource.deleted);
    assert.equal(resource.live, 0);
    assert.equal(resource.doubleDeletes, 0);
  }
  assert.equal(evidence.disposedFilterRejected, true);
  assert.equal(evidence.retainedOutputs.actualAAfterB, evidence.retainedOutputs.expectedA);
  assert.equal(evidence.retainedOutputs.actualBAfterReleaseA, evidence.retainedOutputs.expectedB);
  assert.notEqual(evidence.retainedOutputs.expectedA, evidence.retainedOutputs.expectedB);
  assert.equal(evidence.retainedOutputs.liveTexturesWithBoth, 4);
  assert.equal(evidence.retainedOutputs.liveTexturesAfterReleaseA, 3);
  assert.equal(evidence.retainedOutputs.aReleased, true);
  assert.equal(evidence.retainedOutputs.bReleasedByDispose, true);
  assert.equal(evidence.contextLoss.observed, true);
  assert.equal(evidence.contextLoss.filterRejected, true);
  assert.equal(evidence.contextLoss.disposeThrew, false);
  assert.equal(evidence.contextLoss.outputReleaseThrew, false);
}

// Self-contained browser collector: actual helper calls and actual readPixels.
export async function collectGpuPrefilter({ moduleUrl, referenceSource, pixelsSource }) {
  const { createWebOpticalPrefilter } = await import(moduleUrl);
  const reference = Function(`return (${referenceSource})`)();
  const makePixels = Function(`return (${pixelsSource})`)();
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    antialias: false,
  });
  if (!gl) throw new Error('Real WebGL context unavailable');
  const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const evidence = {
    supported: false,
    precision: precision && {
      precision: precision.precision,
      rangeMin: precision.rangeMin,
      rangeMax: precision.rangeMax,
    },
    cases: [],
    capabilityRefusals: [],
    stateRestoration: [],
    afterDispose: {},
    retainedOutputs: {},
    contextLoss: {},
    errors: [],
    limitations: [
      'One real browser/renderer; not all GPUs and not physical FPS or input latency.',
      'Capability refusal cases substitute only capability reports on the real context; they are not observations of low-precision or missing-VAO hardware.',
      'Case durations include validation readback and are correctness observations, not a throughput benchmark.',
    ],
  };
  const digest = async (bytes) =>
    Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
  const readback = gl.createFramebuffer();
  if (!readback) throw new Error('Evidence readback framebuffer unavailable');
  const arrays = gl.getExtension('OES_vertex_array_object');
  if (!arrays) throw new Error('Real VAO capability unavailable');
  // Evidence-owned sentinel state is allocated before helper resource accounting.
  const sentinels = {
    buffer: gl.createBuffer(),
    array: arrays.createVertexArrayOES(),
    textures: [gl.createTexture(), gl.createTexture()],
  };
  arrays.bindVertexArrayOES(sentinels.array);
  gl.bindBuffer(gl.ARRAY_BUFFER, sentinels.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  arrays.bindVertexArrayOES(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  const sentinelVertex = gl.createShader(gl.VERTEX_SHADER),
    sentinelFragment = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(
    sentinelVertex,
    'attribute vec2 position; void main() { gl_Position = vec4(position, 0., 1.); }'
  );
  gl.shaderSource(
    sentinelFragment,
    'precision mediump float; void main() { gl_FragColor = vec4(1.); }'
  );
  gl.compileShader(sentinelVertex);
  gl.compileShader(sentinelFragment);
  sentinels.program = gl.createProgram();
  gl.attachShader(sentinels.program, sentinelVertex);
  gl.attachShader(sentinels.program, sentinelFragment);
  gl.linkProgram(sentinels.program);
  if (!gl.getProgramParameter(sentinels.program, gl.LINK_STATUS))
    throw new Error('Evidence sentinel program failed');
  gl.deleteShader(sentinelVertex);
  gl.deleteShader(sentinelFragment);
  const switches = [
    gl.BLEND,
    gl.DITHER,
    gl.SCISSOR_TEST,
    gl.DEPTH_TEST,
    gl.STENCIL_TEST,
    gl.CULL_FACE,
    gl.SAMPLE_COVERAGE,
    gl.SAMPLE_ALPHA_TO_COVERAGE,
  ];
  const snapshotState = () => {
    const activeTexture = gl.getParameter(gl.ACTIVE_TEXTURE);
    const activeBinding = gl.getParameter(gl.TEXTURE_BINDING_2D);
    gl.activeTexture(gl.TEXTURE0);
    const texture0 = gl.getParameter(gl.TEXTURE_BINDING_2D);
    gl.activeTexture(activeTexture);
    return {
      activeTexture,
      activeBinding,
      texture0,
      program: gl.getParameter(gl.CURRENT_PROGRAM),
      buffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING),
      framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING),
      array: gl.getParameter(arrays.VERTEX_ARRAY_BINDING_OES),
      attribute0Buffer: gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
      attribute0Enabled: gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
      viewport: [...gl.getParameter(gl.VIEWPORT)],
      colorMask: [...gl.getParameter(gl.COLOR_WRITEMASK)],
      unpackAlignment: gl.getParameter(gl.UNPACK_ALIGNMENT),
      flipY: gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL),
      premultiply: gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL),
      enabled: switches.map((capability) => gl.isEnabled(capability)),
    };
  };
  const recordState = (name, before) => {
    const after = snapshotState();
    evidence.stateRestoration.push({
      case: name,
      changed: Object.keys(before).filter((key) =>
        Array.isArray(before[key])
          ? JSON.stringify(before[key]) !== JSON.stringify(after[key])
          : before[key] !== after[key]
      ),
    });
  };
  const setSentinelState = (enabled) => {
    gl.useProgram(enabled ? sentinels.program : null);
    arrays.bindVertexArrayOES(enabled ? sentinels.array : null);
    gl.bindBuffer(gl.ARRAY_BUFFER, enabled ? sentinels.buffer : null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, enabled ? readback : null);
    gl.viewport(...(enabled ? [3, 4, 5, 6] : [0, 0, canvas.width, canvas.height]));
    gl.colorMask(!enabled, true, !enabled, true);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, enabled ? 8 : 4);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, enabled);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, enabled);
    for (const capability of switches) enabled ? gl.enable(capability) : gl.disable(capability);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, enabled ? sentinels.textures[0] : null);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, enabled ? sentinels.textures[1] : null);
    if (!enabled) gl.activeTexture(gl.TEXTURE0);
  };
  const resources = {};
  for (const kind of ['Texture', 'Framebuffer', 'Program', 'Shader', 'Buffer', 'VertexArray']) {
    const owner = kind === 'VertexArray' ? arrays : gl;
    const suffix = kind === 'VertexArray' ? 'VertexArrayOES' : kind;
    const created = new Set(),
      deleted = new Set();
    let doubleDeletes = 0;
    const create = owner[`create${suffix}`].bind(owner),
      destroy = owner[`delete${suffix}`].bind(owner);
    owner[`create${suffix}`] = (...args) => {
      const object = create(...args);
      if (object) created.add(object);
      return object;
    };
    owner[`delete${suffix}`] = (object) => {
      if (created.has(object)) {
        if (deleted.has(object)) doubleDeletes++;
        deleted.add(object);
      }
      return destroy(object);
    };
    resources[kind] = () => ({
      created: created.size,
      deleted: deleted.size,
      doubleDeletes,
      live: [...created].filter((object) => owner[`is${suffix}`](object)).length,
    });
  }
  const allocations = () =>
    Object.values(resources).reduce((total, inspect) => total + inspect().created, 0);
  const readTexture = (texture, width, height) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, readback);
    try {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        throw new Error('Prefilter output is not a complete RGBA framebuffer');
      const actual = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, actual);
      if (gl.getError() !== gl.NO_ERROR || gl.isContextLost())
        throw new Error('GPU prefilter/readback failed');
      return actual;
    } finally {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  };
  const originalPrecision = gl.getShaderPrecisionFormat;
  const originalExtension = gl.getExtension;
  let helper, lossHelper, retainedB;
  try {
    try {
      for (const name of ['highp-22', 'highp-null', 'query-unavailable', 'vao-unavailable']) {
        gl.getShaderPrecisionFormat =
          name === 'query-unavailable'
            ? undefined
            : name === 'highp-null'
              ? () => null
              : name === 'highp-22'
                ? () => ({ precision: 22, rangeMin: 127, rangeMax: 127 })
                : originalPrecision;
        gl.getExtension =
          name === 'vao-unavailable'
            ? (extension) =>
                extension === 'OES_vertex_array_object'
                  ? null
                  : originalExtension.call(gl, extension)
            : originalExtension;
        const before = allocations();
        const refused = createWebOpticalPrefilter(gl);
        evidence.capabilityRefusals.push({
          name,
          returnedNull: refused === null,
          allocations: allocations() - before,
        });
        refused?.dispose();
      }
    } finally {
      gl.getShaderPrecisionFormat = originalPrecision;
      gl.getExtension = originalExtension;
    }
    setSentinelState(true);
    const constructionState = snapshotState();
    helper = createWebOpticalPrefilter(gl);
    recordState('construction', constructionState);
    if (!helper) return evidence;
    evidence.supported = true;
    const sizes = [
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
    ];
    const patterns = ['black', 'white', 'checker', 'rounding', 'impulse', 'seeded'];
    try {
      for (const [width, height] of sizes) {
        for (const [index, pattern] of patterns.entries()) {
          const seed = (0x71930a51 + width * 97 + height * 313 + index * 103) >>> 0;
          const input = makePixels(width, height, pattern, seed);
          setSentinelState(index % 2 === 0);
          const beforeState = snapshotState();
          const started = performance.now();
          const output = helper.filter(input, width, height);
          recordState(`${width}x${height}/${pattern}`, beforeState);
          const actual = readTexture(output.texture, width, height);
          const filterAndReadbackMs = performance.now() - started;
          const liveTexturesWithOutput = resources.Texture().live;
          output.release();
          output.release();
          const outputReleased = !gl.isTexture(output.texture);
          const liveTexturesAfterRelease = resources.Texture().live;
          const expected = reference(input, width, height);
          let mismatches = 0,
            firstMismatch = null;
          for (let at = 0; at < actual.length; at++) {
            if (actual[at] === expected[at]) continue;
            mismatches++;
            firstMismatch ??= {
              byte: at,
              x: Math.floor(at / 4) % width,
              y: Math.floor(at / 4 / width),
              channel: at % 4,
              expected: expected[at],
              actual: actual[at],
            };
          }
          evidence.cases.push({
            width,
            height,
            pattern,
            seed,
            comparedBytes: actual.length,
            mismatches,
            firstMismatch,
            actualSha256: await digest(actual),
            expectedSha256: await digest(expected),
            filterAndReadbackMs,
            liveTexturesWithOutput,
            outputReleased,
            liveTexturesAfterRelease,
          });
        }
      }
      // A cached source must survive a later preparation on shared workspace
      // textures. Releasing A must also leave B's independent output intact.
      const pixelsA = makePixels(9, 7, 'seeded', 193);
      const pixelsB = makePixels(9, 7, 'checker', 197);
      const retainedA = helper.filter(pixelsA, 9, 7);
      retainedB = helper.filter(pixelsB, 9, 7);
      evidence.retainedOutputs = {
        expectedA: await digest(reference(pixelsA, 9, 7)),
        expectedB: await digest(reference(pixelsB, 9, 7)),
        actualAAfterB: await digest(readTexture(retainedA.texture, 9, 7)),
        liveTexturesWithBoth: resources.Texture().live,
      };
      retainedA.release();
      retainedA.release();
      evidence.retainedOutputs.aReleased = !gl.isTexture(retainedA.texture);
      evidence.retainedOutputs.liveTexturesAfterReleaseA = resources.Texture().live;
      evidence.retainedOutputs.actualBAfterReleaseA = await digest(
        readTexture(retainedB.texture, 9, 7)
      );
    } finally {
      // Detach the evidence-owned FBO before testing helper ownership retirement.
      gl.bindFramebuffer(gl.FRAMEBUFFER, readback);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      helper.dispose();
      helper.dispose();
      evidence.retainedOutputs.bReleasedByDispose = retainedB
        ? !gl.isTexture(retainedB.texture)
        : false;
      retainedB?.release();
      retainedB?.release();
      try {
        helper.filter(makePixels(1, 1, 'white', 17), 1, 1);
        evidence.disposedFilterRejected = false;
      } catch (error) {
        evidence.disposedFilterRejected = true;
        evidence.disposedFilterRejection = String(error);
      }
      evidence.afterDispose = Object.fromEntries(
        Object.entries(resources).map(([kind, inspect]) => [kind, inspect()])
      );
    }
    lossHelper = createWebOpticalPrefilter(gl);
    if (!lossHelper) throw new Error('Unexpected capability change before context-loss check');
    const lossOutput = lossHelper.filter(makePixels(7, 5, 'seeded', 29), 7, 5);
    const loss = gl.getExtension('WEBGL_lose_context');
    if (!loss) throw new Error('This runner cannot exercise actual WebGL context loss');
    evidence.contextLoss.observed = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 2000);
      canvas.addEventListener(
        'webglcontextlost',
        (event) => {
          event.preventDefault();
          clearTimeout(timeout);
          resolve(true);
        },
        { once: true }
      );
      loss.loseContext();
    });
    try {
      lossHelper.filter(makePixels(7, 5, 'seeded', 31), 7, 5);
      evidence.contextLoss.filterRejected = false;
    } catch (error) {
      evidence.contextLoss.filterRejected = true;
      evidence.contextLoss.rejection = String(error);
    }
    try {
      lossHelper.dispose();
      lossHelper.dispose();
      evidence.contextLoss.disposeThrew = false;
    } catch (error) {
      evidence.contextLoss.disposeThrew = true;
      evidence.contextLoss.disposalError = String(error);
    }
    try {
      lossOutput.release();
      lossOutput.release();
      evidence.contextLoss.outputReleaseThrew = false;
    } catch (error) {
      evidence.contextLoss.outputReleaseThrew = true;
      evidence.contextLoss.outputReleaseError = String(error);
    }
  } catch (error) {
    evidence.errors.push(String(error));
  } finally {
    for (const current of [helper, lossHelper]) {
      try {
        current?.dispose();
      } catch (error) {
        evidence.errors.push(`Final helper cleanup: ${error}`);
      }
    }
    gl.deleteFramebuffer(readback);
    gl.deleteBuffer(sentinels.buffer);
    arrays.deleteVertexArrayOES(sentinels.array);
    gl.deleteProgram(sentinels.program);
    for (const texture of sentinels.textures) gl.deleteTexture(texture);
  }
  return evidence;
}

async function observe(output) {
  await mkdir(output, { recursive: true });
  const root = process.cwd();
  const source = await readFile(path.join(root, HELPER));
  const probe = await readFile(fileURLToPath(import.meta.url));
  const report = {
    schemaVersion: 1,
    started: new Date().toISOString(),
    source: {
      sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      helper: HELPER,
      helperSha256: sha256(source),
      probeSha256: sha256(probe),
    },
    environment: { node: process.version, headless: true },
    failures: [],
  };
  let browser;
  try {
    const compiled = await build({
      entryPoints: [path.join(root, HELPER)],
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'esm',
      target: 'es2022',
      metafile: true,
    });
    const code = compiled.outputFiles[0].contents;
    report.source.bundleSha256 = sha256(code);
    report.source.bundleInputs = compiled.metafile.inputs;
    const { launchBrowser } = await import(
      pathToFileURL(path.join(root, 'apps/www/src/content/docs/zh-cn/browser-harness.ts')).href
    );
    browser = await launchBrowser();
    report.environment.browser = browser.version();
    const session = await browser.newBrowserCDPSession();
    report.environment.gpu = (await session.send('SystemInfo.getInfo')).gpu;
    await session.detach();
    const context = await browser.newContext({ serviceWorkers: 'block' });
    // Fulfilled entirely in this owned browser. HTTPS gives WebCrypto a secure
    // test origin; no server, external page or network request is involved.
    const url = 'https://liquid-prefilter.test/';
    await context.route('**/*', (route) =>
      route.request().url() === url
        ? route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<!doctype html><title>Owned GPU prefilter evidence</title>',
          })
        : route.abort()
    );
    const page = await context.newPage();
    page.on('pageerror', (error) => report.failures.push(String(error)));
    await page.goto(url);
    report.evidence = await page.evaluate(collectGpuPrefilter, {
      moduleUrl: `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`,
      referenceSource: referencePrefilter.toString(),
      pixelsSource: prefilterPixels.toString(),
    });
    assertGpuPrefilterEvidence(report.evidence);
    assert.equal(
      sha256(await readFile(path.join(root, HELPER))),
      report.source.helperSha256,
      'Helper changed during observation'
    );
  } catch (error) {
    report.failures.push(String(error));
  } finally {
    await browser?.close().catch((error) => report.failures.push(String(error)));
    report.ended = new Date().toISOString();
    await writeFile(path.join(output, 'gpu-prefilter.json'), JSON.stringify(report, null, 2));
  }
  assert.equal(report.failures.length, 0, JSON.stringify(report.failures));
  console.log(
    JSON.stringify({
      source: report.source,
      cases: report.evidence.cases.length,
      mismatches: report.evidence.cases.reduce((n, row) => n + row.mismatches, 0),
      cleanup: report.evidence.afterDispose,
    })
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(
    process.argv.length,
    3,
    'Usage: node --import tsx liquid-glass-gpu-prefilter.mjs OUTPUT'
  );
  await observe(path.resolve(process.argv[2]));
}
