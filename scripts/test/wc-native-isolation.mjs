import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const readyMarker = 'PROTO_UI_WC_NATIVE_ISOLATION_READY';
const probe = `set -eu
test "$(id -u)" -ne 0
ip link set lo up
exec setpriv --bounding-set=-all --inh-caps=-all --ambient-caps=-all \
  "$3" "$4" --probe "$1" "$2"
`;

// Inspect the process that will start the browser, after setup capabilities
// have been dropped. A successful outer namespace probe alone is insufficient:
// Chromium must retain its own sandbox and therefore cannot run as namespace root.
export function inspectWcNativeIsolation({
  expectedUserNamespace,
  expectedNetworkNamespace,
  platform = process.platform,
  uid = process.getuid?.(),
  readNamespace = readlinkSync,
  readStatus = () => readFileSync('/proc/self/status', 'utf8'),
  run = spawnSync,
} = {}) {
  const receipt = {
    schemaVersion: 1,
    phase: 'browser-execution-preflight',
    outcome: 'blocked',
    browserJourneysExecuted: 0,
    reason: 'restricted-browser-environment-unavailable',
    uid,
  };
  try {
    if (platform !== 'linux' || !Number.isInteger(uid) || uid <= 0)
      throw new Error('A non-root Linux browser process is required.');
    if (
      !/^user:\[\d+\]$/.test(expectedUserNamespace ?? '') ||
      !/^net:\[\d+\]$/.test(expectedNetworkNamespace ?? '')
    )
      throw new Error('Original user and network namespace identities are required.');
    receipt.userNamespace = readNamespace('/proc/self/ns/user');
    receipt.networkNamespace = readNamespace('/proc/self/ns/net');
    if (
      receipt.userNamespace === expectedUserNamespace ||
      receipt.networkNamespace === expectedNetworkNamespace
    )
      throw new Error('Browser namespaces must differ from the original runner.');
    const status = readStatus();
    receipt.capabilities = {};
    for (const name of ['CapInh', 'CapPrm', 'CapEff', 'CapBnd', 'CapAmb']) {
      const value = status.match(new RegExp(`^${name}:\\s*([a-fA-F0-9]+)$`, 'm'))?.[1];
      if (!value || !/^0+$/.test(value))
        throw new Error(`Browser ${name} must be present and empty.`);
      receipt.capabilities[name] = value;
    }
    const query = (args) => {
      const result = run('ip', args, { encoding: 'utf8', timeout: 5_000 });
      if (result.error || result.status !== 0)
        throw new Error(
          `Cannot inspect isolated network: ${result.stderr ?? result.error?.message ?? ''}`
        );
      return result.stdout;
    };
    receipt.links = JSON.parse(query(['-j', 'link', 'show']));
    if (
      receipt.links.length !== 1 ||
      receipt.links[0].ifname !== 'lo' ||
      !receipt.links[0].flags?.includes('UP')
    )
      throw new Error('Only an active loopback interface is allowed.');
    receipt.ipv4DefaultRoutes = query(['route', 'show', 'default']).trim();
    receipt.ipv6DefaultRoutes = query(['-6', 'route', 'show', 'default']).trim();
    if (receipt.ipv4DefaultRoutes || receipt.ipv6DefaultRoutes)
      throw new Error('External default routes are forbidden.');
    return { ...receipt, outcome: 'ready', reason: 'non-root-capability-free-isolated-loopback' };
  } catch (error) {
    return { ...receipt, error: error instanceof Error ? error.message : String(error) };
  }
}

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
  const args = [
    '--user',
    '--map-current-user',
    '--net',
    '--keep-caps',
    'sh',
    '-c',
    probe,
    'sh',
    ...namespaces,
    process.execPath,
    fileURLToPath(import.meta.url),
  ];
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
  if (process.argv[2] === '--probe') {
    const receipt = inspectWcNativeIsolation({
      expectedUserNamespace: process.argv[3],
      expectedNetworkNamespace: process.argv[4],
    });
    console.log(JSON.stringify(receipt));
    if (receipt.outcome === 'ready') console.log(readyMarker);
    else process.exitCode = 1;
  } else {
    const evidenceDirectory = process.argv[2];
    if (!evidenceDirectory) throw new Error('An evidence directory is required.');
    const source = (name) => {
      const file = path.join(evidenceDirectory, name);
      return existsSync(file) ? readFileSync(file, 'utf8').trim() : null;
    };
    const runNative = process.argv[3] === '--run-native';
    if (process.argv[3] && !runNative) throw new Error('Unknown WC isolation operation.');
    const receipt = {
      ...(runNative
        ? inspectWcNativeIsolation({
            expectedUserNamespace: process.argv[4],
            expectedNetworkNamespace: process.argv[5],
          })
        : checkWcNativeIsolation()),
      sourceSha: source('source-sha.txt'),
      sourceTree: source('source-tree.txt'),
    };
    mkdirSync(evidenceDirectory, { recursive: true });
    writeFileSync(
      path.join(
        evidenceDirectory,
        runNative ? 'isolation-execution.json' : 'isolation-preflight.json'
      ),
      `${JSON.stringify(receipt, null, 2)}\n`
    );
    writeFileSync(
      path.join(
        evidenceDirectory,
        runNative ? 'isolation-execution.log' : 'isolation-preflight.log'
      ),
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
      if (runNative) {
        const result = spawnSync(
          process.execPath,
          [
            'node_modules/vitest/vitest.mjs',
            'run',
            'packages/compiler/test/web-component-native.browser.test.ts',
            '--maxWorkers=1',
            '--minWorkers=1',
            '--reporter=default',
            '--reporter=json',
            `--outputFile=${path.join(evidenceDirectory, 'browser-vitest.json')}`,
          ],
          { stdio: 'inherit' }
        );
        if (result.error) console.error(result.error);
        process.exitCode = result.status ?? 1;
      }
    }
  }
}
