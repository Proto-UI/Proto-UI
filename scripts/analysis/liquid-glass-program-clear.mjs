import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const PROGRAM = 'packages/adapters/base/src/material/program.ts';
const HELPER = 'packages/adapters/base/src/material/prefilter.ts';
const KERNEL = 'packages/adapters/base/src/material/liquidgl-kernel.generated.ts';
const ENTRY_NAME = '__liquid_program_clear_entry__.ts';
const ENTRY_CONTENTS = `export { createWebOpticalProgram } from './${PROGRAM}';
export { createWebOpticalPrefilter } from './${HELPER}';
`;
const REGRESSION_SHA = '19d175f454468fa27364c8283e084f3bb7a1016b';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// This existing neutral regular profile is shared by the exact regression
// source and the candidate. style-fill selects each revision's tint algorithm;
// its intentional source-tone change is not a program.clear() regression.
const CONTROL = {
  profile: 'fixed-regular-neutral',
  kernel: {
    path: KERNEL,
    sha256: '61fe78127858f4ed3fbcfb48caef815bbcf8c1a8ef36f603deafe7eb3613da44',
  },
  shaders: [
    { kind: 'vertex', sha256: 'c61427a859d0a9e4c8ce0bed53ba989b4c8f2cd33be07400ae163d400ba515d9' },
    {
      kind: 'fragment',
      sha256: 'bfff4f7c27c5dff34bd8f491e544a837b3f600696f9c54da9f87a86b6089c7f1',
    },
  ],
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
};

export function assertProgramClearEvidence(evidence) {
  assert.deepEqual(
    evidence.map((row) => row.label),
    ['before', 'after']
  );
  const [before, after] = evidence;
  assert.deepEqual(
    evidence.map(({ prefilterSelection }) => prefilterSelection),
    ['historical-auto', 'injected-gpu-factory'],
    'Lifecycle controls must explicitly select their real GPU paths'
  );
  for (const row of evidence) {
    assert.equal(row.profile, CONTROL.profile);
    assert.deepEqual(row.frame, CONTROL.frame, `${row.label}: lifecycle frame/profile drift`);
    for (const phase of ['first', 'second']) {
      // initialize() submits the material pair before source preparation's own
      // shaders. Observe both initial creation and the recreation after clear.
      assert.deepEqual(
        row.shaders.filter((entry) => entry.phase === phase).slice(0, 2),
        CONTROL.shaders.map((shader) => ({ phase, ...shader })),
        `${row.label}/${phase}: actual neutral material shader drift`
      );
    }
    assert.equal(row.experimentalGpuControl, true);
    assert.equal(row.first.success, true, `${row.label}: first render is not a valid control`);
    assert.equal(row.first.gpuPreparations, 1);
    assert.equal(row.first.cpuPreparations, 0);
    assert.deepEqual(row.first.imageSize, { width: 64, height: 32 });
    assert.match(row.first.imageSha256, /^[a-f0-9]{64}$/);
    assert.equal(row.afterClear.sourcePreparationCacheEntries, 0);
    assert.equal(row.afterDispose.sourcePreparationCacheEntries, 0);
    assert.equal(row.afterDispose.sourcePreparationGpuCacheBytes, 0);
  }
  assert.equal(before.second.success, false, 'The exact old program did not reproduce the defect');
  assert.equal(before.second.error, 'Error: gpu-prefilter-failed', 'Unexpected old-control error');
  assert.ok(
    before.errors.some((entry) => entry.phase === 'second' && [1281, 1282].includes(entry.code)),
    'Old control lacks the targeted GL error'
  );
  assert.equal(before.reboundRetiredProgram, true);
  assert.notEqual(before.lastProgramUseAfterClear, null);
  assert.equal(after.lastProgramUseAfterClear, null);
  assert.equal(after.second.success, true, after.second.error);
  assert.deepEqual(after.second.imageSize, { width: 64, height: 32 });
  assert.equal(after.second.gpuPreparations, 2);
  assert.equal(after.second.cpuPreparations, 0);
  assert.equal(after.second.imageSha256, after.first.imageSha256);
  assert.equal(after.first.imageSha256, before.first.imageSha256);
  assert.equal(after.reboundRetiredProgram, false);
  assert.deepEqual(after.errors, []);
  assert.equal(after.disposalError, null);
}

