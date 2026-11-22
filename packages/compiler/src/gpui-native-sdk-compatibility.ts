import { constants, type Stats } from 'node:fs';
import { lstat, open, readdir, readlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  GPUI_NATIVE_SDK_PATH,
  gpuiNativeSdkFiles,
  gpuiNativeSdkIdentity,
  gpuiNativeSdkInventory,
  type GpuiNativeSdkIdentity,
} from './gpui-native-sdk';
import type { CompileResult, GeneratedModule } from './ir';
import { gpuiComponentCargoManifest } from './gpui-native-manifest';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const sameFile = (left: Stats, right: Stats) => left.dev === right.dev && left.ino === right.ino;

/** Resolve existing ancestors without creating the planned output directory. */
async function realOutputDirectory(directory: string): Promise<string> {
  let current = path.resolve(directory);
  const missing: string[] = [];
  while (true) {
    try {
      return path.join(await realpath(current), ...missing);
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT')
        throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

function failure(message: string, file: string): CompileResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        code: 'PUI_GPUI_SDK_COMPATIBILITY',
        category: 'invalid-input',
        message,
        span: { file, start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 },
      },
    ],
  };
}

/** Exact compiler-owned inputs, plus optional receipt and Cargo's automatic build-script entry. */
export function gpuiNativeSdkInputPaths(directory: string): string[] {
  return [...gpuiNativeSdkInventory().map((file) => file.path), 'provenance.json', 'build.rs'].map(
    (filename) => path.resolve(directory, filename)
  );
}

/**
 * Symlink directory entries are independent watch inputs: watching their target
 * inode cannot observe replacement of the link in its parent. Follow link targets
 * as well as the requested path, preserving parent traversal after each link.
 */
export async function gpuiNativeSdkPathLinks(directory: string): Promise<string[]> {
  const absolute = path.resolve(directory);
  const links = new Set<string>();
  let current = path.parse(absolute).root;
  let remaining = absolute.slice(current.length).split(path.sep);
  let followed = 0;
  while (remaining.length) {
    const segment = remaining.shift()!;
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      current = path.dirname(current);
      continue;
    }
    const candidate = path.join(current, segment);
    let entry: Stats;
    try {
      entry = await lstat(candidate);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'ENOENT' || error.code === 'ENOTDIR')
      )
        break;
      throw error;
    }
    if (!entry.isSymbolicLink()) {
      current = candidate;
      continue;
    }
    links.add(candidate);
    if (++followed > 40) throw new Error(`SDK path has too many symbolic links: ${absolute}`);
    const target = await readlink(candidate);
    if (path.isAbsolute(target)) {
      current = path.parse(target).root;
      remaining = [...target.slice(current.length).split(path.sep), ...remaining];
    } else remaining = [...target.split(path.sep), ...remaining];
  }
  return [...links];
}

/**
 * Read the complete SDK source inventory without trusting a package version or a receipt.
 * Cargo lockfiles and target output are not SDK source; every other extra input rejects.
 * This proves these observed bytes, not a later Cargo resolution or OS/native execution.
 */
