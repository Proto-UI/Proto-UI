# focus-model.v0.md

> Status: Draft - transitional projection
>
> Normative direction: `C-FOCUS-0001`, `C-FOCUS-0002`, the `C-AS-FOCUS-*` contracts, and `M-FOCUS-0001`. This text is a readable projection; the entities retain draft lifecycle.

---

## 1. Focus Domain

Focus is a host-mediated logical interaction-target management domain.

It decides which logical node, boundary, or sibling set may receive primary interaction intent, and coordinates focus requests, facts, navigation, restore, and containment.

Focus is not itself:

- a State subdomain;
- an Event subdomain;
- an adapter-only capability;
- a single privileged asHook.

Those systems participate in focus, but none of them define focus alone.

## 2. Model Layers

The focus domain has these layers:

- Focus facts: observed results such as `focused`, `focusVisible`, `focusable`, `active`, and `hasFocused`.
- Focus requests: requests such as `focusSelf()`, `blur()`, `focusFirst()`, and `restoreFocus()`.
- Focus eligibility: whether a node may receive focus or participate in navigation.
- Focus topology: logical relation between focus nodes, scopes, and sibling navigation sets.
- Focus policy: entry, restore, trap, loop, orientation, and directional navigation rules.

## 3. Logical Tree

Proto UI focus topology is logical-tree-first.

The default relation between focus nodes, scopes, groups, and roving sets should be resolved through host logical parent/child relationships. This keeps focus topology aligned with context and anatomy, and avoids treating DOM containment as the cross-platform source of truth.

Token or key based membership may exist as an escape hatch or compatibility surface, but it should not be the primary model.

## 4. asHook Split

### `asFocusable()`

`asFocusable()` declares the current prototype instance as a focus target.

It owns target-level participation:

- target registration;
- target facts such as `focused`, `focusVisible`, and `focusable`;
- target requests such as `focusSelf()` and `blur()`;
- target eligibility such as disabled/can-request-focus.

It should not own scope entry, restore, trap, or sibling roving navigation policy.

### `asFocusScope()`

`asFocusScope()` declares a focus coordination boundary.

It owns boundary-level policy:

- entry;
- restore;
- trap/containment;
- focus-within style facts;
- scope-level requests such as `focusFirst()` and `restoreFocus()`.

It should not absorb all sibling item navigation rules.

### `asFocusRoving()`

Sibling navigation should be modeled separately from scope boundaries.

`asFocusRoving()` is the author-facing API for this layer. It replaces the previous `asFocusGroup()` concept because "focus group" and "roving focus" overlapped too heavily in responsibility.

- arrow navigation;
- orientation;
- loop;
- active cursor;
- disabled item skipping;
- selected/current item entry;
- collection/anatomy order integration.

## 5. Current Compatibility

Existing `scopeKey`, `groupKey`, and `navParticipation` APIs remain compatibility surfaces for now.

The implementation direction is:

- resolve membership through logical parent/child first;
- allow a focusable without `groupKey` to belong to the nearest logical focus roving owner;
- keep `groupKey` as a compatibility filter or escape hatch;
- revisit whether group/navigation fields should remain on bare `asFocusable()`.
