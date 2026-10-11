# Slider Values: draft owner and keyboard slice

Import matching `sliderValuesRoot`, `sliderValuesTrack`, `sliderValuesThumb`, `sliderValuesIndicator`, `sliderValuesLabel`, and `sliderValuesValue` from `@proto.ui/prototypes-base/slider`. Matching `asSliderValues*` hooks compose the same static definitions. These entries use `SLIDER_VALUES_FAMILY`; do not mix them with the unchanged scalar `sliderRoot` parts. Ordinary CLI workspace-source generation accepts `base-slider-values`; it is not an installed-release component choice.

## Composition and ownership

- `defaultValue: [20, 80]` with two Thumbs (`index: 0` and `index: 1`) creates two keyboard-editable sorted display slots. Omitted indices use public Anatomy order. Explicit indices are selectors, not host-node keys.
- Each value slot needs exactly one live Thumb for indexed editing. Duplicate, missing or out-of-range mappings disable editing until repaired. Every enabled Thumb has ordinary Tab access.
- `value: [0.3, 0.7]`, `min: 0`, `max: 1`, `step: 0.1` is controlled. `[]` remains an empty array with zero editable slots; render zero Thumbs. Retained unmapped nodes become disabled; Root does not remove or hide caller-owned children.
- The sole current list State preserves unwrapped scalar values or original array order. Display clamps a scalar or sorts an array copy. It does not quantize owner input or repair initial spacing. With owner70, narrowing max to60 displays60; restoring max100 displays70 from the same owner.
- With no resolved `defaultValue`, uncontrolled initialization uses resolved `min`, including nonzero and negative minima. Later defaults are ignored after a safe creation snapshot exists.
- Ownership mode is fixed from non-null resolved `value`, never raw key presence. A hook wrapper's `setDefaults({ value: 50 })` supplies controlled constant50. `setDefaults({ defaultValue: 50 })` initializes an uncontrolled owner. Real mode changes receive `controlled-mode-change` instead of silent transfer.
- Mode and safe creation intent are captured even if policy is invalid. Wrong-shaped JSON input can recover; if creation input itself was invalid, its first later safe resolved value becomes the reset snapshot. Generic Props fallback may already handle non-JSON host input. The Root does not reconstruct raw NaN, holes or accessors.

Track is structural and optional in this slice. No pointer/touch recognizer or capture is installed. Indicator defaults to first-to-last range (min-to-value for scalar/single arrays); additional Indicators select `startIndex`/`endIndex`. Value renders the sorted display. Orientation, direction, disabled/readOnly, local Thumb labels/valueText and root ARIA min/max are projected through existing public protocols. Root inherits Field policy only.

## Events and methods

`valueChange` and `valueCommit` carry `{ value, activeThumbIndex, reason }`, where value is `number | readonly number[]`. New callbacks must accept that union. Old scalar callbacks retain their number-only type.

`valueChange` is a proposal notification before publication. Call the same Root's `cancelValueChange()` synchronously to veto that notification. It returns false outside the receiver's notifying window. Nested edits are rejected. Returning false or throwing is not a cancellation protocol. Calling a receiver does not prove which other Root initiated the call. Async/message hosts have no admitted synchronous-veto guarantee.

- `getValue()` returns a copied unwrapped owner in its current shape, or null while invalid. Exposed `values` is the same owner's read-only number-list view. `getDisplayValue()` names the fresh sorted/clamped projection.
- `requestValue(number)` requires scalar shape. `requestValues(array)` requires array shape and proposes a whole safe owner snapshot without sorting, quantization or pointer collision simulation.
- `requestThumbValue(index, value)` constrains one mapped sorted slot. `requestKeyboardValue(index, key, shift?)` additionally implements key intent and immediately commits a changed uncanceled proposal.
- `beginInteraction(index?)` starts a logical session, not physical capture. `commitValue()` completes its last uncanceled proposal once. An ignored controlled proposal can commit without owner echo; a later same-owner no-op or veto does not erase it. A roundtrip to the initial value can commit.
- `cancelInteraction()` discards pending completion without restoring already accepted values. `resetValue()` proposes the creation snapshot through the veto/ownership path.

Policy, cardinality and part changes invalidate an old logical interaction. Owner Props received during notification or publication remain authoritative and are reconciled. Explicit phase/dirty/revision facts guard reentry; individual State observers can see publishing. An idle edge is a quiescent observation boundary, not an atomic multi-slot transaction. Nonconvergent synchronous feedback produces `reentrant-props-limit` and disables editing.

## Numerical and safety scope

Finite own-data owner inputs are copied without caller mutation. The direct methods/local copying helper do not invoke ordinary getters or inherited iterators; this does not guarantee earlier Adapter/Props intake had no getter effects, or that Proxy reflection has no effects. Negative zero follows number-list canonicalization.

Keyboard requests use a separate operational Number implementation, not the historical decimal-grid oracle. Min-relative rounding precedes ordinary increments; Home/End use adjacent gap bounds or root endpoints. Root/neighbor constraints and whole-vector distance checks apply; keyboard never pushes neighbors. `largeStep` is absolute (default10), and nonnegative fractional `minStepsBetweenValues` is allowed. Unsupported decimal precision or nonfinite intermediate arithmetic is diagnosed. No generic arbitrary-precision or Compiler guarantee follows.

## Still unfinished

Real pointer origin/session association, nearest-Thumb seek, off-center grabbing, pointer push/swap/none collisions, swap focus, capture cleanup, grouped Field registration, family styling, native browser/assistive-technology behavior and Compiler translation remain unimplemented or unverified. Four-Adapter tests use framework/happy-dom harnesses, including fake React; they are not native-browser evidence. This draft cannot mark Slider, Range, Multiple Thumbs or a visual family complete.

This source is a new reconstruction. Former local R4 review results are historical and cannot certify its bytes.
