# Sprint 2 historical Compiler sweep and full library/profile inventory

This record preserves author-run observations from the clean source revision `5cb80eb937f20982dd7dc8cbc93a90e91d665c31`, tree `e4bba41d5cd6afbdd34cae0a0dce9a1c6fa3eed7`. It also records separately bounded follow-up repairs on an isolated dirty source tree. It does not report current-head CI, independent acceptance, or a fully admitted library. Earlier failures, skips, OOM attempts and untested rows remain historical results after a later repair.

## Original source and execution binding

The remote checkout was an independent detached checkout at the revision above. Its source and dependencies were not linked to the earlier execution checkout. Installation used Node 24.22.3 and pnpm 10.32.1 with the frozen lockfile, `--ignore-scripts --offline`; the install terminated successfully. Outputs lived outside the checkout. Compiler batches polled HEAD and worktree state during execution and required clean, unchanged pre/post states. Inventory workers and the final official merge used the same repository, checkout path, toolchain and history binding. No source or threshold was edited during these sweeps.

The final bundle was 1,173,419 bytes with SHA-256 `2b4851bfdf69d9c6b8d76a14d854ae653880f64ba9f6fb62db926ce65a1986e4`. Historical revision `35195a6e6f1ba6a7d800da0029f2683013abd18b` was restored as real Git objects before inventory execution: 394 blobs, including 178 Base and 216 Shadcn source files. Its membership digest was `8ff2977a9c5d101beba1975b999cd87d7a257f4470fa97a86643e58278a7b8f8`. The failed earlier restoration commands remain in the original setup archive.

## Original full Compiler sweep

The exact tracked universe contained 283 test files: 268 general files and 15 browser files. Each file ran in a fresh process with a 1,536 MiB heap limit and the original test/hook timeouts. Two disjoint general shards completed first; the 15 browser files then ran serially. The wrapper's outer process deadline was 1,800 seconds and did not override any Vitest assertion or hook budget.

| Original job      | Files executed | Assertions passed | Assertions failed | Assertions skipped |
| ----------------- | -------------: | ----------------: | ----------------: | -----------------: |
| General shard 0/2 |            134 |             1,935 |                21 |                 10 |
| General shard 1/2 |            134 |             2,305 |                14 |                 88 |
| Browser 0/1       |             15 |               228 |                 0 |                  0 |
| Total             |            283 |             4,468 |                35 |                 98 |

All 283 files launched and produced terminal batch receipts. The general sweep had 251 passing files and 17 nonpassing files under the strict wrapper predicate. The browser sweep passed all 15 files. A skipped native dependency check does not count as passed execution, even if Vitest exits zero. The complete aggregate, selected filenames, per-batch guards and every nonpassing assertion are in `evidence/2026-11-23-sprint2-compiler-inventory/compiler-aggregate.json` and `compiler-nonpassing-assertions.json` in the same directory.

The original red groups comprised generated Transition channel typing (1), the diagnostic registry scanner (1), GPUI scalar ABI expectation after constant inlining (1), retained JSON boundary provenance (17), getter publication (10), GPUI optional ControlLabel argument handling (1), the Vue2 timing matrix (1), the Vue2 authored Presence test (1), and two dormant-helper expectations (2). The 10-second `native-support-migration` beforeAll failure left 78 assertions skipped. The remaining 20 skips were native environment conditional checks. These classifications do not convert the original 35 failures or 98 skips into passes. The exact messages and raw suite-level hook failure are retained.

The three bounded timeout continuations belong to later source-bound records: `transition-timing-matrix.test.ts` (Vue2, original 180 seconds), `native-presence-presentation.test.ts` (Vue2, original 30 seconds), and `native-support-migration.test.ts` (original 10-second beforeAll). This record claims no unobserved continuation result.

## Original complete inventory denominator

The frozen inventory universe was 1,015 authored entries times 12 profiles, or 12,180 rows. Six profiles were implemented, accounting for 6,090 rows. Universe fingerprint: `4d364cc526bfc712994596a9f6c886a848271cdbca4e1a7d1ef5665115919ce5`.

| Original row status |   Rows |
| ------------------- | -----: |
| PASS                |  1,782 |
| UNSUPPORTED         |  4,281 |
| FAIL                |     21 |
| UNTESTED            |      6 |
| UNIMPLEMENTED       |  6,090 |
| Total               | 12,180 |

Shard 0 completed 508 entries. Shard 1 completed 11 entries before Base Collapsible Content exhausted a 1,024 MiB heap. The permitted 2,048 MiB recovery also exhausted its heap at the same entry. Both SIGABRT/OOM attempts remain. A separately recorded continuation selected the other 495 entries, preserving the failed entry outside that selection. It completed all 495 entries; its process exit zero did not make the original inventory a pass. The merged report contains 1,016 recorded attempts, two failed attempts and no missing process receipts. Only 1,014 distinct entries completed, leaving the one Content entry untested for all six implemented profiles.

The official merge command actually ran and exited 2. The exported `assertCompleteInventory` predicate actually ran and exited 1 because an implemented row remained UNTESTED. Both `admissionCoverageComplete` and `allImplementedEntriesAdmitted` were false. No CI environment or approval receipt was fabricated to replace this local strict predicate execution.

The 21 FAIL rows have three concrete causes:

| Rows | Exact source group | Original evidence |
| --: | --- | --- |
| 10 | Shadcn AlertDialog action/cancel, five Web profiles | PUI2002 at `dialog/action-paint.ts:46`, ordinary setup helper Rule rejected by its stored helper phase |
| 10 | Shadcn Drawer trigger/close, five Web profiles | PUI2002 at `drawer/command-paint.ts:29`, same helper phase mismatch |
| 1 | Shadcn Select Value, Vue2 | PUI1999, setup-result callable provenance lost in the Vue2 logical-expression collector |

