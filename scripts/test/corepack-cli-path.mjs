import { existsSync } from 'node:fs';
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

/**
 * Resolve Corepack without depending on PATH or a shell-specific shim.
 * `fileExists` is injectable so every supported layout is tested on one host.
 *
 * @param {string} execPath
 * @param {{ platform?: NodeJS.Platform; fileExists?: (candidate: string) => boolean }} [options]
 * @returns {string}
 */
export function resolveCorepackCli(
  execPath,
  { platform = process.platform, fileExists = existsSync } = {}
) {
  const candidates = corepackCliCandidates(execPath, platform);
  const resolved = candidates.find((candidate) => fileExists(candidate));
  if (resolved) return resolved;
  throw new Error(`Unable to locate Corepack. Tried:\n- ${candidates.join('\n- ')}`);
}
