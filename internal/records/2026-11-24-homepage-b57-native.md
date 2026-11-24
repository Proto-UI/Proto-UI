# Native Homepage and inert-oracle evidence on b57

This record preserves new native observations on clean `b57e7af30b97a087ae0c3ec9fa75e10c7ca268d8`. The complete source binding, command receipts, images, original failures, and cleanup records are retained in [evidence/2026-11-24-homepage-b57-native](evidence/2026-11-24-homepage-b57-native/receipt.json). This is follow-up evidence for the 0.3 release repair; it is not a full release, all-host, all-family, or assistive-technology acceptance receipt.

## Source and execution

The remote checkout was clean at the exact SHA. Node 24.22.3 and pnpm 10.32.1 ran the original browser cases in sandboxed Chrome 156.0.8078.79. CPU profiling was explicitly disabled. Current main's strengthened input readiness and surface-center wheel coordinates remain; these differ from the original fde wheel input schedule. The existing 1000 ms interaction deadlines were not expanded, and no predicate was weakened.

The four generated CSS/Shadow assets were reused from the earlier fde canonical style build only after checking their exact bytes, all recorded producer source scopes, dependency fields, and the unchanged lockfile. The b57 `source.json` records `generationRerun: false`, the previous producer SHA, current test and configuration hashes, and the full source delta. It does not claim a new style build or an unchanged whole application. The runner is retained beside this record's archives.

## Original Homepage verdicts

The two selected cases ran from 12:24:39.273Z to 12:25:33.512Z: **0 passed, 2 failed, 8 deliberately unselected**, with no outer timeout.

The Popover case failed on the first `shadcn` / `wc` tuple at the original `data-contents-runtime === runtime` 1000 ms switch assertion. It had not yet reached the wheel. Its transition receipt records a 1593 ms long task beginning at 1795523123885.1, near the returned click timestamp 1795523123885. Later reads show both Contents and its panel committed to `wc`, generation 1 active, and no page errors. This is a delayed observation/transition receipt, not a new reproduction of the earlier zero-scroll assertion or proof of its cause.

The Brutalist preference case still failed its original 1000 ms commit assertion. Its real dataset setter returned successfully. Aligning the recorded browser and Node clocks places the setter start approximately 23.94 ms after the rejected verdict. The fourth already-issued query later returned `brutalist`; the original rejection remains unchanged. Raw setter, mutation, utility-world, Node query, SDK timing and calibration samples remain in the archive. No CPU profiler was enabled, and the evidence does not establish a permanent lost preference write or a particular hotspot as the cause.

The third case, `reveals current articles through native shadow slots and preserves viewport handback`, then ran in a separate Vitest invocation from 12:25:33.513Z to 12:26:16.891Z: **1 passed, 0 failed, 9 deliberately unselected**. Its original owner, home, sibling, visibility, and nearest-viewport assertions remain. It is a bounded b57 pass, not a replacement for hosted full-suite results on another source.

All three owned process groups ended with an empty remaining-process list; only the Astro group required TERM, and no group required KILL. There is no OOM inference or timeout increase.

## Native inert control

A separate owned minimal HTML page tested the premise behind the mobile overview's `getByRole(...).count() === 0` expectation. Playwright 1.58.2 returned **one** matching button while the containing element was natively `inert`. Actual Tab skipped that button, Enter activated only the following enabled button, and attempted programmatic focus did not enter the inert subtree. CDP reported the button as `ignored: true`, reason `inertElement`, and omitted it as an exposed button from the full accessibility tree.

Removing `inert` preserved the same DOM node. Tab then reached it, Enter activated it once, and CDP exposed `role: button` with `ignored: false`. The role locator still counted one. Both phases and the complete AX responses are retained in `inert-ax-b57-review.tar.gz`, together with the exact HTML and probe source. The independent control passed.

This demonstrates that this Playwright role-count query is not equivalent to native inert exclusion. A repair to the real application journey must assert actual keyboard and AX exclusion while collapsed, then same-node focus and activation after expansion. It must retain existing geometry and lifecycle checks. This control alone does not accept that future journey repair or a screen-reader profile.

## Remaining work

The original zero-scroll behavior remains open because this run failed before wheel input. Preference latency remains open. The reviewed Anatomy candidate must be compared on its exact source with the unchanged Homepage assertions and Matrix's original 60000 ms initialization phase. The b57 article handback pass must not be transferred to that successor without its own scope-bound verification. No complete RC, browser matrix, native matrix, or publishing claim is made by this record.
