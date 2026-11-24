#!/usr/bin/env node
// Reconstruct authenticated captured inputs in a new private directory.
// This never imports source, installs packages, or changes the retained packet.
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOUNDATION_ANCHOR, verifyFrozenFoundation } from './verify-frozen-foundation.mjs';

class MaterializationFailure extends Error {
  constructor(code) {
    // Private source paths and filesystem error details stay out of receipts.
    super(code);
    this.code = code;
  }
}

function requireFact(value, code) {
  if (!value) throw new MaterializationFailure(code);
}

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const validHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function inputPath(value) {
  requireFact(
    typeof value === 'string' &&
      value.length > 0 &&
      !value.includes('\\') &&
      !value.includes('\0') &&
      !value.includes(':') &&
      !isAbsolute(value) &&
      value.split('/').every((part) => part !== '' && part !== '.' && part !== '..') &&
      value.split('/').every((part) => part.toLowerCase() !== '.git'),
    'UNSAFE_INPUT_PATH'
  );
  return value;
}

async function directoryChain(path) {
  const chain = [];
  for (let current = resolve(path); ; current = dirname(current)) {
    chain.push(current);
    if (dirname(current) === current) break;
  }
  for (const directory of chain.reverse()) {
    const stat = await lstat(directory);
    requireFact(stat.isDirectory() && !stat.isSymbolicLink(), 'UNSAFE_DIRECTORY');
  }
}

function contains(parent, child) {
  const offset = relative(parent, child);
  return (
    offset === '' || (offset !== '..' && !offset.startsWith(`..${sep}`) && !isAbsolute(offset))
  );
}

/**
 * Structural reconstruction kernel for independently authored controls. It does
 * not authenticate a historical packet; only materializeFrozenFoundation does.
 * Every file is read and checked before the destination is created.
 */
export async function materializeContentEntries(packetRoot, destination, entries) {
  const root = resolve(packetRoot);
  const output = resolve(destination);
  requireFact(!contains(root, output) && !contains(output, root), 'OVERLAPPING_OUTPUT');
  await directoryChain(root);
  await directoryChain(join(root, 'objects/sha256'));
  await directoryChain(dirname(output));
  requireFact(Array.isArray(entries) && entries.length > 0, 'EMPTY_INPUTS');
  const paths = new Set();
  const directories = new Set();
  for (const entry of entries) {
    inputPath(entry.path);
    requireFact(!paths.has(entry.path), 'DUPLICATE_INPUT_PATH');
    paths.add(entry.path);
    requireFact(
      validHash(entry.sha256) && Number.isSafeInteger(entry.size) && entry.size >= 0,
      'INVALID_INPUT_IDENTITY'
    );
    requireFact(
      Number.isSafeInteger(entry.mode) && entry.mode >= 0 && entry.mode <= 0o777,
      'INVALID_INPUT_MODE'
    );
    const parts = entry.path.split('/');
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join('/'));
  }
  requireFact(
    [...directories].every((path) => !paths.has(path)),
    'INPUT_DIRECTORY_COLLISION'
  );

  // Retain checked bytes through the write: changing an object after this read
  // cannot substitute different source between verification and reconstruction.
  const bytesByHash = new Map();
  let byteCount = 0;
  for (const entry of entries) {
    let bytes = bytesByHash.get(entry.sha256);
    if (!bytes) {
      const object = join(root, 'objects/sha256', entry.sha256);
      const stat = await lstat(object);
      requireFact(stat.isFile() && !stat.isSymbolicLink(), 'UNSAFE_CONTENT_OBJECT');
      bytes = await readFile(object);
      requireFact(hash(bytes) === entry.sha256, 'CONTENT_IDENTITY');
      bytesByHash.set(entry.sha256, bytes);
    }
    requireFact(bytes.length === entry.size, 'CONTENT_SIZE');
    byteCount += bytes.length;
  }

  let created;
  try {
    // No recursive mkdir here: an existing directory, file or symlink is refused.
    await mkdir(output, { mode: 0o700 });
    created = await lstat(output);
    for (const path of [...directories].sort((a, b) => a.split('/').length - b.split('/').length)) {
      await mkdir(join(output, path), { mode: 0o700 });
    }
    for (const entry of entries) {
      const file = join(output, entry.path);
      await writeFile(file, bytesByHash.get(entry.sha256), { flag: 'wx', mode: entry.mode });
      await chmod(file, entry.mode);
    }
  } catch (error) {
    if (created) {
      // Only remove the directory that this invocation actually created.
      const current = await lstat(output).catch(() => null);
      if (
        current?.dev === created.dev &&
        current.ino === created.ino &&
        !current.isSymbolicLink()
      ) {
        await rm(output, { recursive: true, force: true });
      }
    }
    if (error.code === 'EEXIST') throw new MaterializationFailure('OUTPUT_EXISTS');
    throw error;
  }
  return {
    files: entries.length,
    bytes: byteCount,
    inputIdentity: hash(
      JSON.stringify(entries.map(({ path, mode, size, sha256 }) => ({ path, mode, size, sha256 })))
    ),
  };
}

