# Drawer callable-analysis resource repair

This is a bounded development record, not a Drawer compiler-support or host-acceptance claim.

## Revalidation after main advanced

Main subsequently advanced to `952722e5b619c60ddf797543fba11eea6c06d812`, including callable scalar/nullish-flow and GPUI changes. The repair was integrated as `393bba802996c48758ef50bc3d6a73ede441c8bc`. Fresh checkouts and output directories were used for both revisions; the earlier receipts below remain historical evidence.

| Current comparison | Worker elapsed | Process outcome | Completed implemented-profile rows |
| --- | --: | --- | --- |
| Clean main `952722e5` | 180087 ms | `SIGTERM`, `ETIMEDOUT`; inventory exit 2 | 1 of 6, `UNSUPPORTED` |
| Integrated `393bba802` | 30961 ms | Exit 0, no signal or process error | 6 of 6, all `UNSUPPORTED` / `PUI1007` |

The same original inventory command and 180000 ms / 1536 MiB configuration were used, with `/workspace/scratch/5e512bf106bf/drawer-9527-baseline-inventory` and `/workspace/scratch/5e512bf106bf/drawer-393b-inventory` as output directories. Main's first GPUI row completed after 143637 ms before the next profile timed out. The integrated worker retained all six diagnostic rows, each in 4265–5650 ms, with peak process RSS 565840 KiB. All five retained runs have the identical 13-file Drawer source closure. The selected inventory still has zero admitted Drawer profiles and incomplete full-library coverage. These local resource receipts shared the machine with focused validation and are not isolated throughput benchmarks.

The integrated candidate ran 14 compiler test files: 264 passed and one failed. The new `flow-observation-join` tests and the new resource tests passed. The remaining nullish-spread `PUI1006` failure was separately reproduced on clean `952722e5` before candidate testing (1 failed, 78 skipped); it is still pre-existing at this newer base. The retained-record recursion also still produced `PUI1999` / `RangeError` on clean main, while the candidate's source-located refusal regression passed. Compiler source plus the new test passed the same TypeScript no-emit check with exit 0.

The integrated test command was:

```sh
node node_modules/vitest/vitest.mjs run \
  packages/compiler/test/callable-analysis-budget.test.ts \
  packages/compiler/test/reviewer-factory-record-isolation.test.ts \
  packages/compiler/test/reviewer-callable-fingerprint.test.ts \
  packages/compiler/test/reviewer-mutable-callable-orders.test.ts \
  packages/compiler/test/exception-flow.test.ts \
  packages/compiler/test/json-array-provenance.test.ts \
  packages/compiler/test/json-boundary-provenance.test.ts \
  packages/compiler/test/mutable-callable-provenance.test.ts \
  packages/compiler/test/reviewer-mutable-callable-provenance.test.ts \
  packages/compiler/test/ordinary-flow-soundness.test.ts \
  packages/compiler/test/reviewer-public-record-refresh.test.ts \
  packages/compiler/test/reviewer-projected-record-mutation.test.ts \
  packages/compiler/test/authored-transition-frontend.test.ts \
  packages/compiler/test/flow-observation-join.test.ts \
  --maxWorkers 1 --minWorkers 1 --fileParallelism false --reporter=dot
```

The new archives and logs are appended to the evidence summary under `baseline-9527` and `candidate-393b`. No implementation change was needed during this revalidation. Wider acceptance and actual Drawer lowering remain open.

## Request and scope

Agent paraphrase: investigate the report that the Drawer compilation worker reaches its 180-second deadline, preserve the failure, and repair the responsible compiler analysis without changing Drawer behavior or weakening acceptance evidence.

The repaired condition is worker completion with an explicit, source-located admission result. Full Drawer admission and lowering remain unsupported. No public API, prototype source, spec lifecycle, target capability declaration, worker timeout or heap setting changed.

The original code candidate was `fe4f9281f0f38418c61233e6e166f1b6969c20f8`, based on main `248f8270dd3458d1fcbc507e618337f98b9fde96`. The earlier observed revision was `88fc0883bec70abbc0d7505d88370657c279639e`. The evidence-only commits containing this record do not change the tested implementation; the newer integration is recorded above.

## Reproduction and result

All three runs used the existing inventory command, Node `v24.22.3`, TypeScript `5.9.3`, tsx `4.21.0`, a 1536 MiB worker heap and the unchanged 180000 ms entry deadline:

