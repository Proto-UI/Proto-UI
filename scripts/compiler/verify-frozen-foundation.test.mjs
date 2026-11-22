import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { inspectContentClosure, verifyFrozenFoundation } from './verify-frozen-foundation.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const script = fileURLToPath(new URL('./verify-frozen-foundation.mjs', import.meta.url));

// These deliberately small, newly authored inputs test the verifier's boundaries.
// They are not copies of the original candidate and cannot satisfy its fixed anchor.
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'pui-foundation-control-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'objects/sha256'), { recursive: true });
  await mkdir(join(root, 'debt-evidence'));
  const objects = [];
  async function object(text) {
    const bytes = Buffer.from(text);
    const row = { sha256: hash(bytes), size: bytes.length };
    objects.push(row);
    await writeFile(join(root, 'objects/sha256', row.sha256), bytes);
    return row;
  }
  const old = await object('export const IR_VERSION = 5;\n');
  const current = await object(
    'export const IR_VERSION = 10;\nthrow new Error("source must stay inert");\n'
  );
  const oldBytes = await readFile(join(root, 'objects/sha256', old.sha256));
  const head = {
    ...old,
    available: true,
    oid: createHash('sha1').update(`blob ${oldBytes.length}\0`).update(oldBytes).digest('hex'),
  };
  const compilerRows = [{ path: 'ir.ts', size: current.size, mode: 420, sha256: current.sha256 }];
  const canonicalCompiler = { files: 1, sha256: hash(JSON.stringify(compilerRows)) };
  const manifest = {
    files: [{ ...current, path: 'packages/compiler/src/ir.ts', mode: 420, head, index: [head] }],
    deletedCompilerMembers: [],
    sourceBank: {
      digest: 'synthetic-bank',
      recomputedDigest: 'synthetic-bank',
      virtualSources: [current],
    },
    canonicalCompiler,
    detachedHeadIR: 5,
    worktreeIR: 10,
  };
  const index = {
    artifacts: [],
    objects: { count: 2, bytes: objects.reduce((n, row) => n + row.size, 0) },
    workingTree: { totalRepositoryReadOnlyInputFiles: 1, deletedHistoricalCompilerMembers: 0 },
    installed: { files: 1, packages: 1 },
    sourceBank: { files: 1, digest: 'synthetic-bank' },
    canonicalCompiler,
    dependencyDAG: {
      condensedComponents: 2,
      condensedEdges: 1,
      productionNodes: 2,
      actualSourceEdges: 1,
      deliveryNodes: 2,
    },
    MERGE_READY: false,
    sharedDefinitionApproval: false,
    canonicalSSR: 'PUI4001',
  };
  async function artifact(name, value) {
    const bytes = Buffer.from(JSON.stringify(value));
    await writeFile(join(root, name), bytes);
    const row = { path: name, size: bytes.length, sha256: hash(bytes) };
    const previous = index.artifacts.findIndex((entry) => entry.path === name);
    if (previous === -1) index.artifacts.push(row);
    else index.artifacts[previous] = row;
  }
  await artifact('foundation-manifest-v2.json', manifest);
  await artifact('installed-inputs-v2.json', {
    files: [current],
    packages: [{ name: 'synthetic' }],
    packageCount: 1,
    unavailable: [{ optional: true }],
  });
  await artifact('content-object-index-v1.json', { files: objects, ...index.objects });
  await artifact('issue890-compiler-debt-v1.json', {
    entries: [1, 2, 3, 4].map((id) => ({
      id,
      tracker: 'https://github.com/Proto-UI/Proto-UI/issues/890',
      accepted: false,
    })),
  });
  const evidence = Buffer.from('synthetic historical failure remains a failure\n');
  await writeFile(join(root, 'debt-evidence/result.txt'), evidence);
  const evidenceRow = {
    path: 'debt-evidence/result.txt',
    size: evidence.length,
    sha256: hash(evidence),
  };
  await artifact('debt-evidence-index-v1.json', {
    files: [{ original: evidenceRow, retained: evidenceRow }],
  });
  const dag = {
    rawSourceGraph: { nodes: 2, edges: 1 },
    sourceCondensationDAG: {
      components: [{ id: 0 }, { id: 1 }],
      edges: [{ from: 1, dependsOn: 0 }],
    },
    deliveryDependencies: [
      { id: 'source', requires: [] },
      { id: 'consumer', requires: ['source'] },
    ],
  };
  await artifact('dependency-dag-v1.json', dag);
  return { root, index, current, manifest, dag, artifact };
}

