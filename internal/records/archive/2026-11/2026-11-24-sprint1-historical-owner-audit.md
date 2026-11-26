# Sprint 1: original #1488 inventory and disposal followups

This record preserves the original 401-PR audit denominator and adds a bounded source review with two real AdapterHost regressions. It does **not** declare all 315 historically unfinished reviews complete, infer their individual membership, or accept the complete #1488 G framework/target matrix.

## Original inventory and provenance

The initial #1488 issue snapshot enumerates 401 unique merged PRs against baseline `aa6d6b15d4aedb2863a935168dac73ea5f26ace1`, with the original summary **86 bounded static / 142 partial / 173 scope-metadata / 0 fresh source executions**. The individual assignments to those three review classes were not present in the recovered issue body, two issue comments, retained repository records, or the bounded personal-context followup. They remain unknown. The current 9 named followups may overlap the original 86 and must not be added to it.

All 401 PR metadata records and complete changed-file inventories were recovered from the existing public Sprint 7 source archive. None of those file inventories reports truncation. All 401 landed merge objects are present locally; 6 original head objects are absent. Some historical blobs are also absent from the partial clone. Local landed diffs and original GitHub per-file patches are identified separately in the receipt archive; a retrieved patch is not falsely called a fresh native execution or a whole-PR acceptance.

Authoritative retained inputs:

- `internal/records/2026-11-22-sprint-7-history.snapshot.json.gz`.
- `internal/records/2026-11-22-sprint-7-history-sources/index.json` and its four metadata parts; concatenated compressed source SHA-256 `ac608aa6460b81ede93e8116cbdf112bc0d34e242a476726d8ced474938b3eaf`.
- Original issue enumeration and fetched comments are retained in this record's receipt archive.

The [401-row inventory](evidence/2026-11-24-sprint1-historical-owner-audit/original-401-risk-inventory.json.gz) preserves every original number, title, scope, head/base/merge identity, full changed-file list, local-object availability, original review-class unknown, this-pass disposition, and remaining source-specific review prompts. Path-derived groups are **nonexclusive**: 59 Runtime/Adapter owner PRs, 84 Compiler/CLI, 143 website control/projection, 93 prototype component, 96 CI/release/harness, and 176 documentation/demo PRs overlap. These numbers describe routing, not findings or completed audits.

## Source reviews actually performed

| Original PR | Read scope | Finding and remaining boundary |
| --- | --- | --- |
| #900 | Landed Runtime disposal patch, lifecycle criterion/fixture changes, current `finalizeDispose`, affected current resource tests | Ordinary authored `beforeDispose` remains fail-fast; failed-created cleanup still attempts its full reachable sequence. Existing private-error aggregation remains unchanged. Those Runtime consumers are included in the final 79-case run. Other lifecycle error policies and draft activation remain separate. |
| #1029 | Landed Anatomy PartView patch and current exposed-call wrapper | The separate failure-presence flag still preserves falsy thrown values and normal `undefined` returns. No new cross-host retired-PartView execution is claimed. |
| #1030 | Original three-file patch and current canvas source-lease implementation | First observer failure, full listener snapshot notification, paint-primary precedence, and terminal listener retirement remain explicit. Current reentry checks were read. Native drawing, GPU/optical behavior and the whole material subsystem were not accepted here. |
| #1031 | Original patch, current AdapterHost/Runtime path and new real consumers | Both disclosed followup gaps were reproduced and repaired: deferred cleanup masked the original Runtime failure; synchronous reentry returned a different already-successful Promise. The precise results below do not replace native framework error-delivery acceptance. |
| #1036 | Original five-file patch and current bulk reset implementation | Bulk reset still attempts later modules and reports the first failure, including falsy values. Named reset and same-vault fail-fast remain distinct. Current real Props consumers passed; this does not assert that a throwing vault notified all its own listeners. |
| #1076 | Original capability plumbing, current shared view-owner and Runtime operation generation, actual framework test boundaries | Epoch/provider/present invalidation is distinct from terminal retirement. Full native WC transport, all framework scheduling/refusal combinations and current complete Compiler admission remain open. The actual React/Vue/Vue2 test files use the frameworks in synthetic DOM; they are not native browser evidence. |
| #1283 | Original window-blur pointer-cancellation patch and its controls | Exact canceled pointer identity, zero-detail independence, Portal dispatch consumption and the synthetic Shadow retarget premise are recorded. Current complete event-router review and physical input/native retarget were not completed here. |
| #1475 | Original strict-ancestor Context disposer patch and current `asHook` selection/wrappers | `subscribe`, `trySubscribe` and `trySubscribeAncestor` all enter the Context disposer collection. Setup-only phase and the draft decision are retained. A fresh whole `asHook`/generated/native consumer matrix was not run here. |
| #1481 | Original four-file detached Select alignment patch | The original rejected-geometry and genuine-repair distinction is recovered. The locally missing original head is recorded. Current full controller review and native acceptance are separate; archived PR narrative is not new execution evidence. |

