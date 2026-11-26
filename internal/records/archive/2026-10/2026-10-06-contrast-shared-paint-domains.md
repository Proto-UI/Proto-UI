# Shared paint-domain and passive-caller audit repair

## Existing claim and scope

This is the bounded #775 follow-through for reviews 4194642142, 4194825329, 4194825318 and 4195077642. These are existing numeric/visibility entry points, not new component journeys. Baseline `b2ce5453667ae1b22a31ef3b9f5febe066d97234` had the pointer-pair stroke guard and calibrated rounded-overflow visibility, but ordinary/native/placeholder text limits and the passive-family caller had not all used those same limits.

## Discriminating controls and repair

- Actual direct-text, native-value and placeholder limit-builder source is executed with controlled CSSOM input. Unstroked controls pass; fractional and full nonzero stroke widths must carry unsupported text-stroke limits. All three baseline readers missed the limit.
- The actual serialized passive page callback is executed for Badge, Card, Skeleton, Separator and Spinner with injected subject identity and geometry but the real bundled paint-domain reader. All five baseline callbacks incorrectly accepted an 8×8 box wholly in the corner of a 100×100 ancestor with a 50px clipping radius. Each now rejects it, retains a fixed-px safe-interior positive, still rejects actual hidden content and foreign ownership, and keeps ordinary unclipped visibility supported.
- Eleven baseline controls fail for the intended missing-limit/false-visible reason. The repaired full serialized-probe suite passes 46/46 without skips. Controlled CSSOM geometry is not native pixel or hit-test evidence.
- The passive caller now combines the existing calibrated reader's visibility/limits with its own stricter physical-region restrictions, preserving source limits and diagnostics. There is no new rounded-geometry parser or general unsupported exception; the sole declared ScrollArea terminal profile remains unchanged.
- All three text ratio sources now withhold on nonzero text stroke and zero/unresolved font size. The separate zero-font native-value review falsifier is retained: a nonempty value and visible editor box cannot prove that glyphs render. Independent fill facts, raw pixels, prior alpha/fill/shadow guards and all numerical thresholds remain intact. Direct and descendant runs share the same limit-builder path.

## Native evidence boundary

A new native calibration covers direct and descendant text, native values and placeholders with actual stroked or zero-size ink, null ratio assertions and normal 21:1 controls; opaque white fill remains independent. Its diagnostic PNG/facts use the existing source-bound calibration recorder. This test is not passed until the new head executes it.

The prior b2 native binary job 112257741830 actually passed 39/39 calibrations, then collected 312 frames with zero unresolved cases. That result proves the earlier alternate pointer-pair/explicit-inheritance repair. It is not relabeled as this additional text/passive repair, nor as completion of the other three native shards.

No product palette, Prototype lifecycle, user-visible content, cue-necessity classification or new journey is changed. #852/#853 retain their existing follow-up boundaries; no green aggregate implies full accessibility or arbitrary-CSS paint conformance.
