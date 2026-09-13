---
title: 'Collaboration model'
description: 'Use each GitHub surface for one job and keep permission, trust, readiness, and evidence separate.'
---

Proto UI moves quickly when work is easy to locate, claim, review, and verify. That requires each collaboration surface to carry one kind of state.

## Where work lives

Discussions hold open questions. Issues hold bounded outcomes. A pull request is one reviewable integration unit. Review records independent judgment. Actions record machine evidence. Deployments and Releases record external delivery facts.

Milestones group a release outcome or an independent program. They are not a daily status field.

The planned organization Project will be an operational view across repositories. It will carry workflow position, readiness, priority, claim expiry, evidence progress, required Agent comprehension, and the authorization source used for an action. Product semantics will stay in `spec/**`. Its first projection is observational so the routing data can be reconciled safely; that intake lane is not a global Agent permission ceiling. Reversible follow-on actions proceed through the repository's active standing authorizations as soon as their idempotency, stale-claim, live-permission, and rollback conditions pass.

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

Existing governed direction, acceptance criteria, and draft entities are enough for an Agent to begin a bounded implementation and collect evidence. When two materially incompatible product directions remain unresolved, record the smallest product choice instead of guessing; that unresolved choice is the human decision, not every implementation step around it. `help wanted` advertises eligible work but does not invent an answer to such a choice.

A claim must agree with current comments, assignment, linked work, and Project state. It also needs an expiry so abandoned work does not remain occupied forever.

## Separate the authority axes

GitHub permission controls platform operations. Discord and Poppy trust matter when work touches community or Bot surfaces. A local Agent assessment measures task fit: it is advice in `human-assisted` work and a ceiling in `autonomous` work. Task risk and current authorization remain separate.

No score or Discord role grants GitHub permission. No local result proves model identity or predicts acceptance. The active local standing authorizations let an independent Agent recheck live state, continue one reversible collaboration transition through a purpose-bound request and verified receipt, submit finding-backed `REQUEST_CHANGES`, approve an eligible clean exact head, and merge an independently approved exact head when trusted evidence, live permission, review state, and repository rules agree. Collaboration continuation performs at most one mutation and one unknown-outcome reconciliation; it never retries a write blindly. A new revision simply returns to live reconciliation and fresh review. Human decisions are reserved for genuinely unresolved product direction and privileged or irreversible operations such as publication, release, access, secrets, and repository-rule changes.

The main repository and the Discord Bot do not yet have the same CI and branch controls. Contributors should describe the controls that actually exist in each repository instead of borrowing guarantees from the other one.

For the full policy, read [CONTRIBUTING.md](https://github.com/Proto-UI/Proto-UI/blob/main/CONTRIBUTING.md).
