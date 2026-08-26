# Same-domain anatomy-part relationship design

Non-normative record. Refs #549, #388. This is an unauthorized proposal — #549 has no maintainer checkpoint beyond the #388 Checkpoint A approval that authorized prerequisite work. Does not create a stable spec guarantee or authorize merge.

## Problem

Disclosure/Collapsible/Accordion Trigger→Content needs a same-domain opaque relationship that:
1. Declares a logical Trigger→Content identity at setup time
2. Survives L1 detach (Content not materialized)
3. Removes Web ARIA IDREF (`aria-controls`/`aria-labelledby`) while Content is detached
4. Restores the same reserved ID and ARIA IDREF on rematerialization
5. Clears the relation and reservation on terminal disposal

## Current pattern

Tabs, Dialog, Dropdown, Select, and Hover Card all use `def.a11y.relation()` with string ID targets:

```ts
// Tabs Trigger
def.a11y.relation('controls', { target: contentId });

// Tabs Content
def.a11y.relation('labelledBy', { target: triggerId });
```

The ID is derived from the family root ID and is stable across mount/unmount cycles. However, when the Content target is detached (L1), the `aria-controls` attribute still points to the non-existent ID. The Web adapter projects the relation unconditionally.

## Proposed approach

### 1. Reserved identity

The family root reserves a stable part ID at setup time (e.g., `createPartId(rootId, 'content')`). This ID is the logical identity of the Content part, independent of whether it is currently materialized.

### 2. Detach-aware relation projection

The a11y web projector already calls `clearWebA11ySnapshot` on the old target and `applyWebA11ySnapshot` on the new target during target changes. The proposed change:

- When the Content target is detached, the relation target resolves to `null` or empty string.
- The web projector's `setOptionalAttr(el, 'aria-controls', null)` removes the attribute.
- The logical relationship (stored in module state) is preserved — it still points to the reserved ID.
- On rematerialization, the Content target receives the same reserved ID.
- The relation target resolves back to the reserved ID string.
- `aria-controls` is restored in the same committed view epoch.

### 3. Implementation path

The relation target is already a `State<string>` (dynamic). The Content part's lifecycle sets the target ID state:
- On mount: `contentIdState.set(reservedId)`
- On detach (L1): `contentIdState.set('')` — empty string causes `setOptionalAttr` to remove the attribute
- On rematerialization: `contentIdState.set(reservedId)` — restores the attribute
- On terminal disposal: `contentIdState.set(null)` and the relation is cleared

### 4. Tabs migration evidence

Tabs already uses this pattern partially:
- `tabs/trigger.proto.ts`: `def.a11y.relation('controls', { target: contentId })` where `contentId` is a `State<string>` derived from context
- `tabs/content.proto.ts`: `def.a11y.relation('labelledBy', { target: triggerId })` where `triggerId` is a `State<string>` derived from context

The migration: ensure that when Content is detached (unmounted/L1), the context sets the relation target state to empty string, causing the web adapter to remove `aria-controls`. On rematerialization, the context restores the ID.

### 5. Contract amendment

Propose amending `C-ANATOMY-0001` (or adding `C-ANATOMY-0011`) to govern:
- Same-domain opaque relationship declaration via `def.a11y.relation()`
- L1 detach behavior: logical identity survives, Web ARIA IDREF removed while detached
- Rematerialization: same reserved ID assigned before reveal, ARIA restored in same view epoch
- Terminal disposal: relation and reservation cleared

## Evidence needed

- New or amended contract criterion for detach-aware relation projection
- Tabs migration test verifying aria-controls is removed during L1 detach and restored on rematerialization
- Browser test verifying the pattern works across WC/React/Vue

## Status

This is an unauthorized proposal. Implementation requires:
1. A maintainer checkpoint accepting the detach-aware relation approach
2. Contract amendment or new contract
3. Tabs migration with test evidence
4. Disclosure/Collapsible/Accordion implementation (separate, after both prerequisites merge)
