# 2026-11-10 — Issue #758 production artifact accounting slice

This is a source-ready evidence-tooling candidate at `0607c6c5c386b8a932ab850e92a8873b2121dc45`, not an executed benchmark, a supported generated target, a common-path comparison, or Issue completion. The current user authorizes this bounded slice; Main owns all product execution, independent review, publication and integration. The live Issue is open. Its two 2026-11-06 comments retain the research experiment in 0.4.

## Authority and observed boundary

The original research question and all seven `issue.758.*` criteria remain unchanged. The companion JSON retains their literal text and the additional carried keys `issue.1061.006`, `issue.1056.006` and `issue.1055.006`.

- `P-BASE-BUTTON` and `T-BASE-BUTTON-0001` are draft. Their controlled disabled, activation, keyboard and view-lifetime requirements are possible benchmark inputs, not newly proven guarantees.
- `A-REACT-18-19-0001` is an active Web Adapter profile. Its lifecycle/input/Expose relations do not establish generated-output equivalence.
- `C-LIFECYCLE-0001` is draft and distinguishes instance materialization/disposal from repeated view epochs. Dividing bundle bytes by instance count proves neither fixed initialization nor marginal mount cost.
- `internal/compiler/atomic-lowering-completion.md` and the 2026-10-29 thin-compiler record require separate generated source, retained production and initialization evidence. The record does not promote a target or grant Compiler ownership.
- The current Button browser differential fixture compiles `react-runtime-v1`. The separate source-generated update fixture does not turn Button into an independently reviewed `react-dom-source-v1` comparison.
- `scripts/compiler/native-consumer-smoke.mjs` produces actual source-generated consumers, dependency inventories, original/edited source receipts and one-sided Happy DOM traces. Its existing `costs.json` explicitly excludes production tree-shaking, native-browser latency and relative speed claims. Those limitations are preserved.
- The private Button SSR fixture remains a separate experiment; public SSR gates remain closed. This change does not use it as a production target.

No reviewed #732 successor/common-scope receipt was available to this owner or Main. The generated comparison prerequisite remains open. Compiler, IR, Runtime, Adapter, public registries and workflows are unchanged.

## Implemented artifact producer and admission

`scripts/analysis/delivery-cost.mjs` adds three operations:

1. `prepare-native` consumes a newly produced, unsealed React native-consumer evidence directory. It verifies the literal source-ownership receipt, retained `Component.before-edit.txt`, unchanged helper/map/declaration bytes, compiler source-file hashes, original trace, lockfile and existing cost/timing/dependency receipts. It materializes the authenticated original generated closure beneath a new `consumer/delivery-original/generated` subtree. Historical provenance bytes and the edited consumer files remain unchanged. Ordinary imports resolve through the consumer's actual installed packages; there is no workspace alias or replacement runtime. An existing output subtree/plan, changed pre-edit bytes or missing receipt rejects preparation. Do not run it in a sealed historical archive; Main must first provide a separately retained exact materialization if needed.
2. `build` admits a hash-bound plan, then runs the repository's actual esbuild 0.25.12 under Node 24 with production defines, bundling, splitting, tree shaking, external source maps, and both minified/unminified variants. It rotates path/variant order across repetitions. Each actual attempt receives a separate receipt with its wall time, result, warnings, complete metafile, and physical input/output/package hashes. Failed attempts remain failed, with null success statistics when none succeed. No Compiler generation is executed or attributed by this operation.
3. `analyze` re-admits the frozen input plan and verifies every retained metafile, input, output and physical package manifest. It follows entry imports, dynamic imports, CSS bundles and emitted assets, counts the reached union once, separates external maps and unreached emitted files, and preserves unresolved external dependencies. Multiple physical instances of a retained package are reported with bundler input-contribution estimates. gzip level 9 and Brotli quality 11 measure each actual output file separately. Compressed dependency attribution and HTTP transfer timing are not inferred.

