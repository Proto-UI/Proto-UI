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

The `#933` whole-page overflow stays a separate issue; this repair bounds the Header panel only. The compact-to-desktop reparent case was revised upstream in `b27742508` and its authority is reconciled in `2026-11-02-header-escape-focus-return.md` under "Rhea style authority for the revised compact-to-desktop reparent case". Exact-head CI and the remaining Header acceptance breadth are pending.

The measured cause, the native reproduction, the source contract and the retained `#933` attribution recorded for the earlier width-only bound are consolidated here; this record additionally carries the position axis, which the earlier bound did not cover.

## Integration review corrections

The newly added clamp test only matched CSS source strings and was removed rather than retained as behavioral coverage. The unrelated startup-handoff check also pinned a literal `transition-all` in a prototype file: that source assertion was removed, while its real non-Docs Button visibility assertion remains. Both affected Header suites then passed **27/27**. No production CSS changed during this cleanup.

The retained native probe script was found to hard-code `sourceSha: 04f0ba7e45f701a9901bc1bc1e7346638966616b`, rather than recording the executed base/fix revisions. Its raw measured samples remain historical observations, but that field does not establish the claimed candidate binding. Fresh byte-bound before/after proof is required before asserting exact-source native verification; old receipts will not be rewritten or relabeled. The earlier source-pin failure is a test defect, not evidence of a Shadcn Button product defect.

The first corrected probe was prepared as `/tmp/pr1210-header-geometry-sourcebound-probe.mjs` before execution: `node /tmp/pr1210-header-geometry-sourcebound-probe.mjs <output.json> [runtime] [worktree]` against `PROTO_UI_BROWSER_BASE_URL` (default `http://127.0.0.1:4319`). That version described a source-derived arithmetic model; the execution below uses its subsequent revision with actual browser used styles instead.

### Corrected probe execution on 2026-11-04

The subsequent revision removes the generic CSS arithmetic interpreter. It binds the complete stylesheet, geometry publisher, probe bytes and actual `HEAD`; uses stable owner identities; and checks the browser's used geometry during the stale-publication window. Missing mappings, non-finite geometry and browser console errors reject the observation.

The actual Vue attempt at `2026-11-04T13:11:30.338Z` produced `/tmp/pr1210-corrected-probe-post-recovery-20261104.json`. Its before/after source bindings matched at `b57cc569570fc8314871a68fc0a9913e58cbac4d`: stylesheet SHA-256 `b8b72d14201be8e4aafec267c9d7d3b073bfe96bdb077ee07c246a3f0ed462c0`, publisher SHA-256 `f1fdabecbcea76a920a564f43d86ebc5a5077011226a278410f2e954a0fea60a`, and probe SHA-256 `96df82aabf7fd87d24cd37898bd6734ea265ea19b3c0c50b0e87f862dbf92204`.

Chromium failed during launch with sandboxing requested, before a page or geometry sample existed. The sandbox helper `/usr/lib/chromium/chrome-sandbox` was absent. The receipt retains `fits: false` and the launch failure; neither is a product-geometry verdict. There was no retry with `--no-sandbox`. Exact-source native before/after geometry remains unverified and requires a working sandboxed browser environment. The historical samples and focused unit results above do not close that condition.

### Integration omission and bounded recovery on 2026-11-05

The merged PR1210 head `fc96b32edf8ef6142b3b20623e86e23deeb8fdf3` contained the clamp source assertion but omitted the actual CSS repair from `f1c908d54`. Earlier passing results on a different repair branch did not verify that merged head. Commit `9046a4d9f` restores the original CSS change on that head. The incidental source-string assertion is removed again; it does not exercise panel geometry.

A managed Chromium tab loaded the complete recovered stylesheet, SHA-256 `b8b72d14201be8e4aafec267c9d7d3b073bfe96bdb077ee07c246a3f0ed462c0`, in a bounded Header fixture. The published offset stayed at `900px` and the maximum width at `1184px` while the viewport changed. At widths 1200, 768, 390 and 240px, the recovered CSS kept the panel inside the Header with an 8px right margin and no Header horizontal overflow. The actual merged stylesheet overflowed at every width under the same conditions. Raw observations: `/tmp/release03-header-css-bounded-smoke-20261105.json`; candidate visual: `/tmp/omp-sshots-15c12b9752712c4b.png`.

This fixture proves browser evaluation of the CSS bound with stale inputs. It does not exercise the application controller, actual resize-event delivery, projection lifecycle, all runtime/family combinations, or the original sandbox-required probe. Those acceptance conditions and independent review remain open. No prior native receipt is promoted to exact-head application proof.

### Application-lifecycle early-resize evidence on 2026-11-05

The candidate adds `Header panel before native resize placement delivery` to `header-select-elevation.browser.test.ts`: an `addInitScript` listener armed before application scripts samples the open panel on the earliest native `resize` event, proving the measured clamp holds while `--site-header-panel-left` still carries the previous viewport's stale publication. Report `/tmp/release03-header-early-native-tests-20261105.json`: **wc, vue and vue2 passed 3/3** across 1920→1200→390→240; each first sample shows the stale left variable (`1536px`, `824px`, `8px`) while geometry stays inside the 8px viewport margin with no Header overflow (evidence `/tmp/release03-header-early-native-20261105/`). The react case failed twice at `ready()` after the runtime Select switch — a 30s readiness timeout before any resize sample (`/tmp/release03-header-early-native-react-20261105.json` and its retry) — a runtime-switch readiness issue, not a resize-geometry verdict. Attribution: the untouched baseline `shadcn/react/light` candidate-acceptance case times out at the same `ready()` call (`/tmp/release03-header-baseline-react-20261105.json`), so react runtime-switch readiness is an environmental/existing debt in this worktree, not a regression from the clamp or the new case; react native coverage remains open. Exact-source sandbox binding, the remaining family/theme matrices and independent review stay open.
