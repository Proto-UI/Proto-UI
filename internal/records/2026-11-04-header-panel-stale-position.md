# Header panel stale-position repair — bounded by the Header's own box

Base: `1c9c16217c9e25b3a7320ea75d55360e1bdf4372` (PR1210 head `ac6812860215709eabf54285cca8a845f0561c15` merged with main `8f621173585c37cb1e975b31168177076fd80ac4`). Scope: the Header panel's measured offset and width are one viewport's snapshot, and the CSS applied that snapshot unchanged after a viewport change.

## Measured cause

`apps/www/src/components/site-header-disclosure.ts` publishes the panel geometry as inline custom properties: `--site-header-panel-left` (a px offset from the Header's padding-box origin) and `--site-header-panel-max-width`. Both belong to the viewport that produced them.

`positionPanel` publishes them inside the same task as the measurement, and the Header's own `resize`/`ResizeObserver` handlers republish afterwards. Between the viewport change and that republish, the stylesheet still applied the previous viewport's snapshot. The panel is `position: absolute` inside `.site-header` (`position: relative`), so its containing block is the Header's own padding box, and the published offset was applied unclamped:

- `left: var(--site-header-panel-left, 0)` had no bound at all, and
- `width`/`max-width` were taken from the published maximum, which is one viewport's measurement.

Source-bound native probe (`/tmp/pr1210-header-geometry-probe.mjs`, an early `resize` listener registered at document start so it observes the delivery window before the application's own listener republishes). On the unmodified base CSS it reported three overflowing transitions, `fits=false overflowSamples=3`:

| Transition | Viewport | Published offset | Panel right edge | Header `scrollWidth` |
| --- | --- | --- | --- | --- |
| desktop → desktop shrink | 1280 → 1100 | `902.40625px` | `1254.41` | `1254` |
| desktop → compact | 1280 → 390 | `902.40625px` | `2148.81` | `2149` |
| compact → compact | 390 → 320 | `8px` | `382` | `382` |

The third row is the upstream exact-head red, `expected 382 to be less than or equal to 321`: the compact row kept the 390px measurement (`374px` wide from the Header's left edge) at a 320px viewport.

## Decision

One expression now describes the panel's inline size, and the offset is corrected by the excess only:

```css
--site-header-panel-inline-size: min(22rem, var(--site-header-panel-max-width, 100%), calc(100% - 16px));
width: var(--site-header-panel-inline-size);
max-width: var(--site-header-panel-inline-size);
margin-left: min(0px, calc(100% - var(--site-header-panel-inline-size) - 8px - var(--site-header-panel-left, 0px)));
```

- The inline size is `min(22rem, published maximum, Header box − 16px)`. `16px` is the measured 8px edge margin on both sides, so a fresh measurement is unchanged and only a stale measurement is clamped. The compact row overrides the expression without the `22rem` term, so the compact panel still takes the whole measured width.
- The offset correction subtracts the *used* inline size from the *published* offset and keeps only the excess. `min(0px, …)` means a fresh measurement is never moved: the correction is exactly zero whenever the published offset already fits, so the desktop anchor alignment (the panel's right edge under the menu button) is preserved.
- The bound is the Header's own padding box, not the viewport, so it holds for the documentation layout as well as the homepage.

No JavaScript changed, no viewport is widened, nothing is clipped, and no upstream oracle was relaxed.

## Evidence

- Native probe on the fixed tree: `fits=true overflowSamples=0 samples=8` for the same three transitions. Fresh settled placement is unchanged at every width — 1280: `x=902.41 w=352`; 1100: `x=726 w=352`; 390: `x=8 w=374`; 320: `x=8 w=304`.
- Upstream `header-select-elevation.browser.test.ts` for the two cases that were red upstream, `shadcn/vue/light` and `shadcn/vue2/light`: both pass with the fix. The same test on the reverted base CSS also passes, because that suite measures after the application has settled; the early-listener probe above is the discriminator for the delivery window.
- `site-header-layout.test.ts`: 25/25, including a new source contract with two negative controls (a `max()` inline size and an unbounded `margin-left` each fail the contract).
- Focused component suites `site-header-layout`, `site-header-disclosure`, `site-header-surface`, `header-select-elevation`: 89/89.
- `scripts/test/check-dialog-baseline-evidence.test.mjs`: 99/99. The `PROBE_HASHES`-pinned `browser-harness.ts` and `server-readiness.mjs` are untouched.

`apps/www/src/components/site-header-startup-handoff.test.ts` has one failing case, `does not change the homepage candidate or the Prototype transition recipe`: it asserts that `packages/prototypes/shadcn/src/button/button.proto.ts` contains `'transition-all'`, and that file has no such occurrence. The same case fails on the base commit `1c9c1621` with this repair reverted, and the assertion reads neither file this repair changes. It is a pre-existing failure in the Shadcn Button prototype source and is not attributed to this repair; it stays open separately.

## Open

The upstream compact→desktop reparent oracle and the `#933` whole-page overflow stay as separate issues; this repair bounds the Header panel only. Exact-head CI and the remaining Header acceptance breadth are pending.
