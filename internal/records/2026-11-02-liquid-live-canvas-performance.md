# Liquid Live Canvas: bounded native performance diagnostic (WIP)

## Latest verification and remaining work (2026-11-02 14:18 UTC)

- [x] The original three registered browser cases remain a literal 21,099-byte prefix; this candidate adds one 150-second diagnostic without raising the existing 20-minute CI budget or changing production material code.
- [x] The independently bounded own-collector controls passed 59/59 at 13:48 UTC, including ownership replacement and cleanup failures. These are Node mocks, not browser, GPU or project acceptance.
- [x] Full browser TypeScript validation passed for the original baseline and first candidate at 13:59 UTC. The first formatter export and Markdown check failed; those results remain preserved. Three captured formatter passes subsequently preserved the complete TypeScript AST, raw literals, comments and original prefix. Pass 1 differed from pass 2; passes 2 and 3 were identical. The approved stable output is a new candidate, not a reclassification of that failure.
- [x] At 14:17–14:18 UTC, the stable candidate passed full browser TypeScript validation and the official two-file format check, both exit 0 with source/dependency/runtime guards and owned cleanup intact. This validation used historical `d850c28a`; it is not a test of the current-main integration or real Chromium.
- [x] The exact two-path claim was renewed through 16:00 UTC in #1053. The earlier 14:00 claim and UNRUN statements below are retained as dated history, not the latest state.
- [ ] The publication candidate includes the independently merged registry hotfix through parent `7e8bcc9bcc9ddd91ec400d7e7f8c0922bdcc1ca7`. Its original browser suite and existing evidence workflow are unchanged from the reviewed inputs. Native CI has not executed this new diagnostic; exact checkout, real module identity, positive material work, all four runtimes and cleanup still require evidence.
- [ ] Actual lag attribution, matched baseline/candidate improvement, hardware GPU evidence and complete page/runtime coverage remain open. No optimization is implemented or claimed.

Normal public-site checks at 13:17–13:20 UTC found Button and Select initialized again after the separately merged #1217 registry recovery. WC Button incremented its count and WC Select selected Beta and closed/reopened correctly. However, Button reported `opaque-fallback / webgl-unavailable`; Select reported `opaque-fallback / source-overlapping-content`. Production SHA was unknown. These two-page observations establish restored preview interaction only, not optical rendering, a fixed-head result, all-page acceptance or improved performance. Screenshots and exact observation times are linked from the existing #1053 progress thread; older zero-canvas initialization failures remain preserved.

## Historical preparation snapshot (12:55 UTC)

Maintainer reports all Liquid Glass demo Live Canvases lag. This work reuses#1053; no performance cause or optimization is established. On2026-11-02 11:16–11:18UTC the publicly accessible production Button, Select and index previews displayed a duplicate `demo-base-checkbox` registry error with0canvases. Production SHA was unknown. That initialization failure is not evidence of the earlier lag's cause or a fast rendering path. Registry recovery is separately owned by#1217; this change does not modify its glob/registry or any production material source.

Two-path claim through2026-11-02 14:00UTC: existing material browser suite and this record. Static source read from main`ef70327def69786e0c5854e38c15dced1c48c3c8`; the existing suite blob`8388473cf65f25adf1a2554fb21adea3c0bfd7c8` is byte-identical to its d850 version. Full-source integration and actual CI remain pending a separately fixed head including the registry recovery. No new project code, local browser or third-party dependency has run for this diagnostic at this writing.

## Candidate instrumentation

The original entire browser suite is retained as a literal prefix: its three original registered cases, quality/source-loss/opaque/context-loss/resource assertions and deadlines are not edited. A distinct fourth150s case observes the actual public Button using its existing four runtime selectors and Back control. The existing20min workflow and launch options are unchanged. An additional case increases work even though it does not raise budgets; running out of time is a real failure, not grounds to delete assertions or extend waits silently.

The existing suite already captures actual WebGL contexts created by its real page. The diagnostic records their vendor/renderer/debug values when available plus browser SystemInfo GPU devices/featureStatus, omitting commandLine and account/machine-path details. Software adapters and absent data are explicit. No new context is created to imitate the real renderer, no disable-gpu flag is added, and hardware-user-lag acceptance remains false.

Per runtime: one1s observer-off warm-idle window, one1s observer-on warm-idle window, then one real hover+1s observer-on window. All windows include bounded DOM/quality snapshots, shared-document pool counters and Performance.getMetrics. Only on-windows add rAF timestamps/intervals, long-task entries and narrow CDPtrace. First sequential order is not counterbalanced: observations establish capture capability, not statistical improvement or negligible instrumentation overhead. rAF interval is not compositorFPS.

