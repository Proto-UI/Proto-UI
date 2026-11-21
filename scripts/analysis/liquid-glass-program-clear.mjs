import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const PROGRAM = 'packages/adapters/base/src/material/program.ts';
const HELPER = 'packages/adapters/base/src/material/prefilter.ts';
const ENTRY_NAME = '__liquid_program_clear_entry__.ts';
const ENTRY_CONTENTS = `export { createWebOpticalProgram } from './${PROGRAM}';
export { createWebOpticalPrefilter } from './${HELPER}';
`;
const REGRESSION_SHA = '19d175f454468fa27364c8283e084f3bb7a1016b';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

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
  const digest = async (text) =>
    Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))),
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
      tint: 'style-fill',
      fill: [0, 0, 0, 1],
      foreground: [1, 1, 1, 1],
    };
    row.frame = {
      sourceWidth: 416,
      sourceHeight: 161,
      sourceBytes: frame.source.pixels.length,
      geometry: frame.geometry,
      tint: frame.tint,
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
    schemaVersion: 2,
    started: new Date().toISOString(),
    probeSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    sources: [],
    environment: { node: process.version, headless: true },
    failures: [],
    limitations: [
      'Untimed program-lifetime control on one real browser/renderer, not a performance or physical display claim.',
      'Only application getError calls are observed; no extra call consumes the GL error.',
      'Both controls deliberately execute GPU preparation: the old source receives historical auto; the candidate receives its actual prefilter factory. This does not exercise or benchmark the candidate default CPU policy.',
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
      assert.ok(source.inputs[PROGRAM] && source.inputs[HELPER], 'Missing real module inputs');
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
        ({ label, prefilterSelection, first, second, errors, reboundRetiredProgram }) => ({
          label,
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
