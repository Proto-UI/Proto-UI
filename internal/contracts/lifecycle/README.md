# internal/contracts/lifecycle/component-lifecycle.v0.md

> **Human-readable reference projection.** The normative source is `spec/contracts/C-LIFECYCLE-0001..0008.yaml`. This document remains useful explanatory material and should be maintained alongside the catalog. Where older single-mount or CP0-CP10 passages conflict with the catalog, the catalog wins and those passages require revision.

> Status: Normative — implementation-aligned (v0)
>
> This document specifies the **component-visible lifecycle guarantees** of Proto UI v0.

See also:

- [`module-resource-ownership.md`](./module-resource-ownership.md) for the audited instance/view ownership matrix used by runtime modules.
- [`view-intent-l1.md`](./view-intent-l1.md) for the planned L1 desired-view and adapter reconciliation model governed by `C-LIFECYCLE-0008`.

Generated Web Components retry desired-view reconciliation after a native connection when a preconfigured logical owner has no mounted view. The retry runs after the current native slot commit and retains the owner, State and setup result. Already mounted views retain their rendered nodes, and terminal disposal prevents queued materialization. This implements the active `C-LIFECYCLE-0008` default view intent; the related `C-LIFECYCLE-0002` and `C-LIFECYCLE-0006` contracts remain draft.

> It defines:
>
> - the canonical lifecycle timeline
> - ordering guarantees between callbacks
> - availability of runtime capabilities (`run`, state, event, etc.)
> - what Component Authors may and may not assume

---

## 0. Scope & Audience

### 0.1 Audience

This contract is **normative** for:

- Component Authors (Prototype authors)
- Runtime maintainers (engine)
- Adapter authors (as a reference for exposed guarantees)

### 0.2 Scope (v0)

This document specifies:

- Lifecycle callback ordering
- Visibility boundaries (what is available when)
- Interaction with:
  - state
  - render / commit
  - update scheduling
  - unmount & disposal

### 0.3 Non-goals (v0)

This document does **NOT** specify:

- Adapter internal lifecycles (DOM / framework specifics)
- Event registration semantics (see `event.v0.md`)
- Hook installation mechanics
- Error recovery or retry semantics

---

## 1. Canonical Lifecycle Timeline (v0)

Proto UI defines **one canonical lifecycle timeline** per component instance.

All hosts and adapters MUST map their behavior into this timeline without reordering checkpoints.

### 1.1 Timeline overview

```

┌────────┐
│ setup  │   (prototype setup)
└───┬────┘
│
▼
┌──────────┐
│ created  │   (instance created, before first render)
└───┬──────┘
│
▼
┌──────────┐
│ render   │   (render function executed)
└───┬──────┘
│
▼
┌──────────┐
│ commit   │   (host applies rendered output)
└───┬──────┘
│
▼
┌──────────┐
│ mounted  │   (instance is reachable / interactive)
└──────────┘

```

After `mounted`, the instance may undergo zero or more **update cycles**, and eventually:

```

┌────────────┐
│ unmounted  │   (instance is being torn down)
└────────────┘

```

---

## 2. Setup Phase

### 2.1 Definition

`setup(def)` is executed exactly once per component instance, before any runtime behavior exists.

### 2.2 Guarantees

During `setup`:

- `def` is available
- No `run` handle exists
- No rendering has occurred
- No side effects may reach the host

### 2.3 Allowed operations (non-exhaustive)

- `def.state.*` (state slot definition)
- `def.event.on / onGlobal / off`
- `def.lifecycle.onCreated / onMounted / onUnmounted`
- returning the render function

### 2.4 Forbidden operations

During `setup`, implementations MUST throw if:

- runtime-only APIs are invoked (e.g. `state.set`)
- host-dependent capabilities are accessed
- `run`-bound APIs are used

> Enforcement is provided by SystemCaps / exec-phase guard.

---

## 3. Created Callback

### 3.1 Definition

The `created` callback runs **after setup** and **before the first render**.

It represents the moment where:

- the instance exists
- state storage exists
- but no DOM / host output has been committed

### 3.2 Ordering guarantee (normative)

- `created` MUST run **after** `setup`
- `created` MUST run **before** the first `render`
- `created` MUST run **before** the first `commit`

