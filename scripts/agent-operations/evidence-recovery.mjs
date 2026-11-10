// Evidence indexing and recovery transfer bytes only. They never run a producer,
// recovered script, HTML report, package manager, browser, or Git writer.
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractBoundedZip } from '../preview/extract-artifact.mjs';

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_METADATA_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 10_000;
const unknown = 'unknown';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBlob = (bytes) =>
  createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const digestValue = (value) =>
  typeof value === 'string' && DIGEST.test(value.replace(/^sha256:/, ''))
    ? value.replace(/^sha256:/, '')
    : null;
const contentType = (name) =>
  ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json',
    '.html': 'text/html', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.md': 'text/markdown',
    '.zip': 'application/zip', '.webm': 'video/webm', '.mp4': 'video/mp4' })[path.extname(name)] ??
  'application/octet-stream';

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function safePath(value) {
  requireValue(typeof value === 'string' && value.length > 0 && value.length <= 1024,
    'evidence path is missing or too long');
  requireValue(!/[\\\u0000-\u001f\u007f]/.test(value) && !value.startsWith('/') &&
    !/^[A-Za-z]:/.test(value) && value.split('/').every((part) => part && part !== '.' && part !== '..'),
  'evidence path must be a relative regular-file path');
  return value;
}
function repositoryName(value) {
  const name = value?.replace(/^github\.com:/, '');
  requireValue(REPOSITORY.test(name ?? ''), 'repository must be OWNER/REPO');
  return name;
}
function safeRemote(value) {
  const url = new URL(value);
  requireValue(url.protocol === 'https:' && url.href.startsWith(`https://${url.hostname}/`) &&
    (!url.search || (url.hostname === 'api.github.com' && url.search === '?recursive=1')) &&
    !url.hash && ['api.github.com', 'raw.githubusercontent.com'].includes(url.hostname),
  'only credential-free GitHub API or immutable raw evidence URLs are accepted');
  if (url.hostname === 'raw.githubusercontent.com') {
    requireValue(SHA.test(url.pathname.split('/')[3] ?? ''), 'raw evidence URL must pin a full commit');
  }
  return url;
}
class TransferFailure extends Error {
  constructor(status, reason) {
    super(reason);
    this.status = status;
  }
}
function httpFailure(status) {
  if (status === 401 || status === 403) return new TransferFailure('unknown-access', `HTTP ${status}`);
  if (status === 410) return new TransferFailure('expired', 'HTTP 410');
  return new TransferFailure('unavailable', `HTTP ${status}`);
}
async function readResponse(response, limit = MAX_BYTES) {
  if (!response.ok) throw httpFailure(response.status);
  if (!response.body) throw new TransferFailure('unavailable', 'response has no body');
  const chunks = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new TransferFailure('unavailable', 'evidence exceeds the bounded transfer limit');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (!(error instanceof TypeError) && !['AbortError', 'TimeoutError'].includes(error?.name)) throw error;
    throw new TransferFailure('unavailable', 'evidence stream failed or timed out');
  }
  return Buffer.concat(chunks);
}
function transferContext({ fetchImpl = fetch, token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN } = {}) {
  return {
    async get(url, { json = false, redirect = 'error' } = {}) {
      const remote = safeRemote(String(url));
      const headers = { Accept: json ? 'application/vnd.github+json' : 'application/octet-stream' };
      if (remote.hostname === 'api.github.com') {
        headers['X-GitHub-Api-Version'] = '2022-11-28';
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      try {
        return await fetchImpl(remote, { headers, redirect, credentials: 'omit', signal: AbortSignal.timeout(120_000) });
      } catch (error) {
        if (!(error instanceof TypeError) && !['AbortError', 'TimeoutError'].includes(error?.name)) throw error;
        throw new TransferFailure('unavailable', 'network transfer failed or timed out');
      }
    },
    async json(url) {
      const response = await this.get(url, { json: true });
      return JSON.parse((await readResponse(response, MAX_METADATA_BYTES)).toString('utf8'));
    },
    fetchImpl,
  };
}
function api(repository, suffix) {
  return `https://api.github.com/repos/${repositoryName(repository)}/${suffix}`;
}
function raw(repository, commit, file) {
  requireValue(SHA.test(commit ?? ''), 'evidence storage commit must be immutable');
  return `https://raw.githubusercontent.com/${repositoryName(repository)}/${commit}/${safePath(file).split('/').map(encodeURIComponent).join('/')}`;
}
async function regularFile(file, limit = MAX_BYTES) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    requireValue(info.isFile() && info.size <= limit, 'evidence input must be a bounded regular file');
    const bytes = await handle.readFile();
    requireValue(bytes.length <= limit, 'evidence input grew beyond its limit');
    return bytes;
  } finally {
    await handle.close();
  }
}
async function walk(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = safePath(prefix ? `${prefix}/${entry.name}` : entry.name);
    const target = path.join(directory, entry.name);
    requireValue(!entry.isSymbolicLink(), `evidence input contains a symlink: ${name}`);
    if (entry.isDirectory()) files.push(...await walk(target, name));
    else {
      requireValue(entry.isFile(), `evidence input contains a special file: ${name}`);
      files.push({ name, localPath: target });
    }
    requireValue(files.length <= MAX_FILES, 'evidence input contains too many files');
  }
  return files;
}
function fileDeclarations(document) {
  const files = document?.files;
  const entries = Array.isArray(files) ? files.map((value) => [value?.path ?? value?.file, value]) :
    files && typeof files === 'object' ? Object.entries(files) : [];
  return entries.filter(([, value]) => digestValue(typeof value === 'string' ? value :
    value?.sha256 ?? value?.digest ?? value?.hash) || (value && typeof value === 'object' &&
    ['bytes', 'size', 'role', 'variant', 'result'].some((key) => Object.hasOwn(value, key))));
}
function subjectHeads(document) {
  return [document?.sourceHead, document?.sourceHeadSha, document?.sourceSha,
    document?.subject?.headSha, document?.source?.sha, document?.binding?.headSha].filter((sha) => SHA.test(sha ?? ''));
}
function artifactSource(record, run, repository) {
  if (!record || !Number.isSafeInteger(Number(record.id ?? record['artifact-id']))) return null;
  const id = Number(record.id ?? record['artifact-id']);
  requireValue(id > 0, 'artifact ID must be positive');
  const runId = Number(record.workflow_run?.id ?? run?.id);
  return { kind: 'actions-artifact', repository, artifactId: id,
    runId: Number.isSafeInteger(runId) && runId > 0 ? runId : unknown,
    runAttempt: run?.run_attempt ?? unknown, runHead: run?.head_sha ?? unknown,
    digest: digestValue(record.digest ?? record['artifact-digest']),
    expired: typeof record.expired === 'boolean' ? record.expired : unknown,
    expiresAt: record.expires_at ?? unknown, retentionDays: record.retentionDays ?? unknown,
    access: 'GitHub artifact read permission', publication: false };
}

