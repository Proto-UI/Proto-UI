import { constants } from 'node:fs';
import { lstat, open, opendir } from 'node:fs/promises';
import path from 'node:path';

// Builder-side diagnostic only. These bounds never replace or relax ZIP admission.
const MAX_FILES = 20_000;
const MAX_DIRECTORIES = 20_000;
const MAX_DEPTH = 64;
const MAX_PATH_BYTES = 1024;
const MAX_TOTAL_PATH_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;
const TOP = 20;
const DIRECTORY_FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;

class InventoryUnavailable extends Error {}

function unavailable(reason) {
  throw new InventoryUnavailable(reason);
}

function fdPath(handle, child = '') {
  return `/proc/self/fd/${handle.fd}${child ? `/${child}` : ''}`;
}

function sameEntry(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

// Anchor every ancestor, not merely the final source directory. The disposable
// hosted builder is Linux; on other hosts this diagnostic reports unavailable.
async function openAnchoredRoot(source) {
  let handle = await open('/', DIRECTORY_FLAGS);
  try {
    for (const segment of path.resolve(source).split('/').filter(Boolean)) {
      const child = fdPath(handle, segment);
      const stat = await lstat(child, { bigint: true });
      if (stat.isSymbolicLink()) unavailable('symbolic-link-ancestor');
      if (!stat.isDirectory()) unavailable('source-ancestor-not-directory');
      const next = await open(child, DIRECTORY_FLAGS);
      if (!sameEntry(stat, await next.stat({ bigint: true }))) {
        await next.close();
        unavailable('directory-changed');
      }
      await handle.close();
      handle = next;
    }
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

function add(map, name, bytes) {
  const current = map.get(name) ?? { name, files: 0, bytes: 0n };
  current.files += 1;
  current.bytes += bytes;
  map.set(name, current);
}

function compareSize(left, right) {
  if (left.bytes !== right.bytes) return left.bytes > right.bytes ? -1 : 1;
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

function printable(row) {
  return { name: row.name, files: row.files, bytes: row.bytes.toString() };
}

function rankedGroups(map) {
  const all = [...map.values()].sort(compareSize);
  const rest = all.slice(TOP);
  return {
    top20: all.slice(0, TOP).map(printable),
    remainingGroups: rest.length,
    remainingFiles: rest.reduce((sum, row) => sum + row.files, 0),
    remainingBytes: rest.reduce((sum, row) => sum + row.bytes, 0n).toString(),
  };
}

function kind(name) {
  if (name.startsWith('pagefind/') || name.startsWith('_pagefind/')) return 'pagefind';
  if (name.startsWith('_astro/')) return 'compiled-assets';
  if (path.posix.extname(name).toLowerCase() === '.html') return 'html';
  // A dist-only stat cannot prove whether other files came from public/.
  return 'other-origin-unclassified';
}

export async function summarizeProducerStats(source) {
  if (process.platform !== 'linux') return { status: 'unavailable', reason: 'linux-fd-required' };
  let root;
  let report;
  try {
    root = await openAnchoredRoot(source);
    let files = 0;
    let directories = 0;
    let pathBytes = 0;
    let bytes = 0n;
    const kinds = new Map();
    const directoryGroups = new Map();
    const extensions = new Map();
    const largest = [];

    async function visit(handle, prefix, depth) {
      if (++directories > MAX_DIRECTORIES) unavailable('directory-count-bound');
      const before = await handle.stat({ bigint: true });
      const directory = await opendir(fdPath(handle));
      try {
        for (;;) {
          const entry = await directory.read();
          if (!entry) break;
          if (entry.name === '.' || entry.name === '..' || /[/\\\u0000]/.test(entry.name)) {
            unavailable('unsafe-entry-name');
          }
          const name = prefix ? `${prefix}/${entry.name}` : entry.name;
          const nameBytes = Buffer.byteLength(name);
          pathBytes += nameBytes;
          if (depth > MAX_DEPTH || nameBytes > MAX_PATH_BYTES) unavailable('path-bound');
          if (pathBytes > MAX_TOTAL_PATH_BYTES) unavailable('aggregate-path-bound');
          const anchored = fdPath(handle, entry.name);
          const stat = await lstat(anchored, { bigint: true });
          if (stat.isSymbolicLink()) unavailable('symbolic-link-entry');
          if (stat.isDirectory()) {
            const child = await open(anchored, DIRECTORY_FLAGS);
            try {
              if (!sameEntry(stat, await child.stat({ bigint: true }))) {
                unavailable('directory-changed');
              }
              await visit(child, name, depth + 1);
            } finally {
              await child.close();
            }
          } else {
            if (!stat.isFile()) unavailable('non-regular-entry');
            if (++files > MAX_FILES) unavailable('file-count-bound');
            bytes += stat.size;
            add(kinds, kind(name), stat.size);
            add(directoryGroups, prefix ? `${name.split('/')[0]}/` : '/', stat.size);
            add(extensions, path.posix.extname(name).toLowerCase() || '(no extension)', stat.size);
            largest.push({ name, files: 1, bytes: stat.size });
            largest.sort(compareSize);
            if (largest.length > TOP) largest.pop();
          }
        }
      } finally {
        await directory.close();
      }
      const after = await handle.stat({ bigint: true });
      if (!sameEntry(before, after) || before.mtimeNs !== after.mtimeNs) {
        unavailable('directory-changed');
      }
    }

    await visit(root, '', 1);
    report = {
      status: 'complete',
      measurement: 'observed-regular-file-stat-sizes-not-zip-declarations',
      byteEncoding: 'exact-decimal-string',
      files,
      statBytes: bytes.toString(),
      kinds: [...kinds.values()].sort(compareSize).map(printable),
      directories: rankedGroups(directoryGroups),
      extensions: rankedGroups(extensions),
      largestFiles: largest.map(({ name, bytes: size }) => ({ name, bytes: size.toString() })),
    };
  } catch (error) {
    // Never include filesystem exception paths, file contents or process env.
    report = {
      status: 'unavailable',
      reason: error instanceof InventoryUnavailable ? error.message : 'filesystem-unavailable',
    };
  } finally {
    if (root) {
      try {
        await root.close();
      } catch {
        report = { status: 'unavailable', reason: 'filesystem-unavailable' };
      }
    }
  }
  return report;
}

export function formatProducerStats(report) {
  const text = JSON.stringify(report).replace(
    /[\u007f-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
  if (Buffer.byteLength(text) <= MAX_OUTPUT_BYTES) return text;
  return JSON.stringify({ status: 'unavailable', reason: 'diagnostic-output-bound' });
}
