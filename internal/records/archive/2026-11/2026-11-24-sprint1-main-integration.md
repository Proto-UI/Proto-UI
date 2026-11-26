# Sprint 1: reconcile the follow-up with current main

Date: 2026-11-24, Asia/Shanghai. This is an implementation and execution checkpoint for [draft PR #1745](https://github.com/Proto-UI/Proto-UI/pull/1745), not a Ready, merge or release declaration.

## Exact source and preserved work

The [previous follow-up checkpoint](2026-11-24-sprint1-post-merge-followup.md) was published at `52f60128dbc0f34029ad849fad8d86e54e5614f1`. While it was prepared, main advanced from `824f7b12d828a179670e1d751f5f2c14d97d995d` to `457d27f7fe554f398970a836ee9c95edb4846f47`: 67 commits and 422 changed leaf paths. Ten paths overlapped the follow-up, and an actual normal merge reported five source conflicts. The original merged PR #1711 was not reopened or relabeled.

This checkpoint resolves those conflicts without replacing either parent's history. The pending merge's first parent is `52f60128dbc0f34029ad849fad8d86e54e5614f1`, and its main parent is `457d27f7fe554f398970a836ee9c95edb4846f47`. The complete source tree before adding this record is `eabcf2de14db7938c551bf04101c8cd4a8eaf9a1`. Both earlier execution archives remain byte-identical. The original seven Sprint 1 commitments and their remaining issue-specific conditions remain open under their original criteria.

## Reconciliation decisions

- **Shadow selector validation:** main and the follow-up had added the same optimization independently. Keep one live-field validation wrapper and one cache, with at most 32 entries and 1,048,576 UTF-16 text units. Do not stack a second cache. Preserve main's fresh canonical copies and four new reentry/owner controls.
- **Shadow rule parsing:** retain all main percentage, intrinsic-full-width, marker and current-source checks. Add only the bounded immutable pure-text parse products. Recipe decisions, owner state, validation, DOM effects and cleanup remain fresh.
- **CLI declaration identity:** retain the single SourceFile-aware identity implementation, which also covers main's narrower cache correction. Preserve both sides' distinct lexical controls. The lexical file now has 34 cases.
- **CLI rule fixtures:** retain the ten row-only negative controls and the independent positive rule. Add main's ten mixed-rule cases, including every real collector assertion, in a separate group. The complete lowered file now has 199 cases, one unchanged full-inventory gate, and its original 240000 ms case bound.
- **CI entry points:** main deliberately made browser acceptance manual-only in the GPUI wrapper. The only reusable input is Adapter acceptance; actual callers do not pass a browser input. The original 31 controls now enforce the manual browser default/type/required/callee boundary and reject even a false undeclared reusable input. Every unique native target remains present exactly once.
- **Compiler source wall:** review main's actual three changed sources and renew only their exact fingerprints. Register its one new literal edge from Core internal exports to application-role. The registry has 30 files and 62 literal edges; the two exact Worker bindings and their symlink/owner restrictions remain intact. The finite percentage classifier and its native obligations remain draft.
- **Website source wall:** retain main's exact image-preview and site-link changes. A complete source check found eight remaining failures caused by stale S3 preview and site-link bindings. Independently review those two source deltas, then update only the S3 checker hash and the two matrix hashes. S3 only fixes its existing Switch's public New York/default presentation; native links only retain stationary pressed/text-selection policy. All six S3 and five native-link public imports, row owners, Path and blocked status remain unchanged.

Main's React absent-owner publication, WC first portal acquisition/conceal barrier and Positioning preparation leases are retained. They affect real mounting and initial rendering, so earlier native runs cannot be treated as validation of this merged source.

## Dialog presentation prerequisite: actual red and green

The broader WC regression found two Dialog Tab tests failing. An independent detached checkout of unmodified main, with its own frozen offline dependencies, reproduced the complete file as **6 passed / 2 failed / 8**. Those tests use the light profile and do not enter the Shadow CSS caches.

A temporary observation-only probe added zero awaits and changed zero assertions. Immediately before each failing Tab, it recorded a connected body-portaled view with `preparing:true`, `display:none`, the first choice active and **zero sampled focus targets**. The unchanged tests still failed at the same assertions. The probe was restored to the original bytes and is retained only as diagnostic evidence.

The final fixture establishes the existing first-presentation barrier before its original initial-focus assertion and keyboard input. It uses two actual frames from the content's own window, checks that the transition handle exists and is unchanged, and verifies the same connected document/body owner, no detached/preparing marker and non-hidden computed display. All original initial-focus, Tab, Shift+Tab, wraparound, blur recovery, closing and focus-restoration assertions remain intact. No product code, test timeout or opening-completion command was changed.

The candidate passed **8/8** against unmodified main products. The merged candidate then passed the complete nine-file WC regression, **218/218**, with no skips.

## Actual executions on the merged source

| Scope | Actual result |
| --- | --- |
| Ten complete CLI source/collector control files | 325/325 passed, zero skips |
| Thirteen complete Sprint 1 integration files | 500/500 passed, zero skips, 38.50 s under the 90 s owner |
| Original seven Sprint 1 Node files | 228/228 passed, zero failures/cancellations/skips |
| Complete Matrix diagnostic and observation files | 42/42 passed, zero skips |
| Compiler and Worker source-boundary groups | 43/43 passed, zero skips |
| Nine complete affected WC files after the fixture correction | 218/218 passed, zero skips |
| Canonical generation | Exit 0; regenerated output was byte-identical to the composed manifests |
| Complete generation check | Exit 0, including all thirteen motion-palette controls |
| Complete coverage-matrix checker | First exit 1 with eight issues; reviewed three-pin correction exit 0, two matrices, 298.28 s |
| Complete lowered-hook file | 198 passed / 1 failed / 199, zero skips; the full-inventory gate remains red |
| Workspace TypeScript | No completed result on this merged source; native final-head validation is still required |

An initial broad WC invocation occurred while the CLI conflicts were still unresolved: two files failed collection and 200 tests executed with two failures. The subsequent resolved-source run collected all 218 tests and isolated the same two Dialog failures before the final green run. A separate orchestration prerequisite rejected a nonexistent observation-test filename before starting its Matrix/lowered commands; the resume used the actual earlier command receipt. Neither incomplete attempt was represented as passing.

The full lowered run still has **684 unresolved records in 109 files**: 504 subject, 83 comparison, 66 intent, 30 condition and one spec record. The entire received array was parsed from the real console diff and compared as a Counter with the preceding source: no records were added or removed. These are diagnostic records, not 684 independently reproduced component bugs. Later declaration-provenance and shaped-attribute assertions in the same failing case were not reached. A separate graph/session design has not been applied to this frozen source and supplies no acceptance.

The earlier local TypeScript attempt exhausted its unchanged 768 MiB heap and exited 134 on the preceding source. It is an incomplete historical result, not a type result for this main integration. Local resource limits were not raised.

## Remaining native and publication conditions

Repair, all twelve Sprint 1 producers and full CI must run on the new published head. The four complete repair suites, thirteen integration files, Matrix's original 60-second initialization limit, Search's 1000 ms predicate and every original native inventory/deadline remain in force. No earlier e7/d71 run is reassigned to this tree.

PR #1745's actual review collection was empty at the checkpoint. Local independent source review is not GitHub approval. The Vercel bot also reported a daily deployment quota failure, `api-deployments-free-per-day`; this is retained as a failed preview, without claiming the repository's separate missing-authorization exception. Full lowered analysis, final-head CI/DCO, applicable platform approval and original scheduled/application/physical IME/AT conditions remain under their original criteria.

## Evidence

The [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint1-main-integration/manifest.json) records source identities, every command receipt, the complete unresolved inventory and per-file hashes. The [raw archive](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint1-main-integration/executed-validation.tar.gz) has 115 entries, each read back byte for byte, SHA-256 `0eaa9d82fb326c74830c6fb695c53c990122dc8582cb6fbf8527a7ca5fa3668d`. Failed, diagnostic, interrupted and final passing observations are retained separately.

## Commit-hook reconciliation

The normal repository hook formatted fourteen files carried from main while creating commit 61546fc7ca8e0158f913d7f068d700502acf562b. The publisher correctly returned exit 1 because the actual tree b20fadf0585e23e2c6cd5599ca6d23a59ca59e9b differed from its prepared tree 024bb1e92efbf12f152e766944da0ede28349a6f. The commit already existed; that failed acknowledgement was reconciled by reading HEAD, both parents, both complete trees and every changed path. No commit was blindly retried, amended or discarded.

The changes are formatting only: eleven JSON token streams are identical when whitespace outside strings is removed; the Markdown table retains every cell and alignment; the diagnostic transport script has an identical parsed JavaScript structure and literal values; and the YAML decision has identical parsed values. The draft decision, criteria, numerical evidence and all reported failed results remain unchanged. No runtime product source was changed by the hook.

The [complete reconciliation](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint1-main-integration/hook-format-reconciliation.json) lists every original and formatted blob and raw digest. All fourteen original files are also preserved byte for byte in the [original-byte archive](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint1-main-integration/pre-hook-originals.tar.gz), in addition to their immutable main parent. The earlier execution archive remains unchanged. A separate normal commit records this reconciliation before publication; final native results must still bind the final published head.

## Byte-bound payload restoration

A further exact-reference audit distinguished current payload contracts from historical execution source identities. Eight of the formatted files were actual sibling evidence payloads whose existing manifests promise their original bytes: Liquid's strict-project input, the intrinsic CSS and transported driver, four Sidebar observations, and the Train candidate artifact. They are restored byte for byte from the unchanged main parent. Their existing manifests, raw SHA256 values, timestamps and failed outcomes are not rewritten.

The existing formatting policy already protects exact historical evidence paths. This change adds only these eight complete paths to that policy; it does not ignore a directory, maintained script, runtime source or specification. Actual Prettier path controls confirmed all eight are protected and four ordinary/nearby controls are not. Running the normal formatter on the eight payloads preserved every raw digest, byte count and Git blob. An ordinary unprotected TypeScript formatting control still changed normally. The repository hook and exact committed-tree validation remain enabled.

The other six representational changes retain normal formatting and the equivalence evidence above. Historical sourceHashes continue to identify the original executions, and the original-byte archive remains available. The reconciliation report lists the exact restored payloads and distinguishes the intrinsic receipt's driver/css payload hashes from its separate historical sourceHashes.
