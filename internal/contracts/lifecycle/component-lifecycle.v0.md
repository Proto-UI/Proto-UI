# Component Lifecycle Contract (v0)

> **Human-readable reference projection.** The normative source is `spec/contracts/C-LIFECYCLE-0001..0008.yaml`. This text is retained and maintained for direct reading; the catalog takes precedence where older v0 wording differs from the repeatable mount-epoch model.

This document defines the **lifecycle guarantees exposed to Component Authors** (Prototype Authors) in Proto UI.

It specifies:

- callback ordering
- availability boundaries
- execution domain guarantees
- disposal semantics

This document is **normative**.

---

## Execution Domain Mapping (v0)

Proto UI exposes a coarse execution guard domain via `SystemCaps` (`__sys.domain()`).

Guard domains are **not phases**; they are **permission domains** used by modules to enforce correct API usage.

### Domains

- `"setup"`
  - Active **only while** executing inside `proto.setup(def)`
- `"runtime"`
  - Active for all execution after `setup` returns:
    - `created`
    - render
    - `mounted`
    - `updated`
    - `unmounted`
    - host-driven callbacks

### Contract (v0)

1. During `proto.setup(def)`, `__sys.domain()` MUST be `"setup"`.
2. Immediately after `setup(def)` returns (before any lifecycle callbacks or render), `__sys.domain()` MUST switch to `"runtime"`.
3. During all lifecycle callbacks (`created`, `mounted`, `updated`, `unmounted`) and render execution, `__sys.domain()` MUST be `"runtime"`.
4. During the `unmounted` callback:
   - `__sys.domain()` MUST be `"runtime"`
   - `__sys.isDisposed()` MUST be `false`
5. After the `unmounted` callback returns:
   - `__sys.isDisposed()` MUST become `true`
   - All module handles guarded by `__sys` MUST become unusable and throw.

---

## Lifecycle Callbacks

Proto UI exposes the following lifecycle callbacks to Component Authors:

- `created`
- `mounted`
- `updated`
- `unmounted`

These callbacks are registered during setup and executed by the runtime according to the canonical lifecycle timeline.

---

## Ordering Guarantees

### Setup → Created → First Render → Mounted

The runtime MUST guarantee the following order:

1. `proto.setup(def)` is executed
2. `created` callbacks are executed
3. Initial render is executed
4. First commit is performed
5. `mounted` callbacks are executed

Notes:

- `created` always runs **before** the first render.
- `mounted` always runs **after** the first commit.

---

## Update Cycle

When an update is triggered (e.g. via `run.update()`):

1. Render is executed
2. Commit is performed
3. `updated` callbacks are executed

No lifecycle callback may be reordered across these steps.

### View Reconciliation Retry (`C-LIFECYCLE-0008`)

Generated Web Components retry desired-view reconciliation after native connection when a preconfigured logical owner has no mounted view yet. The retry runs after the current native slot commit while keeping the owner, State, and setup result intact. Already mounted views retain their rendered nodes, and terminal disposal cancels queued materialization.

---

## Unmount & Disposal Semantics

### Unmount Callback

When a component instance is unmounted, the runtime MUST:

1. Execute `unmounted` callbacks
2. Only after all `unmounted` callbacks return, dispose the instance

### Availability During `unmounted`

During execution of `unmounted` callbacks:

- All module facades and handles MUST remain usable
- `__sys.isDisposed()` MUST be `false`

This allows teardown logic to safely access state, events, and other modules.

### After Disposal

After disposal completes:

- `__sys.isDisposed()` MUST be `true`
- Any access to module facades or handles guarded by `__sys` MUST throw an error

---

## Error Model

Lifecycle violations (ordering, availability, or domain misuse) are considered **runtime bugs**.

Implementations MUST fail fast and MUST NOT silently recover.

### Draft Error-Path Clarifications

- **Failed creation (`C-LIFECYCLE-0002-J`, draft)**: After Runtime acquires an instance, a synchronous `created` failure completes all reachable acquired-resource terminal cleanup before rethrowing the **identical initiating value**. Queued Delay work is cancelled and instance-scoped handles become invalid even if cleanup also throws; secondary errors never replace the initiating value, and props-sync or watcher dispatch failures do not skip registered `beforeDispose` releases.
- **Ordinary terminal disposal (`C-LIFECYCLE-0002-K`, draft)**: The authored `beforeDispose` sequence stops at the first thrown value (including falsy values). Later authored callbacks do not run, while Runtime still attempts private terminal cleanup and rejects afterward with the identical authored error when it is the only error.
- **Open scope**: Recovery of resources never returned by a failing factory is not promised; other callback error propagation remains tracked in `C-LIFECYCLE-0002-Q-CALLBACK-ERRORS` (draft).

---

## Versioning

- Version: **v0**
- v0 guarantees ordering, availability, and domain mapping.
- Future versions may introduce additional callbacks or checkpoints but MUST NOT violate v0 guarantees.
