> This document is a readable projection of the cataloged Proto UI 0.2 Base Select family. The `P-BASE-SELECT*` entities under `spec/prototypes/` are the source of truth.

# Base Select v0 contract

The family consists of `Root`, `Trigger`, `Value`, `Content`, and `Item`. It implements a non-editable, single-selection popup following the select-only combobox pattern.

## Anatomy

- `root contains trigger`
- `root contains value`
- `root contains content`
- `content contains item`

`Value` may be nested inside `Trigger` in the rendered tree while remaining a Root-owned anatomy part.

## Root

Root owns the authoritative `open`, `value`, and derived `textValue` snapshots. It supports controlled and uncontrolled open/value props, arbitrates requests from descendants, and emits `openChange` / `valueChange` events.

A controlled request must not mutate the corresponding authoritative snapshot before the controlled prop changes. Root also owns collection order and the transient active-value coordination used while the popup is open.

## Trigger

Trigger is an independent command surface rather than a composed Base Button. It projects:

- `role="combobox"`
- `aria-haspopup="listbox"`
- `aria-expanded`
- `aria-controls` referencing Content while present

Pointer activation toggles the popup. Enter, Space, ArrowDown, and ArrowUp open it with the appropriate focus-entry intent. Disabled state from either Trigger or Root suppresses interaction.

## Value

Value is the first cataloged value-class presentation part. It derives `displayValue` in this order:

1. selected item `textValue`
2. raw selected value
3. placeholder

It owns no input, focus, or selection behavior. Changes refresh its rendered text through explicit `run.update()` while the same `displayValue` remains exposed to adapters and composed libraries.

## Content

Content projects `role="listbox"` and combines four capabilities:

- `asOverlay` for outside interaction and dismissal
- `asTransition` for enter/leave presence
- `asFocusRoving` as the sole owner of ArrowUp/ArrowDown/Home/End movement
- anchored positioning relative to Trigger

Opening focuses the selected enabled Item when possible, otherwise the requested boundary item. Typeahead moves the active option without committing selection. Escape closes and restores Trigger focus; Tab closes without intercepting the browser's next focus destination. Outside interaction closes according to overlay policy.

## Item

Item projects `role="option"`, `aria-selected`, and disabled semantics. Its state is deliberately split:

- `active`: the transient roving/typeahead cursor
- `selected`: the persistent committed Root value

An enabled pointer or Enter/Space activation submits a value request. Disabled items never become active or selected through interaction. Item-level `closeOnSelect` may override Root policy.

## Deferred scope

This legacy v0 description does not define form submission, hidden inputs, editable search, multiple selection, virtualization, scroll controls, or ItemIndicator. Current optional Surface/Viewport/ItemText parts are governed by `P-BASE-SELECT-ALIGNMENT-PARTS`; Group/Label/decorative Separator and isolated naming scopes are governed by `P-BASE-SELECT-STRUCTURAL-PARTS`. Those draft catalog definitions take precedence over this historical v0 surface.

The shadcn composition accepts `position="item-aligned"` for API compatibility, but Base currently guarantees anchored positioning only; Radix-style per-item geometry remains deferred.
