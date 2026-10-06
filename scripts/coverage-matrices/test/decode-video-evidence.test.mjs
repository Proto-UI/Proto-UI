import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, mock } from 'node:test';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { decodeVideoEvidence } from '../decode-video-evidence.mjs';

const fixtures = fileURLToPath(new URL('./fixtures/video/', import.meta.url));
// Override only in this test process; this is simulated platform coverage,
// not proof of native Windows/macOS or successful media decoding.
function simulatePlatform(t, platform) {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { ...original, value: platform });
  t.after(() => Object.defineProperty(process, 'platform', original));
}

for (const platform of ['win32', 'darwin']) {
  test(`unsupported ${platform} fails before invoking tools (simulated platform)`, (t) => {
    simulatePlatform(t, platform);
    const spawn = mock.method(childProcess, 'spawnSync', () => {
      throw new Error('must not invoke a decoder on an unsupported platform');
    });
    syncBuiltinESMExports();
    try {
      assert.throws(
        () => decodeVideoEvidence(path.join(fixtures, 'faststart.mp4')),
        /video decoder unverified: supported Linux toolchain is unavailable/
      );
      assert.equal(spawn.mock.callCount(), 0);
    } finally {
      spawn.mock.restore();
      syncBuiltinESMExports();
    }
  });
}

test('unavailable decoder toolchain fails closed (simulated Linux)', (t) => {
  simulatePlatform(t, 'linux');
  const replacement = mock.method(childProcess, 'spawnSync', () => ({
    error: { code: 'ENOENT' },
    status: null,
    stdout: '',
    stderr: '',
  }));
  syncBuiltinESMExports();
  try {
    assert.throws(
      () => decodeVideoEvidence(path.join(fixtures, 'faststart.mp4')),
      /ffprobe failed: ENOENT/
    );
  } finally {
    replacement.mock.restore();
    syncBuiltinESMExports();
  }
});

test('decoder helper seals input and forbids nested file and network protocols', () => {
  const wrapper = fs.readFileSync(
    new URL('../with-sealed-video-input.py', import.meta.url),
    'utf8'
  );
  const driver = fs.readFileSync(new URL('../decode-video-evidence.mjs', import.meta.url), 'utf8');
  assert.match(wrapper, /memfd_create/);
  assert.match(wrapper, /F_ADD_SEALS/);
  assert.match(wrapper, /0x0001 \| 0x0002 \| 0x0004 \| 0x0008/);
  assert.match(wrapper, /RLIMIT_AS/);
  assert.match(wrapper, /RLIMIT_CPU/);
  assert.match(driver, /['"]-protocol_whitelist['"],\s*['"]fd['"]/);
  assert.doesNotMatch(driver, /['"]-protocol_whitelist['"],\s*['"][^'"]*(?:file|https?|tcp)/);
});

test(
  'portable suite does not run Linux media integration',
  {
    skip: 'NOT RUN here: node --test scripts/coverage-matrices/test/decode-video-evidence.integration.mjs; required separately in Linux CI',
  },
  () => {}
);

const integration = fileURLToPath(
  new URL('./decode-video-evidence.integration.mjs', import.meta.url)
);
function runIntegration(preload) {
  // A nested CLI must start its own runner rather than inherit node:test's child context.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return childProcess.spawnSync(
    process.execPath,
    [
      '--import',
      `data:text/javascript,${encodeURIComponent(preload)}`,
      '--test',
      '--test-reporter=tap',
      integration,
    ],
    { encoding: 'utf8', timeout: 15000, env }
  );
}

test('explicit integration CLI fails on unsupported platform (simulated Windows)', () => {
  const result = runIntegration(`
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    Object.defineProperty(process, 'platform', { value: 'win32' });
    childProcess.spawnSync = () => { throw new Error('tools must not execute in portable controls'); };
    syncBuiltinESMExports();
  `);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /supported Linux toolchain is unavailable/);
  assert.match(result.stdout, /# skipped 0/);
});

test('explicit integration CLI fails when tools are missing (simulated ENOENT)', () => {
  const result = runIntegration(`
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    Object.defineProperty(process, 'platform', { value: 'linux' });
    childProcess.spawnSync = () => ({ error: { code: 'ENOENT' }, status: null, stdout: '', stderr: '' });
    syncBuiltinESMExports();
  `);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /ffprobe failed: ENOENT/);
  assert.match(result.stdout, /# skipped 0/);
});

test('CI requires the explicit real-decoder entry before the repository suite', () => {
  const workflow = fs.readFileSync(
    new URL('../../../.github/workflows/ci.yml', import.meta.url),
    'utf8'
  );
  const block = workflow.slice(
    workflow.indexOf('      - name: Install and identify the bounded video'),
    workflow.indexOf('      - name: Public documentation gate')
  );
  assert.match(block, /set -euo pipefail/);
  assert.match(
    block,
    /^          node --test scripts\/coverage-matrices\/test\/decode-video-evidence\.integration\.mjs$/m
  );
  assert.doesNotMatch(block, /continue-on-error|\|\| true/);
});
