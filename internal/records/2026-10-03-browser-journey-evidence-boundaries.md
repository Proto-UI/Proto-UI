# Browser journey budgets and exact native-selection diagnostics

Date: 2026-10-03. Bounded #777 test-evidence follow-up. Local source base `137037a6da3409d987fe399fbd857f69a4712274`, tree `d6de27d37f9021afc88e1947a6c3ce03b6be440c`, matching the published `4e0be07d898907bdda25a8cd09e8397a75277622` source tree. No product, style, copy, focus, scroll or overflow contract is changed.

## Distinct theme endpoints: retain the original failure

[CI run 37127390208](https://github.com/Proto-UI/Proto-UI/actions/runs/37127390208), browser shard 8, on the earlier `3db7474170bd855985d16910e305164e31b4d275` candidate reported `activates distinct Light and Dark token endpoints` at 5,002 ms with `Test timed out in 5000ms`. The suite had eight other passing cases. The failing case omitted its `it` timeout, although its two calls to `openStandaloneTheme` each perform navigation through `networkidle`, await a fixture that mounts all four Web runtimes, and sample the settled theme. The helper's 90-second ready budget could not extend the outer five seconds. The original failure does not establish which stage consumed the time.

The current bounded test decision is a 30-second total case budget, with independent 10-second navigation and ready limits on each of these two calls. Every other helper caller retains its existing navigation default and 90-second ready limit. These are evidence-operation limits, not a product performance target or a claimed optimization. Each opted-in stage logs start, success/failure, stage and per-theme elapsed milliseconds, requested/current route and the last observed document HTTP status. A failing ready stage keeps its original error. No retry or new sleep is introduced; the existing two animation frames and 200ms allowance for the authored 150ms color transition remain unchanged. A later pass under the old five-second timeout does not erase the earlier failure or establish that the budget was adequate.

## Native text selection: collect before choosing a repair

[Isolated evidence run 37127390190, job 111216232725](https://github.com/Proto-UI/Proto-UI/actions/runs/37127390190/job/111216232725) reported five of seven code-surface cases passing. The two 320px Light/Dark cases selected `wc-base-transition `, including one trailing space, instead of exactly `wc-base-transition`. Inspection of the installed Shiki renderer confirms the target span contains only the tag name; the next span contains ` open`.

The later full-CI browser-shard job `111225139169`, checked out at synthetic merge `f58da319943d2a555c46b2eeb7233452219d1b8d`, reproduces the same two failures and logs a shared documentation server. The corresponding isolated suite was reported as seven of seven passing in the active evidence reconciliation. That environment/result difference is retained, not attributed to font loading, resource contention, or a product selection defect without measurements. The original failing run has no inspected anchor/focus or glyph geometry artifact in this work packet.

Therefore the mouse drag remains exactly the same: target span bounding box, left/right one-pixel insets, eight movement steps, real mouse down/move/up, and exact untrimmed string equality. Only after that selection differs from the expected text does the test collect read-only facts:

- original pointer coordinates and target/next-run text and per-character Range rectangles;
- selection text, anchor/focus node descriptions and offsets, and selection rectangles;
- source viewport, font/whitespace/user-select, scroll and clipping dimensions;
- elements hit at the original pointer endpoints

The diagnostic is logged and, when the existing code-evidence directory is configured, written as `<width>-<theme>-native-selection.json`. Diagnostic failure is reported separately and cannot turn a trailing-space selection into a pass or replace its original assertion. Measurement Ranges are never installed as the browser selection. No trim, selection setter, changed drag coordinates, extra synchronization, or production workaround is introduced.

The next hosted comparison must retain the full shared-server and isolated journeys. Use the endpoint and glyph observations to decide whether an exact text-run boundary can repair the fixture; investigate product behavior only if those observations support that conclusion. A green isolated repeat alone does not resolve the failed shared-server journey.

## Local verification and remaining evidence

The source-bound unit suite executes the actual browser helper/case declarations in an isolated VM, with controlled Playwright operation results. It proves case and operation budgets, unchanged default callers, phase/HTTP/error reporting, no retry, diagnostic failure preservation, and read-only DOM collection. An original-source control fails with `expected 5000 to be 30000`; the candidate passes all nine tests. Its elapsed values are injected observations, not measured browser performance.

The first local diagnostic unit attempt exposed HappyDOM's different `Selection.focusOffset` behavior. The corrected unit checks faithful recording of the actual DOM observation and preservation of the original selection. HappyDOM glyph rectangles are explicit test injections. None of these unit checks establishes Chromium hit testing or native mouse-selection success.

Node 24.19.0, the installed pnpm 10.32.1 dependency tree, and a single-worker, WebSocket/HMR-disabled Vitest runner passed 26 tests in four files: the new nine cases, existing code-surface evidence (3), CodePanel client (7) and CodeExample client (7). The first wider attempt could not collect the two client suites because the new worktree lacked its installed package-level dependency links; reusing those existing workspace links resolved collection. No dependency or lockfile changed. Formatting and patch-whitespace checks are also required on the frozen candidate.

Local browser, socket/CDP, aggregate CI, full typecheck and build were not run. The existing executor restrictions were respected. Fresh hosted browser results and original/new native-selection artifacts remain required; this patch is a bounded timeout correction plus a diagnostic, not a claim that the selection failure is fixed.

Co-author by OpenAI Dots
