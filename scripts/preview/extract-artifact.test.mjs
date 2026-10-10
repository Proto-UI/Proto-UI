import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';

import {
  downloadVerifiedArtifact,
  extractBoundedZip,
  materializeBoundedZip,
} from './extract-artifact.mjs';

function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const method = entry.method ?? 0;
    const stored = method === 8 ? deflateRawSync(entry.content) : Buffer.from(entry.content);
    const recordedSize = entry.recordedSize ?? entry.content.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.flags ?? 0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(recordedSize, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(((entry.madeBy ?? 3) << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(entry.flags ?? 0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(recordedSize, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((entry.mode ?? 0o100644) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, stored);
    centrals.push(central, name);
    offset += 30 + name.length + stored.length;
  }
  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

const smallLimits = Object.freeze({
  maxFiles: 3,
  maxFileBytes: 64,
  maxExpandedBytes: 128,
  maxCompressedBytes: 50 * 1024 * 1024,
});

test('extracts stored and deflated regular files within the envelope', () => {
  const zip = buildZip([
    { name: 'index.html', content: Buffer.from('<h1>preview</h1>') },
    { name: 'assets/app.js', content: Buffer.from('console.log(1);'.repeat(20)), method: 8 },
  ]);
  const files = extractBoundedZip(zip, {
    ...smallLimits,
    maxFileBytes: 1024,
    maxExpandedBytes: 4096,
  });
  assert.equal(files.get('index.html').toString(), '<h1>preview</h1>');
  assert.equal(files.get('assets/app.js').toString(), 'console.log(1);'.repeat(20));
});

test('materializes files under the target root with safe permissions', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'preview-extract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const zip = buildZip([
    { name: 'nested/deep/file.txt', content: Buffer.from('bounded') },
    { name: 'dir/', content: Buffer.alloc(0) },
  ]);
  const target = path.join(root, 'artifact');
  const result = await materializeBoundedZip(zip, target, smallLimits);
  assert.equal(result.files, 1);
  assert.equal(await readFile(path.join(target, 'nested/deep/file.txt'), 'utf8'), 'bounded');
});

test('preserves zero-byte stored and deflated regular assets within the same bounds', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'preview-empty-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const zip = buildZip([
    { name: 'empty.txt', content: Buffer.alloc(0) },
    { name: 'assets/empty.css', content: Buffer.alloc(0), method: 8 },
    { name: 'index.html', content: Buffer.from('ok') },
  ]);
  const files = extractBoundedZip(zip, smallLimits);
  assert.equal(files.size, 3);
  assert.equal(files.get('empty.txt').length, 0);
  assert.equal(files.get('assets/empty.css').length, 0);
  await materializeBoundedZip(zip, root, smallLimits);
  assert.equal((await readFile(path.join(root, 'empty.txt'))).length, 0);
  assert.equal((await readFile(path.join(root, 'assets/empty.css'))).length, 0);
  assert.throws(
    () => extractBoundedZip(zip, { ...smallLimits, maxFiles: 2 }),
    /exceeds 2 files/,
    'empty files still consume the file-count budget'
  );
  assert.throws(
    () =>
      extractBoundedZip(
        buildZip([{ name: 'empty-link', content: Buffer.alloc(0), mode: 0o120777 }]),
        smallLimits
      ),
    /link or special file/,
    'empty symlinks remain forbidden'
  );
});

test('rejects traversal, absolute, drive, backslash, and empty-segment names', () => {
  for (const name of ['../evil', '/evil', 'C:evil', 'a\\b', 'a//b', 'a/./b']) {
    const zip = buildZip([{ name, content: Buffer.from('x') }]);
    assert.throws(() => extractBoundedZip(zip, smallLimits), /unsafe path segment/, name);
  }
});

test('rejects symlinks and special files recorded by unix mode bits', () => {
  for (const mode of [0o120777, 0o060600, 0o010600]) {
    const zip = buildZip([{ name: 'link', content: Buffer.from('x'), mode }]);
    assert.throws(() => extractBoundedZip(zip, smallLimits), /link or special file/);
  }
});

test('rejects encrypted entries and unsupported compression methods', () => {
  const encrypted = buildZip([{ name: 'a', content: Buffer.from('x'), flags: 0x1 }]);
  assert.throws(() => extractBoundedZip(encrypted, smallLimits), /encrypted/);
  const bzip2 = buildZip([{ name: 'a', content: Buffer.from('x'), method: 12 }]);
  assert.throws(() => extractBoundedZip(bzip2, smallLimits), /unsupported method/);
});

test('enforces file count, per-file, and expanded envelope bounds', () => {
  const manyFiles = buildZip(
    ['a', 'b', 'c', 'd'].map((name) => ({ name, content: Buffer.from('x') }))
  );
  assert.throws(() => extractBoundedZip(manyFiles, smallLimits), /exceeds 3 files/);
  const largeFile = buildZip([{ name: 'a', content: Buffer.alloc(65, 1) }]);
  assert.throws(() => extractBoundedZip(largeFile, smallLimits), /exceeds 64 bytes/);
  const expanded = buildZip([
    { name: 'a', content: Buffer.alloc(50, 1) },
    { name: 'b', content: Buffer.alloc(50, 1) },
    { name: 'c', content: Buffer.alloc(50, 1) },
  ]);
  assert.throws(() => extractBoundedZip(expanded, smallLimits), /expanded size exceeds 128/);
});

test('rejects an entry whose inflation outruns its central-directory record', () => {
  const lying = buildZip([
    { name: 'a', content: Buffer.from('compressed-content'), method: 8, recordedSize: 5 },
  ]);
  assert.throws(() => extractBoundedZip(lying, smallLimits), /expanded beyond its recorded size/);
});