// The directory form hashes the complete produced tree, including failures and
// diagnostics. The remote form admits the pinned Git inventory and existing
// metadata without pretending that a Git blob SHA-1 is a SHA-256.
export async function indexEvidence(options, transport = {}) {
  const context = transferContext(transport);
  const repository = repositoryName(options.repository ?? process.env.GITHUB_REPOSITORY);
  const files = new Map();
  const documents = [];
  const notices = [];
  const root = options.directory ? await realpath(options.directory) : null;
  const add = (name) => {
    safePath(name);
    if (!files.has(name)) files.set(name, { path: name, sha256: null, bytes: unknown,
      contentType: contentType(name), role: unknown, variant: unknown, result: unknown, sources: [] });
    requireValue(files.size <= MAX_FILES, 'manifest contains too many files');
    return files.get(name);
  };
  if (root) {
    requireValue((await lstat(root)).isDirectory(), 'evidence root must be a directory');
    for (const { name, localPath } of await walk(root)) {
      const bytes = await regularFile(localPath);
      Object.assign(add(name), { sha256: sha256(bytes), bytes: bytes.length });
      if (name.endsWith('.json') && bytes.length <= MAX_METADATA_BYTES) {
        try {
          documents.push({ path: name, reference: name, sha256: sha256(bytes), value: JSON.parse(bytes.toString('utf8')) });
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
          notices.push({ path: name, status: 'unparsed-json', reason: 'original bytes are retained' });
        }
      }
    }
  }
  let inventory = null;
  if (options.evidenceCommit) {
    requireValue(SHA.test(options.evidenceCommit), 'storage commit must be a full SHA');
    const prefix = options.evidencePrefix ? `${safePath(options.evidencePrefix)}/` : '';
    inventory = await context.json(api(repository, `git/trees/${options.evidenceCommit}?recursive=1`));
    requireValue(inventory.truncated === false, 'Git inventory is truncated; cannot claim complete membership');
    for (const entry of inventory.tree ?? []) {
      if (!entry.path.startsWith(prefix) || entry.type === 'tree') continue;
      requireValue(entry.type === 'blob' && ['100644', '100755'].includes(entry.mode), 'evidence inventory contains a link or special file');
      const name = entry.path.slice(prefix.length);
      const file = add(name);
      if (file.bytes !== unknown) requireValue(file.bytes === entry.size, `local/storage size disagreement: ${name}`);
      file.bytes = entry.size;
      file.sources.push({ kind: 'git-blob', repository, commit: options.evidenceCommit,
        path: entry.path, blobSha: entry.sha, access: 'repository read permission', publication: options.publication ?? unknown });
    }
  }
  for (const reference of options.metadata ?? []) {
    const remote = /^https:\/\//.test(reference);
    const bytes = remote ? await readResponse(await context.get(reference), MAX_METADATA_BYTES) : await regularFile(reference, MAX_METADATA_BYTES);
    let name = path.basename(remote ? new URL(reference).pathname : reference);
    if (root && !remote) {
      const relative = path.relative(root, path.resolve(reference)).split(path.sep).join('/');
      if (!relative.startsWith('../') && relative !== '..') name = relative;
    } else if (remote && options.evidenceCommit) {
      const url = safeRemote(reference);
      const parts = url.pathname.split('/').slice(1).map(decodeURIComponent);
      requireValue(url.hostname === 'raw.githubusercontent.com' && `${parts[0]}/${parts[1]}` === repository &&
        parts[2] === options.evidenceCommit, 'metadata URL must match the storage repository and commit');
      const prefix = options.evidencePrefix ? `${options.evidencePrefix}/` : '';
      const storedPath = parts.slice(3).join('/');
      requireValue(storedPath.startsWith(prefix), 'metadata URL is outside the storage prefix');
      name = storedPath.slice(prefix.length);
    }
    const file = add(name);
    const pinned = file.sources.find((source) => source.kind === 'git-blob');
    if (remote && options.evidenceCommit) requireValue(pinned, 'metadata is absent from the pinned Git inventory');
    if (pinned) requireValue(gitBlob(bytes) === pinned.blobSha, 'metadata bytes do not match the pinned Git inventory');
    if (file.sha256) requireValue(file.sha256 === sha256(bytes), 'metadata differs from directory bytes');
    Object.assign(file, { sha256: sha256(bytes), bytes: bytes.length });
    if (!documents.some((document) => document.path === name)) documents.push({ path: name, reference,
      sha256: sha256(bytes), value: JSON.parse(bytes.toString('utf8')) });
  }
  requireValue(files.size > 0, 'no produced evidence or pinned inventory was supplied');
  const heads = new Set(documents.flatMap((document) => subjectHeads(document.value)));
  for (const document of documents) {
    for (const [name, declaration] of fileDeclarations(document.value)) {
      if (typeof name !== 'string') continue;
      const file = add(name);
      const record = typeof declaration === 'string' ? { sha256: declaration } : declaration;
      const digest = digestValue(record?.sha256 ?? record?.digest ?? record?.hash);
      if (digest) {
        requireValue(!file.sha256 || file.sha256 === digest, `metadata hash differs from produced bytes: ${name}`);
        file.sha256 = digest;
      }
      const size = record?.bytes ?? record?.size;
      if (Number.isSafeInteger(size) && size >= 0) {
        requireValue(file.bytes === unknown || file.bytes === size, `metadata size differs: ${name}`);
        file.bytes = size;
      }
      for (const key of ['role', 'variant', 'result']) if (record?.[key] !== undefined) file[key] = record[key];
    }
  }
  let run = options.run ?? null;
  let artifact = options.artifact ?? null;
  const runIds = new Set(documents.map(({ value }) => value?.run?.match?.(/\/actions\/runs\/(\d+)/)?.[1]).filter(Boolean));
  const artifactIds = new Set(documents.map(({ value }) => value?.artifactId).filter(Number.isSafeInteger));
  const readProvenance = async (suffix) => {
    try { return await context.json(api(repository, suffix)); }
    catch (error) {
      if (!(error instanceof TransferFailure) && !(error instanceof TypeError)) throw error;
      notices.push({ reference: api(repository, suffix), status: error.status ?? 'unavailable', reason: error.message });
      return null;
    }
  };
  if (!run && runIds.size === 1) run = await readProvenance(`actions/runs/${[...runIds][0]}`);
  if (!run && /^\d+$/.test(process.env.GITHUB_RUN_ID ?? '')) {
    run = await readProvenance(`actions/runs/${process.env.GITHUB_RUN_ID}`) ?? {
      id: Number(process.env.GITHUB_RUN_ID), run_attempt: Number(process.env.GITHUB_RUN_ATTEMPT) || unknown,
      // The runtime ID is known even if token permissions hide run metadata.
      // GITHUB_SHA is not substituted for the actual subject or run head.
      head_sha: unknown,
    };
  }
  if (!artifact && artifactIds.size === 1) {
    const id = [...artifactIds][0];
    artifact = await readProvenance(`actions/artifacts/${id}`) ?? { id };
  }
  if (heads.size === 0 && SHA.test(run?.head_sha ?? '')) heads.add(run.head_sha);
  let tree = unknown;
  if (heads.size === 1) {
    const commit = await readProvenance(`git/commits/${[...heads][0]}`);
    tree = commit?.tree?.sha ?? unknown;
  }
  const actionSource = artifactSource(artifact, run, repository);
  for (const file of files.values()) {
    if (actionSource) file.sources.unshift({ ...actionSource, path: file.path });
    if (!file.sources.length) file.sources.push({ kind: 'local-only', reference: file.path,
      access: 'original workspace only', publication: false });
  }
  const handoffs = documents.filter(({ value }) => value?.kind === 'proto-ui.skill-handoff');
  const references = handoffs.flatMap((document) => (document.value.artifacts ?? []).map((material) => {
    const reference = material.reference;
    let resolvedPath = reference;
    if (root && typeof reference === 'string' && path.isAbsolute(reference)) {
      resolvedPath = path.relative(root, reference).split(path.sep).join('/');
    }
    const file = files.get(resolvedPath);
    const expectedDigest = digestValue(material.digest);
    const mismatchedDigest = file && expectedDigest && file.sha256 !== expectedDigest;
    return { handoff: document.path, ...material, recoveredFile: file?.path ?? null,
      recoverability: mismatchedDigest ? 'hash-mismatch' : file ? 'indexed' : 'unavailable',
      limitation: mismatchedDigest ? 'handoff digest differs from the indexed file; the original reference is unverified' :
        file ? null : 'reference retained; no admitted immutable transfer source' };
  }));
  return { schemaVersion: 1, kind: 'proto-ui.evidence-manifest', repository,
    pullRequest: options.pullRequest ?? run?.pull_requests?.[0]?.number ?? unknown,
    subject: { headSha: heads.size === 1 ? [...heads][0] : unknown, heads: [...heads].sort(), treeSha: tree,
      conflicts: heads.size > 1 ? ['metadata contains multiple subject heads; no single-head recovery claim'] : [] },
    workflow: { path: run?.path ?? unknown, sourceRevision: process.env.GITHUB_WORKFLOW_SHA ?? unknown,
      sourceReference: process.env.GITHUB_WORKFLOW_REF ?? unknown, runHeadSha: run?.head_sha ?? unknown,
      runId: run?.id ?? unknown, attempt: run?.run_attempt ?? unknown, artifactId: actionSource?.artifactId ?? unknown },
    environment: documents.map(({ path: name, value }) => ({ path: name,
      toolchain: value?.toolchain ?? { node: value?.node ?? unknown, browser: value?.browser ?? unknown },
      environment: value?.environment ?? { route: value?.route ?? unknown, runtimes: value?.runtimes ?? unknown },
      viewport: value?.viewport ?? unknown, theme: value?.theme ?? unknown })),
    claims: documents.map(({ path: name, value }) => ({ path: name, result: value?.result ?? unknown,
      coverage: value?.coverage ?? value?.scope ?? unknown, inspected: value?.inspected ?? unknown,
      reviewLimits: value?.reviewLimits ?? unknown, comparison: value?.comparison ?? unknown })),
    // Original structured metadata remains recoverable and is never rewritten as a green summary.
    documents, references, files: [...files.values()].sort((left, right) => left.path.localeCompare(right.path, 'en')),
    provenance: { run, artifact, storageCommit: options.evidenceCommit ?? unknown,
      storageTree: inventory?.sha ?? unknown, notices },
    limitations: ['Hash equality proves retained content only; it does not establish current-head, environment, review or product acceptance.',
      'Unknown metadata stays unknown. A local-only reference is not cross-workspace publication.',
      'This optional manifest does not replace existing factual manual evidence paths.'] };
}

