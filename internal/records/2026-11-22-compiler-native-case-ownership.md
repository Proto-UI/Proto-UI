# Ordinary WC native case setup and evidence ownership

## Native failure and attribution

[Run 44930338506, compiler-wc-native job 136925373902](https://github.com/Proto-UI/Proto-UI/actions/runs/44930338506/job/136925373902) completed at source `031d9b661025312244d31506758eed989cc71f94` with **11 passed, 1 failed, 0 pending**. The first light-DOM construction case exhausted its existing 5,000 ms whole-case timeout. This was not a browser launch or isolation failure, and the log contained no product assertion mismatch.

The source-bound [artifact 14717201836](https://github.com/Proto-UI/Proto-UI/actions/runs/44930338506/artifacts/14717201836) was downloaded and parsed as ZIP/JSON without executing its scripts or opening a browser. Its 823,940 bytes have SHA-256 `3417bc8f7c0c7e9b0819da8d4a8b3f30247dd4620d37c32e2fd6627075a9c8e2`. The first case started at 17:30:15.802 UTC. Trace timing shows `context.newPage()` consumed 4,233.553 ms; the following navigation consumed 743.682 ms and crossed the case deadline. Host construction and product checks had not started at that deadline. Screenshot capture began approximately 5,883 ms after case start and took 225.227 ms, so screenshot or trace export did not cause this timeout.

The trace also exposes a fixture ownership defect. Vitest advanced to the next light case while the timed-out promise continued. The old promise subsequently completed its checks and wrote `construct-false-result.json` with `outcome: PASS`. That late helper result does not overturn the runner's failed case. The original **11/1** result is retained in the accompanying [evidence record](2026-11-22-compiler-native-case-ownership.json).

## Bounded repair

The existing compiler native test, fixture builder, WC emitter and WC browser support were unchanged by the regression-governance PR. This repair changes only the native test's lifecycle ownership and a test-only helper; no compiler product source changes.

The locked Vitest 2.1.9 runner invokes `beforeEach` before the separately timed test body, records a body failure before `afterEach`, and implements timeouts with `Promise.race` rather than cancellation. The repair uses these existing hook boundaries:

| Phase | Bound and responsibility |
| --- | --- |
| Shared build/browser startup | Existing `beforeAll` 120 s remains. |
| Each case's page setup | One 30 s limit owns context creation, request isolation, tracing, new page, navigation and readiness. This uses the original Playwright 30 s navigation/readiness policy as a combined bound. It does not extend a product assertion deadline. |
| Product body | All original 12 cases and their 5 s body limit remain. All 20 original assertion expressions are preserved by AST comparison, including the HTTP status assertion moved into setup. |
| Observation and cleanup | `afterEach` retires the owner before doing anything asynchronous. Screenshot is bounded to 5 s, trace export to 10 s, context cleanup to 10 s and receipt writing to 5 s, inside the existing 60 s cleanup-hook policy. |

A context arriving after setup retirement is closed instead of being adopted. A late body completion cannot mark a retired owner complete. The body no longer writes screenshots or JSON in its `finally` block. Each observation is labeled **OBSERVED** or **FAIL**, carries `finalAcceptance: false`, and names `browser-vitest.json` as the authoritative result. Cleanup failure is recorded and fails the hook; it cannot leave a helper `PASS` claim.

## Validation boundary

Four lightweight Node controls pass: ordinary observations remain non-authoritative; a timed-out body resolving late cannot produce successful evidence; a late context is closed; and cleanup failure remains a failure after completed assertions. The original 20 assertion expressions, five declaration sites and their expansion into 12 light/shadow cases are preserved. No test-body timeout override was added.

No local Chromium or full test suite was run for this repair. The fixed native 12-case file still requires execution on the next exact candidate. The historical native failure remains failed; the four local ownership controls establish fixture behavior, not compiler/browser acceptance.
