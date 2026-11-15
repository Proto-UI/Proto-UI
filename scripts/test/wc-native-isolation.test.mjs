import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkWcNativeIsolation, inspectWcNativeIsolation } from './wc-native-isolation.mjs';

const namespaces = (file) => (file.endsWith('/user') ? 'user:[1]' : 'net:[2]');

test('preparation requires a distinct user/network namespace and loopback without inherited credentials', () => {
  const receipt = checkWcNativeIsolation({
    platform: 'linux',
    readNamespace: namespaces,
    searchPath: '/test/bin',
    run(command, args, options) {
      assert.equal(command, 'unshare');
      assert.deepEqual(args.slice(0, 6), [
        '--user',
        '--map-current-user',
        '--net',
        '--keep-caps',
        'sh',
        '-c',
      ]);
      assert.deepEqual(args.slice(7, 10), ['sh', 'user:[1]', 'net:[2]']);
      assert.match(args[6], /ip link set lo up/);
      assert.match(args[6], /test "\$\(id -u\)" -ne 0/);
      assert.match(args[6], /exec setpriv --bounding-set=-all --inh-caps=-all --ambient-caps=-all/);
      assert.equal(args[10], process.execPath);
      assert.equal(args[11], fileURLToPath(new URL('./wc-native-isolation.mjs', import.meta.url)));
      assert.deepEqual(options.env, { PATH: '/test/bin', LANG: 'C' });
      assert.equal(options.timeout, 10_000);
      return { status: 0, stdout: 'PROTO_UI_WC_NATIVE_ISOLATION_READY\n', stderr: '' };
    },
  });
  assert.equal(receipt.outcome, 'ready');
  assert.equal(receipt.phase, 'runner-preparation');
  assert.equal(receipt.browserJourneysExecuted, 0);
});

for (const result of [
  { status: 1, stderr: 'unshare: write failed /proc/self/uid_map: Operation not permitted\n' },
  { status: 0, stdout: '' },
  { status: null, signal: 'SIGKILL', error: new Error('spawnSync unshare ETIMEDOUT') },
]) {
  test(`unavailable or incomplete isolation fails closed without fallback: ${JSON.stringify(result)}`, () => {
    let calls = 0;
    const receipt = checkWcNativeIsolation({
      platform: 'linux',
      readNamespace: namespaces,
      run() {
        calls++;
        return result;
      },
    });
    assert.equal(calls, 1);
    assert.equal(receipt.outcome, 'blocked');
    assert.equal(receipt.browserJourneysExecuted, 0);
    assert.equal(receipt.stderr, result.stderr ?? '');
    assert.equal(receipt.signal, result.signal ?? null);
  });
}

test('unsupported namespace inspection never starts an unrestricted probe', () => {
  const run = () => assert.fail('Must not run when namespace support is absent');
  assert.equal(checkWcNativeIsolation({ platform: 'win32', run }).outcome, 'blocked');
  const receipt = checkWcNativeIsolation({
    platform: 'linux',
    run,
    readNamespace() {
      throw new Error('proc unavailable');
    },
  });
  assert.equal(receipt.outcome, 'blocked');
  assert.match(receipt.stderr, /proc unavailable/);
});

