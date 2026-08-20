---
title: 'Status'
description: 'The current scope, expectations, and stage of Proto UI'
---

# Current Status

Proto UI remains in its **v0** stage, while the **0.2** release line is now published. [Proto UI 0.2.0](https://github.com/Proto-UI/Proto-UI/releases/tag/v0.2.0) is the current stable ecosystem release under npm `latest`; all public `@proto.ui/*` dependencies in one application must stay aligned at exactly `0.2.0`. Use the [Quick Start](/en/start-here/quick-start/) for current installation guidance.

Stable npm availability and project maturity describe different boundaries. The package release is stable for the 0.2 line, but Proto UI is still a v0 protocol project: active, draft, deprecated, and removed spec entities remain the authority for individual semantic guarantees. Publishing a package in 0.2.0 did not automatically promote every draft prototype or capability.

The reviewed release facts are preserved in the [0.2.0 release notes](https://github.com/Proto-UI/Proto-UI/blob/main/internal/releases/0.2.0/release-notes.md), the [tagged package BOM](https://github.com/Proto-UI/Proto-UI/blob/v0.2.0/internal/releases/0.2.0/package-bom.json), and the immutable assets attached to the GitHub Release.

At this stage, the priority is not to expand surface-level features as quickly as possible, but to first clarify the core semantics between prototypes, adapters, and runtimes, and to verify whether this system can be translated and implemented consistently across different hosts.

## What is currently being built?

Proto UI is currently focused on the following areas:

- Stabilizing the foundational way component prototypes are expressed
- Establishing clear translation relationships between prototypes, adapters, and hosts
- Verifying semantic consistency across different implementations through contract tests
- Expanding the foundational prototype library, adapter reference implementations, and documentation system

## What stage is it at now?

Proto UI already has a forming prototype authoring model, and its translation and implementation paths are being continuously validated across multiple Web runtimes.

At this stage, Proto UI is better understood as:

- a component interaction protocol that is still being stabilized
- an early-stage open-source project centered around prototypes and adapters
- a foundational system that emphasizes semantic consistency and verifiability

## What should it not be understood as yet?

At the v0 stage, Proto UI should not yet be understood as:

- a fully complete production-grade UI framework
- a ready-made solution with a mature ecosystem and a rich component library.
- a general platform that is already well prepared for all hosts

If your goal is to adopt a mature, stable, and ready-to-use complete solution immediately, Proto UI is most likely not yet suitable for that role.

## What is still changing?

At the current stage, many parts of Proto UI are still subject to change, including but not limited to:

- the naming, organization, and detailed shape of some APIs
- the coverage and best practices of the adapter ecosystem
- the size of the prototype library and the completeness of its examples
- the documentation structure for both users and contributors

This does not mean Proto UI lacks direction. It means the project is still in the stage of consolidating its foundational capabilities.

## Who is Proto UI suitable for at this stage?

At its current stage, Proto UI is more suitable for readers and contributors who are:

- interested in component abstraction, interaction protocols, or adapter-layer design
- willing to help build early prototype libraries, adapters, or documentation
- comfortable participating while semantics, constraints, and implementation boundaries are still being refined
