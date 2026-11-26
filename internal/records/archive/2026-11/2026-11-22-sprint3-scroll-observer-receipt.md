# Sprint 3 Scroll Area observer receipt closure

## Original native failures remain unchanged

The passive archive for source `830287f95959a4a1a4fb797df68b0bd6889e0bae` (SHA-256 `95303ded4c27553932e093e7f79615d454ebcb6ddc572c5246ad41a3d70e0f84`) contains eight failed Scroll Area rest captures, one per host/theme. The primary viewport has visible layout bounds but its rounded-overflow paint remains outside the whole-box proof domain. Later hover, keyboard-focus, scroll-end and wheel-both-axes targets were not executed.

The existing `scroll-area-rounded-overflow-paint` classifier associated with [#853](https://github.com/Proto-UI/Proto-UI/issues/853) requires exact ownership, physical-node identity, border/client/target geometry, full fingerprints and matched raw PNG/facts. The producer did not emit several required fields. An actual readback of all eight original PNG/fact/fingerprint sets, checking their journal digests before classification, still returns `null` for every case. The accompanying JSON records those exact references. Missing original metadata is not reconstructed; all eight original statuses remain **failed**, not retrospectively known-unsupported.

## Actual producer fields

The observer now emits the existing classifier's required facts from the same measured DOM:

| Observation | Recorded source |
| --- | --- |
| Clip physical node, border widths, border box, client box and target boxes | The actual clipping ancestor's computed style, layout/client bounds and measured target rectangles |
| Primary owner, generation, physical node and rectangle | The exact selected physical element |
| Surface owner, generation, host node and physical target node | The actual selected host/target pair |
| Physical identity across all records | The existing fingerprint WeakMap, reused without writing subject DOM |
| Raster dimensions | The decoded screenshot canvas |
| Fact-to-image digest | The exact PNG bytes already captured and supplied to the collector |

The classifier, radius/border profile, whole-box paint restrictions, original target predicates and all original planned states are unchanged. Classifier source SHA-256 remains `55df96fdfdc13bd267b2e45231bd7f8e430b77e731d123d4146dbb8265a64ef6`. No Accordion or other-family exception is added.

## Verification and limits

The new actual-collector/runner-seal calibration first failed against the old producer because its fact-to-PNG digest was absent. With the added fields it passes the unchanged classifier, while twelve negative controls reject omitted metadata, substituted primary/clip/root nodes, foreign or stale ownership, changed client/target geometry, changed border widths, rebound or drifting fingerprints and mismatched raster dimensions. Mutation controls reseal their raw hashes so rejection depends on the substantive inconsistency rather than a stale outer digest.

All **214** selected Node instrument/calibration checks completed with **214 passed, 0 failed, process exit 0**:

```sh
node --test \
  apps/www/scripts/contrast-probe-serialization.test.mjs \
  apps/www/scripts/contrast-audit-plan.test.mjs \
  apps/www/scripts/contrast-scroll-receipt.test.mjs
```

An earlier run of the 201 existing checks passed 196 and failed five controlled passive-geometry fixtures after the preceding authored-boundary repair. Those fixtures mocked the old boundary entry but lacked the newly shared root-reader input. Their explicit synthetic authored-root input is now supplied; the original rounded-clip assertions remain unchanged. Production boundary selection is covered separately by the 26 actual-framework checks in the passive-boundary record.

The new calibration uses controlled DOM/CSSOM/geometry and a synthetic raster; it proves field serialization, identity pairing and refusal of inconsistent evidence. It does **not** establish native paint measurability, visual conformance or a successful Scroll Area journey. No new native output was available for this repair. A future complete source-bound native receipt may qualify as the existing **known-unsupported**, with `achieved: false`, `numericAcceptance: not-evaluated` and all unexecuted targets retained; that result is still not `observed` or passed acceptance.
