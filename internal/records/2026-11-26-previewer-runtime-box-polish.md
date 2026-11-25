# RuntimeBox, CodePanel, Tabs `variant="line"`, Popover Inputs, and Toast Hover Stability

Date: 2026-11-26 UTC. Scope: single-PR polish of the docs previewer (`RuntimeBox` / `CodePanel` / `SiteCopy`), four-family dogfood Tabs `variant="line"`, interactive four-family Popover demos, and oscillation-free Toast hover expansion. Non-normative engineering record; authoritative draft guarantees live in `spec/prototypes/P-BASE-TOAST.yaml`, `spec/prototypes/P-SHADCN-TOAST.yaml`, `spec/tests/T-TOAST-STACK-0001.yaml`, `spec/prototypes/P-*-TABS-LIST.yaml`, `spec/prototypes/P-*-TABS-TRIGGER.yaml`, and `spec/tests/T-RUNTIME-TABS-APPEARANCE-0001.yaml`.

## Observed Defects & Root Causes

1. **RuntimeBox loading width/height jump**:
   - In `apps/www/src/styles/site-startup.css`, `[data-previewer-startup-shell]` switched `.proto-previewer__preview` from `display: flex` to `display: grid !important` without declaring `grid-template-columns: minmax(0, 1fr)` or overriding `.proto-previewer__preview`'s `justify-content: center`. CSS Grid created an intrinsic-width `auto` column and centered it, shrinking the loading skeleton horizontally to text width mid-hydration before snapping back to full width on ready.
   - On `fixed-family` pages, SSR omitted a runtime-tabs height reservation before client materialization inserted the Tabs strip, shifting the preview box vertically.
2. **Previewer code lacked width-fitted Prettier formatting**:
   - `*Code.ts` snippets ran only `.trim()` (`formatCode`), so long single-line HTML/JSX/Vue tags and imports overflowed the ~68–72 column previewer viewport horizontally.
3. **Collapsed CodePanel leaked scrollbars, selection, and pointer targets**:
   - `[data-code-expanded='false']` left `[data-code-scroll-viewport]` at `overflow: auto` and kept ScrollArea tracks visible and interactive. Clicking anywhere outside the small centered expand button selected or scrolled the 4.5rem clipped snippet instead of expanding it.
4. **No collapse control after expanding CodePanel**:
   - `code-panel-client.ts` hid `[data-code-toggle]` on expansion without exposing a way to collapse long examples back.
5. **Floating overlay Copy button had transparent background over code text**:
   - `site-copy-command.ts` selected `variant: 'ghost'` (`bg-transparent`) for both header-bar copy controls and floating `.site-code-copy-overlay` buttons, causing the icon to sit directly over syntax-highlighted lines with no opaque backing surface.
6. **Incomplete four-family styling adaptation**:
   - `site-copy-command.ts` coerced `bootstrap-2-3-2` and `liquid-glass` scopes back to `shadcn`; `site-shadcn-controls.ts` did not register `wc-liquid-glass-button` or map generic `outline`/`sm` button props for `bootstrap-2-3-2` and `liquid-glass`; `CodePanel.astro` did not propagate preview projection family (`liquid-glass` / `bootstrap-2-3-2` / `brutalist` / `shadcn`) to its expand/collapse buttons.
7. **RuntimeBox Tabs used legacy `appearance="underline"` instead of dogfood `variant="line"`**:
   - `shadcn-tabs-list` already defines upstream `variant="line"` with list-to-trigger context and owned line decoration, yet `runtime-tabs.ts` and `projection-composition.ts` still passed legacy `appearance="underline"`, opting out of family recipes and style profiles. `brutalist`, `bootstrap-2-3-2`, and `liquid-glass` lacked matching `variant="line"` list-to-trigger projections.
8. **Popover demo inputs were non-interactive `<div>` placeholders**:
   - All four family Popover demos (`demo-shadcn-popover.demo.ts`, `demo-brutalist-popover.demo.ts`, `demo-bootstrap-2-3-2-popover.demo.ts`, `demo-liquid-glass-popover.demo.ts`) rendered `tag: 'div'` with `attrs: { type: 'text', value: '...' }` instead of real interactive `*-input-root` prototypes, leaving fields empty and uneditable and making Reset a no-op.
