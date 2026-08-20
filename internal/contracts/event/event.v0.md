# Event Contract (v0)

> **Status**: Draft – implementation-ready (contract-first)  
> **Version**: v0
>
> This document defines the **Proto UI Event information flow contract**: setup-time registration semantics, runtime callback guarantees, binding timing, lifecycle cleanup rules, and the observable behavior exposed via `def.event`.
>
> This document is **normative**.

---

## Layering Note (Normative)

This contract describes the **observable behavior and guarantees** available to Component Authors through `def.event`.

It does **not** prescribe:

- the internal data structures of the event module
- how registrations or dispatch are stored
- how the runtime associates `run` with a dispatched event
- how adapters implement event proxying or delegation

In other words:

- This contract specifies **what must happen**
- Not **how it must be implemented**

---

## 0. Scope & Non-goals

### 0.1 Scope (v0)

In v0, the Event module provides:

- setup-only APIs for event registration and removal
- precise and stable listener token semantics
- runtime-only callback invocation guarantees
- default binding to the component instance’s **root interaction target**
- adapter-defined **global interaction targets**
- automatic cleanup on component unmount
- optional development-time diagnostic labeling

### 0.2 Non-goals (Explicitly Out of Scope for v0)

The following are **not goals of v0**:

- gesture abstractions (drag / pinch / etc.)
- automatic event-to-rule compilation
- event deduplication or coalescing
- exposing concrete host objects (e.g. `window`, `document`) to Component Authors
- runtime-time dynamic subscription management (`run.event.*`)
- prescribing a specific internal architecture for the event module

---

## 1. Terminology

- **Root Target**  
  The primary interaction subject of a component instance, as defined by the adapter.

- **Global Target**  
  An adapter-defined host-global interaction target.

- **Native Event**  
  A platform-provided event object (e.g. Web `Event`, `PointerEvent`).

- **Proto Event Type**  
  A Proto UI–defined event type string with guaranteed semantics.

---

## 2. API Surface and Phase Constraints

### 2.1 Setup-only Registration APIs

The following APIs are **setup-only**:

- `def.event.on(type, cb, options?) => EventListenerToken`
- `def.event.onGlobal(type, cb, options?) => EventListenerToken`
- `def.event.off(token) => void`

#### Normative Rules

1. Any attempt to call these APIs after setup **MUST throw** a phase-violation error.
2. Each call to `on` / `onGlobal` **MUST create a new registration entry**.
3. Registrations **MUST NOT** be deduplicated or merged.

---

### 2.2 Runtime-only Callback Semantics

All callbacks registered via `def.event`:

- **MUST be invoked only during the runtime callback phase**
- MUST NOT be invoked during setup, render, commit, or other phases

#### Callback Signature (Normative)

```ts
cb(run, ev) => void
```

Where:

- `run` is the runtime handle (**always the first argument**)
- `ev` is the Event payload; its portable guarantees come from the cataloged Event contracts

Native host event objects, concrete targets, and host control methods MAY be carried as host-local escape hatches, but Component Authors MUST NOT treat them as portable payload guarantees.

#### Layering Constraint (Normative)

- The presence of `run` in the callback signature is a requirement of the **event information flow**, not of any specific event module implementation.
- Event modules **MUST NOT** be required to understand, construct, or reason about runtime handles.
- Associating the correct `run` handle with a dispatched event is the responsibility of the runtime.

---

## 3. Binding Targets and Timing

### 3.1 Root Target (Default)

- Registrations made via `def.event.on(...)` bind to the **Root Target** by default.
- The Root Target represents the component instance’s primary interaction subject.

### 3.2 Global Target (Adapter-defined)

- Registrations made via `def.event.onGlobal(...)` bind to a **Global Target**.
- The event facade **MUST NOT** expose or allow selection of the concrete global target.

> _Informative note:_ Web adapters commonly choose `window` as the global target.

---

### 3.3 Binding Time and the “No Registrations” Rule (Normative)

