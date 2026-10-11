# Finf B: reachable partial-snap Drawer scrollports

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

2026-10-10 UTC. Narrow follow-up to an actual browser failure; not Finf acceptance.

## Observed failure

Official run `38036693145`, artifact `11663817331`, source `14ce5ddee6311b3b8e807f8b5ac24e1ba4173c92`, `/en/ui-libraries/shadcn/drawer/`, React, 1365×1000. The inspected screenshot and JSON show a 152px panel at y=924 after a 0.5 snap. Its bottom is 1076; Close is outside the viewport. The preserved actual Close click timed out after 30 seconds. Self-height translation hid content beyond the viewport while the panel's own scrollport remained full height, so scrolling the element into view could not repair reachability.

## Repair

- Snap now sets the physical scrollport extent instead of translating the panel. Top/bottom full extent is 85% of the host's available height; left/right full extent is the smaller of 20rem and available width. `--pui-drag-progress` scales the selected extent continuously.
- Four fixed recipes combine available-region center/size with the preview fraction to keep the panel on its selected edge, inside the host-provided region. Cross-axis size uses the same region. No raw DOM, pixel geometry in portable state, runtime-built utility tokens, or new host seam was added.
- The panel owns vertical scrolling, long-word wrapping and non-stretched grid rows (`content-start`), so long content is scrollable within the current snap. `offsetPercentage` remains a compatible public observation but no longer moves content offscreen.
- Axis deltas use the original contact's normalized geometry multiplied by its starting snap fraction. A half-panel contact moving by half its initial size contributes 0.25 of the full extent, not 0.5. Repeated preview updates do not compound. Controlled refusal restores the committed size.
- An executable collector assertion also exposed the old Object.entries-to-tw variable tables: their four-sided Content/Handle tokens were not statically collected. Both now use direct literal rules. The complete Drawer token set, not only selected recipes, is required to lower without unsupported tokens.
- Ten bilingual pages explain the bounded scrollport behavior. Existing demos and the official Close-click assertion are retained.

## Verification and known prerequisites

Pinned offline pnpm 10.32.1, narrow source checks only:

- Drawer host suite: 33 passed, 2 failed (35 total). Twenty Base/style×side cases exercise half extent and actual prototype Close commands. Four half-sized contact cases assert .75 preview from .5, changed geometry during preview, repeated samples and keyboard Home/Close. Existing four-edge keyboard, interruption, controlled snap/dismiss refusal and new half-snap refusal checks pass.
- Existing overlay-window regressions: 10/10 passed. Combined result: 43 passed, 2 failed.
- Both failures remain intact for the integrated tree: complete CSS lowering needs shared `da31bf03cb8349f2799bdf3c861c842de28ae6e3` plus earlier shared bottom-1/cursor-resize/z-10 support; terminal CSS-variable cleanup needs existing shared `d73ee81e`. The isolated older branch lacks these predecessors.
- Attempting the new CSS commit independently conflicted in `packages/cli/test/proto-style-css.test.ts`; cherry-pick was immediately aborted without overwriting shared tests. The integration owner has the complete prerequisite tree.
- Focused TypeScript checking passes across 15 overlay directories and imports. Ordinary Astro base-config and initial Alert Dialog description-registration warnings remain visible.

These host tests use synthetic pointer geometry and do not prove painted dimensions or click reachability. The integration owner must regenerate styles with the supported generator, rerun the official browser journey with its Close click, add viewport/panel/Close intersection assertions, and inspect new source-bound screenshots. Native/GPUI, full CI and independent acceptance remain pending. The earlier failing screenshot is retained as failure evidence, never reused as a repaired receipt.
