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

## First repair-head aggregate execution and bounded diagnosis

Head `72d2eee98d98156cb1dadf2412c6e9d3ca3ac112` completed [CI 37113894402](https://github.com/Proto-UI/Proto-UI/actions/runs/37113894402) with the general phase passing 2796 tests (34 todo), followed by all 31 registered browser suites. Spinner native capture passed 4/4, Scroll end-follow 6/6 and documentation-image-preview 20/20. The original launch/teardown failure did not recur. Separately, Spinner evidence run 37113894391 passed 11/11 tests and captured 32 baseline plus 32 candidate states.

The aggregate browser result was still **170 passed / 1 failed**: Base Image's Vue 2, dark, 1280px case timed out at the unchanged 20-second `selectRuntime` predicate. The first failure lacked renderer/selected-value state, so neither a deterministic regression nor an intermittent trigger is established. This is not the homepage lane's HTTP readiness failure and has not been assigned the same cause.

The follow-up adds diagnostics only in Base Image's test. It retains the original native selection, expected five images, renderer predicate and deadline. Failure facts are read only after the original wait fails, so no pre-click observation can delay the user journey into passing. It reports selector/projection values, image count, renderer marks, theme/viewport and page errors observed during selection; an optional public preview screenshot supplements those facts. Diagnostics cannot replace the original exception. The controlled diagnostic tests verify a successful journey adds no state read and both successful and failed diagnostic collection preserve the original failure. An initial unit attempt used a matcher unavailable in the installed Vitest 2; replacing it with the equivalent call-count and argument assertions repairs the test API usage without changing the expectation.

A read-only exact-head evidence workflow runs the unchanged Base Image 17 cases, Scroll six cases and Spinner four native controls sequentially on Chromium. Its captures retain the checked-out source SHA. Both this focused observation and a new full CI run are required; a passing repeat alone would not prove that the unidentified intermittent readiness issue has been fixed.