export async function materializeFrozenFoundation(packetRoot, destination, { archivePath } = {}) {
  const report = {
    kind: 'proto-ui.frozen-foundation-materialization',
    format: 1,
    anchor: FOUNDATION_ANCHOR,
    passed: false,
    scope: 'captured-repository-inputs',
    sourceExecuted: false,
    installedToolchainMaterialized: false,
    completeHistoricalCheckout: false,
    originalCompilerReplay: false,
    definitionApproval: false,
    originalAuthorRightsCertified: false,
    migrationExecuted: false,
    MERGE_READY: false,
  };
  try {
    const integrity = await verifyFrozenFoundation(packetRoot, { archivePath });
    requireFact(integrity.passed, integrity.failure ?? 'INTEGRITY_FAILED');
    const manifestPath = join(resolve(packetRoot), 'foundation-manifest-v2.json');
    const stat = await lstat(manifestPath);
    requireFact(stat.isFile() && !stat.isSymbolicLink(), 'UNSAFE_MANIFEST');
    const bytes = await readFile(manifestPath);
    requireFact(hash(bytes) === FOUNDATION_ANCHOR.manifestSha256, 'MANIFEST_ANCHOR');
    const manifest = JSON.parse(bytes);
    const restored = await materializeContentEntries(packetRoot, destination, manifest.files);
    Object.assign(report, restored, {
      passed: true,
      archiveChecked: integrity.archiveChecked,
      compilerSha256: integrity.compilerSha256,
      sourceBankDigest: integrity.sourceBankDigest,
    });
  } catch (error) {
    report.failure =
      error instanceof MaterializationFailure ? error.code : 'MATERIALIZATION_FAILED';
  }
  return report;
}

async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    process.stdout.write(
      'Usage: node scripts/compiler/materialize-frozen-foundation.mjs --packet PRIVATE_PACKET --out NEW_DIRECTORY [--archive PRIVATE_ARCHIVE]\n' +
        'Reconstructs authenticated captured repository inputs; never executes source or overwrites an existing destination.\n' +
        'Installed toolchain, uncaptured historical files, execution and acceptance remain separate.\n'
    );
    return;
  }
  if (
    (args.length !== 4 && args.length !== 6) ||
    args[0] !== '--packet' ||
    args[2] !== '--out' ||
    (args.length === 6 && args[4] !== '--archive')
  ) {
    process.stderr.write(
      'Expected --packet PATH --out NEW_DIRECTORY and optional --archive PATH.\n'
    );
    process.exitCode = 2;
    return;
  }
  const report = await materializeFrozenFoundation(args[1], args[3], { archivePath: args[5] });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.passed ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
