import fs from 'node:fs';
import path from 'node:path';
import { diagnostic, err, ok, type CompileResult, type CompilerDiagnostic } from './diagnostics';
import { TsProgramSession, extractModuleIR, type CompilerSessionOptions } from './frontend';
import {
  optimizeModuleIR,
  printModuleIR,
  verifyModuleIR,
  type ModuleIR,
  type SsaPassStats,
} from './ir';
import {
  compileLlvmToWasm,
  detectLlvmToolchain,
  emitLlvmIRResult,
  optimizeLlvmIr,
  verifyLlvmIr,
} from './llvm';
import {
  emitReactComponent,
  getReactLoweringDiagnostics,
  getKernelLoweringDiagnostics,
  emitGpuiComponent,
  type ReactEmitResult,
  type GpuiEmitOptions,
  type GpuiEmitResult,
} from './targets';

import { COMPILATION_TARGETS, type CompilationTarget } from './targets/kinds';
export {
  COMPILATION_TARGETS,
  COMPONENT_TARGETS,
  type CompilationTarget,
  type ComponentTarget,
} from './targets/kinds';

export interface LlvmPipelineOptions {
  readonly targetTriple?: string;
  /** Run LLVM `opt -passes=verify` when LLVM is available. */
  readonly verify?: boolean;
  /** Run LLVM `opt -passes=default<level>` when LLVM is available. */
  readonly optimize?: boolean | 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Oz';
  /** Also compile lowered LLVM IR to executable WebAssembly bytes via llc + wasm-ld. */
  readonly emitWasm?: boolean;
}

export interface CompileOptions {
  readonly target?: CompilationTarget;
  readonly exportName?: string;
  readonly componentName?: string;
  readonly checkTypes?: boolean;
  readonly allowHookOnly?: boolean;
  readonly gpui?: Omit<GpuiEmitOptions, 'componentName'>;
  readonly llvm?: LlvmPipelineOptions;
}

export interface GpuiPrototypeArtifact {
  readonly name: string;
  readonly exportName: string;
  readonly gpui: GpuiEmitResult;
}

export interface PrototypeArtifact {
  readonly name: string;
  readonly exportName: string;
  readonly tier: ReactEmitResult['tier'];
  readonly react: ReactEmitResult;
}

export interface CompilationOutput {
  readonly artifactKind: 'react-components' | 'gpui-components' | 'kernel-module' | 'semantic-ir';
  readonly sourceFile: string;
  readonly ir: ModuleIR;
  readonly irText: string;
  readonly ssaStats: SsaPassStats;
  readonly prototypes: readonly PrototypeArtifact[];
  /** Primary prototype output (first prototype in module) for single-component callers. */
  readonly primary?: PrototypeArtifact;
  readonly gpuiPrototypes: readonly GpuiPrototypeArtifact[];
  readonly primaryGpui?: GpuiPrototypeArtifact;
  readonly llvm: {
    readonly emitted: boolean;
    readonly ir: string;
    readonly optimizedIr?: string;
    readonly verified: boolean;
    readonly toolchainVersion?: string;
    readonly wasm?: Uint8Array;
  };
  readonly elapsedMs: number;
}

export interface ProjectCompilationOutput {
  readonly files: readonly CompilationOutput[];
  readonly totalPrototypes: number;
  readonly totalAuthoredHooks: number;
  readonly totalElapsedMs: number;
}

export interface ProtoCompiler {
  readonly session: TsProgramSession;
  compileFile(entryFile: string, options?: CompileOptions): CompileResult<CompilationOutput>;
  compilePrototype(
    source: string,
    options?: CompileOptions & { fileName?: string; files?: Readonly<Record<string, string>> }
  ): CompileResult<CompilationOutput>;
  compileProject(
    entries: readonly string[],
    options?: CompileOptions
  ): CompileResult<ProjectCompilationOutput>;
  inventoryProject(
    entries: readonly string[],
    options?: CompileOptions
  ): CompileResult<ProjectCoverageReport>;
}

