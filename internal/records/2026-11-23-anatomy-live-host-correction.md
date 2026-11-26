# Anatomy: retain live host reads during notification fanout

This non-normative continuation repairs the inherited whole-order cache on integrated candidate `b8d20315ad028de77891071db0786b7350ee7d3c`. It follows the independently published live-getter correction at `3148794da5e44581cc5578a688c0ec5eacefe256`; the product implementation is byte-identical to that correction. It does not close the Sprint 1 or seven-sprint browser, Matrix, release, native-platform, independent-review or acceptance tasks.

## Observed failure and correction

A current host getter can replace `compareDocumentPosition` during a repeated read for a later recipient. Sampling every claim only once before reusing a complete order misses this change. On the unmodified b8 product implementation, the new four-claim regression from 314 failed for the expected reason: the second recipient's order listener was not called.

Remove the complete-order cache and reacquire both current host targets at each comparison. Retain the existing notification-scoped pair-comparison cache, its comparator-identity checks, callback invalidation, domain resolution and subscription lifecycle. Stable `claims.slice().sort(...)` preserves registration order for equal or unavailable targets without wrapper allocation.

The subscriber suite retains b8's earlier replacement-target and comparator-replacement regressions, and adds 314's repeated-host-read regression and equal/unavailable-target order control. Both synchronous and observer notification cost cases retain the same 64-item shuffled domain, current-target lower bound, unchanged-version and no-spurious-notification assertions, subsequent DOM reversal and complete recipient notification assertions. Their invalid once-per-claim upper bound is replaced with the existing bounded pair-comparison reuse contract against the same shuffled single-recipient baseline. No timeout or native/browser acceptance threshold changes.

## Executed evidence

The [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-anatomy-live-host-correction/manifest.json) binds the original command logs, complete JSON report, before-source snapshots, exact three-file patch, driver and receipts in a compressed archive.

| Observation | Actual result |
| --- | --- |
| New repeated-host-read regression against the unmodified b8 product implementation | Exit 1; the expected missing second-recipient callback assertion failed |
| Complete five-file Anatomy order, subscriber, domain-cost and catalog-lifecycle selection after correction | 48/48 passed, 0 failed, 0 skipped; original 90-second supervisor retained |
| Three changed source/test files across the successful execution | SHA-256 values identical before and after execution |
| Product implementation | SHA-256 `cbb63398679e6fbd29db453cc3bf9e8ec992010c9023daeed4d44b7c24fdd5db`, equal to 314 |
| Exact three-file correction patch before this record | SHA-256 `f96a8aebc7fb96eb43c2eafdfe22cba7606382946524fef2189f804a01f113c4` |

The targeted red run deliberately executes one new falsifying case; its other filtered cases are not claimed as executed. The subsequent complete five-file run has no skips. The evidence records the actual staged source on top of b8, not a future commit or another branch's test result.

Earlier whole-order-cache records and their raw evidence remain unchanged as historical observations. Their passing cases do not establish the invalid host-read upper-bound contract. This correction supersedes that claim; it does not discard the original failed input or turn the earlier passes into proof of complete order semantics. No full Matrix or browser performance claim is made here.
