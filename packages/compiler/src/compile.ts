import { open, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { verifyGpuiCompilationSdk } from './gpui-native-sdk-compatibility';
import type { TargetSelection } from './targets';
import { compilePrototype, type Compilation } from './memory';
export { compilePrototype } from './memory';
export type { Compilation, CompileOptions } from './memory';
import {
  diffArtifactSet,
  writeArtifactSet,
  type ArtifactDiff,
  type ExclusiveOutputFile,
  type OutputArtifact,
} from './artifact-output';
import { diagnosticInputOrigin, sourceName } from './source-resolution';
import { FileSourceGraph, type FileSourceSnapshot } from './source-loader';
import { CompilerRejection, unexpectedFailureEvidence, unknownDiagnosticSpan } from './diagnostics';
import { generatedSourcePath } from './emitter-map';
import type { CompileResult, SourceSpan } from './ir';

export type { ExclusiveOutputFile } from './artifact-output';
export interface FileCompileOptions {
  root?: string;
  exportName?: string;
  componentName?: string;
  profile?: string | TargetSelection;
  nativeSdkPath?: string;
  gpuiDependency?: 'workspace';
  /** Closed, already-read source input used by project compilation; no second filesystem read. */
  sourceSnapshot?: FileSourceSnapshot;
}

/** Read the declared project and explicitly exported package sources without executing input. */
export async function compileFile(
  entry: string,
  options: FileCompileOptions = {}
): Promise<CompileResult<Compilation>> {
  let origin = unknownDiagnosticSpan();
  let snapshot = options.sourceSnapshot;
  try {
    if (!snapshot) {
      if (!path.isAbsolute(entry)) origin = diagnosticInputOrigin(entry);
      const root = await realpath(options.root ?? process.cwd());
      const graph = new FileSourceGraph(root);
      const requested = path.isAbsolute(entry) ? entry : path.resolve(root, entry);
      origin = diagnosticInputOrigin(path.relative(root, requested).split(path.sep).join('/'));
      const loaded = await graph.load(await graph.entry(requested));
      if (loaded.failures.length) throw loaded.failures[0];
      snapshot = loaded;
    }
  } catch (error) {
    // Declared loader failures are ordinary Errors. TypeError, ReferenceError
    // and RangeError are not part of that contract, so they stay defects and
    // keep their stacks instead of being relabeled as bad source.
    if (error instanceof CompilerRejection) return { ok: false, diagnostics: [error.diagnostic] };
    if (isDeclaredInputError(error))
      return { ok: false, diagnostics: [inputDiagnostic(error, origin)] };
    return { ok: false, diagnostics: [defectDiagnostic(error, origin)] };
  }
  try {
    const fileName = sourceName(snapshot.entry);
    origin = unknownDiagnosticSpan(fileName);
    const source = snapshot.files[fileName];
    if (typeof source !== 'string')
      return {
        ok: false,
        diagnostics: [
          inputDiagnostic(new Error(`Closed source snapshot has no entry ${fileName}.`), origin),
        ],
      };
    const result = compilePrototype(source, {
      fileName,
      files: snapshot.files,
      sourceImports: snapshot.sourceImports,
      exportName: options.exportName,
      componentName: options.componentName,
      profile: options.profile,
      nativeSdkPath: options.nativeSdkPath,
      gpuiDependency: options.gpuiDependency,
    });
    if (result.ok) {
      const sdk = await verifyGpuiCompilationSdk(result.value.output);
      if (!sdk.ok) return sdk;
    }
    if (result.ok && snapshot.sourceResolution)
      result.value.output.provenance.sourceResolution = snapshot.sourceResolution;
    return result;
  } catch (error) {
    if (error instanceof CompilerRejection) return { ok: false, diagnostics: [error.diagnostic] };
    return { ok: false, diagnostics: [defectDiagnostic(error, origin)] };
  }
}

function isDeclaredInputError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    !(error instanceof TypeError) &&
    !(error instanceof ReferenceError) &&
    !(error instanceof RangeError)
  );
}
function inputDiagnostic(error: unknown, span: SourceSpan) {
  return {
    code: 'PUI1003' as const,
    category: 'invalid-input' as const,
    message: `${error instanceof Error ? error.message : String(error)} (source location unknown)`,
    span,
  };
}
function defectDiagnostic(error: unknown, span: SourceSpan) {
  return {
    code: 'PUI1999' as const,
    category: 'compiler-defect' as const,
    message: `Compiler defect: source location unknown.\n${unexpectedFailureEvidence(error)}`,
    span,
  };
}

export function compilationArtifacts(
  compilation: Compilation,
  options: { sourcePath?: string; manifestPath?: string } = {}
): OutputArtifact[] {
  const output = compilation.output;
  const sourceFile = options.sourcePath ?? generatedSourcePath(output.profile);
  const sourceContents = output.sourceMap
    ? output.code + `\n//# sourceMappingURL=${sourceFile}.map\n`
    : output.code;
  const artifacts: OutputArtifact[] = [
    { path: sourceFile, contents: sourceContents, kind: 'source' },
  ];
  for (const file of output.supportingFiles ?? []) artifacts.push(file);
  if (output.sourceMap)
    artifacts.push({
      path: `${sourceFile}.map`,
      contents: JSON.stringify({ ...output.sourceMap, file: sourceFile }) + '\n',
      kind: 'source-map',
    });
  artifacts.push({
    path: options.manifestPath ?? 'provenance.json',
    kind: 'manifest',
    contents:
      JSON.stringify(
        {
          ...output.provenance,
          profile: output.profile,
          dependencies: output.dependencies,
          sourceFiles: compilation.ir.sourceFiles.map((file) => ({
            file: file.file,
            sha256: file.sha256,
          })),
          generatedSha256: createHash('sha256').update(sourceContents).digest('hex'),
          artifacts: artifacts.map((file) => ({
            path: file.path,
            kind: file.kind,
            sha256: createHash('sha256').update(file.contents).digest('hex'),
          })),
        },
        null,
        2
      ) + '\n',
  });
  return artifacts;
}

/** Create-only artifact publication; never overwrite user source or mutate consumer manifests. */
export async function writeCompilation(
  compilation: Compilation,
  directory: string,
  openExclusive: (filename: string) => Promise<ExclusiveOutputFile> = (filename) =>
    open(filename, 'wx')
): Promise<CompileResult<{ directory: string; files: string[] }>> {
  const sdk = await verifyGpuiCompilationSdk(compilation.output, directory);
  if (!sdk.ok) return sdk;
  return writeArtifactSet(compilationArtifacts(compilation), directory, openExclusive);
}

export async function diffCompilation(
  compilation: Compilation,
  directory: string
): Promise<CompileResult<ArtifactDiff>> {
  const sdk = await verifyGpuiCompilationSdk(compilation.output, directory);
  if (!sdk.ok) return sdk;
  return diffArtifactSet(compilationArtifacts(compilation), directory);
}
