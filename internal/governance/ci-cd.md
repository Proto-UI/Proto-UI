# Proto UI CI/CD Guide

This document describes the repository's GitHub Actions workflows and how they relate to global exact-version and launch-package governance.

The current published prerelease release train is `0.2.0-rc.7` under the npm `next` channel.

## Workflows

| Workflow | File | Purpose |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | Type, test, spec, and global-version gates for pull requests and `main` |
| Release Packages | `.github/workflows/release-packages.yml` | Manual release scan, stage rehearsal, or full-set publication |
| Release Cadence | `.github/workflows/release-cadence.yml` | Periodic reminder based on the latest `v*` release tag |

## CI Workflow (`ci.yml`)

CI runs for pull requests, pushes to `main`, and manual dispatch. In addition to type and test checks, `check-version-governance` verifies that:

- root `VERSION` exactly matches every public `@proto.ui/*` package
- exactly one V entity declares the current version
- entity version references from `0.2.0-rc.0` onward resolve to declared V entities
- the launch-governance release line matches the current version

Every new numeric version must therefore be a reviewed release train; a package-local bump cannot bypass the gate.

`public_package_plan` derives the affected public package graph from the pull request diff. Package changes select the changed package, its reverse consumers, and every upstream public dependency required to build that set. Repository-wide build, release, lockfile, manifest, or workflow changes select all public packages. The resulting build job validates the generated manifests, produces JavaScript plus declaration artifacts, runs native ESM import smokes, and enforces representative gzip budgets. Release-stage and isolated-consumer jobs may skip a pull request whose affected public package graph is empty; the full set still runs on `main` and manual dispatch.

`release-consumer-react` additionally builds tarballs for every public package and installs the current declared release closure in a temporary React + Vite project outside the monorepo. The gate prevents `@proto.ui/*` from falling back to the npm registry or workspace sources, validates every non-wildcard export target in staged manifests, then verifies CLI facade generation, TypeScript, a production build, and baseline runtime behavior. Before expanding the full fixture, it generates only Shadcn Button and checks that the final Rollup module graph contains no other Base/Shadcn prototype family. This is a family-boundary assertion rather than a fixed bundle-size budget.

## Release Workflow (`release-packages.yml`)

The workflow is triggered manually through `workflow_dispatch`.

### Inputs

- `mode`: `scan` / `stage` / `publish-all`
- `profile`: `workspace` / `launch`
- `include_approved_candidates`: affects only the launch audit set
- `resume_published`: partial-release recovery only; skips only identical published tarballs
- `publish_delay_ms`, `max_publish_retries`, `retry_delay_ms`: npm rate-limit controls

The workflow does not accept ad hoc `version`, `tag`, or `only` inputs. Version and dist-tag come from reviewed repository state: prereleases use `next`, while stable releases use `latest`.

### Safety Rules

- `publish-all` is allowed only on `main`.
- `publish-all` requires the `workspace` profile; `launch` is for product-scope audit and rehearsal only.
- Real publication is protected by the GitHub `npm` environment and npm Trusted Publishing through OIDC.
- `stage` and `publish-all` fail before package staging unless every public package identity is already readable from the npm registry. The check cannot inspect private Trusted Publisher settings, which remain a maintainer responsibility.
- Concurrency prevents overlapping release runs for the same ref.
- The workflow creates `v<version>` only after every public package publishes successfully.

## Launch Governance And The Publish Set

`internal/governance/launch-package-governance.json` defines priorities for the launch product promise, documentation, and smoke coverage.

- `--profile launch` checks launch commitment and candidate packages from that file.
- `--include-approved-candidates` expands only the launch audit set.
- `--check-governance` verifies that every workspace package is classified.

These tiers do not control the real npm publish set. Global exact-version governance requires the `workspace` profile to publish every public `@proto.ui/*` package together.

## Suggested Release Runbook

1. Create or update the draft V entity and align `VERSION` plus package manifests in one PR.
2. Regenerate and review the release BOM and notes, then run `pnpm release:assets:check`.
3. For every newly named public package, publish a clearly non-release bootstrap version and configure its Trusted Publisher before the release rehearsal.
4. Run `pnpm release:rehearse` for the complete sequential non-publishing gate. CI keeps the same checks split into parallel jobs for feedback speed.
5. Review the launch product scope and isolated React plus multi-host CLI tarball consumer results.
6. After merge to `main`, run `publish-all` with the `workspace` profile.
7. Verify the GitHub release/spec-snapshot evidence and promote the V entity to `active` in a follow-up PR.

## Local Shortcuts

- `pnpm check:release-version`
- `pnpm release:bom`
- `pnpm release:assets:check`
- `pnpm release:registry:check`
- `pnpm release:scan:launch`
- `pnpm release:stage:launch`
- `pnpm release:stage`
- `pnpm release:smoke:react`
- `pnpm release:smoke:cli`
- `pnpm release:rehearse`
- `pnpm build:packages`
- `pnpm check:package-manifests`
- `pnpm check:package-budgets`
- `pnpm analysis:monorepo --benchmark --out <path>`

There is no package-local real-publish shortcut. Package-local fixes enter the next global release train.