```sh
node --max-old-space-size=1536 --import tsx \
  scripts/compiler/library-profile-inventory.mjs \
  --output "$DRAWER_INVENTORY_OUTPUT" \
  --entry packages/prototypes/base/src/drawer/content.proto.ts \
  --heap-mb 1536 --entry-timeout-ms 180000
```

`DRAWER_INVENTORY_OUTPUT` was respectively `/workspace/scratch/5e512bf106bf/drawer-baseline-inventory`, `/workspace/scratch/5e512bf106bf/drawer-248f-baseline-inventory` and `/workspace/scratch/5e512bf106bf/drawer-fe4f9281-inventory`. Each run used a fresh output directory and a clean tracked checkout of the named revision.

| Revision | Worker elapsed | Process outcome | Completed implemented-profile rows | Inventory command |
| --- | --: | --- | --- | --- |
| `88fc0883` | 180191 ms | `SIGTERM`, `ETIMEDOUT`, no exit status | 0 of 6 | Exit 2, selected incomplete |
| `248f8270` | 180196 ms | `SIGTERM`, `ETIMEDOUT`, no exit status | 1 of 6, `UNSUPPORTED` | Exit 2, selected incomplete |
| `fe4f9281` | 28690 ms | Exit 0, no signal or process error | 6 of 6, all `UNSUPPORTED` | Exit 0, selected complete |

On `248f8270`, GPUI returned an unsupported diagnostic after 158167 ms; the worker then timed out during the next profile. Its one durable row and failed process receipt are both retained. The first revision had no completed profile receipt before its timeout.

On the candidate, the six profile rows were:

| Profile                   | Result                   | Compilation elapsed |
| ------------------------- | ------------------------ | ------------------: |
| `gpui-source-v1`          | `UNSUPPORTED`, `PUI1007` |             4906 ms |
| `react-dom-source-v1`     | `UNSUPPORTED`, `PUI1007` |             4161 ms |
| `react-runtime-v1`        | `UNSUPPORTED`, `PUI1007` |             4070 ms |
| `vue-source-v1`           | `UNSUPPORTED`, `PUI1007` |             4652 ms |
| `vue2-source-v1`          | `UNSUPPORTED`, `PUI1007` |             4493 ms |
| `web-component-source-v1` | `UNSUPPORTED`, `PUI1007` |             5173 ms |

All six retain the deterministic analysis store-work diagnostic and a source span in the actual Transition machine reached by Drawer. Peak process RSS was 586620 KiB, including imports, source loading and all six profiles; it is not a per-component runtime-memory measurement. These elapsed times describe this local run, not a portable performance guarantee.

The same 13 source files occur in all three Drawer closures. Their aggregate `filesSha256` is `821cba93042bf642a839b7494c14807a811cd56575363fbb77fdab11237f39e4`. The full inventory denominator remains 1015 entries × 12 registered profiles; this selected-entry run has no `PASS` rows. The other implemented entry rows remain `UNTESTED`, and the six unimplemented profiles remain `UNIMPLEMENTED`. Neither full-library admission coverage nor all-entry admission is complete.

## Cause and repair

Callable provenance revisits deferred callbacks and snapshots/joins abstract stores. Drawer reaches the authored Transition machine and outward JSON payload analysis. Distinct captured-store states can repeatedly copy and join a growing ordinary-record store before the existing 8192-state worklist bound is reached. Source inspection and a local V8 profile identified `joinStores` and map allocation as the dominant analysis work; this is compiler work, not execution of the authored module.

The repair counts store entries copied or joined, joined fields and fingerprint visits against a per-pass envelope of 16777216 visits. It charges the relevant copies and joins before constructing their result. A separate 128-active-invocation boundary prevents changing recursive store keys from exhausting the JavaScript stack. A minimal retained-record callback reproducer on clean `248f8270` previously produced `PUI1999` with a `RangeError` and an unknown source location; it now reports the explicit `PUI1007` boundary at the authored function.

The limits abort an incomplete proof. They do not approximate ordinary values, merge otherwise distinct aliases, execute the input, emit partial output or declare the source invalid. Demand-only analysis reports the interrupted traversal as opaque so unvisited functions and host support cannot be removed using a partial proof. Existing issues take precedence if a resource boundary is reached during unwinding. All earlier worklist and fingerprint checks remain in place.

An experimental allocation-context normalization was rejected before implementation because it could change alias precision. No part of that experiment is in the candidate. The remaining compiler-support work is to improve the analysis while preserving provenance and then demonstrate actual Drawer lowering and consumers.

