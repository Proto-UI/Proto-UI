# Same-domain anatomy-part relationship design

Non-normative record. Refs #549, #388. This is an unauthorized proposal — #549 has no maintainer checkpoint beyond the #388 Checkpoint A approval that authorized prerequisite work. Does not create a stable spec guarantee or authorize merge.

## Problem

Disclosure/Collapsible/Accordion Trigger→Content needs a same-domain opaque relationship that:
1. Declares a logical Trigger→Content identity at setup time
2. Survives L1 detach (Content not materialized)
3. Removes Web ARIA IDREF (`aria-controls`/`aria-labelledby`) while Content is detached
4. Restores the same reserved ID and ARIA IDREF on rematerialization
5. Clears the relation and reservation on terminal disposal

## Reconciliation with existing governance

`D-A11Y-PART-RELATIONSHIP-PROJECTION-0001` (draft) already governs anatomy part relationships. Criteria B-D require structured part matching based on anatomy family, part role, same-domain scope, and protocol match keys — not precomputed string IDs. The existing `def.a11y.relation()` API with string/State targets is the current Web projection mechanism but does not carry the structured part semantics (family, role, match key) that the decision requires.

This design record does not propose to replace `def.a11y.relation()` with a new API. Instead, it proposes:
1. The existing a11y relation API continues to project the Web ARIA attribute (string target).
2. The structured part matching (family, role, match key) is preserved through the anatomy module. Per D-A11Y-PART-RELATIONSHIP-PROJECTION-0001-D, the Web adapter generates stable, unique host IDs from the structured relationship — the anatomy module does not precompute host IDs. The a11y relation target state receives the adapter-generated ID, not a precomputed string.
3. The detach-aware behavior is a host-capability concern: the web adapter removes the ARIA attribute when the target element is absent, regardless of whether the string ID is still set.

This approach is compatible with D-A11Y-PART-RELATIONSHIP-PROJECTION-0001 because:
- The cross-platform semantic relationship is still expressed via anatomy (family, role, match key).
- The Web adapter still projects to ARIA attributes using stable host identifiers.
- The adapter does not guess component-specific structure.
- The detach-aware behavior is an adapter-level concern, not a protocol-level change.

## Presence propagation

The second Codex finding identifies a real gap: Content cannot directly clear Trigger's `aria-controls` because the `contentId` state is private to the Trigger. The proposed resolution:

1. The family root (e.g., TabsRoot) owns a shared context with a per-match-key presence set (e.g., `Record<string, string[]> (JSON-compatible array of instance IDs per match key)` keyed by protocol match key). This retains instance multiplicity: if two Content instances share a match key, both are tracked. Per `D-A11Y-PART-RELATIONSHIP-PROJECTION-0001-D`, the Web adapter resolves duplicate/ambiguous presence at projection time — the root does not collapse it to a single boolean. The Trigger checks whether the set is non-empty (at least one matching Content is present), and the adapter handles duplicate-instance fallback.
2. When Content mounts, it adds its instance ID to the set: `contentPresent[matchKey] = [...(contentPresent[matchKey] ?? []), instanceId]`.
3. When Content detaches (L1), it removes its instance ID: `contentPresent[matchKey] = contentPresent[matchKey]?.filter(id => id !== instanceId) ?? []`.
4. The Trigger observes its own match key in `contentPresent` and adjusts its relation target:
   - `contentPresent[myMatchKey]?.length > 0`: relation target = contentId (restores aria-controls)
   - `contentPresent[myMatchKey]?.length === 0`: relation target = empty string (removes aria-controls)
   This per-key tracking ensures a Trigger only restores aria-controls when its matched Content is present, not when any Content mounts.

   **Pre-commit timing**: the presence signal must be set before the mount render/commit, not in a mounted callback. The runtime performs mount commit before invoking mounted callbacks, so a post-mount presence update leaves the newly committed panel temporarily without the reciprocal IDREF. The Content must notify the root of its presence during the setup/mount-preparation phase, before the first render commit.
5. This is a root-mediated presence propagation, not a direct Content→Trigger write.

This approach is compatible with C-ANATOMY-0001 (anatomy is not an information channel) because the presence field is structural metadata, not arbitrary data.

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


## Adapter-visible structured relationship

The Trigger should not collapse presence to boolean/string before projection. Instead, the structured family/role/match-key identity should remain available at the adapter projection layer. The adapter resolves the structured relationship to concrete host IDs and handles duplicate/missing match ambiguity. The Trigger observes a simplified non-empty check, but the adapter projection path retains the full structured carrier for fail-closed duplicate handling.
