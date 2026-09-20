#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

import { build, version as esbuildVersion } from 'esbuild';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const json = process.argv.includes('--json');
// Provenance makes a ceiling change reviewable per the #654 policy: a number
// is only comparable with the Node/zlib/esbuild/platform environment and the
// minified artifact hash that produced it.
const environment = {
  node: process.version,
  zlib: process.versions.zlib,
  esbuild: esbuildVersion,
  platform: process.platform,
  arch: process.arch,
};
const cases = [
  ['lucide/icons/x', 'packages/prototypes/lucide/src/icons/x.ts', 3_000],
  ['lucide root', 'packages/prototypes/lucide/src/index.ts', 700_000],
  ['core root', 'packages/core/src/index.ts', 6_000],
  ['runtime root', 'packages/runtime/src/index.ts', 60_000],
  // #623 scroll end-follow, #625 direct-reference transport, and #652 shadow
  // split S1-S5 all grow the eager adapter closures. Exact #652 merge-ref
  // measurement on main c473eae3: react 82,082 / vue 81,804 gzip. Ceilings
  // keep ~700-900 bytes of headroom. Attribution:
  // internal/records/2026-09-20-adapter-budget-direct-reference-shadow-combined.zh-CN.md
  ['adapter-react root', 'packages/adapters/react/src/index.ts', 83_000],
  ['adapter-vue root', 'packages/adapters/vue/src/index.ts', 82_500],
  // PR #652 shadow split S1-S5 and composed-tree focus correctness. Canonical CI
  // measures 84,683 gzip bytes at head dd820b30 (main at ddac15da: 75,664 with
  // the same toolchain). Attribution and headroom evidence:
  // internal/records/2026-09-18-wc-adapter-budget-shadow-split-baseline.zh-CN.md
  // The same exact merge-ref measures 95,936 gzip after the three accepted
  // capability slices; retain ~1KB of bounded headroom.
  ['adapter-web-component root', 'packages/adapters/web-component/src/index.ts', 97_000],
  ['prototypes-base/button', 'packages/prototypes/base/src/button/index.ts', 6_000],
  ['prototypes-shadcn/button', 'packages/prototypes/shadcn/src/button/index.ts', 7_000],
];

// Second, diagnostic-only measurement layer per the #654 direction: fixed
// representative consumer profiles (Light DOM and direct Shadow, one shipped
// primitive each) measured with the same bundling settings. These supplement
// the whole-entry anti-regression gate; they never fail it. A split-profile
// fixture lands with the capability that introduces it (PR #652).
const diagnostics = [
  ['consumer light-dom button', 'scripts/analysis/fixtures/consumer-light-button.ts'],
  ['consumer direct-shadow button', 'scripts/analysis/fixtures/consumer-shadow-button.ts'],
];

const workspaceNames = new Set();
const externalNames = new Set();
const manifestPaths = [];
for (const scope of ['core', 'hooks', 'runtime', 'types', 'cli']) {
  manifestPaths.push(`packages/${scope}/package.json`);
}
for (const scope of ['adapters', 'modules', 'prototypes']) {
  for (const entry of readdirSync(join(ROOT_DIR, 'packages', scope), { withFileTypes: true })) {
    const path = `packages/${scope}/${entry.name}/package.json`;
    if (entry.isDirectory() && existsSync(join(ROOT_DIR, path))) manifestPaths.push(path);
  }
}
const manifests = manifestPaths.map((path) =>
  JSON.parse(readFileSync(join(ROOT_DIR, path), 'utf8'))
);
manifests.forEach((manifest) => workspaceNames.add(manifest.name));
for (const manifest of manifests) {
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      if (!workspaceNames.has(name)) externalNames.add(name);
    }
  }
}
const external = [...externalNames].flatMap((name) => [name, `${name}/*`]);
external.push('node:*');

const measure = async (entry) => {
  const result = await build({
    absWorkingDir: ROOT_DIR,
    entryPoints: [entry],
    bundle: true,
    write: false,
    minify: true,
    treeShaking: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    external,
    logLevel: 'silent',
  });
  const contents = Buffer.concat(result.outputFiles.map((file) => Buffer.from(file.contents)));
  return contents;
};

const results = [];
for (const [name, entry, budget] of cases) {
  const contents = await measure(entry);
  const gzipBytes = gzipSync(contents, { level: 9 }).length;
  results.push({
    name,
    entry,
    minifiedBytes: contents.length,
    minifiedSha256: createHash('sha256').update(contents).digest('hex'),
    gzipBytes,
    budget,
    pass: gzipBytes <= budget,
  });
}

const diagnosticResults = [];
for (const [name, entry] of diagnostics) {
  const contents = await measure(entry);
  diagnosticResults.push({
    name,
    entry,
    minifiedBytes: contents.length,
    minifiedSha256: createHash('sha256').update(contents).digest('hex'),
    gzipBytes: gzipSync(contents, { level: 9 }).length,
  });
}

if (json)
  console.log(JSON.stringify({ environment, results, diagnostics: diagnosticResults }, null, 2));
else {
  console.log(`[package-budgets] ${JSON.stringify(environment)}`);
  for (const result of results) {
    console.log(
      `${result.pass ? 'PASS' : 'FAIL'} ${result.name}: ${result.gzipBytes} / ${result.budget} gzip bytes; minified=${result.minifiedBytes} sha256=${result.minifiedSha256}`
    );
  }
  for (const result of diagnosticResults) {
    console.log(
      `DIAGNOSTIC ${result.name}: ${result.gzipBytes} gzip bytes; minified=${result.minifiedBytes} sha256=${result.minifiedSha256}`
    );
  }
}
if (results.some((result) => !result.pass)) process.exitCode = 1;