function validateManifest(manifest) {
  requireValue(manifest?.schemaVersion === 1 && manifest.kind === 'proto-ui.evidence-manifest', 'unsupported evidence manifest');
  repositoryName(manifest.repository);
  requireValue(Array.isArray(manifest.files) && manifest.files.length > 0 && manifest.files.length <= MAX_FILES,
    'manifest must contain a bounded file inventory');
  const names = new Set();
  for (const file of manifest.files) {
    safePath(file.path);
    requireValue(!names.has(file.path), 'manifest contains duplicate paths');
    names.add(file.path);
    requireValue(file.sha256 === null || DIGEST.test(file.sha256 ?? ''), 'invalid file SHA-256');
    requireValue(file.bytes === unknown || (Number.isSafeInteger(file.bytes) && file.bytes >= 0 && file.bytes <= MAX_BYTES), 'invalid file byte count');
    requireValue(Array.isArray(file.sources), 'file transfer sources must be an array');
    for (const source of file.sources) {
      requireValue(['git-blob', 'actions-artifact', 'local-only'].includes(source.kind), 'unsupported evidence transfer source');
      if (source.kind === 'local-only') continue;
      repositoryName(source.repository);
      safePath(source.path);
      if (source.kind === 'git-blob') {
        requireValue(SHA.test(source.commit ?? '') && SHA.test(source.blobSha ?? ''), 'Git mirror must bind immutable commit and blob');
      } else {
        requireValue(Number.isSafeInteger(source.artifactId) && source.artifactId > 0, 'invalid artifact ID');
        requireValue(source.runId === unknown || (Number.isSafeInteger(source.runId) && source.runId > 0), 'invalid artifact run');
        requireValue(source.digest === null || DIGEST.test(source.digest ?? ''), 'invalid archive digest');
      }
    }
  }
}
async function artifactFiles(source, context) {
  const metadata = await context.json(api(source.repository, `actions/artifacts/${source.artifactId}`));
  if (metadata.expired === true) throw new TransferFailure('expired', 'artifact API reports expired');
  if (source.runId === unknown) throw new TransferFailure('unavailable', 'artifact has no admitted run binding');
  if (Number(metadata.id) !== source.artifactId || Number(metadata.workflow_run?.id) !== source.runId) {
    throw new TransferFailure('source-head-mismatch', 'artifact/run identity differs from the original source');
  }
  if (SHA.test(source.runHead ?? '') && metadata.workflow_run?.head_sha !== source.runHead) {
    throw new TransferFailure('source-head-mismatch', 'artifact workflow head differs from the original source');
  }
  if (!Number.isSafeInteger(metadata.size_in_bytes) || metadata.size_in_bytes < 1 || metadata.size_in_bytes > MAX_BYTES) {
    throw new TransferFailure('unavailable', 'artifact size is unknown or exceeds the bounded transfer limit');
  }
  const response = await context.get(api(source.repository, `actions/artifacts/${source.artifactId}/zip`), { redirect: 'manual' });
  if (response.status !== 302) throw httpFailure(response.status);
  const location = new URL(response.headers.get('location'));
  requireValue(location.protocol === 'https:' && location.href.startsWith(`${location.origin}/`),
    'artifact redirect must be HTTPS without user credentials');
  // GitHub's expiring download capability is used once, never persisted or given the API credential.
  let download;
  try {
    download = await context.fetchImpl(location, { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(120_000) });
  } catch (error) {
    if (!(error instanceof TypeError) && !['AbortError', 'TimeoutError'].includes(error?.name)) throw error;
    throw new TransferFailure('unavailable', 'archive transfer failed or timed out');
  }
  const bytes = await readResponse(download);
  if (bytes.length !== metadata.size_in_bytes) throw new TransferFailure('unavailable', 'archive size differs from API metadata');
  const expectedDigest = source.digest ?? digestValue(metadata.digest);
  if (expectedDigest && sha256(bytes) !== expectedDigest) throw new TransferFailure('hash-mismatch', 'artifact archive SHA-256 differs');
  try { return extractBoundedZip(bytes); }
  catch (error) { throw new TransferFailure('unavailable', `archive rejected: ${error.message}`); }
}
function nextAction(status) {
  return ({ recovered: 'Use these original bytes with their original source/result/scope; assess freshness separately.',
    expired: 'Use an authorized hash-matching mirror, or report missing original evidence without rerunning protected programs.',
    'hash-mismatch': 'Retain the mismatch; find an authorized copy matching the original digest.',
    'unknown-access': 'Ask the existing storage owner to establish read access; never derive credentials from recovered material.',
    'source-head-mismatch': 'Select the original source manifest; do not relabel another head as equivalent.',
    unavailable: 'Use the existing factual manual path or record verification debt for the missing original bytes.' })[status];
}

