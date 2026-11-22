// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { compileFile, compilePrototype } from '../src/compile';
import { CompilerRejection, unknownDiagnosticSpan } from '../src/diagnostics';
import { diagnosticsJson, formatCompilerDiagnostic } from '../src/diagnostic-format';
import * as emitterMap from '../src/emitter-map';
import { FileSourceGraph } from '../src/source-loader';
import { validateIR } from '../src/ir-validation';
import { buildSourceMap } from '../src/source-map';
import type { CompilerDiagnostic, CompileResult } from '../src/ir';

const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'diagnostic-origin',setup(def){
  const enabled=def.state.bool('enabled',true);
  def.expose.state('enabled',enabled);
}});`;
let root: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'pui-diagnostic-origin-'));
  await writeFile(path.join(root, 'entry.proto.ts'), source);
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function diagnostic(result: CompileResult<unknown>): CompilerDiagnostic {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected the injected failure to reach the public boundary.');
  expect(result.diagnostics).toHaveLength(1);
  return result.diagnostics[0];
}

function unknownOrigin(value: CompilerDiagnostic, file: string) {
  expect(value.span).toEqual({
    file,
    start: -1,
    end: -1,
    line: 0,
    column: 0,
    endLine: 0,
    endColumn: 0,
  });
  const rendered = formatCompilerDiagnostic(value, { sources: { [file]: source } });
  expect(rendered).toContain(`${file} (source location unknown)`);
  // Supplying source text must not turn the sentinel's offsets into a fake
  // first-line caret. JSON preserves the same explicit unknown location.
  expect(rendered).not.toContain('1 |');
  expect(rendered).not.toContain(`${file}:1:1`);
  expect(diagnosticsJson([value]).diagnostics[0].span).toEqual(value.span);
}

describe('#1457 truthful diagnostic origin at public boundaries', () => {
  it('keeps the diagnostic sentinel out of valid IR and source maps', () => {
    const compiled = compilePrototype(source, { fileName: 'entry.proto.ts' });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const ir = structuredClone(compiled.value.ir);
    ir.setup.span = unknownDiagnosticSpan('entry.proto.ts');
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', category: 'invalid-ir' }],
    });
    expect(() =>
      buildSourceMap({
        file: 'Component.tsx',
        sources: [{ path: 'entry.proto.ts', content: source }],
        mappings: [
          { generatedLine: 1, generatedColumn: 1, source: unknownDiagnosticSpan('entry.proto.ts') },
        ],
      })
    ).toThrow(/must be an integer/);
  });
  it('retains missing-entry input classification and the requested source identity', async () => {
    const value = diagnostic(await compileFile('missing.proto.ts', { root }));
    expect(value).toMatchObject({ code: 'PUI1003', category: 'invalid-input' });
    expect(value.message).toContain('missing.proto.ts');
    unknownOrigin(value, 'missing.proto.ts');
  });

  it('retains missing-root input classification and a relative entry identity', async () => {
    const value = diagnostic(
      await compileFile('entry.proto.ts', { root: path.join(root, 'absent-root') })
    );
    expect(value).toMatchObject({ code: 'PUI1003', category: 'invalid-input' });
    unknownOrigin(value, 'entry.proto.ts');
  });

  it('retains a closed snapshot with no entry as invalid input without invented coordinates', async () => {
    const value = diagnostic(
      await compileFile('entry.proto.ts', {
        sourceSnapshot: { entry: 'entry.proto.ts', files: {} },
      })
    );
    expect(value).toMatchObject({
      code: 'PUI1003',
      category: 'invalid-input',
      message: expect.stringContaining('no entry'),
    });
    unknownOrigin(value, 'entry.proto.ts');
  });

  it('retains declared loader Error as invalid input', async () => {
    vi.spyOn(FileSourceGraph.prototype, 'load').mockRejectedValueOnce(
      new Error('declared source read rejection')
    );
    const value = diagnostic(await compileFile('entry.proto.ts', { root }));
    expect(value).toMatchObject({
      code: 'PUI1003',
      category: 'invalid-input',
      message: expect.stringContaining('declared source read rejection'),
    });
    unknownOrigin(value, 'entry.proto.ts');
  });

  for (const ErrorType of [TypeError, ReferenceError, RangeError]) {
    it(`preserves an unexpected loader ${ErrorType.name} and its original stack`, async () => {
      const error = new ErrorType('injected loader defect');
      vi.spyOn(FileSourceGraph.prototype, 'load').mockRejectedValueOnce(error);
      const value = diagnostic(await compileFile('entry.proto.ts', { root }));
      expect(value).toMatchObject({ code: 'PUI1999', category: 'compiler-defect' });
      expect(value.message).toContain(error.stack!);
      unknownOrigin(value, 'entry.proto.ts');
    });

    it(`preserves an unexpected closed-snapshot ${ErrorType.name} and its original stack`, async () => {
      const error = new ErrorType('injected snapshot defect');
      const files = Object.defineProperty({}, 'entry.proto.ts', {
        get() {
          throw error;
        },
      });
      const value = diagnostic(
        await compileFile('entry.proto.ts', { sourceSnapshot: { entry: 'entry.proto.ts', files } })
      );
      expect(value).toMatchObject({ code: 'PUI1999', category: 'compiler-defect' });
      expect(value.message).toContain(error.stack!);
      unknownOrigin(value, 'entry.proto.ts');
    });
  }

  it('does not relabel an unexpected Error past the loader as a source rejection', async () => {
    const error = new Error('injected post-load failure');
    const files = Object.defineProperty({}, 'entry.proto.ts', {
      get() {
        throw error;
      },
    });
    const value = diagnostic(
      await compileFile('entry.proto.ts', { sourceSnapshot: { entry: 'entry.proto.ts', files } })
    );
    expect(value).toMatchObject({ code: 'PUI1999', category: 'compiler-defect' });
    expect(value.message).toContain(error.stack!);
    unknownOrigin(value, 'entry.proto.ts');
  });

  it.each(['loader', 'snapshot'] as const)(
    'preserves a checked %s rejection and its real span',
    async (phase) => {
      const expected: CompilerDiagnostic = {
        code: 'PUI1006',
        category: 'unsupported-input',
        message: 'injected checked rejection',
        span: {
          file: 'dependency.proto.ts',
          start: 12,
          end: 19,
          line: 2,
          column: 3,
          endLine: 2,
          endColumn: 10,
        },
      };
      const error = new CompilerRejection(expected);
      let result;
      if (phase === 'loader') {
        vi.spyOn(FileSourceGraph.prototype, 'load').mockRejectedValueOnce(error);
        result = await compileFile('entry.proto.ts', { root });
      } else {
        const files = Object.defineProperty({}, 'entry.proto.ts', {
          get() {
            throw error;
          },
        });
        result = await compileFile('entry.proto.ts', {
          sourceSnapshot: { entry: 'entry.proto.ts', files },
        });
      }
      expect(diagnostic(result)).toBe(expected);
    }
  );

  it('preserves direct frontend defect evidence without manufacturing a first-line location', () => {
    const error = new ReferenceError('injected frontend source enumeration defect');
    const files = Object.defineProperty({}, 'dependency.proto.ts', {
      enumerable: true,
      get() {
        throw error;
      },
    });
    const value = diagnostic(compilePrototype(source, { fileName: 'entry.proto.ts', files }));
    expect(value).toMatchObject({ code: 'PUI1999', category: 'compiler-defect' });
    expect(value.message).toContain(error.stack!);
    unknownOrigin(value, 'entry.proto.ts');
  });

  it('retains checked graph-identity input rejection with an explicitly unknown location', () => {
    const value = diagnostic(compilePrototype(source, { fileName: '../outside.proto.ts' }));
    expect(value).toMatchObject({ code: 'PUI1003', category: 'invalid-input' });
    unknownOrigin(value, '<unknown>');
  });

  it('preserves source-map failure stack and identifies its real setup span as context', () => {
    const error = new RangeError('injected mapping failure');
    vi.spyOn(emitterMap, 'attachEmitterMap').mockImplementationOnce(() => {
      throw error;
    });
    const value = diagnostic(compilePrototype(source, { fileName: 'entry.proto.ts' }));
    expect(value).toMatchObject({ code: 'PUI3005', category: 'compiler-defect' });
    expect(value.message).toContain(error.stack!);
    expect(value.message).toContain('span identifies setup context');
    expect(value.span).toMatchObject({ file: 'entry.proto.ts', line: 2 });
    expect(source.slice(value.span.start, value.span.end)).toContain(
      "def.state.bool('enabled',true)"
    );
  });
});
