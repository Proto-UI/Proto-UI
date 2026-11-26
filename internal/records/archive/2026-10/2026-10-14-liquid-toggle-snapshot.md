# Liquid Toggle committed-paint observation

Date: 2026-10-14. Candidate base `1d0ce5e465f5c41f1841da720ffaa6efd6c9b952`. This is an evidence-observer repair; it changes no Prototype, Adapter, Runtime, Core, Compiler, provider, shader or interaction behavior.

The exact native run for `618c7f75ac8b74780237bf50363296e58016bd96` executed 11 Toggle cases with eight passing and three failing. The WC/light fixture and both public locale cases failed the strict `carrier.image === facts.image` assertion. Public WC interactions completed and both locales reached the React active optical sample. The prior Header Select timeout did not recur. Preserve these results: later successful samples do not retroactively turn a failed run into acceptance.

The observer retained a live `CSSStyleDeclaration`, copied its material image before awaiting `Image.decode()`, and read remaining CSS and attributes after that await. It then collected the committed-paint observation in a second browser evaluation. Thus a single returned record could contain an earlier decoded image, a later carrier image and another paint receipt. A controlled decode callback reproduces this concrete source defect: it commits image B while image A is decoding; the original observer returns A as its material image and B as its carrier image. The historical JSON omitted both raw image fields and commit counters, so it does not prove this race was the only cause of the native failures.

`observeLiquidToggleSnapshot` now copies all observed CSS primitives, semantic attributes, existing provider frame/source-revision diagnostics, style-owned image, and committed carrier geometry in one synchronous turn. It decodes that exact image, then reads a new complete snapshot. Only an unchanged snapshot may supply pixel statistics and the returned receipt. A changed snapshot is discarded and resampled, at most four attempts; each decode has a one-second ceiling. A stable decode error is rethrown, stable uncommitted paint remains uncommitted, and continuous replacement fails explicitly. There are no sleeps, longer functional timeouts, provider pauses, synthetic input, stale-image acceptance or relaxed image/geometry/quality assertions.

The standalone observer includes the existing `observeOwnedMaterialPaint` criteria to remain self-contained for Playwright serialization. A control checks agreement with that shared observer on a stable committed fixture. The browser capture consumes this same snapshot's paint receipt rather than performing a later paint evaluation. Receipt image bytes are represented by the captured material PNG hash; frame/source revision and retry count remain in JSON. A screenshot is taken afterward and explicitly labeled as potentially later in the dynamic scene, rather than being presented as an atomic screenshot of the sampled paint frame.

Tests model live CSS objects and controlled decode timing, not actual native rendering. They cover image replacement, same-image receipt/CSS changes, geometry changes, stable invalid carriers, stable and superseded decode errors, a never-settling decode, continuous replacement, fallback, and serialized callback independence. The original observer fails the focused replacement oracle with image A when B is current. The repaired observer preserves strict current-frame validation. Exact-publication-head native execution remains required to determine whether the three actual failures are resolved.

```text
Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.
```
