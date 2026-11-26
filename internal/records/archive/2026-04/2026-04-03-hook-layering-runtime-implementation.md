# 2026-04-03 Hook Layering and Runtime Implementation

> Internal record. Not normative. This document captures the current design decision for where hook authoring APIs live, where hook implementations live, and how they depend on module capabilities.

---

## 1) Context

During the dropdown, focus, and anatomy cleanup, one boundary issue became increasingly clear:

- privileged `asHook` definitions did not belong in prototype libraries
- moving them into `module-*` packages was also not quite correct
- `core` already acts as the official hook entry surface, but that does not mean every concrete hook implementation should permanently live inside `core`

The immediate trigger was `asCollection` / `asCollectionItem`, but the same question also applies to existing built-in hooks such as:

- `asFocusable`
- `asFocusGroup`
- `asFocusScope`
- `asOverlay`
- `asTrigger`

---

## 2) Decision

Current layering should be understood as follows:

### 2.1 `core` is the official hook entry surface

`core` owns:

- `defineAsHook`
- author-facing hook signatures
- hook result and authoring types
- the official import surface for built-in hooks

This keeps the author experience low-friction and matches the existing architecture, where `core` already acts as the official public surface.

### 2.2 `module-*` packages remain capability backends

`module-*` packages continue to provide:

- host capability wiring
- ports and facades
- installation-time dependency structure
- adapter/runtime capability integration

They should not become the place where hook authoring semantics are implemented.

### 2.3 `runtime` is the concrete hook implementation layer

Concrete hook implementations that need access to:

- active `def`
- hook runtime bookkeeping
- setup-phase guards
- privileged facade / port access

should live on the runtime side.

That is because these concerns are already runtime/authoring concerns, not pure capability-module concerns.

---

## 3) Why not make hooks into ordinary modules?

That approach has one real benefit:

- the module installation/wiring model solves dependency ordering and capability availability well

But it also introduces a deeper mismatch:

- ordinary modules are designed to be consumed by runtime
- concrete hook implementations are not runtime-agnostic; they know about `def`, setup phase, hook capture, and authoring semantics

If we force full hook implementations into ordinary modules, we either:

- pollute the module abstraction with runtime authoring concerns
- or create a wrapper layer where runtime still contains the real hook implementation anyway

So the chosen direction is:

- let modules continue to provide capabilities
- let runtime-side hook implementations consume those capabilities

---

## 4) Why not leave everything inside `core`?

Leaving every concrete hook implementation in `core` also has costs:

- `core` becomes a dumping ground for privileged implementation detail
- capability-backed hook logic gets harder to evolve without expanding `core`
- third-party hook expansion becomes conceptually muddier

So `core` should remain the official built-in hook entry surface, but not the long-term home of every concrete hook implementation detail.

---

## 5) Current transitional shape

At the time of this record:

- `core` still exports built-in hooks directly
- runtime registers backend implementations for selected built-in hooks
- core hook entry points resolve those runtime backends through a registry

The transitional part is now the registry shape itself, not a duplicated implementation.

Concrete built-in hook logic no longer remains duplicated in `core` as a fallback path.

---

## 6) Immediate practical rule

Until this migration settles:

- new privileged hooks should not be added to prototype libraries
- new hook implementations should not be forced into ordinary `module-*` packages just because they depend on capabilities
- if a hook needs runtime authoring context plus privileged facade/port access, it belongs on the runtime implementation side

---

## 7) Open follow-up

### 7.1 Should runtime backend registration become a more formal internal contract?

Probably yes, once more hooks move over and the pattern stabilizes.

### 7.2 Should there eventually be a cleaner separation between public hook entry files and backend registration internals?

Yes. The public surface should stay small, and backend registration should remain an internal runtime concern.
