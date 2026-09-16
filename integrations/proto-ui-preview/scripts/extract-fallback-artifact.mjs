#!/usr/bin/env node

// Bounded download and extraction for one verified GitHub Actions artifact.
//
// The artifact bytes are always treated as hostile. The compressed stream is
// capped while it is downloaded, and every ZIP entry is validated from the
// central directory - before a single uncompressed byte is materialized -
// against the pinned dcbot fallback envelope. Only after this bounded
// extraction does the fallback sanitizer re-check the resulting tree.

import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

import { FALLBACK_LIMITS } from './prepare-fallback-artifact.mjs';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;

function fail(message) {
  throw new Error(message);
}

function assertSafeEntryName(name) {
  if (
    name.length === 0 ||
    name.includes('\\') ||
    name.startsWith('/') ||
    /^[A-Za-z]:/.test(name) ||
    /[\u0000-\u001f\u007f]/.test(name)
  ) {
    fail(`artifact contains an unsafe path segment: ${JSON.stringify(name)}`);
  }
  const segments = name.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      fail(`artifact contains an unsafe path segment: ${JSON.stringify(name)}`);
    }
  }
}

export async function downloadVerifiedArtifact({
  token,
  repository,
  artifactId,
  runId,
  fetchImpl = fetch,
  maxCompressedBytes = FALLBACK_LIMITS.maxCompressedBytes,
}) {
  if (!token) fail('GitHub workflow identity is unavailable');
  const [owner, repo] = (repository || '').split('/');
  if (!owner || !repo) fail('invalid repository binding');
  if (!Number.isSafeInteger(artifactId) || artifactId < 1) fail('invalid artifact ID');
  if (!Number.isSafeInteger(runId) || runId < 1) fail('invalid workflow run ID');

  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const metadata = await fetchImpl(`${api}/actions/artifacts/${artifactId}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!metadata.ok) fail(`artifact metadata lookup failed (${metadata.status})`);
  const record = await metadata.json();
  if (record.expired) fail('artifact is expired');
  if (Number(record?.workflow_run?.id) !== runId) {
    fail('artifact does not belong to the verified workflow run');
  }
  if (
    !Number.isSafeInteger(record.size_in_bytes) ||
    record.size_in_bytes < 1 ||
    record.size_in_bytes > maxCompressedBytes
  ) {
    fail('artifact exceeds the 50 MiB compressed envelope');
  }

  const redirect = await fetchImpl(`${api}/actions/artifacts/${artifactId}/zip`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });
  if (redirect.status !== 302) fail(`artifact download redirect failed (${redirect.status})`);
  const location = redirect.headers.get('location') || '';
  let downloadURL;
  try {
    downloadURL = new URL(location);
  } catch {
    fail('artifact download redirect is not a URL');
  }
  if (downloadURL.protocol !== 'https:') fail('artifact download redirect is not HTTPS');

  // The signed blob URL must never receive the API credential.
  const archive = await fetchImpl(downloadURL, { signal: AbortSignal.timeout(120_000) });
  if (!archive.ok || !archive.body) fail(`artifact archive download failed (${archive.status})`);

  const chunks = [];
  let received = 0;
  const reader = archive.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxCompressedBytes) {
      await reader.cancel().catch(() => {});
      fail('artifact stream exceeded the 50 MiB compressed envelope');
    }
    chunks.push(value);
  }
  if (received !== record.size_in_bytes) fail('artifact stream size changed during download');
  return Buffer.concat(chunks);
}

function findEndOfCentralDirectory(bytes) {
  const earliest = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= earliest; offset -= 1) {
    if (bytes.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  fail('artifact archive has no end of central directory');
}

export function listBoundedEntries(bytes, limits = FALLBACK_LIMITS) {
  const eocd = findEndOfCentralDirectory(bytes);
  const totalEntries = bytes.readUInt16LE(eocd + 10);
  const directorySize = bytes.readUInt32LE(eocd + 12);
  const directoryOffset = bytes.readUInt32LE(eocd + 16);
  if (totalEntries === ZIP64_SENTINEL_16 || directoryOffset === ZIP64_SENTINEL_32) {
    fail('ZIP64 archives are not accepted');
  }
  if (directoryOffset + directorySize > bytes.length) {
    fail('artifact central directory escapes the archive');
  }

  const entries = [];
  let expandedBytes = 0;
  let offset = directoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      fail('artifact central directory is malformed');
    }
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const externalAttributes = bytes.readUInt32LE(offset + 38);
    const localHeaderOffset = bytes.readUInt32LE(offset + 42);
    if (
      compressedSize === ZIP64_SENTINEL_32 ||
      uncompressedSize === ZIP64_SENTINEL_32 ||
      localHeaderOffset === ZIP64_SENTINEL_32
    ) {
      fail('ZIP64 archives are not accepted');
    }
    const name = bytes.toString('utf8', offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/')) continue; // directories are recreated from file paths
    assertSafeEntryName(name);
    if (flags & 0x1) fail(`artifact entry is encrypted: ${name}`);
    if (method !== 0 && method !== 8) fail(`artifact entry uses an unsupported method: ${name}`);
    const unixFileType = (externalAttributes >>> 16) & 0o170000;
    if (unixFileType !== 0 && unixFileType !== 0o100000) {
      fail(`artifact contains a link or special file: ${name}`);
    }

    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    if (entries.length > limits.maxFiles) fail(`artifact exceeds ${limits.maxFiles} files`);
    if (uncompressedSize < 1) fail(`artifact file is empty: ${name}`);
    if (uncompressedSize > limits.maxFileBytes) {
      fail(`artifact file exceeds ${limits.maxFileBytes} bytes: ${name}`);
    }
    expandedBytes += uncompressedSize;
    if (expandedBytes > limits.maxExpandedBytes) {
      fail(`artifact expanded size exceeds ${limits.maxExpandedBytes} bytes`);
    }
  }
  if (entries.length === 0) fail('artifact contains no deployable files');
  return entries;
}

export function extractBoundedZip(bytes, limits = FALLBACK_LIMITS) {
  const entries = listBoundedEntries(bytes, limits);
  const files = new Map();
  for (const entry of entries) {
    const at = entry.localHeaderOffset;
    if (at + 30 > bytes.length || bytes.readUInt32LE(at) !== LOCAL_SIGNATURE) {
      fail(`artifact local header is malformed: ${entry.name}`);
    }
    const nameLength = bytes.readUInt16LE(at + 26);
    const extraLength = bytes.readUInt16LE(at + 28);
    const dataStart = at + 30 + nameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > bytes.length) fail(`artifact entry escapes the archive: ${entry.name}`);
    const compressed = bytes.subarray(dataStart, dataEnd);
    let content;
    if (entry.method === 0) {
      content = Buffer.from(compressed);
    } else {
      try {
        content = inflateRawSync(compressed, { maxOutputLength: limits.maxFileBytes + 1 });
      } catch {
        fail(`artifact file could not be inflated within its bound: ${entry.name}`);
      }
    }
    if (content.length !== entry.uncompressedSize) {
      fail(`artifact file expanded beyond its recorded size: ${entry.name}`);
    }
    if (files.has(entry.name)) fail(`artifact contains a duplicate entry: ${entry.name}`);
    files.set(entry.name, content);
  }
  return files;
}

export async function materializeBoundedZip(bytes, targetDirectory, limits = FALLBACK_LIMITS) {
  const files = extractBoundedZip(bytes, limits);
  const root = path.resolve(targetDirectory);
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true, mode: 0o750 });
  const names = [...files.keys()].sort((left, right) => left.localeCompare(right, 'en'));
  for (const name of names) {
    const target = path.join(root, ...name.split('/'));
    if (!target.startsWith(root + path.sep)) {
      fail(`artifact entry escapes the extraction root: ${name}`);
    }
    await mkdir(path.dirname(target), { recursive: true, mode: 0o750 });
    await writeFile(target, files.get(name), { mode: 0o640 });
    await chmod(target, 0o640);
  }
  return { files: names.length };
}

async function main() {
  const artifactId = Number(process.env.PREVIEW_ARTIFACT_ID);
  const runId = Number(process.env.PREVIEW_RUN_ID);
  const targetDirectory = process.env.PREVIEW_ARTIFACT_DIR || '';
  if (!targetDirectory || path.isAbsolute(targetDirectory) || targetDirectory.includes('..')) {
    fail('PREVIEW_ARTIFACT_DIR must be a workspace-relative directory');
  }
  const bytes = await downloadVerifiedArtifact({
    token: process.env.GITHUB_TOKEN || '',
    repository: process.env.GITHUB_REPOSITORY || '',
    artifactId,
    runId,
  });
  const { files } = await materializeBoundedZip(bytes, targetDirectory);
  console.log(`Bound-extracted ${files} fallback files (${bytes.length} compressed bytes).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
