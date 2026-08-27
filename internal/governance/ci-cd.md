# Proto UI CI/CD guide

This document describes the repository's GitHub Actions workflows and how they relate to global exact-version and launch-package governance.

Release identity comes from the applicable `V-*` entity and immutable release evidence. Do not hard-code a current version in this guide.

## Workflows

| Workflow | File | Purpose |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | Type, test, spec, and global-version gates for pull requests and `main` |
| Release Packages | `.github/workflows/release-packages.yml` | Manual release scan, stage rehearsal, or full-set publication |
| Release Cadence | `.github/workflows/release-cadence.yml` | Periodic reminder based on the latest `v*` release tag |
| Agent Operations Shadow | `.github/workflows/agent-operations-shadow.yml` | Read-only Issue and pull-request routing experiment |
| RepoSteward Portfolio Shadow Trial | `.github/workflows/reposteward-portfolio-shadow.yml` | Manual read-only external portfolio experiment |

## CI workflow (`ci.yml`)

CI runs for pull requests, pushes to `main`, and manual dispatch. In addition to type and test checks, `check-version-governance` verifies that:

- root `VERSION` exactly matches every public `@proto.ui/*` package
- exactly one V entity declares the current version
- entity version references from `0.2.0-rc.0` onward resolve to declared V entities
- the launch-governance release line matches the current version

Every new numeric version must therefore be a reviewed release train; a package-local bump cannot bypass the gate.

Repository policy requires the relevant CI evidence before merge. GitHub rulesets and required-check configuration are external controls and must be audited separately. A green convention is not the same as a platform-enforced merge gate. The dated collaboration forensics record documents the observed configuration and known gaps.

`public_package_plan` derives the affected public package graph from the pull request diff. Package changes select the changed package, its reverse consumers, and every upstream public dependency required to build that set. Repository-wide build, release, lockfile, manifest, or workflow changes select all public packages. The resulting build job validates the generated manifests, produces JavaScript plus declaration artifacts, runs native ESM import smokes, and enforces representative gzip budgets. Release-stage and isolated-consumer jobs may skip a pull request whose affected public package graph is empty; the full set still runs on `main` and manual dispatch.

`release-consumer-react` additionally builds tarballs for every public package and installs the current declared release closure in a temporary React + Vite project outside the monorepo. The gate prevents `@proto.ui/*` from falling back to the npm registry or workspace sources, validates every non-wildcard export target in staged manifests, then verifies CLI facade generation, TypeScript, a production build, and baseline runtime behavior. Before expanding the full fixture, it generates only Shadcn Button and checks that the final Rollup module graph contains no other Base/Shadcn prototype family. This is a family-boundary assertion rather than a fixed bundle-size budget.

## Agent Operations Shadow workflow (`agent-operations-shadow.yml`)

This Phase A experiment runs hourly at minute 17 UTC or by maintainer manual dispatch. It collects a bounded snapshot of open Issues and pull requests, runs a read-only structured analysis when `OPENAI_API_KEY` is configured, validates the result, and uploads the input and report with 14-day retention. If the key is absent, the workflow preserves only the bounded input snapshot. Hourly is the current automatic trigger; event-driven invocation is intended future architecture and is not deployed or evidenced by this repository state.

The workflow has read-only `contents`, `issues`, and `pull-requests` permissions, disables persisted checkout credentials, and runs Codex with the `:read-only` permission profile and `drop-sudo`. It does not run from pull-request events, post comments, change labels, create branches or pull requests, or authorize integration. Any future GitHub write permission requires a separate reviewed policy change and an explicit maintainer decision under `internal/agent-operations/**`.

Ordinary Contributor Agents use the lazy skill registry under `internal/agent-operations/skills.yaml`; it is not part of the scheduled shadow workflow. `$pui-dev` routes ordinary development, while `$pui-maintain` routes the separate autonomous-maintenance protocol.

## Private contributor preview workflows (`poppy-preview-*.yml`)

Five workflows implement the private Poppy/Cloudflare preview boundary:

