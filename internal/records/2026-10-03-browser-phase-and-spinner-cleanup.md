# Browser phase classification and Spinner launch cleanup

Date: 2026-10-03. Bounded follow-up: #790. Base: `acfd894656d6ef464472e8353eb86e724fadf467`.

## Observed failure

[Main CI 37112574418 / job 111173387545](https://github.com/Proto-UI/Proto-UI/actions/runs/37112574418/job/111173387545) failed during the parallel general runtime phase. The Spinner native-capture suite's `beforeAll` exceeded the default 10,000 ms deadline; `afterAll` then tried to close an unassigned browser. The run reported 506 passing files, one failed file and three skipped files, with 2798 passing tests, four skipped Spinner controls and 34 todo tests. The sequential browser phase had not begun. Keep that failure as evidence; the earlier source-head CI success does not turn this main run into a pass.

The runner's explicit `BROWSER_SUITES` inventory omitted both `apps/www/test/evidence/brutalist-spinner.capture.browser.test.ts` and `apps/www/src/content/docs/zh-cn/scroll-end-follow.browser.test.ts`. Both launch native Chromium; Scroll also owns its isolated HTTP fixture. Consequently both ran alongside the parallel general suites. Resource contention is a plausible trigger of the slow launch, but the log does not establish Chromium's precise startup delay or a production Spinner defect.

## Repair and discriminating evidence

The existing sequential browser phase now includes both files. The new inventory check discovers browser files under the current runtime Vitest include roots and requires exact registry equality, one general-phase exclusion and one sequential entry per file. It fails on the base with exactly those two missing paths. All 31 current browser suites are covered after the repair; none is disabled or removed.

The capture suite stores the pending launch promise before awaiting it. Teardown waits on that same promise and closes its acquired browser. A launch rejection is still reported by `beforeAll`; teardown avoids adding a misleading undefined receiver error. A close rejection propagates. The setup deadline stays at the default 10 seconds. Cleanup gets a 60-second watchdog to await the launch and its close. The continuation is attached directly to the launch promise, not abandoned by a local `Promise.race`, so a resource arriving after that watchdog still receives the close call while the worker remains alive. No in-process continuation can promise cleanup after its owning process is forcibly killed; hook timeout remains a failed run, never a successful cleanup claim.

`brutalist-spinner.capture-lifecycle.test.ts` extracts and executes the actual suite's top-level browser declarations and lifecycle hooks in an isolated VM. Its injected launcher checks success/one close, launch rejection/no secondary error, acquisition after both modeled watchdogs/one eventual close, and close rejection. The base fails the rejection and late-acquisition cases; the repaired hooks pass. Fake timers model hook ownership order only. This is not native Chromium startup, OS process-cleanup, animation or pixel evidence.

## Validation at preparation

- Node 24.19.0, pnpm 10.32.1 dependency tree; no dependency changes.
- Inventory regression: base fails with the two omissions; candidate 4/4 passes.
- Actual-hook regression: base 2/4 fails; candidate 4/4 passes.
- Focused Spinner lifecycle, serialization, Prototype and CLI: 19/19 passes.
- Workspace TypeScript: passes without diagnostics.
- Real browser and aggregate CI: pending the repair PR's exact head. Local native browser execution is unavailable under this executor's existing restrictions; no browser flags or security policy are changed to work around them.

No production, style, public documentation, spec lifecycle, contrast threshold, centering tolerance, four native-control assertions or Scroll behavior changes. The source-bound phase and resource transitions above are the appropriate internal evidence; no unchanged UI screenshot is relabeled as a new visual result.

Co-author by OpenAI Dots
