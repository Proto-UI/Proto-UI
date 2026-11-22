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
import {
  BROWSER_COMPILER_LIMITS,
  type BrowserCompileRequest,
  type BrowserCompilerBuild,
} from '../src/browser/protocol';
import { compilePrototype } from '../src/memory';
import { FileSourceGraph } from '../src/source-loader';

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
  const requestSha256 = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return result.ok
    ? {
        ok: true,
        revision: input.revision,
        requestSha256,
        source: result.value.ir.source,
        output: result.value.output,
      }
    : {
        ok: false,
        revision: input.revision,
        requestSha256,
        phase: 'compile',
        diagnostics: result.diagnostics,
      };
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
    const nul = {
      ...request,
      revision: 'nul-and-surrogate',
      source: request.source + '\n// \0 \ud800',
    };
    expect(compiler!.compile(nul)).toEqual(canonical(nul));
    expect(
      compiler!.compile({
        ...request,
        options: {
          ...request.options,
          files: Object.fromEntries(Object.entries(request.options.files!).reverse()),
        },
      })
    ).toMatchObject({ ...result, requestSha256: expect.any(String) });

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

  it('compiles the real Base Button closed graph and prepares all four native Web previews', async () => {
    const graph = new FileSourceGraph(root);
    const snapshot = await graph.load(
      await graph.entry('packages/prototypes/base/src/button/button.proto.ts')
    );
    expect(snapshot.failures).toEqual([]);
    for (const profile of [
      'web-component-source-v1',
      'react-dom-source-v1',
      'vue-source-v1',
      'vue2-source-v1',
    ] as const) {
      const input: BrowserCompileRequest = {
        format: 1,
        revision: profile,
        source: snapshot.files[snapshot.entry],
        preview: true,
        options: {
          fileName: snapshot.entry,
          profile,
          files: snapshot.files,
          sourceImports: snapshot.sourceImports,
        },
      };
      const started = performance.now();
      const result = compiler!.compile(input);
      console.info(
        'browser-wasm-base-button',
        profile,
        Math.round(performance.now() - started),
        'ms'
      );
      expect(result.ok, JSON.stringify(result)).toBe(true);
      if (!result.ok) continue;
      const expected = canonical(input);
      expect({ ...result, preview: undefined }).toEqual({ ...expected, preview: undefined });
      expect(result.preview?.entry).toBe('pui:generated/entry.ts');
      expect(result.preview?.modules[result.preview.entry]).toContain('pui:preview-budget');
      expect(result.preview?.executionBudget).toBe('100000-checkpoints-per-task-v1');
      expect(result.preview?.events).toEqual(['click']);
      expect(result.preview?.styles.join('\n')).toContain('user-select: none');
    }
  }, 150_000);

  it('does not grant executable or browsing template elements to the generated preview', () => {
    for (const tag of [
      'meta',
      'iframe',
      'script',
      'object',
      'embed',
      'base',
      'link',
      'a',
      'form',
    ]) {
      const input: BrowserCompileRequest = {
        ...request,
        source: `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'unsafe-preview',setup(def){return r=>r.el('${tag}');}});`,
        preview: true,
      };
      expect(compilePrototype(input.source, input.options).ok).toBe(true);
      expect(compiler!.compile(input)).toMatchObject({
        ok: false,
        phase: 'host',
        error: { code: 'preview-policy' },
      });
    }
  }, 30_000);

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
