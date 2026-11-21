#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { parse as parseYaml } from 'yaml';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DAY_MS = 86_400_000;
const args = process.argv.slice(2);
const benchmark = args.includes('--benchmark');
const outIndex = args.indexOf('--out');
const outputFile = resolve(ROOT_DIR, outIndex >= 0 ? args[outIndex + 1] : 'monorepo-snapshot.json');

function run(command, commandArgs, cwd = ROOT_DIR) {
  return execFileSync(command, commandArgs, {
    cwd,
    env: { ...process.env, CI: 'true', npm_config_cache: '/tmp/proto-ui-snapshot-npm-cache' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 128 * 1024 * 1024,
  });
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function getLayer(packagePath) {
  if (packagePath.startsWith('apps/')) return 'apps';
  if (packagePath.startsWith('packages/adapters/')) return 'adapters';
  if (packagePath.startsWith('packages/modules/')) return 'modules';
  if (packagePath.startsWith('packages/prototypes/')) return 'prototypes';
  if (packagePath.startsWith('packages/spec/')) return 'spec-tooling';
  return packagePath.replace(/^packages\//, '');
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * ratio)];
}

function benchmarkCommand(label, commandArgs, runs) {
  const samples = [];
  for (let index = 0; index < runs; index += 1) {
    const started = process.hrtime.bigint();
    const result = spawnSync('corepack', ['pnpm@10.32.1', ...commandArgs], {
      cwd: ROOT_DIR,
      env: { ...process.env, CI: 'true' },
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    });
    samples.push({
      run: index + 1,
      durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1_000_000),
      status: result.status,
      stderrTail: result.status === 0 ? '' : result.stderr.slice(-4_000),
    });
    if (result.status !== 0) break;
  }
  const successful = samples
    .filter((sample) => sample.status === 0)
    .map((sample) => sample.durationMs);
  return {
    label,
    command: `corepack pnpm@10.32.1 ${commandArgs.join(' ')}`,
    samples,
    medianMs: successful.length ? percentile(successful, 0.5) : null,
    minMs: successful.length ? Math.min(...successful) : null,
    maxMs: successful.length ? Math.max(...successful) : null,
  };
}

function directoryStats(relativeDirectory) {
  const files = walk(join(ROOT_DIR, relativeDirectory));
  const entries = files.map((file) => {
    const contents = readFileSync(file);
    const compressible = /\.(?:js|mjs|css|html|json|svg|xml|txt|map)$/.test(file);
    return {
      path: relative(ROOT_DIR, file).replaceAll('\\', '/'),
      bytes: contents.length,
      gzipBytes: compressible ? gzipSync(contents, { level: 9 }).length : null,
    };
  });
  const web = entries.filter((entry) => /\.(?:js|mjs|css|html)$/.test(entry.path));
  return {
    directory: relativeDirectory,
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    webAssetBytes: web.reduce((sum, entry) => sum + entry.bytes, 0),
    webAssetGzipBytes: web.reduce((sum, entry) => sum + (entry.gzipBytes ?? 0), 0),
    largestFiles: [...entries].sort((a, b) => b.bytes - a.bytes).slice(0, 12),
  };
}

const manifestFiles = run('rg', ['--files', '-g', 'package.json', 'packages', 'apps'])
  .trim()
  .split('\n')
  .filter(Boolean)
  .sort();
const packages = manifestFiles.map((manifestPath) => {
  const manifest = JSON.parse(readFileSync(join(ROOT_DIR, manifestPath), 'utf8'));
  return {
    name: manifest.name,
    path: dirname(manifestPath),
    layer: getLayer(dirname(manifestPath)),
    private: Boolean(manifest.private),
    hasBuildScript: Boolean(manifest.scripts?.build),
    manifest,
  };
});
const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
const internalEdges = [];
const internalDevEdges = [];
for (const pkg of packages) {
  const production = new Set([
    ...Object.keys(pkg.manifest.dependencies ?? {}),
    ...Object.keys(pkg.manifest.peerDependencies ?? {}),
    ...Object.keys(pkg.manifest.optionalDependencies ?? {}),
  ]);
  pkg.internalDependencies = [...production].filter((name) => byName.has(name)).sort();
  pkg.internalDevDependencies = Object.keys(pkg.manifest.devDependencies ?? {})
    .filter((name) => byName.has(name) && !production.has(name))
    .sort();
  pkg.internalDependencies.forEach((target) => internalEdges.push({ source: pkg.name, target }));
  pkg.internalDevDependencies.forEach((target) =>
    internalDevEdges.push({ source: pkg.name, target })
  );
}

const cycles = [];
const visited = new Set();
const visiting = new Set();
function visit(name, chain = []) {
  if (visiting.has(name)) {
    const start = chain.indexOf(name);
    cycles.push([...chain.slice(start), name]);
    return;
  }
  if (visited.has(name)) return;
  visiting.add(name);
  for (const dependency of byName.get(name).internalDependencies)
    visit(dependency, [...chain, name]);
  visiting.delete(name);
  visited.add(name);
}
packages.forEach((pkg) => visit(pkg.name));

