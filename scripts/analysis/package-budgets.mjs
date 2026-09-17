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
  // PR #623 adds opt-in end-follow, host observation, and owned contact-session handling
  // to module-scroll, which every Adapter root bundles. Attribution on the pinned local
  // toolchain: main sync base a3095552 measures react 72,498 / vue 72,208; this branch
  // head measures react 75,397 / vue 75,148 (+~2.9KB gzip each from the scroll slice).
  // CI at 89ac55c2 independently measured react 75,346 / vue 75,091, matching local
  // within ~60 bytes. Ceilings keep ~350-600 bytes of headroom.
  ['adapter-react root', 'packages/adapters/react/src/index.ts', 76_000],
  ['adapter-vue root', 'packages/adapters/vue/src/index.ts', 75_500],
  // PR #634 adds scoped Escape arbitration and shared Overlay resource ownership.
  // CI measured 75,115 gzip bytes; retain a bounded allowance for that semantic slice.
  // PR #623's scroll slice above measures wc 75,664 at base a3095552 -> 78,593 at head;
  // keep this allowance specific to WC with ~400 bytes of headroom.
  ['adapter-web-component root', 'packages/adapters/web-component/src/index.ts', 79_000],
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
