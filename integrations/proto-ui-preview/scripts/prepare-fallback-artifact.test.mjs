import assert from 'node:assert/strict';
import { chmod, lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FALLBACK_LIMITS,
  RESERVED_FALLBACK_ROOT_FILES,
  assertCompressedArchiveSize,
  sanitizeFallbackTree,
} from './prepare-fallback-artifact.mjs';

const script = fileURLToPath(new URL('./prepare-fallback-artifact.mjs', import.meta.url));

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'poppy-fallback-sanitize-'));
  const source = path.join(root, 'source');
  const output = path.join(root, 'output');
  await mkdir(source);
  return { root, source, output };
}

test('publishes the exact dcbot artifact envelope', () => {
  assert.deepEqual(FALLBACK_LIMITS, {
    maxFiles: 20_000,
    maxFileBytes: 25 * 1024 * 1024,
    maxExpandedBytes: 100 * 1024 * 1024,
    maxCompressedBytes: 50 * 1024 * 1024,
  });
  assert.deepEqual(
    [...RESERVED_FALLBACK_ROOT_FILES].sort(),
    ['.assetsignore', '_headers', '_redirects', '_routes.json', '_worker.js'].sort()
  );
});

test('copies only ordinary files into a separate trusted tree', async () => {
  const { root, source, output } = await fixture();
  try {
    await mkdir(path.join(source, 'assets'));
    await writeFile(path.join(source, 'index.html'), '<h1>safe</h1>');
    await writeFile(path.join(source, 'assets', '_worker.js'), 'nested ordinary asset');
    const result = await sanitizeFallbackTree({ source, output });
    assert.deepEqual(result, { files: 2, bytes: 34 });
    assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), '<h1>safe</h1>');
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
      sanitizeFallbackTree({ source, output: path.join(source, 'trusted') }),
      /must be separate/
    );
    await assert.rejects(sanitizeFallbackTree({ source, output: root }), /must be separate/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test(
  'the Linux CLI archives only the sanitized non-executable copy',
  { skip: process.platform === 'win32' },
  async () => {
    const { root, source, output } = await fixture();
    const archive = path.join(root, 'preview.tar.gz');
    const extracted = path.join(root, 'extracted');
    try {
      const sourceFile = path.join(source, 'index.html');
      await writeFile(sourceFile, '<h1>safe</h1>');
      await chmod(sourceFile, 0o755);
      const prepared = spawnSync(
        process.execPath,
        [script, '--source', 'source', '--output', 'output', '--archive', 'preview.tar.gz'],
        { cwd: root, encoding: 'utf8' }
      );
      assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
      assert.equal((await lstat(path.join(output, 'index.html'))).mode & 0o111, 0);

      await mkdir(extracted);
      const unpacked = spawnSync(
        'tar',
        ['--extract', '--gzip', '--file', archive, '--directory', extracted],
        {
          encoding: 'utf8',
        }
      );
      assert.equal(unpacked.status, 0, unpacked.stderr || unpacked.stdout);
      assert.equal(await readFile(path.join(extracted, 'index.html'), 'utf8'), '<h1>safe</h1>');
      assert.equal((await lstat(path.join(extracted, 'index.html'))).mode & 0o111, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
);

test('rejects every reserved platform control at the artifact root', async () => {
  for (const reserved of RESERVED_FALLBACK_ROOT_FILES) {
    const { root, source, output } = await fixture();
    try {
      await writeFile(path.join(source, 'index.html'), 'safe');
      await writeFile(path.join(source, reserved), 'hostile');
      await assert.rejects(sanitizeFallbackTree({ source, output }), /reserved platform file/);
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
      sanitizeFallbackTree({ source: linkedRoot, output }),
      /source must be a real directory/
    );
    await assert.rejects(sanitizeFallbackTree({ source, output }), /symbolic link/);
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
    await assert.rejects(sanitizeFallbackTree({ source, output }), /non-regular file/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test(
  'rejects path segments that the receiver would reinterpret',
  { skip: process.platform === 'win32' },
  async () => {
    for (const name of ['nested\\escape.html', 'line\nfeed.html']) {
      const { root, source, output } = await fixture();
      try {
        await writeFile(path.join(source, name), 'hostile');
        await assert.rejects(sanitizeFallbackTree({ source, output }), /unsafe path segment/);
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
      await sanitizeFallbackTree({
        source,
        output,
        limits: { ...FALLBACK_LIMITS, maxFiles: 2 },
      }),
      { files: 2, bytes: 2 }
    );
    await writeFile(path.join(source, 'three'), '3');
    await assert.rejects(
      sanitizeFallbackTree({
        source,
        output,
        limits: { ...FALLBACK_LIMITS, maxFiles: 2 },
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
    const exact = { ...FALLBACK_LIMITS, maxFileBytes: 4, maxExpandedBytes: 8 };
    assert.deepEqual(await sanitizeFallbackTree({ source, output, limits: exact }), {
      files: 2,
      bytes: 8,
    });
    await writeFile(path.join(source, 'one'), '12345');
    await assert.rejects(
      sanitizeFallbackTree({ source, output, limits: exact }),
      /file exceeds 4 bytes/
    );
    await writeFile(path.join(source, 'one'), '1234');
    await writeFile(path.join(source, 'three'), '9');
    await assert.rejects(
      sanitizeFallbackTree({ source, output, limits: exact }),
      /expanded size exceeds 8 bytes/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('enforces the compressed boundary exactly', () => {
  assert.doesNotThrow(() => assertCompressedArchiveSize(FALLBACK_LIMITS.maxCompressedBytes));
  assert.throws(
    () => assertCompressedArchiveSize(FALLBACK_LIMITS.maxCompressedBytes + 1),
    /exceeds 50 MiB/
  );
  assert.throws(() => assertCompressedArchiveSize(0), /empty/);
});
