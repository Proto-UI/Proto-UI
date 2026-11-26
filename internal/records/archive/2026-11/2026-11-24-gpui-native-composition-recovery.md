# GPUI native composition recovery — 2026-11-24

This record describes a bounded compiler/native composition repair for follow-up PR #1738. It is development evidence, not a promotion of draft host capabilities, release acceptance, an operating-system accessibility claim, or a GitHub approval. The native patch is based on `db747e1b81cbbfaf2b37dd8af3de48108f036a04`; integration with newer main and the other PR fixes is a subsequent transaction.

## Problem and responsibility

The official ordinary-value producer succeeded, but its generated default GPUI SDK failed Rust compilation with 99 errors after concurrent native changes had been combined. Missing and duplicated owner fields, stale ControlLabel call shapes, and a missing external-scroll binding prevented the native acceptance path from reaching consumers. The baseline was actually run at `e18a30d4065111a5794a2aea524564e31678b911`; its compiler source and ordinary fixture files are byte-identical to this patch's parent. The baseline's production-web gate fix is unrelated.

The applicable draft `HC-CONTROL-LABEL-0001` and native ownership contracts require a current unique physical pair and retirement of stale authority. A logical owner alone does not prove that a retained GPUI view still has an accessibility node. The authored prototype continues to own portable semantics; the compiler and native boundary supply physical identity, current host facts, and revocation without component-name dispatch or a public JSON authority channel.

## Repair

- Reconcile the generated owner/module/hover/scroll integration. Preserve the current App registry, Scroll reader input and explicit pause epochs, retained external targets, observed native displacement, and the built-in projection boundary. Restore the ordinary producer's `external_scroll` output once; do not add another `scroll_reader` module.
- Let each actual `NativeViewLease` retain its physical ControlLabel receipt. The logical owner keeps only weak references. Receipts identify the serial, window, owner epoch, actual optional semantic node, and physical view. Observed physical authority is sticky: retirement cannot fall back to an older logical-only receipt.
- Resolve both naming and actions through the same unique pair proof. Unique retained receipts can remain current across cached layout frames. The legacy path still requires the original common nonzero frame. A missing semantic node, duplicate occurrence, foreign window, or invalid candidate refuses the whole pair rather than selecting a convenient alternative.
- Bind action closures to the immutable request created with the closure. Keep the existing outer `Some` factory boundary for enabled Labels, including an inert inner `None` when no pair exists. Neither an initially inert closure nor a previously valid closure can acquire a replacement node or revive after an ABA transition. Project the Accessibility Click action only for a valid current pair.
- Withdraw a physical receipt before selecting a successor. Retain a replacement before withdrawing its predecessor; dropping one of several retained views must not synthesize unmount or change the owner epoch. The final view detaches normally. A lease previously managed by ControlLabel cannot later fall through the old window/hitbox drop path. Deferred updates retain weak context only, check the same live member/window/association, and release borrows before driving owners.
- Make the IR validator use the existing `checkedSpreadFields(value, captureFields)` rule already used by parsing. This single line preserves closed-record checks, rejects unknown/indexed/invalid union alternatives, and permits checked capture facade spreads. It does not trust serialized getter lookup metadata.

The manually constructed hover and accessibility-action fixtures now register their owners with the current App, as real constructors do. Existing down/up/commit assertions remain intact. The official BaseButton, Label, Input, and InputDelegate fixtures are unchanged. Generated Rust is produced through the official producers; it is not edited by hand.

## Executed final verification

The final `cached-physical-full-r5` run used Node 24, pnpm 10.32.1, Rust 1.98.1, the locked GPUI revision `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`, offline Cargo, one build worker, and a task-owned short temporary directory. All 13 recorded commands exited zero. The full before/after snapshot of 219 compiler and fixture files is identical.

