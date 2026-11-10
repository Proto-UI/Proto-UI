# focus-scope.v0.md

> Status: Draft - v0
>
> This document defines the v0 contract for `asFocusScope()`.

---

## 0. Positioning

`asFocusScope()` declares that the current prototype instance forms a **focus coordination boundary**.

It is responsible for:

- defining a local focus boundary
- applying entry and restore policies
- handling trap/loop behavior where supported
- optionally coordinating an internal focus roving owner

It is not responsible for:

- making a child node focusable by itself
- exposing registry internals to authors
- replacing generic event/state/expose systems

---

## 1. Why It Exists

FocusScope is required because many common widgets need local focus governance:

- overlay content
- select/listbox/menu content
- dialog/popover content
- composite tab/list structures with boundary semantics

Routine local navigation should not require authors to manually script focus movement for every widget.

---

## 2. Invocation Model

`asFocusScope()` is a privileged, no-arg, singleton-install asHook.

- first call installs the scope capability
- later calls reuse the same underlying handle
- setup-time configuration is applied through the returned handle
- repeated calls must not reinstall the scope

It accepts no initialization parameter. Any setup policy must be expressed by calling `configure(...)` on the returned `FocusScopeHandle`.

---

## 3. Scope Key

A focus scope may declare a token-style key.

- the key expresses structural membership identity
- it is not a free-form query id
- metadata may later be attached to the token

v0 intent:

- `key` should be allowed to participate in setup-time configuration
- if future implementation imposes locking behavior, that lock boundary must be explicit

---

## 4. v0 Capabilities

v0 should minimally support:

- `entry`
  - examples: `first | selected | active | container | manual`

- `restore`
  - examples: `previous | trigger | none`

- `trap`

- `emptyPolicy`
  - at least `container | none`

- optional group composition
  - a scope may carry an internal `asFocusRoving()`-style capability

These policies should cover common component-library scenarios without forcing manual focus scripting.

---

## 5. Return Handle

`asFocusScope()` should return a `FocusScopeHandle`-like object.

Example shape:

```ts
type FocusScopeHandle = {
  active: ObservedStateHandle<boolean, any>;
  hasFocused: ObservedStateHandle<boolean, any>;

  focusFirst(): void;
  focusLast(): void;
  focusNext(): void;
  focusPrev(): void;
  focusSelected(): void;
  restoreFocus(): void;

  configure(patch: FocusScopeConfigPatch): void;
  getRoving(): FocusRovingHandle | null;
};
```

`configure(...)` must be setup-only.

The handle should expose structured focus commands rather than arbitrary instance lookup.

---

## 6. Navigation Principle

FocusScope is responsible for **boundary-level local focus resolution**.

Authors may influence policy, but should not need to manually script routine boundary entry/restore such as:

- selected-item entry on overlay open
- trigger restoration on overlay close

Routine next/previous item navigation may be delegated to a focus roving capability.

---

## 6.1 Activation Model

A focus scope may exist in the logical tree without being active.

Activation is an explicit runtime action:

- activating a scope marks that scope as the active coordination boundary;
- activation records the previously focused logical target when that target is outside the activating scope;
- activation requests focus for the first eligible logical focusable child when one exists, except when `entry: manual` leaves entry focus to the caller;
- activation forwards the focus request reason to entry focus so keyboard-triggered entry keeps keyboard modality;
- if no eligible child exists, `emptyPolicy: container` may activate the scope boundary without forging node focus.

Deactivation is also explicit:

- deactivation clears the scope active fact;
- ordinary deactivation defaults to `restore: previous`, requesting the previously captured focus target when that target still exists;
- explicit `restore: none` suppresses automatic focus transfer and preserves an outside destination; it does not suppress Focus-owned cleanup or an explicit handback authored by the consumer;
- deactivation forwards the focus request reason to restored focus so keyboard-triggered close keeps keyboard modality;
- restore is a controlled focus transfer and may bypass the active-scope gate that ordinary outside focus requests must obey.

While a scope is active, ordinary focus requests from outside that scope should be ignored with a diagnostic warning. Focus requests from the active scope or its logical descendants remain allowed.

When trap/loop is enabled on the top active scope, Tab navigation should be interpreted as structured next/previous focus requests within that scope and should prevent host default traversal from escaping the scope. If the scope temporarily has no focused child because of pointer interaction on blank space or host variance, the next Tab navigation should recover from the last remembered scoped target or from the first/last eligible child.

## 6.2 Optional activation-owned Entry fallback

`Scope.configure({ entryFallback: 'entry' })` opts automatic activation into the same instance's separately declared, enabled `asFocusEntry()` role. The default is `entryFallback: 'none'`. Both setup `entry: 'manual'` and per-activation `activate({ entry: 'manual' })` suppress automatic child entry and this fallback.

Logical child selection keeps priority. A selected child still owns the request when its host Root is absent or the host rejects its attempt. Only an activation that selected no logical child may use Entry's existing strategy and fallback, with that activation's `reason` and `preventScroll`. This does not declare the Scope Root Focusable, add it to navigation membership, or establish Root focus facts from an Entry request.

The optional continuation belongs to that exact activation. It can wait for the first resolvable host view, then re-resolve Entry against the current view on readiness. It does not repeat Scope child selection or acquire again after success. Independent first unresolved `Entry.focus()` keeps its existing no-op behavior.

`Scope.deactivate()` retires the owned continuation before inactive observers or an absent-view/already-inactive return. This also applies when `emptyPolicy: 'none'` left the coordination boundary inactive: boundary state and continuation ownership are separate. Entry disable, explicit blur, terminal retirement, a new activation, or a newer admitted independent Entry/target request also end the old continuation. Retained detachment alone preserves it. Later readiness or reenabling Entry cannot resurrect canceled work, and cancellation must preserve new independent work created by reentrant callbacks. Ordinary boundary cleanup and configured restore policy still apply independently.

The detailed authority is `C-AS-FOCUS-SCOPE-0002` criteria L/M, `C-AS-FOCUS-ENTRY-0001` criterion I, and `M-FOCUS-0001` criterion H.

---

## 7. Context Boundary

FocusScope may internally use contextual relationships, but its core governance should not be modeled as ordinary public `context`.

The primary runtime foundation should be a dedicated focus system/module.

Context, if used, should be considered a projection or helper layer rather than the governance core.

---

## 8. Non-Goals

v0 does not require:

- grid navigation
- typeahead
- activeDescendant public API
- arbitrary cross-scope lookup
- a single host-agnostic implementation technique
