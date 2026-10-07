import { lstat, mkdir, open, rmdir, unlink } from 'node:fs/promises';
import { constants, type Stats } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { CompileResult, CompilerDiagnostic } from './ir';

export interface OutputArtifact {
  path: string;
  contents: string;
  kind: 'source' | 'style' | 'declaration' | 'source-map' | 'manifest';
}

export interface ArtifactDiff {
  directory: string;
  changes: {
    path: string;
    status: 'added' | 'removed' | 'modified' | 'unchanged';
    consumerModified: boolean;
    currentSha256: string | null;
    generatedSha256: string | null;
    recordedSha256: string | null;
  }[];
}

export interface ExclusiveOutputFile {
  writeFile(data: string): Promise<unknown>;
  close(): Promise<void>;
  /** Ownership must follow the opened descriptor, never a potentially replaced pathname. */
  stat(): Promise<Stats>;
}

interface Identity {
  dev: number;
  ino: number;
  birthtimeMs: number;
}

interface OwnedDirectory {
  filename: string;
  parent?: OwnedDirectory;
  identity?: Identity;
}

interface OwnedFile {
  filename: string;
  artifactPath: string;
  parent: OwnedDirectory;
  identity?: Identity;
}

interface PathNode {
  spelling: string;
  file: boolean;
  children: Map<string, PathNode>;
}

class PublicationFailure extends Error {
  constructor(
    message: string,
    readonly filename: string,
    readonly category: 'output-conflict' | 'output-write'
  ) {
    super(message);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown): unknown {
  return error && typeof error === 'object' && 'code' in error ? error.code : undefined;
}

function failure(error: unknown, filename: string, action: string): PublicationFailure {
  const code = errorCode(error);
  return new PublicationFailure(
    `${action}: ${errorMessage(error)}`,
    filename,
    code === 'EEXIST' || code === 'ENOTDIR' || code === 'EISDIR'
      ? 'output-conflict'
      : 'output-write'
  );
}

function sameIdentity(actual: Stats, expected: Identity | undefined): boolean {
  return !!expected && actual.dev === expected.dev && actual.ino === expected.ino && actual.birthtimeMs === expected.birthtimeMs;
}

function validateArtifacts(artifacts: readonly OutputArtifact[]): string | undefined {
  const root: PathNode = { spelling: '', file: false, children: new Map() };
  const kinds: Record<OutputArtifact['kind'], true> = {
    source: true,
    style: true,
    declaration: true,
    'source-map': true,
    manifest: true,
  };
  for (const artifact of artifacts) {
    if (
      !artifact ||
      typeof artifact.path !== 'string' ||
      typeof artifact.contents !== 'string' ||
      !Object.hasOwn(kinds, artifact.kind)
    )
      return 'Each output artifact must have a path, string contents and a supported kind';
    const filename = artifact.path;
    if (!filename || path.posix.isAbsolute(filename) || path.win32.isAbsolute(filename))
      return `Artifact path must be a non-empty relative path: ${JSON.stringify(filename)}`;
    // Use one portable spelling rather than letting the host normalize traversal, ADS or aliases.
    if (/[\\<>:"|?*\u0000-\u001f\u007f]/u.test(filename))
      return `Artifact path contains a non-portable character: ${JSON.stringify(filename)}`;
    const segments = filename.split('/');
    let node = root;
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      if (!segment || segment === '.' || segment === '..' || /[. ]$/u.test(segment))
        return `Artifact path contains an unsafe segment: ${JSON.stringify(filename)}`;
      if (/^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³]) *(?:\.|$)/iu.test(segment))
        return `Artifact path contains a reserved device name: ${JSON.stringify(filename)}`;
      const key = segment.normalize('NFC').toUpperCase().toLowerCase();
      const existing = node.children.get(key);
      const last = index === segments.length - 1;
      if (existing) {
        if (existing.spelling !== segment)
          return `Artifact paths have a case or Unicode spelling collision: ${JSON.stringify(filename)}`;
        if (existing.file || last)
          return `Artifact paths have a duplicate or file/directory collision: ${JSON.stringify(filename)}`;
        node = existing;
      } else {
        const child: PathNode = { spelling: segment, file: last, children: new Map() };
        node.children.set(key, child);
        node = child;
      }
    }
  }
  return undefined;
}

