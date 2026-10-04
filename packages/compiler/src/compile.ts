import { open, readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import { compilePrototype, type Compilation } from './memory';
import type { TargetSelection } from './targets';
import {
  diffArtifactSet,
  writeArtifactSet,
  type ArtifactDiff,
  type ExclusiveOutputFile,
  type OutputArtifact,
} from './artifact-output';
import {
  isLocalSourceSpecifier,
  resolveLocalSource,
  runtimeSourceEdges,
  sourceName,
} from './source-resolution';
import { CompilerRejection } from './diagnostics';
import { generatedSourcePath } from './emitter-map';
import type { CompileResult, SourceSpan } from './ir';

export type { ExclusiveOutputFile } from './artifact-output';
export interface FileCompileOptions {
  root?: string;
  exportName?: string;
  componentName?: string;
  profile?: string | TargetSelection;
  nativeSdkPath?: string;
  /** Closed, already-read source input used by project compilation; no second filesystem read. */
  sourceSnapshot?: { entry: string; files: Readonly<Record<string, string>> };
}

/** Parse only files inside the declared root. Input source is never imported or evaluated. */
export async function compileFile(
  entry: string,
  options: FileCompileOptions = {}
): Promise<CompileResult<Compilation>> {
  const fallback: SourceSpan = {
    file: '<input>',
    start: 0,
    end: 0,
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
  };
  try {
    if (options.sourceSnapshot) {
      const fileName = sourceName(options.sourceSnapshot.entry);
      const source = options.sourceSnapshot.files[fileName];
      if (typeof source !== 'string')
        throw new Error(`Closed source snapshot has no entry ${fileName}.`);
      return compilePrototype(source, {
        fileName,
        files: options.sourceSnapshot.files,
        exportName: options.exportName,
        componentName: options.componentName,
        profile: options.profile,
        nativeSdkPath: options.nativeSdkPath,
      });
    }
    const root = await realpath(options.root ?? process.cwd());
    const files: Record<string, string> = Object.create(null);
    async function load(filename: string): Promise<string> {
      const absolute = await realpath(filename);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const identity = sourceName(relative);
      if (Object.hasOwn(files, identity)) return identity;
      const content = await readFile(absolute, 'utf8');
      files[identity] = content;
      const sourceFile = ts.createSourceFile(
        identity,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
      for (const edge of runtimeSourceEdges(sourceFile)) {
        if (!isLocalSourceSpecifier(edge.specifier)) continue;
        const target = await resolveLocalSource(root, identity, edge.specifier);
        await load(path.join(root, target));
      }
      return identity;
    }
    const fileName = await load(path.isAbsolute(entry) ? entry : path.resolve(root, entry));
    return compilePrototype(files[fileName], {
      fileName,
      files,
      exportName: options.exportName,
      componentName: options.componentName,
      profile: options.profile,
      nativeSdkPath: options.nativeSdkPath,
    });
  } catch (error) {
    if (error instanceof CompilerRejection) return { ok: false, diagnostics: [error.diagnostic] };
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI1003',
          category: 'invalid-input',
          message: error instanceof Error ? error.message : String(error),
          span: fallback,
        },
      ],
    };
  }
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
  return writeArtifactSet(compilationArtifacts(compilation), directory, openExclusive);
}

export async function diffCompilation(
  compilation: Compilation,
  directory: string
): Promise<CompileResult<ArtifactDiff>> {
  return diffArtifactSet(compilationArtifacts(compilation), directory);
}
