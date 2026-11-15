import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkWcNativeIsolation } from './wc-native-isolation.mjs';

const namespaces = (file) => (file.endsWith('/user') ? 'user:[1]' : 'net:[2]');

test('preparation requires a distinct user/network namespace and loopback without inherited credentials', () => {
  const receipt = checkWcNativeIsolation({
    platform: 'linux',
    readNamespace: namespaces,
    searchPath: '/test/bin',
    run(command, args, options) {
      assert.equal(command, 'unshare');
      assert.deepEqual(args.slice(0, 5), ['--user', '--map-root-user', '--net', 'sh', '-c']);
      assert.deepEqual(args.slice(-3), ['sh', 'user:[1]', 'net:[2]']);
      assert.match(args[5], /readlink \/proc\/self\/ns\/user/);
      assert.match(args[5], /readlink \/proc\/self\/ns\/net/);
      assert.match(args[5], /ip link set lo up/);
      assert.match(args[5], /ip -o link show \| wc -l/);
      assert.match(args[5], /ip -6 route show default/);
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
