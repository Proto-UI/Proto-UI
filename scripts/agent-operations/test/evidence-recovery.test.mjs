import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { indexEvidence, recoverEvidence, runEvidenceRecoveryCli } from '../evidence-recovery.mjs';

// Every transfer below is an injected simulation. These cases make no claim
// about expiry, access, execution or inspection of a real GitHub artifact.
const head = '1'.repeat(40);
const otherHead = '2'.repeat(40);
const commit = '3'.repeat(40);
const repository = 'Proto-UI/Proto-UI';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBlob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
async function workspace(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'pui-e841-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
function gitSource(name, bytes, extra = {}) {
  return { kind: 'git-blob', repository, commit, path: `evidence/simulation/${name}`,
    blobSha: gitBlob(bytes), publication: true, ...extra };
}
function artifactSource(extra = {}) {
  return { kind: 'actions-artifact', repository, artifactId: 7, runId: 42, runAttempt: 1,
    runHead: head, digest: null, expired: 'unknown', expiresAt: 'unknown',
    access: 'existing read permission', publication: false, path: 'capture.png', ...extra };
}
function manifestFor(entries) {
  return { schemaVersion: 1, kind: 'proto-ui.evidence-manifest', repository, pullRequest: 841,
    subject: { headSha: head, heads: [head], treeSha: '4'.repeat(40), conflicts: [] },
    workflow: { runId: 42, attempt: 1 }, environment: [{ browser: 'simulation' }],
    claims: [{ result: 'failed', coverage: 'one source case only', inspected: ['capture.png'],
      reviewLimits: 'no packed/AT/native conclusion' }], references: [],
    files: entries.map(({ name = 'capture.png', bytes = Buffer.from('original failed capture'), sources, ...extra }) => ({
      path: name, sha256: sha256(bytes), bytes: bytes.length, contentType: 'image/png',
      role: 'candidate', variant: 'source', result: 'failed', sources: sources ?? [gitSource(name, bytes)], ...extra,
    })), limitations: ['simulation; content equality does not establish new-head acceptance'] };
}
function fetchSimulation(routes) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const value = String(url);
    calls.push({ url: value, options });
    if (typeof routes === 'function') return routes(value, options);
    const result = routes.get(value);
    return typeof result === 'function' ? result() : result?.clone() ?? new Response('', { status: 404 });
  };
  return { calls, fetchImpl };
}
function rawURL(source) {
  return `https://raw.githubusercontent.com/${source.repository}/${source.commit}/${source.path}`;
}
function storedZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, bytes] of entries) {
    const encoded = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(encoded.length, 26);
    locals.push(local, encoded, bytes);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(encoded.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, encoded);
    offset += local.length + encoded.length + bytes.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
}

test('index preserves every produced failure/partial/not-run file and complete handoff references', async (t) => {
  const root = await workspace(t);
  const input = path.join(root, 'produced');
  await mkdir(input);
  const report = { sourceHead: head, result: 'failed', toolchain: { node: 'simulation' },
    coverage: ['one checked screenshot'], inspected: ['source.png'], reviewLimits: 'packed and AT unreviewed',
    files: { 'source.png': { sha256: sha256(Buffer.from('source')), role: 'candidate', variant: 'source', result: 'failed' },
      'packed.png': { sha256: sha256(Buffer.from('packed')), role: 'baseline', variant: 'packed', result: 'partial' } } };
  const handoff = { schemaVersion: 2, kind: 'proto-ui.skill-handoff', binding: { headSha: head }, artifacts: [
    { type: 'evidence-report', reference: 'metadata.json', result: 'failed', digest: 'sha256:' + sha256(Buffer.from(JSON.stringify(report))) },
    { type: 'evidence-report', reference: '/lost/original/not-run.json', result: 'not-run', revision: otherHead },
    { type: 'evidence-report', reference: 'source.png', result: 'failed', digest: 'sha256:' + sha256(Buffer.from('different original reference')) },
  ] };
  for (const [name, bytes] of Object.entries({ 'metadata.json': JSON.stringify(report), 'handoff.json': JSON.stringify(handoff),
    'source.png': 'source', 'packed.png': 'packed', 'failure.json': '{unparsed diagnostic' })) await writeFile(path.join(input, name), bytes);
  const transfer = fetchSimulation(new Map([[`https://api.github.com/repos/${repository}/git/commits/${head}`, json({ tree: { sha: '5'.repeat(40) } })]]));
  const manifest = await indexEvidence({ repository, directory: input }, transfer);
  assert.deepEqual(manifest.files.map((file) => file.path), ['failure.json', 'handoff.json', 'metadata.json', 'packed.png', 'source.png']);
  assert.equal(manifest.files.find((file) => file.path === 'packed.png').variant, 'packed');
  assert.equal(manifest.files.find((file) => file.path === 'source.png').result, 'failed');
  assert.deepEqual(manifest.documents.find((document) => document.path === 'metadata.json').value, report);
  assert.equal(manifest.references[1].result, 'not-run');
  assert.equal(manifest.references[1].revision, otherHead);
  assert.equal(manifest.references[2].recoverability, 'hash-mismatch');
  const recovered = await recoverEvidence(manifest, { directory: path.join(root, 'fresh'), ...transfer });
  assert.ok(recovered.files.every((file) => file.status === 'unavailable'));
  assert.equal(recovered.publicationDebt.length, 0);
  assert.ok(recovered.recoveryVerificationDebt.some((item) => item.reference === '/lost/original/not-run.json'));
  assert.ok(recovered.recoveryVerificationDebt.some((item) => item.reference === 'source.png' && item.status === 'hash-mismatch'));
});