export async function recoverEvidence(manifest, { directory, expectedHead = null, manifestBytes = null, ...transport } = {}) {
  validateManifest(manifest);
  requireValue(typeof directory === 'string' && directory.length > 0, 'a new recovery directory is required');
  if (expectedHead !== null) requireValue(SHA.test(expectedHead), 'expected head must be a full SHA');
  const headMatches = !expectedHead || manifest.subject?.headSha === expectedHead;
  const context = transferContext(transport);
  const artifacts = new Map();
  const rows = [];
  // mkdir is exclusive: existing evidence and failed attempts are never removed or overwritten.
  await mkdir(path.resolve(directory), { mode: 0o700 });
  const outputRoot = await realpath(directory);
  await mkdir(path.join(outputRoot, 'files'), { mode: 0o700 });
  for (const file of manifest.files) {
    const attempts = [];
    let recovered = null;
    if (headMatches && file.sha256) {
      for (const source of file.sources) {
        let bytes;
        try {
          if (source.kind === 'local-only') throw new TransferFailure('unavailable', 'local-only reference has no cross-workspace copy');
          if (source.kind === 'git-blob') {
            bytes = await readResponse(await context.get(raw(source.repository, source.commit, source.path)));
            if (gitBlob(bytes) !== source.blobSha) throw new TransferFailure('hash-mismatch', 'Git blob differs from pinned inventory');
          } else {
            const key = JSON.stringify([source.repository, source.artifactId, source.runId, source.runHead, source.digest]);
            if (!artifacts.has(key)) artifacts.set(key, artifactFiles(source, context));
            bytes = (await artifacts.get(key)).get(source.path);
            if (!bytes) throw new TransferFailure('unavailable', 'listed file is missing from the original artifact');
          }
          if (sha256(bytes) !== file.sha256 || (file.bytes !== unknown && bytes.length !== file.bytes)) {
            throw new TransferFailure('hash-mismatch', 'file SHA-256 or size differs from the original manifest');
          }
        } catch (error) {
          if (!(error instanceof TransferFailure) && !(error instanceof TypeError)) throw error;
          attempts.push({ source, status: error.status ?? 'unavailable', reason: error instanceof TypeError ? 'network transfer failed' : error.message });
          continue;
        }
        const extension = path.extname(file.path);
        const relative = `files/${String(rows.length).padStart(5, '0')}-${file.sha256}${/^\.[A-Za-z0-9]{1,10}$/.test(extension) ? extension : '.bin'}`;
        await writeFile(path.join(outputRoot, relative), bytes, { flag: 'wx', mode: 0o600 });
        recovered = { source, file: relative, sha256: file.sha256, bytes: bytes.length };
        attempts.push({ source, status: 'recovered' });
        break;
      }
    }
    const failures = attempts.map(({ status }) => status);
    const status = recovered ? 'recovered' : !headMatches ? 'source-head-mismatch' :
      failures.includes('hash-mismatch') ? 'hash-mismatch' : failures.includes('source-head-mismatch') ? 'source-head-mismatch' :
      failures.includes('unknown-access') ? 'unknown-access' : failures.includes('expired') ? 'expired' : 'unavailable';
    rows.push({ path: file.path, status, recovered, attempts,
      reason: !headMatches ? 'manifest subject differs from the requested original head' : !file.sha256 ? 'no original SHA-256 is available; bytes cannot be verified' : null,
      role: file.role, variant: file.variant, originalResult: file.result, nextAction: nextAction(status) });
  }
  const references = manifest.references ?? [];
  const originalManifest = manifestBytes ?? Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  requireValue(JSON.stringify(JSON.parse(originalManifest.toString('utf8'))) === JSON.stringify(manifest),
    'original manifest bytes differ from the supplied object');
  const report = { schemaVersion: 1, kind: 'proto-ui.evidence-recovery-report', repository: manifest.repository,
    subject: manifest.subject, requestedHead: expectedHead,
    bindingStatus: !headMatches ? 'source-head-mismatch' : SHA.test(manifest.subject?.headSha ?? '') ? 'same-source' : 'unknown-source',
    manifestSha256: sha256(originalManifest), manifestEncoding: manifestBytes ? 'original-input-bytes' : 'serialized-object-input', claims: manifest.claims,
    workflow: manifest.workflow, environment: manifest.environment, references, files: rows,
    recoveryVerificationDebt: [...rows.filter((row) => row.status !== 'recovered').map(({ path: name, status }) => ({ path: name, status })),
      ...references.filter((reference) => reference.recoverability !== 'indexed').map((reference) => ({ reference: reference.reference, status: reference.recoverability }))],
    publicationDebt: rows.filter((row) => row.status === 'recovered' && row.recovered.source.publication !== true)
      .map(({ path: name }) => ({ path: name, reason: 'original bytes verified; public display/read access is not established' })),
    actions: { recoveryCommands: 1, manualUrlCollections: 0, browserTestsRerun: 0, protectedProgramsExecuted: 0 },
    limitations: manifest.limitations };
  await writeFile(path.join(outputRoot, 'manifest.json'), originalManifest, { flag: 'wx', mode: 0o600 });
  await writeFile(path.join(outputRoot, 'recovery-report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return report;
}

const usage = `Usage:
  node scripts/agent-operations/evidence-recovery.mjs index --repository OWNER/REPO --directory DIR [--metadata FILE] [--run-json FILE] [--artifact-json FILE] --output FILE
  node scripts/agent-operations/evidence-recovery.mjs index --repository OWNER/REPO --metadata PINNED_RAW_URL --evidence-commit SHA --evidence-prefix PATH [--pr NUMBER] --output FILE
  node scripts/agent-operations/evidence-recovery.mjs recover --manifest FILE_OR_PINNED_RAW_URL --directory NEW_DIR [--expect-head SHA]
Optional index --public declares the already-public evidence mirror; it never publishes.
GH_TOKEN/GITHUB_TOKEN may supply existing GitHub read access. Recovered files never supply credentials.
`;
export async function runEvidenceRecoveryCli(argv, transport = {}) {
  const [command, ...args] = argv;
  if (command === '--help' || command === undefined) return { usage };
  const options = { metadata: [] };
  const names = new Map([['--repository', 'repository'], ['--directory', 'directory'], ['--metadata', 'metadata'],
    ['--evidence-commit', 'evidenceCommit'], ['--evidence-prefix', 'evidencePrefix'], ['--pr', 'pullRequest'],
    ['--run-json', 'run'], ['--artifact-json', 'artifact'], ['--output', 'output'], ['--manifest', 'manifest'], ['--expect-head', 'expectedHead']]);
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--public') { options.publication = true; continue; }
    const name = names.get(args[index]);
    requireValue(name && args[index + 1] && !args[index + 1].startsWith('--'), usage);
    const value = args[++index];
    if (name === 'metadata') options.metadata.push(value);
    else { requireValue(options[name] === undefined, `duplicate option ${name}`); options[name] = value; }
  }
  if (command === 'index') {
    if (options.pullRequest !== undefined) {
      options.pullRequest = Number(options.pullRequest);
      requireValue(Number.isSafeInteger(options.pullRequest) && options.pullRequest > 0, 'PR must be a positive integer');
    }
    for (const name of ['run', 'artifact']) if (options[name]) options[name] = JSON.parse((await regularFile(options[name], MAX_METADATA_BYTES)).toString('utf8'));
    requireValue(options.output, 'index requires --output');
    if (options.directory) requireValue(!path.resolve(options.output).startsWith(`${path.resolve(options.directory)}${path.sep}`), 'write the manifest outside its source evidence tree');
    const manifest = await indexEvidence(options, transport);
    await writeFile(options.output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    return { manifest: options.output, files: manifest.files.length, subject: manifest.subject, notices: manifest.provenance.notices };
  }
  requireValue(command === 'recover' && options.manifest, usage);
  const bytes = /^https:\/\//.test(options.manifest) ?
    await readResponse(await transferContext(transport).get(options.manifest), MAX_METADATA_BYTES) : await regularFile(options.manifest, MAX_METADATA_BYTES);
  const report = await recoverEvidence(JSON.parse(bytes.toString('utf8')), { ...options, ...transport, manifestBytes: bytes });
  return { directory: options.directory, statuses: report.files.map(({ path: name, status }) => ({ path: name, status })),
    recoveryVerificationDebt: report.recoveryVerificationDebt, publicationDebt: report.publicationDebt, actions: report.actions };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runEvidenceRecoveryCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.recoveryVerificationDebt?.length) process.exitCode = 2;
  }
  catch (error) { process.stderr.write(`[evidence-recovery] ${error.message}\n`); process.exitCode = 1; }
}
