import { open, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parsePrototype } from './parser';
import { emitReact } from './react';
import { emitReactSource } from './react-source';
import { emitVueSource } from './vue-source';
import { emitVue2Source } from './vue2-source';
import { emitWebComponentSource } from './web-component-source';
import { emitGpuiSource } from './gpui-source';
import { verifyGpuiCompilationSdk } from './gpui-native-sdk-compatibility';
import { emitQtSource } from './qt-source';
import { emitFlutterSource } from './flutter-source';
import { resolveTargetProfile, checkTargetOperations, type TargetSelection } from './targets';
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
import { attachEmitterMap, generatedSourcePath } from './emitter-map';
import { compilerBuildIdentity } from './compiler-build';
import type { CompileResult, GeneratedModule, ParseOptions, PrototypeIR, SourceSpan } from './ir';

export type { ExclusiveOutputFile } from './artifact-output';
export interface Compilation {
  ir: PrototypeIR;
  output: GeneratedModule;
}
export interface CompileOptions extends ParseOptions {
  componentName?: string;
  profile?: string | TargetSelection;
  /** GPUI source dependency shared by composed prototypes; omission bundles the editable SDK. */
  nativeSdkPath?: string;
  /** Inherit the embedding Cargo workspace's gpui dependency. Defaults to the profile pin. */
  gpuiDependency?: 'workspace';
}
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

export function compilePrototype(
  source: string,
  options: CompileOptions = {}
): CompileResult<Compilation> {
  const parsed = parsePrototype(source, options);
  if (!parsed.ok) return parsed;
  const profile = resolveTargetProfile(options.profile ?? 'react-runtime-v1');
  if (!profile.ok) return profile;
  const admitted = checkTargetOperations(parsed.value, profile.value);
  if (!admitted.ok) return admitted;
  let emitted: CompileResult<GeneratedModule>;
  const emitOptions = {
    componentName: options.componentName,
    propsUpdatePolicy: profile.value.observableSemantics.props.update,
  };
  switch (profile.value.id) {
    case 'react-runtime-v1':
      emitted = emitReact(parsed.value, emitOptions);
      break;
    case 'react-dom-source-v1':
      emitted = emitReactSource(parsed.value, emitOptions);
      break;
    case 'vue-source-v1':
      emitted = emitVueSource(parsed.value, emitOptions);
      break;
    case 'vue2-source-v1':
      emitted = emitVue2Source(parsed.value, emitOptions);
      break;
    case 'web-component-source-v1':
      emitted = emitWebComponentSource(parsed.value, {
        className: options.componentName,
        propsUpdatePolicy: emitOptions.propsUpdatePolicy,
      });
      break;
    case 'gpui-source-v1':
      emitted = emitGpuiSource(parsed.value, {
        componentName: options.componentName,
        nativeSdkPath: options.nativeSdkPath,
        gpuiDependency: options.gpuiDependency,
      });
      break;
    case 'qt-source-v1':
      emitted = emitQtSource(parsed.value, { componentName: options.componentName });
      break;
    case 'flutter-source-v1':
      emitted = emitFlutterSource(parsed.value, { componentName: options.componentName });
      break;
    case 'react-dom-ssr-v1':
      emitted = emitReactSource(parsed.value, { ...emitOptions, ssr: true });
      break;
    case 'vue-ssr-v1':
      emitted = emitVueSource(parsed.value, { ...emitOptions, ssr: true });
      break;
    case 'vue2-ssr-v1':
      emitted = emitVue2Source(parsed.value, { ...emitOptions, ssr: true });
      break;
    case 'web-component-ssr-v1':
      emitted = emitWebComponentSource(parsed.value, {
        className: options.componentName,
        ssr: true,
      });
      break;
    default:
      return {
        ok: false,
        diagnostics: [
          {
            code: 'PUI4001',
            category: 'unsupported-input',
            message: `No emitter is implemented for ${profile.value.id}.`,
            span: parsed.value.setup.span,
          },
        ],
      };
  }
  if (!emitted.ok) return emitted;
  try {
    return {
      ok: true,
      value: {
        ir: parsed.value,
        output: attachEmitterMap(
          {
            ...emitted.value,
            provenance: {
              ...emitted.value.provenance,
              ...(compilerBuildIdentity ? { compilerBuild: compilerBuildIdentity } : {}),
              observableSemantics: profile.value.observableSemantics,
            },
          },
          parsed.value
        ),
      },
    };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI3005',
          category: 'compiler-defect',
          message: `Emitter source mapping failed (span identifies setup context): ${unexpectedFailureEvidence(error)}`,
          span: parsed.value.setup.span,
        },
      ],
    };
  }
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
