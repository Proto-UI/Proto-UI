# C browser preparation and paint cleanup — 2026-10-26

This is a non-normative observation record. It does not close #883 or promote a catalog guarantee.

## Current-main evidence

The source is `3220cb0aabb8d7e5709fa28a55c6b5f0172ae190`. Its natural CI run `40246355877` failed. Browser shard 3 timed out while downloading the real Ubuntu CJK font package in its original three-minute setup step, before browser tests. Shard 4 reached its original 900-second limit without an S4 case result.

The same-run Docs Shadcn 1440px failure binds `call@1168`, CDP 5233 and context 4 to six unique Browser/renderer stages. Forwarding to renderer entry took 2026.635ms; the renderer scope was 9.410ms, with 7.868ms in EvaluateScript. The 5.636ms CompileCode and 5.255ms ParseProgram spans are nested, not additive. The original query returned `combobox` 1110.972ms after its failed one-second verdict. The overlapping 1782.171ms module has no source identity in that trace. A single post-verdict clock marker is not a raw pipe receipt or clock drift calibration.

## Original native baseline and cleanup defect

One unchanged local selection ran the Brutalist reconnect case, both S4 locales and the paint case: one passed and three reached the original 150-second limit. The other eight homepage cases were filtered, not executed. Tracked source and extra input bytes were stable. S4's pre-close stream moved its first missing host from the WC Base Accordion preview to the React preview; rejected post-close collection does not supply a deadline-time DOM snapshot.

A separate original paint run with `DEBUG=pw:api` reached a successful trigger click and then screenshot. That control had only the CJK integration diff; paint helper and browser test bytes matched the baseline. Screenshot failed at 05:50:21.071 UTC; detach started two milliseconds later and remained pending until the 150-second case closed the context. Detach then rejected, while Vitest reported only the outer timeout. This proves unbounded cleanup can block and replace an earlier failure. It does not identify the screenshot error or explain the older CI click timeout.

## Bounded changes

- Browser CI reuses the existing exact Ubuntu package preparer and its existing checksum-keyed `.deb` cache. Size, SHA, package identity, selected Noto face and representative Chinese glyph checks remain mandatory. Font setup stays at three minutes, browser execution at 900 seconds and the job at 20 minutes. The new one-minute cache step consumes that same job budget.
- Paint cleanup has one new two-second window. Its original detach and DOM cleanup are both attempted without serial blocking. In-flight operations are not claimed cancelled. A prior rejection, including a falsy thrown value, remains primary; cleanup failure without a prior failure still rejects. Per-invocation records, markers and observer closures isolate late cleanup.
- The paint profile/settings/round action and assertion body is byte-identical to the baseline. Browser test assertions, input and deadlines are unchanged.

The five controlled cleanup regressions and retained runtime, typography and keepalive checks passed 138 tests. The first VM fixture had incorrect window/global identity; that failure was retained and corrected before the formal failing-before/passing-after control. Five existing font mocks cover cached-package rejection and charset parsing, not actual Linux installation or browser font rendering.

The post-repair native paint control still reached 150 seconds: in that run, screenshot did not reject until context closure. It did not repeat the earlier early-screenshot-error path and is not a paint pass. Actual Linux font preparation, complete current-candidate combinations and full-page preview remain separate evidence; neither these changes nor a later merge imply them.
