---
title: 'How to Contribute'
description: 'Choose work by contribution readiness and take a Proto UI change from local development to a reviewable pull request.'
---

Proto UI does not create a large starter queue by lowering its protocol or engineering standards. Instead, the project aims to make decided boundaries explicit so first-time contributors, experienced implementers, and core-design contributors can each find an appropriate entry point.

The repository [CONTRIBUTING.md](https://github.com/Proto-UI/Proto-UI/blob/main/CONTRIBUTING.md) is authoritative for environment setup, DCO, provenance, validation, and the pull-request workflow. This page helps you choose a path.

## Check contribution readiness first

Effort and readiness are different. A semantic boundary may be fully decided while its delivery surface remains large; a small code change may still depend on unresolved architecture.

### Starter

F1–F2 work with a fixed expected result and little Proto UI domain judgment, such as:

- fixing existing docs, demos, narrow-screen behavior, or dark mode;
- adding a bounded regression test for existing behavior;
- correcting an accessible name or preview entry; or
- improving an existing English or Chinese page.

Work genuinely suitable for a first pull request carries the [`good first issue`](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22good+first+issue%22) label. An empty list does not mean contributions are closed.

### Contributor-ready

The semantic boundary is decided, but implementation may still be F3–F5. Experienced component-library, design-system, and framework contributors can inspect [`help wanted`](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3A%22help+wanted%22) issues and confirm that the issue states:

- what is already decided;
- what the contributor may decide;
- what implementation must not change;
- whether implementation is authorized; and
- the required validation.

`help wanted` does not override `needs maintainer design`. Wait for a recorded maintainer checkpoint when both apply.

### Maintainer-guided

New Base subjects, Prototype admission, protocol ownership, and cross-layer architecture start as assessments or proposals. Do not open an implementation pull request until the issue records a maintainer checkpoint.

## Spec entities first

Before editing, find the applicable `P-*` entity and read its lifecycle, criteria, relations, sources, and `T-*` evidence.

The authority order is:

```text
applicable spec entity
→ internal contract for an uncataloged gap or explanation
→ relevant dated record for current context
→ implementation and tests as evidence
→ README and website as reader projections
```

Treat a mismatch as drift to investigate rather than assuming the current implementation silently amended the spec. See the [spec catalog guide](https://github.com/Proto-UI/Proto-UI/blob/main/spec/README.md) for entity authoring rules.

## Prototype paths available now

The current `P-*` catalog supports complete Prototype contribution paths.

### Maintain an existing Prototype

Fix existing behavior, add regression coverage, improve docs and demos, or reconcile drift among P/T entities, implementation, exports, and public pages.

[Read the existing Prototype maintenance guide](/en/build/prototypes/maintaining-an-existing-prototype/)

### Project Base into a design language

Add design-language props, tokens, rules, and visual anatomy on top of an existing Base protocol. Do not redefine value, event, focus, accessibility, or host-capability semantics already owned by Base. Every new public Prototype must also appear on a reachable website page where maintainers can interact with the real package export.

[Read the design-language projection guide](/en/build/prototypes/projecting-base-into-a-design-language/)

### Implement an approved Base semantic slice

This is advanced implementation work. The independent subject, information paths, negative boundary, public API, P/T graph, and validation scope must first pass a maintainer checkpoint. A complete slice includes a website page and the applicable Web Component, React, and Vue previews, not source and tests alone.

[Read the approved Base slice implementation guide](/en/build/prototypes/implementing-an-approved-base-slice/)

### Propose a new Base subject

A familiar component name, directory, or styled-library need does not establish a Base Prototype. A proposal must prove an independent, cross-host, testable protocol subject with an owned input-fact-to-observable-output path.

[Use the Prototype Proposal template](https://github.com/Proto-UI/Proto-UI/issues/new?template=prototype-proposal.md)

## Website preview is part of Prototype delivery

Every new public Prototype identity or anatomy family must appear on a reachable website page in the same pull request. That page must consume the real public package export and provide the applicable Web Component, React, and Vue previews. Record a local route that maintainers can open directly; the internal Demo Matrix does not replace this page.

A demo should approximate direct usage after package installation. An autonomous Prototype should work through its own anatomy, triggers, state, events, and defaults instead of gaining a page-level owner or callback merely to make the demonstration function. Minimal external control is allowed only when there is no natural trigger or when public controls are themselves under demonstration. The exception must use public APIs only and identify which orchestration is not installed with the package and must be recreated by consumers.

## The Adapter path is intentionally deferred

The Module, Host Capability, and official Adapter-profile catalog is still being completed, and related architecture and known drift are not fully reconciled. Proto UI therefore does not currently publish a general Adapter contribution guide or recommend adding an Adapter by analogy.

Experienced contributors may still work on a bounded Adapter parity bug when its issue identifies the applicable entities, owning layer, expected behavior, and validation boundary. New Adapters remain maintainer-guided research.

## From local development to a pull request

The current CI baseline is Node.js 22 with pnpm 10.32.1:

```sh
corepack enable
corepack pnpm@10.32.1 install --frozen-lockfile
corepack pnpm@10.32.1 docs:dev
```

The basic workflow is:

1. Comment on the issue and confirm readiness.
2. Create a short-lived branch from current `main`.
3. Trace P/T entities and implementation evidence before editing.
4. Keep the source of truth, implementation, tests, and affected public projections aligned.
5. Run focused tests first, then the proportional catalog, type, docs, or full checks.
6. Commit with `git commit --signoff`.
7. Record exact validation, provenance, and material AI assistance in the pull request.

See [CONTRIBUTING.md](https://github.com/Proto-UI/Proto-UI/blob/main/CONTRIBUTING.md) for exact commands, DCO remediation, provenance requirements, and the validation matrix.

## Communication

- [GitHub Issues](https://github.com/Proto-UI/Proto-UI/issues) track bounded work.
- [GitHub Discussions](https://github.com/Proto-UI/Proto-UI/discussions) is appropriate for questions and ideas that do not yet have an issue boundary.
- [Discord](https://discord.gg/MrWQd7h34R) is available for quick synchronization but is not required. Decisions that affect implementation scope should be recorded back in an Issue, Discussion, spec entity, or pull request.
