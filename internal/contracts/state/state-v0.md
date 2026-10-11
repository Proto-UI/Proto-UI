# state.v0.md

> Status: Draft – v0 (implementation-aligned)
>
> This contract specifies **state** in Proto UI v0: semantic state slots, handle capabilities, execution-phase rules, lifecycle (dispose) constraints, and the minimal error model.
>
> **Positioning statement (v0):**  
> State is a kind of _semantic mutable state unit_ used to store values inside a component instance and to be accessed via controlled handles. State itself does **not** schedule rendering, does **not** establish dependencies, and does **not** implicitly trigger updates.

---

## 0. Scope and Non-goals

### 0.1 Scope (v0)

State provides:

- Setup-time creation of semantic state slots via `def.state.*`.
- Returning an `OwnedStateHandle<V>` as the minimal _owned view_.
- Controlled operations through the handle:
  - `value/get`: read the current value.
  - `setDefault`: set the default value (setup-only).
  - `set`: set the current value (runtime-only).
- Strict execution-phase enforcement (setup vs runtime).
- Strict lifecycle enforcement: handles become unusable after instance dispose.

### 0.2 Non-goals (v0)

v0 explicitly does **not** provide or guarantee:

- **Automatic render/update scheduling**: state mutation MUST NOT implicitly trigger render or commit.
- **Dependency tracking or implicit subscriptions**: reading state MUST NOT establish dependencies.
- **Legacy scalar value-domain validation**: spec metadata may exist, but enforcement is not required in v0. Draft number.list independently requires complete validation.
- **Cross-channel projections**: Borrowed / Observed / App-side views are not defined here.
- **Interaction signals**: interaction-derived or fromInteraction state is not defined here.
- **Watch semantics**: watch behavior (delivery, ordering, re-entrancy) is not specified in this contract.

---

## 1. Terminology

- **State slot**: a semantic state unit stored inside a component instance, holding a value `V`.
- **Semantic**: a human-readable string provided at definition time, expressing intent and used for diagnostics.
- **OwnedStateHandle<V>**: the minimal owned-view handle returned when a state slot is defined.
- **Setup phase**: the prototype setup execution context (where `def` is available).
- **Runtime phase**: any execution context outside setup (callbacks, runtime logic, etc.), as enforced by the system execution-phase guard.
- **Disposed**: the instance has been torn down; associated modules and capability handles are invalid.

> Execution-phase boundaries are enforced by the runtime execution-phase guard.  
> This contract only specifies which state operations are permitted in which phases.

---

## 2. Definition APIs: `def.state.*` (setup-only)

### 2.1 Common requirements

- Each `def.state.*` **MUST** take `semantic: string`.
- Each `def.state.*` **MUST** return an `OwnedStateHandle<V>`.
- Calling `def.state.*` outside setup **MUST** throw.

### 2.2 Supported definitions (v0, implementation-aligned)

- `def.state.bool(semantic, defaultValue)`
- `def.state.enum(semantic, defaultValue, spec)`
- `def.state.string(semantic, defaultValue, spec?)`
- `def.state.numberRange(semantic, defaultValue, spec)`
- `def.state.numberDiscrete(semantic, defaultValue, spec?)`
- Draft `def.state.numberList(semantic, initial: readonly number[])` (`C-STATE-NUMBER-LIST-0001`)

> Note: For legacy scalar v0 kinds, spec metadata (e.g. options/min/max/step/clamp) may exist as descriptive information, but implementations are not required to enforce validation.

---

## 3. OwnedStateHandle (minimal owned view)

### 3.1 Shape requirements (v0)

`OwnedStateHandle<V>` **MUST** provide at least:

- `value: V` or `get(): V` (one is sufficient; if both exist, they MUST be semantically equivalent).
- `setDefault(v: V): void`
- `set(v: V, reason?: StateSetReason): void`

> v0 only specifies the owned view.  
> Other views (Borrowed / Observed) are defined in the _state handle views_ contract and are not covered here.

### 3.2 Execution-phase rules (v0)

- Read (`value/get`):
  - Allowed in both setup and runtime phases.
- `setDefault(v)`:
  - Setup-only.
  - Calling in runtime **MUST** throw.