async function snapshot(root, relative = '') {
  const entries = await readdir(join(root, relative), { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(relative, entry.name);
    if (entry.isDirectory()) result.push(...(await snapshot(root, path)));
    else result.push([path, hash(await readFile(join(root, path)))]);
  }
  return result.sort(([a], [b]) => a.localeCompare(b));
}

test('complete synthetic closure is read without changing or executing source', async (t) => {
  const f = await fixture(t);
  const before = await snapshot(f.root);
  const result = await inspectContentClosure(f.root, f.index);
  assert.equal(result.counts.objects, 2);
  assert.equal(result.counts.gitBlobReferences, 2);
  assert.equal(result.counts.debtEvidenceFiles, 1);
  assert.equal(result.counts.deliveryNodes, 2);
  assert.deepEqual(await snapshot(f.root), before);
});

test('same-length object tampering fails the content hash', async (t) => {
  const f = await fixture(t);
  const path = join(f.root, 'objects/sha256', f.current.sha256);
  const bytes = await readFile(path);
  bytes[0] ^= 1;
  await writeFile(path, bytes);
  await assert.rejects(inspectContentClosure(f.root, f.index), { code: 'OBJECT_IDENTITY' });
});

test('missing and additional objects are independently rejected', async (t) => {
  const missing = await fixture(t);
  await rm(join(missing.root, 'objects/sha256', missing.current.sha256));
  await assert.rejects(inspectContentClosure(missing.root, missing.index), {
    code: 'FILE_UNAVAILABLE',
  });
  const extra = await fixture(t);
  const bytes = Buffer.from('extra');
  await writeFile(join(extra.root, 'objects/sha256', hash(bytes)), bytes);
  await assert.rejects(inspectContentClosure(extra.root, extra.index), {
    code: 'OBJECT_MEMBERSHIP',
  });
});

test('symlink and traversal paths cannot read outside the packet', async (t) => {
  const f = await fixture(t);
  const path = join(f.root, 'objects/sha256', f.current.sha256);
  const outside = join(f.root, 'private-source.ts');
  await writeFile(outside, await readFile(path));
  await rm(path);
  await symlink(outside, path);
  await assert.rejects(inspectContentClosure(f.root, f.index), { code: 'NOT_REGULAR_FILE' });
  const traversal = await fixture(t);
  traversal.index.artifacts[0].path = '../private-source.ts';
  await assert.rejects(inspectContentClosure(traversal.root, traversal.index), {
    code: 'UNSAFE_PACKET_PATH',
  });
});

test('Git identity and reference size remain checked after metadata rehashing', async (t) => {
  const f = await fixture(t);
  f.manifest.files[0].head.oid = '0'.repeat(40);
  await f.artifact('foundation-manifest-v2.json', f.manifest);
  await assert.rejects(inspectContentClosure(f.root, f.index), { code: 'GIT_IDENTITY' });
  const size = await fixture(t);
  size.manifest.files[0].size++;
  await size.artifact('foundation-manifest-v2.json', size.manifest);
  await assert.rejects(inspectContentClosure(size.root, size.index), { code: 'CONTENT_REFERENCE' });
});

test('graph cycles and absent dependencies fail after metadata rehashing', async (t) => {
  const f = await fixture(t);
  f.dag.sourceCondensationDAG.edges.push({ from: 0, dependsOn: 1 });
  await f.artifact('dependency-dag-v1.json', f.dag);
  await assert.rejects(inspectContentClosure(f.root, f.index), { code: 'GRAPH_CYCLE' });
  const missing = await fixture(t);
  missing.dag.deliveryDependencies[1].requires.push('absent');
  await missing.artifact('dependency-dag-v1.json', missing.dag);
  await assert.rejects(inspectContentClosure(missing.root, missing.index), {
    code: 'UNKNOWN_GRAPH_NODE',
  });
});

test('changed failure evidence and invented acceptance are rejected', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.root, 'debt-evidence/result.txt'), 'all tests passed');
  await assert.rejects(inspectContentClosure(f.root, f.index), { code: 'DEBT_EVIDENCE_IDENTITY' });
  const accepted = await fixture(t);
  accepted.index.MERGE_READY = true;
  await assert.rejects(inspectContentClosure(accepted.root, accepted.index), {
    code: 'ACCEPTANCE_BOUNDARY',
  });
});

test('fixed entry point rejects a self-consistent substitute and hides private paths', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.root, 'closure-index-v1.json'), JSON.stringify(f.index));
  const report = await verifyFrozenFoundation(f.root);
  assert.equal(report.passed, false);
  assert.equal(report.failure, 'INDEX_ANCHOR');
  assert.equal(report.originalCompilerReplay, false);
  assert.equal(report.originalAuthorRightsCertified, false);
  const cli = spawnSync(process.execPath, [script, '--packet', f.root], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.equal(JSON.parse(cli.stdout).failure, 'INDEX_ANCHOR');
  assert.equal(cli.stdout.includes(f.root), false);
  assert.equal(cli.stderr, '');
});
