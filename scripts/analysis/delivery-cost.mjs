#!/usr/bin/env node

// Issue #758: production artifact accounting, never semantic or target admission.
// build <plan.json> <new-evidence-directory> | analyze <run.json>
// prepare-native <react-profile-evidence> <source-revision> <new-plan.json>
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const ARM_IDS = ['runtime-adapter', 'generated', 'host-native'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => { throw new Error(`[delivery-cost] ${message}`); };
const requireThat = (condition, message) => { if (!condition) fail(message); };
const json = (filename) => JSON.parse(readFileSync(filename, 'utf8'));
const writeJson = (filename, value) => writeFileSync(filename, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const slash = (value) => value.split(path.sep).join('/');
function within(root, filename) {
  const relative = path.relative(root, filename);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}
function relativeFile(value) {
  requireThat(text(value) && !value.includes('\\') && !path.posix.isAbsolute(value) &&
    value !== '.' && value.split('/').every((part) => part && part !== '.' && part !== '..'), `invalid relative path: ${value}`);
  return value;
}
function readFile(root, filename) {
  relativeFile(filename);
  const absolute = path.resolve(root, filename);
  requireThat(within(root, absolute) && within(realpathSync(root), realpathSync(absolute)), `file escapes its recorded root: ${filename}`);
  requireThat(lstatSync(absolute).isFile(), `not a regular file: ${filename}`);
  return readFileSync(absolute);
}
function inventory(root, filename) {
  const bytes = readFile(root, filename);
  return { path: filename, bytes: bytes.length, sha256: sha256(bytes) };
}
function verifyFile(root, reference) {
  requireThat(reference && digest(reference.sha256), 'file reference requires an actual SHA-256');
  const actual = inventory(root, reference.path);
  requireThat(actual.sha256 === reference.sha256, `digest mismatch: ${reference.path}`);
  if (reference.bytes !== undefined) requireThat(actual.bytes === reference.bytes, `byte count mismatch: ${reference.path}`);
  return actual;
}
function stringList(values, label) {
  requireThat(Array.isArray(values) && values.length > 0 && values.every(text) && new Set(values).size === values.length, `invalid ${label}`);
}

/** Admission hashes real input files before loading a bundler or creating output. */
export function admitDeliveryPlan(plan, planDirectory) {
  requireThat(plan?.schemaVersion === 1, 'unsupported plan schema');
  requireThat(text(plan.scope?.id) && /^[a-f0-9]{40}$/.test(plan.scope.sourceRevision), 'scope requires an ID and exact source revision');
  stringList(plan.scope.requirements, 'semantic requirement anchors');
  for (const key of ['host', 'framework', 'frameworkVersion']) requireThat(text(plan.environment?.[key]), `missing environment.${key}`);
  requireThat(plan.environment.buildMode === 'production', 'only production builds can enter delivery accounting');
  requireThat(Number.isSafeInteger(plan.repetitions) && plan.repetitions > 0, 'repetitions must be a positive integer');
  requireThat(Array.isArray(plan.arms) && plan.arms.length === ARM_IDS.length &&
    new Set(plan.arms.map((arm) => arm.id)).size === ARM_IDS.length &&
    plan.arms.every((arm) => ARM_IDS.includes(arm.id)), 'declare each of the three paths exactly once');
  const review = plan.scope.review === null ? null : verifyFile(planDirectory, plan.scope.review);
  const arms = plan.arms.map((arm) => {
    requireThat(['available', 'unavailable'].includes(arm.status), `invalid status: ${arm.id}`);
    if (arm.status === 'unavailable') {
      requireThat(text(arm.reason), `unavailable ${arm.id} requires its actual missing prerequisite`);
      return { id: arm.id, status: arm.status, reason: arm.reason };
    }
    requireThat(text(arm.root) && path.isAbsolute(arm.root) && text(arm.profile), `missing root/profile: ${arm.id}`);
    const root = realpathSync(arm.root);
    stringList(arm.entryPoints, `${arm.id} entry points`);
    const entryPoints = arm.entryPoints.map((entry) => inventory(root, entry));
    const lockfile = verifyFile(root, arm.lockfile);
    const retainedEvidence = (arm.retainedEvidence ?? []).map((reference) => verifyFile(root, reference));
    requireThat(['passed', 'failed', 'untested', 'blocked'].includes(arm.correctness?.status) &&
      Array.isArray(arm.correctness.differences) && arm.correctness.differences.every(text), `missing correctness state/differences: ${arm.id}`);
    const evidence = arm.correctness.evidence === null ? null : verifyFile(root, arm.correctness.evidence);
    requireThat(arm.correctness.status !== 'passed' || evidence !== null, `passed declaration requires evidence: ${arm.id}`);
    requireThat(Array.isArray(arm.portableSources), `missing portable source inventory: ${arm.id}`);
    const portableSources = arm.portableSources.map((source) => {
      requireThat(text(source.key), `portable source requires an identity: ${arm.id}`);
      return { key: source.key, ...verifyFile(root, source) };
    });
    requireThat(new Set(portableSources.map((source) => source.key)).size === portableSources.length, `duplicate portable source: ${arm.id}`);
    if (arm.id !== 'host-native') requireThat(portableSources.length > 0, `missing actual portable source: ${arm.id}`);
    let generation = null;
    if (arm.id === 'generated') {
      const provenance = verifyFile(root, arm.provenance);
      const manifest = JSON.parse(readFile(root, provenance.path));
      requireThat(manifest.profile === arm.profile && Array.isArray(manifest.artifacts) &&
        manifest.artifacts.some((artifact) => artifact.kind === 'source'), 'generated path requires its actual profile/artifact provenance');
      const generatedRoot = path.dirname(path.join(root, provenance.path));
      const artifacts = manifest.artifacts.map((artifact) => {
        requireThat(['source', 'source-map', 'declaration', 'manifest'].includes(artifact.kind), `unknown generated artifact kind: ${artifact.kind}`);
        return { kind: artifact.kind, ...verifyFile(generatedRoot, artifact) };
      });
      requireThat(new Set(artifacts.map((artifact) => artifact.path)).size === artifacts.length, 'duplicate generated artifact');
      const emittedBytesByKind = {};
      for (const artifact of artifacts) emittedBytesByKind[artifact.kind] = (emittedBytesByKind[artifact.kind] ?? 0) + artifact.bytes;
      generation = { provenance, directory: slash(path.relative(root, generatedRoot)), artifacts,
        emittedBytesByKind,
        admission: 'Artifact bytes/profile are bound; this does not prove compiler execution, correctness or public target availability.' };
    }
    return { id: arm.id, status: arm.status, root, profile: arm.profile, entryPoints, lockfile, retainedEvidence,
      portableSources, generation, correctness: { ...arm.correctness, evidence, interpretation: 'Supplied status with byte-bound evidence; not independently evaluated by this accounting tool.' } };
  });
  const proto = arms.filter((arm) => arm.status === 'available' && arm.id !== 'host-native');
  if (proto.length === 2) {
    const sourceIdentity = (arm) => JSON.stringify(arm.portableSources.map(({ key, sha256: hash }) => [key, hash]).sort(([a], [b]) => a.localeCompare(b)));
    requireThat(sourceIdentity(proto[0]) === sourceIdentity(proto[1]), 'Runtime+Adapter and generated paths have different portable source identities/bytes');
  }
  return { schemaVersion: 1, scope: { ...plan.scope, review }, environment: plan.environment, repetitions: plan.repetitions, arms };
}

function packageForInput(root, filename) {
  const physical = realpathSync(path.join(root, filename));
  if (!physical.split(path.sep).includes('node_modules')) return null;
  let directory = path.dirname(physical);
  while (within(root, directory)) {
    const manifestPath = path.join(directory, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = inventory(root, slash(path.relative(root, manifestPath)));
      const data = json(manifestPath);
      requireThat(text(data.name) && text(data.version), `missing installed package identity: ${manifest.path}`);
      return { name: data.name, version: data.version, location: slash(path.relative(root, directory)), manifest };
    }
    if (directory === root) break;
    directory = path.dirname(directory);
  }
  fail(`retained package has no physical manifest: ${filename}`);
}

function captureBuild(metafile, inputRoot, outputRoot) {
  requireThat(metafile?.inputs && metafile.outputs && Object.keys(metafile.outputs).length > 0, 'missing or empty production metafile');
  const inputs = Object.entries(metafile.inputs).map(([filename, item]) => {
    const record = inventory(inputRoot, filename);
    requireThat(record.bytes === item.bytes, `metafile input byte drift: ${filename}`);
    return { ...record, package: packageForInput(inputRoot, filename) };
  });
  const outputs = Object.entries(metafile.outputs).map(([key, item]) => {
    const absolute = path.resolve(inputRoot, key);
    requireThat(within(outputRoot, absolute), `output escapes owned evidence directory: ${key}`);
    const record = inventory(outputRoot, slash(path.relative(outputRoot, absolute)));
    requireThat(record.bytes === item.bytes, `metafile output byte drift: ${key}`);
    return { ...record, key };
  });
  return { inputs, outputs };
}

const compressedCache = new Map();
function sizes(bytes) {
  const hash = sha256(bytes);
  if (!compressedCache.has(hash)) compressedCache.set(hash, {
    bytes: bytes.length,
    gzipBytes: gzipSync(bytes, { level: 9 }).length,
    brotliBytes: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  });
  return compressedCache.get(hash);
}
function sumSizes(records) {
  return records.reduce((sum, record) => ({ bytes: sum.bytes + record.bytes, gzipBytes: sum.gzipBytes + record.gzipBytes, brotliBytes: sum.brotliBytes + record.brotliBytes }), { bytes: 0, gzipBytes: 0, brotliBytes: 0 });
}
export function sampleStatistics(samples) {
  const successful = samples.filter((sample) => sample.status === 'passed').map((sample) => sample.wallMs);
  requireThat(successful.every((value) => Number.isFinite(value) && value >= 0), 'invalid successful wall-time sample');
  if (successful.length === 0) return { successful: 0, unsuccessful: samples.length, meanMs: null, minMs: null, maxMs: null, sampleVarianceMs2: null };
  const meanMs = successful.reduce((sum, value) => sum + value, 0) / successful.length;
  return { successful: successful.length, unsuccessful: samples.length - successful.length, meanMs,
    minMs: Math.min(...successful), maxMs: Math.max(...successful),
    sampleVarianceMs2: successful.length > 1 ? successful.reduce((sum, value) => sum + (value - meanMs) ** 2, 0) / (successful.length - 1) : null };
}

/** Only actual entry closures contribute to delivered bytes; maps remain debug payload. */
export function analyzeBuild(sample, evidenceRoot) {
  const outputRoot = path.resolve(evidenceRoot, sample.outputDirectory);
  requireThat(within(evidenceRoot, outputRoot), 'sample directory escapes evidence root');
  verifyFile(outputRoot, sample.metafile);
  const metafile = JSON.parse(readFile(outputRoot, sample.metafile.path));
  const captured = captureBuild(metafile, sample.inputRoot, outputRoot);
  requireThat(JSON.stringify(captured) === JSON.stringify(sample.inventory), 'captured input/output/package inventory drift');
  const outputs = metafile.outputs;
  const byKey = new Map(captured.outputs.map((file) => [file.key, { ...file, ...sizes(readFile(outputRoot, file.path)) }]));
  const entries = Object.keys(outputs).filter((key) => outputs[key].entryPoint && !key.endsWith('.map'));
  requireThat(entries.length > 0, 'production build has no entry output');
  const external = [];
  const closures = entries.map((entry) => {
    const reached = new Set();
    function visit(key) {
      requireThat(Object.hasOwn(outputs, key), `missing reached output: ${key}`);
      if (reached.has(key)) return;
      requireThat(!key.endsWith('.map'), 'source map cannot be a production entry dependency');
      reached.add(key);
      const output = outputs[key];
      for (const edge of output.imports ?? []) {
        if (edge.external) { external.push({ entry, from: key, path: edge.path, kind: edge.kind }); continue; }
        const joined = path.posix.normalize(path.posix.join(path.posix.dirname(key), edge.path));
        visit(Object.hasOwn(outputs, edge.path) ? edge.path : joined);
      }
      if (output.cssBundle) visit(output.cssBundle);
    }
    visit(entry);
    return { entry, source: outputs[entry].entryPoint, files: [...reached].sort() };
  });
  const reachCount = new Map();
  for (const closure of closures) for (const key of closure.files) reachCount.set(key, (reachCount.get(key) ?? 0) + 1);
  const delivered = [...reachCount.keys()].sort().map((key) => byKey.get(key));
  const shared = delivered.filter((file) => reachCount.get(file.key) > 1);
  const contribution = new Map();
  for (const file of delivered) for (const [input, item] of Object.entries(outputs[file.key].inputs ?? {})) {
    requireThat(Number.isFinite(item.bytesInOutput) && item.bytesInOutput >= 0, `invalid retained input contribution: ${input}`);
    contribution.set(input, (contribution.get(input) ?? 0) + item.bytesInOutput);
  }
  const dependencies = new Map();
  for (const input of captured.inputs) {
    if (!input.package || !(contribution.get(input.path) > 0)) continue;
    const key = input.package.location;
    if (!dependencies.has(key)) dependencies.set(key, { ...input.package, retainedInputBytes: 0, inputs: [] });
    const record = dependencies.get(key);
    record.retainedInputBytes += contribution.get(input.path);
    record.inputs.push(input.path);
  }
  const groups = new Map();
  for (const dependency of dependencies.values()) {
    if (!groups.has(dependency.name)) groups.set(dependency.name, []);
    groups.get(dependency.name).push(dependency);
  }
  const debug = [...byKey.values()].filter((file) => file.key.endsWith('.map'));
  return {
    outputDirectory: sample.outputDirectory, variant: sample.variant, repetition: sample.repetition,
    delivered: { ...sumSizes(delivered), files: delivered },
    sharedAcrossEntries: { ...sumSizes(shared), files: shared.map((file) => file.key) },
    entries: closures.map((closure) => ({ ...closure, exclusive: sumSizes(closure.files.filter((key) => reachCount.get(key) === 1).map((key) => byKey.get(key))) })),
    debugMaps: { ...sumSizes(debug), files: debug },
    emittedButNotReached: [...byKey.values()].filter((file) => !file.key.endsWith('.map') && !reachCount.has(file.key)),
    inputSourceBytes: captured.inputs.reduce((sum, input) => sum + input.bytes, 0),
    retainedInputs: [...contribution.entries()].filter(([, bytes]) => bytes > 0).map(([input, bytesInOutput]) => ({ input, bytesInOutput })),
    dependencies: [...dependencies.values()],
    multiplePhysicalPackageInstances: [...groups].filter(([, instances]) => instances.length > 1).map(([name, instances]) => ({ name, instances })),
    external, deliveryClosureComplete: external.length === 0,
    attribution: 'bytesInOutput is a bundler input-contribution estimate. Compression is per actual output file; compressed bytes are not assigned to individual dependencies.',
    perInstanceCost: null,
  };
}

export function analyzeDeliveryRun(run, evidenceRoot) {
  requireThat(run?.schemaVersion === 1 && run.kind === 'proto-ui.delivery-cost-run' && Array.isArray(run.samples), 'invalid delivery run');
  // Re-admit the frozen plan as well: edited generated files never update old hashes.
  const admitted = admitDeliveryPlan(run.plan, run.planDirectory);
  const arms = admitted.arms.map((arm) => {
    if (arm.status === 'unavailable') return arm;
    const samples = run.samples.filter((sample) => sample.arm === arm.id);
    requireThat(samples.length === admitted.repetitions * 2, `missing build attempts: ${arm.id}`);
    const identities = new Set(samples.map((sample) => `${sample.repetition}:${sample.variant}`));
    requireThat(identities.size === samples.length && samples.every((sample) =>
      Number.isSafeInteger(sample.repetition) && sample.repetition >= 1 && sample.repetition <= admitted.repetitions &&
      ['minified', 'unminified'].includes(sample.variant) && ['passed', 'failed'].includes(sample.status) &&
      Number.isFinite(sample.wallMs) && sample.wallMs >= 0 && sample.inputRoot === arm.root), `invalid build attempt set: ${arm.id}`);
    let frozenGraph = null;
    const measured = samples.map((sample) => {
      if (sample.status !== 'passed') return sample;
      const accounting = analyzeBuild(sample, evidenceRoot);
      for (const entry of arm.entryPoints) requireThat(sample.inventory.inputs.some((input) =>
        input.path === entry.path && input.sha256 === entry.sha256), `entry input drift: ${entry.path}`);
      const graph = JSON.stringify(sample.inventory.inputs.map(({ path: filename, sha256: hash }) => [filename, hash]).sort(([a], [b]) => a.localeCompare(b)));
      requireThat(frozenGraph === null || frozenGraph === graph, `input graph changes between build attempts: ${arm.id}`);
      frozenGraph = graph;
      if (arm.generation) requireThat(arm.generation.artifacts.some((artifact) => artifact.kind === 'source' &&
        accounting.retainedInputs.some((input) => input.input === path.posix.join(arm.generation.directory, artifact.path))),
      'generated consumer retains no declared generated source');
      return { ...sample, accounting };
    });
    return { ...arm, samples: measured,
      buildTime: Object.fromEntries(['unminified', 'minified'].map((variant) => [variant, sampleStatistics(samples.filter((sample) => sample.variant === variant))])),
      compileTime: null, startup: null, interaction: null, memory: null };
  });
  requireThat(run.samples.every((sample) => arms.some((arm) => arm.id === sample.arm && arm.status === 'available')), 'attempt for unavailable or unknown path');
  return { schemaVersion: 1, kind: 'proto-ui.delivery-cost-report', issue: 758, scope: admitted.scope,
    environment: { declared: admitted.environment, observed: run.environment }, arms,
    comparison: { status: 'withheld', reason: 'Artifact accounting does not establish a reviewed common semantic subset or a native-browser runtime comparison. Supplied correctness remains adjacent to every path.' },
    measurement: { buildMode: 'production', compression: { gzipLevel: 9, brotliQuality: 11, unit: 'sum of separately compressed reached files; not an HTTP transfer observation' },
      sharedCost: 'Chunks reached by multiple entry points are counted once in their union. This is a build delivery fact, not fixed runtime initialization cost.',
      marginalCost: 'Per-instance mount/update/dispose/memory cost requires actual repeated native-browser journeys; no division of bundle bytes by instance count.',
      buildTime: 'Sequential bundler wall time, including output writes. Service/cache state is retained; no cold-process or Compiler-generation attribution.',
      sourceMaps: 'External maps are inventoried separately. Their sources and contents can disclose source; no debugging usability claim is inferred.' },
    originalCriteria: Array.from({ length: 7 }, (_, index) => ({ key: `issue.758.${String(index + 1).padStart(3, '0')}`, completed: false })),
    ok: arms.some((arm) => arm.status === 'available') && run.samples.every((sample) => sample.status === 'passed') };
}

export async function buildDeliveryRun(planFile, evidenceDirectory) {
  requireThat(process.versions.node.split('.')[0] === '24', 'producer requires the repository Node 24 toolchain');
  const absolutePlan = path.resolve(planFile);
  const plan = json(absolutePlan);
  const planDirectory = path.dirname(absolutePlan);
  const admitted = admitDeliveryPlan(plan, planDirectory);
  const evidenceRoot = path.resolve(evidenceDirectory);
  // A new evidence directory is the output-ownership boundary. Never reuse a run.
  mkdirSync(evidenceRoot);
  const run = { schemaVersion: 1, kind: 'proto-ui.delivery-cost-run', plan, planDirectory,
    environment: { node: process.version, zlib: process.versions.zlib, brotli: process.versions.brotli,
      platform: platform(), arch: arch(), kernel: release(), cpu: cpus()[0]?.model ?? 'unknown', totalMemoryBytes: totalmem(),
      execution: 'Sequential in one Node process; persistent esbuild service and OS caches are not reset.' }, samples: [] };
  writeJson(path.join(evidenceRoot, 'plan.json'), plan);
  const { build, version } = await import('esbuild');
  requireThat(version === '0.25.12', 'producer requires repository-pinned esbuild 0.25.12');
  run.environment.esbuild = version;
  const record = () => {
    // Every attempt has its own immutable receipt; run.json is written once at end.
    const sample = run.samples.at(-1);
    writeJson(path.join(evidenceRoot, `attempt-${String(run.samples.length).padStart(4, '0')}.json`), sample);
  };
  const available = admitted.arms.filter((arm) => arm.status === 'available');
  for (let repetition = 1; repetition <= admitted.repetitions; repetition += 1) {
    // Rotate path order and variant order to expose, rather than conceal, order effects.
    const offset = (repetition - 1) % Math.max(available.length, 1);
    for (const arm of [...available.slice(offset), ...available.slice(0, offset)]) {
      for (const variant of repetition % 2 ? ['unminified', 'minified'] : ['minified', 'unminified']) {
        const outputDirectory = `${arm.id}/run-${repetition}/${variant}`;
        const outputRoot = path.join(evidenceRoot, outputDirectory);
        mkdirSync(outputRoot, { recursive: true });
        const sample = { arm: arm.id, inputRoot: arm.root, repetition, variant, outputDirectory, status: 'failed', wallMs: 0 };
        const started = performance.now();
        try {
          const result = await build({ absWorkingDir: arm.root, entryPoints: arm.entryPoints.map((entry) => entry.path),
            outdir: outputRoot, bundle: true, splitting: true, treeShaking: true, minify: variant === 'minified',
            format: 'esm', platform: 'browser', target: ['es2022'], sourcemap: 'external', metafile: true,
            define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.png': 'file', '.svg': 'file', '.woff2': 'file' },
            write: true, logLevel: 'silent' });
          sample.wallMs = performance.now() - started;
          writeJson(path.join(outputRoot, 'metafile.json'), result.metafile);
          sample.metafile = inventory(outputRoot, 'metafile.json');
          sample.inventory = captureBuild(result.metafile, arm.root, outputRoot);
          sample.warnings = result.warnings;
          sample.status = 'passed';
        } catch (error) {
          sample.wallMs = performance.now() - started;
          sample.failure = { message: String(error), errors: error?.errors ?? null, warnings: error?.warnings ?? null };
        }
        run.samples.push(sample);
        record();
      }
    }
  }
  writeJson(path.join(evidenceRoot, 'run.json'), run);
  const report = analyzeDeliveryRun(run, evidenceRoot);
  writeJson(path.join(evidenceRoot, 'report.json'), report);
  return report;
}

/** Reuse real native-consumer-smoke output, including its retained pre-edit bytes.
 * The original edited consumer and its historical provenance remain untouched.
 * This produces a one-sided exported-module bundle plan, not a browser benchmark.
 */
export function prepareNativeConsumerPlan(profileEvidence, sourceRevision, planFile) {
  requireThat(/^[a-f0-9]{40}$/.test(sourceRevision), 'preparation requires the actual compiler/source revision');
  requireThat(!existsSync(planFile), 'plan already exists');
  const root = realpathSync(profileEvidence);
  const provenancePath = 'consumer/generated/provenance.json';
  const provenanceBytes = readFile(root, provenancePath);
  const provenance = JSON.parse(provenanceBytes);
  requireThat(provenance.profile === 'react-dom-source-v1' && Array.isArray(provenance.sourceFiles) &&
    provenance.sourceFiles.length > 0 && Array.isArray(provenance.artifacts) && provenance.artifacts.length > 0,
  'preparation requires actual react-dom-source-v1 native-consumer artifacts');
  const trace = JSON.parse(readFile(root, 'runtime-original.json'));
  const ownership = JSON.parse(readFile(root, 'source-ownership.json'));
  requireThat(trace.ok === true && trace.profile === provenance.profile, 'missing successful original one-sided consumer trace');
  relativeFile(ownership.source);
  const before = readFile(root, 'Component.before-edit.txt');
  requireThat(sha256(before) === ownership.beforeSha256 &&
    sha256(readFile(root, `consumer/generated/${ownership.source}`)) === ownership.afterSha256,
  'retained original or edited consumer no longer matches its source-ownership receipt');
  const portableSources = provenance.sourceFiles.map((source) => {
    requireThat(text(source.file), 'missing compiler source identity');
    const filename = path.resolve(root, 'compiler-input', source.file);
    requireThat(within(path.join(root, 'compiler-input'), filename), 'compiler source is outside its retained input closure');
    const filenameInRoot = slash(path.relative(root, filename));
    return { key: slash(path.relative(path.join(root, 'compiler-input'), filename)), ...verifyFile(root, { path: filenameInRoot, sha256: source.sha256 }) };
  });
  requireThat(provenance.artifacts.some((artifact) => artifact.path === ownership.source && artifact.kind === 'source' &&
    artifact.sha256 === ownership.beforeSha256), 'retained pre-edit source is not the original compiler artifact');
  const artifacts = provenance.artifacts.map((artifact) => {
    relativeFile(artifact.path);
    const bytes = artifact.path === ownership.source ? before : readFile(root, `consumer/generated/${artifact.path}`);
    requireThat(digest(artifact.sha256) && sha256(bytes) === artifact.sha256, `original generated artifact mismatch: ${artifact.path}`);
    return { ...artifact, bytes };
  });
  requireThat(new Set(artifacts.map((artifact) => artifact.path)).size === artifacts.length, 'duplicate original generated artifact');
  const dependency = provenance.dependencies?.find((item) => item.name === 'react');
  requireThat(text(dependency?.version), 'original generated dependency receipt lacks React version');
  const lockfile = inventory(root, 'consumer/package-lock.json');
  const retainedEvidence = ['timing.json', 'costs.json', 'closure-result.json', 'installed-tree-integrity.json']
    .map((filename) => inventory(root, filename));
  const originalRelative = 'consumer/delivery-original/generated';
  const plan = { schemaVersion: 1,
    scope: { id: 'issue-758-one-sided-retained-native-module', sourceRevision,
      requirements: ['C-LIFECYCLE-0001-A', 'C-LIFECYCLE-0001-C'], review: null,
      limitation: 'Original source-generated numeric/context module exports only. No common Button/native reference scope, reviewed compiler successor, browser journey or public target admission is established.' },
    environment: { host: 'web', framework: 'react', frameworkVersion: dependency.version, buildMode: 'production' },
    repetitions: 3,
    arms: [
      { id: 'runtime-adapter', status: 'unavailable', reason: 'No independent Runtime+Adapter production consumer of this exact source/semantics was supplied.' },
      { id: 'generated', status: 'available', root, profile: provenance.profile,
        entryPoints: [`${originalRelative}/${ownership.source}`], lockfile, portableSources, retainedEvidence,
        provenance: { path: `${originalRelative}/provenance.json`, bytes: provenanceBytes.length, sha256: sha256(provenanceBytes) },
        correctness: { status: 'untested', evidence: inventory(root, 'runtime-original.json'), differences: [
          'Retained original trace is one-sided Happy DOM evidence; it establishes neither native-browser correctness nor common-path equivalence.',
          'This production export bundle does not execute a mount or prove that all retained module exports are needed by an application.',
        ] } },
      { id: 'host-native', status: 'unavailable', reason: 'No independently reviewed host-native implementation of this exact semantic subset was supplied.' },
    ] };
  // All historical files above are admitted before the first new output is written.
  const originalRoot = path.join(root, 'consumer/delivery-original');
  mkdirSync(originalRoot);
  for (const artifact of artifacts) {
    const filename = path.join(root, originalRelative, artifact.path);
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(filename, artifact.bytes, { flag: 'wx' });
  }
  writeFileSync(path.join(root, originalRelative, 'provenance.json'), provenanceBytes, { flag: 'wx' });
  writeJson(path.join(originalRoot, 'restoration.json'), { source: ownership.source, beforeSha256: ownership.beforeSha256,
    afterSha256: ownership.afterSha256, provenanceSha256: sha256(provenanceBytes),
    scope: 'Byte-identical original artifacts in a separate ordinary-import subtree. Edited consumer and historical provenance are unchanged.' });
  // Resolve and hash the newly materialized closure without changing its old receipt.
  admitDeliveryPlan(plan, path.dirname(path.resolve(planFile)));
  writeJson(planFile, plan);
  return plan;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [action, input, output, ...extra] = process.argv.slice(2);
    if (action === 'prepare-native') {
      requireThat(text(input) && text(output) && extra.length === 1 && text(extra[0]), 'use prepare-native <react-profile-evidence> <source-revision> <new-plan.json>');
      process.stdout.write(JSON.stringify(prepareNativeConsumerPlan(input, output, path.resolve(extra[0])), null, 2) + '\n');
    } else {
      requireThat(!extra.length && text(input) && ((action === 'build' && text(output)) || (action === 'analyze' && output === undefined)), 'use build <plan.json> <new-directory> or analyze <run.json>');
      const report = action === 'build' ? await buildDeliveryRun(input, output) : analyzeDeliveryRun(json(path.resolve(input)), path.dirname(path.resolve(input)));
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      if (!report.ok) process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(String(error) + '\n');
    process.exitCode = 1;
  }
}
