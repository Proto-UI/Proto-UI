// @vitest-environment node
import { access, mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as compiler from '../src/compile';
import * as watchApi from '../src/watch';
import { compileProject, type ProjectCompileResult } from '../src/project';
import { writeProjectCompilation } from '../src/project-output';
import { diffArtifactSet, writeArtifactSet, type OutputArtifact } from '../src/artifact-output';
import { readCompilerLibrary } from '../src/artifact-library';
import { verifyGpuiNativeSdk } from '../src/gpui-native-sdk-compatibility';
import { migrateNativeSupport } from '../src/native-support-migration';
import { runCompilerCli } from '../src/cli';
import { CompilerRejection, unknownDiagnosticSpan } from '../src/diagnostics';
import { diagnosticsJson, formatCompilerDiagnostic } from '../src/diagnostic-format';
import { FileSourceGraph } from '../src/source-loader';
import { deferred } from '../src/deferred';
import { resolveTargetProfile } from '../src/targets';
import { validateIR } from '../src/ir-validation';
import { lowerRulePlan } from '../src/rule-plan';
import { extractRuleDeclaration, type RuleDeclarationIR } from '../src/rule-declarations';
import { evaluateStylePlan, type StyleContribution } from '../src/style-plan';
import type { CompilerDiagnostic, CompileResult } from '../src/ir';

const roots: string[] = [];
const source = (name: string) => `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'${name}',setup(def){
  const enabled=def.state.bool('enabled',true);def.expose.state('enabled',enabled);
}});`;

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pui-public-diagnostic-'));
  roots.push(root);
  await writeFile(path.join(root, 'a.proto.ts'), source('first-a'));
  await writeFile(path.join(root, 'b.proto.ts'), source('first-b'));
  return { root, entries: ['a.proto.ts', 'b.proto.ts'] };
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

function failure(result: CompileResult<unknown> | ProjectCompileResult): CompilerDiagnostic {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected the selected public diagnostic boundary.');
  expect(result.diagnostics.length).toBeGreaterThan(0);
  return result.diagnostics[0];
}

/** Raw and formatted output agree even when source text is supplied for that identity. */
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
  const displayedFile = path.isAbsolute(file) ? '<source>' : file;
  const formatted = formatCompilerDiagnostic(value, { sources: { [file]: source('unused') } });
  expect(formatted).toContain(`${displayedFile} (source location unknown)`);
  expect(formatted).not.toContain(`${displayedFile}:1:1`);
  expect(formatted).not.toContain('1 |');
  expect(diagnosticsJson([value]).diagnostics[0].span).toEqual({
    ...value.span,
    file: displayedFile,
  });
}

function checkedRejection() {
  return new CompilerRejection({
    code: 'PUI1006',
    category: 'unsupported-input',
    message: 'Checked source rejection',
    span: { file: 'a.proto.ts', start: 7, end: 12, line: 1, column: 8, endLine: 1, endColumn: 13 },
  });
}