test('remote index joins an immutable Git inventory with original hashes, sizes, source identity and unknowns', async (t) => {
  const root = await workspace(t);
  const capture = Buffer.from('simulation original image');
  const metadata = { sourceHead: head, run: `https://github.com/${repository}/actions/runs/42`, artifactId: 7,
    result: 'partial', inspected: ['source.png'], files: { 'source.png': sha256(capture) } };
  const metadataBytes = Buffer.from(JSON.stringify(metadata));
  const prefix = 'evidence/simulation';
  const metadataURL = `https://raw.githubusercontent.com/${repository}/${commit}/${prefix}/metadata.json`;
  const routes = new Map([
    [metadataURL, new Response(metadataBytes)],
    [`https://api.github.com/repos/${repository}/git/trees/${commit}?recursive=1`, json({ sha: '6'.repeat(40), truncated: false,
      tree: [['source.png', capture], ['metadata.json', metadataBytes]].map(([name, bytes]) => ({
        path: `${prefix}/${name}`, type: 'blob', mode: '100644', size: bytes.length, sha: gitBlob(bytes),
      })) })],
    [`https://api.github.com/repos/${repository}/actions/runs/42`, json({ id: 42, head_sha: head, run_attempt: 2, path: '.github/workflows/simulation.yml' })],
    [`https://api.github.com/repos/${repository}/git/commits/${head}`, json({ tree: { sha: '7'.repeat(40) } })],
  ]);
  const transfer = fetchSimulation(routes);
  const manifest = await indexEvidence({ repository, metadata: [metadataURL], evidenceCommit: commit,
    evidencePrefix: prefix, pullRequest: 841, publication: true }, transfer);
  assert.equal(manifest.subject.headSha, head);
  assert.equal(manifest.workflow.attempt, 2);
  assert.deepEqual(manifest.environment[0].toolchain, { node: 'unknown', browser: 'unknown' });
  assert.equal(manifest.files.find((file) => file.path === 'source.png').sha256, sha256(capture));
  assert.ok(manifest.provenance.notices.some((notice) => notice.status === 'unavailable' && notice.reason === 'HTTP 404'));
  routes.set(rawURL(manifest.files.find((file) => file.path === 'source.png').sources[1]), new Response(capture));
  const recovered = await recoverEvidence(manifest, { directory: path.join(root, 'fresh'), expectedHead: head, ...transfer });
  assert.deepEqual(recovered.files.map((file) => file.status), ['recovered', 'recovered']);
  assert.deepEqual(recovered.actions, { recoveryCommands: 1, manualUrlCollections: 0, browserTestsRerun: 0, protectedProgramsExecuted: 0 });
  for (const file of recovered.files) assert.equal(sha256(await readFile(path.join(root, 'fresh', file.recovered.file))), file.recovered.sha256);
  assert.equal(recovered.claims[0].result, 'partial');
  assert.equal(recovered.publicationDebt.length, 0);
});

test('an expired primary uses a matching mirror without rewriting the original failure or review limit', async (t) => {
  const root = await workspace(t);
  const bytes = Buffer.from('failure capture');
  const mirror = gitSource('capture.png', bytes);
  const manifest = manifestFor([{ bytes, sources: [artifactSource(), mirror] }]);
  const transfer = fetchSimulation(new Map([
    [`https://api.github.com/repos/${repository}/actions/artifacts/7`, json({ id: 7, expired: true })],
    [rawURL(mirror), new Response(bytes)],
  ]));
  const report = await recoverEvidence(manifest, { directory: path.join(root, 'fresh'), ...transfer });
  assert.deepEqual(report.files[0].attempts.map((attempt) => attempt.status), ['expired', 'recovered']);
  assert.equal(report.files[0].status, 'recovered');
  assert.equal(report.claims[0].result, 'failed');
  assert.equal(report.claims[0].reviewLimits, 'no packed/AT/native conclusion');
  assert.equal(report.recoveryVerificationDebt.length, 0);
});

