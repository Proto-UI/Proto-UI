import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { readHistoryArchive } from './decode-history-archive.mjs';
import { readHistorySnapshot } from './history-files.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const root = await fs.mkdtemp(join(tmpdir(), 'history-index-binding-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = join(root, 'native');
  await fs.mkdir(directory);
  async function archive(version) {
    const capture = { pullRequest: { number: 12, headRefOid: version } };
    const value = {
      encoding: 's7-lossless-text-commit-intern-v1',
      strings: {},
      commits: {},
      pullRequests: [capture],
      inlinePages: [{ page: 1, rows: [] }],
    };
    const bytes = gzipSync(JSON.stringify(value));
    const path = `metadata-${version}.json.gz`;
    await fs.writeFile(join(directory, path), bytes);
    // The fixture has no punctuation inside string values. These separators
    // reproduce the original capture serializer for this bounded archive.
    const captured = JSON.stringify(capture).replaceAll(':', ': ').replaceAll(',', ', ');
    const index = Buffer.from(
      JSON.stringify({
        parts: [{ path, offset: 0, bytes: bytes.length, sha256: sha(bytes) }],
        archiveBytes: bytes.length,
        archiveSha256: sha(bytes),
        pullRequests: 1,
        inlinePages: 1,
        sourceFiles: [
          { path: 'pr-12.json', sha256: sha(captured) },
          { path: 'inline-0001.json', sha256: sha('[]') },
        ],
      })
    );
    return index;
  }
  const first = await archive('source-a');
  const second = await archive('source-b');
  const indexPath = join(directory, 'index.json');
  await fs.writeFile(indexPath, first);
  const snapshotPath = join(root, 'snapshot.json');
  const snapshot = {
    nativeSourceArchive: {
      directory: 'native',
      indexes: [{ path: 'index.json', sha256: sha(first) }],
    },
  };
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot));
  return { directory, first, second, indexPath, snapshotPath, snapshot };
}

test('decoder returns the index hash for the exact native values it decoded', async (t) => {
  const input = await fixture(t);
  const decoded = await readHistoryArchive(input.directory);
  await fs.writeFile(input.indexPath, input.second);
  assert.deepEqual(decoded.indexes, [{ path: 'index.json', sha256: sha(input.first) }]);
  assert.equal(decoded.sourceCaptures.get('pr-12.json').pullRequest.headRefOid, 'source-a');
  assert.notEqual(decoded.indexes[0].sha256, sha(await fs.readFile(input.indexPath)));
});

test('an index replaced after its first read cannot swap the source accepted by a snapshot', async (t) => {
  const input = await fixture(t);
  const originalReadFile = fs.readFile;
  let replaced = false;
  t.mock.method(fs, 'readFile', async (...args) => {
    const bytes = await originalReadFile(...args);
    if (!replaced && args[0] === input.indexPath) {
      replaced = true;
      await fs.writeFile(input.indexPath, input.second);
    }
    return bytes;
  });
  syncBuiltinESMExports();
  try {
    const snapshot = await readHistorySnapshot(input.snapshotPath);
    assert.equal(replaced, true);
    assert.equal(snapshot.pullRequests[0].pullRequest.headRefOid, 'source-a');
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});

test('a snapshot rejects a different, missing or duplicate decoded index binding', async (t) => {
  const input = await fixture(t);
  for (const indexes of [
    [{ path: 'index.json', sha256: sha(input.second) }],
    [],
    [...input.snapshot.nativeSourceArchive.indexes, ...input.snapshot.nativeSourceArchive.indexes],
  ]) {
    await fs.writeFile(
      input.snapshotPath,
      JSON.stringify({
        nativeSourceArchive: { ...input.snapshot.nativeSourceArchive, indexes },
      })
    );
    await assert.rejects(readHistorySnapshot(input.snapshotPath), /native source index/);
  }
});
