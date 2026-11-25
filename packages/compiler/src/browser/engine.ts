import ts from 'typescript';
import { diagnostic, type CompilerDiagnostic } from '../diagnostics';
import { extractModuleIR } from '../frontend/extract';
import { verifyModuleIR } from '../ir/verify';
import { optimizeModuleIR } from '../ir/passes';
import { emitReactComponent, getReactLoweringDiagnostics } from '../targets/react';
import { createMemoryProgram } from './memory-program';
import { browserSha256 } from './hash';
import {
  BROWSER_COMPILER_LIMITS,
  type BrowserAuthoringEnvironment,
  type BrowserCompileRequest,
  type BrowserCompileResult,
} from './protocol';

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

export function validateBrowserRequest(input: unknown): asserts input is BrowserCompileRequest {
  const request = input as Partial<BrowserCompileRequest> | null;
  if (
    !request ||
    request.format !== 2 ||
    typeof request.revision !== 'string' ||
    typeof request.source !== 'string' ||
    !request.options ||
    typeof request.options.target !== 'string' ||
    typeof request.options.fileName !== 'string' ||
    (request.options.files !== undefined && !isStringRecord(request.options.files)) ||
    (request.options.sourceImports !== undefined &&
      !isStringRecord(request.options.sourceImports)) ||
    (request.options.exportName !== undefined && typeof request.options.exportName !== 'string') ||
    (request.options.componentName !== undefined &&
      typeof request.options.componentName !== 'string') ||
    (request.preview !== undefined && typeof request.preview !== 'boolean')
  )
    throw new Error('Expected a version 2 browser compilation request.');
}

function tsDiagnostic(issue: ts.Diagnostic): CompilerDiagnostic {
  const point =
    issue.file && issue.start !== undefined
      ? issue.file.getLineAndCharacterOfPosition(issue.start)
      : undefined;
  return diagnostic(
    'TS' + issue.code,
    'typecheck',
    ts.flattenDiagnosticMessageText(issue.messageText, '\n'),
    point && issue.file
      ? { file: issue.file.fileName, line: point.line + 1, column: point.character + 1 }
      : undefined
  );
}

/** This is the same semantic frontend and React AST target used by Node. */
export async function compileBrowserRequest(
  input: unknown,
  environment: BrowserAuthoringEnvironment
): Promise<BrowserCompileResult> {
  let request: BrowserCompileRequest;
  try {
    validateBrowserRequest(input);
    request = input;
  } catch (error) {
    return {
      ok: false,
      revision: '',
      phase: 'host',
      error: { code: 'invalid-request', message: String(error) },
    };
  }
  const serialized = JSON.stringify(request);
  const requestSha256 = await browserSha256(serialized);
  const fail = (diagnostics: readonly CompilerDiagnostic[]): BrowserCompileResult => ({
    ok: false,
    revision: request.revision,
    requestSha256,
    phase: 'compile',
    diagnostics: diagnostics.map((issue) =>
      issue.span?.file.startsWith('/__pui_authored__/')
        ? {
            ...issue,
            span: { ...issue.span, file: issue.span.file.slice('/__pui_authored__/'.length) },
          }
        : issue
    ),
  });
  const hostError = (
    code: 'input-limit' | 'invalid-request' | 'worker-execution',
    message: string
  ): BrowserCompileResult => ({
    ok: false,
    revision: request.revision,
    requestSha256,
    phase: 'host',
    error: { code, message },
  });
  if (
    new TextEncoder().encode(serialized).byteLength > BROWSER_COMPILER_LIMITS.inputBytes ||
    Object.keys(request.options.files ?? {}).length > BROWSER_COMPILER_LIMITS.inputFiles
  )
    return hostError(
      'input-limit',
      'The supplied source graph exceeds the browser compiler input limit.'
    );
  if (request.options.target !== 'react') {
    const native = request.options.target === 'gpui' || request.options.target === 'kernel';
    return fail([
      diagnostic(
        'PUI_BROWSER_TARGET_UNSUPPORTED',
        'input',
        native
          ? 'Target ' +
              request.options.target +
              ' requires the native compiler toolchain. The browser currently emits React components.'
          : 'Target ' +
              request.options.target +
              ' has no browser AST backend. The browser currently emits React components.',
        { file: request.options.fileName, line: 1, column: 1 }
      ),
    ]);
  }
  let memory: ReturnType<typeof createMemoryProgram>;
  try {
    memory = createMemoryProgram(request, environment);
  } catch (error) {
    return hostError('invalid-request', error instanceof Error ? error.message : String(error));
  }
  try {
    const extracted = extractModuleIR(memory.program, memory.entryPath, {
      exportName: request.options.exportName ?? 'default',
      checkTypes: true,
    });
    const issues = [...extracted.diagnostics];
    for (const file of memory.authoredFiles) {
      if (file === memory.entryPath) continue;
      const source = memory.program.getSourceFile(file);
      if (source) issues.push(...memory.program.getSyntacticDiagnostics(source).map(tsDiagnostic));
    }
    if (!extracted.ir.prototypes.length)
      issues.push(
        diagnostic(
          'PUI_FE002',
          'frontend',
          'The selected export is not a definePrototype declaration.',
          { file: request.options.fileName, line: 1, column: 1 }
        )
      );
    if (issues.some((issue) => issue.severity === 'error')) return fail(issues);
    issues.push(...verifyModuleIR(extracted.ir));
    if (issues.some((issue) => issue.severity === 'error')) return fail(issues);
    const { ir } = optimizeModuleIR(extracted.ir);
    issues.push(...verifyModuleIR(ir));
    for (const proto of ir.prototypes) issues.push(...getReactLoweringDiagnostics(proto));
    if (issues.some((issue) => issue.severity === 'error')) return fail(issues);
    if (ir.prototypes.length !== 1)
      return fail([
        diagnostic(
          'PUI_BROWSER_EXPORT',
          'input',
          'Select exactly one prototype export for a browser component.'
        ),
      ]);
    const proto = ir.prototypes[0];
    const result = emitReactComponent(proto, { componentName: request.options.componentName });
    const output: Extract<BrowserCompileResult, { ok: true }> = {
      ok: true,
      revision: request.revision,
      requestSha256,
      source: {
        file: request.options.fileName,
        exportName: proto.exportName,
        sha256: await browserSha256(request.source),
      },
      output: {
        code: result.code,
        target: 'react',
        dependencies: [{ name: 'react', version: environment.reactVersion, role: 'target' }],
      },
    };
    if (request.preview) {
      // Only the compiler's freshly constructed target AST is transpiled. No
      // authored setup module is evaluated, bundled, or sent to the preview.
      const javascript = ts.transpileModule(result.code, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        reportDiagnostics: true,
      });
      const errors =
        javascript.diagnostics?.filter((issue) => issue.category === ts.DiagnosticCategory.Error) ??
        [];
      if (errors.length) return fail(errors.map(tsDiagnostic));
      output.preview = {
        format: 2,
        entry: 'pui:compiled/component',
        modules: { 'pui:compiled/component': javascript.outputText },
        styles: [],
        events: [],
        execution: 'native-react',
      };
    }
    if (JSON.stringify(output).length > BROWSER_COMPILER_LIMITS.outputCharacters)
      return hostError(
        'input-limit',
        'Generated output exceeds the browser compiler output limit.'
      );
    return output;
  } catch (error) {
    return fail([
      diagnostic(
        'PUI_BROWSER_COMPILE',
        'codegen',
        error instanceof Error ? error.message : String(error)
      ),
    ]);
  }
}
