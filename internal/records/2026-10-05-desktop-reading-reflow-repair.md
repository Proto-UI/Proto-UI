# Desktop reading reflow owner repair

This is a bounded website-layout correction for [PR #816 review r4182944312](https://github.com/Proto-UI/Proto-UI/pull/816#discussion_r4182944312), based on `350e74f9010906e1a7640b55d15d864fa7cb0f66`. The requested result is a visible lateral native TOC at normal desktop sizes while retaining the existing enlarged-text reading flow. No dedicated spec entity governs this website breakpoint; the change does not alter a Prototype contract, lifecycle, public API or authored content.

## Reproduction

[Run 37301908533](https://github.com/Proto-UI/Proto-UI/actions/runs/37301908533) retained artifact `11341774632` (ZIP SHA-256 `39b4e165b4f2a0859747f704aecf398faa1cf677c66c2869ad8168c88782d888`). Its `reading-breakpoints.json` binds the clean source above. All eight normal 1280/1281 cases fail the unchanged lateral-TOC assertions across Quick Start/Radio Group and light/dark. All four normal 1279 cases and the four separate 1440/200% text controls pass their observations. The failed run remains failed evidence.

The normal captures measure root text at 16px, canvas content width at 1248/1249px, and the reading wrapper in column flow. Quick Start's TOC is 499px high and pushes the main pane to y=579px. Inspection of the original `quick-start-light-normal-1280-text100-viewport.png` and `radio-group-dark-normal-1280-text100-viewport.png` confirms the actual TOC occupies the top reading area above the article. The failure is visible composition, not a missing-link probe or a browser-zoom result.

## Owning change and boundary

`TwoColumnContent.astro` retains its initial-font viewport `min-width:80rem` gate and changes only the root-relative `docs-canvas` upper limit from 80rem to 72rem. The 72rem value reuses that owner's existing threshold for column arithmetic as a conservative reading-space budget. This is a local implementation choice, not a newly cataloged semantic guarantee.

The old 80/80 overlap includes shell padding: `PageFrame.astro` names the full `.docs-shell` content box as the query input; `global.css` gives its border box 1rem padding on each side. At normal 16px root, 1248/1249px is below the old 1280px container limit but above the new 1152px limit. Merely making the viewport comparison strict would leave 1281px and later padded neighbours broken. The source regression also models a 15px classic scrollbar, explicitly separate from the captured zero-scrollbar environment.

Root-relative enlargement is preserved. The recorded 1440px/32px-root control has a 1376px content box, below the new 2304px limit. It therefore still selects the same reflow declarations: visible native TOC, full-width links, static flow and main pane after the TOC. No reflow declaration, display/hiding policy, slotted native owner, Header rule, authored MDX, Base behavior or Light DOM structure changes. The container threshold continues to scale with root text rather than being replaced by a fixed-pixel or zoom flag.

## Verification and remaining evidence

- The source regression reads the actual nested viewport/container thresholds. Before the CSS change, three checks fail, including an observed test failure at normal 1280px. Afterward, the layout-source and strict visibility suites pass 17/17.
- Bounded arithmetic checks cover normal 1279, 1280, 1281, 1296, 1312, 1313, 1327, 1328, 1360, 1361 and 1440px, with modelled 0/15px scrollbars. They also cover the 200% control, preserved viewport gate, and both sides of the root-relative threshold at 20/24/32px roots. These are source predicates, not browser cascade or paint observations.
- `node --test scripts/test/reading-reference-breakpoints.test.mjs scripts/test/reading-reference-evidence.test.mjs`: 30/30 pass. The committed 16 real-browser cases, their expected layouts and strict visibility checks, capture tools and workflow remain unchanged.
- `node node_modules/typescript/bin/tsc -p tsconfig.workspace.json --noEmit`: pass.
- `COREPACK_HOME=/tmp/corepack ASTRO_TELEMETRY_DISABLED=1 XDG_CACHE_HOME=/tmp/proto-astro-cache corepack pnpm@10.32.1 --filter apps-www check`: pass, 411 files, zero errors/warnings and four existing hints. The standard command regenerates owned style outputs; no generated tracked file changed.
- Prettier checks on all three changed files and `git diff --check`: pass. Full repository tests and native candidate browser capture are not claimed by focused source checks.

The known local Chromium Unix-domain socket denial and failed escalation mount are not retried. Candidate visual acceptance remains pending: run the same clean-head hosted 16-case profile, inspect original normal and 200% PNGs and their native TOC geometry, and independently review the frozen change. The before images cannot establish the after layout; source arithmetic alone cannot establish every intermediate enlarged-text layout or a universal accessibility result.
