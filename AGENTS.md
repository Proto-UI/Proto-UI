# Proto UI agent guide

This file is the entry point for agents working in this repository. Keep it short enough to read at the start of every task. Follow linked documents when a task enters their scope.

## Start here

1. Read the user request and inspect the affected workspace before editing. For ordinary repository development, enter through `$pui-dev`. For governed autonomous maintenance, enter through `$pui-maintain`.
2. Find related entities under `spec/**`; follow their relations and status rather than searching only by filename.
3. Read relevant recent records under `internal/records/**` for short-term direction and engineering context.
4. Use `internal/contracts/**` for explanation and for subjects that have not yet been cataloged in spec. Treat it as a transitional fallback, not a competing source of truth.
5. Inspect implementation, tests, public documentation, and package surfaces that realize the relevant entities.

For a snapshot-centered overview of the project, run `corepack pnpm@10.32.1 spec:docs:agent` and read the locally generated `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md`. The generated snapshot is intentionally Git-ignored. For entity authoring and governance, read `spec/README.md`.

## Skill composition

Proto UI development skills are small state transitions, not full-project manuals. `internal/agent-operations/skills.yaml` is the composition index. Entry skills choose one transition, resolve it with `pnpm agent:skill -- <leaf-id>`, and load only the returned path; do not preload every `.agents/skills/**/SKILL.md`. Validate each leaf handoff with `pnpm agent:skill -- --handoff <handoff.json>` before loading at most one next leaf.

Ordinary work starts with `$pui-dev`. If no current assessment exists, it routes through the lazy `pui-assess` leaf and derives only an unsigned U0/C1 orientation result before selecting work. It then composes authority tracing, semantic shaping, entity or implementation work, evidence, documentation, validation, and independent review as needed. Autonomous-maintenance runs start with `$pui-maintain` and preserve the recorded Observer, Verifier, Remediator, Reviewer, non-remediation record, and closure boundaries.

Every skill instruction is written in English. Communicate with the user in the language the user currently uses, while keeping paths, entity IDs, API names, and code identifiers canonical.

Read `internal/agent-operations/contributor-agents.md` before selecting work autonomously. A comprehension assessment only limits which task classes an Agent may attempt. It never grants GitHub permission. Effective capability is the intersection of live platform permission, Discord or Poppy trust when relevant, verified comprehension, task risk, a fresh task probe, and current human authorization.

An Agent may propose only a ready, bounded, unclaimed item with explicit acceptance and validation boundaries. Posting the claim is a separate mutation. Returning no eligible work is correct. Never manufacture a task, bypass `needs maintainer design`, or treat a high assessment score as semantic approval.

## Authority and conflicts

`spec/**` is the machine-governed source of truth for the project, but entity lifecycle matters:

- `active` describes a current stable project guarantee.
- `draft` describes the current cataloged direction and may guide work, but must not be presented as a stable guarantee.
- `deprecated` remains readable for compatibility and migration; follow `deprecatedSince` and `replacedBy` when present.
- `removed` is historical and unavailable from `removedSince` onward.

Apply these rules when sources disagree:

1. An applicable spec entity takes precedence over internal contract prose, records, implementation, tests, and public documentation.
2. An internal contract may fill an uncataloged gap. It must not override an existing spec entity.
3. Records preserve observations, alternatives, temporary decisions, and time-bound plans. They are never normative. Newer records can update older short-term direction without changing spec semantics.
4. Implementation and tests are evidence of current behavior. A mismatch with spec is drift to investigate, not an implicit amendment to spec.
5. README files and website content are projections for readers. Correct them when they drift instead of treating them as independent authority.

If a task exposes a real contradiction, do not silently choose the most convenient source. Identify the applicable entity and version, describe the mismatch, and either reconcile the affected artifacts within scope or record the unresolved gap.

## Repository map

- `spec/**`: cataloged contracts, prototypes, modules, Adapter profiles, decisions, host capabilities, tests, versions, and knowledge.
- `packages/spec/**`: schema, loader, relation validation, snapshot, and graph tooling for the catalog.
- `packages/core/**`: protocol syntax and core primitives.
- `packages/runtime/**`: runtime execution and orchestration.
- `packages/modules/**`: reusable semantic modules.
- `packages/adapters/**`: host translation layers.
- `packages/prototypes/**`: official prototype libraries.
- `packages/cli/**`: initialization and facade generation tooling.
- `apps/www/**`: public documentation and demos.
- `apps/workspace/**`: internal spec workspace UI and generated dataset.
- `internal/contracts/**`: readable legacy contract layer, progressively superseded by spec entities.
- `internal/records/**`: short-term direction and daily engineering records; non-normative.
- `internal/governance/**`: release, package, and repository governance.
- `internal/releases/**`: release evidence and notes.

## Working method

Before changing behavior:

- Trace the relevant entity chain where available: knowledge/decision -> contract or prototype -> module/host capability -> Adapter profile -> test -> implementation/docs.
- Check whether the affected entity is `draft`, `active`, deprecated, or absent.
- Search `internal/contracts/**` for uncataloged constraints and rationale.
- Search `internal/records/**` by topic and date for current work direction. Do not assume the newest record in the directory is relevant to every domain.

When changing behavior:

- Prefer updating the source of truth and its projections in the same change.
- Keep entity IDs, criteria IDs, relations, version ranges, revisions, and implementation paths consistent with `spec/README.md` and the schema.
- Add or update executable coverage when a normative rule changes.
- Preserve cross-adapter semantics unless the applicable spec explicitly defines a host-specific difference.
- Do not create empty catalog entities merely to match package or capability counts; catalog a coherent semantic slice with evidence.

When recording unsettled work:

- Put observations, alternatives, temporary direction, and follow-ups in a dated file under `internal/records/**`.
- Promote stabilized semantics to the appropriate spec entities instead of letting a record become a permanent shadow specification.
- Keep history factual. Do not rewrite an old record to make the past look cleaner; add a newer record when direction changes.

## Commands and verification

Use Node.js 22, the current CI baseline, and the pnpm version declared in `package.json` through Corepack.

Common checks:

```sh
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 spec:docs:agent
corepack pnpm@10.32.1 check:agent-doc
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
```

Choose verification proportional to the change:

- Agent/documentation-only changes: run `check:agent-operations`, `check:agent-doc`, generate the local Agent project understanding when its snapshot needs inspection, and validate referenced paths.
- Spec changes: run the relevant spec/schema/graph tests, `check:prototype-catalog` when prototypes are involved, regenerate projections, then run type checks.
- Runtime, module, adapter, or prototype behavior changes: run focused tests first, then the relevant workspace-wide checks.
- Release-governance changes: run the release checks documented under `internal/governance/**`.

Generated files must be changed through their generator. `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md` is a disposable, Git-ignored local projection generated by `scripts/spec/generate-agent-project-understanding.mjs`; do not add it to commits.

## Change discipline

- Keep unrelated user changes intact.
- Do not edit generated artifacts by hand.
- Avoid introducing a second source of truth in prose.
- Use exact repository paths and entity IDs when making traceability claims.
- State uncertainty explicitly when the catalog is incomplete.
- Update this guide when repository-wide working rules change; put detailed domain knowledge in the closest scoped README or spec entity instead.
- Do not infer permission to comment, label, assign, commit, push, approve, merge, publish, release, or change repository settings. A mutation also requires the registered leaf/task-class match, exact scope, trusted subject and attestation, fresh probe, current human authorization, and any global idempotency control required by policy. Perform external writes only when every condition holds.
