# Proto UI agent guide

This file is the entry point for agents working in this repository. Keep it short enough to read at the start of every task. Follow linked documents when a task enters their scope.

## Start here

1. Read the user request and inspect the affected workspace before editing.
2. Find related entities under `spec/**`; follow their relations and status rather than searching only by filename.
3. Read relevant recent records under `internal/records/**` for short-term direction and engineering context.
4. Use `internal/contracts/**` for explanation and for subjects that have not yet been cataloged in spec. Treat it as a transitional fallback, not a competing source of truth.
5. Inspect implementation, tests, public documentation, and package surfaces that realize the relevant entities.

For a snapshot-centered overview of the project, run `corepack pnpm@10.32.1 spec:docs:agent` and read the locally generated `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md`. The generated snapshot is intentionally Git-ignored. For entity authoring and governance, read `spec/README.md`.

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

- Agent/documentation-only changes: run `check:agent-doc`, generate the local Agent project understanding when its snapshot needs inspection, and validate referenced paths.
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