describe('#1457 public project diagnostic boundaries', () => {
  it('preserves a normalized relative entry that resolves back inside the source root', async () => {
    const options = await fixture();
    const result = await compileProject({
      ...options,
      entries: [`../${path.basename(options.root)}/a.proto.ts`],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.entries[0].entry).toBe('a.proto.ts');
  });

  it.each(['root', 'config', 'entry'])(
    'retains missing %s as project input failure with unknown coordinates',
    async (missing) => {
      const options = await fixture();
      const result = await compileProject({
        ...options,
        root: missing === 'root' ? path.join(options.root, 'missing') : options.root,
        entries: [missing === 'entry' ? 'missing.proto.ts' : 'a.proto.ts'],
        configFiles: missing === 'config' ? ['missing.json'] : undefined,
      });
      const value = failure(result);
      expect(value).toMatchObject({ code: 'PUI4101', category: 'invalid-input' });
      if (result.ok) throw new Error('Expected rejected input.');
      expect(result.project.lastSuccessful).toBeUndefined();
      expect(result.project.lastAttempt?.ok).toBe(false);
      unknownOrigin(value, missing === 'entry' ? 'missing.proto.ts' : '<project>');
    }
  );

  it('retains a declared loader Error as project input failure', async () => {
    const options = await fixture();
    vi.spyOn(FileSourceGraph.prototype, 'load').mockRejectedValueOnce(
      new Error('Declared source read failure')
    );
    const value = failure(await compileProject({ ...options, entries: ['a.proto.ts'] }));
    expect(value).toMatchObject({
      code: 'PUI4101',
      category: 'invalid-input',
      message: 'Declared source read failure',
    });
    unknownOrigin(value, 'a.proto.ts');
  });

  it.each([TypeError, ReferenceError, RangeError])(
    'preserves an internal loader %s and its stack',
    async (ErrorType) => {
      const options = await fixture();
      const error = new ErrorType('Internal graph load defect');
      vi.spyOn(FileSourceGraph.prototype, 'load').mockRejectedValueOnce(error);
      const result = await compileProject({ ...options, entries: ['a.proto.ts'] });
      const value = failure(result);
      expect(value).toMatchObject({ code: 'PUI1999', category: 'compiler-defect' });
      expect(value.message).toContain(error.stack!);
      if (result.ok) throw new Error('Expected the internal failure.');
      expect(result.project.lastSuccessful).toBeUndefined();
      expect(result.project.lastAttempt?.ok).toBe(false);
      unknownOrigin(value, 'a.proto.ts');
    }
  );

  it('classifies an Error after successful loading as a defect without publishing a partial generation or cache', async () => {
    const options = await fixture();
    const initial = await compileProject(options);
    if (!initial.ok) throw new Error(JSON.stringify(initial.diagnostics));
    const prior = initial.value.project.lastSuccessful;
    await writeFile(path.join(options.root, 'a.proto.ts'), source('changed-a'));
    await writeFile(path.join(options.root, 'b.proto.ts'), source('changed-b'));
    const error = new Error('Compiler invocation failed after the checked loader');
    const original = compiler.compileFile;
    const invoke = vi.spyOn(compiler, 'compileFile').mockImplementation(async (entry, config) => {
      if (path.basename(entry) === 'b.proto.ts') throw error;
      return original(entry, config);
    });
    const failed = await compileProject(options, initial.value.project);
    const value = failure(failed);
    expect('value' in failed).toBe(false);
    expect(initial.value.project.lastSuccessful).toBe(prior);
    expect(initial.value.project.lastAttempt).toMatchObject({
      ok: false,
      revision: initial.value.revision + 1,
    });
    invoke.mockRestore();
    const recovered = await compileProject(options, initial.value.project);
    if (!recovered.ok) throw new Error(JSON.stringify(recovered.diagnostics));
    expect(recovered.value.entries.map((entry) => entry.cacheHit)).toEqual([false, false]);
    expect(recovered.value.entries.map((entry) => entry.compilation.ir.name)).toEqual([
      'changed-a',
      'changed-b',
    ]);
    expect(recovered.value.revision).toBe(initial.value.revision + 2);
    expect(initial.value.project.lastSuccessful?.identity).toBe(recovered.value.identity);
    expect(value).toMatchObject({ code: 'PUI1999', category: 'compiler-defect' });
    expect(value.message).toContain(error.stack!);
    unknownOrigin(value, 'b.proto.ts');
  });

  it.each(['loader', 'compiler'])(
    'preserves a checked %s rejection object and real span',
    async (boundary) => {
      const options = await fixture();
      const rejection = checkedRejection();
      if (boundary === 'loader')
        vi.spyOn(FileSourceGraph.prototype, 'load').mockRejectedValueOnce(rejection);
      else vi.spyOn(compiler, 'compileFile').mockRejectedValueOnce(rejection);
      const value = failure(await compileProject({ ...options, entries: ['a.proto.ts'] }));
      expect(value).toBe(rejection.diagnostic);
      expect(value.span.line).toBe(1);
      expect(
        formatCompilerDiagnostic(value, { sources: { 'a.proto.ts': source('first-a') } })
      ).toContain('1 |');
    }
  );
});

async function invoke(root: string, args: string[]) {
  let stdout = '';
  let stderr = '';
  const code = await runCompilerCli(args, {
    cwd: root,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
}

function publicStack(error: Error): string {
  return diagnosticsJson([
    {
      code: 'PUI9002',
      category: 'compiler-defect',
      message: error.stack!,
      span: unknownDiagnosticSpan('<cli>'),
    },
  ]).diagnostics[0].message;
}

describe('#1457 CLI diagnostic boundaries', () => {
  it.each(['argument', 'configuration'])(
    'keeps %s errors at exit 2 and PUI9001 with truthful unknown location',
    async (kind) => {
      const { root } = await fixture();
      await writeFile(path.join(root, 'compiler.json'), '{ invalid JSON');
      const result = await invoke(
        root,
        kind === 'argument' ? ['check', '--json'] : ['check', '--config', 'compiler.json', '--json']
      );
      expect(result.code).toBe(2);
      expect(result.stderr).toBe('');
      const value = JSON.parse(result.stdout).diagnostics[0] as CompilerDiagnostic;
      expect(value).toMatchObject({ code: 'PUI9001', category: 'invalid-input' });
      expect((await readdir(root)).sort()).toEqual(['a.proto.ts', 'b.proto.ts', 'compiler.json']);
      unknownOrigin(value, kind === 'argument' ? '<cli>' : 'compiler.json');
    }
  );

  it('preserves the original top-level unexpected stack while retaining public path redaction and exit 3', async () => {
    const { root } = await fixture();
    const error = new TypeError('Unexpected CLI compiler rejection');
    vi.spyOn(compiler, 'compileFile').mockRejectedValueOnce(error);
    const result = await invoke(root, ['check', 'a.proto.ts', '--json']);
    expect(result.code).toBe(3);
    expect(result.stderr).toBe('');
    const value = JSON.parse(result.stdout).diagnostics[0] as CompilerDiagnostic;
    expect(value).toMatchObject({ code: 'PUI9002', category: 'compiler-defect' });
    expect(value.message).toContain(publicStack(error));
    expect(value.message).not.toContain(root);
    expect((await readdir(root)).sort()).toEqual(['a.proto.ts', 'b.proto.ts']);
    unknownOrigin(value, '<cli>');
  });

  it('preserves a watch publication-queue exception, closes its owner and exits 3', async () => {
    const options = await fixture();
    const generation = await compileProject({ ...options, entries: ['a.proto.ts'] });
    if (!generation.ok) throw new Error(JSON.stringify(generation.diagnostics));
    const error = new Error('Unexpected publication queue defect');
    const finished = deferred<CompileResult<void>>();
    let closed = false;
    const stop = vi.fn(async () => {
      closed = true;
      finished.resolve({ ok: true, value: undefined });
    });
    const watcher = vi.spyOn(watchApi, 'watchProject').mockImplementation(async (config) => {
      config.onReport({
        status: 'success',
        revision: 1,
        changedFiles: [],
        compilation: generation.value,
      });
      return {
        ok: true,
        value: {
          get closed() {
            return closed;
          },
          finished: finished.promise,
          stop,
        },
      };
    });
    const writer = vi.spyOn(compiler, 'writeCompilation').mockRejectedValueOnce(error);
    const cancellation = new AbortController();
    const removed = vi.spyOn(cancellation.signal, 'removeEventListener');
    const events: {
      ok: boolean;
      fatal: boolean;
      revision: number;
      lastSuccessful: unknown;
      diagnostics: CompilerDiagnostic[];
    }[] = [];
    const stderr = vi.fn();
    try {
      const code = await runCompilerCli(['watch', 'a.proto.ts', '--output', 'versions', '--json'], {
        cwd: options.root,
        signal: cancellation.signal,
        stdout: (text) => events.push(JSON.parse(text)),
        stderr,
      });
      expect(code).toBe(3);
      expect(watcher).toHaveBeenCalledOnce();
      expect(writer).toHaveBeenCalledOnce();
      expect(stop).toHaveBeenCalled();
      expect(closed).toBe(true);
      expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
      expect(stderr).not.toHaveBeenCalled();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        ok: false,
        fatal: true,
        revision: 1,
        lastSuccessful: null,
      });
      const value = events[0].diagnostics[0];
      expect(value).toMatchObject({ code: 'PUI9002', category: 'compiler-defect' });
      expect(value.message).toContain(publicStack(error));
      unknownOrigin(value, '<cli>');
    } finally {
      await stop();
    }
  });
});

const artifacts: OutputArtifact[] = [
  { path: 'a.ts', kind: 'source', contents: 'export const value = 1;\n' },
  { path: 'nested/b.css', kind: 'style', contents: '.value { color: red; }\n' },
];

describe('#1457 file and output diagnostic locations', () => {
  it('rejects an empty project artifact generation before reserving output', async () => {
    const { root } = await fixture();
    const output = path.join(root, 'empty-project');
    const value = failure(
      await writeProjectCompilation(
        { revision: 1, identity: 'empty', entries: [], dependencies: [] },
        output,
        { sourcePaths: {} }
      )
    );
    expect(value).toMatchObject({ code: 'PUI3004', category: 'invalid-input' });
    await expect(access(output)).rejects.toMatchObject({ code: 'ENOENT' });
    unknownOrigin(value, '<project-output>');
  });

  it('retains a missing diff destination as output conflict without creating it', async () => {
    const { root } = await fixture();
    const output = path.join(root, 'missing-output');
    const value = failure(await diffArtifactSet(artifacts, output));
    expect(value).toMatchObject({ code: 'PUI5001', category: 'output-conflict' });
    await expect(access(output)).rejects.toMatchObject({ code: 'ENOENT' });
    unknownOrigin(value, output);
  });

  it('retains invalid artifact paths as input errors with zero output writes', async () => {
    const { root } = await fixture();
    const output = path.join(root, 'invalid-output');
    const openExclusive = vi.fn();
    const value = failure(
      await writeArtifactSet([{ ...artifacts[0], path: '../escape.ts' }], output, openExclusive)
    );
    expect(value).toMatchObject({ code: 'PUI3004', category: 'invalid-input' });
    expect(openExclusive).not.toHaveBeenCalled();
    await expect(access(output)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await readdir(root)).sort()).toEqual(['a.proto.ts', 'b.proto.ts']);
    unknownOrigin(value, output);
  });

  it('preserves a consumer destination on publication conflict', async () => {
    const { root } = await fixture();
    const output = path.join(root, 'owned-output');
    await mkdir(output);
    await writeFile(path.join(output, 'consumer.txt'), 'consumer-owned bytes');
    const value = failure(await writeArtifactSet(artifacts, output));
    expect(value).toMatchObject({ code: 'PUI3002', category: 'output-conflict' });
    expect(await readdir(output)).toEqual(['consumer.txt']);
    expect(await readFile(path.join(output, 'consumer.txt'), 'utf8')).toBe('consumer-owned bytes');
    unknownOrigin(value, output);
  });

  it('retains output-write classification and rolls back completed and partial artifacts before retry', async () => {
    const { root } = await fixture();
    const output = path.join(root, 'partial-output');
    const result = await writeArtifactSet(artifacts, output, async (filename) => {
      const handle = await open(filename, 'wx');
      return {
        stat: () => handle.stat(),
        close: () => handle.close(),
        async writeFile(contents) {
          if (filename.endsWith('b.css')) {
            await handle.writeFile(contents.slice(0, 3));
            throw Object.assign(new Error('Injected partial write'), { code: 'ENOSPC' });
          }
          await handle.writeFile(contents);
        },
      };
    });
    const value = failure(result);
    expect(value).toMatchObject({
      code: 'PUI3003',
      category: 'output-write',
      message: expect.stringContaining('no artifact set committed'),
    });
    await expect(access(output)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await writeArtifactSet(artifacts, output)).ok).toBe(true);
    for (const artifact of artifacts)
      expect(await readFile(path.join(output, artifact.path), 'utf8')).toBe(artifact.contents);
    unknownOrigin(value, path.join(output, 'nested/b.css'));
  });

  it('keeps a missing library manifest as invalid input without altering the directory', async () => {
    const { root } = await fixture();
    const before = await readdir(root);
    const value = failure(await readCompilerLibrary(root));
    expect(value).toMatchObject({ code: 'PUI4201', category: 'invalid-input' });
    expect(await readdir(root)).toEqual(before);
    unknownOrigin(value, root);
  });

  it('keeps a missing shared SDK as its original input rejection without Cargo or source writes', async () => {
    const { root } = await fixture();
    const directory = path.join(root, 'missing-sdk');
    const value = failure(await verifyGpuiNativeSdk(directory));
    expect(value).toMatchObject({ code: 'PUI_GPUI_SDK_COMPATIBILITY', category: 'invalid-input' });
    await expect(access(directory)).rejects.toMatchObject({ code: 'ENOENT' });
    unknownOrigin(value, directory);
  });

  it('keeps an invalid migration plan as output conflict and never opens output', async () => {
    const { root } = await fixture();
    const plan = path.join(root, 'plan.json');
    const output = path.join(root, 'migrated');
    await writeFile(plan, '{"version":1,"inputs":[]}');
    const openExclusive = vi.fn();
    const value = failure(await migrateNativeSupport(plan, output, openExclusive));
    expect(value).toMatchObject({ code: 'PUI5001', category: 'output-conflict' });
    expect(openExclusive).not.toHaveBeenCalled();
    await expect(access(output)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(plan, 'utf8')).toBe('{"version":1,"inputs":[]}');
    unknownOrigin(value, plan);
  });
});

