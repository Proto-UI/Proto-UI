---
title: 'Core'
desp: 'Portable protocol boundaries and the shared authoring model'
description: 'Portable protocol boundaries and the shared authoring model'
---

Core describes the portable boundary shared by prototypes, semantic Modules, Runtime, and Adapters. It is a map of the cataloged contracts—not a substitute for the individual capability specifications.

> **Lifecycle note:** the current `C-CORE-*` entities are `draft` since 0.1.0. They describe the cataloged direction implemented by the project, but are not yet an `active` stable guarantee.

## Portable semantics, host translation

A Prototype is a protocol actor. It declares semantic information channels without owning React components, Vue components, Custom Elements, or a particular rendering engine. Modules add reusable semantic capabilities. Host capabilities describe what an environment must supply or receive. An Adapter translates between those portable declarations and one host surface.

This split produces two responsibilities:

- Prototype and Module authors preserve channel meaning, execution phase, and cross-Adapter semantics.
- Adapter authors translate those semantics without reinterpreting them, while keeping host-only mechanics at the boundary.

Current official Adapter profiles all target the Web; see [Compatibility](/en/reference/compatibility/) for the exact reviewed slice.

## Three authoring surfaces

The Core syntax separates work by execution time:

| Surface | Handle | Responsibility |
| --- | --- | --- |
| Setup | `def` | Declare props, state, events, lifecycle callbacks, exposure, anatomy, a11y, and other semantic structure |
| Render | renderer handle | Produce `TemplateChildren` for one Root Node |
| Callback | `run` | Read current inputs, update allowed runtime surfaces, emit exposed events, and query anatomy |

A definition object has a stable `name` and a `setup(def)` function. Setup may return a renderer or return nothing. Callbacks registered during setup receive `run`; phase-restricted operations must not leak into setup or render work.

Read the focused specifications for the exact rules: [Lifecycle](/en/specifications/lifecycle/), [Template](/en/specifications/template/), [Props](/en/specifications/props/), [Event](/en/specifications/event/), [Expose](/en/specifications/expose/), [State](/en/specifications/state/), [Context](/en/specifications/context/), [Anatomy](/en/specifications/anatomy/), [Feedback](/en/specifications/feedback/), [asHook](/en/specifications/as-hook/), and [Rule](/en/specifications/rule/).

## Information channels

`K-COMPONENT-ACTOR-0001` and `K-INFORMATION-CHANNEL-0001` provide the current conceptual model: a component actor exchanges information through declared channels rather than by reaching into a host implementation. Different channels have different ownership and timing—for example, Props ingress is not interchangeable with Expose egress, and owned State is not an arbitrary external store.

The channel model is why an operation can be syntactically available yet invalid in the current phase. It is also why Adapters may differ mechanically while preserving the same observable protocol meaning.

## Composition boundary

The template language describes structure **inside one Root Node**. It does not compose one Prototype by embedding another Prototype in a template (`K-PROTOTYPE-COMPOSITION-0001`). Semantic reuse instead happens through Modules and the special `asHook` prototype form. Compound structures use shared Anatomy families and host-side part assembly.

This boundary keeps host ownership explicit and prevents a framework-specific component tree from becoming portable protocol syntax.

## How to interpret gaps

- A `draft` entity is usable as current formal direction, but must be labeled as draft.
- An uncataloged behavior is not automatically forbidden or guaranteed.
- A source path or passing test is evidence, not an amendment to a conflicting entity.
- Open questions remain explicit gaps until the catalog resolves them.

For API-shaped examples of these surfaces, continue to [Prototype API](/en/reference/prototype-api/). For catalog authority and lifecycle, read [How to Read Specs](/en/specifications/introduction/).
