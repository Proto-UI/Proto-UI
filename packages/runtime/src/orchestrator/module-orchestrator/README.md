# Module Orchestrator (Internal)

This document explains how module dependencies and wiring are defined and used. It is an internal engineering guide (not a contract).

---

## 1) Module Definition

Modules are registered through `defineModule` and `ModuleDef`. Each module declares its dependency set explicitly.

Example:

```ts
export const FooModuleDef = defineModule({
  name: 'foo',
  deps: ['props', 'state'],
  optionalDeps: ['event'],
  create: createFooModule,
});
```

Notes:

- `deps` are **hard**: must exist and be initialized before this module.
- `optionalDeps` are **soft**: if present, must be initialized before this module.

---

## 2) Dependency Access (Facade / Port)

Modules receive a `deps` helper via `ModuleFactoryArgs`. This helper **only** allows access to declared dependencies.

```ts
const props = ctx.deps.requireFacade<PropsFacade>('props');
const statePort = ctx.deps.requirePort<StatePort>('state');

const event = ctx.deps.tryFacade<EventFacade>('event'); // optional
```

Rules:

- Accessing an **undeclared** dependency throws.
- `require*` throws if the dependency is missing.
- `try*` returns `undefined` if missing, but still throws if undeclared.

---

## 3) Dependency Graph

The orchestrator builds a dependency graph from `ModuleDef`:

- validates hard dependencies
- resolves ordering (topo sort)
- rejects cycles

This graph is an **internal strategy layer**; modules should not depend on it directly.

---

## 4) Wiring API (Host Caps)

Adapters inject host capabilities through the wiring API, not by touching modules.

```ts
const wiring = orchestrator.getWiring();
wiring.attach('props', entries);
wiring.reset('props');
```

Rules:

- Wiring is **flat**: module name → caps entries
- `reset()` can target a single module or all attached host caps
- Bulk `reset()` attempts every module and then rethrows the first failure, including a falsy thrown value. A failing vault still stops its own listener sequence, so an attempted reset does not guarantee every resource was released.

---

## 5) Intent

This design keeps:

- module dependencies explicit
- module access controlled
- host caps injection isolated from module internals

It allows future orchestration strategies (deps graph, ordering rules, diagnostics) without changing module authoring APIs.
