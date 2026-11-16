#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPublicPackages, ROOT_DIR } from './public-packages.mjs';
import { protoSourceFiles } from './proto-source.mjs';

const check = process.argv.includes('--check');
const buildScript = join(ROOT_DIR, 'scripts', 'build', 'public-packages.mjs');
let changed = 0;

function rewriteTarget(target, types) {
  if (typeof target !== 'string') return target;
  let next = target.replace('./src/', './dist/');
  if (next.endsWith('.d.ts')) return next;
  if (next.endsWith('.ts')) return `${next.slice(0, -3)}${types ? '.d.ts' : '.js'}`;
  return next;
}

function rewriteExportEntry(entry) {
  if (typeof entry === 'string') {
    const runtime = rewriteTarget(entry, false);
    return { types: rewriteTarget(entry, true), import: runtime, default: runtime };
  }
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
  const typesTarget = entry.types ?? entry.default ?? entry.import;
  const runtimeTarget = entry.import ?? entry.default ?? entry.types;
  const next = {};
  if (Object.hasOwn(entry, 'proto')) next.proto = entry.proto;
  if (typesTarget) next.types = rewriteTarget(typesTarget, true);
  if (runtimeTarget) {
    next.import = rewriteTarget(runtimeTarget, false);
    next.default = rewriteTarget(runtimeTarget, false);
  }
  for (const [key, value] of Object.entries(entry)) {
    if (key === 'proto' || key === 'types' || key === 'import' || key === 'default') continue;
    next[key] = value;
  }
  return next;
}

for (const pkg of getPublicPackages()) {
  const manifestPath = join(pkg.dir, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const relativeBuildScript = relative(pkg.dir, buildScript).replaceAll('\\', '/');
  const command = `node ${relativeBuildScript} --package ${manifest.name}`;

  if (!manifest.exports) {
    manifest.exports = {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        default: './dist/index.js',
      },
    };
  } else {
    manifest.exports = Object.fromEntries(
      Object.entries(manifest.exports).map(([subpath, entry]) => [
        subpath,
        rewriteExportEntry(entry),
      ])
    );
  }

  const files = ['dist/', 'README.md'];
  if (manifest.bin) files.splice(1, 0, 'bin/');
  for (const notice of manifest.protoUi?.release?.thirdPartyNotices ?? []) files.push(notice);
  files.push(...protoSourceFiles({ ...pkg, manifest }));
  manifest.files = [...new Set(files)];
  manifest.scripts = {
    ...manifest.scripts,
    build: command,
    prepack: 'pnpm run build',
  };

  const next = `${JSON.stringify(manifest, null, 2)}\n`;
  const previous = readFileSync(manifestPath, 'utf8');
  if (next === previous) continue;
  changed += 1;
  if (!check) writeFileSync(manifestPath, next);
  console.log(`${check ? 'outdated' : 'updated'} ${relative(ROOT_DIR, manifestPath)}`);
}

if (check && changed > 0) {
  console.error(`${changed} public package manifests need regeneration`);
  process.exitCode = 1;
} else {
  console.log(
    `${check ? 'checked' : 'synchronized'} ${getPublicPackages().length} public manifests`
  );
}
