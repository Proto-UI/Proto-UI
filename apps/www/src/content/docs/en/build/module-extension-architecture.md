---
title: 'Module & Extension Architecture'
desp: 'Semantic Module ownership, dependency boundaries, runtime registration, and governed extension work'
description: 'Semantic Module ownership, dependency boundaries, runtime registration, and governed extension work'
---

Modules carry reusable protocol semantics between Prototype authoring and host translation. A Module may expose setup/runtime author handles, retain instance state, depend on another Module, and consume Host Capabilities without importing React, Vue, or Custom Elements.

The implementation contains more Module packages than the catalog currently has `M-*` entities. Entity counts are not package counts: an uncataloged Module is implementation evidence, not an active public guarantee.

## Prerequisites

Read [Core](/en/specifications/core/) for authoring phases, [Runtime Architecture](/en/build/runtime-architecture/) for orchestration, and [Host Caps](/en/build/host-caps/) for the host boundary.

## Static declaration is not runtime implementation

Two APIs with similar names solve different problems:

| Surface | Owner | Purpose |
| --- | --- | --- |
| `moduleDeclaration` / `declareModule` in `@proto.ui/core` | Prototype definition | Bind immutable typed configuration before Runtime Module construction and Adapter selection |
| `defineModule` / `createModule` in `@proto.ui/module-base` | Runtime implementation | Define a Module's dependencies, resource ownership, facade, port, and lifecycle hooks |

`C-MODULE-DECLARATION-0001` governs the first surface. A setup-time `asHook` call cannot retroactively change static requirements; authored asHooks must publish frozen requirements and callers must reuse them on the Prototype definition.

## Runtime Module anatomy

```text
ModuleDef
  ├─ name + resourceOwnership
  ├─ deps / optionalDeps
  └─ create(ctx)
       ├─ facade ── safe semantic surface consumed by Kernel or dependent Modules
       ├─ port ──── privileged Runtime/Module integration surface
       └─ hooks ─── instance, mount, proto phase, post-commit, dispose
```

The current implementation pattern uses `defineModule` and `createModule`:

```ts
import { createModule, defineModule, type ModuleFactoryArgs } from '@proto.ui/module-base';

type IdentityFacade = { prototypeName(): string };

function createIdentityModule(ctx: ModuleFactoryArgs) {
  return createModule<'identity', 'instance', IdentityFacade>({
    name: 'identity',
    scope: 'instance',
    init: ctx.init,
    caps: ctx.caps,
    deps: ctx.deps,
    build: () => ({
      facade: { prototypeName: () => ctx.init.prototypeName },
      hooks: {},
    }),
  });
}

export const IdentityModuleDef = defineModule({
  name: 'identity',
  resourceOwnership: 'instance',
  deps: [],
  create: createIdentityModule,
});
```

This demonstrates the real implementation types. It is **not** a promise that a third-party package can dynamically install `IdentityModuleDef` into the stock Runtime: `createRuntimeInstance` currently registers a fixed reviewed Module list. Adding a new Runtime Module is repository architecture work unless a future public registration surface is cataloged.

## Dependency graph and access

`RuntimeModuleOrchestrator` topologically sorts hard and present optional dependencies. It fails on duplicate names, missing hard dependencies, and cycles. `ctx.deps` then enforces declared access:

- `requireFacade` / `requirePort` fail when a declared dependency is missing;
- `tryFacade` / `tryPort` return `undefined` only for a missing optional dependency; and
- every accessor rejects an undeclared dependency.

Do not bypass this with package-level imports into another Module's implementation object. Package dependencies are build mechanics; `deps` expresses runtime semantic ordering and access.

## Facade, port, and capability

Use the narrowest surface:

- **Facade:** stable semantic operations another author-facing layer or Module may consume.
- **Port:** privileged integration needed by Runtime or a declared dependent Module; it is not automatically public API.
- **Host Capability:** a platform service or projection supplied through the Adapter, never a back door for Module-to-Module access.
- **System Capability:** Runtime-owned phase/lifecycle guards such as `SYS_CAP`; Adapter wiring cannot override it.

Kernel receives facade-only access. Runtime may inspect ports for lifecycle integration. Adapters attach capability entries through `ModuleWiring`; they should not receive or mutate internal Module instances.

## Resource ownership

Every `ModuleDef` declares `resourceOwnership`:

| Value      | Meaning                                                               |
| ---------- | --------------------------------------------------------------------- |
| `instance` | Logical resource survives detach; no host-view activation is owned    |
| `view`     | Resource belongs to one mount epoch and must be released on detach    |
| `mixed`    | Logical state survives while host bindings suspend, rebind, or replay |

The value documents intent, while lifecycle hooks and tests enforce actual cleanup. `C-LIFECYCLE-0006` requires instance and mount phases to remain orthogonal; `packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts` exercises mixed ownership across remount.

## Governed extension workflow

Before adding behavior, trace a vertical slice:

```text
knowledge/decision → C-* criteria → M-* owner → HC-* requirement
                   → A-* support/provision → T-* cases → implementation
```

Then:

1. Confirm whether an existing Module already owns the semantic channel.
2. Use a dated record only for alternatives or unresolved direction; stabilized behavior belongs in entities.
3. Add or revise one coherent `M-*` identity with satisfied Contracts and required Host Caps.
4. Define facade/port/dependency boundaries and explicit resource ownership.
5. Register implementation in Runtime only when the issue authorizes that architecture change.
6. Add Module-level tests, Runtime integration, and Adapter evidence when host translation is involved.
7. Update official `A-*` profile relations only for the reviewed slice; absence remains uncataloged.

## Common boundary mistakes

- Creating an empty `M-*` entity to mirror every package or token produces no semantic ownership.
- Exposing a port as public API because it is convenient leaks Runtime privilege.
- Importing an undeclared dependency hides ordering and disposal assumptions.
- Treating `scope: 'instance'` as proof of correct cleanup ignores `resourceOwnership` and lifecycle behavior.
- Letting a Module call `run.update()` indirectly on every mutation violates explicit Runtime update ownership.
- Assuming the fixed Runtime list is a plugin registry promises an extension surface that does not exist.

## Verification

```sh
corepack pnpm@10.32.1 vitest run packages/core/test/contract/prototype.module-declarations.v0.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/module-declarations.v0.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:types
```

Continue to [Contracts & Tests](/en/build/contracts-and-tests/) for evidence mapping, [Host Caps](/en/build/host-caps/) for host services, or [Adapter Guide](/en/build/adapter-guide/) before changing translation code.