### 3.3 Capabilities during `created`

During `created`:

- `run` is available
- state `get()` and `set()` are allowed
- event callbacks are NOT yet active
- host output is NOT yet visible

### 3.4 State visibility rule (normative)

If a state mutation (`set`) occurs during `created`:

- the mutation MUST be visible to the initial render
- the initial render MUST observe the updated state

This is a hard guarantee in v0.

---

## 4. Render Phase

### 4.1 Definition

The render function returned from `setup` is executed to produce a **rendered description** (children / template result).

### 4.2 Ordering guarantee

- The first render occurs **after** `created`
- The first render occurs **before** `mounted`

### 4.3 Capabilities during render

During render:

- `run` is available
- state `get()` is allowed
- state `set()` is allowed (but see §6.2)
- no implicit scheduling occurs

### 4.4 Render purity (normative, v0)

Proto UI v0 does **NOT** enforce render purity.

However:

- state mutations during render MUST NOT trigger an automatic re-render
- render execution is synchronous and single-pass

---

## 5. Commit

### 5.1 Definition

`commit` is the host-level application of the rendered output.

Examples:

- DOM insertion / patching (Web)
- framework reconciliation (React / Vue adapters)

### 5.2 Ordering guarantee

- `commit` MUST occur after render
- `mounted` MUST occur after commit

### 5.3 Visibility

After `commit`:

- rendered output is visible to the host
- event bindings MAY become effective (adapter-defined, see adapter contract)

---

## 6. Mounted Callback

### 6.1 Definition

`mounted` indicates that the component instance is now:

- reachable
- interactive
- fully connected to the host

### 6.2 Ordering guarantee (normative)

- `mounted` MUST run **after** the first `commit`
- `mounted` MUST NOT run if the instance is unmounted before commit completes

### 6.3 Capabilities during `mounted`

During `mounted`:

- `run` is available
- state `get()` and `set()` are allowed
- event callbacks MAY now fire
- side effects targeting the host are allowed

### 6.4 No implicit update rule (normative)

If state is mutated during `mounted`:

- the mutation MUST NOT trigger a render or commit automatically
- a new render requires an explicit `update()` call

---

## 7. Update Cycle (v0)

### 7.1 Trigger

An update cycle is triggered only by:

- an explicit `controller.update()` call
- host-controlled update wiring (adapter-defined)

State mutation alone MUST NOT trigger update.

### 7.2 Ordering

For each update cycle:

```

render → commit → updated callbacks (if any, future versions)

```

v0 does not define an `updated` lifecycle callback.

---

## 8. Unmounted Callback & Disposal

### 8.1 Definition

`unmounted` is invoked when the component instance is being torn down.

### 8.2 Ordering guarantee

- `unmounted` MUST run at most once
- `unmounted` MUST run before instance disposal
- `unmounted` MAY run even if `mounted` never ran

### 8.3 Capabilities during `unmounted`

During `unmounted`:

- `run` is still available
- state handles are still usable
- event cleanup is in progress or imminent

### 8.4 After disposal (normative)

After `unmounted` completes and disposal finishes:

- all state handles MUST throw on access
- all runtime capabilities are invalid
- no further callbacks may run

---

## 9. Error & Interruption Semantics (v0)

### 9.1 Errors in setup

If `setup` throws:

- the instance MUST NOT proceed to `created`
- no render or commit may occur
- adapters MUST NOT partially mount the instance

### 9.2 Errors in runtime callbacks

If a runtime callback throws:

- behavior is adapter-defined
- the canonical timeline MUST NOT be reordered
- partial execution MUST NOT resurrect a disposed instance

(v0 does not define recovery semantics.)

---

## 10. Summary of Hard Guarantees (v0)

Component Authors may rely on:

1. `created` runs before first render
2. state mutations in `created` are visible to first render
3. no state mutation triggers implicit render
4. `mounted` runs only after commit
5. runtime capabilities are invalid after disposal
6. lifecycle ordering is invariant across adapters

Any violation of these is a **bug**.

---

## 11. Versioning Notes

- This document specifies **v0**
- Future versions may:
  - add checkpoints
  - add new callbacks
  - tighten render purity
- Existing ordering guarantees MUST remain intact
