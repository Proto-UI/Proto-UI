---
title: 'Prototype API'
desp: 'Public authoring entry points and their protocol roles'
description: 'Public authoring entry points and their protocol roles'
---

This page maps the public TypeScript authoring API to Proto UI's protocol surfaces. It is an engineering reference, not an independent specification: when API behavior and a spec entity disagree, the applicable entity governs.

The entry points below exist in the published 0.2.0 packages and in the current workspace. That API availability does not promote related `draft` entities to `active`, and the current workspace may also carry changes for the draft 0.3.0-alpha.0 train.

## Definition shape

`definePrototype` creates a normal Prototype definition. `defineAsHook` creates the special composable form. Both can share one setup function:

```ts
import type { DefHandle } from '@proto.ui/core';
import { defineAsHook, definePrototype } from '@proto.ui/core';
import { asFocusable, asTrigger } from '@proto.ui/hooks';

type ToggleProps = { disabled?: boolean };

function setupToggle(def: DefHandle<ToggleProps>) {
  asTrigger();
  asFocusable<ToggleProps>();

  def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
  const active = def.state.bool('active', false);
  def.expose.state('active', active);

  def.event.on('press.commit', (run) => {
    active.set(!active.get(), 'toggle');
    run.expose.emit('activeChange', { active: active.get() });
  });
}

export const asToggle = defineAsHook({ name: 'as-toggle', setup: setupToggle });
export default definePrototype({ name: 'base-toggle', setup: setupToggle });
```

This is a reduced example of the shared setup pattern used by the official Base Toggle. Production behavior also declares controlled Props, focus behavior, accessibility, and transient interaction State.

## Public entry points

| Package | API | Role |
| --- | --- | --- |
| `@proto.ui/core` | `definePrototype` | Create a normal Prototype definition |
| `@proto.ui/core` | `defineAsHook` | Create a special composable prototype form with a structured result |
| `@proto.ui/core` | `moduleDeclaration` / `declareModule` | Identify and declare semantic Module capabilities |
| `@proto.ui/core` | `createAnatomyFamily` | Create a stable, static Anatomy family token whose canonical spec includes a root role |
| `@proto.ui/hooks` | `asBoundary`, `asCollection`, `asCollectionItem`, `asFocusable`, `asFocusEntry`, `asFocusRoving`, `asFocusScope`, `asHitParticipation`, `asTextControl`, `asOverlay`, `asScrollSurface`, `asTrigger` | Official privileged semantic hooks used during setup |

The hooks package is a semantic authoring surface, not a collection of React-style state hooks. Call these hooks from a Prototype setup frame.

## Handles by phase

### `DefHandle`: declare during setup

`DefHandle` exposes the declaration families for lifecycle, Props, Feedback, Expose, Rule, Event, State, Context, Anatomy, and accessibility. Declarations establish identity and wiring; they should not be used as an escape hatch into a host framework.

### Renderer handle: describe one root

When setup returns a renderer, the renderer builds portable template children for one Root Node. Prototype-level component composition is deliberately outside this language; see [Template](/en/specifications/template/) and `K-PROTOTYPE-COMPOSITION-0001`.

### `RunHandle`: act inside callbacks

Registered callbacks receive `run`, which supplies the callback-time surfaces: current Props reads, Context reads and updates, allowed lifecycle/presence operations, Expose event emission, Feedback patches, and Anatomy queries. Phase guards are part of the contract; do not retain a callback handle and use it from arbitrary code later.

## Composition and external surface

`asHook` composes semantic behavior inside the current setup frame. Its returned State handles use the State declaration's stable name; nested asHooks remain structured children rather than being flattened into the parent result. Exposed names are App Maker-facing output and do not redefine internal State identity.

Compound prototypes share an Anatomy family created with `createAnatomyFamily`, claim root and part roles, and let the host assemble the concrete part structure. A stable family is identified by its token reference, not by its diagnostic `debugName`.

## Boundaries to keep visible

- API presence is not lifecycle stability; check the related `C-*`, `D-*`, and `P-*` entities.
- Templates do not embed other Prototype definitions.
- Portable authoring APIs do not grant raw React, Vue, or Custom Element access.
- A missing API or catalog relation is not automatically a prohibition; it may be an uncataloged gap.
- State, Props, Expose, and Context have distinct ownership and phase rules. Follow their focused specifications rather than treating them as interchangeable storage.

Continue to [Core](/en/specifications/core/) for the protocol model, [asHook](/en/specifications/as-hook/) for composition semantics, or [Compatibility](/en/reference/compatibility/) for the reviewed Adapter surface.
