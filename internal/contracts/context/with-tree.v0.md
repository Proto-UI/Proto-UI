# internal/contracts/context/with-tree.v0.md

> Legacy readable projection. Current draft authority: [M-CONTEXT-0001](../../../spec/modules/M-CONTEXT-0001.yaml), [C-CONTEXT-0001](../../../spec/contracts/C-CONTEXT-0001.yaml) through [C-CONTEXT-0012](../../../spec/contracts/C-CONTEXT-0012.yaml). These entities supersede this prose; see [the index](./README.md) for host capability and evidence links.

---

## 0. Scope & Non-goals

### 0.1 Scope

Context provides:

- A **tree-based** communication channel between components within a provider-owned scope (subscribed consumers may update).
- Setup-only **subscription intent** with runtime **reads** and **updates**.
- Deterministic provider resolution: **nearest provider wins**.
- v0 portability constraints: context values are JSON-serializable **objects**.

### 0.2 Non-goals

- Bidirectional/peer communication beyond context (e.g. other channels) is out of scope for v0.
- Connection-change notifications (connected/disconnected callbacks) are out of scope for v0.
- Compiler-stage portability and AST-based extraction are out of scope for v0.
- Host-specific capabilities (e.g. `def.host`) are out of scope for context.

---

## 1. Terminology

- **ContextKey<T>**: a unique token (symbol-like) identifying a context channel.
- **Provider**: a component instance that provides a value for a ContextKey.
- **Consumer**: a component instance that subscribes/reads/updates a ContextKey.
- **Logical tree**: host-translated logical ownership; Web Component derives it from its supported DOM ownership boundary.
- **Nearest provider wins**: the consumer binds to the closest provider, starting with the consumer itself for the key.

---

## 2. ContextKey

### 2.1 Identity

- ContextKey identity is unique and comparable by reference (symbol-like).
- ContextKeys may be shared via JS modules.

### 2.2 Creation (core-owned)

Core MUST provide a ContextKey factory, e.g.:

- `createContextKey<T>(debugName: string): ContextKey<T>`

`debugName`:

- MUST be present for diagnostics (error messages, debug logs).
- does not affect identity.

---

## 3. Provider resolution

- Provider resolution MUST be based on the logical tree.
- For a given (consumer instance, key), the bound provider is the **nearest self-inclusive provider** of that key.
- Different component instances may provide the same key simultaneously; binding is per consumer and depends on tree position.

---

## 4. Setup-only subscription intent

Context subscription APIs are setup-only:

- `subscribe(key, onChange?)` (required)
- `trySubscribe(key, onChange?)` (optional)

> Subscriptions declare intent and register an optional callback. The callback fires during runtime updates.

### 4.1 subscribe (required)

- `subscribe(key, onChange?)` MUST be callable only during setup.
- If no provider is available for that key at setup time, `subscribe` MUST throw.

Assumption in v0:

- Logical tree assembly occurs before context system initialization, so provider availability is known at setup.

### 4.2 trySubscribe (optional)

- `trySubscribe(key, onChange?)` MUST be callable only during setup.
- If no provider is available at setup time, `trySubscribe` MUST NOT throw.

---

## 5. Runtime-only reads

Read APIs are runtime-only:

- `read(key)` (required subscription)
- `tryRead(key)` (optional subscription)

### 5.1 read (required)

- `read(key)` MUST be callable during runtime callback or readonly render phase.
- `read(key)` MUST require prior `subscribe(key, onChange?)` in setup.
- If the subscription is disconnected at runtime (provider removed / tree changed), `read` MUST throw.

### 5.2 tryRead (optional)

- `tryRead(key)` MUST be callable during runtime callback or readonly render phase.
- `tryRead(key)` MUST require prior `trySubscribe(key, onChange?)` in setup.
- If the subscription is disconnected or provider is absent, `tryRead` MUST return `null`.

---

## 6. Provide & update

### 6.1 Provide API phase