export async function verifyGpuiNativeSdk(
  directory: string,
  useWorkspace = false
): Promise<CompileResult<{ directory: string; identity: GpuiNativeSdkIdentity }>> {
  const requested = path.resolve(directory);
  let absolute = requested;
  const expected = gpuiNativeSdkInventory(useWorkspace);
  const expectedByPath = new Map(expected.map((file) => [file.path, file]));
  const identity = gpuiNativeSdkIdentity(useWorkspace);
  const observed = new Set<string>();
  const parents: { path: string; stat: Stats }[] = [];
  const checkedFiles: { path: string; stat: Stats }[] = [];
  let receipt: unknown;
  try {
    const requestedRoot = await lstat(requested);
    if (!requestedRoot.isDirectory() || requestedRoot.isSymbolicLink())
      throw new Error(`SDK input must be a real directory, not a link: ${requested}`);
    // Ancestor links (including macOS /var and /tmp) are legitimate paths. Bind
    // verification and the caller's watcher closure to their actual directory.
    absolute = await realpath(requested);
    async function readRegular(filename: string, before: Stats): Promise<Buffer> {
      if (!before.isFile() || before.isSymbolicLink())
        throw new Error(`SDK input must be a regular file, not a link: ${filename}`);
      const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        if (!sameFile(await handle.stat(), before))
          throw new Error(`SDK input changed: ${filename}`);
        const bytes = await handle.readFile();
        const after = await handle.stat();
        if (
          !sameFile(await lstat(filename), before) ||
          after.size !== before.size ||
          after.mtimeMs !== before.mtimeMs
        )
          throw new Error(`SDK input changed during verification: ${filename}`);
        checkedFiles.push({ path: filename, stat: before });
        return bytes;
      } finally {
        await handle.close();
      }
    }
    async function visit(relative: string): Promise<void> {
      const current = path.resolve(absolute, relative);
      const before = await lstat(current);
      if (!before.isDirectory() || before.isSymbolicLink())
        throw new Error(`SDK input must be a real directory, not a link: ${current}`);
      parents.push({ path: current, stat: before });
      for (const entry of await readdir(current)) {
        const filename = relative ? `${relative}/${entry}` : entry;
        const location = path.join(current, entry);
        const info = await lstat(location);
        if (!relative && entry === 'target' && info.isDirectory() && !info.isSymbolicLink())
          continue;
        if (!relative && entry === 'Cargo.lock' && info.isFile() && !info.isSymbolicLink())
          continue;
        if (!relative && entry === 'provenance.json') {
          receipt = JSON.parse((await readRegular(location, info)).toString('utf8'));
          continue;
        }
        const expectedFile = expectedByPath.get(filename);
        if (expectedFile) {
          const bytes = await readRegular(location, info);
          if (hash(bytes) !== expectedFile.sha256)
            throw new Error(
              `SDK ${filename} does not match compiler ${identity.version} (${identity.dependencyMode} dependency mode); regenerate the shared SDK with the same compiler and mode.`
            );
          observed.add(filename);
        } else if (expected.some((file) => file.path.startsWith(`${filename}/`))) {
          await visit(filename);
        } else {
          throw new Error(`Unowned SDK input is outside the compiler inventory: ${filename}`);
        }
      }
    }
    await visit('');
    const missing = expected.filter((file) => !observed.has(file.path)).map((file) => file.path);
    if (missing.length)
      throw new Error(`Shared SDK is missing compiler inputs: ${missing.join(', ')}`);
    if (receipt !== undefined) {
      if (
        !receipt ||
        typeof receipt !== 'object' ||
        !('sdk' in receipt) ||
        receipt.sdk !== identity.name ||
        !('version' in receipt) ||
        receipt.version !== identity.version ||
        !('artifacts' in receipt) ||
        !Array.isArray(receipt.artifacts)
      )
        throw new Error('Shared SDK receipt is not an SDK ownership manifest.');
      const records = receipt.artifacts;
      if (
        records.length !== expected.length ||
        new Set(records.map((record) => record?.path)).size !== expected.length ||
        records.some((record) => {
          if (
            !record ||
            typeof record !== 'object' ||
            typeof record.path !== 'string' ||
            typeof record.kind !== 'string' ||
            typeof record.sha256 !== 'string'
          )
            return true;
          const expectedRecord = expectedByPath.get(record.path);
          return (
            !expectedRecord ||
            record.kind !== expectedRecord.kind ||
            record.sha256 !== expectedRecord.sha256
          );
        })
      )
        throw new Error(
          'Shared SDK receipt does not describe the compiler-owned source inventory.'
        );
      if (
        ('dependencyMode' in receipt && receipt.dependencyMode !== identity.dependencyMode) ||
        ('contentSha256' in receipt && receipt.contentSha256 !== identity.contentSha256)
      )
        throw new Error(
          'Shared SDK receipt has an incompatible content identity or dependency mode.'
        );
    }
    for (const parent of parents) {
      const after = await lstat(parent.path);
      if (!sameFile(after, parent.stat) || after.mtimeMs !== parent.stat.mtimeMs)
        throw new Error(`SDK directory changed during verification: ${parent.path}`);
    }
    for (const file of checkedFiles) {
      const after = await lstat(file.path);
      if (
        !sameFile(after, file.stat) ||
        after.size !== file.stat.size ||
        after.mtimeMs !== file.stat.mtimeMs
      )
        throw new Error(`SDK input changed during verification: ${file.path}`);
    }
    if (
      !sameFile(await lstat(requested), requestedRoot) ||
      (await realpath(requested)) !== absolute
    )
      throw new Error(`SDK path changed during verification: ${requested}`);
    return { ok: true, value: { directory: absolute, identity } };
  } catch (error) {
    return failure(
      `Cannot verify shared GPUI SDK: ${error instanceof Error ? error.message : String(error)}`,
      absolute
    );
  }
}

