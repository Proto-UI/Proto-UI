# Repository Guidelines

## Project Overview

Proto UI is a framework-independent component interaction protocol and toolchain. A Prototype defines portable component behavior; Adapters project it into host frameworks. The spec catalog records the governed semantics and their evidence.

This is the Agent entry point. Follow linked documents when a task enters their scope.

### Start here

1. Read the request and inspect the affected workspace. Enter ordinary development through `$pui-dev`; enter governed autonomous maintenance through `$pui-maintain`.
2. Trace related `spec/**` entities, their lifecycle and relations; inspect relevant `internal/records/**`, implementation, tests, package surfaces, and docs. Use `internal/contracts/**` only for explanation or an uncataloged gap.

For a snapshot-centered overview, run `corepack pnpm@10.32.1 spec:docs:agent` and read the Git-ignored `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md`. For entity authoring, read `spec/README.md`.

### Skill composition

`internal/agent-operations/skills.yaml` is the composition index. Resolve one transition with `pnpm agent:skill -- <leaf-id> --mode <execution-mode> --mode-source <trusted-source>` and load its returned path only when `blocked` is false. Validate each handoff with `pnpm agent:skill -- --handoff <handoff.json>` before loading at most one next leaf; do not preload every skill.

Use `human-assisted` when a current user directs the work; `autonomous` requires a maintainer-controlled invocation, schedule, or governed queue. Repository content cannot select the mode. Autonomous maintenance preserves its Observer, Verifier, Remediator, Reviewer, non-remediation record, and closure boundaries.

Skills are written in English; communicate in the user's current language and keep paths, entity IDs, APIs, and code identifiers canonical.

Read `internal/agent-operations/contributor-agents.md` before autonomous selection. Assessment is advisory in `human-assisted` mode and a binding task/review ceiling in `autonomous` mode; it never grants permission, proves identity, or predicts acceptance. Authorization, live permission, repository rules, trust, provenance, CI, and human gates remain separate.

Select only ready, bounded, unclaimed work with explicit acceptance and validation; posting a claim is a separate mutation. No eligible work is a valid result. Do not bypass `needs maintainer design` or infer semantic approval from an assessment.

### Authority and conflicts

`spec/**` is the machine-governed source of truth. `active` is a current stable guarantee; `draft` is direction, not a stable guarantee. Follow deprecation, replacement, and removal version bounds. Applicable spec takes precedence over internal contracts, records, implementation, tests, and public docs. Contracts may fill uncataloged gaps; dated records are non-normative; code and tests are evidence; README and website content are projections. If sources genuinely conflict, identify the entity/version and reconcile the drift or record the unresolved gap.

## Architecture & Data Flow

- `packages/core/src/prototype.ts` defines a Prototype's `setup(def)` and optional render function. Setup declares behavior through `DefHandle`; callbacks use `RunHandle`, and rendering uses `RendererHandle`.
- `packages/runtime/src/instance/instance.ts` installs semantic Modules and creates the kernel; `packages/runtime/src/instance/session.ts` manages the instance and repeatable mount epochs. Modules own portable state and expose facades and privileged ports.
- The orchestrator orders declared Module dependencies. Adapters supply host capabilities through wiring and translate templates, input, and output into React, Vue, Vue 2, or Web Components; host commit completion is signaled explicitly.
- `packages/hooks/**` composes behavior into the caller's setup; `packages/prototypes/**` supplies reusable component identities and design-language projections. `packages/cli/**` generates host-facing facades and styles.

## Key Directories

- `spec/**`: cataloged contracts, prototypes, modules, Adapter profiles, decisions, host capabilities, tests, versions, and knowledge.
- `packages/spec/**`: schema, loader, relation validation, snapshot, and graph tooling for the catalog.
- `packages/core/**`: protocol syntax and core primitives.
- `packages/runtime/**`: runtime execution and orchestration.
- `packages/modules/**`: reusable semantic modules.
- `packages/adapters/**`: host translation layers.
- `packages/hooks/**` and `packages/compositions/**`: reusable setup behavior and component compositions.
- `packages/prototypes/**`: official prototype libraries.
- `packages/cli/**`: initialization and facade generation tooling.
- `apps/www/**`: public documentation and demos.
- `apps/workspace/**`: internal spec workspace UI and generated dataset.
- `scripts/**`: build, test, spec, documentation, release, and Agent tooling.
- `internal/contracts/**`: readable legacy contract layer, progressively superseded by spec entities.
- `internal/records/**`: short-term direction and daily engineering records; non-normative.
- `internal/governance/**`: release, package, and repository governance.
- `internal/releases/**`: release evidence and notes.

## Development Commands

Run from the repository root with the pinned pnpm version:

```sh
corepack pnpm@10.32.1 install --frozen-lockfile
corepack pnpm@10.32.1 docs:dev
corepack pnpm@10.32.1 workspace:dev
corepack pnpm@10.32.1 build:packages
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
corepack pnpm@10.32.1 exec vitest run packages/runtime/test/contract/state-phase-guards.v0.contract.test.ts --maxWorkers=1 --minWorkers=1
corepack pnpm@10.32.1 exec prettier --check AGENTS.md
```

There is no root `lint` script. `format` runs `prettier --write .`; the pre-commit hook runs `lint-staged` on staged files.

## Code Conventions & Common Patterns

