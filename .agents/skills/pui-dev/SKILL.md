---
name: pui-dev
description: Route ordinary Proto UI development through a minimal composition of repository skills. Use when starting, continuing, or handing off feature, fix, spec, contract, Module, Host Capability, Adapter, Prototype, component, test, documentation, review, or release-preparation work. Do not use for autonomous-maintenance runs; use pui-maintain.
---

# Proto UI development

Coordinate the work without absorbing the domain skills into one long procedure.

Read `internal/agent-operations/skills.yaml` as routing metadata. Do not preload candidate leaf skills or guess their paths. Select one leaf ID, run `pnpm agent:skill -- <leaf-id>`, and load only the returned `loadPath`. After the leaf returns a handoff that conforms to `internal/agent-operations/schemas/skill-handoff.schema.json`, run `pnpm agent:skill -- --handoff <handoff.json>` and load at most the one resolved next leaf.

## Establish the envelope

1. Read `AGENTS.md` completely.
2. Resolve `pui-orient` to record repository state, live authority, assessed capability, task risk, and current authorization.
3. If the capability result is absent, expired, invalid, or snapshot-mismatched, resolve `pui-assess`. Derive only the unsigned U0/C1 self-result, then resolve `pui-orient` again. Do not claim that self-assessment proves a higher band.
4. If the requested work is not already bounded and the envelope permits it, resolve `pui-select` to return one read-only work-item proposal or an explicit no-work result.
5. Resolve `pui-claim` only when the exact claim is authorized and every capability, live permission, scope, subject-binding, idempotency, and probe requirement is available. Otherwise stop with the proposal.
6. After the subject is bounded, resolve `pui-trace` to map applicable authority, lifecycle, relations, evidence, projections, and conflicts.

Treat effective capability as an intersection. An assessment can restrict task choice; it cannot grant GitHub, Discord, repository, or release permission.

Before any mutation leaf, run the repository mutation-envelope verifier for the exact leaf and scope. It validates the attested clean baseline, current worktree and diff, registered task class, live permission, human authorization, subject binding, and single-use probe together. Do not require the current worktree to remain clean after an earlier authorized leaf. Fail closed when the trusted issuer registry, current bindings, required global consumer, or any scope input is unavailable.

## Compose the smallest chain

Load only the skill needed for the current transition. The list below is routing metadata, not an instruction to open every skill:

- use `pui-brainstorm` before normative work whose identity, owner, boundary, or compatibility remains unsettled;
- use `pui-unclaim` when the current contributor's claim expires, its boundary changes, or work stops;
- use `pui-issue` or `pui-pr` for bounded read-only queue inspection;
- use `pui-ci`, `pui-govern`, `pui-deploy`, or `pui-deps` for the corresponding bounded read-only operational question;
- use `pui-spec` or `pui-contract` after the corresponding semantic scope is governed;
- use `pui-adapter-assess` for a bounded read-only Adapter question and `pui-adapter` only for an explicitly approved Adapter implementation slice;
- use `pui-module`, `pui-host`, `pui-adapter`, or `pui-prototype` for an approved new or extended implementation slice;
- use `pui-regression` first whenever the task starts from a reproducible failure against governed expected behavior, including Adapter parity, Prototype, Runtime, export, or public-projection failures;
- select `pui-test` as a separate transition when evidence must be designed or changed;
- select `pui-docs` as a separate transition for reader projections;
- select `pui-validate` after a technical change;
- use a fresh context with `pui-review` when independent acceptance is required;
- use `pui-release-prep` and `pui-release-audit` only for their separate gated release phases.

Pass only registered artifacts through the validated handoff. Return a terminal handoff when there is no eligible next transition.

## Stop at a gate

Stop when product semantics, ownership, public surface, compatibility, lifecycle promotion, contributor rights, security, integration, publication, or release requires a human decision. Present one decision packet with the exact authorization requested and the actions it would not authorize.

Do not infer permission to commit, push, mutate GitHub, approve, merge, publish, or release.

## Communicate

Author repository artifacts in the language and form required by their governing source. Communicate progress, decisions, blockers, and handoff in the user's current language. Keep identifiers, paths, API names, and entity IDs canonical.
