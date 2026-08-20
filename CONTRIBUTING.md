# Contributing to Proto UI

Thanks for your interest in Proto UI. The project welcomes contributions from first-time contributors, experienced framework and component-library authors, and people working toward core protocol design.

This document is the primary human contribution workflow. It explains how to choose work, find the applicable source of truth, develop locally, validate a change, and open a pull request. Project semantics remain governed by the applicable entities under [`spec/**`](./spec/).

## Before you start

Choose work by both **effort** and **readiness**:

- **Starter**: an F1–F2 task with a fixed expected result and little Proto UI domain judgment. These may carry the `good first issue` label.
- **Contributor-ready**: the semantic boundary is already decided, but implementation may still require substantial work or repository knowledge. Look for `help wanted` issues whose body says implementation may begin and which are not blocked by `needs maintainer design`.
- **Maintainer-guided**: the work still contains protocol, ownership, admission, or architecture decisions. Start with an assessment or proposal and wait for the recorded maintainer checkpoint before implementation.

An empty `good first issue` queue does not mean that contributions are closed. Experienced contributors should also review bounded `help wanted` work. Conversely, `help wanted` does not override an issue that still requires maintainer design.

Comment on the issue before starting. If an issue does not state what is decided, what the contributor may decide, and whether implementation is authorized, ask for that boundary to be clarified first.

## Source of truth

Proto UI is **spec-entity first**:

1. Find the applicable entity under [`spec/**`](./spec/) and read its status, version, criteria, relations, sources, and mapped tests.
2. `active` describes a current guarantee. `draft` is the current cataloged direction but is not a stable public guarantee. Follow deprecation and removal metadata when present.
3. Use [`internal/contracts/**`](./internal/contracts/) only for explanation or an uncataloged gap. A legacy contract never overrides an applicable spec entity.
4. Use relevant dated files under [`internal/records/**`](./internal/records/) for current engineering context. Records are non-normative.
5. Treat implementation, tests, package README files, and website content as evidence and projections. A mismatch with the applicable entity is drift to resolve, not an implicit spec amendment.

Read the [spec catalog authoring guide](./spec/README.md) before editing an entity. Do not create an empty entity merely to mirror a component name, directory, package, or capability count.

## Current contribution paths

### Maintain an existing Prototype

Suitable work includes focused bug fixes, regression coverage, docs and demos, public export corrections, and resolving drift among an existing `P-*` entity, its `T-*` evidence, implementation, and public projections.

Start with the [existing Prototype maintenance guide](./apps/www/src/content/docs/en/build/prototypes/maintaining-an-existing-prototype.md).

### Project Base into a design language

This path is available only when the Base `P-*`/`T-*` boundary already exists and the issue records the design-language scope. The derived Prototype may add presentation, design-language props, and rules; it must not silently create a competing state, event, focus, accessibility, or host-capability owner.

Start with the [design-language projection guide](./apps/www/src/content/docs/en/build/prototypes/projecting-base-into-a-design-language.md).

### Implement an approved Base semantic slice

This is usually an advanced implementation contribution. Begin only after a maintainer checkpoint has approved the independent subject, information paths, negative boundary, exact public surface, `P-*`/`T-*` plan, and required cross-host evidence.

Start with the [approved Base slice implementation guide](./apps/www/src/content/docs/en/build/prototypes/implementing-an-approved-base-slice.md).

### Propose a new Base subject

A familiar component name is not enough to justify a Base Prototype. A proposal must establish an independently addressable, cross-host, testable protocol subject with an owned input-fact-to-observable-output path. Use the Prototype proposal template and wait for a maintainer checkpoint before implementation.

### Docs, demos, and community work

Documentation, translation, demo quality, accessibility examples, issue triage, and contributor guidance are welcome. Explain the reader or contributor obstacle being removed and verify public pages when they change.

### Website preview requirement for Prototype work

Every new public Prototype identity or anatomy family must be added to a navigable page on the Proto UI website in the same coherent change. The page must consume the real public package export, show the important approved states or behavior, and provide the applicable Web Component, React, and Vue previews. Include the local website route in the pull request so maintainers can review the contribution interactively. The development-only Demo Matrix is useful supplementary evidence, but it does not replace the public website page.

Website demos should approximate what a developer gets after installing the package. Prefer the Prototype's own anatomy, triggers, state, events, and defaults; do not add page-only orchestration merely to make a demo appear functional. For example, a Dialog demo should normally open through its Dialog Trigger, not through an unrelated Button callback that calls a Dialog expose.

Minimal external control is acceptable only when the Prototype has no natural trigger by design, or when its documented public controls are themselves the behavior under demonstration. Toast-style invocation and direct Transition controls are typical exceptions. Keep that orchestration outside the Prototype, use only public APIs, and identify it in the demo source and pull request as demo-only code that consumers must recreate. An exception must not hide a missing anatomy part, ownership error, or Adapter drift.

For maintenance work, update the existing website page whenever public behavior, states, anatomy, styling, or usage changes. A tests-only or internal refactor does not require a new page when the current preview remains accurate.

### Adapter work is not yet a documented contribution path

The Module, Host Capability, and official Adapter-profile catalog is still being completed. Until the relevant entities and architecture are cataloged and known drift is reconciled, Proto UI does not publish a general Adapter authoring guide or imply that a new Adapter can be implemented by analogy.

