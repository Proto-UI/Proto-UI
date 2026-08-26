# Select item-aligned positioning implementation design

Non-normative record. Refs #496. This is an unauthorized proposal — #496 has no implementation checkpoint. Does not create a stable spec guarantee or authorize merge.

## Proposed API

Extend the existing Content `position` prop (`'popper' | 'item-aligned'`, already in Shadcn Select) to Base Select Content. When `position === 'item-aligned'`, the positioning host (HC-ANCHORED-POSITION-0001) resolves the selected item's offset locally.

## Host-local geometry measurement

Per C-ANCHORED-POSITIONING-0001-A, prototype authors and generic modules must not measure host geometry. All measurement stays in the positioning host:

1. The host measures the selected item's offset from the Content's top edge
2. The host measures the trigger's height and the selected item's height
3. The host computes the negative offset: `-(selectedItemOffsetFromTop + triggerHeight/2 + itemHeight/2)`
4. The host applies this offset when `position === 'item-aligned'`

The prototype does not measure items, report offsets, or add context values.

## Placement, collision, and fallback

- When `side='top'`, the offset direction reverses
- Collision flip: Floating UI's `flip` middleware handles viewport collision
- Variable-height items: the host measures actual heights, not uniform
- Unmatched/empty selection: fall back to `popper` positioning
- Late-selected-item: re-position on selection change while open

## Projection defaults

- Base Select Content: `position` defaults to `'popper'` (backward compatible)
- Shadcn Select Content: already defaults to `'item-aligned'` (matching upstream)
- Brutalist Select Content: inherits Base `'popper'` default (no semantic positioning without separate authorization)

## Implementation ordering

Shadcn currently registers its `item-aligned` default before `asSelectContent()`. To add Base's `popper` default without overriding Shadcn, Base must register its default after the asHook call, or use a different precedence mechanism. A no-prop regression test must verify Shadcn's existing `item-aligned` default is preserved.

## Evidence needed

- New criterion in P-BASE-SELECT-CONTENT for the `position` prop and item-aligned behavior
- Test case verifying the offset math in the positioning host
- Browser test verifying visual alignment across WC/React/Vue

## Status

This is an unauthorized proposal. Implementation requires a maintainer checkpoint to admit the `position` prop to Base Select Content and confirm the host-local measurement approach.
