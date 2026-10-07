# Rounded overflow paint-domain boundary

Date: 2026-10-06 UTC. Observation-tool correction following [4193495831](https://github.com/Proto-UI/Proto-UI/pull/775#discussion_r4193495831), based on `fe94c93ab8953f6a8be283d122ab30651fbb087b`. This layer changes only the probe domain and calibration; it does not change product CSS, semantic behavior, thresholds, or collector acceptance.

The old `paintedVisibility` intersected target boxes with rectangular ancestor client boxes. A target entirely in a clipped rounded corner could therefore retain nonzero bounds and `source-model-visible` despite no painted pixels. Controlled source counterfactuals against the actual fe94 probe fail in all four hidden/clip/auto/scroll cases because the old target acceptance remains true. The new guard records `unsupported-rounded-overflow-clip`, retains intersecting bounds as bounds, and never relabels unknown paint as hidden or achieved.

The only admitted curved-clip subset is fixed nonnegative px corner radii with translation-only geometry and every whole target box inside the central inscribed client rectangle. Relative/calculated radii, boundary-crossing boxes and other unsupported geometry remain unknown. Non-unit zoom anywhere in the ancestor chain invalidates the fixed-CSS-pixel proof. The diagnostic records the exact clipping root's prototype/owner/generation, radii, safe rectangle, box count, whole-box inclusion and interior bounds overlap. Interior overlap is a geometry observation, not paint certification.

Native calibration adds two eight-pixel corner targets under rounded hidden/clip parents, square-hidden and rounded-with-visible-overflow controls, and a fixed-px central positive control. Exact rectangles and the unchanged supported/unsupported classifications are asserted; PNG/facts are retained. This is a bounded proof subset, not a general rounded-geometry renderer.

## Existing ScrollArea impact

Exact fe94 artifact `11402140844`, SHA-256 `ee0fd33cf78017d11b71f0bf2cdc10e38ceccf67c3b8d1824f88e96b3695a36e`, retains actual React/light Root bounds `(536,673.359375,320,192)` and viewport `(538,675.359375,316,188)`. The authored Root uses overflow-hidden, border-2 and rounded-base, with the 5px Brutalist source token. Its central safe rectangle cannot contain the whole viewport; the edge paint model must therefore remain unsupported. Known central targets can retain the narrow fixed-px proof.

This domain guard alone makes the existing primary-paint collector reject affected ScrollArea cases. The raw PNG/facts are already persisted before that check; this is a model limitation, not a claim that the product is hidden or broken. A separately reviewable collector layer may classify only this explicitly declared profile as known-unsupported after preserving all ownership, anatomy, lease and fingerprint checks. It must not add achieved targets, clear missing/unexecuted targets, claim numeric success, or permit unexpected domains/hidden content to pass. Counts and tracking remain explicit. No predicted case/frame count is a native result.

The earlier fe94 border-image, Hover Card Escape and other native successes remain valid evidence of their exact observed scope. This later domain finding does not erase them or turn their frame counts into full conformance. Fresh native calibration and source-bound audit disposition are required for this new guard.
