---
title: 'Implementing a Governed Base Semantic Slice'
description: 'Turn a governed or explicitly draft Base P/T boundary into a minimal, coherent, executable vertical slice.'
---

Implementing a Base Prototype is normally an advanced contribution. Existing governed subjects proceed from their current protocol graph. A genuinely new subject may accumulate research, a candidate graph, draft entities, implementation probes, and executable evidence before admission; the one unresolved semantic decision is whether Proto UI admits that independent subject as a Base identity.

## Admission and governed direction

Before presenting a genuinely new Base identity as governed, record the admission decision that its independent protocol subject belongs in Base. Candidate work can and should make the following explicit before or after that decision as evidence evolves:

- the independent protocol subject and Base-admission conclusion;
- input facts, owners, observable outputs, and synchronization rules;
- the negative boundary;
- Root, Part, and anatomy identities;
- exact props, states, events, methods, and absence assertions;
- the P entity, T entity, and executable-evidence plan;
- required Module, Host Capability, and cross-Adapter evidence; and
- later design-language projections and compositions that remain out of scope.

A directory name, draft code, informal consensus, or reference component library is not Base-admission evidence by itself. An unresolved admission marker keeps the identity candidate/draft; it does not block research, graph authoring, implementation probes, or tests. Once an identity is governed, implementation and projection continue by default through independent review.

## Base-admission check

A governed or candidate slice should demonstrate:

1. **Independent subject**: it does not exist for styled-library inheritance or package symmetry.
2. **Explicit information path**: each core guarantee has an input fact, owner, output, and rule.
3. **Cross-host stability**: protocol meaning does not depend on React, Vue, or a DOM trick.
4. **Distinct responsibility**: existing Base protocols or composition cannot express it without loss.
5. **Negative boundary**: visual, business, focus, layout, form, and announcement responsibilities that it does not own are explicit.
6. **Executable evidence**: every retained criterion maps to a substantive T case and real test.

If implementation reveals that one of these cannot hold, revise the candidate or governed graph and record the evidence instead of forcing the code through an empty `asHook`, host escape hatch, or special-case branch. Escalate only if the evidence changes the Base-identity admission conclusion.

## Implementation workflow

### 1. Turn criteria into a delivery map

For each P criterion, list:

- owner;
- allowed inputs;
- observable output;
- controlled/uncontrolled or lifecycle rule;
- negative assertion;
- T case;
- implementation path; and
- required Adapter or host profile.

This mapping is the review spine. File count is not a completion measure.

### 2. Implement the smallest owner

- Only the declared owner holds state.
- Parts consume ownership through context, relationships, or existing shared capabilities.
- Keep styled variants, host raw objects, and future composition out of Base.
- When direct Prototype and authored `asHook` describe one protocol, share implementation rather than fork behavior.
- Respect existing setup, runtime, view-epoch, and terminal-disposal boundaries.

### 3. Build P/T and focused evidence

- Make P criteria individually addressable.
- Anchor T cases to exact criteria.
- Verify results and absence assertions in executable tests.
- Controlled requests must not silently mutate final state.
- Cover disabled, empty, duplicate, structural-churn, teardown, and other declared boundaries.
- Tests across the three Web Adapters prove one Web host profile, not general multi-host conformance.

### 4. Complete package and consumer surfaces

Every new public Base identity or anatomy family must appear on a reachable website page in the same pull request. The governing criteria and evidence determine which states the page demonstrates; the preview surface remains part of delivery. Record the local preview route in the pull request.

The complete consumer surface includes:

- family source, shared types, and public subpath;
- exact root exports;
- CLI registry and facade generation;
- Base docs, API notes, and a real demo;
- Web Component, React, and Vue previews; and
- spec workspace and Agent projections.

Keep later Shadcn, Brutalist, or other design-language projections in separate contributions.

#### Use the website demo as real consumption evidence

The demo should consume Base through a public package subpath and prefer Base's own anatomy, triggers, state, events, and defaults for visible interaction. It must not rely on page control logic that consumers do not receive with the package to simulate autonomous behavior.

For example, a Dialog demo should use `dialog-trigger` to request Root open. Calling a Dialog expose from an unrelated Button callback bypasses the cataloged anatomy information path. Minimal external orchestration is allowed only when Base has no natural trigger by design, or when public controls are themselves the protocol under demonstration. Toast-style invocation and direct Transition control are typical exceptions.

Keep any exception outside the Prototype, use public APIs only, and explain its necessity and the consumer-owned portion in the demo source and pull request. It must not hide missing anatomy, misplaced ownership, uncataloged capability, or Adapter drift. The internal Demo Matrix may add three-Adapter evidence but cannot replace the website page.

### 5. Keep design gaps in the implementation loop

Treat these findings as inputs to the next graph, implementation, evidence, and fresh-review iteration:

- a criterion has no unique owner;
- implementation needs public API absent from the current graph;
- existing Module or Host Capability slices cannot carry required behavior;
- the three Adapters expose different protocol semantics;
- implementation needs a raw host event, target, or object escape hatch;
- the negative boundary prevents the intended behavior; or
- applicable entities genuinely contradict one another.

Update the exact criterion, implementation evidence, and alternatives instead of silently widening source alone. The only semantic decision to escalate is admission of a genuinely new independent Base identity, or evidence that invalidates an earlier admission conclusion. Keep that identity draft while unresolved; all other reversible remediation continues through independent review.

## Pull-request organization

A reviewer should be able to follow:

```text
governed identity or candidate draft
→ P criteria and relations
→ T cases and executable paths
→ owner implementation
→ focused Base tests
→ required Adapter evidence
→ exports, CLI, docs, and demo
```

Stacked or draft pull requests may help review a large slice, but do not separately merge half of a public guarantee when that would create known spec drift. Every merged unit must be independently coherent and valuable.

## Validation

Run issue-specific focused tests first, then at least:

```sh
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 workspace:generate
corepack pnpm@10.32.1 check:agent-doc
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
corepack pnpm@10.32.1 docs:build
```

Changes to the public package graph also require package manifest, build, budget, and relevant consumer smoke checks. Record what was run, what was not applicable, and all remaining uncertainty.

## Final check

- Public API changes are explicit in the governed or candidate graph rather than introduced by implementation analogy.
- No empty Base identity was created for a styled-library need.
- A single Web Adapter fact was not promoted into cross-host semantics.
- P criteria, T evidence, implementation, and public projections agree.
- Later styled projections and compositions can proceed as separate coherent contributions.
- DCO, provenance, and material AI-assistance disclosure are complete.
