---
title: 'Implementing a Governed Base Semantic Slice'
description: 'Turn an admitted or draft Base P/T spec into a minimal, complete, and verifiable vertical slice.'
---

Implementing a Base Prototype is an advanced contribution focused on core interaction protocols. Existing Base subjects build directly on their `P-*` and `T-*` specs. For a brand-new Base identity, start in `draft` mode with research, candidate specs, implementation probes, and tests to make the admission decision concrete.

## Clarify the protocol model up front

Whether an identity is already admitted or still a `draft` candidate, make these details explicit as specs and code evolve:

- the independent protocol subject and its role in Base;
- input facts, state ownership, observable outputs, and synchronization rules;
- explicit negative boundaries (what stays outside this protocol);
- Root, Part, and `Anatomy` role identities;
- exact props, states, events, methods, and absence assertions;
- the `P-*` spec, `T-*` cases, and executable test plan;
- required Module, Host Capability, and cross-Adapter test scope; and
- downstream styled libraries and compositions left to separate PRs.

## Base admission self-check

A solid Base protocol slice satisfies six criteria:

1. **Independent subject**: It models a real interaction protocol, not just an inheritance hook for a styled library.
2. **Explicit information path**: Every core guarantee has a clear input, state owner, output, and rule.
3. **Cross-host stability**: Protocol semantics work cleanly without React-, Vue-, or DOM-specific tricks.
4. **Distinct responsibility**: Existing Base protocols or host-level composition cannot express it cleanly.
5. **Clear negative boundaries**: Styling, business logic, layout, forms, and announcements stay outside the protocol.
6. **Executable tests**: Every retained criterion maps to concrete `T-*` cases and automated tests.

If implementation shows that one of these criteria fails to hold, refine the spec and design rather than forcing it through an empty `asHook`, host escape hatch, or special-case branch.

## Implementation workflow

### 1. Map `P-*` criteria to a delivery checklist

For each `P-*` criterion, list:

- state owner;
- allowed inputs and edge values;
- observable output;
- controlled/uncontrolled and lifecycle rules;
- absence assertions (what must stay omitted);
- linked `T-*` case and test file path; and
- target Adapter and host verification scope.

Organizing review around criteria rather than file count keeps changes focused.

### 2. Implement the minimal owner first

- Keep interaction state inside the declared owner.
- Have collaborating parts read and interact through `Context`, Anatomy relations, or shared hooks.
- Keep styled variants, raw host objects, and app-level composition out of Base.
- Share one core setup implementation when a direct Prototype and an `asHook` express the same protocol.
- Respect `setup`, runtime update, and teardown cleanup boundaries.

### 3. Add `P-*`/`T-*` specs and focused tests

- Keep each `P-*` criterion individually addressable.
- Anchor `T-*` cases to exact criteria.
- Cover both positive behavior and explicit absence assertions.
- In controlled mode, user interactions emit change requests while the external controlled prop governs the final state.
- Test disabled states, empty/duplicate values, dynamic child changes, and teardown cleanup.
- Verify consistent behavior across the Web Component, React, and Vue Adapters.

### 4. Complete exports and website delivery

Every new public Base identity or compound family ships with a reachable website page and a local preview route in the same PR.

The complete consumer surface includes:

- family source, shared types, and public package subpath;
- root package exports;
- CLI registry entries and facade generation;
- bilingual Base docs, API reference, and a real public-package demo;
- Web Component, React, and Vue previews; and
- regenerated workspace and derived docs files via their generators.

Keep downstream Shadcn, Brutalist, or other styled implementations in separate PRs.

#### Keep the website demo faithful to real usage

Import Base from its public package subpath and drive interaction through its own anatomy, triggers, states, events, and defaults:

- Open a Dialog through `dialog-trigger` instead of invoking an exposed method from an unrelated button.
- Only add minimal external glue using public APIs when Base has no natural trigger by design (such as imperative Toast invocation) or when demonstrating imperative controls (such as Transition), and note in the demo source and PR what consumers need to wire up themselves.

### 5. Feed design gaps back into the spec loop

When implementation surfaces any of the following, update the spec, tests, and review packet together rather than quietly expanding code alone:

- a criterion lacks a clear single owner;
- implementation requires a new public API not yet in the spec;
- existing Modules or Host Capabilities cannot carry a required behavior;
- Adapters exhibit conflicting protocol semantics;
- implementation requires a raw host event or host object;
- a negative boundary conflicts with intended behavior; or
- two spec entities contradict each other.

If a finding introduces a brand-new Base identity, keep it marked `draft` while admission is decided.

## Structuring the pull request

Structure your changes and PR summary so reviewers can follow this path:

```text
Spec identity (admitted or draft candidate)
→ P-* criteria and relations
→ T-* cases and executable test paths
→ Core owner implementation
→ Focused Base unit tests
→ Required Adapter verification
→ Exports, CLI, docs, and demo
```

For large slices, you can split review across stacked PRs as long as every merged unit is self-contained and keeps specs, code, and docs in sync.

## Local checks

Run your focused tests first, then run:

```sh
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 workspace:generate
corepack pnpm@10.32.1 check:agent-doc
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
corepack pnpm@10.32.1 docs:build
```

If you changed public package exports or dependencies, run package manifest, build, and budget checks as well, and include the actual run results in your PR.

## Final checklist

- All public API changes are recorded in the spec entities.
- No empty Base identity was added solely for a styled library.
- Protocol semantics remain host-neutral.
- `P-*` criteria, `T-*` tests, implementation, and website docs agree.
- Downstream styled projections and compositions can build cleanly in follow-up PRs.
- DCO sign-off and provenance notes are complete.
