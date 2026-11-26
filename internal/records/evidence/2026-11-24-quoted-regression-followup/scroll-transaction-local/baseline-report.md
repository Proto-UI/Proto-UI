# Independent synchronous-measurement behavior controls

The executed positioning source is the immutable Git archive of 7642f1376b08ee3d4930f596da6a77ca74db9dda; installed dependency and non-positioning alias paths remain in the shared workspace at recorded HEAD 9b6a7e54a82cf0758cb0eb94a9befa69a0516a5e. This is not a full-worktree native baseline. No live production file was replaced.

The 18 frozen positioning source files and the independent test copy have matching before/after byte counts and SHA-256 values. The Vite load recorder confirms that the frozen host was actually loaded. The positioning src tree has no Git diff from 7642 to 9b6.

## Observed result

8 tests: **4 pass, 4 fail, 0 skipped**; process exit 1. Failures are expected negative controls, not a successful validation.

| Case | Result | First observed failure |
| --- | --- | --- |
| preserves scrollable extent through owned mutation delivery followed by a resize echo | passed | — |
| preserves scroll through equivalent connection updates while still refreshing anchor geometry | passed | — |
| preserves scroll through child paint, ARIA and DOM changes while refreshing anchor geometry | failed | AssertionError: expected +0 to be 80 // Object.is equality |
| retains scroll on content growth and clamps only to the real shrunken range | failed | AssertionError: expected +0 to be 80 // Object.is equality |
| finishes a fresh measurement at scroll 0 under smooth CSS before accepting later input | failed | AssertionError: expected 1000 to be 592 // Object.is equality |
| finishes a fresh measurement at scroll 80 under smooth CSS before accepting later input | failed | AssertionError: expected 1000 to be 592 // Object.is equality |
| reconsiders root class, authored style and text changes before the next reference refresh | passed | — |
| remeasures for requestUpdate when intrinsic input changes without a DOM mutation | passed | — |

In the child-mutation case, the first paint-token iteration already fails at offset 0 rather than 80; its later ARIA remove/re-add and child-list iterations were not reached on this baseline. In the growth/shrink case, the growth assertion fails first; the subsequent real-range shrink controls were not reached on this baseline. Both smooth-CSS cases fail on the synchronous viewport height (1000 rather than 592) before their later offset/input assertions. Those later checks require a candidate run.

## Model and limits

The fixture uses real Happy DOM nodes, authored styles, and MutationObserver delivery, a controlled ResizeObserver, and actual Floating UI 1.8.0. It explicitly supplies layout and scroll-range measurements. A small CSSOM ordering model supplies the CSS scroll-behavior behavior omitted by Happy DOM; it does not simulate browser animation or trusted wheel input. The fixture constrains observable viewport, positioning, and offsets; it does not inspect a cache or require caps to remain continuously applied within one synchronous measurement transaction.

The preserved controls still check root class/style/text changes, a forced metric update through requestUpdate, same-configuration anchor movement, and a resize echo after real mutation delivery. The new controls add child paint/ARIA/DOM changes, content growth and real-range shrink, initial zero, smooth CSS, and later input after an async boundary. Owner handoff, generation, and measurement-throw cleanup are covered separately by the implementation owner’s transaction suite.

## Files

- vitest.log: complete command output, including existing ES2024 warning text.
- result.json: original Vitest JSON reporter output.
- before.json, after.json: source byte/hash manifest, load provenance, and results.
- loaded-source.jsonl: frozen source paths actually loaded by Vite.
- execution.json: command, versions, exact source and dependency bindings.
- vitest.config.mts: isolated configuration; imports shared workspace base aliases.
- packages/modules/positioning/src/: immutable archived source.
- packages/modules/positioning/test/floating-ui-host-intrinsic-invalidation.test.ts: exact executed test.

Formatting and git diff --check for the repository test passed. Candidate/native results are deliberately absent from this baseline report.
