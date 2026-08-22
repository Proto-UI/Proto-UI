# Collaboration model

This document defines the stable repository workflow for human and Agent contributors. It governs collaboration state, not Proto UI product semantics. Product behavior remains governed by applicable entities under `spec/**`.

## Keep each collaboration surface honest

| Surface | What it owns | What it must not replace |
| --- | --- | --- |
| Discussion | Open questions, early proposals, and community conversation | A bounded task, accepted semantics, or executable evidence |
| Issue | One trackable outcome with scope, readiness, and acceptance boundary | A design decision that has not been recorded |
| Project | Operational position, claim state, readiness, risk, and evidence state | Product authority or release identity |
| Label | Stable searchable properties of the work | Kanban status, assignee state, or a complete decision record |
| Milestone | A version outcome or independent program with completion conditions | Daily priority, claim ownership, or workflow status |
| Pull request | One reviewable integration unit with implementation and evidence | The issue's unresolved semantic work |
| Review | Independent semantic and integration judgment | Passing machine checks |
| Actions | Reproducible machine evidence | Product approval, reviewer judgment, or publication authorization |
| Deployment or Release | An external delivery fact tied to an exact revision | Proof that every draft semantic direction is stable |

When a decision changes implementation scope, record it on a durable GitHub or repository surface. Discord is useful for quick coordination, but a Discord exchange alone does not govern a change.

## Shape work before implementation

Classify effort and readiness separately.

Effort describes the expected amount of work. The Fibonacci labels express uncertainty as well as size. Unassessed work stays unassessed; work too large to review coherently must be split.

Readiness answers a different question:

- starter work has a fixed result and needs little Proto UI domain judgment;
- contributor-ready work has decided semantics but may still be large;
- maintainer-guided work still needs an admission, ownership, compatibility, or architecture decision.

A task can be small and not ready. It can also be large and ready. Neither effort nor an Agent score changes this distinction.

An implementation-ready Issue states:

- the observed problem or desired outcome;
- the applicable authority and lifecycle;
- what is already decided;
- what the contributor may decide;
- what remains outside the change;
- whether implementation may start;
- the acceptance and validation boundary;
- the required human gates.

Research authorization does not imply implementation authorization. A draft pull request does not imply semantic acceptance.

## Claim one bounded task

Before claiming work, inspect the assignee, recent comments, linked pull requests, Project state when available, and the current repository head. A claim includes its scope, planned evidence, responsible contributor, and expiry.

The contributor must revalidate the claim before implementation. Release it when the boundary changes, the work becomes blocked, the claim expires, or the contributor stops. An empty eligible queue is a valid state; contributors and Agents must not manufacture work to remain busy.

Assignee identifies the current responsible person. It is not a complete lock by itself, because earlier work may be visible only in comments or linked pull requests.

## Label taxonomy

Labels should remain a small, stable search vocabulary:

- type describes the nature of the work;
- area describes the owning repository surface;
- effort describes expected reviewable work;
- readiness describes whether implementation may begin;
- risk identifies work that needs a stronger gate.

Project status, claim state, priority, iteration, and evidence progress belong in Project fields rather than labels. Duplicate names and punctuation variants must be migrated to one canonical label instead of being documented as separate meanings.

## Project as an operational view

The planned organization Project is a multi-repository operational view. It must not become a second specification or issue tracker.

The implementable field schema, transitions, synchronization, idempotency, rollback, and rollout gates are defined in `internal/governance/project-v2-design.md`.

Its fields should cover:

- workflow status;
- work type and area;
- effort and priority;
- readiness and decision gate;
- required Agent comprehension;
- mutation permission ceiling;
- evidence state;
- claim owner and expiry;
- iteration, repository, and milestone or program.

Useful views include intake, ready work, active claims, maintainer decisions, review and acceptance, release windows, long programs, regressions, and stale work.

Automations may perform deterministic transitions such as placing a new item in intake or marking a closed item done. They must not infer semantic readiness, approve a design, change an Agent's capability, or merge work.

Until the Project is operational, Issues and maintainer checkpoints remain the live coordination source.

## Milestones

Use a release milestone for a dated release outcome. Fix the date and let scope follow the evidence that passes the release gates. Unfinished work does not become part of a release merely because it was once assigned to the milestone.

Use a program milestone for an outcome that can progress independently from a release. Give it completion conditions and non-goals.

Audit a milestone before closing it and after reopening linked work. A closed milestone with open items and an open milestone with no remaining work both require an explicit review.

## Permissions, trust, and comprehension

Do not flatten separate authority axes into one contributor level.

GitHub Read, Triage, Write, Maintain, and Admin determine what the current credential can do on GitHub. Discord Community, Contributor, and Trusted determine which community and Poppy paths are available. Local Agent comprehension is advisory while a person directs the work and a binding task and review ceiling when the Agent works alone. Task risk and current authorization remain separate.

An assessment cannot grant repository permission, prove runtime identity, or predict acceptance. External writes require current authorization, live permission, an exact target and scope, and idempotency appropriate to the platform.

Read-only contributors may inspect and report. Triage permission may support reversible metadata work. Write permission supports feature branches and the contributor's own pull request, never a direct push to protected main. Maintain permission may perform repository operations only within current policy and review gates. Admin operations, access, secrets, applications, rulesets, and branch protection remain attended human work.

## Fast delivery without weak gates

Speed comes from shortening feedback loops and keeping changes coherent:

1. Shape the smallest decision or implementation slice.
2. Trace authority before editing.
3. Add focused evidence at the owning layer.
4. Implement source, evidence, generated projections, package surfaces, and public docs as one coherent change.
5. Run focused checks before broader repository checks.
6. Open a reviewable pull request with exact scope, provenance, DCO, and validation results.
7. Separate machine evidence from independent semantic acceptance.
8. Merge only the reviewed revision.
9. Treat deployment and publication as separate evidence-producing phases.
10. Convert production or consumer failures into bounded regressions with an owning layer.

Large leaps are acceptable when they remain a vertical slice with one semantic boundary and complete evidence. A wide diff without a single reviewable claim is not a leap; it is several tasks that need shaping.

## Acceptance, regression, and deployment

Acceptance asks whether the reviewed change matches the governed boundary and its exclusions. Regression evidence asks whether an existing guarantee can fail again. Actions show whether deterministic checks passed. Preview deployments show whether a revision can be inspected in a delivery environment. None of these substitutes for the others.

For ordinary pull requests:

- run the focused test that proves the affected rule;
- run the spec, type, docs, package, consumer, or release checks reached by the change;
- inspect public routes and interactions when the reader or consumer surface changed;
- record checks that did not run and why;
- require an independent review for semantic or integration acceptance.

For release work, prepare the candidate separately from publication. Publish only from the governed main revision through the protected manual workflow. Afterwards, audit registry, tag, Release, assets, snapshot digests, workflow head, and deployment facts in a separate evidence change.

## Repository differences

The main Proto UI repository and `dcbot` do not currently have the same governance maturity. The Bot's internal trust design must not be mistaken for repository branch protection, CI, review, or deployment evidence.

Apply the same principles to `dcbot`, but describe its actual controls honestly. Until its repository gates exist, compensate with attended review and explicit validation rather than claiming that the main repository's controls cover it.

Current observations and known control gaps belong in dated records under `internal/records/**`. Stable guidance must not hard-code current counts, versions, or temporary workflow health.