Specific Adapter parity bugs may still be opened for contribution when an issue identifies the applicable entities, the owning layer, the expected behavior, and the exact validation boundary. New Adapter proposals remain maintainer-guided research unless the issue explicitly states otherwise.

## Local development

The CI baseline is Node.js 22. Use the pnpm version declared in `package.json` through Corepack.

```sh
corepack enable
corepack pnpm@10.32.1 install --frozen-lockfile
```

Useful local entry points:

```sh
corepack pnpm@10.32.1 docs:dev
corepack pnpm@10.32.1 workspace:dev
corepack pnpm@10.32.1 spec:docs:agent
```

`spec:docs:agent` generates `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md` as a disposable, Git-ignored local projection. Do not add that file to a commit.

The repository pre-commit hook formats staged supported files through `lint-staged`. You can run the formatter explicitly with `corepack pnpm@10.32.1 format`, but keep unrelated formatting changes out of the pull request.

## Development workflow

1. Claim or discuss an issue and confirm its readiness.
2. Fork the repository if needed and create a short-lived topic branch from current `main`.
3. Trace the applicable entity chain before editing: knowledge/decision → contract or Prototype → Module/Host Capability where applicable → Adapter profile → test → implementation/docs.
4. Make the smallest coherent change that keeps the source of truth and affected projections aligned.
5. Add or update executable coverage when a normative rule or observable behavior changes.
6. Run focused checks first, followed by the proportional repository checks below.
7. Commit with a DCO sign-off and open a pull request using the repository template.

## Proportional validation

| Change | Minimum expected validation |
| --- | --- |
| Docs or contributor guidance | `corepack pnpm@10.32.1 docs:build`; validate referenced repository paths; run `check:agent-doc` when Agent projection inputs change |
| Existing Prototype behavior | Focused Vitest file, relevant `T-*` mapping, `check:prototype-catalog`, `check:types`, and `docs:build` plus the existing website route when the public behavior or presentation changes |
| Design-language projection | Focused Base and derived Prototype tests, `check:styles:preset`, `check:component-presets` when applicable, `check:prototype-catalog`, `check:types`, `docs:build`, and manual review of the new website route |
| Approved Base semantic slice | Focused P/T/module/Adapter evidence required by the issue, `check:prototype-catalog`, regenerated projections, `check:types`, the proportional full `test` suite, `docs:build`, and manual review of the new website route |
| Package or public export surface | Focused tests plus `build:packages`, `check:package-manifests`, and relevant consumer or docs smoke |

Run a focused test with Vitest, for example:

```sh
corepack pnpm@10.32.1 vitest run packages/prototypes/base/test/separator.test.ts
```

The repository-wide checks are:

```sh
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
```

Record the exact commands and any manual verification in the pull request. Do not claim a check that was not run.

## Contribution license

Proto UI is currently licensed under the [MIT License](./LICENSE). You retain the copyright in contributions you create. By submitting a contribution, you represent that you have the right to provide it under the repository's current license. This policy does not require a copyright assignment.

Third-party material remains subject to its original license, attribution, notice, and other applicable requirements. Your contribution must identify and preserve those obligations.

## Developer Certificate of Origin

All new contributions, including documentation and small changes, must comply with the [Developer Certificate of Origin 1.1](./DCO.md). Every human-authored commit entering a pull request needs a valid sign-off trailer. A pull request checkbox or comment does not replace commit sign-off.

Create a signed-off commit with:

```sh
git commit --signoff -m "feat: describe the change"
```

To sign off the latest existing commit:

```sh
git commit --amend --signoff --no-edit
git push --force-with-lease
```

To sign off multiple local commits that are not on `origin/main`:

```sh
git fetch origin
git rebase --signoff origin/main
git push --force-with-lease
```

A valid trailer has this form:

```text
Signed-off-by: Contributor Name <email@example.com>
```

The name and email must represent the person making the certification. A DCO sign-off is different from a cryptographic GPG or SSH commit signature. Do not copy another person's trailer or ask a maintainer to sign on your behalf. See the [contribution provenance policy](./internal/governance/contribution-provenance.md) for the individual remediation process for already-published unsigned commits.

Proto UI does not install hooks or change contributor Git configuration to add sign-offs automatically. The sign-off must be intentional.

## Contribution provenance

Read the [contribution provenance policy](./internal/governance/contribution-provenance.md) before opening a pull request. Disclose material that was copied, adapted, generated, or otherwise constrained, including:

- code copied or rewritten from another project;
- third-party design systems that were referenced or ported;
- external images, icons, fonts, test data, and documentation;
- substantial AI-generated or AI-transformed content; and
- contributions that an employer or client may own or restrict.

Disclosure helps reviewers verify rights and required attribution; it does not itself establish that material may be submitted.

## Dependencies and generated files

New dependencies are discouraged and must be discussed in an issue before a pull request.

Generated files must be changed through their generator. When a check reports generated drift, update the governing source or generator and regenerate; do not hand-edit the projection. Keep unrelated user or generated changes out of the pull request.

## Communication

- GitHub Issues are the primary tracked entry point.
- [GitHub Discussions](https://github.com/Proto-UI/Proto-UI/discussions) is appropriate for questions and ideas that do not yet have a bounded issue.
- [Discord](https://discord.gg/MrWQd7h34R) is available for quick synchronization, but joining it is not required to contribute. Decisions that affect implementation scope should be recorded back in an Issue, Discussion, spec entity, or pull request.