/** Actual program modules and actual WebGL; this does not join or alter either
 * the byte matrix or the frame-budget timed windows. */
export async function collectProgramClearRegression(modules) {
  const results = [];
  const digest = async (value) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          typeof value === 'string' ? new TextEncoder().encode(value) : value
        )
      ),
      (byte) => byte.toString(16).padStart(2, '0')
    ).join('');
  for (const { label, moduleUrl, prefilterSelection } of modules) {
    const { createWebOpticalProgram, createWebOpticalPrefilter } = await import(moduleUrl);
    if (!['historical-auto', 'injected-gpu-factory'].includes(prefilterSelection))
      throw new Error(`Unknown GPU lifecycle selection: ${prefilterSelection}`);
    if (typeof createWebOpticalPrefilter !== 'function')
      throw new Error('Real prefilter module export unavailable');
    const scope = document.createElement('div');
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 416;
    sourceCanvas.height = 161;
    const context = sourceCanvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Real source canvas unavailable');
    context.fillStyle = '#000';
    context.fillRect(0, 0, 416, 161);
    const canvas = document.createElement('canvas');
    scope.append(sourceCanvas, canvas);
    document.body.append(scope);
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
    });
    if (!gl) throw new Error('Real program WebGL context unavailable');
    const row = {
      label,
      profile: 'fixed-regular-neutral',
      prefilterSelection,
      experimentalGpuControl: true,
      first: {},
      second: {},
      trace: [],
      errors: [],
      disposalError: null,
    };
    results.push(row);
    let phase = 'first',
      nextId = 0,
      lastProgramUse = null;
    const ids = new WeakMap();
    const id = (object) => {
      if (object === null) return null;
      if (!ids.has(object)) ids.set(object, ++nextId);
      return ids.get(object);
    };
    for (const name of ['useProgram', 'deleteProgram']) {
      const original = gl[name].bind(gl);
      gl[name] = (program) => {
        const programId = id(program);
        row.trace.push({ phase, call: name, program: programId });
        if (name === 'useProgram') lastProgramUse = programId;
        return original(program);
      };
    }
    const originalError = gl.getError.bind(gl);
    gl.getError = () => {
      // Observe the application's existing error consumption. An extra getError
      // in useProgram/deleteProgram could consume and hide the target defect.
      const code = originalError();
      if (code !== gl.NO_ERROR) row.errors.push({ phase, code, afterCall: row.trace.length });
      return code;
    };
    const shaderKinds = new WeakMap();
    const shaderInputs = [];
    const originalCreateShader = gl.createShader.bind(gl);
    gl.createShader = (kind) => {
      const shader = originalCreateShader(kind);
      if (shader) shaderKinds.set(shader, kind);
      return shader;
    };
    const originalShaderSource = gl.shaderSource.bind(gl);
    gl.shaderSource = (shader, source) => {
      const kind = shaderKinds.get(shader);
      shaderInputs.push({
        phase,
        kind:
          kind === gl.VERTEX_SHADER
            ? 'vertex'
            : kind === gl.FRAGMENT_SHADER
              ? 'fragment'
              : 'unknown',
        source,
      });
      // Forward the original shader unchanged. No added GL query consumes the
      // old error or changes the selected program, profile, or GPU backend.
      return originalShaderSource(shader, source);
    };
    const program = createWebOpticalProgram(
      canvas,
      null,
      prefilterSelection === 'historical-auto' ? 'auto' : createWebOpticalPrefilter
    );
    const frame = {
      source: {
        canvas: sourceCanvas,
        scope,
        revision: 1,
        width: 416,
        height: 161,
        pixels: new Uint8Array(context.getImageData(0, 0, 416, 161).data),
      },
      geometry: { width: 64, height: 32, radius: 16, dpr: 1, bounds: [0, 0, 1, 1] },
      pressed: false,
      variant: 'regular',
      // Deliberately omit both tint and contact: both actual source versions
      // select the unchanged fixed regular neutral shader with this input.
      fill: [0, 0, 0, 1],
      foreground: [1, 1, 1, 1],
    };
    row.frame = {
      sourceWidth: 416,
      sourceHeight: 161,
      sourceBytes: frame.source.pixels.length,
      sourcePixelsSha256: await digest(frame.source.pixels),
      geometry: frame.geometry,
      pressed: frame.pressed,
      variant: frame.variant,
      tint: frame.tint ?? null,
      contact: frame.contact ?? null,
      fill: frame.fill,
      foreground: frame.foreground,
    };
    const render = async () => {
      try {
        const image = program.render(frame);
        if (!image.startsWith('data:image/png;'))
          throw new Error('Program did not encode an owned PNG');
        const decoded = new Image();
        decoded.src = image;
        await decoded.decode();
        return {
          success: true,
          imageSha256: await digest(image),
          imageSize: { width: decoded.naturalWidth, height: decoded.naturalHeight },
          gpuPreparations: program.inspect().gpuSourcePreparations,
          cpuPreparations: program.inspect().cpuSourcePreparations,
        };
      } catch (error) {
        return { success: false, error: String(error), resources: program.inspect() };
      }
    };
    try {
      row.first = await render();
      phase = 'clear';
      program.clear();
      row.afterClear = program.inspect();
      row.lastProgramUseAfterClear = lastProgramUse;
      phase = 'second';
      row.second = await render();
    } finally {
      phase = 'dispose';
      try {
        program.dispose();
      } catch (error) {
        row.disposalError = String(error);
      }
      row.afterDispose = program.inspect();
      scope.remove();
    }
    row.shaders = await Promise.all(
      shaderInputs.map(async ({ phase, kind, source }) => ({
        phase,
        kind,
        sha256: await digest(source),
      }))
    );
    const retired = new Set();
    row.reboundRetiredProgram = row.trace.some((entry) => {
      if (entry.call === 'deleteProgram') retired.add(entry.program);
      return entry.call === 'useProgram' && entry.program !== null && retired.has(entry.program);
    });
  }
  return results;
}

