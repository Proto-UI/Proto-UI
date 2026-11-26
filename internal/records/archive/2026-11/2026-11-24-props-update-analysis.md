# Sprint 1 #1453: bounded Props update advice and scheduling-owner trace

Later follow-ups resolve the owner proposal recorded below: [exact owner and compatibility disposition](./2026-11-24-props-update-owner-binding.md) binds the existing lifecycle owner without activating drafts or changing defaults. [The real Shenko application receipt](./2026-11-24-shenko-props-application.md) records normal-build verification, actual native transitions, the discovered CSS defect and its source-bound successor in Shenko PR #403. The earlier observations and their original scope remain preserved here.

Date: 2026-11-24 (Beijing). This is an implementation and evidence record. It does not promote a draft contract or close the whole Issue.

## Implemented condition

The Compiler previously returned admitted IR and emitted output without a Props update analysis. The retained `baseline-analysis.json` records successful compilation of a direct Props-driven template under the explicit policy, with no analysis field. Successful compilation now also returns `analysis.propsUpdates`; CLI `explain`, `explain --json` and `check --json` expose the same report. Existing error diagnostics, exit semantics, generated code and profile defaults are unchanged.

The analysis reuses `traceCallableDemand`, the Compiler's existing admitted-IR callable-flow proof. It follows actual helper calls, renamed/re-exported bindings, admitted callbacks and authored Hooks. It records source spans for direct render-time resolved/raw/presence Props reads and operations whose declared effect requests the update queue. An explicit-policy template with a closed authored invocation graph and no authored update request receives the conditional advisory `props-update:no-authored-request`. It still compiles.

A Props watcher is only one lawful update cause. Event callbacks, lifecycle callbacks, exposed methods and helpers can request an update. A request somewhere in that graph suppresses the missing-request warning, but does not prove that each changed prop reaches it. External callable bodies, recursive/opaque demand and the bounded worklist remain `unknown`; the analysis does not turn them into proof of absence. Dormant helper declarations and literal-false update branches do not create an update path. Host policy suppresses the advisory. Consumer `handle.update()` calls and deliberate fixed/one-shot templates remain lawful even when an absence advisory is present.

The scope is direct render-time Props reads, not arbitrary Props-to-State-to-template dependence or proof that a read's value affects the emitted view. The message states the condition under which refreshing matters. The compiler does not insert an implicit update, reject a missing watcher, alter source admission, or change the Runtime/Adapter lifecycle.

## Concrete owner proposal and compatibility

The owner question does not require inventing a new contract. The repository already contains these related definitions:

| Existing definition | Current status | Responsibility relevant to #1453 |
| --- | --- | --- |
| `C-PROPS-0014` | active; owner question remains open | Raw/resolved Props and watcher dispatch; `applyRawProps` itself does not commit a render. |
| `C-LIFECYCLE-0003` | draft; explicitly refines `C-PROPS-0014` | Author `run.update()` intent, runtime/controller and host update entries, channel separation, non-recursive render, scheduling/coalescing and detached dirty intents. |
| `C-LIFECYCLE-0002` | draft; dependency of `C-LIFECYCLE-0003` | Accepted update cycle ordering through actual commit completion and `updated`. |
| `C-COMPILER-OBSERVABLES-0001` | draft | Selected Compiler profile's observable policy and compatibility boundary. |

The proposed resolution is to bind `C-PROPS-0014-Q-CORE-UPDATE-OWNER` to the existing `C-LIFECYCLE-0003` owner, retaining its `C-LIFECYCLE-0002` ordering dependency. The decision would accept `run.update()` as intent, permit host scheduling/batching, keep channel delivery distinct from render/commit, and count `updated` by completed commits. The separate render-time write-surface question in `C-LIFECYCLE-0003` should retain its own scope. This proposal has not been substituted for owner acceptance: the active Props question and both lifecycle draft statuses remain unchanged.

Compatibility remains explicit. The Runtime React Adapter keeps its `autoUpdateOnPropsChange` default. Compiler React-runtime and Vue2 keep their host defaults; React-DOM source, Vue3, WC and GPUI keep their recorded explicit defaults. The existing admitted `propsUpdatePolicy` choice remains the migration mechanism. Consumers that deliberately choose explicit delivery should retain a lawful request at the intended refresh boundary. The reported Shenko `watch(['label'], run => run.update())` fix remains valid; forcing a React key remount would discard continuity and is not the migration described here. Both the Compiler and React Adapter READMEs now explain the diagnostic's proof boundary.

## Executed evidence

The final focused command ran exactly the following suites in one worker:

| Suite | Passed | What it establishes |
| --- | --: | --- |
| `props-update-analysis.test.ts` | 19 | Source location, explicit/host selection, lawful other update causes, helper rename/re-export, dormant paths, unknown callbacks/recursion, pure reporting and actual CLI readback. |
| Existing `cli.test.ts` | 29 | Existing CLI workflows remain accepted. |
| Existing `diagnostic-registry.test.ts` | 13 | Existing rejection diagnostic registration remains accepted. |
| Total | 61 | Zero failed, pending or todo; exit 0; 6.74 seconds. |

Command:

```sh
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/props-update-analysis.test.ts packages/compiler/test/cli.test.ts packages/compiler/test/diagnostic-registry.test.ts --no-file-parallelism --maxWorkers=1 --reporter=default --reporter=json --outputFile=/workspace/scratch/62ffef219b8e/props-policy-work/analysis-cli-green.json
```

The first attempt was 16 passed / 3 failed. Those new test fixtures used unsupported raw `click` events; their diagnostics correctly required an admitted semantic event. Replacing that fixture input with `press.commit` fixed the test setup. The initial raw log and JSON remain archived; those failures are not labelled product regressions. The earlier fixture source was not snapshotted. Existing ES2024 target warnings remain in the raw logs.

The archive is [2026-11-24-props-update-analysis-evidence](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/2026-11-24-props-update-analysis-evidence/receipt.json). Its receipt includes the exact command, environment, reports, log digests, and seven implementation/documentation file hashes captured after the run. These are post-run slice hashes on a shared integration checkout based at `81c103bd462b73910f7279122fab5f282d172d56`; they are not a before/after whole-tree attestation or a final committed-head gate.

## Retained evidence and remaining acceptance

The six-cell consumer fixtures already cover default React Adapter, disabled auto-update, and compiled explicit policy, each with/without the lawful watcher. Their original text/style, DOM/handle/slot identity, lifecycle and repeated-update evidence remains valid for unchanged source. This change does not rerun or enlarge that prior evidence.

This slice completes an implemented, non-rejecting static advisory with actual negative, lawful-alternative and unknown controls, plus migration documentation. Final Compiler types/source-wall/distribution checks and current integrated-head gates remain with the Sprint integration. Real complete Shenko application acceptance and stable normative-owner acceptance remain separate conditions; neither is inferred from these 61 tests. No native browser, platform IME/AT, hardware or production acceptance is claimed by this compile-time change, and no GitHub Issue or PR was modified by this work.
