#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { appendFile, chmod, copyFile, lstat, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const FALLBACK_LIMITS = Object.freeze({
  maxFiles: 20_000,
  maxFileBytes: 25 * 1024 * 1024,
  maxExpandedBytes: 100 * 1024 * 1024,
  maxCompressedBytes: 50 * 1024 * 1024,
});

export const RESERVED_FALLBACK_ROOT_FILES = new Set([
  '_worker.js',
  '_routes.json',
  '_headers',
  '_redirects',
  '.assetsignore',
]);

function fail(message) {
  throw new Error(message);
}

function isWithin(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertSeparateTrees(source, output) {
  if (isWithin(source, output) || isWithin(output, source)) {
    fail('fallback source and output must be separate directory trees');
  }
}

function validateLimits(limits) {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) fail(`invalid fallback limit ${name}`);
  }
}

function displayPath(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

function assertSafeEntryName(name) {
  if (name.includes('\\') || /[\u0000-\u001f\u007f]/.test(name)) {
    fail(`artifact contains an unsafe path segment: ${JSON.stringify(name)}`);
  }
}

export function assertCompressedArchiveSize(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 1) fail('fallback archive is empty');
  if (bytes > FALLBACK_LIMITS.maxCompressedBytes) {
    fail('fallback archive exceeds 50 MiB');
  }
}

export async function sanitizeFallbackTree({ source, output, limits = FALLBACK_LIMITS }) {
  const sourceRoot = path.resolve(source ?? '');
  const outputRoot = path.resolve(output ?? '');
  validateLimits(limits);
  assertSeparateTrees(sourceRoot, outputRoot);

  const sourceStat = await lstat(sourceRoot).catch(() => null);
  if (!sourceStat?.isDirectory() || sourceStat.isSymbolicLink()) {
    fail('fallback artifact source must be a real directory');
  }

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true, mode: 0o750 });
  let files = 0;
  let bytes = 0;

  async function visit(sourceDirectory, outputDirectory, depth) {
    const entries = await readdir(sourceDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      assertSafeEntryName(entry.name);
      if (depth === 0 && RESERVED_FALLBACK_ROOT_FILES.has(entry.name)) {
        fail(`preview artifact contains a reserved platform file: ${entry.name}`);
      }
      const sourcePath = path.join(sourceDirectory, entry.name);
      const outputPath = path.join(outputDirectory, entry.name);
      const stat = await lstat(sourcePath);
      const relative = displayPath(sourceRoot, sourcePath);
      if (stat.isSymbolicLink()) fail(`artifact contains a symbolic link: ${relative}`);
      if (stat.isDirectory()) {
        await mkdir(outputPath, { mode: 0o750 });
        await visit(sourcePath, outputPath, depth + 1);
        continue;
      }
      if (!stat.isFile()) fail(`artifact contains a non-regular file: ${relative}`);

      files += 1;
      if (files > limits.maxFiles) fail(`artifact exceeds ${limits.maxFiles} files`);
      if (stat.size > limits.maxFileBytes) {
        fail(`artifact file exceeds ${limits.maxFileBytes} bytes: ${relative}`);
      }
      bytes += stat.size;
      if (bytes > limits.maxExpandedBytes) {
        fail(`artifact expanded size exceeds ${limits.maxExpandedBytes} bytes`);
      }

      await copyFile(sourcePath, outputPath);
      await chmod(outputPath, 0o640);
      const copied = await lstat(outputPath);
      if (!copied.isFile() || copied.isSymbolicLink() || copied.size !== stat.size) {
        fail(`artifact file changed while it was sanitized: ${relative}`);
      }
    }
  }

  await visit(sourceRoot, outputRoot, 0);
  if (files === 0) fail('artifact contains no deployable files');
  return { files, bytes };
}

async function createArchive(source, archive) {
  await rm(archive, { force: true });
  await mkdir(path.dirname(archive), { recursive: true, mode: 0o750 });
  const args = [
    '--create',
    '--gzip',
    '--file',
    archive,
    '--directory',
    source,
    '--format=ustar',
    '--sort=name',
    '--mtime=@0',
    '--owner=0',
    '--group=0',
    '--numeric-owner',
    '.',
  ];
  const result = await new Promise((resolve, reject) => {
    const child = spawn('tar', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stderr }));
  });
  if (result.status !== 0)
    fail(`could not create fallback archive: ${result.stderr.slice(0, 1000)}`);
  const stat = await lstat(archive);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('fallback archive is not a regular file');
  assertCompressedArchiveSize(stat.size);
  return stat.size;
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined || values.has(key)) {
      fail(`invalid argument near ${key ?? 'end of arguments'}`);
    }
    values.set(key, value);
  }
  return values;
}

function assertWorkspaceChild(workspace, target, label) {
  if (!isWithin(workspace, target) || path.resolve(workspace) === path.resolve(target)) {
    fail(`${label} must be a child of the current workspace`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workspace = path.resolve(process.cwd());
  const source = path.resolve(args.get('--source') ?? '');
  const output = path.resolve(args.get('--output') ?? '');
  const archive = path.resolve(args.get('--archive') ?? '');
  for (const [target, label] of [
    [source, 'source'],
    [output, 'output'],
    [archive, 'archive'],
  ]) {
    assertWorkspaceChild(workspace, target, label);
  }
  if (isWithin(source, archive) || isWithin(output, archive)) {
    fail('fallback archive must be outside the source and sanitized trees');
  }
  const copied = await sanitizeFallbackTree({ source, output });
  const compressedBytes = await createArchive(output, archive);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `files=${copied.files}\nexpanded_bytes=${copied.bytes}\ncompressed_bytes=${compressedBytes}\n`
    );
  }
  console.log(
    `Prepared ${copied.files} fallback files (${copied.bytes} expanded bytes, ${compressedBytes} compressed bytes).`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
