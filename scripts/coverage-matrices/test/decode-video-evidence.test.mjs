import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, mock } from 'node:test';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { decodeVideoEvidence } from '../decode-video-evidence.mjs';

const fixtures = fileURLToPath(new URL('./fixtures/video/', import.meta.url));
for (const name of [
  'faststart.mp4',
  'moov-at-end.mp4',
  'colors.mov',
  'colors.mkv',
  'colors.webm',
]) {
  test(`bounded real decoder verifies ${name} with seekable sealed input`, () => {
    const result = decodeVideoEvidence(path.join(fixtures, name));
    assert.deepEqual(result, { width: 32, height: 32, seconds: 1.5, frames: 3, distinctPixels: 3 });
  });
}

test('bounded decoder rejects truncation rather than accepting a decoded prefix', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-video-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const data = fs.readFileSync(path.join(fixtures, 'faststart.mp4'));
  const filename = path.join(root, 'truncated.mp4');
  fs.writeFileSync(filename, data.subarray(0, -10));
  assert.throws(() => decodeVideoEvidence(filename), /ffmpeg failed|ffprobe failed/);
});

for (const [name, limits] of [
  ['bytes', { bytes: 16 }],
  ['pixels', { pixels: 16 }],
  ['frames', { frames: 2 }],
  ['duration', { seconds: 1 }],
  ['wall time', { timeoutMs: 1 }],
]) {
  test(`bounded decoder enforces the ${name} limit`, () => {
    assert.throws(() => decodeVideoEvidence(path.join(fixtures, 'faststart.mp4'), limits));
  });
}

test('unavailable decoder toolchain is a failure, not a signature fallback or skip', () => {
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

test('PATH-prepended fake media tools cannot substitute for the distro toolchain', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-fake-tools-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const marker = path.join(root, 'executed');
  for (const name of ['python3', 'ffmpeg', 'ffprobe']) {
    fs.writeFileSync(path.join(root, name), `#!/bin/sh\nprintf fake > '${marker}'\nexit 0\n`, {
      mode: 0o755,
    });
  }
  const original = process.env.PATH;
  try {
    process.env.PATH = root;
    assert.equal(decodeVideoEvidence(path.join(fixtures, 'faststart.mp4')).frames, 3);
    assert.equal(fs.existsSync(marker), false);
  } finally {
    process.env.PATH = original;
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

test('a genuine one-frame clip cannot satisfy multi-frame evidence', () => {
  assert.throws(() => decodeVideoEvidence(path.join(fixtures, 'one-frame.mp4')), /frame-count/);
});

test('multiple encoded frames with identical pixels cannot satisfy a transition', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-static-video-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const data = fs.readFileSync(path.join(fixtures, 'colors.mov'));
  const type = data.indexOf(Buffer.from('mdat'));
  assert.ok(type >= 4);
  const length = data.readUInt32BE(type - 4);
  data.fill(0, type + 4, type - 4 + length);
  const filename = path.join(root, 'static.mov');
  fs.writeFileSync(filename, data);
  assert.throws(() => decodeVideoEvidence(filename), /no decoded visual transition/);
});

test('CI version receipt and baseline checks use the same absolute distro tools', (t) => {
  const workflow = fs.readFileSync(
    new URL('../../../.github/workflows/ci.yml', import.meta.url),
    'utf8'
  );
  const block = workflow.slice(
    workflow.indexOf('      - name: Install and identify the bounded video'),
    workflow.indexOf('      - name: Public documentation gate')
  );
  const lines = [
    ...block.matchAll(/^          (\/usr\/bin\/(?:python3|ffmpeg|ffprobe) .+)$/gm),
  ].map((match) => match[1]);
  assert.equal(lines.length, 5);
  assert.doesNotMatch(block, /^          (?:python3|ffmpeg|ffprobe) /m);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-fake-receipt-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const marker = path.join(root, 'executed');
  for (const name of ['python3', 'ffmpeg', 'ffprobe', 'grep']) {
    fs.writeFileSync(
      path.join(root, name),
      `#!/bin/sh\nprintf fake > '${marker}'\nprintf 'ffmpeg version 6.1.fake\\n'\nexit 0\n`,
      { mode: 0o755 }
    );
  }
  const actual = childProcess
    .spawnSync('/usr/bin/ffmpeg', ['-version'], { encoding: 'utf8' })
    .stdout.split('\n')[0];
  const receipt = childProcess.spawnSync(
    '/bin/bash',
    ['-c', 'set -euo pipefail\n' + lines.join('\n')],
    { encoding: 'utf8', env: { PATH: root, LANG: 'C', LC_ALL: 'C' } }
  );
  assert.ok(receipt.stdout.includes(actual));
  assert.equal(receipt.status, /^ffmpeg version 6\.1\./.test(actual) ? 0 : 1);
  assert.equal(fs.existsSync(marker), false);
});
