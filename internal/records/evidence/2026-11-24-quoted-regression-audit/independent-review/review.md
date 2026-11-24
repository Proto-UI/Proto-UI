# Proto-UI local independent technical review

Review date: 2026-11-24 UTC. Native execution status cutoff: **10:41:39 UTC**. Reviewer: `/root/independent_review`, separate from the agents that authored the source changes. The frontend's initial observer review and the added native-control registration review also used the independent child `/root/independent_review/frontend_review`.

**Reviewed integrated source:** `9c42d114afe55e6196393161b16b6e2f10d2e02d`, on main `952722e5b619c60ddf797543fba11eea6c06d812`.

The five substantive findings raised in this local review are resolved in the named source commits below. No additional substantive finding was identified in the final incremental cleanup change. This statement concerns the inspected source and the named checks; native browser acceptance, complete compiler acceptance, and external review remain separate and incomplete.

## Authority, routing, and boundaries

The reviewer followed the repository's `pui-dev` entry, resolved `pui-orient`, and routed the local review to `pui-review` in `human-assisted` mode with mode source `current-user`. The governing material inspected included `AGENTS.md`, the three skill instructions, `internal/agent-operations/skills.yaml`, contributor-agent and visual-evidence guidance, `spec/README.md`, and `internal/compiler/atomic-lowering-completion.md`.

The orientation handoff and review-docs eligibility check were unblocked. Their local intake explicitly described exact Git commits and the authorized local scope; it was not a canonical GitHub review input or an approval packet. Copies are retained here without changing that limitation. This artifact is a technical review record, not a platform verdict, approval, merge authorization, lifecycle promotion, or release acceptance. The reviewer made no source edits or external writes.

## Source sequence and exact scope

| Area | Original source reviewed | Final integrated source binding |
| --- | --- | --- |
| Button documentation | `530fd9678912ac0a85f9eb49107a064578d68c90`, compared with its parent `88fc0883bec70abbc0d7505d88370657c279639e` | Original changes rebased as `ed115be587adf72a2b768a06b1d6c81886743c56`; corrections in `fde1a4714861d37719c121771726aebb8d692ac6` |
| Contents wheel observer and browser assertion | Integrated candidate `8c248ddb30b99aca9ab9aab04c06141ecee7b12c`; subsequently checked after the main rebase | Initial changes rebased as `fead48e07523dbfa51eb38d4b7255ff1fe7694fa` and `d185836c5c7fdca8ff9dbf71a191758e042edd61`; fixes in `c81724e0d9fedd8aafffe808e95a6cd7cda13ad5` and `511ea9893e615143c2be6518fa08ad75b43c07f8` |
| Authored native wheel controls | `c94226bab7165e199a7dc975ea1270f6fdf41f5e` | Current-dialog receipt correction `b1ccd64cd82f03e537245ca8ae38c3fa24157e87`; primary-failure preservation `9c42d114afe55e6196393161b16b6e2f10d2e02d` |
| Callable-analysis resource limits | `fe4f9281f0f38418c61233e6e166f1b6969c20f8`, on `248f8270dd3458d1fcbc507e618337f98b9fde96` | Rebased integrated implementation `393bba802996c48758ef50bc3d6a73ede441c8bc`, on `952722e5b619c60ddf797543fba11eea6c06d812` |
| Compiler evidence updates | `a0382599d4cbade40abcc79c272f7152e7bab29d` and `4b59ddeeba8c5d63b4c58ee845c27b9d12c060d4` | Records only; no change to the reviewed compiler implementation |
| GPUI duplicate-name guard | Two-line `retainModule` guard in the earlier integrated candidate `8c248ddb30b99aca9ab9aab04c06141ecee7b12c` | Present in main `952722e5b619c60ddf797543fba11eea6c06d812`; dropped from the candidate's separate diff after rebase |

At the final review, Git comparisons confirmed that the four Button pages and style guide were unchanged from the corrected documentation commit, and that the callable-analysis implementation, new regression tests, worker fixture, and source-language documentation were unchanged from `393bba802996c48758ef50bc3d6a73ede441c8bc`. The 19-test observer/site-control sources also remain unchanged from their independently tested `511ea9893` version. `manifest.json` binds relevant source/instruction/record files to Git blobs and SHA-256 values at the reviewed final commit.

Later worktree commits and native results after the stated cutoff are outside this review unless explicitly added. The readiness increment was `4b59ddeeba8c5d63b4c58ee845c27b9d12c060d4..511ea9893e615143c2be6518fa08ad75b43c07f8`. The added native-control review then covered `511ea9893e615143c2be6518fa08ad75b43c07f8..c94226bab7165e199a7dc975ea1270f6fdf41f5e` and `c94226bab7165e199a7dc975ea1270f6fdf41f5e..9c42d114afe55e6196393161b16b6e2f10d2e02d`.

