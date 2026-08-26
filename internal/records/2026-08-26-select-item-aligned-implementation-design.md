# Select item-aligned positioning implementation design

Non-normative record. Authorized by #496 maintainer checkpoint. Does not create a stable spec guarantee or authorize merge.

## Current state

Base Select Content uses M-POSITIONING-0001 / HC-ANCHORED-POSITIONING-0001 with static `side`, `align`, `sideOffset`, and `alignOffset` props. The content is positioned relative to the trigger, not aligned to a specific selected item.

shadcn/ui's Select positions the content so the selected item aligns with the trigger, creating a "flip" effect where the selected item appears at the trigger position.

## Proposed implementation

### 1. Add `itemAlignment` prop to Select Root

```typescript
interface SelectRootProps {
  // ... existing props
  itemAlignment?: 'none' | 'selected'; // default 'none'
}
```

When `itemAlignment === 'selected'`, the Root computes a dynamic `sideOffset` based on the selected item's position within the Content and passes it to the Content's positioning config.

### 2. Dynamic offset computation

The Root tracks the selected item's index and the item height (uniform item height assumption). The offset is:

```
dynamicSideOffset = baseSideOffset + (selectedItemIndex * itemHeight)
```

This offset is passed through the existing `sideOffset` prop to the Content's positioning host.

### 3. Content lifecycle

The Content needs to:

1. Measure its items' heights after mount
2. Report the selected item's offset to the Root
3. The Root updates the `sideOffset` on reposition

This requires a new context value: `selectedItemOffset: number` that the Content reports and the Root consumes.

### 4. Projection opt-in

- Base Select: `itemAlignment` defaults to `'none'` (backward compatible)
- Shadcn Select: defaults to `'selected'` (matching upstream)
- Brutalist Select: defaults to `'selected'` (matching design language)

### Evidence needed

- New criterion in P-BASE-SELECT-CONTENT for the dynamic offset behavior
- Test case verifying the offset math
- Browser test verifying visual alignment across WC/React/Vue

## Open questions

1. Should item-aligned positioning work with variable item heights, or assume uniform?
2. Should the offset be computed on every open, or cached after first measurement?
3. What happens if the selected item is not in the viewport (long lists)?

## Status

This is a design record, not an implementation. Implementation requires a maintainer checkpoint to admit the new prop and behavior to the Base Select spec.
