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
  emitLlvmIR,
  optimizeLlvmIr,
  verifyLlvmIr,
} from './llvm';
import { emitReactComponent, type ReactEmitOptions, type ReactEmitResult } from './targets';

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
  readonly exportName?: string;
  readonly componentName?: string;
  readonly checkTypes?: boolean;
  readonly allowHookOnly?: boolean;
  readonly react?: Omit<ReactEmitOptions, 'componentName'>;
  readonly llvm?: LlvmPipelineOptions;
}

export interface PrototypeArtifact {
  readonly name: string;
  readonly exportName: string;
  readonly tier: ReactEmitResult['tier'];
  readonly react: ReactEmitResult;
}

export interface CompilationOutput {
  readonly sourceFile: string;
  readonly ir: ModuleIR;
  readonly irText: string;
  readonly ssaStats: SsaPassStats;
  readonly prototypes: readonly PrototypeArtifact[];
  /** Primary prototype output (first prototype in module) for single-component callers. */
  readonly primary?: PrototypeArtifact;
  readonly llvm: {
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
}

function finalizeCompilation(
  extracted: ReturnType<typeof extractModuleIR>,
  options: CompileOptions,
  startedAt: number,
  rootDir: string
): CompileResult<CompilationOutput> {
  const allDiags: CompilerDiagnostic[] = [...extracted.diagnostics];
  const hasErrors = allDiags.some((d) => d.severity === 'error');
  if (hasErrors) return err(allDiags);

  const { ir: rawIr } = extracted;
  if (rawIr.prototypes.length === 0 && !(options.allowHookOnly && rawIr.authoredHooks.length > 0)) {
    const detail = options.exportName
      ? `Export '${options.exportName}' is not a definePrototype() declaration in ${rawIr.sourceFile}.`
      : `No definePrototype() declaration found in ${rawIr.sourceFile}.`;
    return err([...allDiags, diagnostic('PUI_FE002', 'frontend', detail)]);
  }

  const verifyIssues = verifyModuleIR(rawIr);
  if (verifyIssues.length > 0) return err([...allDiags, ...verifyIssues]);

  const { ir, stats: ssaStats } = optimizeModuleIR(rawIr);

  // Verify post-optimization SSA invariants too.
  const postVerifyIssues = verifyModuleIR(ir);
  if (postVerifyIssues.length > 0) return err([...allDiags, ...postVerifyIssues]);

  const prototypes: PrototypeArtifact[] = ir.prototypes.map((proto, index) => {
    const react = emitReactComponent(proto, {
      rootDir,
      ...options.react,
      ...(index === 0 && options.componentName ? { componentName: options.componentName } : {}),
    });
    return {
      name: proto.name,
      exportName: proto.exportName,
      tier: proto.tier,
      react,
    };
  });

  const llvmIr = emitLlvmIR(ir, { targetTriple: options.llvm?.targetTriple });
  const tc = detectLlvmToolchain();
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
      allDiags.push(
        diagnostic(
          'PUI_LLVM_SKIP',
          'llvm',
          'LLVM toolchain not found on PATH; skipping LLVM opt optimization.',
          undefined,
          'warning'
        )
      );
    }
  } else if (options.llvm?.verify && tc.available) {
    const verRes = verifyLlvmIr(llvmIr);
    if (!verRes.ok) return err([...allDiags, ...verRes.diagnostics]);
    verified = true;
  }

  return ok(
    {
      sourceFile: ir.sourceFile,
      ir,
      irText: printModuleIR(ir),
      ssaStats,
      prototypes,
      primary: prototypes[0],
      llvm: {
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
      return finalizeCompilation(extracted, compileOptions, startedAt, session.rootDir);
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
      return finalizeCompilation(extracted, compileOptions, startedAt, session.rootDir);
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
        const res = finalizeCompilation(extracted, compileOptions, fileStart, session.rootDir);
        diagnostics.push(...res.diagnostics);
        if (!res.ok) return err(diagnostics);
        outputs.push(res.value);
        totalPrototypes += res.value.prototypes.length;
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
