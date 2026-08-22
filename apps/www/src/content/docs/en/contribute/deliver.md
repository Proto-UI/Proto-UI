---
title: 'Deliver a change'
description: 'Take one governed slice through implementation, evidence, review, deployment, and release.'
---

Fast delivery means short feedback loops, not skipped gates.

## Before editing

Start from current `main` on a short-lived branch. Trace the applicable spec lifecycle, criteria, relations, implementation, tests, generated projections, package surfaces, and public docs.

If the work reveals a new semantic identity, owner, public API, compatibility decision, Host Capability, dependency, or lifecycle change, stop. Return to the Issue and ask for the smallest missing decision.

## Build one coherent slice

Add focused evidence at the owning layer. Implement the smallest complete behavior. Keep affected spec entities, tests, generated views, exports, CLI surfaces, demos, and public pages together when they express the same change.

Run the focused check first. Expand to graph, type, docs, package, consumer, or release checks according to the surfaces reached. Record exact commands and say what did not run.

Use `git commit --signoff`. The pull request must disclose third-party sources and material AI assistance, state what was already decided, explain exclusions, and link the applicable entities and evidence.

## Acceptance and regression

Machine checks show that deterministic evidence passed. Review decides whether the change matches its governed boundary. Preview deployment lets maintainers inspect one delivered revision. These are different forms of evidence.

A regression fix begins with behavior that fails for the governed reason. If expected behavior is unclear, the work is a semantic question rather than a bug fix.

A new push invalidates stale review. Merge only the reviewed revision after required checks pass and every review thread is resolved.

## Release

Release preparation creates reviewable repository state. Publication is a separate, attended operation from governed `main`. A later evidence change verifies registry, tag, GitHub Release, assets, snapshot digests, workflow head, and deployments.

An Agent may prepare or audit a release within its verified capability. It may not publish, tag, activate a stable lifecycle, merge, or recover a partial release without current human authorization.

Exact commands and contribution requirements live in [CONTRIBUTING.md](https://github.com/Proto-UI/Proto-UI/blob/main/CONTRIBUTING.md).
