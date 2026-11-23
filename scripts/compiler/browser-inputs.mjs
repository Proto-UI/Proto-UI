import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { findBrowserRepositoryRoot } from './browser-repository-root.mjs';

export const browserRepositoryRoot = findBrowserRepositoryRoot(import.meta.url);
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

// This deliberately conservative superset includes the Astro shell, ordinary
// preview, source loader, generator/configuration and all workspace imports.
// Actual compiler, vendor and Worker dependency files are added from esbuild's
// input graph, including installed dependencies which git does not enumerate.
export const browserRepositoryInputPaths = [
  'packages',
  'apps/www',
  'scripts',
  'patches',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig*.json',
  '.npmrc',
  'internal/compiler/website-demo-migrations.json',
];

export function relativeInputPath(file, root = browserRepositoryRoot) {
  const relative = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative))
    throw new Error(`Browser build input is outside the repository: ${file}`);
  return relative;
}

export async function hashInputFiles(files, root = browserRepositoryRoot) {
  const sorted = [...new Set(files.map((file) => relativeInputPath(file, root)))].sort();
  const entries = [];
  // Bound open file descriptors even when the conservative website inventory
  // contains thousands of files.
  for (let index = 0; index < sorted.length; index += 32) {
    entries.push(
      ...(await Promise.all(
        sorted
          .slice(index, index + 32)
          .map(async (file) => [file, digest(await readFile(path.join(root, file)))])
      ))
    );
  }
  return Object.fromEntries(entries);
}

export async function hashMetafileInputs(metafile, root = browserRepositoryRoot) {
  const files = Object.keys(metafile.inputs)
    .filter((file) => !file.startsWith('(disabled):'))
    .map((file) => relativeInputPath(file, root));
  // Package metadata can change resolution/version declarations without
  // appearing as JavaScript in the esbuild metafile.
  for (const file of [...files]) {
    const marker = 'node_modules/';
    const at = file.lastIndexOf(marker);
    if (at < 0) continue;
    const start = at + marker.length;
    const parts = file.slice(start).split('/');
    const packageName = parts.slice(0, parts[0].startsWith('@') ? 2 : 1).join('/');
    files.push(`${file.slice(0, start)}${packageName}/package.json`);
  }
  return hashInputFiles(files, root);
}

export async function snapshotBrowserRepositoryInputs(root = browserRepositoryRoot) {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '-c', '-o', '--exclude-standard', '--', ...browserRepositoryInputPaths],
    { cwd: root, encoding: 'utf8' }
  )
    .split('\0')
    .filter(Boolean);
  return hashInputFiles(files, root);
}

export function assertSameInputFiles(recorded, current) {
  if (!recorded || typeof recorded !== 'object' || Array.isArray(recorded))
    throw new Error('Missing browser receipt source binding inventory.');
  const oldFiles = Object.keys(recorded).sort();
  const newFiles = Object.keys(current).sort();
  for (const file of newFiles)
    if (!Object.hasOwn(recorded, file))
      throw new Error(`Missing browser receipt source binding: ${file}`);
  for (const file of oldFiles)
    if (!Object.hasOwn(current, file))
      throw new Error(`Browser receipt input inventory drift: ${file}`);
  for (const file of newFiles)
    if (recorded[file] !== current[file]) throw new Error(`Browser receipt source drift: ${file}`);
}

export function mergeInputFiles(...inventories) {
  const entries = new Map();
  for (const inventory of inventories)
    for (const [file, sha256] of Object.entries(inventory)) {
      if (entries.has(file) && entries.get(file) !== sha256)
        throw new Error(`Browser input changed while preparing assets: ${file}`);
      entries.set(file, sha256);
    }
  return Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function assertSameBrowserEvidence(recorded, current) {
  assertSameInputFiles(recorded?.sourceFiles, current.sourceFiles);
  const withoutSources = (value) => {
    const { sourceFiles, ...rest } = value;
    return rest;
  };
  if (JSON.stringify(withoutSources(recorded)) !== JSON.stringify(withoutSources(current)))
    throw new Error(
      'Browser build/target/Worker manifest drift: current rebuilt assets do not match the receipt.'
    );
}