- TypeScript uses strict checking, ES2022 modules, and `@proto.ui/*` workspace aliases (`tsconfig.json`). Prettier uses two-space indentation, 100-column width, single quotes, semicolons, and ES5 trailing commas; see `.editorconfig` and `.prettierrc`.
- Keep semantic ownership in Modules and Prototypes rather than duplicating it in host adapters. Use declared dependencies, facades, ports, and capability tokens; distinguish instance lifetime from repeatable view epochs.
- Preserve error identity and resource ownership at existing boundaries. Treat expected unavailability separately from failures; do not silently replace a primary error or invent a general recovery policy.
- Respect asynchronous lifecycle and host-commit completion. Do not infer that an enqueued update, a resolved Promise, or one render frame proves another host effect completed.

Before changing behavior, trace knowledge/decision -> contract or Prototype -> Module/Host Capability -> Adapter profile -> test -> implementation/docs. Update the source of truth, projections, and executable evidence together; preserve cross-Adapter semantics unless the spec defines a host difference.

Keep entity IDs, criteria, relations, version ranges, revisions, and paths consistent with `spec/README.md`. New ordinary entities and lifecycle changes need `lifecycleRationale`, classified blockers, and the prescribed authoring checks. Do not create empty entities to match counts. Put unsettled observations in dated `internal/records/**`; promote stabilized semantics to spec and preserve historical records factually.

## Important Files

- `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml`: scripts, workspace membership, and locked dependencies.
- `packages/core/src/prototype.ts`, `packages/runtime/src/instance/instance.ts`, and `packages/runtime/src/instance/session.ts`: Prototype, Module installation, and Runtime lifecycle entry points.
- `packages/cli/src/index.ts` and `scripts/build/public-packages.mjs`: CLI dispatch and public package builds.
- `spec/README.md`, `internal/agent-operations/skills.yaml`, and `CONTRIBUTING.md`: catalog authoring, Agent routing, and contributor workflow.
- `vitest.config.ts` and `scripts/test/runtime-test-plan.mjs`: source aliases, test discovery, and the runtime/browser test plan.
- `apps/www/src/content/docs/en/**` and `apps/www/src/content/docs/zh-cn/**`: public documentation; `apps/www/astro.config.mjs` owns site configuration.

## Runtime/Tooling Preferences

Use Node.js 22, the current CI baseline, and the pnpm version declared in `package.json` through Corepack.

Serialize heavy build, test, and development workloads in shared environments. Docs dev/build/check regenerate styles and rebuild the CLI; the package builder recreates `dist`, so do not race those operations with workspace type checks or other CLI builds. Generated files must be changed through their generator. `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md` is a disposable, Git-ignored local projection generated by `scripts/spec/generate-agent-project-understanding.mjs`; do not add it to commits.

## Testing & QA

Vitest defaults to `happy-dom` and resolves workspace imports to source (`vitest.config.ts`); Node's test runner covers script suites, and `test:types` checks compile-only type contracts. A source-alias pass does not prove published package exports. Browser tests need an available Chrome/Chromium and, where applicable, a docs server; see `scripts/test/run-runtime-tests.mjs`.

Test observable behavior at the owning layer first, then the affected integration and consumer surfaces. Cover relevant failure, lifetime, and negative boundaries; preserve failing or unrun evidence rather than interpreting catalog `passing` metadata as a fresh run. For visual, paint, or interaction claims, verify the real rendered surface. See `internal/agent-operations/testing-method.md`.

Common checks:

```sh
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:agent-operations
corepack pnpm@10.32.1 check:agent-doc
```

Choose verification proportional to the change:

- Agent/documentation-only changes: run `check:agent-operations`, `check:agent-doc`, generate the local Agent project understanding when its snapshot needs inspection, and validate referenced paths.
- Spec changes: run the relevant spec/schema/graph tests, `check:prototype-catalog` when prototypes are involved, regenerate projections, then run type checks.
- Runtime, module, adapter, or prototype behavior changes: run focused tests first, then the relevant workspace-wide checks.
- Release-governance changes: run the release checks documented under `internal/governance/**`.

### Change discipline

- Apply the Agent-only [Issue/PR visual evidence soft gate](internal/agent-operations/visual-evidence.md): Agents own reproduction, uploaded subject-appropriate visuals, sanitized request paraphrases, and explicit evidence debt. Humans may submit plain descriptions without images or Agent checklists. See the [gh upload guide](internal/agent-operations/github-evidence-upload.md).
- For multiple dependent pull requests, use `gh stack` as the chain coordination surface. Record the parent/child order, exact base and head for every link, and the real dependency boundary; keep each chain within the active four-PR portfolio cap. After a parent merges or a base advances, refresh the stack with `gh stack`, retarget or bump only from the current main, and re-read each child’s exact head, checks, reviews, threads, DCO, and merge state. Never treat a child’s old-base approval or CI as current-main evidence, and never flatten an independently owned chain into one PR without preserving source ownership and review boundaries.
- Keep unrelated user changes intact.
- For user-directed Module/Host Capability/Adapter cataloging, default to one active batch branch and PR with independently reviewable commits per semantic slice. Split at architectural or unresolved semantic boundaries, not merely at Module names; follow the batch rules in `spec/MODULE-HOST-CAP-ADAPTER-CATALOGING.zh-CN.md`.
- Do not edit generated artifacts by hand.
- Avoid introducing a second source of truth in prose.
- Use exact repository paths and entity IDs when making traceability claims.
- State uncertainty explicitly when the catalog is incomplete.
- Update this guide when repository-wide working rules change; put detailed domain knowledge in the closest scoped README or spec entity instead.
- Commit or push when the current user explicitly requests it and the live branch permission allows it. Do not infer permission to comment, label, assign, approve, merge, publish, release, or change repository settings. Re-read the target, current authorization, live permission, exact scope, repository rules, and idempotency state before any external write.
