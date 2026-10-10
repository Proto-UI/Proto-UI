import assert from 'node:assert/strict';
import { chmod, lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { PREVIEW_LIMITS, sanitizePreviewTree } from './sanitize-tree.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'preview-sanitize-'));
  const source = path.join(root, 'source');
  const output = path.join(root, 'output');
  await mkdir(source);
  return { root, source, output };
}
test('copies only ordinary files into a separate trusted tree', async () => {
  const { root, source, output } = await fixture();
  try {
    await mkdir(path.join(source, 'assets'));
    await writeFile(path.join(source, 'index.html'), '<h1>safe</h1>');
    await chmod(path.join(source, 'index.html'), 0o755);
    await writeFile(path.join(source, 'assets', '_worker.js'), 'nested ordinary asset');
    const result = await sanitizePreviewTree({ source, output });
    assert.deepEqual(result, { files: 2, bytes: 34 });
    assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), '<h1>safe</h1>');
    assert.equal((await lstat(path.join(output, 'index.html'))).mode & 0o111, 0);
    assert.equal(
      await readFile(path.join(output, 'assets', '_worker.js'), 'utf8'),
      'nested ordinary asset'
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('refuses overlapping source and trusted output trees', async () => {
  const { root, source } = await fixture();
  try {
    await writeFile(path.join(source, 'index.html'), 'safe');
    await assert.rejects(
      sanitizePreviewTree({ source, output: path.join(source, 'trusted') }),
      /must be separate/
    );
    await assert.rejects(sanitizePreviewTree({ source, output: root }), /must be separate/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects every reserved platform control at the artifact root', async () => {
  for (const reserved of [
    '.assetsignore',
    '_headers',
    '_redirects',
    '_routes.json',
    '_worker.js',
  ]) {
    const { root, source, output } = await fixture();
    try {
      await writeFile(path.join(source, 'index.html'), 'safe');
      await writeFile(path.join(source, reserved), 'hostile');
      await assert.rejects(sanitizePreviewTree({ source, output }), /reserved platform file/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('rejects a symlinked artifact root and symlink entries', async (t) => {
  const { root, source, output } = await fixture();
  const linkedRoot = path.join(root, 'linked-root');
  try {
    await writeFile(path.join(source, 'index.html'), 'safe');
    try {
      await symlink(source, linkedRoot, 'junction');
      await symlink(path.join(source, 'index.html'), path.join(source, 'alias.html'), 'file');
    } catch (error) {
      if (error?.code === 'EPERM') {
        t.skip('symlink creation is unavailable on this Windows host');
        return;
      }
      throw error;
    }
    await assert.rejects(
      sanitizePreviewTree({ source: linkedRoot, output }),
      /source must be a real directory/
    );
    await assert.rejects(sanitizePreviewTree({ source, output }), /symbolic link/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects special files', { skip: process.platform === 'win32' }, async () => {
  const { root, source, output } = await fixture();
  try {
    await writeFile(path.join(source, 'index.html'), 'safe');
    const fifo = path.join(source, 'hostile.fifo');
    const created = spawnSync('mkfifo', [fifo], { encoding: 'utf8' });
    assert.equal(created.status, 0, created.stderr);
    await assert.rejects(sanitizePreviewTree({ source, output }), /non-regular file/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test(
  'rejects ambiguous or control-character path segments',
  { skip: process.platform === 'win32' },
  async () => {
    for (const name of ['nested\\escape.html', 'line\nfeed.html']) {
      const { root, source, output } = await fixture();
      try {
        await writeFile(path.join(source, name), 'hostile');
        await assert.rejects(sanitizePreviewTree({ source, output }), /unsafe path segment/);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  }
);

test('enforces file-count boundaries without an off-by-one gap', async () => {
  const { root, source, output } = await fixture();
  try {
    await writeFile(path.join(source, 'one'), '1');
    await writeFile(path.join(source, 'two'), '2');
    assert.deepEqual(
      await sanitizePreviewTree({
        source,
        output,
        limits: { ...PREVIEW_LIMITS, maxFiles: 2 },
      }),
      { files: 2, bytes: 2 }
    );
    await writeFile(path.join(source, 'three'), '3');
    await assert.rejects(
      sanitizePreviewTree({
        source,
        output,
        limits: { ...PREVIEW_LIMITS, maxFiles: 2 },
      }),
      /exceeds 2 files/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('enforces per-file and expanded-size boundaries exactly', async () => {
  const { root, source, output } = await fixture();
  try {
    await writeFile(path.join(source, 'one'), '1234');
    await writeFile(path.join(source, 'two'), '5678');
    const exact = { ...PREVIEW_LIMITS, maxFileBytes: 4, maxExpandedBytes: 8 };
    assert.deepEqual(await sanitizePreviewTree({ source, output, limits: exact }), {
      files: 2,
      bytes: 8,
    });
    await writeFile(path.join(source, 'one'), '12345');
    await assert.rejects(
      sanitizePreviewTree({ source, output, limits: exact }),
      /file exceeds 4 bytes/
    );
    await writeFile(path.join(source, 'one'), '1234');
    await writeFile(path.join(source, 'three'), '9');
    await assert.rejects(
      sanitizePreviewTree({ source, output, limits: exact }),
      /expanded size exceeds 8 bytes/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