Event listeners are bound by the runtime at a well-defined safe point.

#### If there are no registrations:

- The binding step **MUST be a no-op**
- It **MUST NOT** read or access any targets
- It **MUST NOT** throw due to missing targets

#### If registrations exist:

- A root target is required **only if** at least one root-scoped registration exists
- A global target is required **only if** at least one global registration exists

> _Informative:_ Runtimes MAY perform binding unconditionally, but components with no registrations must not incur cost or risk.

---

## 4. Listener Model and Token Semantics

### 4.1 No Deduplication

- Event registrations **MUST NOT** be deduplicated
- Multiple identical registrations represent multiple distinct listeners

---

### 4.2 EventListenerToken (Core Mechanism)

Each call to `on` / `onGlobal` **MUST return an EventListenerToken**.

#### Minimum Requirements (Normative)

A token MUST include:

- `id: string` — stable and unique within the component instance

Additional fields MAY exist as long as they do not affect runtime behavior.

---

### 4.3 Precise Removal (Only Removal Mechanism)

- `def.event.off(token)` **MUST remove exactly the registration identified by the token**
- If the listener is currently bound, it **MUST be detached immediately**
- Passing an unknown or already-removed token **MUST be a no-op**
- Invalid token shapes **MUST throw** an `EVENT_INVALID_ARGUMENT` error

> v0 explicitly specifies: **There is no removal API based on `(type, cb, options)`**. All removal MUST be token-based.

---

### 4.4 Token Diagnostics Labeling (Development-only)

Tokens MAY provide a diagnostic labeling API:

```ts
token.desc(text) => EventListenerToken
```

Normative rules:

1. `desc()` **MUST be setup-only**
2. Calls after setup **MUST throw** a phase-violation error
3. In production builds, `desc()` MAY be a no-op, but:
   - it MUST remain callable
   - it MUST return the same token instance

---

## 5. Lifecycle and Automatic Cleanup

- All listeners registered via `def.event`:
  - **MUST be automatically removed when the component instance unmounts**

- Manual removal via `off(token)` MAY remove listeners earlier, but is not required for correctness

---

## 6. Event Type System (v0)

Event uses `EventTypeV0` as its event type universe.

- The full definition of `EventTypeV0` is **not included in this document**
- Its normative definition lives in: `internal/contracts/event/event-types.v0.md`

This document only requires that:

- Implementations MUST reject invalid event type strings
- Unsupported but valid event types MUST follow the behavior defined in the event-types contract

---

## 7. Target Mutation and Interaction Proxying (System-level Capability)

> This section describes **infrastructure-level requirements** and **does not expose any API to Component Authors**.

### 7.1 Design Intent

The event system MUST be able to correctly handle:

- root / global target replacement during an instance’s lifetime
- host nodes being replaced or reconstructed
- interaction events being proxied, merged, or delegated

### 7.2 Normative Requirements (v0)

1. If the event system is bound and the target changes:
   - subsequent bindings **MUST refer to the new target**

2. This behavior MUST be completely transparent to Component Authors
3. Component Authors MUST NOT and MUST NOT need to manage target changes
4. The implementation strategy is not prescribed (rebinding, stable wrappers, delegation, etc. are all valid)

---

## 8. Error Model

Implementations **MUST throw errors** for:

- phase violations of setup-only APIs
- binding when required targets are unavailable
- invalid arguments (invalid types, malformed tokens, etc.)

### 8.1 Error Classification (Minimum)

Recommended error codes:

- `EVENT_PHASE_VIOLATION`
- `EVENT_TARGET_UNAVAILABLE`
- `EVENT_INVALID_ARGUMENT`

---

## Appendix A: Contract Coverage (Informative)

This contract is enforced by executable contract tests, including:

- no-registration binding no-op behavior
- root / global target availability constraints
- precise token-based removal semantics
- automatic cleanup on unmount
- setup / runtime phase enforcement
- correct rebinding after target changes

Executable tests live under:

```
packages/modules/event/test/contract/
```
