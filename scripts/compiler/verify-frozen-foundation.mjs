#!/usr/bin/env node
// Recheck the privately retained packet against the hashes published in #890.
// This verifier was written independently; it never imports or executes packet code.
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FOUNDATION_ANCHOR = Object.freeze({
  receipt: 'https://github.com/Proto-UI/Proto-UI/issues/890#issuecomment-6222828809',
  archiveSha256: '79c5b57a172b2f74efc350c50af0c1eb9bb24791828fc48175bc28411d812bda',
  archiveSize: 38379897,
  indexSha256: 'a8d8350b73c7f9c42e5a87be6078c1e3d3869930b4f967e3a1ef5fba8372617f',
  indexSize: 10005,
  manifestSha256: '35110c1036f441828f060d8fbf239965a8587a99699ead6b5689268b226adb69',
  compilerSha256: 'f2bc1ada0554d37fdf2926dc9f7d16f31fec05dd99a60cf758262215ecf00c8e',
});

class ClosureFailure extends Error {
  constructor(code) {
    // Do not propagate filesystem errors or private locators into a public receipt.
    super(code);
    this.code = code;
  }
}

function requireFact(value, code) {
  if (!value) throw new ClosureFailure(code);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function validHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function parseJson(bytes) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new ClosureFailure('INVALID_JSON');
  }
}

async function regularFile(path) {
  try {
    const stat = await lstat(path);
    requireFact(stat.isFile() && !stat.isSymbolicLink(), 'NOT_REGULAR_FILE');
    return await readFile(path);
  } catch (error) {
    if (error instanceof ClosureFailure) throw error;
    throw new ClosureFailure('FILE_UNAVAILABLE');
  }
}

async function packetFile(root, relative) {
  requireFact(
    typeof relative === 'string' &&
      relative.length > 0 &&
      !relative.includes('\\') &&
      !relative.includes('\0') &&
      !relative.includes(':') &&
      relative.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
    'UNSAFE_PACKET_PATH'
  );
  const parts = relative.split('/');
  let directory = root;
  for (const part of parts.slice(0, -1)) {
    directory = join(directory, part);
    try {
      const stat = await lstat(directory);
      requireFact(stat.isDirectory() && !stat.isSymbolicLink(), 'UNSAFE_PACKET_DIRECTORY');
    } catch (error) {
      if (error instanceof ClosureFailure) throw error;
      throw new ClosureFailure('DIRECTORY_UNAVAILABLE');
    }
  }
  return regularFile(join(root, ...parts));
}

function verifyBytes(bytes, row, code) {
  requireFact(
    Number.isSafeInteger(row.size) &&
      row.size >= 0 &&
      validHash(row.sha256) &&
      bytes.length === row.size &&
      sha256(bytes) === row.sha256,
    code
  );
}

function verifyAcyclic(nodes, edges) {
  const graph = new Map(nodes.map((node) => [node.id, []]));
  requireFact(graph.size === nodes.length, 'DUPLICATE_GRAPH_NODE');
  const pairs = new Set();
  for (const edge of edges) {
    requireFact(graph.has(edge.from) && graph.has(edge.dependsOn), 'UNKNOWN_GRAPH_NODE');
    const pair = JSON.stringify([edge.from, edge.dependsOn]);
    requireFact(!pairs.has(pair), 'DUPLICATE_GRAPH_EDGE');
    pairs.add(pair);
    graph.get(edge.from).push(edge.dependsOn);
  }
  const active = new Set();
  const done = new Set();
  function visit(id) {
    requireFact(!active.has(id), 'GRAPH_CYCLE');
    if (done.has(id)) return;
    active.add(id);
    for (const dependency of graph.get(id)) visit(dependency);
    active.delete(id);
    done.add(id);
  }
  for (const id of graph.keys()) visit(id);
}

/**
 * Structural integrity only. The caller supplies an already authenticated index.
 * This exported kernel also supports synthetic tamper controls; it cannot certify
 * that an arbitrary index identifies the historical candidate. Use the fixed-anchor
 * verifyFrozenFoundation entry point for that claim.
 */
