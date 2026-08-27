---
title: 'Collaboration model'
description: 'Use each GitHub surface for one job and keep permission, trust, readiness, and evidence separate.'
---

Proto UI moves quickly when work is easy to locate, claim, review, and verify. That requires each collaboration surface to carry one kind of state.

## Where work lives

Discussions hold open questions. Issues hold bounded outcomes. A pull request is one reviewable integration unit. Review records independent judgment. Actions record machine evidence. Deployments and Releases record external delivery facts.

Milestones group a release outcome or an independent program. They are not a daily status field.

The planned organization Project will be an operational view across repositories. It will carry workflow position, readiness, priority, claim expiry, evidence progress, required Agent comprehension, and permission ceiling. Product semantics will stay in `spec/**`. Its rollout begins read-only and adds one reversible automation class only after idempotency, stale-claim, permission, and rollback checks pass.

Labels remain a small search vocabulary for work type, owning area, effort, readiness, and risk. Project workflow position and claim state should not be rebuilt as labels.

## Ready work

An implementation-ready Issue tells a contributor:

- what problem or outcome is in scope;
- which authority and lifecycle apply;
- what has already been decided;
- what the contributor may decide;
- what is excluded;
- whether implementation may begin;
- how the result will be accepted.

Research approval is not implementation approval. `help wanted` does not override unresolved maintainer design.

A claim must agree with current comments, assignment, linked work, and Project state. It also needs an expiry so abandoned work does not remain occupied forever.

## Separate the authority axes

GitHub permission controls platform operations. Discord and Poppy trust matter when work touches community or Bot surfaces. A local Agent assessment measures task fit: it is advice in `human-assisted` work and a ceiling in `autonomous` work. Task risk and current authorization remain separate.

No score or Discord role grants GitHub permission. No local result proves model identity or predicts acceptance. Approval and merge require current-user or exact active standing authorization plus live repository enforcement; the local schedule has narrow review and exact-head integration scopes. Release, repository rules, access, and secrets remain attended human decisions.

The main repository and the Discord Bot do not yet have the same CI and branch controls. Contributors should describe the controls that actually exist in each repository instead of borrowing guarantees from the other one.

For the full policy, read [CONTRIBUTING.md](https://github.com/Proto-UI/Proto-UI/blob/main/CONTRIBUTING.md).
