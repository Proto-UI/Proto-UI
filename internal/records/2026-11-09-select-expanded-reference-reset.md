# Reset expanded Select alignment when the reference changes

Date: 2026-11-09. Related: #1159 and draft PR #1381, candidate base `bcf3dd6dfd6405233cc6136310ee772563f90713`.

## Bounded review finding

Review identified a missing reset in the neutral target-alignment host. After an end-pinned scroll expansion, `onScroll` writes `justify-content: flex-end`. A later changed reference rectangle already replaces the expanded height and scroll request with a newly solved initial plan, but the host retained that old content alignment. A Surface shorter than the new Frame can consequently sit at its trailing edge rather than the plan's normal starting position.

The missing alignment reset also exists at the PR's main base
`0607c6c5c386b8a932ab850e92a8873b2121dc45`. This is an existing gap in the
requested alignment behavior, not a regression introduced by #1381.

This is a repair of the existing draft `C-TARGET-ALIGNMENT-PLAN-0001` normal initial content alignment and the reference-change reset described in `2026-11-09-select-inplace-contour.md`. No API, prototype policy, solver equation, CSS recipe or spec lifecycle changes. Same-reference metadata refresh still retains scroll expansion.

## Repair and discriminating evidence

- The host now resets owned content alignment to `normal` before measuring a changed reference plan, alongside its existing reference-change height/scroll reset. The ownership lease still restores the prior author value on disposal.
- Two new host tests perform initial alignment, enable first-frame expansion, scroll the inner viewport, refresh unchanged metadata, then either move the reference and dispatch outer scroll or change reference width and dispatch window resize.
- The fixture explicitly simulates a one-child column flex Frame. Initially a 600px content area is constrained by the Frame, with at least 25px of observable scroll range; its scroll setter clamps to that range. After expansion, moving the reference upward grows the Frame beyond the natural Surface, or a wider reference reflows ordinary rows into shorter content. Row top is calculated from the host's written Frame height, pin, margin, content alignment and actual stored scroll offset. It is not injected from the expected reference position. These are controlled layout facts, not browser rendering.
- An earlier probe used a short Surface without sufficient initial scroll range. Its freely writable mock scroll offset was insufficient evidence of a realizable scroll transition. It was replaced, not counted as the regression proof.
- Against a byte-preserved copy of the pre-fix PR host source, both final cases failed at the row-position assertion: simulated row top was 193px instead of 60px after outer scroll and 393px instead of 240px after reference resize. The other 34 host tests passed. Temporary baseline module/test copies were removed after that run; the working candidate was not swapped during concurrent work.
- With the repair, all 36 host tests passed. The unchanged-reference control still retains expanded height, `flex-end` and the same simulated row position. Repeated update after reference reset remains aligned; disposal restores authored `flex-start`.
- Final affected matrix: **42 files, 670/670 tests passed** with Node 24.22.1 / pnpm 10.32.1, using `vitest run packages/modules/positioning/test packages/prototypes/base/test/select* packages/prototypes/shadcn/test/select* apps/www/src/content/docs/zh-cn/demo-select-item-sizing-motion.test.ts --maxWorkers=1 --minWorkers=1`. Formatting and `git diff --check` passed. This follow-up did not rerun the full workspace type check; the integrating task owns that final combined check.

## Remaining native acceptance

No native reproduction or new screenshot is claimed. The previously established Chromium startup `socket() failed: Operation not permitted` blocker remains; this follow-up did not repeat that unchanged failing browser launch or relax sandbox settings.

The supported-browser follow-up is: open a real item-aligned Select in a scrollable ancestor with content taller than its initial Frame; verify the scroll range and cause an end-pinned inner scroll expansion. Then scroll the ancestor so the Trigger moves upward and the newly allocated Frame exceeds natural Surface height, or widen the Trigger so ordinary long rows reflow into shorter content. After layout settles, compare all four selected-Item edges with the current Trigger (≤0.5 CSS px when the layout is feasible), inspect the Frame's normal content alignment, and capture the current commit. Include unchanged-reference refresh as a control and repeated outer movement/reopen. Programmatic scroll setup must be labeled separately from native input evidence. The deterministic offsets are not measurements of the real page.

The integrating task owns exact-head types, CI, native evidence, independent review and publication. This local repair does not close the full #1159 acceptance gate.

Agent: dot