for (const [scenario, response, expected] of [
  ['expired without mirror', json({ id: 7, expired: true }), 'expired'],
  ['missing original artifact', new Response('', { status: 404 }), 'unavailable'],
  ['access refused', new Response('', { status: 403 }), 'unknown-access'],
  ['artifact run changed', json({ id: 7, expired: false, workflow_run: { id: 43, head_sha: otherHead } }), 'source-head-mismatch'],
]) {
  test(`simulation: ${scenario} has a distinct honest recovery outcome`, async (t) => {
    const root = await workspace(t);
    const transfer = fetchSimulation(new Map([[`https://api.github.com/repos/${repository}/actions/artifacts/7`, response]]));
    const report = await recoverEvidence(manifestFor([{ sources: [artifactSource()] }]), { directory: path.join(root, 'fresh'), ...transfer });
    assert.equal(report.files[0].status, expected);
    assert.equal(report.recoveryVerificationDebt[0].status, expected);
    assert.equal(report.publicationDebt.length, 0);
    assert.deepEqual(await readdir(path.join(root, 'fresh', 'files')), []);
  });
}

test('simulation: a partial screenshot mirror retains one recovered file and one missing-file debt', async (t) => {
  const root = await workspace(t);
  const first = Buffer.from('checked first screenshot');
  const second = Buffer.from('unchecked second screenshot');
  const manifest = manifestFor([{ name: 'first.png', bytes: first }, { name: 'second.png', bytes: second, result: 'not-run' }]);
  const transfer = fetchSimulation(new Map([[rawURL(manifest.files[0].sources[0]), new Response(first)]]));
  const report = await recoverEvidence(manifest, { directory: path.join(root, 'fresh'), ...transfer });
  assert.deepEqual(report.files.map((file) => file.status), ['recovered', 'unavailable']);
  assert.equal(report.files[1].originalResult, 'not-run');
  assert.equal(report.recoveryVerificationDebt.length, 1);
});

test('simulation: hash mismatch never materializes replacement bytes', async (t) => {
  const root = await workspace(t);
  const manifest = manifestFor([{}]);
  const transfer = fetchSimulation(new Map([[rawURL(manifest.files[0].sources[0]), new Response('different image')]]));
  const report = await recoverEvidence(manifest, { directory: path.join(root, 'fresh'), ...transfer });
  assert.equal(report.files[0].status, 'hash-mismatch');
  assert.deepEqual(await readdir(path.join(root, 'fresh', 'files')), []);
});

test('simulation: a different requested head refuses transfer rather than borrowing an old pass', async (t) => {
  const root = await workspace(t);
  const transfer = fetchSimulation(() => { throw new Error('unexpected network transfer'); });
  const report = await recoverEvidence(manifestFor([{}]), { directory: path.join(root, 'fresh'), expectedHead: otherHead, ...transfer });
  assert.equal(report.bindingStatus, 'source-head-mismatch');
  assert.equal(report.files[0].status, 'source-head-mismatch');
  assert.equal(transfer.calls.length, 0);
});

test('original artifact is downloaded once; only listed matching files are copied; signed URLs receive no credential', async (t) => {
  const root = await workspace(t);
  const image = Buffer.from('simulation image');
  const script = Buffer.from('throw new Error("must never execute")');
  const zip = storedZip([['capture.png', image], ['report.js', script], ['unlisted.txt', Buffer.from('not indexed')]]);
  const manifest = manifestFor([{ bytes: image, sources: [artifactSource({ digest: sha256(zip) })] },
    { name: 'report.js', bytes: script, contentType: 'text/javascript', sources: [artifactSource({ path: 'report.js', digest: sha256(zip) })] }]);
  const transfer = fetchSimulation((url) => {
    if (url.endsWith('/artifacts/7')) return json({ id: 7, expired: false, size_in_bytes: zip.length, workflow_run: { id: 42, head_sha: head } });
    if (url.endsWith('/artifacts/7/zip')) return new Response(null, { status: 302, headers: { location: 'https://storage.example.test/original?signature=simulation' } });
    if (url.startsWith('https://storage.example.test/')) return new Response(zip);
    throw new Error('unexpected request');
  });
  const report = await recoverEvidence(manifest, { directory: path.join(root, 'fresh'), token: 'simulation-read-token', ...transfer });
  assert.ok(report.files.every((file) => file.status === 'recovered'));
  assert.equal(transfer.calls.filter((call) => call.url.includes('/artifacts/7/zip')).length, 1);
  assert.ok(transfer.calls.filter((call) => call.url.startsWith('https://api.github.com/')).every((call) => call.options.headers.Authorization === 'Bearer simulation-read-token'));
  assert.equal(transfer.calls.find((call) => call.url.startsWith('https://storage.example.test/')).options.headers, undefined);
  assert.equal(JSON.stringify(report).includes('signature=simulation'), false);
  assert.equal(JSON.stringify(report).includes('simulation-read-token'), false);
  assert.equal((await stat(path.join(root, 'fresh', report.files[1].recovered.file))).mode & 0o777, 0o600);
  assert.equal(report.publicationDebt.length, 2);
  assert.equal((await readdir(path.join(root, 'fresh', 'files'))).length, 2);
});