9. **Toast bottom-right hover infinite oscillation**:
   - `shadcn-toast-viewport` kept `pointer-events-none` even while expanded (`flex flex-col-reverse gap-3.5`). Hovering a peeking collapsed card at a coordinate that fell inside the 14px `gap-3.5` between expanded cards caused immediate `pointer.leave` → collapse → `pointer.enter` → expand oscillation.

## Implemented Direction

- **Startup layout stability**: Lock `[data-previewer-startup-shell]` to `grid-template-columns: minmax(0, 1fr); align-items: stretch; justify-content: stretch; width: 100%; min-width: 0;` and reserve matching SSR runtime-tabs geometry on both generic and fixed-family `PrototypePreviewer` renders.
- **Prettier code folding**: Introduce build-time `formatPreviewCode(raw, lang, printWidth = 68)` backed by `prettier` (cached, syntax-safe fallback) for `PrototypePreviewer` snippets so displayed and copied code match (`code.textContent === code.dataset.rawCode`) and fold cleanly within the previewer column.
- **Collapsed CodePanel safe-zone & collapse affordance**:
  - When collapsed (`data-code-expanded="false"`), hide scrollbars (`overflow: hidden` on viewport/pre, `display: none` on `[data-code-scroll-track]`), mark the clipped code subtree `inert`, and cover the full collapsed region with `[data-code-expand-guard]` so clicking anywhere expands the code.
  - When expanded (for overflowing blocks only), reveal a dogfood family collapse button (`[data-code-collapse]`, `收起代码` / `Collapse code`) that folds the panel back, resets scroll offsets, and restores keyboard focus to `[data-code-toggle]`.
- **Copy button surface rule**: Keep `ghost` for header/toolbar copy controls (`[data-code-file-header]`, `[data-code-toolbar]`, `[data-code-example]`, `[data-code-file-browser]`, `[data-code-presentation="docs"]`, `[data-code-collapsible="false"]`), and use an opaque single-owner family Button surface (`outline` with `.site-copy-floating-overlay` dark-mode canvas fill for shadcn, `surface` for brutalist, `default` with icon sizing for bootstrap-2-3-2, `regular` + `material="opaque"` for liquid-glass) for floating `.site-code-copy-overlay` and floating `.site-ec-copy` buttons.
- **Four-family adaptation & dogfood `variant="line"` Tabs**:
  - Add `variant="default" | "line"` with private list-to-trigger context to `brutalist`, `bootstrap-2-3-2`, and `liquid-glass` Tabs (retaining `appearance="underline"` backwards compatibility), and regenerate CLI token presets and `native/gpui/fixtures/style-tokens.json`.
  - Switch `runtime-tabs.ts` and `projection-composition.ts` to dogfood `variant="line"` across all four families with non-clipping horizontal scroll padding on the wrapper.
  - Stamp `data-preview-control-family` on `.proto-previewer` and extend `site-library-family.ts`, `site-copy-command.ts`, `site-code-surface.ts`, `site-shadcn-controls.ts`, `CodePanel.astro`, and `site-library-family.css` so Runtime Tabs, Copy, CodeSurface, and Expand/Collapse buttons adapt across `shadcn`, `brutalist`, `bootstrap-2-3-2`, and `liquid-glass` in both light and dark modes (including non-fixed-family Liquid Glass pages inside the site-level `shadcn` scope).
- **Interactive Popover demos**: Upgrade all four Popover demos to real `*-input-root` and `*-label-root` prototypes with `controlLabel` associations and cross-runtime `api.call(..., 'resetValue', ...)` Reset handlers, and declare those auxiliary prototypes in `projection-families.ts`.
- **Oscillation-free Toast hover**: Expose `hasOpen` on `base-toast-viewport`, clear `hovered` when `openIds` empties, and switch `shadcn-toast-viewport` to `pointer-events-auto` whenever `hasOpen && expanded` (plus `pointer-events-none` when empty across the other three family viewports) so expanded inter-card gaps remain inside the viewport hit area.