The source-generated plan produced by `prepare-native` is deliberately one-sided and bundles the original generated module exports. It is not an application mount, and exported code can be retained that a particular application would not need. Runtime+Adapter and host-native paths are explicitly unavailable. Its recorded original Happy DOM trace remains adjacent to the delivery numbers, with correctness `untested` for the required native-browser/common-scope question. Raw original compile-time and process-memory receipts are retained by hash without being recast as new measurements.

For a later reviewed three-path plan, every available arm needs its exact root, profile, entry points, lockfile digest, portable source hashes and correctness evidence/differences. The generated arm additionally needs real artifact provenance. Runtime+Adapter and generated portable source identities/hashes must agree. Generated code must actually contribute to the consumer build; a generated label on an unrelated bundle rejects analysis. All inputs must remain inside the declared physical consumer root. Escaping workspace links cannot masquerade as a clean consumer.

The report always withholds semantic/performance comparison and leaves every original completion key unchecked. `ok` means that at least one path had actual successful build attempts and none of its build attempts failed. It is not correctness, target availability, complete dependency delivery, review or Issue acceptance. In particular, inspect `deliveryClosureComplete` and `external` even when builds succeed.

## Authored controls, not executed results

The new Node test file contains eleven sequential controls. They use the real pinned esbuild and physical output files, not a mocked bundler:

- split JS/CSS/asset reachability, shared-file union, external maps and dropped input;
- stale hashes, traversal and escaping physical inputs before output creation;
- duplicate physical dependency instances and their actual retained contributions;
- generated-source reachability and immutable provenance;
- refusal to relabel an unrelated bundle as generated;
- different Runtime+Adapter/generated portable inputs;
- exact original-source restoration without modifying edited source or old provenance;
- failed production attempts, raw errors and adjacent correctness differences;
- unresolved external assets and retained-byte corruption;
- unavailable/empty paths, missing attempts and exclusive output ownership;
- CLI nonzero failure and variance remaining null for a single successful observation.

Receipt grammar controls explicitly use injected source/provenance; they are not Proto Compiler/Happy DOM runs or support evidence. All eleven controls, formatting and product/browser commands are **not run by this owner**. There is no claimed failed-before or passing-after product result. This is new evidence capability; the source inspection above identifies an existing measurement gap, not a reproduced product bug.

## Exact serial Main execution

Run from the supplied worktree with its complete, approved dependency closure. The fresh worktree initially has only metadata YAML linked; missing esbuild/tsx/framework/browser dependencies are setup failures, not negative product evidence. Use the existing Main dependency/serialization route; this slice does not install anything.

First run the eleven tool controls with Node 24:

```sh
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node --test scripts/analysis/test/delivery-cost.test.mjs
```

The following single serial command runs the unchanged real native-consumer producer first, retains its actual stdout/stderr/termination, derives the actual allocated profile directory, prepares the exact original source, then produces and reads back the one-sided production accounting. It does not assume an evidence-directory name or replay a previous run. Main must retain an actual failed producer and stop dependent steps on failure.