const now = Date.now();
for (const pkg of packages) {
  const dates = run('git', ['log', '--format=%aI', '--', pkg.path])
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((date) => new Date(date).getTime());
  pkg.updateFrequency = {
    commits30d: dates.filter((date) => now - date <= 30 * DAY_MS).length,
    commits90d: dates.filter((date) => now - date <= 90 * DAY_MS).length,
    commitsAll: dates.length,
    lastUpdatedAt: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
  };
}

const npmBin = join(ROOT_DIR, 'node_modules', '.bin', 'npm');
const publicPackages = packages.filter((pkg) => !pkg.private && pkg.name?.startsWith('@proto.ui/'));
const pack = [];
for (const pkg of publicPackages) {
  const packed = JSON.parse(
    run(npmBin, ['pack', '--dry-run', '--json', '--ignore-scripts'], join(ROOT_DIR, pkg.path))
  )[0];
  const testBytes = packed.files
    .filter((file) =>
      /(^|\/)(?:test|tests|__tests__)(\/|$)|\.(?:test|spec)\.[^.]+$/.test(file.path)
    )
    .reduce((sum, file) => sum + file.size, 0);
  pack.push({
    name: pkg.name,
    tarballBytes: packed.size,
    unpackedBytes: packed.unpackedSize,
    entryCount: packed.entryCount,
    testBytes,
  });
}

const bundleBudgets = JSON.parse(
  run(process.execPath, ['scripts/analysis/package-budgets.mjs', '--json'])
).results;
const outputDirectories = [
  ...publicPackages.map((pkg) => `${pkg.path}/dist`),
  'apps/workspace/dist',
  'apps/www/dist',
];
const outputs = outputDirectories.map(directoryStats);
const docsOutput = outputs.find((output) => output.directory === 'apps/www/dist');
const selectedDocsPages = docsOutput
  ? docsOutput.largestFiles.filter((file) => /(?:demo-matrix|lucide).*index\.html$/.test(file.path))
  : [];

let benchmarks = null;
if (benchmark) {
  benchmarks = [
    benchmarkCommand('all public packages build', ['build:packages'], 3),
    benchmarkCommand('@proto.ui/cli build', ['--filter', '@proto.ui/cli', 'build'], 3),
    benchmarkCommand('@proto.ui/types build', ['--filter', '@proto.ui/types', 'build'], 3),
    benchmarkCommand('apps-workspace build', ['--filter', 'apps-workspace', 'build'], 3),
    benchmarkCommand('apps-www build', ['--filter', 'apps-www', 'build'], 3),
    benchmarkCommand('check:types', ['check:types'], 1),
    benchmarkCommand('test', ['test'], 1),
  ];
}

const specFiles = run('rg', ['--files', '-g', '*.yaml', 'spec']).trim().split('\n').filter(Boolean);
const specRelationKinds = [
  'relates',
  'dependsOn',
  'inherits',
  'references',
  'refines',
  'satisfies',
  'verifies',
  'explains',
  'exercises',
  'requires',
  'owns',
];
function countRelationTargets(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((sum, child) => sum + countRelationTargets(child), 0);
  }
  return value == null ? 0 : 1;
}
let specEntities = 0;
let specRelations = 0;
for (const file of specFiles) {
  try {
    const entity = parseYaml(readFileSync(join(ROOT_DIR, file), 'utf8'));
    specEntities += 1;
    specRelations += specRelationKinds.reduce(
      (sum, kind) => sum + countRelationTargets(entity?.[kind]),
      0
    );
  } catch {
    // The governed snapshot below remains the authoritative catalog count.
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  methodology: {
    topology:
      'workspace manifests; production edges include dependencies, peerDependencies, and optionalDependencies',
    updates: 'git commits touching each package path, based on author date',
    pack: 'npm pack --dry-run --json --ignore-scripts against locally built package contents',
    bundle:
      'esbuild browser ESM, ES2020, minified and tree-shaken; third-party dependencies external',
    benchmark: benchmark
      ? 'CI=true, warm dependency install, sequential runs; build medians use three runs and gates use one run'
      : 'not run; pass --benchmark to collect build and gate timings',
  },
  summary: {
    packageCount: packages.length,
    publicPackageCount: publicPackages.length,
    packagesWithBuildScript: packages.filter((pkg) => pkg.hasBuildScript).length,
    publicPackagesWithBuildScript: publicPackages.filter((pkg) => pkg.hasBuildScript).length,
    internalEdgeCount: internalEdges.length,
    internalDevEdgeCount: internalDevEdges.length,
    cycleCount: cycles.length,
    packTarballBytes: pack.reduce((sum, item) => sum + item.tarballBytes, 0),
    packUnpackedBytes: pack.reduce((sum, item) => sum + item.unpackedBytes, 0),
    packTestBytes: pack.reduce((sum, item) => sum + item.testBytes, 0),
    publicDistBytes: outputs
      .filter((item) => item.directory.startsWith('packages/'))
      .reduce((sum, item) => sum + item.totalBytes, 0),
  },
  topology: { cycles, edges: internalEdges, devEdges: internalDevEdges },
  packages: packages.map(({ manifest, ...pkg }) => pkg),
  pack,
  bundleBudgets,
  outputs,
  selectedDocsPages,
  benchmarks,
  spec: { entityCount: specEntities, relationCount: specRelations },
};

writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`);
console.log(outputFile);
