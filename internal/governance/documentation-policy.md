# Documentation ownership and maintenance

This guide routes readers and contributors to the existing sources of truth. It governs documentation placement and upkeep; it does not change protocol semantics, entity lifecycle, release scope, or acceptance requirements.

## Find the right source

| Reader's question | Start here | What the source establishes |
| --- | --- | --- |
| What is Proto UI, and how do I use it? | [English README](../../README.md), [中文 README](../../README.zh-CN.md), [public documentation source](../../apps/www/README.md) | Reader-facing explanations and supported usage paths. |
| What behavior is defined? | [Spec catalog](../../spec/README.md) | Applicable entities, lifecycle, version boundaries, relations, criteria, and conformance mappings. A draft is not a stable guarantee. |
| What happens when a subject is not fully cataloged? | [Internal contracts](../contracts/README.md) | Explanation and transitional fallback for the uncataloged part; never an override of an applicable entity. |
| What does this checkout implement? | The owning [package](../../packages/README.md), its source, and executable tests | Implementation evidence. A mismatch with the definition is drift to investigate. |
| What is released or planned for release? | [Release entry](../../RELEASE_CHECKLIST.md), [release governance](README.md), [version entities](../../spec/versions/) | Release identity, scope, process, and the evidence required for publication. `VERSION` alone does not establish a published release. |
| How do I contribute or run a check? | [Contributing](../../CONTRIBUTING.md), [Agent guide](../../AGENTS.md), [scripts](../../scripts/README.md) | The maintained workflow and actual command owners. |
| What happened in an earlier investigation? | [Dated records](../records/README.md), [retained design material](../../docs/README.md), [release evidence](../releases/README.md) | Observations at a named source and time. An old plan or passing run is not current acceptance. |

