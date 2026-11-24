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

## Type checking and independent consumer projects

`check:types` checks the root [workspace TypeScript project](../tsconfig.workspace.json) and then the website's own project. The workspace retains the strict options in [the root configuration](../tsconfig.json). Some tooling directories contain independent consumer projects with their own dependency installation and evidence owner:

| Project boundary | Dependency and validation owner |
| --- | --- |
| [`analysis/declarative-agent-ui/`](analysis/declarative-agent-ui/README.md) | The pinned #757 React 18/Radix study has its own npm lockfile. Its documented sequence is `npm ci`, schema/mapping tests, the actual esbuild producer, and the browser runner. Those receipts establish their stated scope; they do not establish standalone TypeScript strict success. The historical app, dependency snapshot and measured inputs remain unchanged. |
| [`analysis/invisible-consumption/starter/`](analysis/invisible-consumption/README.md) | The operator materializes and installs this ordinary consumer separately. Its declared `npm run build` includes `tsc --noEmit` and Vite; the owning producer retains actual command and artifact receipts. A proposed or blocked study is not a passed consumer run. |
| [`release/consumer-smoke/`](release/consumer-smoke/README.md) | Release tooling constructs packed consumer environments with their declared dependencies and checks. The owning release receipts determine which type, build and presentation checks ran. |

These exact project directories are outside the root workspace type project; this is not an exclusion of `scripts/analysis/**` or a waiver for normal repository tooling. An excluded consumer's dependencies are not supplied by the root pnpm install, and a root type-check pass does not certify that consumer. Read its owning instructions and retain the actual command results. The [A2 CI diagnosis](../internal/records/2026-11-22-ci-a2-type-project-boundary.md) records the declarative study's original workspace failure and this project-boundary repair without rewriting the experiment's evidence.

## Change a tool or its output

Keep a command beside the domain it serves, with focused fixtures/tests where they check meaningful behavior. Package runtime logic belongs in its package; an evidence runner should consume that implementation through the declared surface.

Generated files are projections: change the source or generator, then regenerate. Use available `check:*` or `--check` modes to detect drift. Read a command's implementation and domain guidance before running it: `scripts/` includes both local validators and external publication/Issue writers, with different effects and authorization boundaries.

Add or update the domain README and the root command when the public contributor entry changes. Follow the [documentation policy](../internal/governance/documentation-policy.md); source paths, observed output and actual validation scope should remain traceable.
