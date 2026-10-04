// @vitest-environment node
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBrowserCompiler, type BrowserCompiler } from '../src/browser/engine';
import { createBrowserCompilerClient } from '../src/browser/client';
import {
  BROWSER_COMPILER_LIMITS,
  type BrowserCompileRequest,
  type BrowserCompilerBuild,
} from '../src/browser/protocol';
import { compilePrototype } from '../src/memory';
import { startBrowserFixture } from './browser-fixture';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const request: BrowserCompileRequest = {
  format: 1,
  revision: 'closed-graph',
  source: `import {definePrototype} from '@proto.ui/core';
import apply from './bridge';
export default definePrototype({name:'Unicode编译😀',setup(def){apply();}});`,
  options: {
    fileName: '演示/entry.proto.ts',
    profile: 'web-component-source-v1',
    files: {
      '演示/bridge.ts': `export {default} from './hook';`,
      '演示/hook.ts': `import {defineAsHook} from '@proto.ui/core';
export default defineAsHook({name:'逻辑😀',setup(def){
  const ready=def.state.bool('准备',false);
  def.expose.state('ready',ready);
}});`,
    },
  },
};

function canonical(input: BrowserCompileRequest) {
  const result = compilePrototype(input.source, input.options);
  return result.ok
    ? {
        ok: true,
        revision: input.revision,
        source: result.value.ir.source,
        output: result.value.output,
      }
    : { ok: false, revision: input.revision, phase: 'compile', diagnostics: result.diagnostics };
}

