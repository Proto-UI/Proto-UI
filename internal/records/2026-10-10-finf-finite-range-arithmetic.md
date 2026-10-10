# Finite range arithmetic follow-through

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This independent semantic repair follows the source-paint changes. It addresses the two reproduced arithmetic defects from the exact-source range/geometry review, without admitting the Progress/Meter draft or changing any default, unknown, range-collapse or threshold-region policy.

## Reproduced defects and bounded correction

- With min=-MAX, max=MAX, value=MAX/2 and step=1, the old anchored-grid subtraction overflows. Clamping its infinite result silently turns a finite interior Slider/NumberField value into the upper endpoint.
- With Meter bounds [1e308,1.7e308], current=1.35e308, low=1.2e308 and high=1.5e308, omitted optimum gave suboptimal while explicitly supplying the same mathematical midpoint gave optimal. The sum overflowed before division.

Active `C-STATE-0006` requires JSON-compatible finite numerical state. The existing implementation independently expresses anchored-step rounding and an arithmetic-mean default optimum; these repairs preserve those existing intentions. The later Meter draft's overflow-safe recommendation remains draft, not a newly accepted authority.

Quantization keeps its existing rounding and 14-significant-digit normalization whenever the normal calculation remains finite. Only a non-finite intermediate result takes the alternate grid-phase path: normalize each endpoint/value remainder within a step, compare their bounded difference, then select the nearest grid point with midpoint ties upward. It avoids an unrepresentable total grid index while retaining the minimum as the step origin. Invalid/nonpositive step behavior is unchanged.

Midpoint keeps `(min+max)/2` when the sum is finite, preserving ordinary and subnormal rounding. Only overflowing sums use `min/2+max/2`. Percentage normalization and all unrelated policies remain unchanged.

## Evidence

- The new arithmetic suite first reported eight failures and 18 passes on the preceding source. These include both independent-review red controls, large-step overflow paths and real controlled Slider/NumberField owners.
- The final five-file focused run passes 78 tests: 27 arithmetic tests, 6 numeric input, 12 numeric family, 23 Progress contract and 10 range readout.
- Tests cover ordinary/negative/subnormal steps, rounding ties, clamped endpoints, invalid steps, large step phases, controlled proposal rejection and owner acceptance, positive/negative/opposite/equal/subnormal Meter bounds. A separate BigInt integer-grid oracle checks more than 15 overflowing calculations using exact represented integer inputs; it does not reuse the implementation's remainder algorithm.
- One initial owner-acceptance fixture omitted min/max from a replacement Props snapshot and correctly reset to default bounds. The fixture now explicitly preserves its authored bounds. This was not fixed by changing component behavior.
- Existing range/Form consumer type projects pass, and the normal Base public dependency-closure build passes. No Runtime/Compiler/CLI change, target exception, skipped assertion, new source download or Rust execution was used.

This closes two bounded arithmetic failures, not the remaining part-type, multi-thumb, geometry, native, packed, visual or lifecycle acceptance gaps. No full-delivery score changes.