/** Compare generated candidates with owned files; never mutate or follow artifact symlinks. */
export async function diffArtifactSet(artifacts: readonly OutputArtifact[], directory: string): Promise<CompileResult<ArtifactDiff>> {
  const absolute = path.resolve(directory);
  const location = (filename: string) => ({ file: filename, start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 });
  const reject = (message: string, filename = absolute): CompileResult<ArtifactDiff> => ({ ok: false, diagnostics: [
    { code: 'PUI5001', category: 'output-conflict', message, span: location(filename) },
  ] });
  const problem = validateArtifacts(artifacts);
  if (problem) return reject(problem);
  try {
    const rootStat = await lstat(absolute);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return reject('Diff requires an existing real compiler output directory.');
    async function contents(filename: string): Promise<Buffer | null> {
      let current = absolute;
      const directories = [{ filename: absolute, identity: rootStat }];
      const parts = filename.split('/');
      for (const part of parts.slice(0, -1)) {
        current = path.join(current, part);
        let stat: Stats;
        try { stat = await lstat(current); }
        catch (error) { if (errorCode(error) === 'ENOENT') return null; throw error; }
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Diff refuses a non-directory or symbolic-link artifact parent: ${current}`);
        directories.push({ filename: current, identity: stat });
      }
      const target = path.join(current, parts[parts.length - 1]);
      let before: Stats;
      try { before = await lstat(target); }
      catch (error) { if (errorCode(error) === 'ENOENT') return null; throw error; }
      if (!before.isFile() || before.isSymbolicLink()) throw new Error(`Diff refuses a non-regular or symbolic-link artifact: ${target}`);
      const file = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        if (!sameIdentity(await file.stat(), before)) throw new Error(`Artifact changed during diff: ${target}`);
        const data = await file.readFile();
        for (const parent of directories) if (!sameIdentity(await lstat(parent.filename), parent.identity))
          throw new Error(`Artifact parent changed during diff: ${parent.filename}`);
        const after = await file.stat();
        if (!sameIdentity(await lstat(target), before) || after.size !== before.size || after.mtimeMs !== before.mtimeMs)
          throw new Error(`Artifact changed during diff: ${target}`);
        return data;
      } finally { await file.close(); }
    }
    const manifestBytes = await contents('provenance.json');
    if (!manifestBytes) return reject('Diff requires the compiler-owned provenance.json; arbitrary consumer directories are not baselines.');
    const manifest: unknown = JSON.parse(manifestBytes.toString('utf8'));
    if (!manifest || typeof manifest !== 'object' || !('artifacts' in manifest) || !Array.isArray(manifest.artifacts)
      || !('irVersion' in manifest) || !Number.isSafeInteger(manifest.irVersion) || Number(manifest.irVersion) < 1
      || !('backend' in manifest) || typeof manifest.backend !== 'string'
      || !('profile' in manifest) || manifest.profile !== manifest.backend)
      return reject('Existing provenance is not a compiler artifact ownership manifest.');
    const recorded = new Map<string, string>();
    const recordedArtifacts: OutputArtifact[] = [];
    for (const record of manifest.artifacts) {
      if (!record || typeof record !== 'object' || typeof record.path !== 'string'
        || typeof record.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(record.sha256)
        || typeof record.kind !== 'string' || record.path === 'provenance.json')
        return reject('Existing provenance contains an invalid artifact ownership record.');
      recordedArtifacts.push({ path: record.path, contents: '', kind: record.kind as OutputArtifact['kind'] });
      recorded.set(record.path, record.sha256);
    }
    const recordedProblem = validateArtifacts(recordedArtifacts);
    if (recordedProblem) return reject(recordedProblem);
    const generated = new Map(artifacts.map((artifact) => [artifact.path, createHash('sha256').update(artifact.contents).digest('hex')]));
    const names = [...new Set([...recorded.keys(), ...generated.keys()])].sort();
    const changes: ArtifactDiff['changes'] = [];
    for (const filename of names) {
      const data = filename === 'provenance.json' ? manifestBytes : await contents(filename);
      const currentSha256 = data === null ? null : createHash('sha256').update(data).digest('hex');
      const generatedSha256 = generated.get(filename) ?? null;
      const recordedSha256 = recorded.get(filename) ?? null;
      changes.push({ path: filename,
        status: currentSha256 === generatedSha256 ? 'unchanged' : currentSha256 === null ? 'added' : generatedSha256 === null ? 'removed' : 'modified',
        consumerModified: filename !== 'provenance.json' && currentSha256 !== recordedSha256,
        currentSha256, generatedSha256, recordedSha256,
      });
    }
    if (!sameIdentity(await lstat(absolute), rootStat)) return reject('Output directory changed during diff.');
    return { ok: true, value: { directory: absolute, changes } };
  } catch (error) {
    return reject(`Cannot compare compiler-owned output: ${errorMessage(error)}`);
  }
}

async function directoryProblem(directory: OwnedDirectory): Promise<PublicationFailure | undefined> {
  for (let current: OwnedDirectory | undefined = directory; current; current = current.parent) {
    if (!current.identity)
      return new PublicationFailure(`ownership could not be established for ${current.filename}`, current.filename, 'output-write');
    try {
      const actual = await lstat(current.filename);
      if (!actual.isDirectory() || !sameIdentity(actual, current.identity))
        return new PublicationFailure(`owned directory was replaced: ${current.filename}`, current.filename, 'output-conflict');
    } catch (error) {
      return new PublicationFailure(
        `owned directory is unavailable: ${current.filename}: ${errorMessage(error)}`,
        current.filename,
        errorCode(error) === 'ENOENT' || errorCode(error) === 'ENOTDIR' ? 'output-conflict' : 'output-write'
      );
    }
  }
  return undefined;
}

async function requireDirectory(directory: OwnedDirectory): Promise<void> {
  const problem = await directoryProblem(directory);
  if (problem) throw problem;
}

async function rollback(files: readonly OwnedFile[], directories: readonly OwnedDirectory[]) {
  const unresolved: string[] = [];
  const preserved: string[] = [];
  for (let index = files.length - 1; index >= 0; index--) {
    const file = files[index];
    const parentProblem = await directoryProblem(file.parent);
    if (parentProblem || !file.identity) {
      unresolved.push(`${file.filename} (${parentProblem?.message ?? 'file ownership could not be established'})`);
      continue;
    }
    try {
      const actual = await lstat(file.filename);
      if (!actual.isFile() || !sameIdentity(actual, file.identity)) {
        preserved.push(`${file.filename} (foreign replacement)`);
        unresolved.push(`${file.filename} (original owned file cleanup could not be verified after replacement)`);
        continue;
      }
      await unlink(file.filename);
    } catch (error) {
      if (errorCode(error) !== 'ENOENT')
        unresolved.push(`${file.filename} (${errorMessage(error)})`);
    }
  }
  // Creation order is parent-before-child; reverse order removes only empty owned directories.
  for (let index = directories.length - 1; index >= 0; index--) {
    const directory = directories[index];
    if (directory.parent) {
      const parentProblem = await directoryProblem(directory.parent);
      if (parentProblem) {
        unresolved.push(`${directory.filename} (${parentProblem.message})`);
        continue;
      }
    }
    if (!directory.identity) {
      unresolved.push(`${directory.filename} (directory ownership could not be established)`);
      continue;
    }
    try {
      const actual = await lstat(directory.filename);
      if (!actual.isDirectory() || !sameIdentity(actual, directory.identity)) {
        preserved.push(`${directory.filename} (foreign replacement)`);
        unresolved.push(`${directory.filename} (original owned directory cleanup could not be verified after replacement)`);
        continue;
      }
      await rmdir(directory.filename);
    } catch (error) {
      const code = errorCode(error);
      if (code !== 'ENOENT')
        unresolved.push(
          `${directory.filename} (${code === 'ENOTEMPTY' || code === 'EEXIST' ? 'remaining contents preserved; ' : ''}${errorMessage(error)})`
        );
    }
  }
  return { unresolved, preserved };
}

/**
 * Publish a precomputed artifact set into an exclusively reserved fresh directory.
 * Paths are portable slash-relative names. Contents are written as UTF-8 without rewriting.
 * No existing destination, file, consumer manifest or foreign rollback entry is overwritten.
 */
export async function writeArtifactSet(
  artifacts: readonly OutputArtifact[],
  directory: string,
  openExclusive: (filename: string) => Promise<ExclusiveOutputFile> = (filename) =>
    open(filename, 'wx')
): Promise<CompileResult<{ directory: string; files: string[] }>> {
  const invalid =
    !Array.isArray(artifacts)
      ? 'Output artifacts must be an array'
      : typeof directory !== 'string' || !directory || directory.includes('\0')
        ? 'Output destination must be a non-empty path without NUL characters'
        : validateArtifacts(artifacts);
  if (invalid)
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI3004',
          category: 'invalid-input',
          message: invalid,
          span: {
            file: typeof directory === 'string' ? directory : '<output>',
            start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1,
          },
        },
      ],
    };

  const output = path.resolve(directory);
  // Snapshot the planned set before awaiting filesystem operations; callers cannot change the commit.
  const planned = artifacts
    .map((artifact) => ({ ...artifact }))
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  const directories: OwnedDirectory[] = [];
  const files: OwnedFile[] = [];
  const byPath = new Map<string, OwnedDirectory>();
  const completed = new Set<string>();
  const secondaryErrors: string[] = [];
  let current = output;
  let action = 'Cannot reserve a fresh output destination';
  try {
    await mkdir(output);
    const root: OwnedDirectory = { filename: output };
    directories.push(root);
    byPath.set(output, root);
    const rootStat = await lstat(output);
    if (!rootStat.isDirectory())
      throw new PublicationFailure('Reserved output directory was replaced', output, 'output-conflict');
    root.identity = { dev: rootStat.dev, ino: rootStat.ino, birthtimeMs: rootStat.birthtimeMs };

    for (const artifact of planned) {
      let parent = root;
      const segments = artifact.path.split('/');
      for (let index = 0; index < segments.length - 1; index++) {
        const dirname = path.join(parent.filename, segments[index]);
        const existing = byPath.get(dirname);
        if (existing) {
          parent = existing;
          continue;
        }
        await requireDirectory(parent);
        current = dirname;
        action = 'Cannot exclusively create an artifact directory';
        await mkdir(dirname);
        const created: OwnedDirectory = { filename: dirname, parent };
        directories.push(created);
        byPath.set(dirname, created);
        const actual = await lstat(dirname);
        if (!actual.isDirectory())
          throw new PublicationFailure('Created artifact directory was replaced', dirname, 'output-conflict');
        created.identity = { dev: actual.dev, ino: actual.ino, birthtimeMs: actual.birthtimeMs };
        parent = created;
      }
      await requireDirectory(parent);
      current = path.join(output, ...segments);
      action = 'Cannot exclusively create an artifact file';
      const handle = await openExclusive(current);
      // Exclusive creation establishes ownership BEFORE any operation can fail or leave partial bytes.
      const owned: OwnedFile = { filename: current, artifactPath: artifact.path, parent };
      files.push(owned);
      let writeFailure: PublicationFailure | undefined;
      try {
        action = 'Cannot establish artifact file ownership';
        if (typeof handle.stat !== 'function')
          throw new PublicationFailure('Exclusive output handle cannot prove descriptor ownership', current, 'output-write');
        const actual = await handle.stat();
        if (!actual.isFile())
          throw new PublicationFailure('Created artifact file is not a regular file', current, 'output-conflict');
        owned.identity = { dev: actual.dev, ino: actual.ino, birthtimeMs: actual.birthtimeMs };
        await requireDirectory(parent);
        const named = await lstat(current);
        if (!named.isFile() || !sameIdentity(named, owned.identity))
          throw new PublicationFailure('Created artifact file was replaced', current, 'output-conflict');
        action = 'Cannot write an artifact file';
        await handle.writeFile(artifact.contents);
      } catch (error) {
        writeFailure = error instanceof PublicationFailure ? error : failure(error, current, action);
      }
      try {
        await handle.close();
      } catch (error) {
        const closeFailure = failure(error, current, 'Cannot close an artifact file');
        if (writeFailure) secondaryErrors.push(`${current}: ${closeFailure.message}`);
        else writeFailure = closeFailure;
      }
      if (writeFailure) throw writeFailure;
      completed.add(artifact.path);
    }

    // Do not report success if a concurrently replaced path no longer names the committed artifact.
    for (const file of files) {
      current = file.filename;
      action = 'Cannot verify a committed artifact';
      try {
        await requireDirectory(file.parent);
        const actual = await lstat(current);
        if (!actual.isFile() || !sameIdentity(actual, file.identity))
          throw new PublicationFailure('Committed artifact file was replaced', current, 'output-conflict');
      } catch (error) {
        completed.delete(file.artifactPath);
        if (errorCode(error) === 'ENOENT' || errorCode(error) === 'ENOTDIR')
          throw new PublicationFailure(`Committed artifact file is unavailable: ${errorMessage(error)}`, current, 'output-conflict');
        throw error;
      }
    }
    await requireDirectory(root);
    return { ok: true, value: { directory: output, files: files.map((file) => file.filename) } };
  } catch (error) {
    const primary = error instanceof PublicationFailure ? error : failure(error, current, action);
    const cleanup = await rollback(files, directories);
    const incomplete = planned.filter((artifact) => !completed.has(artifact.path)).map((artifact) => artifact.path);
    const diagnostic: CompilerDiagnostic = {
      code: primary.category === 'output-conflict' ? 'PUI3002' : 'PUI3003',
      category: primary.category,
      message: [
        primary.message,
        `publication failed; no artifact set committed; incomplete artifacts: ${incomplete.length ? incomplete.join(', ') : '(none before rollback)'}`,
        secondaryErrors.length ? `additional failures: ${secondaryErrors.join('; ')}` : '',
        cleanup.unresolved.length ? `rollback incomplete; unresolved owned entries: ${cleanup.unresolved.join('; ')}` : '',
        cleanup.preserved.length ? `foreign replacements preserved: ${cleanup.preserved.join('; ')}` : '',
      ].filter(Boolean).join('; '),
      span: { file: primary.filename, start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 },
    };
    return { ok: false, diagnostics: [diagnostic] };
  }
}
