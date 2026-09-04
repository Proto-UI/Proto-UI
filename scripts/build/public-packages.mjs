#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGE_ROOTS = ['packages'];
const PUBLIC_SCOPE = '@proto.ui/';

export function getPublicPackages() {
  const packageDirs = [];
  for (const rootName of PACKAGE_ROOTS) {
    const rootDir = join(ROOT_DIR, rootName);
    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directDir = join(rootDir, entry.name);
      if (existsSync(join(directDir, 'package.json'))) packageDirs.push(directDir);
      for (const child of readdirSync(directDir, { withFileTypes: true })) {
        if (!child.isDirectory()) continue;
        const nestedDir = join(directDir, child.name);
        if (existsSync(join(nestedDir, 'package.json'))) packageDirs.push(nestedDir);
      }
    }
  }

  const packages = packageDirs
    .map((dir) => {
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      const dependencyMap = {
        ...manifest.dependencies,
        ...manifest.peerDependencies,
        ...manifest.optionalDependencies,
      };
      return {
        name: manifest.name,
        dir,
        relDir: relative(ROOT_DIR, dir).replaceAll('\\', '/'),
        manifest,
        dependencyNames: Object.keys(dependencyMap),
        declaredBuildDependencyNames: manifest.protoUi?.buildDependencies ?? [],
      };
    })
    .filter((pkg) => !pkg.manifest.private && pkg.name?.startsWith(PUBLIC_SCOPE));

  const names = new Set(packages.map((pkg) => pkg.name));
  for (const pkg of packages) {
    pkg.internalDeps = pkg.dependencyNames.filter((name) => names.has(name)).sort();
    const unknownBuildDeps = pkg.declaredBuildDependencyNames.filter((name) => !names.has(name));
    if (unknownBuildDeps.length > 0) {
      throw new Error(
        `${pkg.name}: unknown protoUi.buildDependencies: ${unknownBuildDeps.join(', ')}`
      );
    }
    pkg.buildDeps = [...new Set([...pkg.internalDeps, ...pkg.declaredBuildDependencyNames])].sort();
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

export function topoSortPackages(packages) {
  const selected = new Set(packages.map((pkg) => pkg.name));
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];

  function visit(name) {
    if (visited.has(name) || !selected.has(name)) return;
    if (visiting.has(name)) throw new Error(`Public package dependency cycle at ${name}`);
    visiting.add(name);
    for (const dependency of byName.get(name).buildDeps) visit(dependency);
    visiting.delete(name);
    visited.add(name);
    ordered.push(byName.get(name));
  }

  for (const pkg of packages) visit(pkg.name);
  return ordered;
}

