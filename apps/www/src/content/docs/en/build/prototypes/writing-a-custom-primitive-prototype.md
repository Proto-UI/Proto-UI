---
title: 'Writing a Custom Primitive Prototype'
description: 'Understand the minimal shape of direct and authored-asHook entries inside an approved boundary.'
---

A leaf Prototype represents a protocol subject with a clear boundary and an independent information-flow responsibility. Button and Toggle are two relatively clear current examples.

> This guide explains authoring structure; it does not approve a new Base identity. Before implementing a new Base subject, complete a maintainer checkpoint and follow the delivery workflow in [Implementing an Approved Base Semantic Slice](/en/build/prototypes/implementing-an-approved-base-slice/).

## Start from entities and evidence

Do not begin by copying source. For Button, read in this order:

1. lifecycle, criteria, relations, and sources in `P-BASE-BUTTON`;
2. cases and executable mappings in `T-BASE-BUTTON-0001`;
3. [packages/prototypes/base/src/button/button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.proto.ts);
4. `packages/prototypes/base/test/as-button.test.ts` and applicable Adapter evidence; and
5. package exports, CLI, documentation, and demos.

`P-BASE-BUTTON` is currently `draft`. Source is implementation evidence, not authority above the applicable entity.

## What `base-button` demonstrates

Button has two official authoring entries:

- the `base-button` direct Prototype; and
- the `asButton` authored asHook.

They share `setupButton(def)` instead of maintaining two versions of Button semantics. That arrangement realizes `P-BASE-BUTTON-AUTHORING-ENTRIES`; it is not a fixed template that every Prototype must copy.

The current implementation includes:

- `def.props.define()` for `disabled`;
- `def.state.bool()` for states such as `disabled`, `hovered`, and `pressed`;
- `asFocusable()` for `focused`, `focusVisible`, and the focus method;
- `def.event.on()` for pointer routes and `press.commit`;
- `def.expose.state()`, `def.expose.method()`, and `def.expose.event()` for outward surfaces; and
- `def.a11y.*` for Button role, name, state, and action.

The former `def.state.fromInteraction()` example no longer describes the current Button implementation and must not be used as the example for this guide.

## The boundary between `def` and `run`

`def` declares the setup-time plan: props, state, events, exposes, accessibility, rules, and lifecycle hooks. `run` appears inside runtime callbacks and provides access to current props, context, lifecycle, and outward effects.

For example:

```ts
def.event.on('press.commit', (run) => {
  if (disabled.get()) return;
  run.expose.emit('click');
});
```

The event route is registered during setup; the outward signal is emitted through `run` when the event occurs.

## When to provide an authored asHook

Do not treat “exports a Prototype but no asHook” as a universal error. Ask:

- Does the applicable P catalog direct and authored-asHook forms as two entries of one protocol?
- Should both entries share the complete protocol surface and implementation?
- Does the hook serve only its owning protocol rather than becoming cross-Prototype substrate?
- Would the entry introduce ungoverned options, merge, or configure semantics?

`D-PROTOTYPE-ENTITY-NAMING-0001` requires existing entries for one protocol to be cataloged in the same P entity; it does not require every direct Prototype to generate an asHook. `D-AS-HOOK-CONFIGURABLE-AUTHORED-0001` also keeps ordinary configurable authored asHooks in governed future design space.

## What completes a leaf slice

A source file is only one part of delivery. An approved new leaf Prototype normally needs:

```text
approved checkpoint
→ P criteria and relations
→ T cases and executable tests
→ implementation and public exports
→ CLI facade generation
→ bilingual docs and real public-package demo
→ applicable WC / React / Vue evidence
```

The three current Adapter previews verify one Web host profile; they do not automatically prove multi-host conformance.

## When to pause

If implementation needs a new public prop/event/state, changes ownership, requires a raw host object, or exposes a contradiction between P/T and implementation, return to the issue for a checkpoint instead of widening the boundary in source.

## Next

- For a compound family, read [Writing a Compound Prototype](/en/build/prototypes/writing-a-compound-prototype/)
- For a design-language projection, read [Building a Styled Library on Top of Base](/en/build/prototypes/building-a-styled-library-on-top-of-base/)
- Before opening a pull request, use the [Prototype Author Checklist](/en/build/prototypes/checklist/)
