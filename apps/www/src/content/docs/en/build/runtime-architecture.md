---
title: 'Runtime Architecture'
desp: 'How Proto UI materializes instances, runs modules, and hands work to an Adapter host'
description: 'How Proto UI materializes instances, runs modules, and hands work to an Adapter host'
---

The 0.2 execution path is runtime-based: a Prototype definition is materialized into a `RuntimeSession`, semantic Modules run behind controlled facades and ports, and an Adapter supplies a `RuntimeHost` plus host capabilities. This page describes that shipped path from the current implementation and catalog.

Most lifecycle entities named here are still `draft`; `C-LIFECYCLE-0008` (view intent) is `active`. A passing implementation is evidence for a draft rule, not an automatic lifecycle promotion.

## Prerequisites

Read [Core](/en/specifications/core/) for setup/render/callback surfaces, [Lifecycle](/en/specifications/lifecycle/) for author-visible ordering, and [Prototype API](/en/reference/prototype-api/) for definition syntax.

## Ownership map

```text
Prototype definition
  │ setup(def) / renderer
  ▼
RuntimeSession ── owns instance + repeatable mount epochs
  ├─ Kernel ──── author handles, callback scope, render syntax
  ├─ Module orchestrator ── dependency order, facades, ports, lifecycle hooks
  └─ RuntimeHost boundary ── raw Props, scheduling, commit completion, cap wiring
                              │
                              ▼
                         Adapter + host platform
```

`createRuntimeSession(proto, host)` is the main session boundary in `@proto.ui/runtime`. `createRuntimeInstance` constructs the lower-level Kernel and Module graph; official Adapters normally own that integration rather than asking application code to assemble it.

## Two lifecycle axes

`C-LIFECYCLE-0002` and `C-LIFECYCLE-0006` separate terminal instance lifetime from repeatable host-view lifetime:

| Axis | States | Ownership |
| --- | --- | --- |
| Instance | `setup → alive → disposing → disposed` | One logical Proto instance; setup and created run once |
| Mount | `detached → mounting → mounted → unmounting → detached` | One host-view epoch; may repeat while the instance stays alive |

The canonical flow is:

```text
setup → created → (mount → render → commit.done → mounted
                    → update → render → commit.done → updated
                    → unmount → unmounted) × n
      → beforeDispose → disposed
```

Unmount is not disposal. Instance-owned State, resolved Props, callback registries, and logical identity survive a detached interval. A new mount increments `mountEpoch`; stale completion from an older epoch must not advance the new view.

## Explicit update and commit

Render and commit are runtime-owned effects (`C-LIFECYCLE-0003`). `run.update()` and `session.controller.update()` express update intent. Props, State, Context, Event, or Feedback mutations do not implicitly render.

The host decides when a commit is complete by calling `signal.done()`. Only then may Runtime deliver `mounted` or `updated`, bind event delivery for the active epoch, and run post-commit Module hooks. Update intent while detached only marks work dirty; the next mount renders current runtime state.

## Module orchestration

`RuntimeModuleOrchestrator` constructs the current fixed Module set in dependency order. It rejects duplicate names, missing hard dependencies, cycles, and undeclared dependency access. The Kernel receives facade-only access; Runtime internals may use privileged ports; Adapters inject host capabilities through flat `ModuleWiring`.

Each Module receives independent instance, mount, and legacy proto-phase hooks. Logical State can remain instance-owned while DOM listeners, observers, positioning sessions, and other host resources are released or rebound per mount epoch. See [Module & Extension Architecture](/en/build/module-extension-architecture/) for the authoring boundary.

## Adapter handoff

`RuntimeHost` has a deliberately small responsibility set:

- provide the current raw Props snapshot;
- commit `TemplateChildren` and report commit completion;
- schedule lifecycle work and, when used, delayed callbacks;
- receive structured lifecycle diagnostics;
- attach Module host capabilities in `onRuntimeReady`; and
- make event/observer systems ineffective when an epoch unmounts.

A minimal deterministic host used by runtime tests looks like this:

```ts
import type { RuntimeHost } from '@proto.ui/runtime';

export function createTestHost(prototypeName: string): RuntimeHost<Record<string, unknown>> {
  return {
    prototypeName,
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
  };
}
```

This fake host proves runtime ordering and phase guards. It does not prove DOM event routing, framework lifecycle integration, target projection, or host-capability correctness; those require Adapter and host tests.

## Common boundary mistakes

- Disposing the Module hub on every unmount destroys repeatable instance semantics.
- Calling `commit()` without eventually calling `done()` leaves the epoch incomplete.
- Triggering render from a Module mutation bypasses explicit update ownership.
- Letting Kernel code reach Module ports, or Modules reach undeclared dependencies, bypasses orchestration boundaries.
- Treating the deprecated CP0–CP10 strings as the lifecycle source of truth loses epoch and revision identity; structured lifecycle events govern current traces.
- Copying one Web Adapter's scheduling choices into Core turns host mechanics into a false cross-host guarantee.

## Verification

Run focused evidence before the full suite:

```sh
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/lifecycle.session.v1.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/lifecycle.update-order.strict.v0.contract.test.ts
corepack pnpm@10.32.1 check:types
```

`T-LIFECYCLE-0003`, `T-LIFECYCLE-0005`, and `T-LIFECYCLE-0006` connect the shared lifecycle criteria to Runtime and official Adapter evidence.

Continue to [Host Caps](/en/build/host-caps/) for capability wiring, [Adapter Guide](/en/build/adapter-guide/) for the current contribution boundary, or [Contracts & Tests](/en/build/contracts-and-tests/) for evidence tracing.