## Regression and validation evidence

The following checks ran on the candidate sources committed as `fe4f9281`; the inventory additionally verifies its exact committed revision before every worker. The test runner used one worker and disabled file parallelism.

| Check | Observed result |
| --- | --- |
| New resource regression plus callable fingerprint, factory isolation, mutable-order, exception-flow and JSON-array provenance | 6 files, 102 tests passed |
| JSON boundary, mutable-callable provenance, ordinary-flow soundness, public-record refresh, projected-record mutation and authored Transition frontend | 7 files, 107 tests passed, 1 pre-existing failure |
| Inventory classification and CI accounting tests | 8 tests passed |
| Compiler source and new regression TypeScript no-emit check | Exit 0 |
| Prettier and `git diff --check` on changed sources | Passed |

The new regression runs unchanged real Drawer Content in a child process with a 45-second test-only process bound. This is necessary because a test timer cannot interrupt synchronous analysis. It requires a normal child exit and explicit unsupported diagnostic, then compiles unchanged Transition and Button controls in the same process and requires both to succeed. The other new regression retains the changing-record recursive callback that previously overflowed the stack. Existing tests continue to check recursive ordinary records, independent factory environments, callable ordering and outward-value provenance.

The broader suite's one failure is `json-boundary-provenance.test.ts` / `preserves known nullish spread has no enumerable fields`: expected successful compilation, received `PUI1006`. A separate pre-repair run on clean main reproduced the same failure. It remains red and is not suppressed, reclassified or fixed by this patch. The Vite/esbuild `ES2024` warnings are also retained in the logs. No whole-workspace, full compiler-suite or native-consumer acceptance is claimed.

Exact focused commands:

```sh
node node_modules/vitest/vitest.mjs run \
  packages/compiler/test/callable-analysis-budget.test.ts \
  packages/compiler/test/reviewer-factory-record-isolation.test.ts \
  packages/compiler/test/reviewer-callable-fingerprint.test.ts \
  packages/compiler/test/reviewer-mutable-callable-orders.test.ts \
  packages/compiler/test/exception-flow.test.ts \
  packages/compiler/test/json-array-provenance.test.ts \
  --maxWorkers 1 --minWorkers 1 --fileParallelism false --reporter=dot

node node_modules/vitest/vitest.mjs run \
  packages/compiler/test/json-boundary-provenance.test.ts \
  packages/compiler/test/mutable-callable-provenance.test.ts \
  packages/compiler/test/reviewer-mutable-callable-provenance.test.ts \
  packages/compiler/test/ordinary-flow-soundness.test.ts \
  packages/compiler/test/reviewer-public-record-refresh.test.ts \
  packages/compiler/test/reviewer-projected-record-mutation.test.ts \
  packages/compiler/test/authored-transition-frontend.test.ts \
  --maxWorkers 1 --minWorkers 1 --fileParallelism false --reporter=dot

node --test scripts/compiler/library-profile-inventory.test.mjs \
  scripts/ci/test/compiler-library-inventory.test.mjs

node --max-old-space-size=4096 node_modules/typescript/bin/tsc \
  --noEmit -p /tmp/drawer-typecheck.json
```

The exact temporary TypeScript configuration is retained with the evidence. It includes compiler source and the new test, extends the repository configuration, and uses the checkout's Node types. It must be rebased to the local checkout path for reproduction elsewhere.

## Retained evidence and remaining work

[Evidence summary](evidence/2026-11-24-drawer-analysis-bound/summary.json) binds every archive/log to a SHA-256 digest. The five `.tar.gz` archives retain each original inventory plan, full report, source closure, request, completed rows, stdout/stderr and process outcome. The missing resource/row receipts in timed-out attempts remain missing; no successful receipt is synthesized for them. Compressed test logs preserve both the known baseline failure and candidate failure.

Agent evidence disposition: complete for the reproduced local worker timeout, bounded refusal, stack-overflow control and named focused tests; partial for wider compiler acceptance. This is internal analysis work, so executable receipts and the source-bound walkthrough are the applicable evidence; no UI capture or uploaded image is claimed. Independent review and any external publication are separate work.

The next support task is a semantics-preserving reduction of the expanding callable store, followed by successful source admission, portable validation, native lowering and actual Drawer consumer behavior for each claimed profile. The six completed unsupported rows do not satisfy that task.
