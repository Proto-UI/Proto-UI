# Finf Tooltip static surface migration, 2026-10-10

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This is an implementation record, not normative authority. The revised draft `P-SHADCN-TOOLTIP-CONTENT` owns this direction; `P-SHADCN-TOOLTIP` retains compatibility boundaries. Base: `ed78803f1d527a2385baf41970474b77ba93fe71`.

## Decision and provenance

The previous border/popover/shadow/overflow surface conformed to its then-current draft definition. This change deliberately migrates that draft, implementation, tests, and English/Chinese documentation together. It is not a claim that the old implementation violated its definition, nor a lifecycle promotion.

- Static visual source: https://ui.shadcn.com/r/styles/base-nova/tooltip.json, retrieved 2026-10-10.
- Registry JSON SHA256: `2f55867faecee2d3616cfd8c6a80b538909a21e62fdfa2788b1ead56093e5395`.
- Extracted TSX SHA256: `f83d5f511812573f4ac98b866d397a46fda0f27eeb0af0ea89af01969eefbc5a`.
- Deployment Git SHA was not obtained. This is a date/content-hash snapshot, not a verified upstream HEAD.
- License: MIT, Copyright (c) 2023 shadcn; the complete license remains in `packages/prototypes/shadcn/THIRD_PARTY_NOTICES.md`.
- Existing API comparison remains `shadcn-ui/ui@f31ed81983653919dd4fe77aee4b4859f610f1dc`, `apps/v4/registry/new-york-v4/ui/tooltip.tsx`. That Radix source uses sideOffset 0; the separate base-nova snapshot uses 4. Proto UI keeps Base's 4.

Only the static Content token recipe is transformed. Upstream `max-w-xs` becomes the already supported physical token `max-w-80` (20rem at the default scale). The tokens are `z-50 inline-flex w-fit max-w-80 items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background`. No new Compiler/CLI vocabulary or dispatch is added. The palette follows host foreground/background, not fixed black/white. The former border, shadow, popover colors, and overflow clipping are removed because they are absent from the selected static source.

No upstream React/Base UI code is executed or imported. No new third-party code is run. Group/Root/Trigger implementation, Base behavior, default delays (700/100/300ms), accessibility, renderer Portal, positioning, and controlled ownership are unchanged.

## Evidence and limitations

- Focused Base + Shadcn Tooltip: 2 files, 12 tests passed, including existing interaction/ownership regression and actual opened `data-pui-style` emission through document and Shadow physical CSS renderers.
- Browser expectations are updated for same-instance Light/Dark repaint, resolved theme palette, inline-flex, gap, maximum width, short/long text, absent border/shadow, and existing Portal/focus/Escape journeys.
- Actual browser tests and screenshots are not run in this slice: the inherited browser sandbox restriction remains. No `--no-sandbox` workaround is used. Browser assertions being authored are not passing browser evidence.
- Generated presets and website style outputs are regenerated through the repository generators; no generated files are hand-edited.
- Broader focused check: Base Tooltip (7), Shadcn Tooltip (5), and existing physical CSS renderer (56), 68/68 passed. Prototype inheritance schema/graph: 4/4 passed. Node 24.19.0 and pnpm 10.32.1; Vitest 2.1.9, one worker. A requested nonexistent `packages/spec/loader/test` filter selected no tests; the later exact fixture/graph paths supply the four real spec tests.
- `check:styles:preset` passed all three family generator checks. CLI package build and website style generation passed; only the Shadcn generated inventory changes (three new entries); website output has no tracked delta.
- `check:spec-authoring` passed all three changed catalog inputs through `node --import tsx scripts/spec/check-lifecycle-authoring.mjs --base ed78803f1d527a2385baf41970474b77ba93fe71`. Its usual tsx CLI initially could not create its IPC socket; the import-loader invocation avoids requiring that optional CLI socket. The first actual check found three absent GPUI evidence paths because of inherited sparse checkout. Materializing the existing tracked `native/gpui` subtree restored those inputs without code changes.
- `check:types` finally passed: workspace tsc and Astro (802 files, zero errors, zero warnings, ten hints). Initial failures were missing Corepack/Astro cache directories and two missing `shared/links.json` imports from inherited sparse checkout. Reused the installed pnpm cache, disabled Astro telemetry, used a writable config directory, and materialized existing tracked `shared`; retained the failed runs before the final pass. A separate final workspace tsc also passed.
- Aggregate prototype catalog still reports 559 issues; public docs still reports 85 drift issues. Both commands were independently repeated at exact base `ed78803f` in a separate worktree; candidate and baseline logs are byte-for-byte identical. These existing aggregate failures are not waived or labeled green.
- Supported `agent:publish commit` was attempted with the dot exemption, exact local branch/head/staged tree, and DCO-capable normal path. It exited 1 at `gh api repos/Proto-UI/Proto-UI` because gh is unauthenticated, before commit or hooks. No direct-git bypass, fabricated gh response, credential copying, or external write was used; the final candidate remains staged and uncommitted.
- `git diff --check` passed. Browser, screenshots, full runtime suite, package-budget measurement, GPUI runtime, and packed consumers were not run. No external write occurred.

## Remaining work

Independent review and fresh browser/screenshot evidence remain required. Arrow is still explicitly omitted by `P-SHADCN-TOOLTIP-ARROW-OMISSION`; Base has no governed geometry/offset/collision-feedback channel. No CSS triangle or second positioning owner is added. Upstream transform-origin, directional enter/exit motion, and kbd descendant recipes remain unaligned. Bootstrap and Liquid Glass Tooltip families remain outside this slice. GPUI, packed-consumer coverage, and full-family acceptance are not inferred from these tests. No full-delivery checklist is advanced.