test('unknown original digest is verification debt even when a URL is available', async (t) => {
  const root = await workspace(t);
  const transfer = fetchSimulation(() => { throw new Error('unverifiable bytes must not be downloaded'); });
  const report = await recoverEvidence(manifestFor([{ sha256: null }]), { directory: path.join(root, 'fresh'), ...transfer });
  assert.equal(report.files[0].status, 'unavailable');
  assert.match(report.files[0].reason, /no original SHA-256/);
  assert.equal(transfer.calls.length, 0);
});

test('existing recovery directories and symlinks are preserved, never cleared', async (t) => {
  const root = await workspace(t);
  const existing = path.join(root, 'existing');
  await mkdir(existing);
  await writeFile(path.join(existing, 'original'), 'retained prior attempt');
  await assert.rejects(recoverEvidence(manifestFor([{}]), { directory: existing }), { code: 'EEXIST' });
  assert.equal(await readFile(path.join(existing, 'original'), 'utf8'), 'retained prior attempt');
  const linked = path.join(root, 'linked');
  await symlink(existing, linked);
  await assert.rejects(recoverEvidence(manifestFor([{}]), { directory: linked }), { code: 'EEXIST' });
});

test('unsafe paths and mutable storage identities are rejected before output creation', async (t) => {
  const root = await workspace(t);
  for (const invalid of ['../outside.png', '/outside.png', 'a\\b.png', 'a//b.png']) {
    await assert.rejects(recoverEvidence(manifestFor([{ name: invalid }]), { directory: path.join(root, 'fresh') }), /relative regular-file path/);
  }
  const manifest = manifestFor([{}]);
  manifest.files[0].sources[0].commit = 'main';
  await assert.rejects(recoverEvidence(manifest, { directory: path.join(root, 'fresh') }), /immutable commit and blob/);
  assert.deepEqual(await readdir(root), []);
});

test('CLI index is optional, exclusive and keeps original produced evidence unchanged', async (t) => {
  const root = await workspace(t);
  const input = path.join(root, 'produced');
  await mkdir(input);
  await writeFile(path.join(input, 'failure.txt'), 'original failure');
  const output = path.join(root, 'manifest.json');
  const transfer = fetchSimulation(new Map());
  const result = await runEvidenceRecoveryCli(['index', '--repository', repository, '--directory', input, '--output', output], transfer);
  assert.equal(result.files, 1);
  await assert.rejects(runEvidenceRecoveryCli(['index', '--repository', repository, '--directory', input, '--output', output], transfer), { code: 'EEXIST' });
  assert.equal(await readFile(path.join(input, 'failure.txt'), 'utf8'), 'original failure');
  assert.equal(JSON.parse(await readFile(output, 'utf8')).files[0].sources[0].kind, 'local-only');
});

test('CLI recovery retains the exact original manifest bytes and source hash', async (t) => {
  const root = await workspace(t);
  const bytes = Buffer.from('original simulated report');
  const manifest = manifestFor([{ bytes }]);
  const original = Buffer.from(JSON.stringify(manifest, null, 4) + '\n\n');
  const input = path.join(root, 'original-manifest.json');
  await writeFile(input, original);
  const transfer = fetchSimulation(new Map([[rawURL(manifest.files[0].sources[0]), new Response(bytes)]]));
  await runEvidenceRecoveryCli(['recover', '--manifest', input, '--directory', path.join(root, 'fresh'), '--expect-head', head], transfer);
  assert.deepEqual(await readFile(path.join(root, 'fresh', 'manifest.json')), original);
  const report = JSON.parse(await readFile(path.join(root, 'fresh', 'recovery-report.json'), 'utf8'));
  assert.equal(report.manifestSha256, sha256(original));
  assert.equal(report.manifestEncoding, 'original-input-bytes');
  assert.equal(report.claims[0].result, 'failed');
});
