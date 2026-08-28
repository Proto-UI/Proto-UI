# Select item-aligned positioning implementation design

Non-normative record. Refs #496. This is an unauthorized proposal — #496 has no implementation checkpoint. Does not create a stable spec guarantee or authorize merge.

## Proposed API

Candidate: extend the existing Content `position` prop (`'popper' | 'item-aligned'`, already in Shadcn Select) to Base Select Content. When `position === 'item-aligned'`, Select resolves the selected Item semantically and requests a descendant-alignment positioning policy. This API and policy are not admitted until the checkpoint in **Status** revises the affected draft entities.

## Selected-target channel and lifetime

The generic positioning host cannot discover the selected Select Item by querying DOM structure or Select-specific attributes. The candidate information path is:

1. Select reads Root's existing value truth and resolves the matching Item as an author-safe Anatomy `PartView` identity.
2. A new privileged Overlay/Positioning policy channel accepts that semantic identity; it does not accept or expose a raw host target to prototype code.
3. Positioning uses an Anatomy module-internal resolver to turn the identity into an opaque selected target and passes that target in the host connection beside `anchor` and `floating`.
4. The target binding is scoped to the active Content view epoch and positioning lease. Replacement, detach, selection change, or disposal revokes the old binding and its observers before another target is attached.

This requires an explicit typed connection/policy field and module-internal resolver. It must not be implemented as Select-specific DOM querying in `floating-ui-host.ts`, a public `PartView.getRootTarget()`, or an author-visible context value. Empty/unmatched selections and a target that does not become ready within the bounded opening window use the existing popper policy.

## Host-local geometry measurement

Per `C-ANCHORED-POSITIONING-0001-A`, prototype authors and generic modules must not measure host geometry. All measurement stays in the positioning host after the privileged target channel has supplied an opaque target:

1. If the selected target is outside the Content scrollport, the host first scrolls it into view without exposing `scrollTop` or rectangles to Select. If it cannot do so, the lease uses popper fallback.
2. The host measures the anchor, floating root, and selected target in one host-local coordinate model.
3. A descendant-alignment middleware computes coordinates that align the selected target center with the trigger center; it must not encode this as the existing placement's positive `sideOffset`.
4. Collision resolution may clamp or abandon descendant alignment and use the existing popper policy.

The prototype does not measure items, report offsets, or add geometry context values.

## Placement, collision, and fallback

- Descendant alignment is a coordinate policy, not a bottom-only `sideOffset` formula. It must resolve correctly for the configured and resolved side or deliberately fall back to popper for unsupported horizontal or flipped cases.
- Collision handling must evaluate the aligned coordinates and then either clamp them or fall back to the existing popper `flip`/`shift` chain; the current generic `flip` middleware alone does not define this policy.
- Variable-height items use actual host measurements, not a uniform item height.
- Empty or unmatched selection uses popper positioning.
- A late-selected item or selection change while open rebinds the epoch-bounded target and requests a position update; an unresolved target uses popper fallback.

## Projection defaults

- Base Select Content: `position` would default to `'popper'` for backward compatibility.
- Shadcn Select Content: preserve its cataloged `position='item-aligned'` parameter default; completed behavior remains a gap until authorized and implemented.
- Brutalist Select Content: inherits Base `'popper'` behavior because its current draft entity authorizes only visual/style deltas.

## Implementation ordering

`PropsKernel.setDefaults()` is latest-first. If Base begins registering `popper` inside `asSelectContent()`, Shadcn must reapply its `item-aligned` default after calling `asSelectContent()`. A no-prop regression test must prove that the cataloged Shadcn default survives inherited setup.

## Scroll-before-measure

With `overflow-y-auto` and the current `preventScroll: true` focus path, an offscreen selected item remains clipped. The host must scroll the selected item into view before measuring and placing it, or fall back to popper positioning if the target cannot be scrolled into view.

## Observation and transition completion

The active descendant-alignment lease must observe the selected target in addition to the anchor and floating root. A bounded host-owned element-size observer requests recomputation when the selected row changes size while Content remains open. Rebinding the selected target or ending the Content view epoch must dispose that observer; animation-frame polling remains forbidden.

Shadcn's `zoom-in-95` changes rendered rectangles without triggering the existing ResizeObserver update. Opening placement may be provisional, but the Transition `entered` boundary must explicitly request one final positioning update after the transform reaches its entered state. The final computation uses the then-current host geometry. This signal carries no geometry through prototype state and does not authorize per-frame polling.

## Catalog impact before implementation

The present catalog only governs anchor/floating placement. A maintainer checkpoint must choose and catalog one of these shapes before implementation:

- extend the draft `C-ANCHORED-POSITIONING-0001`, `HC-ANCHORED-POSITION-0001`, and `M-POSITIONING-0001` with an optional epoch-bounded descendant-target policy, privileged target resolution, scroll/measurement order, selected-target observation, collision fallback, and cleanup; or
- introduce a parallel contract, host capability, and module policy and relate them explicitly to the existing anchored lease.

Either choice also requires consistent revisions to `P-BASE-SELECT-CONTENT`, `P-SHADCN-SELECT-CONTENT`, their mapped test entities, and the relevant positioning test entity. `P-BASE-SELECT-CONTENT-DEFERRED-SURFACES` remains authoritative until that checkpoint; this record alone does not remove item-aligned positioning from the deferred surface.

## Evidence needed

- Catalog revisions or new parallel entities for the positioning contract, host capability, module policy, Select prototypes, and their executable test mappings.
- Module and host tests for semantic identity to opaque target binding, target replacement and view-epoch cleanup, scroll-before-measure, variable-height target observation, placement/collision fallback, and final recomputation after Transition reaches `entered`.
- Select tests for empty/unmatched/late-mounted selection, open-time selection changes, Shadcn's no-prop `item-aligned` default after inherited setup, and Base/Brutalist popper defaults.
- Browser tests verifying final-frame visual alignment and fallback separately across Web Component, React, Vue 3, and the active Vue 2 adapter, including long scrolled lists and a selected row whose height changes while open.

## Status

This is an unauthorized proposal. Implementation requires a maintainer checkpoint to admit the `position` prop to Base Select Content, choose the catalog shape for descendant-alignment positioning, and authorize the corresponding draft entity revisions and executable evidence. Until then, Base and Brutalist retain popper behavior and Shadcn's `position='item-aligned'` remains only the already-cataloged parameter/default gap rather than a completed behavior guarantee.