describe('#1457 diagnostic-only fallback boundaries', () => {
  it('reports missing target selection without inventing a source position', () => {
    const value = failure(resolveTargetProfile('missing-profile'));
    expect(value).toMatchObject({ code: 'PUI4001', category: 'unsupported-input' });
    unknownOrigin(value, '<target>');
  });

  it('retains an explicitly supplied target source span', () => {
    const span = checkedRejection().diagnostic.span;
    const value = failure(resolveTargetProfile({ profile: 'missing-profile', span }));
    expect(value).toMatchObject({ code: 'PUI4001', category: 'unsupported-input' });
    expect(value.span).toBe(span);
  });

  it.each([
    { input: null, code: 'PUI2002' },
    { input: { schemaVersion: -1 }, code: 'PUI2001' },
  ])('keeps $code invalid IR with truthful unknown fallback', ({ input, code }) => {
    const value = failure(validateIR(input));
    expect(value).toMatchObject({ code, category: 'invalid-ir' });
    unknownOrigin(value, '<ir>');
  });

  it('reports malformed current-version input schema at an unknown location', () => {
    const result = compiler.compilePrototype(source('invalid-input-schema'), {
      fileName: 'schema.proto.ts',
    });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const value = failure(validateIR({ ...result.value.ir, hooks: null }));
    expect(value).toMatchObject({ code: 'PUI2002', category: 'invalid-ir' });
    unknownOrigin(value, '<ir>');
  });

  it.each(['missing', 'malformed', 'sentinel'] as const)(
    'keeps early declaration-order rejection formattable with a %s span',
    (spanKind) => {
      const result = compiler.compilePrototype(source('invalid-declaration-order'), {
        fileName: 'order.proto.ts',
      });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      const statement = result.value.ir.setup.body[0] as unknown as Record<string, unknown>;
      statement.declarationPosition = 0;
      if (spanKind === 'missing') delete statement.span;
      else if (spanKind === 'malformed') statement.span = { file: 'order.proto.ts' };
      else statement.span = unknownDiagnosticSpan('order.proto.ts');
      const value = failure(validateIR(result.value.ir));
      expect(value).toMatchObject({ code: 'PUI2002', category: 'invalid-ir' });
      unknownOrigin(value, '<ir>');
    }
  );

  it('retains a valid authored span on an early declaration-order rejection', () => {
    const result = compiler.compilePrototype(source('located-declaration-order'), {
      fileName: 'order.proto.ts',
    });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const statement = result.value.ir.setup.body[0];
    Object.assign(statement, { declarationPosition: 0 });
    const value = failure(validateIR(result.value.ir));
    expect(value).toMatchObject({ code: 'PUI2002', category: 'invalid-ir' });
    expect(value.span).toBe(statement.span);
    expect(formatCompilerDiagnostic(value)).toContain('order.proto.ts:3:9');
  });

  it('preserves real IR spans and continues rejecting a diagnostic sentinel as authored IR', () => {
    const result = compiler.compilePrototype(
      `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'located-prop',setup(def){
  def.props.define({label:{type:'string',default:'hello'}});
}});`,
      { fileName: 'located.proto.ts' }
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(validateIR(result.value.ir).ok).toBe(true);
    const duplicated = structuredClone(result.value.ir);
    const prop = duplicated.props[0];
    duplicated.props.push({ ...prop });
    const located = failure(validateIR(duplicated));
    expect(located).toMatchObject({ code: 'PUI2002', category: 'invalid-ir' });
    expect(located.span).toBe(prop.span);
    expect(located.span.line).toBe(3);
    const invalid = structuredClone(result.value.ir);
    invalid.setup.span = unknownDiagnosticSpan('located.proto.ts');
    expect(validateIR(invalid)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', category: 'invalid-ir' }],
    });
  });

  it('reports malformed Rule records at an unknown fallback location', () => {
    const value = failure(lowerRulePlan([{} as RuleDeclarationIR]));
    expect(value).toMatchObject({ code: 'PUI2024', category: 'invalid-ir' });
    unknownOrigin(value, '<rule-plan>');
  });

  it('preserves an explicitly supplied Rule diagnostic span', () => {
    const span = checkedRejection().diagnostic.span;
    const value = failure(lowerRulePlan([{} as RuleDeclarationIR], span));
    expect(value).toMatchObject({ code: 'PUI2024', category: 'invalid-ir' });
    expect(value.span).toBe(span);
  });

  it('preserves the actual Rule dependency expression span after successful source extraction', () => {
    const text =
      "const RULE={when:w=>w.prop('active').eq(true),intent:i=>i.feedback.style.use(hidden)};";
    const file = ts.createSourceFile(
      'rule.proto.ts',
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const declaration = (file.statements[0] as ts.VariableStatement).declarationList
      .declarations[0];
    const rule = extractRuleDeclaration(declaration.initializer as ts.ObjectLiteralExpression, {
      id: 1,
      order: 0,
      props: new Map([['active', 'boolean']]),
      resolveState: () => undefined,
      resolveStyle: (expression) =>
        ts.isIdentifier(expression) && expression.text === 'hidden'
          ? { kind: 'tw', tokens: ['hidden'] }
          : undefined,
    });
    expect(lowerRulePlan([rule]).ok).toBe(true);
    if (rule.when.type !== 'eq') throw new Error('Expected the authored equality condition.');
    const value = failure(lowerRulePlan([{ ...rule, deps: [] }]));
    expect(value).toMatchObject({ code: 'PUI2024', category: 'invalid-ir' });
    expect(value.span).toBe(rule.when.left.span);
    expect(text.slice(value.span.start, value.span.end)).toBe("w.prop('active')");
  });

  const contribution: StyleContribution = {
    id: 'color',
    scope: 'host',
    layer: 'base',
    intents: [{ kind: 'feedback.style.use', handles: [{ kind: 'tw', tokens: ['bg-red'] }] }],
  };

  it('reports an invalid style mapping identity with unknown location', () => {
    const value = failure(evaluateStylePlan({ contributions: [] }, { target: '', tokens: {} }));
    expect(value).toMatchObject({ code: 'PUI4201', category: 'invalid-ir' });
    unknownOrigin(value, '<style-plan>');
  });

  it('retains unsupported style classification when a contribution has no authored span', () => {
    const value = failure(
      evaluateStylePlan({ contributions: [contribution] }, { target: 'native', tokens: {} })
    );
    expect(value).toMatchObject({ code: 'PUI4202', category: 'unsupported-input' });
    unknownOrigin(value, '<style-plan>');
  });

  it('retains a style contribution span in both rejection and successful projection', () => {
    const span = checkedRejection().diagnostic.span;
    const plan = { contributions: [{ ...contribution, span }] };
    const rejected = failure(evaluateStylePlan(plan, { target: 'native', tokens: {} }));
    expect(rejected).toMatchObject({ code: 'PUI4202', category: 'unsupported-input' });
    expect(rejected.span).toBe(span);
    const projected = evaluateStylePlan(plan, {
      target: 'native',
      tokens: { 'bg-red': [{ kind: 'property', name: 'fill', value: '#f00' }] },
    });
    if (!projected.ok) throw new Error(JSON.stringify(projected.diagnostics));
    expect(projected.value.entries).toMatchObject([
      { scope: 'host', kind: 'property', name: 'fill', value: '#f00', contributor: 'color' },
    ]);
    expect(projected.value.entries[0].span).toBe(span);
    const unlocated = evaluateStylePlan(
      { contributions: [contribution] },
      {
        target: 'native',
        tokens: { 'bg-red': [{ kind: 'property', name: 'fill', value: '#f00' }] },
      }
    );
    if (!unlocated.ok) throw new Error(JSON.stringify(unlocated.diagnostics));
    expect(unlocated.value.entries[0].span).toBeUndefined();
  });
});
