import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(process.argv[3] ?? process.cwd());
const label = process.argv[2];
if (!/^(baseline|candidate)$/.test(label ?? '')) throw new Error('Expected baseline or candidate');
const sourceBaseline = process.env.PROTO_UI_HEADER_BASELINE ?? process.argv[4] ?? null;
if (sourceBaseline !== null && !/^[a-f0-9]{40}$/.test(sourceBaseline))
  throw new Error('PROTO_UI_HEADER_BASELINE or the fourth argument must be an exact commit SHA');
const { collectWebsiteProductionBundleIssues } = await import(pathToFileURL(path.join(root,
  'scripts/coverage-matrices/check-website-production-bundle.mjs')));
const raw = fs.readFileSync(path.join(root, 'apps/www/dist/proto-ui-bundle-graph.json'));
const graph = JSON.parse(raw);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const facade = 'apps/www/src/components/override/Header.astro?astro&type=script&index=0&lang.ts';
const scene = 'packages/adapters/base/src/material/shader-scene-host.ts';
const header = graph.chunks.find((chunk) => chunk.facadeModuleId === facade);
if (!header) throw new Error('Actual Header entry is missing');
const chunks = new Map(graph.chunks.map((chunk) => [chunk.fileName, chunk]));
const pending = [header.fileName];
const eager = new Set();
while (pending.length) {
  const file = pending.pop();
  if (eager.has(file) || !chunks.has(file)) continue;
  eager.add(file);
  pending.push(...chunks.get(file).imports);
}
const records = new Map(graph.modules.map((record) => [record.id, record]));
const sourcePending = [facade];
const previousSource = new Map([[facade, null]]);
let sourcePath = null;
for (let index = 0; index < sourcePending.length; index++) {
  const node = sourcePending[index];
  if (node === scene) {
    sourcePath = [];
    for (let current = scene; current !== null; current = previousSource.get(current))
      sourcePath.unshift(current);
    break;
  }
  for (const next of records.get(node)?.imports ?? []) if (!previousSource.has(next)) {
    previousSource.set(next, node);
    sourcePending.push(next);
  }
}
const eagerChunks = [...eager].sort().map((file) => {
  const chunk = chunks.get(file);
  const bytes = fs.readFileSync(path.join(root, 'apps/www/dist', file));
  return {
    fileName: file,
    bytes: bytes.length,
    sha256: digest(bytes),
    sceneModuleRecord: chunk.moduleRenderInfo?.[scene] ?? null,
    sceneModuleListed: chunk.moduleIds.includes(scene),
    sceneSpecificImplementationStringPresent: bytes.includes('shader-scene-invalid-pixels'),
  };
});

// Compare static strongly connected components independently of hashed output
// filenames. Exact facades or unique names identify chunks; ambiguous names use
// a module-set digest. Source-set changes remain separately visible for review.
const nameCounts = new Map();
for (const chunk of graph.chunks) nameCounts.set(chunk.name, (nameCounts.get(chunk.name) ?? 0) + 1);
const identity = (chunk) => chunk.facadeModuleId
  ? `facade:${chunk.facadeModuleId}`
  : nameCounts.get(chunk.name) === 1
    ? `name:${chunk.name}`
    : `sources:${digest([...chunk.moduleIds].sort().join('\n'))}`;
