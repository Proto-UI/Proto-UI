---
title: 'How to Contribute'
description: 'Contribution paths, entry points, and practical advice for the current phase of Proto UI'
---

## Start here

If you're new to Proto UI, the simplest first step is to browse [Good First Issues](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22) — they're scoped with clear acceptance criteria. Comment on the issue before starting. If the scope or approach isn't clear, ask in [GitHub Discussions](https://github.com/Proto-UI/Proto-UI/discussions).

## Choose a path

### Prototype

This path is about **how a component should interact** — state flow, events, feedback, and interaction semantics.

**Best for:** component library developers, design system engineers, headless component authors, accessibility specialists

**Typical tasks:**

- Adding a specific interaction capability to an existing prototype
- Creating a new, well-scoped base prototype
- Improving state / feedback expression for an existing prototype

**Start here:**

- [Prototype Proposal Template](https://github.com/Proto-UI/Proto-UI/issues/new?template=prototype-proposal.md)
- [Good First Issues: prototype](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aprototype)
- [Writing A Custom Primitive Prototype](/zh-cn/build/prototypes/writing-a-custom-primitive-prototype/) (Chinese — English version in progress)
- [Prototype Author Checklist](/zh-cn/build/prototypes/checklist/) (Chinese)

**Before opening a PR:** describe the interaction behavior, explain the prototype boundary if relevant, and include preview / tests when possible.

---

### Adapter

This path is about **how prototypes land in a specific host** — contract mapping, capability gaps, and host-native fidelity.

**Best for:** framework maintainers, platform engineers, anyone deeply familiar with React, Vue, Web Components, Flutter, Qt, or native UI technologies

**Typical tasks:**

- Filling in a contract-adherence gap for an existing host
- Improving host-side fidelity for an existing prototype
- Building a minimal working adapter for a new host

**Start here:**

- [Adapter Proposal Template](https://github.com/Proto-UI/Proto-UI/issues/new?template=adapter-proposal.md)
- [Good First Issues: adapter](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aadapter)
- [Adapter Guide](/en/build/adapter-guide/) (in progress — see Chinese version [here](/zh-cn/build/adapter-guide/))

**Before opening a PR:** confirm the host capability mapping, explain fallback strategies if any, and test across host scenarios.

---

### Contracts / Tests

This path is about **what it means to "really support" a capability** — verifying that prototypes are clearly defined and adapters truly fulfill their contracts.

**Best for:** engineers who care about semantic boundaries, behavior verification, and contract consistency

**Typical tasks:**

- Adding contract tests for existing capabilities
- Writing minimal verification for documented semantics
- Spotting and constraining inconsistent behavior in prototypes or adapters

**Start here:**

- [Contracts & Tests](/en/build/contracts-and-tests/) (in progress — see Chinese version [here](/zh-cn/build/contracts-and-tests/))
- [Good First Issues: automation](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aautomation)

**Before opening a PR:** describe what the contract verifies, why the boundary is drawn there, and include tests that fail before the change passes.

---

### Docs / Demo

This path is about **whether others can understand Proto UI** — lowering the barrier for new users and contributors.

**Best for:** technical writers, educators, anyone who can turn abstract concepts into clear docs, examples, diagrams, or demos

**Typical tasks:**

- Revising existing docs to smooth the entry path
- Adding minimal examples for a prototype
- Turning an abstract concept into an approachable demo

**Start here:**

- [Docs Request Template](https://github.com/Proto-UI/Proto-UI/issues/new?template=docs-request.md)
- [Good First Issues: docs](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Adocs)

**Before opening a PR:** explain what confusion or gap the change addresses, and verify the page renders correctly in the docs site.

---

### Community / Curation

This path is about **organizing questions, discussions, and consensus** — helping the ecosystem stay navigable and newcomers get consistent responses.

**Best for:** community organizers, people who summarize discussions, maintain issue indices, or help others articulate ideas

**Typical tasks:**

- Cataloging recurring questions
- Maintaining FAQ or discussion indices
- Distilling scattered discussions into citable conclusions
- Helping new contributors find their entry point

**Start here:**

- [Good First Issues: community](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Acommunity)
- [GitHub Discussions](https://github.com/Proto-UI/Proto-UI/discussions)

**Before opening a PR:** summarize the pattern or consensus being captured, and link to the source discussions.

---

## First-time contributor workflow

1. Pick a small, clearly scoped [Good First Issue](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22)
2. Comment on the issue before starting
3. Confirm the boundary in the issue thread or [Discussions](https://github.com/Proto-UI/Proto-UI/discussions) if unclear
4. Keep the PR small — the smallest reviewable result, not one massive change
5. Explain what changed and why in the PR description

For prototypes and adapters, the simplest way to preview your work is to wire it into the docs site. Until dedicated debugging tooling matures, this is the most direct feedback loop.

---

## Discuss first for larger changes

These situations should be discussed before writing code:

- Adding a new host adapter
- Extending the prototype DSL
- Changing existing contract-layer boundaries
- Introducing a new core capability dimension
- Large-scale refactors

These aren't off-limits — they just affect the mainline direction more than typical contributions. Discussing first is far easier than explaining after writing everything.

---

## Proposal acceptance

Submitting a proposal does not guarantee acceptance. Maintainers evaluate proposals based on current priorities, boundary fit, and long-term ecosystem consistency. If you're unsure whether an idea fits, start a [Discussion](https://github.com/Proto-UI/Proto-UI/discussions) before opening a formal proposal.