Authority follows [AGENTS.md](../../AGENTS.md#authority-and-conflicts) and [the catalog's migration rules](../../spec/README.md#source-of-truth-migration). A file's location, recency, or number of checked boxes does not promote its claims. README files and website pages remain projections of those sources.

## Where new content belongs

| Location | Responsibility | Placement boundary |
| --- | --- | --- |
| Root README files | Project introduction, public starting points, short repository map | Link to detailed owners instead of duplicating release gates or implementation manuals. Keep the two locales aligned. |
| [spec/](../../spec/README.md) | Versioned semantic definitions and their relations | Change an entity through the definition process when its meaning changes; do not introduce a second specification in a README. |
| [packages/](../../packages/README.md) | Implementation and package-local usage or development guidance | Put instructions next to the package they describe. Check whether its README is generated before editing it. |
| [apps/](../../apps/README.md) | Public website and internal spec workspace | Public tutorials belong in the localized website content, not the root `docs/` directory. Follow the [prototype documentation style guide](prototype-docs-style-guide.md) for `ui-libraries/` component pages. |
| [internal/](../README.md) | Contributor procedures, explanations, ledgers, and engineering context | Use the owning subdirectory; follow the [internal engineering writing guide](engineering-writing-guide.md) (single-slot scope/limits, narrative–receipt split, zero binary evidence in `main`). |
| [docs/](../../docs/README.md) | Retained design sources and evidence at already referenced paths | Preserve existing citations. New daily investigations go to `internal/records/`; this directory is not another public documentation tree. |
| [experiments/](../../experiments/README.md) | Isolated research probes and candidate implementations | State the question and how to reproduce it. Promotion into production requires its own definition, implementation, and evidence. |
| [benchmarks/](../../benchmarks/README.md) | Measurement scenarios, calibration, methodology, and reports | Name the measured source, environment, and limits. A measurement does not create a semantic or release guarantee. |
| [native/](../../native/README.md) | Native host workspaces and their local instructions | Distinguish a native Runtime host from compiler-generated native artifacts. |
| [scripts/](../../scripts/README.md) | Repository automation, checks, generators, and their usage | Keep a command with its owner; root `package.json` exposes selected entry points. |
| [shared/](../../shared/README.md) | Small shared data consumed by repository tooling and the website | Keep actual consumers documented; do not turn it into a second package layer. |
| [types/](../../types/README.md) | Workspace ambient declarations | Public protocol types belong in `packages/types/`. |

The directory map describes the current layout. Moving a directory is warranted when it resolves a concrete ownership or dependency problem, after its imports, build configuration, generators, tests, and documentation references have been traced. Naming consistency alone does not justify moving retained evidence or working source trees.

## Maintained guidance, history, and generated views

**Maintained guidance** includes entry pages, current procedures, package usage, and current release preparation. Correct factual drift at the source and update affected projections together. Prefer links to the owning file over copied version numbers, package counts, or implementation inventories.

**Historical material** includes dated engineering records, retained plans, frozen release evidence, and source-specific reports. Preserve the original observations and failures. If direction changes, add a dated successor and update the maintained index. Do not rewrite an earlier failure into a pass or mark a retained requirement complete because its document is archived.

**Generated views** must be changed through their owning source and generator. Some files contain both authored prose and generated sections; preserve the authored portion and follow the generator's supported boundary.

| Projection | Editable owner and update route |
| --- | --- |
| Agent project understanding and spec workspace dataset | [Spec entities and generators](../../spec/README.md#validation-and-projections); `spec:docs:agent` and `workspace:generate`. The local outputs are Git-ignored. |
| Package release notices, metadata, and generated package READMEs | [Metadata synchronizer](../../scripts/release/sync-metadata.mjs) and its package rules, under the [release workflow](release-workflow.md). Packages marked `preserveReadme` retain their authored prose. Do not run release synchronization as incidental formatting. |
| Coverage matrix Markdown | [Coverage inventory and its generator](../coverage-matrices/README.md). Preserve historical source bindings and acceptance states when refreshing a candidate. |
| Website CLI examples and generated style assets | [Website scripts](../../apps/www/package.json) and their actual CLI/source inputs. The website's dev/build/check commands run the required generation prelude. |
| Release BOMs and immutable snapshots | [Release workflow](release-workflow.md) and [release evidence](../releases/README.md). Preparation and admitted publication evidence remain distinct. |

Neither a generated inventory nor a passing documentation check proves that an implementation meets its specification. Current runtime, browser, native, accessibility, and real-application claims need their own source-bound evidence.

## Updating or retiring a document

1. Identify its audience, purpose, current authority, source version, and incoming references. Search tracked source and documentation before moving or replacing it.
2. Decide which statements are current guidance, historical observation, unresolved work, or generated output. A recent date is not proof of accuracy; an old date is not a reason to delete a still-applicable contract or source.
3. Correct the owning definition, procedure, or generator first. Update the affected README, index, package, and localized website projections in the same review when their meaning changes.
4. For a superseded checklist or plan, map its requirements to their current owners. Retain unresolved conditions and their existing tracking. Archive the original with source provenance; a small navigation stub can preserve an established external URL without retaining competing instructions.
5. Validate links and commands, inspect the rendered reader surface when layout changes, and record the actual verification scope. Report inaccessible sources and semantic gaps separately from mechanical failures.

Documentation follow-up belongs in the owning Issue or a dated record with a source revision, affected paths, current owner, and next action. Keep substantive unknowns visible; a document move is not product completion. The [2026-11-22 governance audit](../records/2026-11-22-documentation-governance.md) records the initial cleanup and the v0 checklist's dispositions.

## Validation

Run these checks from the repository root with the Node baseline in [AGENTS.md](../../AGENTS.md#commands-and-verification) and the package manager pinned in [package.json](../../package.json):

```sh
corepack pnpm@10.32.1 check:internal-docs
corepack pnpm@10.32.1 check:repository-docs
corepack pnpm@10.32.1 check:public-docs
corepack pnpm@10.32.1 test:public-docs
```

`check:internal-docs` enforces the [internal engineering writing guide](engineering-writing-guide.md) under `internal/**` (binary/archive bans, file/JSON budgets, single-H1, prose readability AST rules with a debt ratchet in `internal/baselines/internal-docs-debt.json`, plus advisory Vale prose rules under `.vale/styles/ProtoUI/`).

The repository checker inventories Markdown/MDX by role, verifies required maintained entry points, resolves local Markdown links and images, and checks supported explicit package-script invocations against their owning manifest. Its [policy](../../scripts/docs/repository-doc-policy.mjs) makes excluded history, evidence, generated content, and website routes explicit. New documents default to maintained; a new exclusion requires a real role and reason.

Write executable-tool invocations as `pnpm exec <tool>` and disambiguate package scripts with `pnpm run <script>` when necessary. This documentation convention lets the static checker distinguish a missing script from a valid bare executable shorthand; it is not a claim that pnpm forbids the shorthand. State a non-default working directory in the command with `-w`, `--dir`, or an exact package filter.

The public checker also validates governed release wording, localized sidebar routes, public-family export coverage, authoring placeholders, and `ui-libraries/` prose quality per the [prototype documentation style guide](prototype-docs-style-guide.md). It runs the repository checks as part of the existing documentation gate; no extra network crawl or full-regression workflow is needed. See the [checker guide](../../scripts/docs/README.md) for exact scope and limitations. Do not infer prose correctness, external-link availability, heading-anchor validity, or successful command execution from these structural checks.

For Agent entry or workflow changes, also run `check:agent-operations` and `check:agent-doc` as directed by `AGENTS.md`. Changes to definitions, generators, public pages, or implementation require their own applicable checks. Never replace those checks with link validation.
