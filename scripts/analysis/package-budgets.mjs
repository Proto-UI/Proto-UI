#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { build } from 'esbuild';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const json = process.argv.includes('--json');
const cases = [
  ['lucide/icons/x', 'packages/prototypes/lucide/src/icons/x.ts', 3_000],
  ['lucide root', 'packages/prototypes/lucide/src/index.ts', 700_000],
  ['core root', 'packages/core/src/index.ts', 6_000],
  ['runtime root', 'packages/runtime/src/index.ts', 60_000],
  // PR #625 adds the A11y direct-reference transport and integrates the asAccessible
  // slice (#636). Attribution on the pinned toolchain against current main ddac15da
  // (react 72,498 / vue 72,208 / wc 75,664): the merged head measures react 75,971 /
  // vue 75,705 / wc 79,096, i.e. +3,473 / +3,497 / +3,432 gzip bytes attributed to the
  // shared ownership transport in packages/adapters/base (lease retention, scalar
  // top-owner release, replaced-projector retirement) surfacing in all three adapters.
  // Shrinking was considered first per #654: the delta is semantic ownership code with
  // regression coverage, not removable bloat. CI run 35219288891 agrees exactly with
  // the merged numbers. Ceilings keep ~400-800 bytes of headroom.
  ['adapter-react root', 'packages/adapters/react/src/index.ts', 76_500],
  ['adapter-vue root', 'packages/adapters/vue/src/index.ts', 76_500],
  ['adapter-web-component root', 'packages/adapters/web-component/src/index.ts', 79_500],
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
    gzipBytes,
    budget,
    pass: gzipBytes <= budget,
  });
}

if (json) console.log(JSON.stringify({ results }, null, 2));
else {
  for (const result of results) {
    console.log(
      `${result.pass ? 'PASS' : 'FAIL'} ${result.name}: ${result.gzipBytes} / ${result.budget} gzip bytes`
    );
  }
}
if (results.some((result) => !result.pass)) process.exitCode = 1;