test('rejects duplicate entries and archives without regular files', () => {
  const duplicate = buildZip([
    { name: 'a', content: Buffer.from('x') },
    { name: 'a', content: Buffer.from('y') },
  ]);
  assert.throws(() => extractBoundedZip(duplicate, smallLimits), /duplicate entry/);
  const directoriesOnly = buildZip([{ name: 'dir/', content: Buffer.alloc(0) }]);
  assert.throws(() => extractBoundedZip(directoriesOnly, smallLimits), /no deployable files/);
});

function stubFetch({ metadata, zip }) {
  const calls = [];
  return {
    calls,
    async fetchImpl(url, init = {}) {
      calls.push({ url: String(url), headers: init.headers ?? {} });
      const target = String(url);
      if (target.endsWith('/zip')) {
        return {
          status: 302,
          headers: new Map([['location', 'https://blob.example/download?sig=1']]),
        };
      }
      if (target.startsWith('https://blob.example/')) {
        const chunks = Array.isArray(zip) ? zip : [zip];
        return {
          ok: true,
          status: 200,
          body: new ReadableStream({
            start(controller) {
              for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
              controller.close();
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => metadata,
      };
    },
  };
}

const metadataFor = (size, runId = 4242) => ({
  expired: false,
  size_in_bytes: size,
  workflow_run: { id: runId },
});

test('downloads only the artifact bound to the verified run, capped while streaming', async () => {
  const zip = buildZip([{ name: 'index.html', content: Buffer.from('ok') }]);
  const { calls, fetchImpl } = stubFetch({ metadata: metadataFor(zip.length), zip });
  const bytes = await downloadVerifiedArtifact({
    token: 'token',
    repository: 'Proto-UI/Proto-UI',
    artifactId: 7,
    runId: 4242,
    fetchImpl,
  });
  assert.deepEqual(bytes, zip);
  const blobCall = calls.find((call) => call.url.startsWith('https://blob.example/'));
  assert.equal(
    blobCall.headers.Authorization,
    undefined,
    'signed blob URLs never receive the API token'
  );
});

test('refuses expired, wrong-run, and oversize metadata before downloading', async () => {
  const zip = buildZip([{ name: 'a', content: Buffer.from('x') }]);
  for (const [metadata, pattern] of [
    [{ ...metadataFor(zip.length), expired: true }, /expired/],
    [metadataFor(zip.length, 9999), /does not belong to the verified workflow run/],
    [metadataFor(50 * 1024 * 1024 + 1), /exceeds the 50 MiB compressed envelope/],
  ]) {
    const { calls, fetchImpl } = stubFetch({ metadata, zip });
    await assert.rejects(
      downloadVerifiedArtifact({
        token: 'token',
        repository: 'Proto-UI/Proto-UI',
        artifactId: 7,
        runId: 4242,
        fetchImpl,
      }),
      pattern
    );
    assert.equal(
      calls.some((call) => call.url.startsWith('https://blob.example/')),
      false,
      'the archive must not be fetched after a metadata refusal'
    );
  }
});

test('aborts a stream that outruns or mismatches the recorded compressed size', async () => {
  const zip = buildZip([{ name: 'a', content: Buffer.from('x') }]);
  const lying = stubFetch({ metadata: metadataFor(zip.length + 8), zip });
  await assert.rejects(
    downloadVerifiedArtifact({
      token: 'token',
      repository: 'Proto-UI/Proto-UI',
      artifactId: 7,
      runId: 4242,
      fetchImpl: lying.fetchImpl,
    }),
    /size changed during download/
  );
  const oversized = stubFetch({
    metadata: metadataFor(10),
    zip: Buffer.alloc(64, 1),
    limit: 32,
  });
  await assert.rejects(
    downloadVerifiedArtifact({
      token: 'token',
      repository: 'Proto-UI/Proto-UI',
      artifactId: 7,
      runId: 4242,
      fetchImpl: oversized.fetchImpl,
      maxCompressedBytes: 32,
    }),
    /exceeded the 50 MiB compressed envelope/
  );
});

for (const [name, entries, extraLimits, message] of [
  ['depth', [{ name: 'a/b/c/file', content: Buffer.alloc(0) }], { maxPathDepth: 3 }, /path depth/],
  [
    'path bytes',
    [{ name: '界/file', content: Buffer.alloc(0) }],
    { maxPathBytes: 7 },
    /path bytes/,
  ],
  [
    'total path bytes',
    [
      { name: 'a/file', content: Buffer.alloc(0) },
      { name: 'b/file', content: Buffer.alloc(0) },
    ],
    { maxTotalPathBytes: 10 },
    /total path bytes/,
  ],
  [
    'inferred directories',
    [
      { name: 'a/b/file', content: Buffer.alloc(0) },
      { name: 'c/d/file', content: Buffer.alloc(0) },
    ],
    { maxDirectories: 3 },
    /inferred directories/,
  ],
]) {
  test(`rejects excessive ${name} before changing the extraction tree`, async (t) => {
    const root = await mkdtemp(path.join(tmpdir(), 'preview-path-budget-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const marker = path.join(root, 'keep.txt');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(marker, 'untouched');
    await assert.rejects(
      materializeBoundedZip(buildZip(entries), root, { ...smallLimits, ...extraLimits }),
      message
    );
    assert.equal(await readFile(marker, 'utf8'), 'untouched');
  });
}

test('shared parent directories count once at the exact path budget', () => {
  const files = extractBoundedZip(
    buildZip([
      { name: 'a/x', content: Buffer.alloc(0) },
      { name: 'a/y', content: Buffer.alloc(0) },
    ]),
    { ...smallLimits, maxDirectories: 1, maxPathDepth: 2, maxPathBytes: 3, maxTotalPathBytes: 6 }
  );
  assert.equal(files.size, 2);
});
