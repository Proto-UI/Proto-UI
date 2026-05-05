---
title: 'How to Contribute'
description: 'Contribution paths, entry points, and practical advice for the current phase of Proto UI'
---

## What this page covers

This page is for anyone who wants to contribute to the Proto UI ecosystem.

It doesn't replace the repository's development docs or the whitepaper's theoretical depth. It answers the more immediate questions:

- What kinds of contributions does Proto UI need most right now?
- Which path fits me best?
- What should I understand before contributing?
- What's the simplest way to preview my work?
- What makes a contribution easier to review and maintain?

If you're unsure whether contributing is right for you, reading this page is usually enough.

---

## What does Proto UI need most right now?

Proto UI is still in its early phase. The priority isn't "everything at once" — it's getting the core paths working well.

The most valuable contributions right now tend to fall into these directions:

- **Prototype**
  - Expanding the official prototype library
  - Adding interaction capabilities for common components
  - Improving prototype fidelity and reusability

- **Adapter**
  - Building host integration for new platforms
  - Improving how existing hosts fulfill prototype contracts
  - Raising consistency and fidelity across hosts

- **Contracts / Tests**
  - Adding contract constraints for existing capabilities
  - Making prototypes and adapters more verifiable
  - Building a more stable foundation for "officially supported quality"

- **Docs / Demo**
  - Helping others understand Proto UI faster
  - Lowering the barrier for new contributors
  - Showing existing capabilities more clearly

- **Community / Curation**
  - Organizing questions and discussions
  - Distilling consensus and indices
  - Helping new contributors find their way in

For most first-time contributors, **prototypes, docs, and tests** are often easier entry points. **Adapters** lean toward deeper waters, but are equally critical.

---

## What to read before contributing

You don't need to memorize the entire whitepaper, but a minimal mental model helps a lot.

At minimum, we suggest reading:

- [Start Here / What You Just Saw](/en/start-here/what-you-saw/)
- [Start Here / How It Works](/en/start-here/how-it-works/)

- [Whitepaper / Component as Protocol](/en/whitepaper/component-as-protocol/)
- [Whitepaper / Information Flow Model](/en/whitepaper/information-flow-model/)
- [Whitepaper / Prototype Boundary](/en/whitepaper/prototype-boundary/)
- [Whitepaper / Execution Semantics](/en/whitepaper/execution-semantics/)

If you're planning to write an adapter, also read:

- [Whitepaper / Translation Layer](/en/whitepaper/translation-layer/)
- [Whitepaper / Design Constraints](/en/whitepaper/design-constraints/)

This isn't about raising the bar — it's about avoiding the frustration of realizing your work and Proto UI's boundary model were never aligned to begin with.

---

## Contribution paths

Proto UI's ecosystem isn't a single track. Different types of contributions solve problems at different layers.

### Prototype

This path is about:

> **How a component should interact.**

The Prototype direction cares about the interaction semantics of a component:

- How state flows
- How events enter
- How feedback expresses itself
- How prototype boundaries should be drawn
- Which capabilities belong in the official prototype library

If your background is closer to:

- Component library development
- Design systems
- Headless components
- Interaction design implementation
- Accessibility improvements

Then Prototype is often the more natural entry point.

Good starting points include:

- Adding a specific interaction capability to an existing prototype
- Creating a new, well-scoped base prototype
- Improving state / feedback expression for an existing prototype
- Raising prototype fidelity across more scenarios

**Relevant guides and templates:**

