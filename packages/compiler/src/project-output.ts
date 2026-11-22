import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  diffArtifactSet,
  validateArtifacts,
  writeArtifactSet,
  type ArtifactDiff,
  type ExclusiveOutputFile,
  type OutputArtifact,
} from './artifact-output';
import { compilationArtifacts } from './compile';
import { generatedSourcePath } from './emitter-map';
import { IR_VERSION, type CompileResult } from './ir';
import { checkTargetOperations, TARGET_PROFILES } from './targets';
import { nativeInteractionArtifacts } from './native-interaction';
import { verifyGpuiCompilationSdk } from './gpui-native-sdk-compatibility';
import type { SuccessfulProjectGeneration } from './project';

export interface ProjectArtifactOptions {
  /** One flat output filename for every project entry, using the profile's source extension. */
  sourcePaths: Readonly<Record<string, string>>;
}

const digest = (contents: string): string => createHash('sha256').update(contents).digest('hex');
const compareNames = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * Plan one module graph for a successful project generation. Shared declaration and
 * transport modules keep their reference identity because every entry imports the
 * same physical file. Only byte-identical supporting artifacts may be coalesced.
 */
export function projectCompilationArtifacts(
  generation: SuccessfulProjectGeneration,
  options: ProjectArtifactOptions
): CompileResult<OutputArtifact[]> {
  const reject = (
    message: string,
    file = '<project-output>',
    category: 'invalid-input' | 'output-conflict' = 'invalid-input'
  ): CompileResult<OutputArtifact[]> => ({
    ok: false,
    diagnostics: [
      {
        code: category === 'output-conflict' ? 'PUI3002' : 'PUI3004',
        category,
        message,
        span: { file, start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 },
      },
    ],
  });
  if (!generation.entries.length)
    return reject('Project output requires at least one compiled entry.');
  const entries = [...generation.entries].sort((left, right) =>
    compareNames(left.entry, right.entry)
  );
  const names = new Set(entries.map(({ entry }) => entry));
  if (names.size !== entries.length) return reject('Project output entries must be unique.');
  const paths = options.sourcePaths;
  if (!paths || Object.keys(paths).some((entry) => !names.has(entry)))
    return reject('Project source paths must name exactly the compiled entries.');
  const profile = entries[0].compilation.output.profile;
  const extension = path.posix.extname(generatedSourcePath(profile));
  const reserved: OutputArtifact[] = [{ path: 'provenance.json', contents: '', kind: 'manifest' }];
  const entryRecords: { entry: string; sourcePath: string; manifestPath: string }[] = [];
  const sources = new Map<string, string>();
  for (const { entry, compilation } of entries) {
    if (compilation.output.profile !== profile)
      return reject('One project artifact graph must use a single target profile.', entry);
    const sourcePath = Object.hasOwn(paths, entry) ? paths[entry] : undefined;
    if (
      typeof sourcePath !== 'string' ||
      sourcePath.includes('/') ||
      path.posix.extname(sourcePath) !== extension
    )
      return reject(
        `Entry ${entry} requires a flat source filename ending in ${extension}.`,
        entry
      );
    const manifestPath = `${sourcePath}.provenance.json`;
    reserved.push({ path: sourcePath, contents: '', kind: 'source' });
    if (compilation.output.sourceMap)
      reserved.push({ path: `${sourcePath}.map`, contents: '', kind: 'source-map' });
    reserved.push({ path: manifestPath, contents: '', kind: 'manifest' });
    entryRecords.push({ entry, sourcePath, manifestPath });
    for (const source of compilation.ir.sourceFiles) {
      const previous = sources.get(source.file);
      if (previous !== undefined && previous !== source.sha256)
        return reject(
          `Project entries contain different source snapshots for ${source.file}.`,
          source.file
        );
      sources.set(source.file, source.sha256);
    }
  }
  const invalidNames = validateArtifacts(reserved);
  if (invalidNames) return reject(invalidNames);
  // One project has one reached support closure. Upgrade only bytes emitted by
  // this compiler, retaining the ordinary conflicting/tampered artifact rejection.
  let controlLabel = false;
  for (const entry of entries) {
    const admitted = checkTargetOperations(entry.compilation.ir, TARGET_PROFILES[profile]);
    if (!admitted.ok) return admitted;
    controlLabel ||= admitted.value.operations.includes('hook.asControlLabel');
  }
  const baseNative = nativeInteractionArtifacts('full');
  const pairedNative = controlLabel
    ? nativeInteractionArtifacts('full', { controlLabel: true })
    : [];
  const sharedNativePaths = new Set(baseNative.map((file) => file.path));
  const reservedPaths = new Set(reserved.map((artifact) => artifact.path));
  const artifacts = new Map<string, OutputArtifact>();
  for (let index = 0; index < entries.length; index++) {
    let { compilation } = entries[index];
    const supporting = compilation.output.supportingFiles;
    if (
      controlLabel &&
      supporting?.some((file) => file.path === '.proto-ui/interaction/native-v1.ts')
    ) {
      const full = supporting.filter((file) => sharedNativePaths.has(file.path));
      const canonical = [baseNative, pairedNative].some((candidate) => {
        const required = candidate.filter((file) => sharedNativePaths.has(file.path));
        return (
          full.length === required.length &&
          required.every((target) =>
            full.some(
              (file) =>
                file.path === target.path &&
                file.kind === target.kind &&
                file.contents === target.contents
            )
          )
        );
      });
      if (!canonical)
        return reject(
          'Project contains unknown or modified native support; cannot unify reached capabilities.',
          entries[index].entry,
          'output-conflict'
        );
      const enabledPaths = new Set(pairedNative.map((file) => file.path));
      for (const file of supporting) {
        const canonical = pairedNative.find((target) => target.path === file.path);
        if (
          canonical &&
          !sharedNativePaths.has(file.path) &&
          (file.kind !== canonical.kind || file.contents !== canonical.contents)
        )
          return reject(
            'Project contains modified ControlLabel support.',
            file.path,
            'output-conflict'
          );
      }
      compilation = {
        ...compilation,
        output: {
          ...compilation.output,
          supportingFiles: [
            ...supporting.filter((file) => !enabledPaths.has(file.path)),
            ...pairedNative,
          ],
        },
      };
    }
    const record = entryRecords[index];
    const candidates = compilationArtifacts(compilation, record);
    const invalid = validateArtifacts(candidates);
    if (invalid) return reject(invalid, record.entry);
    const supportingPaths = new Set(compilation.output.supportingFiles?.map((file) => file.path));
    for (const artifact of candidates) {
      if (supportingPaths.has(artifact.path) && reservedPaths.has(artifact.path))
        return reject(
          `Supporting artifact conflicts with an entry artifact: ${artifact.path}.`,
          artifact.path,
          'output-conflict'
        );
      const previous = artifacts.get(artifact.path);
      if (previous && (previous.kind !== artifact.kind || previous.contents !== artifact.contents))
        return reject(
          `Project entries emit conflicting supporting artifacts: ${artifact.path}.`,
          artifact.path,
          'output-conflict'
        );
      artifacts.set(artifact.path, artifact);
    }
  }
  const planned = [...artifacts.values()].sort((left, right) =>
    compareNames(left.path, right.path)
  );
  const invalid = validateArtifacts([...planned, reserved[0]]);
  if (invalid) return reject(invalid);
  planned.push({
    path: 'provenance.json',
    kind: 'manifest',
    contents:
      JSON.stringify(
        {
          irVersion: IR_VERSION,
          backend: profile,
          profile,
          projectIdentity: generation.identity,
          entries: entryRecords,
          sourceFiles: [...sources]
            .sort(([left], [right]) => compareNames(left, right))
            .map(([file, sha256]) => ({ file, sha256 })),
          artifacts: planned.map((artifact) => ({
            path: artifact.path,
            kind: artifact.kind,
            sha256: digest(artifact.contents),
          })),
        },
        null,
        2
      ) + '\n',
  });
  return { ok: true, value: planned };
}

/** Publish all project entries and their shared modules into one fresh directory. */
export async function writeProjectCompilation(
  generation: SuccessfulProjectGeneration,
  directory: string,
  options: ProjectArtifactOptions,
  openExclusive?: (filename: string) => Promise<ExclusiveOutputFile>
): Promise<CompileResult<{ directory: string; files: string[] }>> {
  const planned = projectCompilationArtifacts(generation, options);
  if (!planned.ok) return planned;
  for (const { compilation } of generation.entries) {
    const sdk = await verifyGpuiCompilationSdk(compilation.output, directory);
    if (!sdk.ok) return sdk;
  }
  return writeArtifactSet(planned.value, directory, openExclusive);
}

export async function diffProjectCompilation(
  generation: SuccessfulProjectGeneration,
  directory: string,
  options: ProjectArtifactOptions
): Promise<CompileResult<ArtifactDiff>> {
  const planned = projectCompilationArtifacts(generation, options);
  if (!planned.ok) return planned;
  for (const { compilation } of generation.entries) {
    const sdk = await verifyGpuiCompilationSdk(compilation.output, directory);
    if (!sdk.ok) return sdk;
  }
  return diffArtifactSet(planned.value, directory);
}
