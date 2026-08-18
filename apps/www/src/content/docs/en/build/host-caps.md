---
title: 'Host Caps'
desp: 'How semantic Modules acquire bounded host capabilities without owning a framework'
description: 'How semantic Modules acquire bounded host capabilities without owning a framework'
---

A Host Capability is the narrow service a semantic Module requires from an environment, or the sink through which it projects results. It keeps DOM, framework, scheduler, geometry, and native-control mechanics out of portable Prototype syntax.

The catalog currently contains a reviewed subset of host-capability identities. The implementation has additional capability tokens; a package or token without an `HC-*` entity is uncataloged, not automatically stable or unsupported.

## Prerequisites

Read [Core](/en/specifications/core/) for the portable/host split, [Runtime Architecture](/en/build/runtime-architecture/) for `ModuleWiring`, and [Compatibility](/en/reference/compatibility/) for the current Adapter profile slice.

## Four layers, four owners

```text
Contract criterion ── defines portable behavior
       │
Module (`M-*`) ────── owns semantic state and requests a capability
       │ CapToken
Host Cap (`HC-*`) ─── defines the bounded host responsibility
       │ provides.hostCaps
Adapter (`A-*`) ───── supplies native / translated / emulated realization
```

Behavior remains owned by `C-*`; a capability entity does not become a second contract. `D-ADAPTER-PROFILE-0001` requires an official profile to state whether a provided capability is native, translated, or emulated. If it cannot satisfy the capability faithfully, it must not claim provision.

## Token, vault, and wiring

Core `cap<T>(id)` creates a typed token with a globally namespaced string ID. Each Runtime Module receives a read-only `CapsVaultView`:

- runtime-owned base capabilities such as `SYS_CAP` survive host reset;
- Adapter-attached capabilities live in a replaceable attached layer;
- `has` and `get` resolve the current value;
- `onChange` and `epoch` let a Module rebind when capability identity changes; and
- unavailable `get` fails with a stable diagnostic.

Adapters never mutate a Module directly. `onRuntimeReady` receives flat `ModuleWiring`, and wiring attaches capability entries to the owning Module name. Unmount/reset clears only the attached host layer; terminal Module disposal remains a separate Runtime action.

## Capability shapes are domain-specific

Not every capability is a lease. Current shapes include:

| Shape | Examples | Lifetime behavior |
| --- | --- | --- |
| Source | Props source | Read/invalidate current host input |
| Sink or bridge | Expose record/event sinks, accessibility projection | Receive a semantic projection |
| Scoped binding | Event binding/default action | Attach host input routes and revoke them with the view |
| Lease | Anchored Positioning, Scroll Surface, Text Control, Move Gesture | `attach`, optionally `update`/`request`, then `dispose` |

For example, the cataloged Positioning boundary uses a bounded host lease:

```ts
import { cap, type AnchoredPositionConnection } from '@proto.ui/core';

export interface AnchoredPositionHostLease {
  update(connection: AnchoredPositionConnection): void;
  requestUpdate(): void;
  dispose(): void;
}

export interface AnchoredPositionHost {
  attach(connection: AnchoredPositionConnection): AnchoredPositionHostLease;
}

export const ANCHORED_POSITION_HOST_CAP = cap<AnchoredPositionHost>(
  '@proto.ui/positioning/anchoredHost'
);
```

`M-POSITIONING-0001` owns when to attach, update, and dispose that lease; `HC-ANCHORED-POSITION-0001` owns what the host must do; `T-ANCHORED-POSITIONING-0001` maps Module, host, Runtime, and Prototype evidence.

## Lifetime and rebinding

A capability value becoming available is not the same as a host resource being live forever. Modules declare `resourceOwnership` as `instance`, `view`, or `mixed`:

- instance resources survive repeatable detach;
- view resources belong to one mount epoch;
- mixed Modules preserve semantic state while suspending or replacing host resources.

Lease-shaped capabilities should dispose the previous lease before replacing targets and reject stale async completion through epoch or connection identity. Adapter wiring should revoke DOM listeners, observers, and host references on unmount without destroying instance-owned state.

## Target and surface projection

Host capability does not mean “raw root element.” `C-HOST-SURFACE-PROJECTION-0001` distinguishes a logical `boundaryTarget` from the visual `surfaceTarget`. Focus, accessibility, event, hit testing, native properties, geometry, and presentation may each have domain-specific target rules. A wrapper and a visible native control must not become competing owners merely because both are reachable from an Adapter.

Portable authors receive semantic handles, not raw target access. Host-specific escape hatches remain profile-local and cannot be promoted to cross-Adapter Props or State guarantees.

## What fake hosts prove

Runtime fake hosts and in-memory capability doubles are excellent for Module ordering, missing-cap behavior, lease cleanup, and phase guards. They cannot prove browser layout, native focus, DOM event propagation, framework commit timing, or a concrete Adapter's target choice. Use the lowest layer that can observe the claim, then add official Adapter evidence when the claim crosses translation.

## Adding or changing a capability slice

1. Identify the `C-*` criteria and semantic Module owner.
2. Add or update one coherent `M-*` and `HC-*` relation slice; do not catalog tokens by count.
3. Define the capability shape and resource lifetime in the closest Module package.
4. Wire each applicable Adapter without letting Adapter code reinterpret semantics.
5. Record profile `provides.hostCaps` only after reviewed evidence exists.
6. Add a `T-*` entity that maps criteria to Module, fake-host, Adapter, and integration implementations.
7. Run graph/schema validation plus focused executable tests.

## Common boundary mistakes

- Treating a missing capability as “silently supported” hides an Adapter omission decision.
- Reading an unlisted profile relation as unsupported violates the catalog's uncataloged state.
- Storing host targets in portable State leaks one platform into the protocol.
- Reusing a view lease across a replaced root lets stale observers and callbacks reach the wrong surface.
- Creating an `HC-*` placeholder without criteria, owner, and evidence only inflates inventory.

## Verification

```sh
corepack pnpm@10.32.1 vitest run packages/modules/positioning/test/floating-ui-host.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/overlay.v0.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/spec/graph/test/adapter-profile.test.ts
corepack pnpm@10.32.1 check:types
```

Continue to [Module & Extension Architecture](/en/build/module-extension-architecture/) for Module ownership, [Adapter Guide](/en/build/adapter-guide/) for contribution readiness, or [Contracts & Tests](/en/build/contracts-and-tests/) for evidence layers.