const nodeIndexes = new Map(), lowLinks = new Map(), onStack = new Set(), stack = [];
let nextIndex = 0;
const components = [];
function visit(file) {
  nodeIndexes.set(file, nextIndex);
  lowLinks.set(file, nextIndex++);
  stack.push(file);
  onStack.add(file);
  for (const target of chunks.get(file).imports) {
    if (!chunks.has(target)) continue;
    if (!nodeIndexes.has(target)) {
      visit(target);
      lowLinks.set(file, Math.min(lowLinks.get(file), lowLinks.get(target)));
    } else if (onStack.has(target))
      lowLinks.set(file, Math.min(lowLinks.get(file), nodeIndexes.get(target)));
  }
  if (lowLinks.get(file) === nodeIndexes.get(file)) {
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== file);
    if (component.length > 1 || chunks.get(file).imports.includes(file)) components.push(component);
  }
}
for (const file of chunks.keys()) if (!nodeIndexes.has(file)) visit(file);
const staticChunkCycles = components.map((files) => {
  const members = files.map((file) => chunks.get(file));
  const identities = members.map(identity).sort();
  const retainedSources = [...new Set(members.flatMap((chunk) => chunk.moduleIds.filter((id) =>
    typeof chunk.moduleRenderInfo?.[id]?.renderedLength !== 'number' ||
      chunk.moduleRenderInfo[id].renderedLength > 0)))].sort();
  return {
    signature: digest(identities.join('\n')),
    identities,
    retainedSourceDigest: digest(retainedSources.join('\n')),
    retainedSourceCount: retainedSources.length,
    reachableFromHeader: files.some((file) => eager.has(file)),
    members: members.map((chunk) => ({
      fileName: chunk.fileName, name: chunk.name, facadeModuleId: chunk.facadeModuleId,
      importsWithinCycle: chunk.imports.filter((file) => files.includes(file)),
    })),
  };
}).sort((left, right) => left.signature.localeCompare(right.signature));
const retainedOwners = new Map();
for (const chunk of graph.chunks) for (const id of chunk.moduleIds) {
  if (!(chunk.moduleRenderInfo?.[id]?.renderedLength > 0)) continue;
  if (!retainedOwners.has(id)) retainedOwners.set(id, []);
  retainedOwners.get(id).push(chunk.fileName);
}
let cycleComparison = { available: false, reason: 'No baseline comparison requested' };
if (label === 'candidate') {
  const reportPath = process.env.PROTO_UI_HEADER_BASELINE_REPORT ??
    path.join(root, '..', 'header-baseline-graph-report.json');
  if (fs.existsSync(reportPath)) {
    const baseline = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (!Array.isArray(baseline.staticChunkCycles)) throw new Error('Baseline lacks SCC evidence');
    if (sourceBaseline && baseline.observedHead !== sourceBaseline)
      throw new Error('Baseline report does not match the requested exact baseline SHA');
    const oldCycles = new Map(baseline.staticChunkCycles.map((cycle) => [cycle.signature, cycle]));
    const current = new Set(staticChunkCycles.map((cycle) => cycle.signature));
    cycleComparison = {
      available: true, baselineHead: baseline.observedHead, baselineGraphSha256: baseline.graphSha256,
      normalization: 'exact facade or unique chunk name; ambiguous names use module-set digest',
      newStaticChunkCycles: staticChunkCycles.filter((cycle) => !oldCycles.has(cycle.signature)),
      changedRetainedSourceCycles: staticChunkCycles.filter((cycle) => oldCycles.has(cycle.signature) &&
        oldCycles.get(cycle.signature).retainedSourceDigest !== cycle.retainedSourceDigest),
      removedCycleSignatures: [...oldCycles.keys()].filter((signature) => !current.has(signature)),
    };
  } else cycleComparison = { available: false, reason: 'Baseline report file is absent', reportPath };
}
const observedHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (label === 'baseline' && sourceBaseline && observedHead !== sourceBaseline)
  throw new Error('Baseline checkout does not match the requested exact baseline SHA');
const result = {
  label,
  observedAt: new Date().toISOString(),
  sourceBaseline,
  observedHead,
  worktreeStatus: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }),
  node: process.version,
  nodeOptions: process.env.NODE_OPTIONS ?? null,
  graphSha256: digest(raw),
  sourceHashes: Object.fromEntries([
    'apps/www/astro.config.mjs',
    'apps/www/scripts/client-chunk-isolation.mjs',
    'apps/www/src/components/override/Header.astro',
    'apps/www/src/components/site-shadcn-controls.ts',
    'packages/adapters/base/src/index.ts',
    scene,
  ].map((file) => [file, fs.existsSync(path.join(root, file))
    ? digest(fs.readFileSync(path.join(root, file))) : null])),
  sourcePath,
  eagerChunks,
  allSceneRecords: graph.chunks.filter((chunk) => chunk.moduleIds.includes(scene)).map((chunk) => ({
    fileName: chunk.fileName,
    info: chunk.moduleRenderInfo?.[scene] ?? null,
    isEntry: chunk.isEntry,
    isDynamicEntry: chunk.isDynamicEntry,
  })),
  staticChunkCycles,
  cycleComparison,
  completeRenderMetadata: graph.chunks.every((chunk) => chunk.moduleIds.every((id) =>
    typeof chunk.moduleRenderInfo?.[id]?.renderedLength === 'number')),
  duplicatedRetainedModules: [...retainedOwners].filter(([, owners]) => owners.length > 1)
    .map(([moduleId, owners]) => ({ moduleId, chunks: owners })),
  danglingStaticImports: graph.chunks.flatMap((chunk) => chunk.imports
    .filter((file) => !chunks.has(file)).map((file) => ({ from: chunk.fileName, to: file }))),
  issues: collectWebsiteProductionBundleIssues({ graph, rootDir: root }),
};
fs.writeFileSync(path.join(root, '..', `header-${label}-graph.json.gz`), gzipSync(raw, { level: 9 }));
fs.writeFileSync(path.join(root, '..', `header-${label}-graph-report.json`), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