- `provide(key, defaultValue)` MUST be setup-only.

### 6.2 Provider-side update

- `provide` MUST NOT return a provider-side `update` function.
- A provider that needs to update its own context MUST use the unified runtime context update surface.
- Provider `update` of its own key needs no subscription, but remains callback-only. This exception grants neither read authority nor `tryUpdate` authority; see C-CONTEXT-0008-C.

### 6.3 Unified runtime update

- `run.context.update(key, next)` is callback-only.
- A consumer must have previously subscribed to the key (via `subscribe` or `trySubscribe`) to call `update`; the provider itself is exempt for its own key.
- The `run.context.update` signature accepts a next value or updater function: `update(key, prev => next)`.

### 6.4 tryUpdate (optional)

- `run.context.tryUpdate(key, next)` is callback-only and MUST require prior `trySubscribe`.
- If the context is unavailable (no provider or disconnected), `tryUpdate` MUST return `false` and perform no update.
- If the update succeeds, `tryUpdate` MUST return `true`.

### 6.5 Duplicate provide per instance

- A component instance MUST NOT provide the same key more than once.
- Duplicate provide MUST throw.

---

## 7. Value constraints & portability (v0)

### 7.1 Value domain

- Context values MUST be plain objects and JSON-serializable.
- `undefined` is illegal in Proto UI prototypes.
- The following are forbidden in context values:
  - functions
  - DOM/host references
  - PrototypeRef
  - State
  - class instances
  - circular references
  - Map/Set/Date/RegExp or other non-JSON structures

### 7.2 Null semantics

- A top-level value of `null` means **context unavailable** (no provider or disconnected).
- `null` is allowed inside object fields.
- Prototype syntax forbids `undefined`, so empty values use `null`.
- Component authors MUST NOT set a context value to `null`.

### 7.3 Portability scope

- v0 only promises **Adapter-stage** portability.
- Compiler-stage portability and AST-based extraction are out of scope for v0.

---

## 8. Subscription callbacks & notifications

- `subscribe/trySubscribe` callbacks fire during runtime when context updates.
- Callback signature: `(run, next, prev)`.
- `next` and `prev` are JSON objects, or `null` if context is unavailable.
- Every successful update remains observable as a distinct semantic transition; delivery preserves its next/prev values.

> [D-CONTEXT-NOTIFICATION-SCHEDULING-0001](../../../spec/decisions/D-CONTEXT-NOTIFICATION-SCHEDULING-0001.md) allows host scheduling without dropping or incorrectly merging transitions; ordering within a dispatch window is deterministic.

---

## 9. Tree changes & re-binding

- Provider/consumer bindings MAY change if the logical tree changes.
- v0 provides no explicit notification callbacks for re-binding.
- Correctness is enforced by `read/tryRead` and subscription callback semantics.

---

## Lifecycle

Provider values, subscription intent and callbacks belong to the instance. Repeatable view detach/remount preserves them; terminal disposal removes them. Unsubscribe stops later delivery. See C-CONTEXT-0012 and C-LIFECYCLE-0006/0007.

## 10. Error model

Implementations MUST throw for:

- Phase violations (setup-only/runtime-only misuse)
- Missing provider for required `subscribe`
- Missing prior subscription intent (`read` without `subscribe`, `tryRead` without `trySubscribe`, consumer `update` without subscription)
- Duplicate provide for the same key on the same instance
- Disconnected required read
- Invalid provided values

### 10.1 Error typing (minimum)

Errors MUST be distinguishable by type or code (e.g. `error.code`).

Recommended codes (v0):

- `CONTEXT_PHASE_VIOLATION`
- `CONTEXT_PROVIDER_MISSING`
- `CONTEXT_SUBSCRIPTION_REQUIRED`
- `CONTEXT_DUPLICATE_PROVIDE`
- `CONTEXT_DISCONNECTED`
- `CONTEXT_VALUE_INVALID`
