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
  // Separate, evidence-backed budget proposal for the already-implemented
  // #652 capability growth. The blocking whole-entry gate and measurement
  // shape remain unchanged; see the exact Linux CI comparison and attribution:
  // internal/records/2026-09-27-shadow-split-budget-proposal.zh-CN.md
  ['core root', 'packages/core/src/index.ts', 6_600],
  // The prior 64,000 ceiling covered #621 Table Checkpoint B registering
  // module-table-structure in the eager runtime closure: +3,294 gzip bytes
  // over main 9eb93e9b (63,294 at Table head 2d305208 vs 60,000 on main).
  // #549 relationship candidate 868d3adb measures 65,865 after main 9d9552bb;
  // separate numeric transaction and closure attribution:
  // internal/records/2026-09-21-table-structure-runtime-budget.zh-CN.md
  // internal/records/2026-09-22-a11y-part-relationship-budget.zh-CN.md
  // Current #738 + #688 exact-head reconciliation and 479-byte headroom:
  // internal/records/2026-09-27-a11y-part-relationship-budget-reconciliation.zh-CN.md
  // Merged #738 proposal and combined #549 headroom:
  // #801 separately reviewed live preference/support lease cost; old 66,500 /
  // 86,500 / 86,500 ceilings and canonical before/after evidence are retained in
  // internal/records/2026-10-03-bounded-meta-budget-transaction.md.
  // #747 adds 260 gzip bytes for the static selection grammar/grouping; the
  // independent bounded transaction retains the old failure and 220 headroom:
  // internal/records/2026-10-03-selection-style-runtime-budget.md
  // Independent #809 material lifetime baseline; coordinated with #819's
  // narrower React allowance, not a feature-local gate bypass. Evidence:
  // internal/records/2026-10-04-material-budget-transaction.json
  // Current #832 + #809 startup reconciliation: 69,200 cap, 247-byte headroom.
  // internal/records/2026-10-06-focus-startup-budget-reconciliation.json
  // Exact bounded request/owner-release repair, measured on the full Focus union:
  // internal/records/2026-10-06-focus-request-release-budget.json
  // Unified preflight and owned-shadow acquisition, exact integrated artifact:
  // internal/records/2026-10-06-focus-preflight-shadow-budget.json
  ['runtime root', 'packages/runtime/src/index.ts', 71_500],
  // #623 scroll end-follow, #625 direct-reference transport, and the earlier
  // #652 baseline proposal were measured on merge-ref main c473eae3 at React
  // 82,082 / Vue 81,804 gzip. The current #652 proposal and combined headroom:
  // internal/records/2026-09-20-adapter-budget-direct-reference-shadow-combined.zh-CN.md
  // #621 Table Checkpoint B adds a measured +3,394 gzip bytes to the React
  // adapter root (82,816 at Table head 2d305208; main 79,422) and +3,364 to
  // the Vue adapter root (82,527; main 79,163). Retain ~700-1,000 bytes of
  // bounded headroom.
  // #549 adds 2,593 / 2,613 gzip bytes over main 9d9552bb: 85,351 / 85,093.
  // Independent terminal cleanup/reentry follow-up, with exact combined evidence:
  // internal/records/2026-10-04-material-terminal-budget-followup.json
  // Current #832 + #809 startup reconciliation: React 91,000 / Vue 90,800,
  // with 217 / 193 bytes of headroom; earlier records above retain history.
  // internal/records/2026-10-06-focus-startup-budget-reconciliation.json
  // Necessary +29-byte ceiling for the reviewed remount/Text Control/Feedback union;
  // internal/records/2026-10-06-react-remount-text-control-budget.json
  // Exact #832 + merged Template/Scroll integration; no speculative headroom.
  // Subsequent bounded request/owner-release repair measured as an actual union:
  // internal/records/2026-10-06-focus-request-release-budget.json
  // internal/records/2026-10-06-template-scroll-focus-budget.json
  ['adapter-react root', 'packages/adapters/react/src/index.ts', 94_550],
  ['adapter-vue root', 'packages/adapters/vue/src/index.ts', 94_350],
  // The earlier #652 shadow split baseline proposal measured 84,683 gzip at
  // head dd820b30 (main at ddac15da: 75,664 with the same toolchain). Its
  // prior 97,000 ceiling rationale is retained here; current proposal:
  // internal/records/2026-09-18-wc-adapter-budget-shadow-split-baseline.zh-CN.md
  // The same exact merge-ref measured 95,936 gzip after three accepted
  // capability slices. Current proposal evidence and headroom are in the
  // dated record above.
  ['adapter-web-component root', 'packages/adapters/web-component/src/index.ts', 117_850],
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
