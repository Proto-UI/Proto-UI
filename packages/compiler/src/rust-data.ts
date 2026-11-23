import { createHash } from 'node:crypto';
import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  diffArtifactSet,
  writeArtifactSet,
  type ArtifactDiff,
  type ExclusiveOutputFile,
  type OutputArtifact,
} from './artifact-output';
import { CompilerRejection } from './diagnostics';
import type {
  CompileResult,
  CompilerDiagnostic,
  ParseOptions,
  PrototypeIR,
  SourceSpan,
} from './ir';
import { parsePrototype } from './parser';
import { emitRustDataSource, type RustDataModule, type RustDataOptions } from './rust-data-source';
import { FileSourceGraph, type FileSourceSnapshot } from './source-loader';
import { sourceName } from './source-resolution';

export interface RustDataCompilation {
  ir: PrototypeIR;
  output: RustDataModule;
}

export interface RustDataCompileOptions extends ParseOptions, RustDataOptions {}

export interface RustDataFileCompileOptions extends RustDataOptions {
  root?: string;
  exportName?: string;
  /** Closed, already-read source inputs; no source module is executed. */
  sourceSnapshot?: FileSourceSnapshot;
}

/** Select pure checked source functions explicitly, independently of any component instance. */
export function compileRustDataPrototype(
  source: string,
  options: RustDataCompileOptions
): CompileResult<RustDataCompilation> {
  const parsed = parsePrototype(source, options);
  if (!parsed.ok) return parsed;
  const emitted = emitRustDataSource(parsed.value, options);
  if (!emitted.ok) return emitted;
  return { ok: true, value: { ir: parsed.value, output: emitted.value } };
}

const fallbackSpan: SourceSpan = {
  file: '<input>',
  start: 0,
  end: 0,
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
};

function inputFailure(error: unknown): CompilerDiagnostic {
  return {
    code: 'PUI1003',
    category: 'invalid-input',
    message: error instanceof Error ? error.message : String(error),
    span: fallbackSpan,
  };
}

function defect(error: unknown): CompilerDiagnostic {
  return {
    code: 'PUI1999',
    category: 'compiler-defect',
    message: `Compiler defect: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    span: fallbackSpan,
  };
}

/** Resolve the same declared proto source graph used by component compilation. */
export async function compileRustDataFile(
  entry: string,
  options: RustDataFileCompileOptions
): Promise<CompileResult<RustDataCompilation>> {
  let snapshot = options.sourceSnapshot;
  try {
    if (!snapshot) {
      const root = await realpath(options.root ?? process.cwd());
      const graph = new FileSourceGraph(root);
      const location = await graph.entry(
        path.isAbsolute(entry) ? entry : path.resolve(root, entry)
      );
      const loaded = await graph.load(location);
      if (loaded.failures.length) throw loaded.failures[0];
      snapshot = loaded;
    }
  } catch (error) {
    if (error instanceof CompilerRejection) return { ok: false, diagnostics: [error.diagnostic] };
    // Match the component file boundary: declared filesystem/source failures are
    // input errors; unexpected language exceptions retain their original stacks.
    const declared =
      error instanceof Error &&
      !(error instanceof TypeError) &&
      !(error instanceof ReferenceError) &&
      !(error instanceof RangeError);
    return { ok: false, diagnostics: [declared ? inputFailure(error) : defect(error)] };
  }
  try {
    const fileName = sourceName(snapshot.entry);
    const source = snapshot.files[fileName];
    if (typeof source !== 'string')
      return {
        ok: false,
        diagnostics: [inputFailure(new Error(`Closed source snapshot has no entry ${fileName}.`))],
      };
    const result = compileRustDataPrototype(source, {
      fileName,
      files: snapshot.files,
      sourceImports: snapshot.sourceImports,
      exportName: options.exportName,
      methods: options.methods,
      crateName: options.crateName,
      sourceLicense: options.sourceLicense,
    });
    if (result.ok && snapshot.sourceResolution)
      result.value.output.provenance.sourceResolution = snapshot.sourceResolution;
    return result;
  } catch (error) {
    if (error instanceof CompilerRejection) return { ok: false, diagnostics: [error.diagnostic] };
    return { ok: false, diagnostics: [defect(error)] };
  }
}

/** Complete inventory, including the actual source closure and typed method boundary. */
export function rustDataCompilationArtifacts(compilation: RustDataCompilation): OutputArtifact[] {
  const { ir, output } = compilation;
  const sha256 = (contents: string): string => createHash('sha256').update(contents).digest('hex');
  const artifacts: OutputArtifact[] = [
    { path: 'lib.rs', kind: 'source', contents: output.code },
    ...output.supportingFiles,
  ];
  artifacts.push({
    path: 'provenance.json',
    kind: 'manifest',
    contents:
      JSON.stringify(
        {
          ...output.provenance,
          format: output.format,
          version: output.version,
          profile: output.profile,
          dependencies: output.dependencies,
          methods: output.methods,
          sourceFiles: ir.sourceFiles.map(({ file, sha256 }) => ({ file, sha256 })),
          generatedSha256: sha256(output.code),
          artifacts: artifacts.map(({ path, kind, contents }) => ({
            path,
            kind,
            sha256: sha256(contents),
          })),
        },
        null,
        2
      ) + '\n',
  });
  return artifacts;
}

/** Never replace retained output, even when a previous ownership receipt exists. */
export async function writeRustDataCompilation(
  compilation: RustDataCompilation,
  directory: string,
  openExclusive: (filename: string) => Promise<ExclusiveOutputFile> = (filename) =>
    open(filename, 'wx')
): Promise<CompileResult<{ directory: string; files: string[] }>> {
  return writeArtifactSet(rustDataCompilationArtifacts(compilation), directory, openExclusive);
}

export async function diffRustDataCompilation(
  compilation: RustDataCompilation,
  directory: string
): Promise<CompileResult<ArtifactDiff>> {
  return diffArtifactSet(rustDataCompilationArtifacts(compilation), directory);
}
