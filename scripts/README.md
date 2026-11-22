# Repository tooling

This directory contains build/generation commands, repository checks, evidence runners and maintenance tools. [`package.json`](../package.json) exposes the maintained top-level commands. Run them from the repository root using Node 24 and its declared Corepack/pnpm version.

## Find the owning tool

| Directory | Responsibility and entry |
| --- | --- |
| [`build/`](build/) | Package builds and manifest synchronization. |
| [`spec/`](spec/) | Catalog checks, lifecycle reports and generated projections; see [`spec/README.md`](../spec/README.md). |
| [`docs/`](docs/README.md) | Public-documentation drift checks and documentation evidence. |
| [`coverage-matrices/`](coverage-matrices/README.md) | Source/evidence reconciliation for the coverage matrices. |
| [`release/`](release/) | Version checks, release assets, rehearsal, consumer smoke and publication; see the [release workflow](../internal/governance/release-workflow.md). |
| [`ci/`](ci/) and [`test/`](test/) | CI scheduling/reporting and test/evidence harnesses. |
| [`agent-operations/`](agent-operations/) and [`autonomous-maintenance/`](autonomous-maintenance/) | Governed contributor and maintenance workflows; start at [`AGENTS.md`](../AGENTS.md). |
| [`benchmark/`](benchmark/) | Coordinators and validators for [`benchmarks/`](../benchmarks/README.md). |
| [`analysis/`](analysis/) | Package cost, conformance and other bounded engineering analyses. |
| [`compiler/`](compiler/) and [`gpui/`](gpui/) | Compiler consumer checks and native protocol/style/session fixture generation. |
| [`styles/`](styles/) and [`components/`](components/) | Style/token and component-preset generators. |
| [`prototypes/`](prototypes/) and [`feedback/`](feedback/) | Scoped prototype/Feedback consumer evidence and supporting fixtures. |
| [`preview/`](preview/README.md) | Review-preview artifact preparation and serving. |
| [`issues/`](issues/) | Issue preparation/reconciliation tools. |
| [`sync-shared-links.mjs`](sync-shared-links.mjs) | Synchronizes maintained prose links from [`shared/links.json`](../shared/links.json). |

## Change a tool or its output

Keep a command beside the domain it serves, with focused fixtures/tests where they check meaningful behavior. Package runtime logic belongs in its package; an evidence runner should consume that implementation through the declared surface.

Generated files are projections: change the source or generator, then regenerate. Use available `check:*` or `--check` modes to detect drift. Read a command's implementation and domain guidance before running it: `scripts/` includes both local validators and external publication/Issue writers, with different effects and authorization boundaries.

Add or update the domain README and the root command when the public contributor entry changes. Follow the [documentation policy](../internal/governance/documentation-policy.md); source paths, observed output and actual validation scope should remain traceable.