| Check                                                  | Actual result                   |
| ------------------------------------------------------ | ------------------------------- |
| Generated SDK controls                                 | 61 passed, 0 failed, 0 ignored  |
| Eight focused compiler source files                    | 211 passed, 0 failed, 0 pending |
| Ordinary official producer and locked Cargo graph      | Passed                          |
| Default generated library compilation                  | Passed                          |
| Accessibility-action consumer                          | 4/4                             |
| ControlLabel consumer                                  | 14/14                           |
| Ordinary-value consumer                                | 46/46                           |
| Scroll pause consumer                                  | 3/3                             |
| Scroll reader consumer                                 | 4/4                             |
| Style consumer                                         | 1/1                             |
| Official numeric accessibility consumer                | 9/9                             |
| Official BaseButton/Label/Input/InputDelegate consumer | 9/9                             |
| Whitespace error check                                 | Passed                          |

The six ordinary consumer suites total 72/72, not 68 total. The final SDK controls preserve the 58 controls that preceded the final physical-cache repair and add three cases: inert bridge permanence; actual cached duplicate/withdraw/remount behavior including a competing invalid pair; and real semantic-role absence/replacement with old closure revocation. They exercise the real GPUI test framework and projected AccessKit node/action behavior. They do not prove native operating-system or assistive-technology delivery.

## Preserved failures and limits

The evidence retains the real development sequence rather than replacing it with the final green log:

| Earlier attempt | Observed outcome |
| --- | --- |
| Original generated default SDK | 99 Rust compilation errors; no consumer acceptance |
| First SDK invocation through a non-workspace manifest | Setup failure before tests; corrected to the official numeric workspace |
| Correct workspace before manual current-App registration | 54 SDK controls passed, 1 failed |
| Old request reconstruction with a new immutable-lease negative case | The new case failed because an old lease invoked a replacement node |
| Render/lease negatives before the request repair | 55 passed, 3 failed |
| Immutable request before retained-cache proof | 57 passed, 1 failed; real cached same-path view remained red |
| Ordinary producer before restoring external_scroll | Missing-module compile failure, not a test pass |
| Independent consumers before compatibility/App registration fixes | 68 passed, 4 failed out of 72; separate numeric 9/9 |
| First final physical-cache SDK trial | 60 passed, 1 failed because a new test asked GPUI Div to use GenericContainer |

The last fixture error occurred at GPUI's explicit rejection of `GenericContainer`, before the intended positive role transition. Only its two positive inner-role literals were changed to `Button`; accessible=false, None/Some transitions, all mounted/epoch/naming/Click checks, and stale-bridge assertions were preserved. Both the 60/61 log and the two-literal correction receipt remain archived. The pinned upstream implementation is at [GPUI Div role](https://github.com/zed-industries/zed/blob/62e5991dd0f0c8a3af8d5e7e9c4652490d468db8/crates/gpui/src/elements/div.rs).

For the distinct capture-spread source check, the original four files had 47 passed and 19 failed out of 66. The single validator line recovered seven cases, leaving 54 passed and 12 failed. The remaining twelve failure messages are byte-identical; they concern copied capture-getter callable provenance. This commit does not claim that all 66 passed. A later bounded repair must preserve the original refusal and phase checks and supply its own evidence.

The production-web gate, Adapter readOnly fix, browser retirement timing, remote CI, and latest-main integration have separate evidence and are not accepted by these native results. In particular, this record does not widen the browser's 250 ms threshold or mark PR #1738 Ready by itself. The independent source review is recorded as a peer review of the source, with its later two-literal addendum; it is not represented as a formal GitHub review.

## Evidence and reproduction

The accompanying [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-gpui-native-composition-recovery/manifest.json) binds the nine changed source files, final test counts, earlier runs, scripts, patch, and independent source review. Each raw artifact is gzip-compressed with original and compressed SHA-256 and byte count; decompression was checked byte-for-byte. Historical artifacts elsewhere in the repository are untouched.

The archived `native-sdk-phase.py` shows the exact commands and environment for the full run. Substitute a fresh checkout/output directory for its task-specific paths; use the repository's Node/pnpm baseline and the pinned Rust/GPUI dependencies. The three producer commands recreate the ordinary, numeric, and official ControlLabel workspaces. The generated-file manifest was captured after the successful run; it is explicitly not claimed to be a generated before/after comparison.
