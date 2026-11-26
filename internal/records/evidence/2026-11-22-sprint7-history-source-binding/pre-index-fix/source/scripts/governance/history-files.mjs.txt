import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readHistoryArchive } from './decode-history-archive.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');

export async function readHistoryJSON(path) {
  const bytes = await readFile(path);
  return JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes) : bytes.toString('utf8'));
}

// The large native PR captures already have a lossless, individually verified
// archive. Reuse it instead of embedding a second copy in the issue snapshot.
export async function readHistorySnapshot(path) {
  const snapshot = await readHistoryJSON(path);
  const native = snapshot.nativeSourceArchive;
  if (!native) return snapshot;
  if (!/^[a-zA-Z0-9.-]+$/.test(native.directory))
    throw new Error('invalid native source archive directory');
  const directory = resolve(dirname(path), native.directory);
  for (const entry of native.indexes) {
    if (!['index.json', 'timeline.index.json'].includes(entry.path))
      throw new Error('invalid native source index');
    if (hash(await readFile(resolve(directory, entry.path))) !== entry.sha256)
      throw new Error(`native source index changed: ${entry.path}`);
  }
  const { sourceCaptures } = await readHistoryArchive(directory);
  snapshot.pullRequests = [...sourceCaptures]
    .filter(([name]) => /^pr-/.test(name))
    .map(([, value]) => value)
    .sort((a, b) => a.pullRequest.number - b.pullRequest.number);
  snapshot.inlinePages = [...sourceCaptures]
    .filter(([name]) => /^inline-/.test(name))
    .map(([name, rows]) => ({
      page: Number(name.match(/-(\d+)/)[1]),
      rows,
      sha256: hash(JSON.stringify(rows)),
    }))
    .sort((a, b) => a.page - b.page);
  snapshot.issueTimeline = [...sourceCaptures]
    .filter(([name]) => /^timeline-/.test(name))
    .map(([, value]) => value)
    .sort((a, b) => a.issue.number - b.issue.number);
  return snapshot;
}