async function observe(output, regressionRoot) {
  const root = process.cwd();
  await mkdir(output, { recursive: true });
  const report = {
    schemaVersion: 3,
    started: new Date().toISOString(),
    probeSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    control: CONTROL,
    sources: [],
    environment: { node: process.version, headless: true },
    failures: [],
    limitations: [
      'Untimed program-lifetime control on one real browser/renderer, not a performance or physical display claim.',
      'Only application getError calls are observed; no extra call consumes the GL error.',
      'Both controls deliberately execute GPU preparation: the old source receives historical auto; the candidate receives its actual prefilter factory. This does not exercise or benchmark the candidate default CPU policy.',
      'Cross-source image equality is scoped to the frozen shared neutral regular profile, not style-fill algorithms that changed between revisions. The earlier style-fill mismatch remains a separate historical observation.',
    ],
  };
  let browser;
  try {
    const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
    assert.equal(git(regressionRoot, ['rev-parse', 'HEAD']), REGRESSION_SHA);
    const modules = [];
    for (const [label, sourceRoot] of [
      ['before', regressionRoot],
      ['after', root],
    ]) {
      assert.equal(
        git(sourceRoot, ['status', '--short']),
        '',
        `${label} source must be an exact clean checkout`
      );
      const bundle = await build({
        absWorkingDir: sourceRoot,
        stdin: {
          contents: ENTRY_CONTENTS,
          sourcefile: ENTRY_NAME,
          resolveDir: sourceRoot,
          loader: 'ts',
        },
        bundle: true,
        write: false,
        platform: 'browser',
        format: 'esm',
        target: 'es2022',
        metafile: true,
        nodePaths: [path.join(root, 'node_modules')],
      });
      const bytes = bundle.outputFiles[0].contents;
      const source = {
        label,
        prefilterSelection: label === 'before' ? 'historical-auto' : 'injected-gpu-factory',
        sha: git(sourceRoot, ['rev-parse', 'HEAD']),
        tree: git(sourceRoot, ['rev-parse', 'HEAD^{tree}']),
        bundleSha256: sha256(bytes),
        syntheticEntry: {
          path: ENTRY_NAME,
          contents: ENTRY_CONTENTS,
          sha256: sha256(ENTRY_CONTENTS),
          purpose: 'Re-export actual unchanged program and helper modules from this checkout.',
        },
        inputs: {},
      };
      for (const input of Object.keys(bundle.metafile.inputs)) {
        if (input === ENTRY_NAME) continue;
        assert.ok(
          !path.isAbsolute(input) && !input.startsWith('../'),
          'Bundle escaped its source checkout'
        );
        source.inputs[input] = {
          sha256: sha256(await readFile(path.join(sourceRoot, input))),
          blob: git(sourceRoot, ['rev-parse', `HEAD:${input}`]),
        };
      }
      assert.ok(
        source.inputs[PROGRAM] && source.inputs[HELPER] && source.inputs[KERNEL],
        'Missing real module inputs'
      );
      assert.equal(
        source.inputs[KERNEL].sha256,
        CONTROL.kernel.sha256,
        `${label}: the frozen common neutral kernel changed`
      );
      report.sources.push(source);
      modules.push({
        label,
        prefilterSelection: source.prefilterSelection,
        moduleUrl: `data:text/javascript;base64,${Buffer.from(bytes).toString('base64')}`,
      });
    }
    const { launchBrowser } = await import(
      pathToFileURL(path.join(root, 'apps/www/src/content/docs/zh-cn/browser-harness.ts')).href
    );
    browser = await launchBrowser();
    report.environment.browser = browser.version();
    const session = await browser.newBrowserCDPSession();
    report.environment.gpu = (await session.send('SystemInfo.getInfo')).gpu;
    await session.detach();
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const url = 'https://liquid-program-clear.test/';
    await context.route('**/*', (route) =>
      route.request().url() === url
        ? route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<!doctype html><title>Owned program lifetime evidence</title>',
          })
        : route.abort()
    );
    const page = await context.newPage();
    page.on('pageerror', (error) => report.failures.push(String(error)));
    await page.goto(url);
    report.evidence = await page.evaluate(collectProgramClearRegression, modules);
    assertProgramClearEvidence(report.evidence);
    for (const source of report.sources) {
      const sourceRoot = source.label === 'before' ? regressionRoot : root;
      assert.equal(git(sourceRoot, ['rev-parse', 'HEAD']), source.sha);
      assert.equal(git(sourceRoot, ['status', '--short']), '');
      for (const [input, expected] of Object.entries(source.inputs))
        assert.equal(
          sha256(await readFile(path.join(sourceRoot, input))),
          expected.sha256,
          `${source.label} source drift: ${input}`
        );
    }
  } catch (error) {
    report.failures.push(String(error));
  } finally {
    await browser?.close().catch((error) => report.failures.push(String(error)));
    report.ended = new Date().toISOString();
    await writeFile(path.join(output, 'program-clear.json'), JSON.stringify(report, null, 2));
  }
  assert.deepEqual(report.failures, []);
  console.log(
    JSON.stringify({
      sources: report.sources.map(({ label, sha, bundleSha256, prefilterSelection }) => ({
        label,
        sha,
        bundleSha256,
        prefilterSelection,
      })),
      evidence: report.evidence.map(
        ({ label, profile, prefilterSelection, first, second, errors, reboundRetiredProgram }) => ({
          label,
          profile,
          prefilterSelection,
          first,
          second,
          errors,
          reboundRetiredProgram,
        })
      ),
    })
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(
    process.argv.length,
    4,
    'Usage: node --import tsx liquid-glass-program-clear.mjs OUTPUT REGRESSION_SOURCE'
  );
  await observe(path.resolve(process.argv[2]), path.resolve(process.argv[3]));
}
