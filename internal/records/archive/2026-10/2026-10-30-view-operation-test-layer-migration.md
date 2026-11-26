# Source-view operation physical-host test migration

2026-10-30. Non-normative engineering record for #1071 / #1076.

## Observed baseline, not retroactive success

At `f6b5b3d8d4b14953f0240b9edcec21ed49c58475` (tree `a961241e3b787370dd297edfc8c48c7413b1d471`), the original supplementary contract lane was **93/95**. HappyDOM **15.11.7** failed the exact owned move positive and the first legal-move precondition of nested author removal. [The original run](https://github.com/Proto-UI/Proto-UI/actions/runs/41005441132/job/123899169415) and artifact `12958630297` retain these failures. Earlier b3 had the same two failures; its artifact is `12954328243`.

The same f6 source passed all **eight physical cases** in Chrome 156.0.8078.47: [native run](https://github.com/Proto-UI/Proto-UI/actions/runs/41005441132/job/123899169639), artifact `12958417347`, ZIP SHA256 `975a541bc270df56fcf13c87a2cc3786122cc8e0c7e1bfcbbac171a843f69516`. Actual native legitimate append reactions observe the connected destination; explicit remove reactions observe disconnection. The simulator instead calls disconnect during its intermediate detach. This is measured evidence, not a mocked callback ordering or a claim that HappyDOM is fixed.

Related #1000 concerns HappyDOM **20.14.6**, packed Checkbox Label and child-before-parent connection ordering. It is not the same version or failure; this migration does not modify that issue's packed tests or dependencies.

## Atomic responsibility transfer

The physical eight-case test is retained verbatim except relocated relative imports in `packages/adapters/web-component/test/diagnostics/view-operation-withdrawal.happy-dom.ts`. The normalized source SHA256 remains `6714f42886fccfb6c4502a3aa4a5754543db523d985fc5c78f593bddd0aafd31`. Reproduce the original simulator diagnostic with the unchanged locked dependencies:

```sh
node node_modules/vitest/vitest.mjs run --config packages/adapters/web-component/test/diagnostics/view-operation-withdrawal.config.ts
```

That command is expected to preserve the recorded two failures; it is not a passing acceptance lane. No assertion, callback, product implementation or dependency version is changed to make it green.

All eight physical obligations move together to the normal mandatory browser inventory. The existing chain is `test-plan → assigned test-browser shard → source-bound receipt → test aggregate`. The browser suite creates a fresh output directory, executes the real Adapter fixture, checks the actual checkout SHA/tree, runner exit, all artifact hashes, exact cases and semantic expectations, complete native callback sequences and empty page/cleanup errors. A synthetic merge is identified as that actual checkout, not mislabeled as the PR head. No `ci.yml`, protection rule, original caller-relocation job, budget or permission is changed.

| Native case | T-LIFECYCLE-VIEW-OPERATION-0001 suffix | Preserved obligation |
| --- | --- | --- |
| remove-root | CASE-WC-ROOT | Invalid before deferred disposal |
| remove-source | CASE-WC-SOURCE | Invalid before deferred disposal |
| unrelated-reinsert | CASE-WC-REINSERT | No old revival; new capture current |
| terminal-replacement | CASE-WC-REPLACE | One real disposal; old false, new current |
| owned-transport | CASE-WC-TRANSPORT | Exact same-owner move current after finally |
| nested-author-remove | CASE-WC-NESTED | First legal move current; nested author remove permanently invalid |
| second-reconnect | CASE-WC-RECONNECT | Two actual reaction pairs; false after finally without intermediate query |
| aborted-transport | CASE-WC-THROW | Original error and parent; current; zero move reactions |

Pure Runtime/shared-owner/three-framework lifecycle tests remain unit coverage. The prior fifteen nonphysical files contained 87 assertions; new receipt-control tests are additional controls, not additional native cases. They reject missing registration, stale or missing identity, empty cases, weakened expectations, missing/wrong native reactions, page/cleanup failures, and missing/empty/skipped/ failed required suite reports. A checksum control protects the archived original.

## Acceptance still pending

This candidate must pass its own exact-head required inventory/browser/receipt chain before migration is accepted. The f6 isolated eight-case pass cannot prove the new wiring. Unrelated required failures still block the aggregate. Keep the original 93/95 baseline and caller-relocation focus failure visible.

These tests do not implement or validate Menubar's consumption of the operation, source-removal entry cancellation, Compiler admission/lowering, four-host native conformance, or controlled-owner rejection. Those obligations remain separate.
