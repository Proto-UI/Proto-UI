import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function readHistoryArchive(directory, output = null) {
  const index = JSON.parse(await readFile(join(directory, 'index.json'), 'utf8'));
  const chunks = [];
  let offset = 0;
  for (const part of index.parts) {
    if (!/^[a-zA-Z0-9.-]+$/.test(part.path) || part.offset !== offset)
      throw new Error('invalid volume path/order');
    const bytes = await readFile(join(directory, part.path));
    if (bytes.length !== part.bytes || sha(bytes) !== part.sha256)
      throw new Error(`volume integrity failed: ${part.path}`);
    chunks.push(bytes);
    offset += bytes.length;
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length !== index.archiveBytes || sha(bytes) !== index.archiveSha256)
    throw new Error('archive integrity failed');
  const archive = JSON.parse(gunzipSync(bytes));
  if (archive.encoding !== 's7-lossless-text-commit-intern-v1')
    throw new Error('unknown source archive encoding');
  for (const [key, value] of Object.entries(archive.strings)) {
    if (sha(value) !== key) throw new Error(`interned source text hash mismatch: ${key}`);
  }
  const resolvedCommits = new Map();
  function resolve(value, active = new Set()) {
    if (Array.isArray(value)) return value.map((child) => resolve(child, active));
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 1 && keys[0] === '$s7text') {
        if (!Object.hasOwn(archive.strings, value.$s7text)) throw new Error('missing source text');
        return archive.strings[value.$s7text];
      }
      if (keys.length === 1 && keys[0] === '$s7commit') {
        const key = value.$s7commit;
        if (!Object.hasOwn(archive.commits, key) || active.has(key))
          throw new Error('missing or cyclic commit source');
        if (!resolvedCommits.has(key)) resolvedCommits.set(key, { commit: resolve(archive.commits[key], new Set([...active, key])) });
        return resolvedCommits.get(key);
      }
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, resolve(child, active)])
      );
    }
    return value;
  }

  // The capture used Python json.dumps(ensure_ascii=False), with its default
  // separators and no indentation/newline. Recreate those bytes, then verify
  // against the individual capture hashes, not only the compressed transport.
  function captureJSON(value) {
    const compact = JSON.stringify(value);
    let quoted = false, escaped = false, start = 0;
    const chunks = [];
    for (let index = 0; index < compact.length; index++) {
      const character = compact[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === ',' || character === ':') {
        chunks.push(compact.slice(start, index + 1), ' ');
        start = index + 1;
      }
    }
    chunks.push(compact.slice(start));
    return chunks.join('');
  }
  if (output) await mkdir(output, { recursive: true });
  const sourceCaptures = new Map();
  const expected = new Map(index.sourceFiles.map((file) => [file.path, file.sha256]));
  let written = 0;
  async function emit(path, value) {
    const text = captureJSON(value);
    if (sha(text) !== expected.get(path))
      throw new Error(`original capture hash mismatch: ${path}`);
    sourceCaptures.set(path, value);
    if (output) await writeFile(join(output, path), text);
    written++;
  }
  for (const item of resolve(archive.pullRequests))
    await emit(`pr-${item.pullRequest.number}.json`, item);
  for (const page of resolve(archive.inlinePages))
    await emit(`inline-${String(page.page).padStart(4, '0')}.json`, page.rows);
  if (written !== expected.size) throw new Error('capture population mismatch');
  let timelineCount = 0;
  if (
    await access(join(directory, 'timeline.index.json')).then(
      () => true,
      () => false
    )
  ) {
    const timelineIndex = JSON.parse(
      await readFile(join(directory, 'timeline.index.json'), 'utf8')
    );
    if (timelineIndex.path !== 'timeline.json.gz')
      throw new Error('unexpected timeline archive path');
    const compressed = await readFile(join(directory, timelineIndex.path));
    if (compressed.length !== timelineIndex.bytes || sha(compressed) !== timelineIndex.sha256)
      throw new Error('timeline archive integrity failed');
    const captures = JSON.parse(gunzipSync(compressed));
    const sourceHashes = new Map(timelineIndex.sourceFiles.map((file) => [file.path, file.sha256]));
    for (const capture of captures) {
      const path = `timeline-${capture.issue.number}.json`;
      const text = captureJSON(capture);
      if (sha(text) !== sourceHashes.get(path))
        throw new Error(`timeline source hash mismatch: ${path}`);
      sourceCaptures.set(path, capture);
      if (output) await writeFile(join(output, path), text);
    }
    if (captures.length !== timelineIndex.issues || captures.length !== sourceHashes.size)
      throw new Error('timeline population mismatch');
    timelineCount = captures.length;
  }
  return {
    sourceCaptures,
    counts: {
      restoredFiles: written,
      pullRequests: index.pullRequests,
      inlinePages: index.inlinePages,
      issueTimelines: timelineCount,
      everyOriginalCaptureHashVerified: true,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [directory, output] = process.argv.slice(2);
  if (!directory || !output)
    throw new Error('Usage: decode-history-archive.mjs ARCHIVE_DIRECTORY OUTPUT_DIRECTORY');
  console.log(JSON.stringify((await readHistoryArchive(directory, output)).counts));
}