export interface FileCoverage {
  readonly sourceFile: string;
  readonly status: 'emitted' | 'unsupported' | 'source-error' | 'hook-analysis';
  readonly prototypes: readonly string[];
  readonly authoredHooks: readonly string[];
  readonly nativeEmittedPrototypes: number;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

export interface ProjectCoverageReport {
  readonly schemaVersion: 1;
  readonly target: 'react' | 'gpui';
  readonly files: readonly FileCoverage[];
  readonly totals: {
    readonly inputFiles: number;
    readonly analyzedFiles: number;
    readonly prototypeDeclarations: number;
    readonly authoredHookDeclarations: number;
    readonly nativeEmittedPrototypes: number;
    readonly unsupportedPrototypes: number;
    readonly sourceErrorFiles: number;
    readonly executionVerifiedPrototypes: 0;
  };
  readonly completeNativeCoverage: boolean;
}

function selectedTarget(options: CompileOptions): CompilationTarget {
  return options.target ?? 'react';
}

function finalizeCompilation(
  extracted: ReturnType<typeof extractModuleIR>,
  options: CompileOptions,
  startedAt: number
): CompileResult<CompilationOutput> {
  const allDiags: CompilerDiagnostic[] = [...extracted.diagnostics];
  const target = selectedTarget(options);
  if (!COMPILATION_TARGETS.includes(target))
    return err([
      ...allDiags,
      diagnostic(
        'PUI_TARGET_INVALID',
        'input',
        'Unsupported compilation target: ' + String(target),
        {
          file: extracted.ir.sourceFile,
          line: 1,
          column: 1,
        }
      ),
    ]);
  const hasErrors = allDiags.some((d) => d.severity === 'error');
  if (hasErrors) return err(allDiags);

  const { ir: rawIr } = extracted;
  if (rawIr.prototypes.length === 0 && !(options.allowHookOnly && rawIr.authoredHooks.length > 0)) {
    const detail = options.exportName
      ? `Export '${options.exportName}' is not a definePrototype() declaration in ${rawIr.sourceFile}.`
      : `No definePrototype() declaration found in ${rawIr.sourceFile}.`;
    return err([
      ...allDiags,
      diagnostic('PUI_FE002', 'frontend', detail, { file: rawIr.sourceFile, line: 1, column: 1 }),
    ]);
  }

  const verifyIssues = verifyModuleIR(rawIr);
  if (verifyIssues.length > 0) return err([...allDiags, ...verifyIssues]);

  const { ir, stats: ssaStats } = optimizeModuleIR(rawIr);

  // Verify post-optimization SSA invariants too.
  const postVerifyIssues = verifyModuleIR(ir);
  if (postVerifyIssues.length > 0) return err([...allDiags, ...postVerifyIssues]);

  if (target === 'react') {
    for (const proto of ir.prototypes) allDiags.push(...getReactLoweringDiagnostics(proto));
    if (allDiags.some((d) => d.severity === 'error')) return err(allDiags);
  }
  const prototypes: PrototypeArtifact[] = [];
  const gpuiPrototypes: GpuiPrototypeArtifact[] = [];
  for (const [index, proto] of ir.prototypes.entries()) {
    const component =
      index === 0 && options.componentName ? { componentName: options.componentName } : {};
    if (target === 'react') {
      try {
        const react = emitReactComponent(proto, component);
        prototypes.push({
          name: proto.name,
          exportName: proto.exportName,
          tier: react.tier,
          react,
        });
      } catch (error) {
        return err([
          ...allDiags,
          diagnostic(
            'PUI_REACT_EMIT',
            'codegen',
            error instanceof Error ? error.message : String(error),
            proto.span
          ),
        ]);
      }
    } else if (target === 'gpui') {
      const output = emitGpuiComponent(proto, { ...options.gpui, ...component });
      allDiags.push(...output.diagnostics);
      if (!output.ok) return err(allDiags);
      gpuiPrototypes.push({ name: proto.name, exportName: proto.exportName, gpui: output.value });
    }
  }

  let llvmIr = '';
  const llvmRequested = options.llvm !== undefined || target === 'kernel';
  const tc = llvmRequested ? detectLlvmToolchain() : { available: false, version: undefined };
  if (llvmRequested) {
    const kernelIssues = getKernelLoweringDiagnostics(ir);
    if (kernelIssues.length) return err([...allDiags, ...kernelIssues]);
    const emission = emitLlvmIRResult(ir, { targetTriple: options.llvm?.targetTriple });
    if (!emission.ok) return err([...allDiags, ...emission.diagnostics]);
    llvmIr = emission.value;
  }
  let verified = false;
  let optimizedIr: string | undefined;
  let wasm: Uint8Array | undefined;

  if (options.llvm?.emitWasm) {
    const wasmRes = compileLlvmToWasm(llvmIr, {
      level: typeof options.llvm.optimize === 'string' ? options.llvm.optimize : 'O2',
    });
    if (!wasmRes.ok) return err([...allDiags, ...wasmRes.diagnostics]);
    verified = true;
    optimizedIr = wasmRes.value.optimizedIr;
    wasm = wasmRes.value.wasm;
  } else if (options.llvm?.optimize) {
    if (tc.available) {
      const level = typeof options.llvm.optimize === 'string' ? options.llvm.optimize : 'O2';
      const optRes = optimizeLlvmIr(llvmIr, { level });
      if (!optRes.ok) return err([...allDiags, ...optRes.diagnostics]);
      verified = true;
      optimizedIr = optRes.value.ir;
    } else {
      return err([
        ...allDiags,
        diagnostic(
          'PUI_LLVM_UNAVAILABLE',
          'llvm',
          'LLVM optimization was requested but its toolchain is unavailable.'
        ),
      ]);
    }
  } else if (options.llvm?.verify && tc.available) {
    const verRes = verifyLlvmIr(llvmIr);
    if (!verRes.ok) return err([...allDiags, ...verRes.diagnostics]);
    verified = true;
  } else if (options.llvm?.verify) {
    return err([
      ...allDiags,
      diagnostic(
        'PUI_LLVM_UNAVAILABLE',
        'llvm',
        'LLVM verification was requested but its toolchain is unavailable.'
      ),
    ]);
  }

  return ok(
    {
      artifactKind:
        target === 'react'
          ? 'react-components'
          : target === 'gpui'
            ? 'gpui-components'
            : target === 'kernel'
              ? 'kernel-module'
              : 'semantic-ir',
      sourceFile: ir.sourceFile,
      ir,
      irText: printModuleIR(ir),
      ssaStats,
      prototypes,
      primary: prototypes[0],
      gpuiPrototypes,
      primaryGpui: gpuiPrototypes[0],
      llvm: {
        emitted: llvmRequested,
        ir: llvmIr,
        ...(optimizedIr !== undefined ? { optimizedIr } : {}),
        verified,
        ...(tc.version ? { toolchainVersion: tc.version } : {}),
        ...(wasm ? { wasm } : {}),
      },
      elapsedMs: performance.now() - startedAt,
    },
    allDiags
  );
}

/** Create a reusable compiler instance backed by a cached TypeScript Program session. */
export function createCompiler(options: CompilerSessionOptions = {}): ProtoCompiler {
  const session = new TsProgramSession(options);

  return {
    session,

    compileFile(entryFile, compileOptions = {}) {
      const startedAt = performance.now();
      const absPath = path.resolve(session.rootDir, entryFile);
      if (!fs.existsSync(absPath)) {
        return err([diagnostic('PUI_IO001', 'io', `Entry file does not exist: ${absPath}`)]);
      }
      const program = session.ensureFiles([absPath]);
      const extracted = extractModuleIR(program, absPath, {
        exportName: compileOptions.exportName,
        checkTypes: compileOptions.checkTypes,
      });
      return finalizeCompilation(extracted, compileOptions, startedAt);
    },

    compilePrototype(source, compileOptions = {}) {
      const startedAt = performance.now();
      const fileName = compileOptions.fileName ?? '__virtual__.proto.ts';
      const { program, entryPath } = session.createVirtualProgram(
        fileName,
        source,
        compileOptions.files
      );
      const extracted = extractModuleIR(program, entryPath, {
        exportName: compileOptions.exportName,
        checkTypes: compileOptions.checkTypes,
      });
      return finalizeCompilation(extracted, compileOptions, startedAt);
    },

    compileProject(entries, compileOptions = {}) {
      const startedAt = performance.now();
      const resolved = entries.map((e) => path.resolve(session.rootDir, e));
      for (const file of resolved) {
        if (!fs.existsSync(file)) {
          return err([diagnostic('PUI_IO001', 'io', `Entry file does not exist: ${file}`)]);
        }
      }
      // Load ALL entries into ONE shared ts.Program + ts.TypeChecker.
      const program = session.ensureFiles(resolved);
      const outputs: CompilationOutput[] = [];
      const diagnostics: CompilerDiagnostic[] = [];
      let totalPrototypes = 0;
      let totalAuthoredHooks = 0;

      for (const absPath of resolved) {
        const fileStart = performance.now();
        const extracted = extractModuleIR(program, absPath, {
          exportName: compileOptions.exportName,
          checkTypes: compileOptions.checkTypes,
        });
        const res = finalizeCompilation(extracted, compileOptions, fileStart);
        diagnostics.push(...res.diagnostics);
        if (!res.ok) return err(diagnostics);
        outputs.push(res.value);
        totalPrototypes += res.value.prototypes.length + res.value.gpuiPrototypes.length;
        totalAuthoredHooks += res.value.ir.authoredHooks.length;
      }

      return ok(
        {
          files: outputs,
          totalPrototypes,
          totalAuthoredHooks,
          totalElapsedMs: performance.now() - startedAt,
        },
        diagnostics
      );
    },

    inventoryProject(entries, compileOptions = {}) {
      const target = selectedTarget(compileOptions);
      if (target !== 'react' && target !== 'gpui')
        return err([
          diagnostic(
            'PUI_COVERAGE_TARGET',
            'input',
            'Native coverage must select the React or GPUI component target.'
          ),
        ]);
      const resolved = [...new Set(entries.map((entry) => path.resolve(session.rootDir, entry)))];
      for (const entry of resolved)
        if (!fs.existsSync(entry))
          return err([diagnostic('PUI_IO001', 'io', 'Entry file does not exist: ' + entry)]);
      const program = session.ensureFiles(resolved);
      const files: FileCoverage[] = [];
      for (const entry of resolved) {
        const extracted = extractModuleIR(program, entry, {
          checkTypes: compileOptions.checkTypes,
          exportName: compileOptions.exportName,
        });
        const prototypes = extracted.ir.prototypes.map((proto) => proto.name);
        const authoredHooks = extracted.ir.authoredHooks.map((hook) => hook.name);
        const base = { sourceFile: entry, prototypes, authoredHooks, nativeEmittedPrototypes: 0 };
        if (extracted.diagnostics.some((issue) => issue.severity === 'error')) {
          files.push({ ...base, status: 'source-error', diagnostics: extracted.diagnostics });
        } else if (prototypes.length === 0 && authoredHooks.length > 0) {
          files.push({ ...base, status: 'hook-analysis', diagnostics: extracted.diagnostics });
        } else {
          const compiled = finalizeCompilation(
            extracted,
            { ...compileOptions, target, llvm: undefined },
            performance.now()
          );
          files.push({
            ...base,
            status: compiled.ok ? 'emitted' : 'unsupported',
            nativeEmittedPrototypes: compiled.ok
              ? compiled.value.prototypes.length + compiled.value.gpuiPrototypes.length
              : 0,
            diagnostics: compiled.diagnostics,
          });
        }
      }
      const totals = {
        inputFiles: files.length,
        analyzedFiles: files.filter((file) => file.status !== 'source-error').length,
        prototypeDeclarations: files.reduce((sum, file) => sum + file.prototypes.length, 0),
        authoredHookDeclarations: files.reduce((sum, file) => sum + file.authoredHooks.length, 0),
        nativeEmittedPrototypes: files.reduce((sum, file) => sum + file.nativeEmittedPrototypes, 0),
        unsupportedPrototypes: files
          .filter((file) => file.status === 'unsupported')
          .reduce((sum, file) => sum + file.prototypes.length, 0),
        sourceErrorFiles: files.filter((file) => file.status === 'source-error').length,
        executionVerifiedPrototypes: 0 as const,
      };
      return ok({
        schemaVersion: 1,
        target,
        files,
        totals,
        completeNativeCoverage:
          totals.prototypeDeclarations > 0 &&
          files.every((file) => file.status === 'emitted' || file.status === 'hook-analysis') &&
          totals.nativeEmittedPrototypes === totals.prototypeDeclarations,
      });
    },
  };
}

let defaultCompiler: ProtoCompiler | undefined;
function sharedCompiler(rootDir?: string): ProtoCompiler {
  if (!rootDir) {
    defaultCompiler ??= createCompiler();
    return defaultCompiler;
  }
  return createCompiler({ rootDir });
}

export function compileFile(
  entryFile: string,
  options: CompileOptions & { rootDir?: string } = {}
): CompileResult<CompilationOutput> {
  return sharedCompiler(options.rootDir).compileFile(entryFile, options);
}

export function compilePrototype(
  source: string,
  options: CompileOptions & {
    rootDir?: string;
    fileName?: string;
    files?: Readonly<Record<string, string>>;
  } = {}
): CompileResult<CompilationOutput> {
  return sharedCompiler(options.rootDir).compilePrototype(source, options);
}

export function compileProject(
  entries: readonly string[],
  options: CompileOptions & { rootDir?: string } = {}
): CompileResult<ProjectCompilationOutput> {
  return sharedCompiler(options.rootDir).compileProject(entries, options);
}

export function inventoryProject(
  entries: readonly string[],
  options: CompileOptions & { rootDir?: string } = {}
): CompileResult<ProjectCoverageReport> {
  return sharedCompiler(options.rootDir).inventoryProject(entries, options);
}