Trace budget8MiB in browser/16MiB collector per on-window; longtasks256/rAFintervals600; DOM128/canvas64; poolresponses16/each1MiB/resource snapshots64. Unsupported categories, dataLossOccurred, local cap, missing completion, zero or absent material counters, lost pool, identity ambiguity or cleanup failure reject capture completeness. Original raw errors and artifacts remain; no metric normalization produces a success.

## Real same-document counter binding

Public docs have no fixture metrics global. The diagnostic records the exact already-loaded same-origin `packages/adapters/base/src/material/program-pool.ts` script response URL including its query, successful status, bytes and SHA256. It does not guess a URL, append a query or acquire a new pool. Only that URL is imported from the same page; the existing exported inspector is called with the actual document. Multiple URLs or unavailable export are explicit failures. The original git source hash and transformed response hash are separate evidence; they are not equated.

The actual document must have one live context and positive consumers/renders/uploads/sourcePreparations. An independently created unattached Document passed to the same inspector must have no context/consumer/image work and no program fields. It never calls acquire/render/clear/dispose. This control helps expose a borrowed or duplicate pool, but actual Vite module identity must still be verified by real native execution; static code or own mocks do not prove it.

Counters cover the shared document pool, not exclusive cost attributable to the hovered Button. Cumulative work counters cannot reset within a window. Zero delta during a valid idle window is retained; an entire uninitialized0render/prepare page is not admitted.

## Cleanup and source binding

Before capture, CIHEAD must equal CANDIDATE_SHA and source checkout must be clean. Browser-wide tracing requires exactly the single owned page/context; unrelated tabs are not collected. The page observer has a unique owner ID, transactional startup, bounded storage and finally cancellation/disconnection; unknown replacement ownership is rejected rather than cleared. CDPsessions/listeners/flush timers are released. Artifact writes are mandatory; a secondary collection/write/cleanup error is reported without replacing a prior product error. First-party module bytes and project viewport screenshots only; no credentials or unrelated browsing content.

## Verification debt — none implied by this record

- [ ] Typecheck/officialformat/static review of the complete candidate; exact collection must show original3 plus new1, no skipped/todo.
- [ ] Own positive/negative collector controls, including partial-start failure, unknown owner, caps/lost trace/missingmodule/zero counters/write failure and original-error preservation.
- [ ] Fixed-head realCI including registry recovery; actual source/tree/browser/GPU/URL/module identity, counter positivity, every window role and cleanup. Current V2 source-overlap fixture failures remain red and cannot be silently changed by this diagnostic.
- [ ] Counterbalanced repeated matched baseline/candidate observations before attributing an improvement. Keep quality/safety/media/source guards unchanged.
- [ ] Select multi-stage and heavy overlay representative, then complete frozen page/runtime inventory; cold/warm/hover/press/open/close/scroll/offscreen/hidden/replacement/teardown rows. Button alone never completes the user request.
- [ ] Any actual optimization must follow a measured bottleneck and independent source rollback; no guessed observer/throttle/blur removal or production policy change in this patch.

Protected Vercel metadata/browser paths and the cloud browser's refused internalGPU page are not accessed through this work. The future diagnostic runs only in the project's separately approved temporary fixed-head CIbrowser. Deployment Ready, software-only traces or another candidate's screenshots do not provide performance acceptance. #1053 remains open.

Static hardening at 12:55 UTC: response bookkeeping itself is bounded after the sixteenth matching script response; further responses set an explicit truncation flag and reject completeness without adding URLs/errors or reading bodies. Summary-write failure clears captureComplete before its fallback error report. New source-binding Git reads have a two-second subprocess deadline. These changes and all collector controls remain unexecuted.

## Static own-observer cleanup hardening (2026-11-02 13:38 UTC, UNRUN)

The diagnostic now retains a Playwright JSHandle to its own observer only. If the public ownership marker is removed/replaced, cleanup stops the exact original rAF/PerformanceObserver before reporting identity drift, disposes the handle in finally, and never deletes the foreign marker. This addresses a static leak in the unpublished collector; it is not a product performance fix. Same-ID replacement is still a different object and must fail. The handle keeps the own observation closure alive for its one-second sample; this explicit instrumentation overhead is included only in observer-on, not observer-off. Browser context navigation/crash may make handle evaluation unavailable; that remains a hard incomplete-capture error, never accepted data. Source: https://playwright.dev/docs/api/class-jshandle (evaluate/dispose, read 2026-11-02).

Original three cases remain literal prefix unchanged. Types/format/own negative controls and actual Chromium execution remain unrun; no optimization or hardware GPU conclusion follows.