/** Check a generated SDK obligation at a file API or actual output-crate boundary. */
export async function verifyGpuiCompilationSdk(
  output: GeneratedModule,
  outputDirectory?: string
): Promise<CompileResult<void>> {
  if (output.profile !== 'gpui-source-v1') return { ok: true, value: undefined };
  const sdk = output.provenance.nativeSdk;
  if (!sdk)
    return failure('GPUI output has no SDK content identity; recompile its source.', '<gpui-sdk>');
  const useWorkspace = sdk.dependencyMode === 'workspace';
  const expected = gpuiNativeSdkIdentity(useWorkspace);
  if (
    Object.entries(expected).some(([key, value]) => sdk[key as keyof typeof sdk] !== value) ||
    typeof sdk.path !== 'string' ||
    !sdk.path ||
    sdk.path.includes('\0') ||
    typeof sdk.bundled !== 'boolean'
  )
    return failure(
      'GPUI output requires a different SDK identity; recompile its source.',
      '<gpui-sdk>'
    );
  const supporting = output.supportingFiles ?? [];
  const styleFixture = supporting.find(
    (file) => file.path === '.proto-ui/fixtures/style-tokens.json'
  );
  const cargoManifests = supporting.filter((file) => file.path === 'Cargo.toml');
  const staticArtifacts = supporting.filter((file) =>
    file.path.startsWith('.proto-ui/declaration/')
  );
  if (
    !styleFixture ||
    cargoManifests.length !== 1 ||
    cargoManifests[0].contents !==
      gpuiComponentCargoManifest(
        output.code,
        styleFixture.contents,
        staticArtifacts,
        sdk.path,
        useWorkspace
      )
  )
    return failure(
      'GPUI Cargo manifest differs from the generated source and recorded SDK obligation.',
      'Cargo.toml'
    );
  if (sdk.bundled) {
    const files = (output.supportingFiles ?? []).filter((file) =>
      file.path.startsWith(`${GPUI_NATIVE_SDK_PATH}/`)
    );
    const emitted = new Map(files.map((file) => [file.path, file.contents]));
    if (
      sdk.path !== GPUI_NATIVE_SDK_PATH ||
      files.length !== gpuiNativeSdkFiles(useWorkspace).length ||
      gpuiNativeSdkFiles(useWorkspace).some((file) => emitted.get(file.path) !== file.contents)
    )
      return failure(
        'Bundled GPUI SDK bytes differ from the recorded compiler identity.',
        '<gpui-sdk>'
      );
    return { ok: true, value: undefined };
  }
  // A relative path is relative to the generated Cargo crate, never the source root.
  // Pure compilation may plan it; publication must resolve it using its actual destination.
  if (outputDirectory === undefined && !path.isAbsolute(sdk.path))
    return { ok: true, value: undefined };
  const directory = path.resolve(outputDirectory ?? '.', sdk.path);
  if (outputDirectory !== undefined && !path.isAbsolute(sdk.path)) {
    try {
      // Cargo may start from the canonical working directory or an explicitly
      // supplied manifest path. A relative reference must select the same SDK
      // for both spellings, including when .. crosses an output ancestor link.
      const physicalDirectory = path.resolve(await realOutputDirectory(outputDirectory), sdk.path);
      if ((await realpath(directory)) !== (await realpath(physicalDirectory)))
        return failure(
          'Relative shared SDK path resolves differently through an output ancestor link. Use the canonical output directory or an absolute SDK path.',
          directory
        );
    } catch (error) {
      return failure(
        `Cannot resolve shared SDK from the actual output crate: ${error instanceof Error ? error.message : String(error)}`,
        directory
      );
    }
  }
  const verified = await verifyGpuiNativeSdk(directory, useWorkspace);
  return verified.ok ? { ok: true, value: undefined } : verified;
}
