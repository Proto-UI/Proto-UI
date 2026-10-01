import { execFileSync } from 'node:child_process';

// Git's -z format preserves literal names without core.quotePath escaping.
// Reject names that cannot round-trip through the UTF-8 packet schema instead
// of silently replacing bytes or dropping whitespace-only entries.
export function parseGitPathNames(output) {
  const decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(output);
  if (decoded.length === 0) return [];
  if (!decoded.endsWith('\0')) throw new Error('Git path output is not NUL-terminated');
  const names = decoded.slice(0, -1).split('\0');
  if (names.some((name) => name.length === 0))
    throw new Error('Git path output contains an empty name');
  return names;
}

export function readGitPathNames(root, args) {
  return parseGitPathNames(execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 }));
}