test(
  'the CLI retains the actual preparation error and returns failure before browser execution',
  { skip: process.platform !== 'linux' },
  () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'wc-native-isolation-'));
    try {
      // Controlled unavailable runner, not evidence of live namespace support.
      const unshare = path.join(directory, 'unshare');
      writeFileSync(unshare, '#!/bin/sh\nprintf "controlled uid_map denied\\n" >&2\nexit 1\n');
      chmodSync(unshare, 0o755);
      const evidence = mkdtempSync(path.join(directory, 'evidence-'));
      writeFileSync(path.join(evidence, 'source-sha.txt'), `${'a'.repeat(40)}\n`);
      writeFileSync(path.join(evidence, 'source-tree.txt'), `${'b'.repeat(40)}\n`);
      const result = spawnSync(
        process.execPath,
        [fileURLToPath(new URL('./wc-native-isolation.mjs', import.meta.url)), evidence],
        { env: { PATH: directory }, encoding: 'utf8' }
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /No browser journeys ran/);
      assert.match(result.stderr, /controlled uid_map denied/);
      const receipt = JSON.parse(readFileSync(path.join(evidence, 'isolation-preflight.json')));
      assert.equal(receipt.outcome, 'blocked');
      assert.equal(receipt.browserJourneysExecuted, 0);
      assert.equal(receipt.exitCode, 1);
      assert.equal(receipt.sourceSha, 'a'.repeat(40));
      assert.equal(receipt.sourceTree, 'b'.repeat(40));
      assert.equal(
        readFileSync(path.join(evidence, 'isolation-preflight.log'), 'utf8'),
        'controlled uid_map denied\n'
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
);

const emptyCapabilities = ['CapInh', 'CapPrm', 'CapEff', 'CapBnd', 'CapAmb']
  .map((key) => `${key}:\t0000000000000000`)
  .join('\n');
const executionEnvironment = {
  expectedUserNamespace: 'user:[1]',
  expectedNetworkNamespace: 'net:[2]',
  platform: 'linux',
  uid: 1001,
  readNamespace: (file) => (file.endsWith('/user') ? 'user:[3]' : 'net:[4]'),
  readStatus: () => emptyCapabilities,
  run: (_command, args) => ({
    status: 0,
    stdout: args[0] === '-j' ? JSON.stringify([{ ifname: 'lo', flags: ['LOOPBACK', 'UP'] }]) : '',
  }),
};

test('browser execution verifies non-root identity, all capability sets and the actual isolated network', () => {
  const receipt = inspectWcNativeIsolation(executionEnvironment);
  assert.equal(receipt.outcome, 'ready');
  assert.equal(receipt.uid, 1001);
  assert.equal(receipt.browserJourneysExecuted, 0);
  assert.equal(receipt.phase, 'browser-execution-preflight');
});

test(
  'the native execution CLI refuses the original namespaces without spawning the test program',
  { skip: process.platform !== 'linux' },
  () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'wc-native-refusal-'));
    try {
      const vitestDirectory = path.join(directory, 'node_modules', 'vitest');
      mkdirSync(vitestDirectory, { recursive: true });
      // This observable marker would expose an unrestricted fall-through.
      writeFileSync(
        path.join(vitestDirectory, 'vitest.mjs'),
        "import { writeFileSync } from 'node:fs'; writeFileSync('browser-started', 'unexpected');\n"
      );
      const evidence = path.join(directory, 'evidence');
      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('./wc-native-isolation.mjs', import.meta.url)),
          evidence,
          '--run-native',
          readlinkSync('/proc/self/ns/user'),
          readlinkSync('/proc/self/ns/net'),
        ],
        { cwd: directory, env: { PATH: process.env.PATH }, encoding: 'utf8' }
      );
      assert.equal(result.status, 1);
      assert.equal(existsSync(path.join(directory, 'browser-started')), false);
      const receipt = JSON.parse(readFileSync(path.join(evidence, 'isolation-execution.json')));
      assert.equal(receipt.outcome, 'blocked');
      assert.equal(receipt.phase, 'browser-execution-preflight');
      assert.equal(receipt.browserJourneysExecuted, 0);
      assert.match(receipt.error, /namespaces must differ|non-root Linux browser/);
      assert.equal(existsSync(path.join(evidence, 'browser-vitest.json')), false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
);

for (const [name, override] of [
  ['root identity', { uid: 0 }],
  ['missing original namespace', { expectedUserNamespace: undefined }],
  [
    'original user namespace',
    { readNamespace: (f) => (f.endsWith('/user') ? 'user:[1]' : 'net:[4]') },
  ],
  [
    'original network namespace',
    { readNamespace: (f) => (f.endsWith('/user') ? 'user:[3]' : 'net:[2]') },
  ],
  ...['CapInh', 'CapPrm', 'CapEff', 'CapBnd', 'CapAmb'].map((key) => [
    `retained ${key}`,
    {
      readStatus: () =>
        emptyCapabilities.replace(`${key}:\t0000000000000000`, `${key}:\t0000000000000001`),
    },
  ]),
  ['missing capability facts', { readStatus: () => '' }],
  [
    'extra network interface',
    {
      run: () => ({
        status: 0,
        stdout: JSON.stringify([{ ifname: 'lo', flags: ['UP'] }, { ifname: 'eth0' }]),
      }),
    },
  ],
  [
    'inactive loopback',
    { run: () => ({ status: 0, stdout: JSON.stringify([{ ifname: 'lo', flags: ['LOOPBACK'] }]) }) },
  ],
  [
    'IPv4 default route',
    {
      run: (c, a) =>
        a[0] === 'route'
          ? { status: 0, stdout: 'default via 192.0.2.1' }
          : executionEnvironment.run(c, a),
    },
  ],
  [
    'IPv6 default route',
    {
      run: (c, a) =>
        a[0] === '-6'
          ? { status: 0, stdout: 'default via 2001:db8::1' }
          : executionEnvironment.run(c, a),
    },
  ],
  ['network inspection failure', { run: () => ({ status: 1, stderr: 'inspection denied' }) }],
]) {
  test(`execution preflight refuses ${name} before starting browser journeys`, () => {
    const receipt = inspectWcNativeIsolation({ ...executionEnvironment, ...override });
    assert.equal(receipt.outcome, 'blocked');
    assert.equal(receipt.browserJourneysExecuted, 0);
    assert.ok(receipt.error);
  });
}