- [Writing A Custom Primitive Prototype](/zh-cn/build/prototypes/writing-a-custom-primitive-prototype/) (Chinese — English version in progress)
- [Writing A Compound Prototype](/zh-cn/build/prototypes/writing-a-compound-prototype/) (Chinese)
- [Prototype Author Checklist](/zh-cn/build/prototypes/checklist/) (Chinese)
- [Prototype Proposal Template](https://github.com/Proto-UI/Proto-UI/issues/new?template=prototype-proposal.md)
- [Good First Issues: Prototype](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aprototype)

---

### Adapter

This path is about:

> **How prototypes land in a specific host.**

The Adapter direction typically deals with:

- How prototype contracts map to a given host
- How to fill gaps in host capabilities
- Which feedback and interactions can be carried directly
- Which parts need host-specific handling
- How the final artifact feels native to that host

If you're more familiar with a specific host, for example:

- React
- Vue
- Web Components
- Flutter
- Qt
- Platform-native UI technologies

And you tend to work on:

- Framework internals
- Rendering models
- Event systems
- State and ref management
- Platform constraints and performance

Then Adapter is likely a better fit.

Good starting points include:

- Filling in a contract-adherence gap for an existing host
- Improving host-side fidelity for an existing prototype
- Building a minimal working adapter for a new host
- Adding a capability-fallback strategy for a host

**Relevant guides and templates:**

- [Adapter Guide](/en/build/adapter-guide/) (in progress — see Chinese version [here](/zh-cn/build/adapter-guide/))
- [Adapter Proposal Template](https://github.com/Proto-UI/Proto-UI/issues/new?template=adapter-proposal.md)
- [Good First Issues: Adapter](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aadapter)

Adapter work is deeper water than Prototype, but it's also critical — whether Proto UI can be used in real projects depends on the translation layer being reliable.

---

### Contracts / Tests

This path is about:

> **What does it mean to "really support" a capability.**

In Proto UI, contracts and tests aren't just quality supplements. They directly determine:

- Whether a prototype is clearly defined
- Whether an adapter truly fulfills a prototype contract
- Whether "officially supported quality" has a clear boundary
- How community and official implementations form a verifiable relationship

If you care more about:

- Whether semantic boundaries are clear
- Whether behavior is stably verified
- Whether contracts and implementations are consistent
- Whether a capability is genuinely "established" rather than "looks about right"

Then this path fits you well.

Good starting points include:

- Adding contract tests for existing capabilities
- Writing minimal verification for semantics already documented
- Spotting "inconsistent but unconstrained" spots in existing prototypes / adapters
- Distilling existing consensus into verifiable contracts

**Relevant guides and templates:**

- [Contracts & Tests](/en/build/contracts-and-tests/) (in progress — see Chinese version [here](/zh-cn/build/contracts-and-tests/))
- [Good First Issues: automation](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Aautomation)

---

### Docs / Demo

This path is about:

> **Whether others can understand Proto UI.**

Proto UI currently carries non-trivial theoretical density. Docs, examples, and demos directly affect:

- Whether new users can understand quickly
- Whether new contributors know where to start
- Whether prototypes and adapters are clearly demonstrated
- Whether discussions can build on a shared minimal understanding

If you're better at:

- Explaining complex things clearly
- Turning theory into readable docs
- Turning abstract concepts into examples, diagrams, or demos
- Spotting "where someone will get confused"

Then Docs / Demo is a great entry point.

Good starting points include:

- Revising existing docs to smooth the entry path
- Adding minimal examples for a prototype
- Turning an abstract concept into an approachable demo
- Writing FAQs, reading guides, or contribution-entry docs

**Relevant guides and templates:**

- [Docs Request Template](https://github.com/Proto-UI/Proto-UI/issues/new?template=docs-request.md)
- [Good First Issues: docs](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Adocs)

---

### Community / Curation

This path is about:

> **Catching and organizing the ecosystem's questions, feedback, and consensus.**

Proto UI's growth isn't only from code. It also comes from:

- Whether questions are organized
- Whether recurring discussions are distilled
- Whether community prototypes / adapters are visible
- Whether newcomers get consistent responses

If you're better at:

- Summarizing problems
- Organizing discussions
- Maintaining issues / discussions
- Helping others articulate their ideas
- Connecting contributors across different directions

Then this path is a strong fit.

Good starting points include:

- Cataloging recurring questions
- Helping maintain the FAQ or discussion index
- Distilling scattered discussions into citable conclusions
- Helping new contributors find the right entry point for them

**Relevant resources:**

- [Good First Issues: community](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Acommunity)
- [GitHub Discussions](https://github.com/Proto-UI/Proto-UI/discussions)

---

## Not sure which path fits you?

A simple way to tell is to notice which kind of question you naturally ask.

If you more often ask:

- "How should this component interact?"
  - Closer to Prototype

- "How does this host implement it?"
  - Closer to Adapter

- "Is this behavior clearly defined and verified?"
  - Closer to Contracts / Tests

- "Can others understand this?"
  - Closer to Docs / Demo

- "Have these discussions been organized?"
  - Closer to Community / Curation

If you're still unsure, the most stable approach is usually:

> Start with docs, a small prototype, or a clear small test.

These entry points carry the lowest risk and tend to get feedback fastest.

---

## Suggested progression for first-time contributors

For someone contributing for the first time, the most reliable approach isn't to write a complete system up front, but rather:

1. **Pick up a clearly scoped, small issue first**
2. **Confirm the boundary in Discussions or the issue thread**
3. **Then start implementing**
4. **Submit the smallest reviewable result, rather than one massive change**

Proto UI's theory and engineering are both still converging. The sooner you align on boundaries, the less rework later.

### Picking up a Good First Issue

We maintain a set of [Good First Issues](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22) that are scoped for new contributors. These issues include clear acceptance criteria, references, and explicit out-of-scope notes so you know what's expected before you start.

If you find one you'd like to work on, comment on the issue to let maintainers know. If the scope or approach isn't clear, ask in the issue thread — clarifying the boundary before writing code saves everyone time.

---

## Simplest preview path right now

Since adapter and prototype development doesn't yet have dedicated debugging tooling, the most direct preview path is:

> **Wire them into the docs site and preview there.**

This is the recommended approach in the current phase. The reasons:

- The docs site is already Proto UI's main showcase and verification entry point
- It's naturally suited for comparing behavior across hosts
- New prototypes / adapters can be observed and discussed in an environment close to their real display context

Proto UI provides ways to wire new adapters and prototypes into the docs site. So for many contributions, the shortest feedback loop right now is:

1. Write a minimal working prototype / adapter
2. Wire it into the docs site
3. Preview and adjust directly in the docs site
4. Then continue with docs, contracts, or tests

Until dedicated debugging tooling matures, this is the most realistic path.

---

## What makes a contribution more likely to be accepted

Proto UI is currently most able to accept contributions of these kinds:

### 1. Clear boundaries

The contributions easiest to maintain long-term are often not the ones that "do a lot," but the ones that solve a single, clearly bounded problem.

For example:

- Adding a specific interaction capability to an existing prototype
- Filling in a specific contract-adherence gap for an existing host
- Filling in a clearly missing entry point in the docs

By contrast, submissions that "refactor many layers at once along the way" are harder to review in the current phase and harder to merge stably.

### 2. Previewable on the docs site

One of the most valuable things a contribution can do right now is land on the docs site for preview and discussion.

For prototypes and adapters especially, whether they can quickly appear on the docs site often directly determines whether others can understand what problem the contribution actually solves.

### 3. Comes with minimal documentation

Even for a small contribution, it helps to at least describe:

- What problem it solves
- Which layer it belongs to (prototype / adapter / contracts / docs)
- Why the approach aligns with Proto UI's current boundary model

This dramatically reduces communication overhead.

### 4. Open to iteration

Proto UI is not a system where all the rules are fully frozen yet. Many contributions, even when directionally correct, may still need adjustments.

This isn't a judgment on the contribution itself — it's because the ecosystem, boundaries, and engineering constraints are still converging.

---

## What to discuss before building

These situations are usually better discussed first:

- You're planning to add a new host adapter
- You're planning to extend the prototype DSL
- You're planning to change existing contract-layer boundaries
- You're planning to introduce a new core capability dimension
- You're planning a large-scale refactor

These aren't off-limits — they just affect the mainline direction more than a typical contribution. Discussing first is far easier than explaining after writing everything.

---

## Relationship between community contributions and official maintenance

Proto UI welcomes community prototypes and community adapters. Official doesn't intend to monopolize the writing of prototypes or adapters.

What official aims to do:

- Maintain a relatively neutral, stable public infrastructure
- Provide at least one official integration path for key hosts
- Establish higher quality guarantees for mature prototypes and adapters

What this means:

- Community can move faster and more vertically
- Official emphasizes boundaries, stability, and long-term consistency

These aren't competing — they're different roles within the same ecosystem.

---

## Where to start

A reliable starting point is:

- Read [Build / Overview](/en/build/)
- Then based on your interest, choose:
  - [Runtime Architecture](/en/build/runtime-architecture/) (in progress)
  - [Adapter Guide](/en/build/adapter-guide/) (in progress)
  - [Contracts & Tests](/en/build/contracts-and-tests/) (in progress)

If you're still unsure where to begin, starting from a small issue, a small prototype, or a doc revision is often the better way.

Browse open [Good First Issues](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22) to find a scoped task that matches your interests.

---

## Still have questions?

This page covers "how to enter." More detailed processes, conventions, and repo collaboration specifics live in the corresponding development docs within the repository.

If you still have questions about contribution direction, boundary decisions, or current priorities, feel free to ask in [GitHub Discussions](https://github.com/Proto-UI/Proto-UI/discussions) or the community channels. Many questions become much easier once the direction is aligned — the earlier, the better.