- `set(v, reason?)`:
  - Runtime-only.
  - Calling in setup **MUST** throw.

### 3.3 Lifecycle rules (v0)

After instance dispose:

- `value/get` **MUST** throw.
- `setDefault` **MUST** throw.
- `set` **MUST** throw.

> During the `unmounted` callback (while the instance is still alive), handle operations are allowed.  
> Strict prohibition begins only after dispose.

---

## 4. Relationship to rendering and updates (v0)

### 4.1 No implicit update

State mutation (`set`) **MUST NOT** automatically trigger render or commit.

- After a state value changes, DOM/output MUST remain unchanged until the host/controller explicitly requests an update (e.g. via `run.update()`).

### 4.2 Initial render visibility (v0 minimal constraint)

- A runtime-phase `set` that occurs before the first commit (e.g. during a `created` callback) **MUST** be visible to the initial render.
- Setup-phase `set` is invalid and therefore not considered.

> This section defines only _non-implicit updates_ and _basic visibility_.  
> It deliberately does not introduce dependency tracking, batching, or scheduling semantics.

---

## 5. Metadata and diagnostics (v0)

Implementations may retain minimal metadata on handles or internal records to support diagnostics:

- `semantic`
- `kind` (bool / enum / string / number.range / number.discrete)
- Optional: descriptive spec metadata (options/min/max/step/clamp)

This contract does not require metadata to be exposed via a public API, but error diagnostics SHOULD include the semantic name and operation label when possible.

---

## 6. Error model (v0)

### 6.1 Execution-phase violations

Violations of execution-phase rules defined in §2.1 and §3.2 **MUST** throw.

Minimum diagnostic information SHOULD include:

- `prototypeName` (if available)
- `op` (e.g. `state(<semantic>).set`)
- `expectedPhase` and `actualPhase` (or equivalent inferable information)

### 6.2 Lifecycle violations (disposed)

Invoking any handle operation after dispose (§3.3) **MUST** throw, and the error SHOULD be distinguishable as a dispose-related violation.

> v0 does not mandate specific error classes or error codes, but implementations SHOULD preserve distinguishability for testing and diagnostics.

---

## 7. Contract tests (v0 minimum coverage)

Implementations MUST be validated for at least:

1. `def.state.*` is setup-only and returns an `OwnedStateHandle` with `value/get`, `setDefault`, and `set`.
2. Execution-phase enforcement:
   - `setDefault` throws in runtime.
   - `set` throws in setup.
3. Rendering/update relationship:
   - A `set` during the created phase is visible to the initial render.
   - A `set` after mount does not trigger implicit re-render without an explicit update.
4. Lifecycle enforcement:
   - Handles remain usable during the `unmounted` callback.
   - After dispose, `value/get`, `setDefault`, and `set` all throw.

---

## 8. Related contracts (non-normative)

- State handle views (Owned / Borrowed / Observed): `state-handle-views.v0.md`
- Expose projections and App-side state: `expose/*.v0.md`
- asHook projections: `role/asHook*.v0.md`
- Interaction signals / fromInteraction: `interaction-signals/*.v0.md`
- Execution-phase guard: `runtime/exec-phase-guard.v0.md`

## Draft number.list extension

`C-STATE-NUMBER-LIST-0001` owns the current draft direction: dense finite-number array inputs are validated by own data descriptors, copied into ordinary frozen snapshots, and normalized from -0 to +0. Empty values, duplicates, cross-realm arrays and pure-data Array subclasses are admitted without retaining prototypes. Extra own properties, accessors, holes and non-finite elements are rejected. Caller inputs are never frozen. Equal normalized contents retain identity and emit nothing; changed set emits one full immutable transition, while setDefault remains silent. Existing phases, capability views and instance lifecycle apply. Public exposed get/subscribe is available without automatic scalar DOM/CSS mapping. Scalar Rule eq rejects this kind; Compiler support remains separate and unimplemented here. StateSetReason remains unknown, and Context mutable JSON consumers explicitly copy readonly snapshots. No sorting, quantization, spacing or cross-slot transaction is introduced; legacy scalar Object.is and validation behavior remain unchanged.