| Workflow | Trigger | Permissions / external boundary |
| --- | --- | --- |
| `poppy-preview-build.yml` | `pull_request` and trusted `workflow_dispatch` bootstrap | `contents: read`; no repository or external deployment secrets; builds the exact PR head and uploads an untrusted artifact plus an Actions-controlled head binding. |
| `poppy-preview-bootstrap.yml` | trusted default-branch installation/update (`push` only) | `actions: write`, `contents: write`, `pull-requests: read`; enumerates live PRs, dispatches secret-free exact-head builds, then emits `poppy_preview_build_completed` repository-dispatch events. |
| `poppy-preview-deploy.yml` | completed build `workflow_run` or `poppy_preview_build_completed` `repository_dispatch` | platform-selected default-branch code with `actions: read`, `contents: read`, `pull-requests: write`; no manual dispatch entry; validates live PR/head/workflow/artifacts, sanitizes without executing contributor code, deploys to Cloudflare, reports lifecycle to private Poppy, and updates one sticky comment. |
| `poppy-preview-close.yml` | `pull_request_target: closed` | trusted default-branch cleanup with `contents: read`, `pull-requests: write`; deletes the per-PR Cloudflare project and reports Closed to Poppy. |
| `poppy-preview-security.yml` | preview-workflow/integration changes on PR or `main` | read-only Node 22 evidence lane; runs the focused sanitizer/Worker/lifecycle/browser tests, pinned-checksum actionlint, and byte-for-byte installed/template workflow lockstep. It is repository CI evidence but is **not currently configured as a platform-required status check**. |

Contributor artifacts never receive Cloudflare/Poppy secrets. Deploy/cleanup consume trusted repository code and private external control-plane APIs; exact endpoint, tuple binding, access policy, and post-merge E2E requirements are documented in `integrations/proto-ui-preview/README.md`. Merge-time green checks cannot prove default-branch `workflow_run`, bootstrap, live OAuth identities, failure convergence, or close cleanup end to end; these remain post-merge production acceptance gates.

## Release workflow (`release-packages.yml`)

The workflow is triggered manually through `workflow_dispatch`.

### Inputs

- `mode`: `scan` / `stage` / `publish-all`
- `profile`: `workspace` / `launch`
- `include_approved_candidates`: affects only the launch audit set
- `resume_published`: partial-release recovery only; skips only identical published tarballs
- `publish_delay_ms`, `max_publish_retries`, `retry_delay_ms`: npm rate-limit controls

The workflow does not accept ad hoc `version`, `tag`, or `only` inputs. Version and dist-tag come from reviewed repository state: prereleases use `next`, while stable releases use `latest`.

### Safety rules

- `publish-all` is allowed only on `main`.
- `publish-all` requires the `workspace` profile; `launch` is for product-scope audit and rehearsal only.
- Real publication selects the GitHub `npm` environment and uses npm Trusted Publishing through OIDC. Environment reviewers, branch restrictions, and administrator bypass are external configuration; verify them immediately before a release instead of inferring protection from the workflow file.
- `stage` and `publish-all` fail before package staging unless every public package identity is already readable from the npm registry. The check cannot inspect private Trusted Publisher settings, which remain a maintainer responsibility.
- Concurrency prevents overlapping release runs for the same ref.
- The workflow creates `v<version>` only after every public package publishes successfully.

## Launch governance and the publish set

`internal/governance/launch-package-governance.json` defines priorities for the launch product promise, documentation, and smoke coverage.

- `--profile launch` checks launch commitment and candidate packages from that file.
- `--include-approved-candidates` expands only the launch audit set.
- `--check-governance` verifies that every workspace package is classified.

These tiers do not control the real npm publish set. Global exact-version governance requires the `workspace` profile to publish every public `@proto.ui/*` package together.

## Suggested release runbook

1. Create or update the draft V entity and align `VERSION` plus package manifests in one PR.
2. Regenerate and review the release BOM and notes, then run `pnpm release:assets:check`.
3. For every newly named public package, publish a clearly non-release bootstrap version and configure its Trusted Publisher before the release rehearsal.
4. Run `pnpm release:rehearse` for the complete sequential non-publishing gate. CI keeps the same checks split into parallel jobs for feedback speed.
5. Review the launch product scope and isolated React plus multi-host CLI tarball consumer results.
6. After merge to `main`, obtain the current human release approval and run `publish-all` with the `workspace` profile.
7. In a separate evidence change, verify registry, tag, GitHub Release, assets, workflow head, deployment, and spec-snapshot digests before promoting the V entity according to its approved lifecycle.

## Local shortcuts

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
