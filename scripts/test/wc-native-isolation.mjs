import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const readyMarker = 'PROTO_UI_WC_NATIVE_ISOLATION_READY';
const probe = `set -eu
test "$(readlink /proc/self/ns/user)" != "$1"
test "$(readlink /proc/self/ns/net)" != "$2"
ip link set lo up
test "$(ip -o link show | wc -l)" -eq 1
ip -o link show lo
test -z "$(ip route show default)"
test -z "$(ip -6 route show default)"
printf '${readyMarker}\\n'
`;

// Preparation only: even a successful namespace probe runs no browser journeys.
// The real test command must still create its own isolated namespace and fail
// closed there. This probe never changes host security policy or tries a fallback.
export function checkWcNativeIsolation({
  platform = process.platform,
  run = spawnSync,
  readNamespace = readlinkSync,
  searchPath = process.env.PATH,
} = {}) {
  const receipt = {
    schemaVersion: 1,
    phase: 'runner-preparation',
    outcome: 'blocked',
    browserJourneysExecuted: 0,
    reason: 'unprivileged-user-network-namespace-unavailable',
  };
  if (platform !== 'linux') return { ...receipt, stderr: 'Linux namespaces are required.' };

  let namespaces;
  try {
    namespaces = [readNamespace('/proc/self/ns/user'), readNamespace('/proc/self/ns/net')];
  } catch (error) {
    return { ...receipt, stderr: `Cannot inspect parent namespaces: ${error.message}` };
  }
  const args = ['--user', '--map-root-user', '--net', 'sh', '-c', probe, 'sh', ...namespaces];
  const result = run('unshare', args, {
    // No inherited credential environment, including during preparation.
    env: { PATH: searchPath, LANG: 'C' },
    encoding: 'utf8',
    timeout: 10_000,
    killSignal: 'SIGKILL',
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const ready = !result.error && result.status === 0 && stdout.split(/\r?\n/).includes(readyMarker);
  return {
    ...receipt,
    outcome: ready ? 'ready' : 'blocked',
    reason: ready ? 'isolated-loopback-available' : receipt.reason,
    command: ['unshare', ...args],
    exitCode: result.status,
    signal: result.signal ?? null,
    error: result.error?.message ?? null,
    stdout,
    stderr,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const evidenceDirectory = process.argv[2];
  if (!evidenceDirectory) throw new Error('An evidence directory is required.');
  const source = (name) => {
    const file = path.join(evidenceDirectory, name);
    return existsSync(file) ? readFileSync(file, 'utf8').trim() : null;
  };
  const receipt = {
    ...checkWcNativeIsolation(),
    sourceSha: source('source-sha.txt'),
    sourceTree: source('source-tree.txt'),
  };
  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(
    path.join(evidenceDirectory, 'isolation-preflight.json'),
    `${JSON.stringify(receipt, null, 2)}\n`
  );
  writeFileSync(
    path.join(evidenceDirectory, 'isolation-preflight.log'),
    `${receipt.stdout ?? ''}${receipt.stderr ?? ''}${receipt.error ? `\n${receipt.error}\n` : ''}`
  );
  if (receipt.outcome !== 'ready') {
    console.error(
      'WC native runner preparation blocked: unprivileged user/network isolation is unavailable. ' +
        'No browser journeys ran. Use a runner that supports the required isolated loopback; ' +
        'no unrestricted fallback or host-policy change was attempted.'
    );
    if (receipt.stderr) process.stderr.write(receipt.stderr);
    if (receipt.error) console.error(receipt.error);
    process.exitCode = 1;
  } else {
    console.log('WC native isolation preflight ready; browser acceptance has not run.');
  }
}