## Findings and resolutions

### F-DOC-BUTTON-001 — P2, resolved

Original location: both `apps/www/src/content/docs/{en,zh-cn}/ui-libraries/shadcn/button.mdx`, installation caveat at line 41.

The original correction marked Vue 2.6 and named `styleProfile` presets as workspace additions but continued to advertise `icon-compact` and `wrap` below the explicit published 0.2.0 installation command without the same boundary. The inspected 0.2.0 release source had sizes `default`, `sm`, `lg`, and `icon`, and did not expose `wrap`.

Resolution: `fde1a4714861d37719c121771726aebb8d692ac6` explicitly names `icon-compact` and `wrap` alongside the other workspace additions in both locales. The final source retains that correction. No claim was made that a published npm consumer was installed and exercised during this review.

### F-DOC-BUTTON-002 — P2, resolved

Original location: the same two Shadcn pages, preview coverage statement at line 18.

The single "Current Button test coverage" link pointed only to the Base catalog, omitting Shadcn's distinct visual evidence and remaining browser work. The Shadcn catalog included planned native bounds and a public Ghost journey blocked before paint observations; those were not established by the Base behavior catalog.

Resolution: the corrected pages separately link and name **Base behavior coverage** and **Shadcn visual coverage**. The final source does not imply that either catalog substitutes for the other. Both `P-BASE-BUTTON` and `P-SHADCN-BUTTON` remain draft; the documentation repair does not promote their lifecycle.

### F-WHEEL-001 — P2, source defect resolved; native negative control remains open

Original location: `apps/www/src/content/docs/zh-cn/contents-wheel-evidence.ts`, capture-listener cancellation sampling.

The original observer sampled `defaultPrevented` in a queued microtask and asserted that every listener had run by then. Native callback cleanup can perform a microtask checkpoint before later event listeners, so this could retain a premature uncancelled value. A trusted event plus separately changed scroll offset could then satisfy the evidence assertion despite a later listener cancelling the wheel default.

Resolution: `c81724e0d9fedd8aafffe808e95a6cd7cda13ad5` retains each bounded original `WheelEvent`, records its composed-path membership during dispatch, and samples `defaultPrevented` on each later read. Final lines 104–109 contain the read-time event facts. The new unit control proves that cancellation after an intervening checkpoint is visible on a subsequent observation. It explicitly identifies itself as an observer-lifetime control, not proof of native dispatch order.

