# Mobile overview native inert oracle repair

The original full CI at `fde59e8517b52f4c0a3fd19453a5d586e9fe7f3f`, browser job [138421815205](https://github.com/Proto-UI/Proto-UI/actions/runs/45385473253/job/138421815205), failed the mobile overview case because `getByRole('button', { name: '主要' }).count()` returned one while the stage was `inert`. The same job reported 52 passed and two failed; the separate experimental Bootstrap geometry assertion is not changed here.

## Observed faulty premise

The pinned Playwright 1.58.2 injected role-selector implementation checks display, ARIA-hidden ancestry and slot visibility, but does not implement inert ancestry. A native sandboxed Chromium control independently demonstrated that this locator still counts the button when actual Tab skips it, programmatic focus is refused and the native accessibility node is ignored for `inertElement`. Removing inert preserves the DOM node and enables native focus, Enter activation and AX exposure. The complete original probe, HTML, AX responses and execution receipt are retained in [the b57 native evidence](2026-11-24-homepage-b57-native.md).

This establishes a test-oracle defect. It does not imply that every application inert state or assistive-technology profile works.

## Bounded test correction

The real homepage journey now retains the actual button through an `includeHidden` locator and checks Chromium's native AX tree plus actual focus refusal while collapsed. After the existing Enter action expands the gallery, the same DOM node must be exposed, acquire native focus and produce the original Enter feedback. Collapsing again must remove its AX exposure. The original light/dark loop, geometry, five-column layout, fade, attribution, viewport handback, inert property, expansion state and overall deadline remain.

The test performs no application mutation beyond its existing user actions and an attempted native focus. It does not use an ARIA attribute to simulate inert, extend a timeout, discard a runtime or change the product to satisfy the old role count. The browser context still closes in `finally` on any failure.

## Validation boundary

The focused TypeScript check using the actual website tsconfig and this full browser file exited zero. Independent source review found no blocking issue at source SHA-256 `bf80bf18243267232bd8a516da3d1873e0754d91ac060ecc43ff63291ea694f0`. The review notes a nonblocking future improvement to address the native AX node by backend DOM identity; the present exact-name 0→1→0 assertion remains fail-closed for extra exposed buttons of the same name.

The [review and type-check inputs](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-release-followup/mobile-inert-oracle-validation.tar.gz) retain the source review and actual focused config/output. The original site's complete light/dark journey has not yet been rerun on this test correction. Its result remains open; the separate minimal native probe is not substituted for website acceptance.