function flattenExportTargets(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => flattenExportTargets(item, output));
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => flattenExportTargets(item, output));
  }
  return output;
}

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function resolveRelativeRuntimeSpecifier(outputFile, specifier) {
  if (!specifier.startsWith('.') || /\.(?:[cm]?js|json|node|css)(?:[?#].*)?$/i.test(specifier))
    return specifier;
  const candidate = resolve(dirname(outputFile), specifier);
  if (existsSync(`${candidate}.js`)) return `${specifier}.js`;
  if (existsSync(join(candidate, 'index.js'))) return `${specifier.replace(/\/$/, '')}/index.js`;
  return specifier;
}

function rewriteRelativeRuntimeSpecifiers(distDir) {
  for (const file of listFiles(distDir).filter(
    (path) => path.endsWith('.js') || path.endsWith('.d.ts')
  )) {
    const original = readFileSync(file, 'utf8');
    let next = original.replace(
      /(\bfrom\s*)(['"])(\.{1,2}\/[^'"]+)\2/g,
      (_match, prefix, quote, specifier) =>
        `${prefix}${quote}${resolveRelativeRuntimeSpecifier(file, specifier)}${quote}`
    );
    next = next.replace(
      /(\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g,
      (_match, prefix, quote, specifier) =>
        `${prefix}${quote}${resolveRelativeRuntimeSpecifier(file, specifier)}${quote}`
    );
    next = next.replace(
      /(\bimport\s*)(['"])(\.{1,2}\/[^'"]+)\2/g,
      (_match, prefix, quote, specifier) =>
        `${prefix}${quote}${resolveRelativeRuntimeSpecifier(file, specifier)}${quote}`
    );
    if (next !== original) writeFileSync(file, next);
  }
}

function validateBuiltPackage(pkg, distDir) {
  const missing = flattenExportTargets(pkg.manifest.exports).filter((target) => {
    if (!target.startsWith('./dist/') || target.includes('*')) return false;
    return !existsSync(join(distDir, target.slice('./dist/'.length)));
  });
  if (missing.length > 0) {
    throw new Error(`${pkg.name}: missing built export targets: ${missing.join(', ')}`);
  }

  const runtimeEntries = new Set(
    flattenExportTargets(pkg.manifest.exports)
      .filter(
        (target) => target.startsWith('./dist/') && target.endsWith('.js') && !target.includes('*')
      )
      .map((target) => join(distDir, target.slice('./dist/'.length)))
  );
  const rootEntry = join(distDir, 'index.js');
  if (!runtimeEntries.has(rootEntry)) runtimeEntries.add(rootEntry);
  for (const entry of runtimeEntries) {
    if (!existsSync(entry))
      throw new Error(`${pkg.name}: missing built runtime entry ${relative(distDir, entry)}`);
    const smoke = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', `import(${JSON.stringify(pathToFileURL(entry).href)})`],
      { cwd: ROOT_DIR, encoding: 'utf8', timeout: 20000 }
    );
    if (smoke.status !== 0) {
      throw new Error(
        `${pkg.name}: JavaScript-only import smoke failed for ${relative(distDir, entry)}\n${smoke.stderr || smoke.stdout}`
      );
    }
  }
}

export function buildPublicPackage(pkg, options = {}) {
  const distDir = options.outDir ?? join(pkg.dir, 'dist');
  const sourceEntry = join(pkg.dir, 'src', 'index.ts');
  if (!existsSync(sourceEntry)) throw new Error(`${pkg.name}: missing src/index.ts`);
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  const tscBin = join(ROOT_DIR, 'node_modules', 'typescript', 'bin', 'tsc');
  const args = [
    tscBin,
    '--pretty',
    'false',
    '--declaration',
    '--declarationMap',
    'false',
    '--emitDeclarationOnly',
    'false',
    '--noEmitOnError',
    '--allowJs',
    '--checkJs',
    'false',
    '--rootDir',
    join(pkg.dir, 'src'),
    '--outDir',
    distDir,
    '--module',
    'ES2022',
    '--moduleResolution',
    'Bundler',
    '--target',
    'ES2022',
    '--jsx',
    'react-jsx',
    '--strict',
    '--skipLibCheck',
    sourceEntry,
  ];
  const started = performance.now();
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    timeout: 180000,
  });
  if (result.status !== 0) {
    throw new Error(`${pkg.name}: TypeScript build failed\n${result.stdout}\n${result.stderr}`);
  }
  rewriteRelativeRuntimeSpecifiers(distDir);
  if (options.validate !== false) validateBuiltPackage(pkg, distDir);
  return {
    name: pkg.name,
    durationMs: Math.round(performance.now() - started),
    files: listFiles(distDir).length,
    bytes: listFiles(distDir).reduce((sum, file) => sum + statSync(file).size, 0),
  };
}

function dependencyClosure(names, byName) {
  const result = new Set(names);
  const stack = [...names];
  while (stack.length) {
    const name = stack.pop();
    for (const dependency of byName.get(name)?.buildDeps ?? []) {
      if (result.has(dependency)) continue;
      result.add(dependency);
      stack.push(dependency);
    }
  }
  return result;
}

function selectChangedPackages(packages, base) {
  const commands = [
    ['diff', '--name-only', `${base}...HEAD`],
    ['diff', '--name-only'],
    ['ls-files', '--others', '--exclude-standard'],
  ];
  const files = new Set();
  for (const args of commands) {
    const diff = spawnSync('git', args, { cwd: ROOT_DIR, encoding: 'utf8' });
    if (diff.status !== 0) throw new Error(diff.stderr || `Cannot inspect changes from ${base}`);
    diff.stdout
      .split('\n')
      .filter(Boolean)
      .forEach((file) => files.add(file));
  }
  const changedFiles = [...files];
  const globalChange = changedFiles.some((file) =>
    /^(package.json|pnpm-lock.yaml|tsconfig[^/]*\.json|scripts\/(build|release)\/|\.github\/)/.test(
      file
    )
  );
  if (globalChange) return new Set(packages.map((pkg) => pkg.name));

  const changed = new Set();
  for (const pkg of packages) {
    if (changedFiles.some((file) => file === pkg.relDir || file.startsWith(`${pkg.relDir}/`)))
      changed.add(pkg.name);
  }
  const reverse = new Map(packages.map((pkg) => [pkg.name, []]));
  for (const pkg of packages) {
    for (const dependency of pkg.internalDeps) reverse.get(dependency).push(pkg.name);
  }
  const affected = new Set(changed);
  const stack = [...changed];
  while (stack.length) {
    const name = stack.pop();
    for (const consumer of reverse.get(name) ?? []) {
      if (affected.has(consumer)) continue;
      affected.add(consumer);
      stack.push(consumer);
    }
  }
  return dependencyClosure(affected, new Map(packages.map((pkg) => [pkg.name, pkg])));
}

function parseArgs(argv) {
  const options = { packageNames: [], changedFrom: null, json: false, plan: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--package') options.packageNames.push(argv[++index]);
    else if (arg === '--changed-from') options.changedFrom = argv[++index];
    else if (arg === '--json') options.json = true;
    else if (arg === '--plan') options.plan = true;
    else if (arg === '--') continue;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const packages = getPublicPackages();
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  let selectedNames = new Set(packages.map((pkg) => pkg.name));
  if (options.packageNames.length > 0)
    selectedNames = dependencyClosure(options.packageNames, byName);
  if (options.changedFrom) selectedNames = selectChangedPackages(packages, options.changedFrom);
  const selected = topoSortPackages(packages).filter((pkg) => selectedNames.has(pkg.name));
  if (options.plan) {
    const plan = {
      packageCount: packages.length,
      selectedCount: selected.length,
      packages: selected.map((pkg) => pkg.name),
    };
    console.log(options.json ? JSON.stringify(plan, null, 2) : plan.packages.join('\n'));
    return;
  }
  const results = [];
  for (const pkg of selected) {
    const result = buildPublicPackage(pkg);
    results.push(result);
    if (!options.json)
      console.log(`[build:packages] ${pkg.name} ${result.durationMs}ms ${result.files} files`);
  }
  if (options.json) {
    console.log(
      JSON.stringify(
        { packageCount: packages.length, selectedCount: selected.length, results },
        null,
        2
      )
    );
  } else {
    console.log(`[build:packages] complete: ${selected.length}/${packages.length} public packages`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
