import { chmod, copyFile, lstat, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

export const PREVIEW_LIMITS = Object.freeze({
  maxFiles: 20_000,
  maxFileBytes: 25 * 1024 * 1024,
  maxExpandedBytes: 100 * 1024 * 1024,
  maxCompressedBytes: 50 * 1024 * 1024,
});

export const RESERVED_PREVIEW_ROOT_FILES = new Set([
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
    fail('preview source and output must be separate directory trees');
  }
}

function validateLimits(limits) {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) fail(`invalid preview limit ${name}`);
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

export async function sanitizePreviewTree({ source, output, limits = PREVIEW_LIMITS }) {
  const sourceRoot = path.resolve(source ?? '');
  const outputRoot = path.resolve(output ?? '');
  validateLimits(limits);
  assertSeparateTrees(sourceRoot, outputRoot);

  const sourceStat = await lstat(sourceRoot).catch(() => null);
  if (!sourceStat?.isDirectory() || sourceStat.isSymbolicLink()) {
    fail('preview artifact source must be a real directory');
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
      if (depth === 0 && RESERVED_PREVIEW_ROOT_FILES.has(entry.name)) {
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
