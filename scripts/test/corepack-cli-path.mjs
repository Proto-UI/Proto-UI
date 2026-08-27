import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

const COREPACK_ENTRY_SEGMENTS = ['node_modules', 'corepack', 'dist', 'corepack.js'];

/**
 * Return the Corepack layouts used by official Node distributions on Windows
 * and by the GitHub Actions toolcache on Unix.
 *
 * @param {string} execPath
 * @param {NodeJS.Platform} [platform]
 * @returns {string[]}
 */
export function corepackCliCandidates(execPath, platform = process.platform) {
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  const executableDirectory = pathApi.dirname(execPath);
  return [
    pathApi.join(executableDirectory, ...COREPACK_ENTRY_SEGMENTS),
    pathApi.resolve(executableDirectory, '..', 'lib', ...COREPACK_ENTRY_SEGMENTS),
  ];
}

function pathShimCandidates(pathEnv, platform) {
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  const separator = platform === 'win32' ? ';' : ':';
  return String(pathEnv ?? '')
    .split(separator)
    .filter(Boolean)
    .flatMap((directory) => [
      pathApi.join(directory, 'corepack.js'),
      pathApi.join(directory, 'corepack'),
    ]);
}

/**
 * Resolve Corepack without depending on PATH or a shell-specific shim.
 * `fileExists` is injectable so every supported layout is tested on one host.
 *
 * @param {{ platform?: NodeJS.Platform; fileExists?: (candidate: string) => boolean; pathEnv?: string; realpath?: (candidate: string) => string }} [options]
 * @returns {string}
 */
export function resolveCorepackCli(
  execPath,
  {
    platform = process.platform,
    fileExists = existsSync,
    pathEnv = process.env.PATH,
    realpath = realpathSync,
  } = {}
) {
  const candidates = [
    ...corepackCliCandidates(execPath, platform),
    ...pathShimCandidates(pathEnv, platform),
  ];
  for (const candidate of candidates) {
    if (!fileExists(candidate) || candidate.endsWith('.cmd') || candidate.endsWith('.ps1'))
      continue;
    try {
      const resolved = realpath(candidate);
      if (fileExists(resolved)) return resolved;
    } catch {
      // The executable may disappear between existence and realpath checks.
    }
    return candidate;
  }
  throw new Error(`Unable to locate Corepack. Tried:\n- ${candidates.join('\n- ')}`);
}