describe('canonical compiler in actual QuickJS WASM', () => {
  let directory: string;
  let bundle: string;
  let build: BrowserCompilerBuild;
  let compiler: BrowserCompiler | undefined;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'proto-browser-compiler-'));
    await promisify(execFile)(process.execPath, ['scripts/compiler/build-browser.mjs', directory], {
      cwd: root,
    });
    bundle = await readFile(path.join(directory, 'compiler.js'), 'utf8');
    build = JSON.parse(await readFile(path.join(directory, 'build.json'), 'utf8'));
    compiler = await createBrowserCompiler(bundle, build);
  }, 60_000);

  afterAll(async () => {
    compiler?.dispose();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('preserves Unicode graph/artifact identity and source-located rejection without evaluating input', () => {
    const result = compiler!.compile(request);
    expect(result.ok).toBe(true);
    expect(result).toEqual(canonical(request));
    expect(
      compiler!.compile({
        ...request,
        options: {
          ...request.options,
          files: Object.fromEntries(Object.entries(request.options.files!).reverse()),
        },
      })
    ).toEqual(result);

    const embeddedNul = { ...request, source: request.source + '\n/* embedded\0编译 */' };
    const expectedNul = canonical(embeddedNul);
    expect(expectedNul.ok).toBe(true);
    expect(compiler!.compile(embeddedNul)).toEqual(expectedNul);

    const effect = {
      ...request,
      revision: 'effectful-import',
      options: {
        ...request.options,
        files: {
          ...request.options.files,
          '演示/hook.ts': `throw new Error('Authored code must never execute');`,
        },
      },
    };
    const rejected = compiler!.compile(effect);
    expect(rejected).toEqual(canonical(effect));
    expect(rejected).toMatchObject({
      ok: false,
      phase: 'compile',
      diagnostics: [{ code: 'PUI1004', span: { file: '演示/hook.ts', line: 1, column: 1 } }],
    });
  });

  it('emits complete GPUI artifacts without Node globals, including Unicode public fields', () => {
    const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'NativeUnicode',setup(def){
  def.props.define({'标签雪😀':{type:'string'}});
  def.props.setDefaults({'标签雪😀':'默认'});
  const ready=def.state.bool('ready',false);
  def.expose.state('状态😀',ready);
}});`;
    const input: BrowserCompileRequest = {
      format: 1,
      revision: 'native-gpui',
      source,
      options: { fileName: 'native.proto.ts', profile: 'gpui-source-v1' },
    };
    const expected = canonical(input);
    expect(expected.ok).toBe(true);
    const result = compiler!.compile(input);
    expect(result.ok, JSON.stringify(result.ok ? null : result)).toBe(true);
    expect(result).toEqual(expected);
  });

  it('rejects initialization through the promised API when Worker construction is unavailable', async () => {
    // The Node fixture has no browser Worker; no timers or fabricated transport are needed.
    const initialization = createBrowserCompilerClient(bundle, build);
    await expect(initialization).rejects.toBeInstanceOf(ReferenceError);
  });

  it('binds running revisions and queued source graphs to the submitted edit in a real Worker', async () => {
    const fixture = await startBrowserFixture('wasm-request-snapshot');
    try {
      const page = await fixture.browser.newPage();
      await page.route('**/__wasm_request_snapshot__', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>WASM request snapshot</title>',
        })
      );
      await page.goto(`${fixture.baseUrl}/__wasm_request_snapshot__`);
      await page.addScriptTag({
        type: 'module',
        content: `import {createBrowserCompilerClient} from ${JSON.stringify(`/@fs/${path.join(root, 'packages/compiler/src/browser/client.ts')}`)};
globalThis.__wasmCompilerClient = createBrowserCompilerClient;`,
      });
      await page.waitForFunction(() => '__wasmCompilerClient' in globalThis);
      const observed = await page.evaluate(
        async ({ bundle, build, input }) => {
          const factory = (
            globalThis as unknown as {
              __wasmCompilerClient: typeof createBrowserCompilerClient;
            }
          ).__wasmCompilerClient;
          const client = await factory(bundle, build);
          const outcome = (promise: Promise<{ result: unknown }>) =>
            promise.then(
              (response) => ({ result: response.result }),
              (error: Error) => ({ error: error.name, message: error.message })
            );
          try {
            const running = structuredClone(input);
            const runningResult = outcome(client.compile(running));
            running.revision = 'mutated-after-running-submit';
            const first = await runningResult;

            const superseded = outcome(client.compile(structuredClone(input)));
            const queued = {
              ...input,
              options: { ...input.options, files: { ...input.options.files } },
            };
            const queuedResult = outcome(client.compile(queued));
            queued.revision = 'mutated-after-queue-submit';
            queued.source = queued.source.replace('Unicode编译😀', 'ChangedAfterSubmit');
            queued.options.files!['演示/hook.ts'] =
              `throw new Error('Mutated graph must not compile');`;
            return { running: first, superseded: await superseded, queued: await queuedResult };
          } finally {
            client.dispose();
          }
        },
        { bundle, build, input: request }
      );
      expect(observed.running).toEqual({ result: canonical(request) });
      expect(observed.superseded).toMatchObject({ error: 'AbortError' });
      expect(observed.queued).toEqual({ result: canonical(request) });
    } finally {
      await fixture.close();
    }
  }, 120_000);

  it('rejects required target fields omitted by JSON serialization instead of choosing defaults', () => {
    const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'SerializedTarget',setup(def){}});`;
    const omitted = {
      ...request,
      source,
      options: Object.create({ fileName: 'explicit.proto.ts', profile: 'web-component-source-v1' }),
    };
    expect(compiler!.compile(omitted)).toMatchObject({
      ok: false,
      phase: 'host',
      error: { code: 'invalid-request' },
    });
  });

  it('rejects mismatched trusted bundles and distinguishes host limits from source diagnostics', async () => {
    await expect(
      createBrowserCompiler(bundle + '\nthrow new Error("changed trusted program");', build)
    ).rejects.toBeInstanceOf(TypeError);
    expect(
      compiler!.compile({ ...request, source: ' '.repeat(BROWSER_COMPILER_LIMITS.inputBytes + 1) })
    ).toMatchObject({ ok: false, phase: 'host', error: { code: 'input-limit' } });
    const cyclic: Record<string, unknown> = { id: 'web-component-source-v1' };
    cyclic.self = cyclic;
    expect(
      compiler!.compile({ ...request, options: { ...request.options, profile: cyclic as never } })
    ).toMatchObject({ ok: false, phase: 'host', error: { code: 'invalid-request' } });
    const target = { ...request, options: { ...request.options, profile: 'unimplemented-target' } };
    expect(compiler!.compile(target)).toEqual(canonical(target));
    expect(compiler!.compile(target)).toMatchObject({
      ok: false,
      phase: 'compile',
      diagnostics: [{ code: 'PUI4001' }],
    });
  });

  it('interrupts a nonterminating trusted call, recovers canonical compilation, and closes terminally', async () => {
    // Fault injection is in the trusted entry, never in evaluated authored source.
    const interruptedBundle =
      bundle +
      `
const original = __puiCompiler.compileCanonicalRequest;
__puiCompiler = { ...__puiCompiler, compileCanonicalRequest(serialized) {
  if (JSON.parse(serialized).revision === 'interrupt') while (true) {}
  return original(serialized);
} };`;
    const bounded = await createBrowserCompiler(interruptedBundle, {
      ...build,
      compilerSha256: createHash('sha256').update(interruptedBundle).digest('hex'),
    });
    try {
      expect(bounded.compile({ ...request, revision: 'interrupt' })).toMatchObject({
        ok: false,
        phase: 'host',
        error: { code: 'execution-limit' },
      });
      expect(bounded.compile(request)).toEqual(canonical(request));
      bounded.dispose();
      expect(bounded.compile(request)).toMatchObject({
        ok: false,
        phase: 'host',
        error: { code: 'disposed' },
      });
    } finally {
      bounded.dispose();
    }
  }, 40_000);
});
