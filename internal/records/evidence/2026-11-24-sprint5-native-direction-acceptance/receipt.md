# Native Focus direction acceptance

The original input and textarea controls passed in Chromium 145.0.7632.6 after moving only page, Adapter script and stylesheet preparation into a bounded 30-second `beforeAll`. Each case retains a separate fresh page, its original five-second timeout, and byte-identical initialization, trusted inputs and assertions. No product source, sandbox setting, 250 ms cleanup guard or 1,000 ms readiness budget changed.

The exact source is `f6bdadf1bf1791bab8a66d7c9a6c25993fc5c1f4` (tree `d2a1b196393830d6ca746f35c1c1715c44eb88f5`) plus `bounded-preparation.patch`. The final fixture SHA-256 is `fc2157d23740281f7f840dcbfb7e42ca1f61cc45f18e66dda2d500e11bf23c9e`. Node 24.22.3 and pnpm 10.32.1 used the already successful frozen install with the same lockfile. OS sandbox remained enabled.

## Actual execution history

| Run | Input | Textarea | Other cases unselected |
|---|---|---|---|
| original | failed (5003.923 ms) | passed (1058.070 ms) | 190 |
| unchanged-diagnostic | failed (5006.744 ms) | passed (1016.922 ms) | 190 |
| prepared | passed (1425.118 ms) | passed (168.451 ms) | 190 |

Both original input timeouts remain failures. The unchanged diagnostic API trace showed its first trusted fill beginning 4.929 seconds after case start; cold page creation and script/style preparation consumed most of the five-second budget. This justified moving preparation, not changing the semantic deadline.

A separate prepared-wrapper attempt exited before Vitest and executed zero tests because an exact patch-text comparison encountered different Git index abbreviation lengths (10 versus 9 digits). Source SHA and every non-index patch line matched. Its original failed-setup directory is retained. The wrapper comparison was corrected with `core.abbrev=10`; the subsequent semantic run executed once and passed both cases.

## Verified scope

Actual trusted input changes from Latin to Hebrew and back changed native `:dir` for both `input` and `textarea` while the `dir=auto` attribute stayed unchanged. An external `body:has(...)` stylesheet changed descendant visibility. A listener in the same native input dispatch observed the correct Focus Entry fallback, computed direction and visibility. No page errors occurred in either passing case.

This is evidence for the two native direction regressions. It does not accept the 190 unselected Shadow cases, establish production cleanup causality or a cleanup timing distribution, or claim complete Focus, IME, AT or visual coverage. The separate canonical production browser receipt remains bound to the earlier `2df421b1` hosted run.

## Raw evidence

`receipt.json` contains exact cases, source hashes and boundaries. `first-debug.tar.gz` preserves both original executions (72,540 bytes; SHA-256 `99b2226acb3406abdbec5a8124088e332a29d0ad5d7521ae51717acaa8d96335`). `prepared.tar.gz` preserves the failed setup, successful prepared execution, original and final fixture, browser harness and exact launch scripts (164,046 bytes; SHA-256 `4a2a5f1ca897e57bad5b64c48332205d0103f33ed9e6da991dec8f5ed36d063d`). All 32 prepared archive files were hash-verified after download and safe extraction.
