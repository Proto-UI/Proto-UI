---
title: 'Writing a Custom Primitive Prototype'
description: 'Learn the minimal structure of a single-part Prototype, the def/run split, and when to provide an asHook.'
---

A primitive (single-part) Prototype models one self-contained interaction subject—such as `Button` or `Toggle`—with a clear input-to-output boundary.

This guide focuses on code structure and authoring patterns. Existing Base subjects build directly on their `P-*` and `T-*` specs; brand-new subjects can start as `draft` candidates with implementation probes and tests before following [Implementing a Governed Base Semantic Slice](/en/build/prototypes/implementing-an-approved-base-slice/) through full delivery.

## Start from specs and tests

Before writing code, read the spec and existing tests to build an accurate mental model. For Button, read in this order:

1. `P-BASE-BUTTON` lifecycle, criteria, relations, and sources;
2. `T-BASE-BUTTON-0001` test cases and executable mappings;
3. [packages/prototypes/base/src/button/button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.proto.ts);
4. `packages/prototypes/base/test/as-button.test.ts` and adapter tests; and
5. package exports, CLI registration, docs, and demos.

`P-BASE-BUTTON` is currently `draft`; treat the spec entity as the design source of truth and align implementation to it.

## Anatomy of `base-button`

Button exposes two authoring entries for one shared protocol:

- `base-button`: the direct Prototype entry; and
- `asButton`: the `asHook` entry reused by styled button variants.

Both delegate to a shared `setupButton(def)` helper so Button semantics live in one place (as defined in `P-BASE-BUTTON-AUTHORING-ENTRIES`). Treat this as a pattern to apply when needed, rather than a mandatory template for every Prototype.

Key building blocks inside `setupButton(def)`:

- `def.props.define()` to declare input props such as `disabled`;
- `def.state.bool()` to declare interaction states (`disabled`, `hovered`, `pressed`);
- `asFocusable()` to compose focus handling (`focused`, `focusVisible`, focus method);
- `def.event.on()` to subscribe to pointer routes and `press.commit`;
- `def.expose.state()`, `def.expose.method()`, and `def.expose.event()` to define the public surface; and
- `asAccessible()` to declare role, accessible name, state, and actions.

## The `def` vs. `run` boundary

Proto UI separates **setup-time declaration** (`def`) from **runtime execution** (`run`):

- `def` declares the static blueprint inside `setup`: props, state, events, exposes, accessibility, style rules, and lifecycle hooks.
- `run` is passed into runtime callbacks to read current props or context, inspect state, and trigger outward effects.

```ts
def.event.on('press.commit', (run) => {
  if (disabled.get()) return;
  run.expose.emit('click');
});
```

Here, the `press.commit` handler is wired up during setup, and the outward `click` event is emitted via `run` when the interaction fires.

## When to provide an `asHook`

Exporting a direct Prototype without an `asHook` is completely valid. Add an `asHook` when:

- the applicable `P-*` entity lists both direct and `asHook` forms for the same protocol;
- both entries share one protocol surface and implementation;
- the hook serves only its owning protocol (rather than acting as generic glue for unrelated Base protocols); and
- any configuration options stay within a clearly specified contract.

Per `D-PROTOTYPE-ENTITY-NAMING-0001`, multiple entries for one protocol live under the same `P-*` entity. Per `D-AS-HOOK-CONFIGURABLE-AUTHORED-0001`, configurable authored `asHook`s should only be introduced with an explicit contract.

## End-to-end delivery checklist

A complete single-part slice connects specs, code, tooling, and docs:

```text
Spec entity (admitted or draft candidate)
→ P-* criteria and relations
→ T-* cases and executable tests
→ Implementation and public exports
→ CLI facade generation
→ Bilingual docs and real public-package demo
→ Web Component, React, and Vue previews
```

## Handling boundary changes

If implementation uncovers the need for a new public prop/event/state, a different state owner, a host escape hatch, or a conflict with the spec, update the spec entities, tests, and docs together in the same reviewable change. If a genuinely new Base identity is needed, keep it marked `draft` while admission is decided.

## Next steps

- Model a multi-part family: [Writing a Compound Prototype](/en/build/prototypes/writing-a-compound-prototype/)
- Layer a design language onto Base: [Building a Styled Library on Top of Base](/en/build/prototypes/building-a-styled-library-on-top-of-base/)
- Review before opening a PR: [Prototype Author Checklist](/en/build/prototypes/checklist/)
