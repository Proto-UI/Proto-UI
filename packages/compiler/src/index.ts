export {
  createCompiler,
  compileFile,
  compilePrototype,
  compileProject,
  type ProtoCompiler,
  type CompileOptions,
  type LlvmPipelineOptions,
  type CompilationOutput,
  type PrototypeArtifact,
  type ProjectCompilationOutput,
} from './compiler';

export {
  diagnostic,
  ok,
  err,
  formatDiagnostic,
  formatDiagnostics,
  type SourceSpan,
  type DiagnosticSeverity,
  type DiagnosticCategory,
  type CompilerDiagnostic,
  type CompileResult,
} from './diagnostics';

export * from './ir';
export * from './frontend';
export * from './llvm';
export * from './targets';
export { runCompilerCli, type CliResult } from './cli';