```sh
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareNativeConsumerPlan, buildDeliveryRun, analyzeDeliveryRun } from './scripts/analysis/delivery-cost.mjs';
const root = process.cwd();
const retained = mkdtempSync(path.join(tmpdir(), 's758-'));
const args = ['--import', 'tsx', 'scripts/compiler/native-consumer-smoke.mjs'];
const started = performance.now();
const child = spawnSync(process.execPath, args, {
  cwd: root,
  env: { ...process.env, NATIVE_CONSUMER_PROFILES: 'react-dom-source-v1', NATIVE_CONSUMER_DEPENDENCIES: 'copy', NATIVE_CONSUMER_PACKAGE_ROOT: root },
  encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
});
writeFileSync(path.join(retained, 'native.stdout.log'), child.stdout ?? '', { flag: 'wx' });
writeFileSync(path.join(retained, 'native.stderr.log'), child.stderr ?? '', { flag: 'wx' });
writeFileSync(path.join(retained, 'native-command.json'), JSON.stringify({ command: process.execPath, args, cwd: root, wallMs: performance.now() - started, status: child.status, signal: child.signal, error: child.error?.message ?? null }, null, 2) + '\n', { flag: 'wx' });
console.log('ISSUE758_EVIDENCE', retained);
assert.equal(child.error, undefined);
assert.equal(child.signal, null);
assert.equal(child.status, 0, 'Retain failed native evidence; do not prepare a substitute.');
const matches = [...child.stdout.matchAll(/^NATIVE_CONSUMER_EVIDENCE: (.+)$/gm)];
assert.equal(matches.length, 1);
const profile = path.join(matches[0][1], 'react-dom-source-v1');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const planFile = path.join(retained, 'plan.json');
prepareNativeConsumerPlan(profile, revision, planFile);
const production = path.join(retained, 'production');
const report = await buildDeliveryRun(planFile, production);
assert.equal(report.ok, true);
assert.equal(report.comparison.status, 'withheld');
const run = JSON.parse(readFileSync(path.join(production, 'run.json'), 'utf8'));
assert.deepEqual(analyzeDeliveryRun(run, production), report);
console.log('ISSUE758_PRODUCTION_REPORT', path.join(production, 'report.json'));
NODE
```

Expected executed scope: one original/edited `react-dom-source-v1` clean consumer from the unchanged native smoke, its existing unsupported/closure/source-edit negative controls, and six production build attempts (three repetitions × two variants) of the authenticated original generated export module. No Adapter/reference production or native-browser timing is expected from that command. Preserve the actual original/edited results and dependency integrity report. Do not replace original compiler/source hashes with the new measurement helper's hashes.

As a separate serial correctness/visual cross-check, Main may run the three existing Button browser cases at the actual candidate:

```sh
COMPILER_EVIDENCE_DIR=/tmp/s758-browser \
  /home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node \
  /usr/local/lib/node_modules/corepack/dist/corepack.js pnpm@10.32.1 exec vitest run \
  packages/compiler/test/browser-differential.test.ts --maxWorkers=1 --minWorkers=1
```

Inspect the actual paired element and panel PNGs, computed geometry, center hit and accessibility receipt; inspect pointer press/release, keyboard activation, disabled suppression, prop omission and fresh React-root recreation. The injected shadow/opacity/hit controls must remain discriminating. This existing Vite/`react-runtime-v1` fixture is a development/runtime-backed correctness cross-check, **not** the missing source-generated production benchmark or a new browser-timing result. Use a new evidence root if `/tmp/s758-browser` already contains a run.

Main should then run the repository's formatting check, repair formatting through its normal route, refresh candidate hashes, and request independent review:

```sh
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node \
  /usr/local/lib/node_modules/corepack/dist/corepack.js pnpm@10.32.1 exec prettier --check \
  scripts/analysis/delivery-cost.mjs scripts/analysis/test/delivery-cost.test.mjs \
  internal/records/2026-11-10-delivery-cost-758.md internal/records/2026-11-10-delivery-cost-758.json
```

No central runtime-plan, public catalog or workflow registration change is part of this slice.

## Remaining original work and earned closure

All seven original conditions remain unearned until actual reviewed evidence supplies the missing comparison. Main must bind a reviewed #732 successor and common primitive semantics; validate the Runtime+Adapter, source-generated and host-native paths independently; measure production delivery plus a real browser consumer journey with pinned versions; retain correctness differences, repetitions/noise/failures; distinguish shared initialization from actual incremental mount/update/dispose/memory; and interpret neutral, adverse or favorable results without a preferred direction. Add an interaction/lifecycle-relevant primitive before generalizing beyond Button if those paths become available.

The existing #1061/#1056/#1055 initialization/allocation/registration/native-link conditions remain with their original owners. This DOM artifact producer neither supplies GPUI optimized-link evidence nor replaces lifecycle/cleanup/reentrancy acceptance. A source-ready PR may describe this executable accounting slice and relate to #758; it must not use `Closes #758` or mark the parent-source keys complete.
