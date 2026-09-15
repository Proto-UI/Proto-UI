#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

import { build, version as esbuildVersion } from 'esbuild';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const json = process.argv.includes('--json');
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
  ['adapter-react root', 'packages/adapters/react/src/index.ts', 75_000],
  ['adapter-vue root', 'packages/adapters/vue/src/index.ts', 75_000],
  // Shadow split S1-S5 adds scoped presentation, role routing and native editors.
  // Closeout measured 82,998 gzip bytes vs main's 74,834 with the same settings.
  // Keep ~1 KB headroom; this is not a general allowance for future growth.
  ['adapter-web-component root', 'packages/adapters/web-component/src/index.ts', 84_000],
  ['prototypes-base/button', 'packages/prototypes/base/src/button/index.ts', 6_000],
  ['prototypes-shadcn/button', 'packages/prototypes/shadcn/src/button/index.ts', 7_000],
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

const results = [];
for (const [name, entry, budget] of cases) {
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

if (json) console.log(JSON.stringify({ environment, results }, null, 2));
else {
  console.log(`[package-budgets] ${JSON.stringify(environment)}`);
  for (const result of results) {
    console.log(
      `${result.pass ? 'PASS' : 'FAIL'} ${result.name}: ${result.gzipBytes} / ${result.budget} gzip bytes; minified=${result.minifiedBytes} sha256=${result.minifiedSha256}`
    );
  }
}
if (results.some((result) => !result.pass)) process.exitCode = 1;