The rest of the 401 rows are explicitly marked `not-substantively-rechecked`. Shared source closures are a way to organize actual patch review, not permission to mark every integration PR that touched that source fully reviewed. Large integration PRs keep their unreviewed paths and target obligations.

## #1031: reachable asynchronous error precedence

The original PR intentionally fixed only the synchronously terminal branch and disclosed the deferred `.finally` precedence as separate debt. The current Runtime still offers a real way to reach it: an already-running `unmount()` invokes `onUnmountBegin` or an authored `onUnmounted` callback; that callback calls `AdapterHost.dispose()` and then throws. Runtime waits for the current unmount callback pass before final disposal. No fake RuntimeSession, intercepted Promise, fake framework scheduler, fabricated browser receipt, or arbitrary held Promise is needed.

The old AdapterHost `.finally(finishAfterUnmount)` replaced that initiating failure when Adapter cleanup also threw. Six original values (`undefined`, `null`, `false`, `0`, empty string, and an Error object) at both real entry points produced **12 failures / 7 passing controls / 0 skipped**. The cleanup-only and healthy controls already passed. The first repair made the Runtime rejection primary while still attempting `afterUnmount` once; **66/66** affected cases then passed.

## #1031: synchronous reentrant completion

The next real consumers called `dispose()` from authored `beforeDispose` and Adapter `afterUnmount`. Previously, the cached completion was assigned only after those callbacks. Reentry therefore received a separate fulfilled Promise, even when the original disposal subsequently rejected. Twelve failure cases and a hook-return control produced **13 failures / 19 already-passing cases / 0 skipped** on the intermediate source.

The final implementation publishes one pending completion **before** invoking Runtime or Adapter cleanup. That cached Promise replaces the previous independent once flag. Every reentrant and later call returns the same completion; there is no second Runtime session or owner. Runtime disposal still starts once, `afterUnmount` still runs once, and already-synchronous terminal cleanup stays in the same turn.

Resolution and rejection are explicit. Neither fulfillment handler returns the published Promise. `finishAfterUnmount` discards the notification hook's return value, as before; the real control in which a cleanup hook returns its own published completion finishes successfully instead of self-awaiting. An existing Runtime failure remains primary over a secondary Adapter failure in both branches, including falsy values. If Runtime succeeds, an Adapter failure is reported unchanged. Runtime's internal multi-error aggregation is untouched.

## Exact execution and retained evidence

Final focused command, with the existing case budgets unchanged:

```sh
node node_modules/vitest/vitest.mjs run \
  packages/adapters/base/test/adapter-host.test.ts \
  packages/adapters/base/test/sprint1-async-disposal-precedence.test.ts \
  packages/runtime/test/contract/lifecycle.session.transitions.v1.contract.test.ts \
  packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts \
  --maxWorkers=1 --minWorkers=1 --reporter=json --outputFile=sync-disposal-green.json
```

Final result: **79/79, 0 failed, 0 skipped**: 8 original AdapterHost cases, 32 new real reentry/error cases, 14 Runtime transition cases and 25 Runtime resource cases. The new file uses Node with actual Promise microtasks; the existing tests retain their own declared environment. This is not Chromium, native framework scheduling, accessibility, physical-input, performance or complete Sprint 1 acceptance.

The [manifest](evidence/2026-11-24-sprint1-historical-owner-audit/manifest.json) binds the reviewed working-tree bytes, checkout HEAD and every archive member. Root's integration work could change other files concurrently; no assertion of an unchanged whole workspace is made. The two red source/test snapshots and both green stages are retained separately. The first red fixture was recovered exactly and checked against its pre-execution SHA-256 before archiving; later assertion improvements are not relabeled as the earlier fixture.

- [Receipt archive](evidence/2026-11-24-sprint1-historical-owner-audit/receipts.zip): 244,689 bytes, 44 members, SHA-256 `dac857b69c2ea19c7e14544a2af6879b0c4164a48a607c7c0603e1b0ae20d95d`.
- Compressed 401-row inventory: 820,006 bytes, SHA-256 `1fec7f70c7d04d1b7f464a92d87bf687f7bc06273973b03acc6838534e1d59f3`.
- Every ZIP CRC and manifest SHA-256 was read back; decompression retains exactly 401 unique rows.

## Remaining acceptance

The integration author separately read the final AdapterHost change, all 32 new consumers, the retained red/green receipts, and the real `RuntimeSession.dispose` implementation. Runtime publishes its own completion before callbacks, catches synchronous failures into that completion, and returns a Promise on every path. The Adapter change preserves that contract, synchronous terminal cleanup, falsy failures and the original Runtime error priority. This bounded source review found no blocking defect; it is not a submitted GitHub approval or a claim of complete G acceptance.

The original 86/142/173 classification remains an aggregate, with no invented per-PR assignments or net completed count. The rest of the original patches, public owner changes, target/compiler closures and source-bound independent acceptance still require work. The new disposal fix still requires final-source CI. The #1488 E native Search/Dialog retirement probe has its own separately source-bound receipt; it does not accept the complete G first-error/scheduling/detach/rebind/dispose combinations. Earlier failed, canceled, unexecuted or synthetic-only results remain attached to their actual source and environment.
