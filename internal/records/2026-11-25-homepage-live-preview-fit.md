# Homepage live mobile preview fit · 2026-11-25

## Request and boundary

Agent's sanitized paraphrase of the current maintainer request: render the homepage thumbnail from the real live components, fill its available mobile width, use the desktop bottom fade treatment, and remove the additional open/close-interaction link. The private supplied screenshot is not published. This is Website-owned composition work, governed by the draft consumer-layout boundaries in `C-PROTOTYPE-STYLE-CLOSURE-0001-C/D` and the existing generation ownership in `D-HOST-PROTOTYPE-PROJECTION-SCOPE-0001`. No catalog lifecycle or public API changes.

The investigated baseline is `06738ba67b9978e84d785569b1759896f11420da`. Before publication the unpublished branch was rebased onto current main `5f0844907895a4ae0db506fe6a5d0bf162318329`. The incoming #1835 skeleton DOM and loading styles are preserved; the sole overlapping markup conflict was resolved by removing only the redundant toggle. The exact native before/after comparison uses this newer immutable main baseline.

Both baselines already create real Runtime components. The visible mobile underfill has a source-level candidate cause: a `90rem` stage has a fixed `zoom: 0.19` fallback; its full-width override depends on typed CSS division support. At a 16px root that fallback is only 273.6px wide. The reporter's precise WebView and CSS support are unknown. Native evidence must distinguish that inference from what the verification browser actually reproduces.

## Repair

- Measure the actual unscaled stage width and its available parent width. A ResizeObserver updates the compact scale when either changes; commit/rollback also measures the current generation, and teardown disconnects observers.
- Keep the automatically rendered five-column thumbnail inert. Remove the redundant bilingual toggle, its copy, styles and listener. The approved Hero Demo link retains its native fragment destination and now expresses intent to enter the same full-size interactive gallery, including direct links.
- Preserve the existing desktop-to-mobile focused-control protection. Native fragment navigation remains browser-owned; no click interception or history writer is added.
- Put the fade on an unscaled app wrapper around the stage. Both layouts use `min(8rem, 28%)` and the same gradient. Attribution remains outside, controls retain focus/overflow paint, and focus-within, forced-colors and reduced-transparency exclusions remain.

Source bindings in `internal/website/self-hosting-coverage-matrix.md` are updated for the three production files. The homepage consumer remains `blocked` and the Hero hash-navigation row remains `research`; this repair does not settle their larger selection/no-JavaScript/navigation criteria. Historical explicit-toggle and native inert-oracle records remain unchanged.

## Evidence and current limits

The earlier toggle protocol assertions are superseded by the current product direction. Native coverage uses the existing visible Hero link and retains the same-DOM identity, native accessibility, actual focus, Enter feedback, responsive geometry and 200% text checks. The new preview checks measure actual mobile width, the unscaled fade, real theme and Runtime changes, and native fragment journeys. Implementation-string constraints for the deleted toggle and typed-division formula are removed rather than replaced with new source-text mirrors.

Independent source review of the three initial production files found no blocking issue in scale geometry, generation publish/rollback, observer teardown, native hash ownership or the unscaled fade boundary. That review is not a browser pass or a formal GitHub approval.

The first local frozen offline dependency install failed because `picomatch-4.0.4.tgz` was not cached. A separate exact-baseline checkout on the authorized Linux host subsequently completed a normal frozen pnpm 10.32.1 install with Node 24.22.3.

A single-worker focused run on the 5f08449-based candidate patch passed all 90 cases in four files: homepage-showcase, homepage-runtime-client, homepage-focus-lifecycle.integration and homepage-presentation. The run completed on 2026-11-25 at 00:19:46 UTC, with zero failures or skips. It binds source/test patch SHA-256 `37e68dac876ac5dea25ebdd29fa45b0150d58062a47cf63e6ec4aa6b59a2e568`; this is focused behavior evidence, not native visual acceptance.

Existing release-test load remains separate from the new hosted native evidence lane. Native execution and visual inspection are pending; no production deployment or complete regression acceptance is claimed here.
