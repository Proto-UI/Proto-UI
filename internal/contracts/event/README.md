# Event Contract Index

This directory defines **event** contracts for Proto UI.

Event is the minimal bridge from **host input events** to **prototype runtime callbacks**. It is responsible for:

- registering/unregistering listeners
- enforcing phase rules (setup-only registration, runtime-only callbacks)
- default binding target (component root) and global bindings
- automatic cleanup on unmount

Event is **not** responsible for:

- semantic intent extraction (rule)
- cross-platform gesture abstraction (future)
- choosing adapter-specific global targets (adapter config responsibility)

---

## Contract Set (v0)

- `event.v0.md`
  - v0 normative contract for:
    - `def.event.on/off`
    - `def.event.onGlobal` (global registrations are also removed through token-based `off`)
    - callback signature and phase rules
    - auto cleanup
    - ProtoEvent union (minimal set)
    - error model

---

## Related Contracts

Event commonly composes with:

- `state` (event handlers may set state in runtime)
- `rule` (future: state/context-driven intents; event → rule is not promised in v0)
- adapter realization contracts (host event system, root node, global target mapping)
