# Proto UI CI/CD guide

This document describes the repository's GitHub Actions workflows and how they relate to global exact-version and launch-package governance.

Release identity comes from the applicable `V-*` entity and immutable release evidence. Do not hard-code a current version in this guide.

## Workflows

| Workflow | File | Purpose |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | Lightweight PR planning and policy checks; full regression on schedule or explicit dispatch |
| Release Packages | `.github/workflows/release-packages.yml` | Manual release scan, stage rehearsal, or full-set publication |
| Release Cadence | `.github/workflows/release-cadence.yml` | Periodic reminder based on the latest `v*` release tag |
| Agent Operations Shadow | `.github/workflows/agent-operations-shadow.yml` | Read-only Issue and pull-request intake/reconciliation lane |
| RepoSteward Portfolio Shadow Trial | `.github/workflows/reposteward-portfolio-shadow.yml` | Manual read-only external portfolio experiment |
| Intranet preview build | `.github/workflows/intranet-preview-build.yml` | Secret-free exact-PR-head documentation artifact build |
| Intranet preview checks | `.github/workflows/intranet-preview-checks.yml` | Focused artifact admission, publication and static-serving checks |

The remaining per-file event inventory is audited in [Regression cadence and event inventory](#regression-cadence-and-event-inventory) below.

## CI workflow (`ci.yml`)

CI runs for pull requests, manual dispatch, and three scheduled regression cycles per day against the default-branch head. No workflow in the repository triggers on `push`; the scheduled cycle is the main-line regression entry point. In addition to type and test checks, `check-version-governance` verifies that:

- root `VERSION` exactly matches every public `@proto.ui/*` package
- exactly one V entity declares the current version
- entity version references from `0.2.0-rc.0` onward resolve to declared V entities
- the launch-governance release line matches the current version

Every new numeric version must therefore be a reviewed release train; a package-local bump cannot bypass the gate.

Repository policy requires the relevant CI evidence before merge. GitHub rulesets and required-check configuration are external controls and must be audited separately. A green convention is not the same as a platform-enforced merge gate. The dated collaboration forensics record documents the observed configuration and known gaps.

`public_package_plan` derives the affected public package graph from the pull request diff without building it. Package changes select the changed package, its reverse consumers, and every upstream public dependency required to build that set. Repository-wide build, release, budget, lockfile, manifest, or workflow changes select all public packages. The full-cycle build validates generated manifests, produces JavaScript plus declaration artifacts, runs native ESM import smokes, and enforces representative gzip budgets.

`release-consumer-react` additionally builds tarballs for every public package and installs the current declared release closure in a temporary React + Vite project outside the monorepo. The gate prevents `@proto.ui/*` from falling back to the npm registry or workspace sources, validates every non-wildcard export target in staged manifests, then verifies CLI facade generation, TypeScript, a production build, and baseline runtime behavior. Before expanding the full fixture, it generates only Shadcn Button and checks that the final Rollup module graph contains no other Base/Shadcn prototype family. This is a family-boundary assertion rather than a fixed bundle-size budget.

Automatic PR updates run policy parsing, exact-version checks, package planning and browser-inventory planning, not full builds, types, Rust, browser execution or package consumers. Full checks run on schedule or explicit exact-ref dispatch. A skipped PR check is not successful full validation: trusted CI/DCO and independent exact-head review remain required for integration, and an older main baseline cannot supply missing exact-head checks. Dispatch a completed reviewed branch once when those checks are needed, rather than on each development push.

## Regression cadence and event inventory

The release-level cadence policy — red-light rules, repair-only mode and resume conditions — is owned by [release-0.3-plan.md](release-0.3-plan.md); this section records only the workflow implementation and trigger facts, and intentionally does not restate that policy.

### Scheduled regression cycle

`ci.yml` is the only workflow that owns the regression schedule. It runs the complete CI lane set — lockstep, package plan/build, types, Rust, the full `runtime-ci.mjs` suite plan (the complete registered browser-suite inventory; the plan fails closed on any unregistered or unassigned suite), release scan/stage, isolated consumers, and the coverage-governance and agent-operations fixture checks invoked as reusable jobs — against the default-branch head in three stable slots:

| Cron         | Scheduled time (UTC) | Asia/Shanghai equivalent |
| ------------ | -------------------- | ------------------------ |
| `0 0 * * *`  | 00:00                | 08:00                    |
| `0 8 * * *`  | 08:00                | 16:00                    |
| `0 16 * * *` | 16:00                | 00:00 (next day)         |

`cycle-report` fails closed whenever any lane outcome is not `success`. Queue delays beyond 60 minutes and missed slots surface as workflow annotations and receipt incidents, not as fabricated greens. Only a completed green cycle forms a baseline; queued, unfinished, cancelled or failed cycles count as non-green (including the current cycle itself), and slot/miss analysis starts at the policy activation instant so early history can never fabricate a missed slot.

An elapsed missing planned slot also joins the non-green consecutive-cycle sequence after the existing missed-slot grace period. It interrupts scheduled recovery and can combine with another red/unknown planned cycle to require repair-only mode; a successful manual diagnosis does not erase that scheduled sequence. This is an unknown planned outcome, not an invented native workflow run.

Manual `workflow_dispatch` runs the same complete lane set for targeted diagnosis and produces the same receipt with `scheduledSlot: null`; it does not create cycles on behalf of the schedule.

Scheduled runs publish their triggering cron in the native `display_title` as `regression-cycle:<cron>`. Historical slot attribution uses that declared cron, not the closest slot to `created_at`: an 08:00 cycle created at 16:30 still covers 08:00 and cannot hide a missing 16:00 cycle. A missing or unrecognized declaration is explicit unknown attribution; it occupies no slot, cannot form a scheduled baseline or recovery green, and still interrupts the recovery chain when observed before the current run was created.

History collection filters the native workflow-runs endpoint to `event=schedule` and the exact source branch, paginates lazily through the post-activation interval, and preserves the native run metadata. It fails closed on incomplete acquisition instead of treating the latest 100 mixed PR/manual runs as complete scheduled history. The report therefore retains early missed slots even after more than 100 later cycles; a manual run never evicts or impersonates a scheduled cycle.

`ci-production-suites.yml` includes the dedicated owners of the complete `PRODUCTION_BROWSER_SUITES` inventory in [runtime-test-plan.mjs](../../scripts/test/runtime-test-plan.mjs), including production Search through `homepage-visual-evidence.yml`; they are not silently excluded by the shared development shards. The 0.3 governance review source `4db52751` registers **34 suites**; the original 29-suite count describes the initial cadence inventory. Two independent dependency chains bound heavyweight workflow fan-out, retain each lane's artifacts, and continue after predecessor failures unless the cycle is cancelled. The four former push-only source-check lanes are also called once per cycle. Experimental suites retain their real failures; their execution does not promote another family into 0.3.

Activation is the first-parent integration timestamp that introduced `scripts/ci/cycle-report.mjs`, read from full source history, not the planning date. A successful current cycle resets the red chain; two successive scheduled green cycles are separately counted for recovery. With no green baseline, the 24-hour timer starts at activation. Manual runs cannot manufacture scheduled recovery cycles.

### Concurrency and cancellation

- Pull-request lanes group by `ci-<ref>-pr` with `cancel-in-progress: true`: a newer push to the same PR supersedes its own stale run only.
- Scheduled and dispatched cycles group by `ci-<ref>-cycle` with `cancel-in-progress: false`: an active evidence-producing cycle is never cancelled, and duplicate queued cycles on the same source line coalesce into the newest pending run.
- No other workflow carries a regression schedule, so the cycle is the single coordinated entry; dedicated evidence lanes no longer fire automatically on pull requests (they stay manual/callable for exact-ref diagnosis) and are not duplicated on a timer.

### Event inventory audit

Every workflow's event triggers were audited under the no-push policy. Retained triggers and their justification:

| Files | Triggers after change | Rationale |
| --- | --- | --- |
| `ci.yml` | `pull_request`, `workflow_dispatch`, `schedule` (3 slots) | Lightweight PR metadata; complete regression only on schedule or explicit exact-ref dispatch. Required check names and merge requirements are unchanged; skipped checks do not grant integration clearance |
| `effect-graph-model.yml`, `shadcn-style-source.yml`, `intranet-preview-checks.yml`, `compiler-isolated-static-smoke.yml`, `compiler-wc-runner-preflight.yml` | `pull_request` (+ paths), `workflow_dispatch`, `workflow_call` | The lightweight platform-check allowlist: bounded node runs with no browser, no doc/package build, and no full workspace install. These are the only automatic PR triggers outside ci.yml |
| `coverage-governance.yml`, `agent-operations-fixtures.yml`, `ci-production-suites.yml` | `workflow_dispatch`, `workflow_call` | Included by ci.yml on full cycles; cycle-report consumes their terminal outcomes |
| `agent-operations-shadow.yml` | `schedule` (`17 * * * *`), `workflow_dispatch` | Read-only intake/reconciliation lane on an hourly timer; unrelated to regression execution |
| `release-cadence.yml` | `schedule` (`7 10 * * 4`), `workflow_dispatch` | Weekly release reminder only |
| `release-packages.yml`, `reposteward-portfolio-shadow.yml` | `workflow_dispatch` | Manual-only publication rehearsal/publication and read-only portfolio experiment; unchanged |
| `intranet-preview-build.yml` | `workflow_dispatch` (+ required `pr_number`/`expected_head_sha` inputs), `workflow_call` | Explicit inputs bind the build to the stated open PR and exact head. The 30-minute builder has no automatic PR trigger |
| All other evidence/diagnostic lanes | `workflow_dispatch`, `workflow_call` (+ guarded ref bindings) | Per-change evidence fan-out is off: shared suites are covered by the ci.yml cycle, and every dedicated lane stays callable for exact-ref diagnosis; no heavy lane owns an automatic trigger |

The `pull_request` allowlist above is enforced by `scripts/ci/check-ci-schedule.mjs` (`pull-request-not-allowed`): adding an automatic PR trigger to any other file fails the `ci-config-audit` lane. The manual/callable lanes carry `github.event.pull_request.*` only behind `|| github.sha`-style fallbacks so they can never render empty refs.

### Event-context and provenance rules

- Workflows that can run without a pull-request event must not read `github.event.pull_request.*` without a fallback; the source audit in `scripts/ci/check-ci-schedule.mjs` enforces this and is itself executed by the `ci-config-audit` job on every lane.
- Scheduled and dispatched cycles check out `github.sha` exactly. `cycle-plan` binds the spec-authoring delta to the last successful scheduled source on the same branch, or to the policy-introduction parent before the first green cycle. It verifies that base is an ancestor. Checking only `HEAD^1` would miss earlier commits between daily cycles and is deliberately not used.
- Coverage-matrix validation is a full source snapshot, not a changed-file delta: `collectCoverageMatrixIssues` iterates every matrix on every invocation. Scheduled/manual `COVERAGE_BASE_REVISION` and `COVERAGE_HEAD_REVISION` deliberately remain the exact checkout SHA, preserving the pre-policy main-lane behavior. These values provide evidence-promotion ancestry context; equal values do not skip matrices. Do not substitute the spec-authoring delta base or claim that a zero delta proves coverage.
- The trusted CI evidence contract (`workflowNames: [CI]`, `workflowPaths: [.github/workflows/ci.yml]`, check names `lockstep-check`, `public_package_plan`, `type-check`, `test`, `release-scan` in `internal/agent-operations/capability-policy.yaml`) is unchanged; the DCO attribution gate is the external probot app configured in `.github/dco.yml` and is unchanged.

### Protected lanes

- Publication and release are unaffected: `release-packages.yml` remains manual-only with its existing environment/OIDC protections; `release-cadence.yml` remains a weekly reminder. The regression cycle never publishes, deploys, or mutates access, secrets, rulesets or branch protections.
- Queue recovery operates only on identified regression runs; the cycle never cancels a release or another owner's diagnostic.
- A manually dispatched production leaf can share its concurrency group with an active scheduled caller. Shared cycle leaves use `cancel-in-progress: false`, preserving the active evidence run and serializing same-group diagnosis rather than creating parallel duplicate work. The config audit follows local workflow calls recursively and rejects a reachable leaf that can cancel active work; replacing a pending duplicate is not an executed regression result.

### Verification plan

Config-parse verification (runs in the `ci-config-audit` job on every CI lane):

- `node scripts/ci/check-ci-schedule.mjs` audits every workflow file: no `push`/`merge_group`/`pull_request_target` triggers, exactly one regression-schedule owner with the three slots, no duplicate schedules, guarded `pull_request` context under non-PR events, declared permissions, trusted job names present in `ci.yml`, and reusable lanes intact.
- `ci.yml` has no workflow-level token grant. The history-reading `cycle-plan` and `cycle-report` jobs carry explicit `contents: read` and `actions: read`; the callable coverage-governance job retains its declared read-only Issue/PR permissions. No cycle job receives a write grant.
- `node --test scripts/ci/test/ci-scheduling-policy.test.mjs` covers the same rules against positive and negative fixture inventories plus the live tree.

Obsolete source-text tests that pin per-PR evidence triggers, unconditional aggregate execution or cancelling shared evidence are removed, not re-pinned to new YAML strings. The scheduling audit exercises the replacement policy with positive and negative workflow inventories; the surviving contrast, homepage, startup, Dropdown, Code Scroll and Quickstart behavior checks and native evidence suites retain their existing assertions. Code Scroll executes its actual observer through syntax-bound extraction rather than whitespace-sensitive source delimiters; the native wheel oracle is unchanged.

Search startup profiling remains bound to its original failed application SHAs. Its unit runner inputs retain those checkouts' inert warmup list rather than reading the current runner's imported plan; the production parser, readiness deadline, capture verdicts, sanitization and cleanup checks are unchanged.

Behavioral verification (performed by the parent on the first post-merge cycles):

- On the first scheduled slot, confirm a `ci.yml` run with `event=schedule` produces a `regression-cycle-<sha>` artifact whose `sourceRevision` equals the default-branch head at trigger time, whose lane inventory covers every `cycle-report.needs` entry including production suites, and whose receipt reports the cron slot, actual start and queue delay.
- Confirm a `workflow_dispatch` run produces the same receipt with `scheduledSlot: null` and that a queued duplicate cycle coalesces rather than cancelling the active run.
- Confirm one `workflow_dispatch` invocation of a former push lane (e.g. `shadcn-style-source.yml`) completes without pull_request-context errors.
- Confirm PR updates run only metadata lanes and DCO, with full checks explicitly skipped rather than reported successful; verify exact-ref dispatch supplies real full check outcomes before integration. `cycle-report` does not run on the PR lane.

## Agent Operations Shadow workflow (`agent-operations-shadow.yml`)

This Phase A intake and reconciliation lane runs hourly at minute 17 UTC or by maintainer manual dispatch. It collects a bounded snapshot of open Issues and pull requests, runs a read-only structured analysis when `OPENAI_API_KEY` is configured, validates the result, and uploads the input and report with 14-day retention. If the key is absent, the workflow preserves the bounded input snapshot. Hourly is the current automatic trigger; event-driven invocation is intended future architecture and is not deployed or evidenced by this repository state.

The workflow has read-only `contents`, `issues`, and `pull-requests` permissions, disables persisted checkout credentials, and runs Codex with the `:read-only` permission profile and `drop-sudo`. Those controls confine this ingestion credential: the workflow observes and reconciles but does not itself post comments, change labels, create branches, submit reviews, or integrate a pull request. They are not a global ceiling on Contributor Agents or the local review/integration schedule.

Ordinary Contributor Agents use the lazy skill registry under `internal/agent-operations/skills.yaml`; it is not part of the scheduled shadow workflow. `$pui-dev` routes ordinary development, while `$pui-maintain` routes the separate autonomous-maintenance protocol. Under the `pending-runtime-identity` standing authorizations, the scheduled lane remains read-only observation and reconciliation; human-assisted review or integration requires explicit current-user authorization, and any future standing activation still requires matching authorization, trusted evidence, a fresh canonical input, live credential permission, and agreement with review state and repository rules. Human decisions remain for unresolved product direction and privileged or irreversible operations.

## Intranet contributor preview workflows

`intranet-preview-build.yml` runs only through manual dispatch or a reusable call with the requested PR number and exact expected head SHA. It has only `contents: read`, uses a disposable hosted builder and receives no deployment secrets. It uploads an Actions identity marker before executing the contributor checkout, then uploads the canonical documentation ZIP. Both artifacts have three-day retention.

`intranet-preview-checks.yml` runs the focused native Node admission, extraction, sanitation, publication and serving suite when preview files change on a PR, or through manual dispatch/reusable calls. Main-line execution belongs to the coordinated regression cycle, not a push trigger. Neither workflow deploys Poppy, calls Cloudflare, writes PR comments, or executes contributor code on the persistent publisher.

The sole publisher is a separately configured trusted intranet process. It downloads hostile artifacts, revalidates the live PR/head/run/attempt and supersession, and publishes ordinary non-executable files under separate generation origins. The static server has no credential or control API. An intranet audience replaces the retired per-author/reviewer OAuth access policy; polling and the five-minute catalog lease provide bounded, not instantaneous, revocation. Configuration, security limits and runtime acceptance are documented in `scripts/preview/README.md`.

The old Poppy workflows, Pages provider, dcbot fallback and duplicated integration templates are removed from source. External workflow registrations, preview-only credentials, Pages resources and deployed bot/edge callbacks require live retirement evidence. Source deletion and green tests do not establish that external cleanup or the new hosted-build-to-intranet path has completed.

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
- `stage` and `publish-all` fail before package staging unless every public package identity is readable and its bootstrap dist-tags/deprecation state meets the release gate. The check cannot inspect private Trusted Publisher settings, which remain a maintainer responsibility.
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
6. After merge to `main`, record the current privileged publication authorization and run `publish-all` with the `workspace` profile.
7. In a separate evidence change, verify registry, tag, GitHub Release, assets, workflow head, deployment, and spec-snapshot digests before advancing the V entity according to its governed lifecycle.

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
- `pnpm check:package-budgets:strict`
- `pnpm analysis:monorepo --benchmark --out <path>`

There is no package-local real-publish shortcut. Package-local fixes enter the next global release train.

During the explicitly authorized Finf rapid-development phase, `check:package-budgets` reports size overruns as advisory while retaining the original budgets and failed comparisons. Build/measurement errors still fail. Use `check:package-budgets:strict` for strict enforcement; see the [scope, 68-goal expiry and restoration duty](finf-package-budgets.md).
