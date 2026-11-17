# Observe CodeExample Tree admission before native grammar assertions

## Actual native failure and its limits

The [isolated grammar job](https://github.com/Proto-UI/Proto-UI/actions/runs/44038705347/job/133905785039) on `bf8b1f55f93a89f3c689276d6e339d83891f4dba` completed 26 cases with **14 passed / 12 failed**. All twelve locale/width/theme host journeys failed the original Tree count assertion at line 547: expected one, observed zero. These were real Chrome `157.0.8103.50` results, independent of this machine's inability to start its normal Chromium sandbox.

The [actual artifact](https://github.com/Proto-UI/Proto-UI/actions/runs/44038705347/artifacts/14311530497) contains 113 files: 64 JSON records, 47 PNG captures, the test log, and browser environment. The downloaded ZIP is 4,124,494 bytes with SHA-256 `137d90267c2febb97c6dc7ce8bcbd470b787081109232181f704bc5fd61d7e58`. Its source binding names the exact clean head above. Inspected desktop, narrow, and forced-color captures show the initial React host with its real Tree. The artifact has no post-failure DOM, HTML, trace, or native phase journal; it does not establish that the later WC Tree eventually appeared.

Both Quick Start pages declare `initialHost="react"`. The host journey first clicks Web Components and immediately counts Tree descendants of the visible host panel. A count of zero is not merely a hidden Tree: this selector counts all descendants, including hidden ones.

## Governing completion boundary

The current [draft embedded Tree contract](../contracts/prototypes/shadcn-tree-embedded.md) and `code-example-client.ts` retain synchronous native selection/hidden state while acquiring an unvisited host's Tree in a later idle callback or timer task. This policy landed in `10d4897a7`; previously acquired Trees retain identity. Requiring a Tree before that admitted task has executed carries an obsolete eager-enhancement premise.

`data-code-example-init="1"` means that the controller owns the example; it is not a Tree completion marker. The existing `[data-code-example-tree][role="tree"]` is a useful observable boundary: `enhanceCodeExampleTree` inserts the real family Tree, checks root/item roles, updates source labels, and hides the native file list in one synchronous acquisition. Failed role admission removes the Tree and retains native controls. Focus-preserving fallback is also retained.

The test now waits for that existing Tree role to be visible with an explicit **1,000 ms cap**, then executes every original assertion unchanged. The original Tree count of one, geometry, keyboard, file selection, Copy, source identity, WIP and overflow checks remain. Each case still has its original **120,000 ms total limit**. No sleep, eager product acquisition, synthetic ready marker, Search deadline change, or timeout extension is introduced. A missing, failed, or starved Tree still fails within the new bounded observation.

## Executed local diagnostic

One existing `code-example-tree.test.ts` case, `composes queued real host Tabs and file Tree without duplicating source or resetting each host file`, ran with the repository's real WC Tree/Tabs implementation in Happy DOM. A Vite transform added observation-only logging around its existing completion wait; it changed no production code or assertions and did not inject a scheduler. The actual scheduler in this environment was the existing `window.setTimeout` fallback.

| Observation | WC host hidden | WC Tree count | Tree role | Native file list hidden | Original source-node identities |
| --- | --- | --- | --- | --- | --- |
| After selecting WC, before the next task | false | 0 | absent | false | retained |
| After the actual timer task and existing wait | false | 1 | tree | true | retained |

The case passed: **1 passed / 12 explicitly filtered**, exit 0; Vitest duration 6.12 seconds. The observations were captured at `08:54:48.159Z` and `08:54:48.263Z` on 2026-11-17. That interval includes the test's observation cadence and is not a native latency measurement. Full observed DOM and raw logs remain in the diagnostic receipt. Hashes of the client, Tree, Tabs and existing test source were unchanged before and after execution.

This model confirms the admitted selection-before-projection ordering. It is not a native browser, CSS visibility, or repaired-matrix pass. The scheduled `test-general` job failed before these CodeExample unit files ran, so it supplies no additional current-head unit pass.

## Remaining acceptance

The repaired native test has not run on a usable browser here. Run the original twelve host journeys with their unchanged remaining assertions and fixed admission cap, then the complete 26-case grammar file. Retain diagnostics if the cap fails; an acquisition error, focus fallback, or slow idle task must remain distinguishable from a completed Tree. The native artifact's original 12 failures remain historical evidence, and no eventual WC native success is inferred from the pre-assertion React screenshot or the local model.

This separate test/record patch does not modify the frozen Card response-control repair or any CodeExample product implementation.
