---
title: 'Deliver a change'
description: 'Take one governed slice through implementation, evidence, review, deployment, and release.'
---

Fast delivery means each piece of trustworthy evidence immediately unlocks the next automated step.

## Before editing

Start from current `main` on a short-lived branch. Trace the applicable spec lifecycle, criteria, relations, implementation, tests, generated projections, package surfaces, and public docs.

If the work reveals a new semantic identity, owner, public API, compatibility decision, Host Capability, dependency, or lifecycle change, make that scope explicit, keep unsettled guarantees draft, and continue with the bounded implementation and evidence that remain reversible. Escalate only when the repository has no direction for a materially incompatible product choice; ask for that smallest missing choice while the rest of the work continues.

## Build one coherent slice

Add focused evidence at the owning layer. Implement the smallest complete behavior. Keep affected spec entities, tests, generated views, exports, CLI surfaces, demos, and public pages together when they express the same change.

Run the focused check first. Expand to graph, type, docs, package, consumer, or release checks according to the surfaces reached. Record exact commands and say what did not run.

Use `git commit --signoff`. The pull request must disclose third-party sources and material AI assistance, state what was already decided, explain exclusions, and link the applicable entities and evidence.

## Acceptance and regression

Machine checks show that deterministic evidence passed. Independent review decides whether the change matches its governed boundary. Preview deployment exposes one delivered revision for inspection. These are complementary forms of evidence, and each feeds the next transition without adding a blanket approval pause.

A regression fix begins with behavior that fails for the governed reason. If expected behavior is unclear, the work is a semantic question rather than a bug fix.

A new push triggers live reconciliation and a fresh exact-head review. Under the active standing authorizations, an independent Agent may recheck, submit finding-backed `REQUEST_CHANGES`, approve an eligible clean exact head, and pass an independently approved head to `pui-integrate`. The merge command binds the reviewed SHA and proceeds only after trusted checks pass, active change requests are cleared, review threads are resolved, live permission is confirmed, and repository rules report a clean mergeable state.

## Release

Release preparation creates reviewable repository state. Publication is a separate, attended operation from governed `main`. A later evidence change verifies registry, tag, GitHub Release, assets, snapshot digests, workflow head, and deployments.

Agents may prepare, validate, review, and integrate release-candidate repository changes through the same evidence-bound transitions, whether directed by a current user or operating under an active standing authorization. Publication, tag creation, stable-lifecycle activation, and partial-release recovery remain attended because they are privileged or difficult to reverse; require current human authorization at that final delivery boundary.

Exact commands and contribution requirements live in [CONTRIBUTING.md](https://github.com/Proto-UI/Proto-UI/blob/main/CONTRIBUTING.md).