export async function inspectContentClosure(packetRoot, index) {
  const root = resolve(packetRoot);
  const documents = new Map();
  requireFact(Array.isArray(index.artifacts), 'INVALID_ARTIFACT_INDEX');
  for (const artifact of index.artifacts) {
    requireFact(!documents.has(artifact.path), 'DUPLICATE_ARTIFACT');
    const bytes = await packetFile(root, artifact.path);
    verifyBytes(bytes, artifact, 'ARTIFACT_IDENTITY');
    documents.set(artifact.path, bytes);
  }
  function document(name) {
    requireFact(documents.has(name), 'MISSING_REQUIRED_ARTIFACT');
    return parseJson(documents.get(name));
  }
  const manifest = document('foundation-manifest-v2.json');
  const installed = document('installed-inputs-v2.json');
  const objects = document('content-object-index-v1.json');
  const debt = document('issue890-compiler-debt-v1.json');
  const evidence = document('debt-evidence-index-v1.json');
  const dag = document('dependency-dag-v1.json');
  const objectIndex = new Map();
  let objectBytes = 0;
  for (const row of objects.files) {
    requireFact(validHash(row.sha256) && !objectIndex.has(row.sha256), 'INVALID_OBJECT_INDEX');
    const bytes = await packetFile(root, `objects/sha256/${row.sha256}`);
    verifyBytes(bytes, row, 'OBJECT_IDENTITY');
    const gitOid = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    objectIndex.set(row.sha256, { size: bytes.length, gitOid });
    objectBytes += bytes.length;
  }
  const actualMembers = await readdir(join(root, 'objects/sha256'));
  requireFact(
    actualMembers.length === objectIndex.size &&
      actualMembers.every((name) => objectIndex.has(name)),
    'OBJECT_MEMBERSHIP'
  );
  requireFact(
    objectIndex.size === objects.count &&
      objectIndex.size === index.objects.count &&
      objectBytes === objects.bytes &&
      objectBytes === index.objects.bytes,
    'OBJECT_TOTALS'
  );
  function content(row) {
    const object = objectIndex.get(row.sha256);
    requireFact(object && object.size === row.size, 'CONTENT_REFERENCE');
    return object;
  }
  let gitBlobs = 0;
  function gitBlob(row) {
    requireFact(row.available === true, 'HISTORY_UNAVAILABLE');
    requireFact(content(row).gitOid === row.oid, 'GIT_IDENTITY');
    gitBlobs++;
  }
  const repositoryPaths = new Set();
  for (const row of manifest.files) {
    requireFact(!repositoryPaths.has(row.path), 'DUPLICATE_REPOSITORY_PATH');
    repositoryPaths.add(row.path);
    content(row);
    if (row.head) gitBlob(row.head);
    for (const entry of row.index) gitBlob(entry);
  }
  for (const row of manifest.deletedCompilerMembers) gitBlob(row.head);
  for (const row of installed.files) content(row);
  for (const row of manifest.sourceBank.virtualSources) content(row);
  requireFact(
    installed.unavailable.every((row) => row.optional === true),
    'REQUIRED_DEPENDENCY_MISSING'
  );
  requireFact(
    manifest.files.length === index.workingTree.totalRepositoryReadOnlyInputFiles &&
      manifest.deletedCompilerMembers.length ===
        index.workingTree.deletedHistoricalCompilerMembers &&
      installed.files.length === index.installed.files &&
      installed.packageCount === index.installed.packages &&
      installed.packages.length === installed.packageCount &&
      manifest.sourceBank.virtualSources.length === index.sourceBank.files,
    'INPUT_TOTALS'
  );
  const compilerRows = manifest.files
    .filter((row) => row.path.startsWith('packages/compiler/src/'))
    .map((row) => ({
      path: row.path.slice('packages/compiler/src/'.length),
      size: row.size,
      mode: row.mode,
      sha256: row.sha256,
    }));
  const compilerSha256 = sha256(Buffer.from(JSON.stringify(compilerRows)));
  requireFact(
    compilerRows.length === index.canonicalCompiler.files &&
      compilerSha256 === index.canonicalCompiler.sha256 &&
      compilerSha256 === manifest.canonicalCompiler.sha256 &&
      manifest.canonicalCompiler.files === compilerRows.length,
    'COMPILER_IDENTITY'
  );
  requireFact(
    manifest.sourceBank.digest === index.sourceBank.digest &&
      manifest.sourceBank.recomputedDigest === index.sourceBank.digest,
    'SOURCE_BANK_IDENTITY'
  );
  requireFact(manifest.detachedHeadIR === 5 && manifest.worktreeIR === 10, 'IR_VERSION_BOUNDARY');
  const ir = manifest.files.find((row) => row.path === 'packages/compiler/src/ir.ts');
  requireFact(ir?.head, 'IR_HISTORY_MISSING');
  const oldIR = await packetFile(root, `objects/sha256/${ir.head.sha256}`);
  const currentIR = await packetFile(root, `objects/sha256/${ir.sha256}`);
  requireFact(
    oldIR.includes('IR_VERSION = 5') && currentIR.includes('IR_VERSION = 10'),
    'IR_SOURCE_IDENTITY'
  );
  requireFact(
    debt.entries.length === 4 &&
      new Set(debt.entries.map((row) => row.id)).size === 4 &&
      debt.entries.every(
        (row) =>
          row.tracker === 'https://github.com/Proto-UI/Proto-UI/issues/890' &&
          row.accepted === false
      ),
    'ORIGINAL_DEBT_STATUS'
  );
  const evidencePaths = new Set();
  for (const row of evidence.files) {
    requireFact(!evidencePaths.has(row.retained.path), 'DUPLICATE_EVIDENCE');
    evidencePaths.add(row.retained.path);
    const bytes = await packetFile(root, row.retained.path);
    verifyBytes(bytes, row.retained, 'DEBT_EVIDENCE_IDENTITY');
    requireFact(
      row.original.sha256 === row.retained.sha256 && row.original.size === row.retained.size,
      'DEBT_EVIDENCE_ORIGIN'
    );
  }
  const condensed = dag.sourceCondensationDAG;
  verifyAcyclic(condensed.components, condensed.edges);
  const deliveryEdges = dag.deliveryDependencies.flatMap((node) =>
    node.requires.map((dependency) => ({ from: node.id, dependsOn: dependency }))
  );
  verifyAcyclic(dag.deliveryDependencies, deliveryEdges);
  requireFact(
    condensed.components.length === index.dependencyDAG.condensedComponents &&
      condensed.edges.length === index.dependencyDAG.condensedEdges &&
      dag.rawSourceGraph.nodes === index.dependencyDAG.productionNodes &&
      dag.rawSourceGraph.edges === index.dependencyDAG.actualSourceEdges &&
      dag.deliveryDependencies.length === index.dependencyDAG.deliveryNodes,
    'GRAPH_TOTALS'
  );
  requireFact(
    index.MERGE_READY === false &&
      index.sharedDefinitionApproval === false &&
      index.canonicalSSR === 'PUI4001',
    'ACCEPTANCE_BOUNDARY'
  );
  return {
    compilerSha256,
    sourceBankDigest: index.sourceBank.digest,
    counts: {
      artifacts: index.artifacts.length,
      objects: objectIndex.size,
      objectBytes,
      repositoryFiles: manifest.files.length,
      deletedCompilerMembers: manifest.deletedCompilerMembers.length,
      compilerSourceFiles: compilerRows.length,
      installedPackages: installed.packages.length,
      installedFiles: installed.files.length,
      virtualFiles: manifest.sourceBank.virtualSources.length,
      gitBlobReferences: gitBlobs,
      debtEvidenceFiles: evidencePaths.size,
      originalDebts: debt.entries.length,
      sourceNodes: dag.rawSourceGraph.nodes,
      sourceEdges: dag.rawSourceGraph.edges,
      condensedNodes: condensed.components.length,
      condensedEdges: condensed.edges.length,
      deliveryNodes: dag.deliveryDependencies.length,
    },
  };
}