The standards basis was checked against the [WHATWG HTML script cleanup algorithm](https://html.spec.whatwg.org/multipage/webappapis.html#clean-up-after-running-script) and [Web IDL callback invocation cleanup](https://webidl.spec.whatwg.org/#invoke-a-callback-function). No real-browser native cancellation negative-control result had been observed by the reviewer at the stated cutoff. Source resolution must not be reported as that control passing.

### F-WHEEL-002 — P2, resolved after two increments

Original locations: retained owner identity in `contents-wheel-evidence.ts`, and progress/final checks in `apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts`.

The original `sameSurface` comparison only compared the captured surface with the captured old element. Replacing the whole dialog could leave that expression true on a detached retained node. The browser's progress and settled checks also did not require a connected, current, usable owner.

First resolution increment: `c81724e0d9fedd8aafffe808e95a6cd7cda13ad5` queries immediate current public-dialog handles at every browser read and checks exact current dialog identity, connection, and split-surface identity during progress and after settling. This rejects a detached or replaced whole dialog.

The reviewer kept the finding open because a retained connected dialog could still move offscreen or lose scrolling after movement was observed. Controlled observations showed that both transitions could preserve `connected`, `sameDialog`, `sameSurface`, and `top: 100` while producing `ready: false`. Ordinary display/visibility-hidden roles are filtered by the public role query; the remaining counterexamples were lost viewport containment or scrollability.

Final resolution: `511ea9893e615143c2be6518fa08ad75b43c07f8` adds `expect(current.ready).toBe(true)` inside the original progress callback (line 1254) and `expect(after.ready).toBe(true)` after the two-frame settling read (line 1271). The original changed-offset assertion, movement-direction check, and **1000 ms** progress deadline remain intact (lines 1256–1259). A retained-owner control changes the offset to 100 and then switches overflow to hidden or moves the surface offscreen, showing that identity alone does not confer readiness.

The final observer still observes rather than injecting scroll offsets, CSS, focus, or synthetic input into the product journey. Controlled geometry and offsets are confined to the unit negative controls. Source review found no additional substantive issue in the final short increment.

### F-WHEEL-003 — P2, resolved in source; native execution remains pending

Original location: the new `apps/www/src/content/docs/zh-cn/contents-wheel-evidence.browser.test.ts` in `c94226bab7165e199a7dc975ea1270f6fdf41f5e`, unguarded inner `finally` at lines 119–126.

If an input/assertion failure was followed by a rejection from final observation or disposal, the `finally` throw replaced the primary failure before the outer catch recorded it. The first cleanup rejection also skipped later cleanup operations. This was a diagnostic/evidence integrity defect in the newly added authored control, separate from the product matrix's already guarded completion handling.

Resolution: final commit `9c42d114afe55e6196393161b16b6e2f10d2e02d` captures the body failure before the inner `finally`, guards final observation, dispatch retrieval, screenshot, observer disposal, handle disposal, and context closure individually, and records supplemental completion errors. The original assertion remains `receipt.error` and the thrown failure. If only completion fails, an `AggregateError` fails the test. The final file is byte-identical to author fix `9bd8a7da39e47141900dcf7fc243703c9796fb5a`, which was also independently inspected. The preceding `b1ccd64cd82f03e537245ca8ae38c3fa24157e87` correction applies fresh public-dialog resolution to all native-control readings, including its final receipt.

The two authored controls use actual `page.mouse.wheel` calls, require one trusted wheel with both owner-path facts, verify positive movement when uncancelled or unchanged offset when cancelled, and then replace the whole dialog to require disconnected/stale identity. They do not certify the public Popover. The independent child found no additional substantive issue in those assertions and verified exactly-once development/browser/shard registration, exclusion from the general phase, and absence from production suites. That validation was a pure inventory check, not a browser run or an independent rerun of the recorded 138-test runtime-plan suite.

## Compiler review: scope, checks, and remaining red test

No new substantive defect was identified in the bounded resource patch within the reviewed scope. The reviewer inspected per-analysis-pass accounting, the 16,777,216 counted-work envelope, the 128-active-call boundary, copy/join charging before relevant allocations, fingerprint visitation, cleanup, source-context diagnostics, and fresh-pass state. These are limits on instrumented abstract-analysis work, not a universal heap or wall-time guarantee.

The exhausted proof fails closed with the explicit unsupported diagnostic, rather than emitting partial output or changing alias precision. Demand-only traversal marks the interrupted analysis opaque; downstream consumers that rely on complete demand information were inspected for conservative handling. The pre-existing worklist and fingerprint checks remain. The newer main changes to scalar references, lexical reads, and nullish/Boolean flow were inspected in the rebased source; no semantic conflict with the resource patch was identified.

The independent final compiler run covered five files: `callable-analysis-budget`, `reviewer-callable-fingerprint`, `reviewer-mutable-callable-orders`, `json-boundary-provenance`, and `reviewer-observed-closure-demand`. It produced **106 passed / 1 failed**, exit 1. The remaining failure is `json-boundary-provenance.test.ts:182`, "preserves known nullish spread has no enumerable fields", receiving `PUI1006` instead of success. The compiler author independently reproduced that failure on clean `952722e5b619c60ddf797543fba11eea6c06d812`; the reviewer inspected that baseline log. It remains red and is not attributed to this patch or reclassified as a pass.

The new real-Drawer resource regression and recursive-record regression passed. The Drawer regression requires normal child completion with explicit refusal and then successful unchanged Transition and Button controls in the same worker. A separate reviewer lower-level IR probe observed small nested call chains completing, larger chains reaching explicit call-depth refusal with demand opacity, and a fresh small analysis completing afterward. That probe is lower-level characterization, not public-source or native-consumer acceptance; its output was observed in the tool transcript rather than retained as a standalone raw log.

The author-supplied current inventory record reports clean main timing out at 180087 ms after 1 of 6 implemented-profile rows, versus the integrated candidate exiting normally after 30961 ms with all 6 rows **UNSUPPORTED / PUI1007**. The reviewer inspected the record and associated baseline diagnostics but did not independently rerun the six-profile inventory. These are bounded worker-completion results, not successful Drawer admission, lowering, full-library coverage, native behavior, or isolated performance benchmarks.

## GPUI producer guard

The `retainModule` duplicate-name guard is before directory and artifact writes (final `packages/compiler/test/fixtures/gpui-ordinary-values/produce.mjs`, lines 49–50). The caller routes and synchronous receipt update were inspected. The duplicate external-scroll fixture had already been removed upstream, so the remaining value of the guard is to reject future duplicate names before overwriting a prior generated module.

For a root-supplied real-producer mutation repeating `transition` with a different source, the reviewer inspected the logs and independently hashed the generated authored and Rust outputs. The unguarded run retained duplicate receipt entries and overwrote the first files with the second module. The guarded run reported `Duplicate native consumer module: transition`; the first authored and Rust files remained byte-identical to the first receipt. The mutation was not rerun by this reviewer, and no Cargo or mounted native-consumer claim follows from it. The guard now belongs to the rebased main rather than a separate candidate diff.

## Executed checks and retained evidence

| Check | Result and attribution |
| --- | --- |
| Final frontend focused controls at the `511ea9893` source, unchanged at `9c42d114` | Reviewer executed: **19 passed / 0 failed**, 2 files, exit 0; eight observer controls plus eleven site-evidence controls |
| Earlier frontend controls at `c81724e0` | Reviewer executed: **18 passed / 0 failed**, exit 0 |
| Integrated compiler focused checks | Reviewer executed: **106 passed / 1 failed**, 5 files, exit 1; known baseline nullish-spread failure retained |
| Original standalone compiler resource tests | Reviewer executed: **2 passed**, before the rebase |
| Review-admission boundary controls | Reviewer executed earlier: three selected tests passed; no platform approval action performed |
| Public-doc validation | Reviewer executed earlier: 307 routes, 4 inventories, 446 maintained documents passed; final corrected docs remain unchanged. A separate root-executed `c817` log is retained with its provenance |
| Native-control suite registration | Independent child executed pure runtime-plan inventory checks: exactly once in development/browser/shards, excluded from general, absent from production; inventory consistency passed. No Chromium execution |
| Final integrated whitespace/error check | Reviewer executed: `git diff --check 952722e5b619c60ddf797543fba11eea6c06d812 9c42d114afe55e6196393161b16b6e2f10d2e02d` passed |
| Original documentation evidence integrity | Reviewer checked stored/raw hashes, byte counts, and reviewed source bindings in the original manifest |
| Baseline nullish-spread and recursive-record diagnostics | Author executed on clean main; reviewer inspected the raw logs. Nullish spread remained `PUI1006`; recursive record retained `PUI1999` / `RangeError` before the patch |

The retained logs include Vite/esbuild's existing ES2024 target warnings; they were not suppressed. An earlier whole agent-operations run was interrupted and was not counted as a pass. Earlier agent-doc setup failures likewise remain failures/setup limitations; a narrower linked generation check passed and was not substituted for full acceptance.

The final focused frontend command was:

```sh
corepack pnpm@10.32.1 exec vitest run \
  apps/www/src/content/docs/zh-cn/contents-wheel-evidence.test.ts \
  apps/www/src/components/site-contents-evidence.test.ts \
  --maxWorkers=1 --minWorkers=1 --reporter=dot
```

The independent integrated compiler command was:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/callable-analysis-budget.test.ts \
  packages/compiler/test/reviewer-callable-fingerprint.test.ts \
  packages/compiler/test/reviewer-mutable-callable-orders.test.ts \
  packages/compiler/test/json-boundary-provenance.test.ts \
  packages/compiler/test/reviewer-observed-closure-demand.test.ts \
  --maxWorkers=1 --minWorkers=1 --reporter=dot
```

## Explicit limitations

- No native homepage wheel matrix or native cancellation negative control passed within this review. Local browser launch had previously been blocked by process-singleton socket `EPERM`. The parent reported that remote transport had recovered and native execution was starting, but no resulting receipt or pass had been observed by this reviewer at 10:41:39 UTC. Subsequent native evidence must be bound and assessed separately. The historical +0 movement failure's root cause is not established, and the test-observer repair is not a proven production scrolling fix.
- No installed npm 0.2.0 consumer or tarball was executed. Release compatibility was checked against primary repository source at tag commit `70e2eb1a1bcd9264cf8c08e6ede210f96ee04606`, including CLI adapter registration and Base/Shadcn Button sources, alongside current workspace contracts and source.
- No complete compiler suite, whole-workspace suite, full library inventory, Cargo check, mounted GPUI consumer, or successful Drawer profile acceptance was independently established. The known baseline compiler test remains red.
- Source-local findings and their fixes do not establish visual coverage, stable lifecycle, release compatibility for untested combinations, platform review eligibility beyond the scoped local routing, or merge/publication authorization. No PR publication or other external-write result is claimed.

`manifest.json` distinguishes reviewer-executed logs from supplied baseline/root logs and records original paths, byte counts, and SHA-256 digests. The copied routing artifacts retain their original descriptive local references and are not transformed into canonical platform packets.