The Vue2 fix and its later validation are owned by a separate root record. The 20 Rule rows have the bounded follow-up below. Neither follow-up changes the counts of the historical merged report.

## Rule phase follow-up

Authority is the draft `C-RULE-0004` setup-only declaration contract together with the existing Compiler actual-callable-phase rules. The real sources call their ordinary paint helpers synchronously during setup. A harmless `const cdef = def` alias causes the helper IR to retain `phase: callback` and `context: helper`; the receiver still has proven `def` authority. The old validator rejected this label instead of checking the actual call phase. In the opposite direction, a helper without the alias retained `phase: setup` and could be called from a mounted callback or renderer without the required refusal.

The repair keeps the receiver check, defers a helper's Rule phase to callable analysis, and checks `rule.declare` at the real execution phase. The existing guarded raw-entry semantics still treat an illegal phase as an exceptional completion, preserving preceding effects and catch/finally successors. No prototype, operation definition, profile gate or timing threshold changed.

The common pre-Rule callable file SHA-256 was `81ea28d9aa8e6ee49803b9b77f93391e4400d2635df98fdd513b53fb4d8a09c0`. The candidate callable SHA-256 was `c7ecf4abc87e80f94fe87faaed54bbe2a354d8e3bbb4231a618185fae934d8ef`; the validator SHA-256 was `5ac930b76ee1e7275ff39950fd4639f7351e5f8672479a0efe7d632b814c4b09`. The incremental patch digest was `49df2c601ac347f5805205ac03868ce5c47ffbbb947bcaf8759b4af69170b355`. The archive includes the complete dirty overlay against 5cb and all affected file hashes, rather than attributing these checks to an unmodified commit.

Sixteen new cases ran against the common baseline: 4 passed and 12 failed. The candidate then passed all 106 assertions across the new Rule file and the whole existing callable-context, render-provenance and Rule-scope files, with zero skips. Source and transported cold IR both refuse actual callback/render Rule calls. The existing Rule-scope tests instantiate ordinary generated imports in four native Web frameworks under the synthetic DOM test environment.

The original four affected authored entries were independently loaded from their actual source graph and recompiled for all five Web profiles: 20/20 produced output. Each entry also passed source and cold IR validation. Closure and emitted-code hashes are retained. This is source-to-emitter follow-up evidence, not a full rerun of 12,180 rows or a new actual-browser acceptance claim.

The first diagnostic probe lacked the package source mapping and stopped at PUI1003; that invalid premise remains recorded. An early focused run lacked React test dependencies; another cold-IR fixture looked for the wrong Expose function context. Both failed attempts remain and are not used as valid product red/green evidence. The final baseline and candidate reports use the repaired test fixture and unchanged production candidate.

## Collapsible phase follow-up after the allocation fix

The host callback fixed-point repair stopped allocating new parameter identities on each repeated analysis visit. That removes the observed nonconvergence; its red/green and mutant evidence are retained by the separate host-flow record. It does not establish that the original Content is now admitted.

On the Rule candidate above, the exact Base Content source still returned PUI1007 at `content.proto.ts:47` for all six implemented profiles in bounded execution: `state.setDefault is not permitted in callback.` The first statement of its public `bindPresence` method is the deliberate setup-only guard `hidden.setDefault(hidden.get())`. It precedes the Context binding and watch registration. Removing it would change the authored protocol and is not a fix.

The draft `C-DISCLOSURE-PRESENCE-0001-BINDING` explicitly requires setup-only binding; `P-BASE-COLLAPSIBLE-CONTENT-AUTHORING-ENTRIES` requires the direct and as-hook entries to implement the same Content protocol. The State phase guards are consistent with `C-STATE-0004` and `C-STATE-0007`. The minimal paired probe shows the Compiler's present boundary: the direct exposed guard is rejected; the raw as-hook method invoked synchronously during setup passes source and cold IR; an explicit runtime call to that raw method is rejected.

The Compiler's documented guarded implicit raw-entry analysis currently applies to the as-hook capture boundary. A direct public entry is still analyzed as a strict callback. The remaining diagnostic is a Compiler coverage gap for this legal setup-only protocol, not evidence that the prototype should lose its guard. This follow-up introduces no new direct-public-entry admission and does not convert the historical six UNTESTED rows to passes or unsupported completion.

## Archive and resource boundaries

The three original Compiler archives include terminal plans, raw Vitest JSON, stdout, batch receipts, launcher receipts and emitted/native browser detail artifacts when present. The inventory archive includes the original shard and continuation reports, every row/closure/attempt, both OOM attempts, exact continuation selection, official merge and strict-gate output. Every archive has a per-file SHA-256 index and is decompressed and checked against that index. The remote archive manifest is `archives.json`; the local Rule/Collapsible archive is `rule-and-collapsible-followup.tar.gz` with its own index and freeze.

The 2-second resource sampler started after the general jobs had begun. Across 1,207 samples, its process-tree RSS sums peaked at 1,214,728 KiB and 1,374,356 KiB for the general shards, 1,742,988 KiB for browser execution, 1,073,008 KiB for inventory shard 0 and 1,306,296 KiB for initial shard 1. These are sampled process-tree sums, with potentially duplicated shared pages, not kernel lifetime peaks. The sampler did not cover the later recovery or remaining-entry jobs. GNU time recorded 2,328,536 KiB for the failed 2,048 MiB recovery and 1,095,964 KiB for the 495-entry continuation.

All original Compiler and inventory producers reached a terminal receipt. The inventory has six rows without completed compilation results because both attempts failed, not because the original denominator was reduced. Hardware, assistive-technology, other unimplemented profiles and current-head complete acceptance remain outside these observations.