export async function verifyFrozenFoundation(packetRoot, { archivePath } = {}) {
  const report = {
    kind: 'proto-ui.frozen-foundation-integrity',
    format: 1,
    anchor: FOUNDATION_ANCHOR,
    passed: false,
    archiveChecked: false,
    sourceExecuted: false,
    originalCompilerReplay: false,
    definitionApproval: false,
    originalAuthorRightsCertified: false,
    migrationExecuted: false,
    MERGE_READY: false,
  };
  try {
    const root = resolve(packetRoot);
    const stat = await lstat(root);
    requireFact(stat.isDirectory() && !stat.isSymbolicLink(), 'UNSAFE_PACKET_ROOT');
    if (archivePath !== undefined) {
      const archive = await regularFile(resolve(archivePath));
      verifyBytes(
        archive,
        { size: FOUNDATION_ANCHOR.archiveSize, sha256: FOUNDATION_ANCHOR.archiveSha256 },
        'ARCHIVE_ANCHOR'
      );
      report.archiveChecked = true;
    }
    const bytes = await packetFile(root, 'closure-index-v1.json');
    verifyBytes(
      bytes,
      { size: FOUNDATION_ANCHOR.indexSize, sha256: FOUNDATION_ANCHOR.indexSha256 },
      'INDEX_ANCHOR'
    );
    const index = parseJson(bytes);
    const manifest = index.artifacts.find((row) => row.path === 'foundation-manifest-v2.json');
    requireFact(manifest?.sha256 === FOUNDATION_ANCHOR.manifestSha256, 'MANIFEST_ANCHOR');
    requireFact(
      index.canonicalCompiler.sha256 === FOUNDATION_ANCHOR.compilerSha256,
      'COMPILER_ANCHOR'
    );
    Object.assign(report, await inspectContentClosure(root, index), { passed: true });
  } catch (error) {
    report.failure = error instanceof ClosureFailure ? error.code : 'INVALID_OR_UNAVAILABLE_PACKET';
  }
  return report;
}

async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    process.stdout.write(
      'Usage: node scripts/compiler/verify-frozen-foundation.mjs --packet PRIVATE_PACKET [--archive PRIVATE_ARCHIVE]\n' +
        'Reads and hashes retained bytes; does not execute source, extract the archive, or certify acceptance.\n'
    );
    return;
  }
  if (
    (args.length !== 2 && args.length !== 4) ||
    args[0] !== '--packet' ||
    (args.length === 4 && args[2] !== '--archive')
  ) {
    process.stderr.write('Expected --packet PATH and optional --archive PATH; use --help.\n');
    process.exitCode = 2;
    return;
  }
  const report = await verifyFrozenFoundation(args[1], { archivePath: args[3] });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.passed ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
