# Controlled Text Control value after a change callback prelude

Date: 2026-10-06 UTC. Integration parent: Focus #832 `5b104b140c64ddd18ded4309debd451cba98aa0a`.

## Attribution and scope

PR #775 review `4193495837` identified a controlled editing mismatch inherited from the Focus callback-prelude integration. An independent worker reproduced it on #775 parent `fe94c93ab8953f6a8be283d122ab30651fbb087b`: when a native `change` event drains a queued owner patch, the logical snapshot becomes `queued owner` while the actual input/textarea retains `native candidate`. The same six controls pass against main `c9691a6b4f026e4b7e43f2cf4059bfe778afb837`. This is a regression in the inherited prelude integration, **not** a defect newly introduced by main.

The two affected Text Control files are identical between that #775 base and the current Focus integration parent. The frozen two-file patch applies without conflict. It changes only installation of a new prelude token: `change` does not install one because that event has no deferred native-candidate restoration. The already-existing composition guard and any outer input/composition callback context remain intact. Nested callback policy is not redefined by this repair.

Applicable draft authority is `C-TEXT-CONTROL-0001-B/D/E/F/G` and `M-TEXT-CONTROL-0001-A/B`: owner patch projection, native editing facts, controlled restoration and composition preservation. No API, contract criterion, Adapter behavior, event ordering policy or budget limit changes.

## Evidence

Six added controls cover single-line input and multiline textarea: differing queued owner value reaches the real Web host while the emitted change fact remains the native candidate; equal value preserves the caret; change-triggered owner patches do not disturb an active composition and restore the owner after composition ends. The baseline has two intended DOM-value failures and four passing controls. Main passes all six.

The author ran 91 module/Web checks and fourteen four-Adapter integration checks. Independent application to the current Focus parent passes all **105 tests across six files**. The Vue2 suite is `packages/adapters/vue2/test/textarea.integration.test.ts`, not a nonexistent text-control-named file; the initial three-Adapter selection was not counted as four-host evidence. The parent separately read the frozen production/test diff, with no static blocker; this is not a native-browser review.

All 44 source packages built; full workspace/docs types pass (446 files, zero errors/warnings, four hints). The complete non-overlapping general plan passed 4,414 tests across 647 files, with 34 todo and three skipped files (650 collected). No native browser run is claimed from the happy-dom controls.

Direct complete source measurement passes all nine unchanged gates: Runtime 68,090/69,200; React 89,642/91,000; Vue 89,414/90,800; WC 93,298/104,500. All eleven artifacts are retained in the adjacent JSON. A future complete combination with the independently owned failed-attachment rollback must be measured anew; source deltas do not establish the combined budget. Any necessary budget proposal remains a separate evidence-backed change, not an algorithm alteration.

This source commit is intended for propagation to #775 through its authorized integration lane. It does not edit that audit branch or merge main. #824 approval/main-integration dependencies and validation-only #826's never-merge rule remain unchanged.
