# Agent Operations

This directory defines the operational control plane for Agent-assisted GitHub work in Proto UI. It is not a project truth source and does not define Proto UI semantics. Applicable `spec/**` entities remain authoritative according to lifecycle.

Ordinary contributor Agents enter through `$pui-dev` and the composable skill registry in `skills.yaml`. Their capability and assessment rules live in `capability-policy.yaml` and `contributor-agents.md`. These files define task eligibility and routing; they do not grant GitHub permission.

Agent Operations coordinates multiple workflow families without flattening their domain-specific protocols:

- `issue-steward`: classify and route GitHub Issues;
- `pr-steward`: summarize pull-request state and route the next review or decision;
- `reposteward-pr-portfolio`: manually trial RepoSteward's read-only PR portfolio snapshot as an external `pr-steward` evidence source;
- `autonomous-maintenance`: delegate bounded discovery and remediation to the separate workflow under `internal/autonomous-maintenance/**`.

`autonomous-tasks.yaml` is the machine-readable catalog of deployed, manual, and candidate recurring task families. `autonomous-tasks.md` explains which parts actually run today. Candidate entries are designs, not active automation.

## Current stage: Phase A shadow

Phase A is read-only with respect to GitHub and tracked repository files during a run. It collects a bounded snapshot of open Issues and pull requests, gives that untrusted snapshot to a sandboxed Agent, validates the structured proposal, and preserves the snapshot and report as workflow artifacts.

The current automatic repository workflow runs once per hour at minute 17 UTC and may also be dispatched manually. Webhook / event-driven invocation is the reviewed intended architecture (#485 discussion), not deployed state: the catalog and canonical input currently contain no external controller evidence. If that controller is later deployed and cited, the bounded hourly sweep may become a reconciliation fallback for failed deliveries or listener-redeployment gaps; until then, hourly is the current automatic trigger. The cadence changes observation frequency only: it does not authorize comments, reviews, labels, assignment, code changes, approval, or merge. It stays distinct from the manually dispatched RepoSteward portfolio trial recorded in #483, which is not a scheduled reconciliation.

Phase A does not:

- comment on, label, assign, edit, close, or reopen an Issue or pull request;
- create a branch, commit, pull request, task, or review;
- approve, merge, publish, release, or promote a stable guarantee;
- treat an Agent classification as a maintainer decision;
- reuse `internal/autonomous-maintenance/phase-0/runs.yaml` as a GitHub event ledger.

The RepoSteward portfolio trial is narrower than the scheduled native shadow workflow. It is manually dispatched, installs one commit-pinned external engine, reads open pull-request facts, and uploads the raw snapshot plus a validated Proto UI envelope. It does not run a Coding Harness, Docker, RepoSteward Issue-to-PR preparation, CI repair, submission, merge, or release commands. An incomplete upstream snapshot remains a successful observable result when its errors are preserved; it must not be presented as a complete portfolio fact.

The live GitHub repository remains the source for Issue and pull-request state. Phase A artifacts are experimental observations with bounded retention, not a second issue tracker.

## Maintainer-controlled local review and integration schedule

The Codex desktop task `proto-ui` is separate from the Phase A GitHub Actions workflow. It runs in the maintainer's local project with two active standing scopes. `proto-ui-scheduled-review-v1` permits complete, finding-backed `REQUEST_CHANGES`, and permits `APPROVE` only for a clean packet with successful trusted repository CI when no current or previous changed-file path identifies a YAML entity under the nine `spec/**` entity collections. `proto-ui-scheduled-merge-v1` permits an exact-head squash merge only after a clean packet, an independent exact-head approval, no active change request, resolved review threads, trusted CI, live permission, and GitHub `MERGEABLE`/`CLEAN` state all agree.

The local repository cannot authenticate a Codex task name, and a process holding the live GitHub credential could bypass these scripts. Task-name proof is therefore not presented as a security boundary. The effective boundary is the reviewed standing policy intersected with the live credential, a fresh C4 ceiling, canonical input reconciliation, exact-head API writes, single-runner operation, and GitHub repository rules. Strong runtime attribution, service-side leases, and atomic replay protection remain prerequisites for broader or concurrent runners.

These authorizations do not change `.github/workflows/agent-operations-shadow.yml`, `policy.yaml`, or the Phase A token boundary. Review authorization excludes `COMMENT`, `ABSTAIN`, spec-entity approval, ready-for-review, and unrelated GitHub mutations. Merge authorization cannot manufacture approval or bypass a blocked PR; it fixes the base to `main` and method to `squash`. Publication, release, access, secrets, and rulesets remain excluded. The mutation commands bind review `commit_id` or merge `sha` to the inspected packet head and fail closed on stale, retargeted, incomplete, duplicate, self-reviewed, unresolved, permission-unknown, CI-unknown, or non-clean state.

## Execution boundary

The hourly scheduled and manually dispatched workflow in `.github/workflows/agent-operations-shadow.yml` uses this sequence:

1. check out the default-branch repository state with persisted Git credentials disabled;
2. collect a bounded GitHub snapshot using read-only repository permissions;
3. validate the versioned policy, workflow registry, schema, and fixtures;
4. run the commit-pinned Codex Action with Codex CLI `0.138.0`, the `:read-only` permission profile, and no network access when `OPENAI_API_KEY` is available;
5. validate the structured report against the snapshot and Phase A invariants;
6. upload the input and report as artifacts without writing to GitHub collaboration surfaces.

Issue and pull-request bodies are untrusted data. The collector strips HTML comments and control characters, applies length bounds, and records truncation. The prompt explicitly refuses instructions embedded in collected content. Those measures reduce risk but do not make model output authoritative; deterministic validation and the no-write permission boundary remain required.

## Human gates

Agent Operations distinguishes these gates:

- `finding-disposition`: whether a verified observation is worth pursuing;
- `semantic-direction`: which product direction should be proposed before admission;
- `scope-or-compatibility-tradeoff`: material expansion or a choice between incompatible boundaries;
- `semantic-admission`, `ownership-decision`, and `stable-lifecycle-promotion`: governed product identity, owner, and guarantee decisions;
- `contributor-rights`: DCO, provenance, copyright, or authority to submit;
- `security-disclosure`: disclosure handling or a security-sensitive action;
- `commit-grouping`, `integration-decision`, `ready-for-review`, `pull-request-approval`, and `merge`: distinct integration decisions unless an exact active standing authorization resolves only the named mechanical action;
- `publication` and `release`: external delivery decisions;
- `access-or-secret-change` and `branch-or-ruleset-change`: repository administration decisions;
- `none`: no human decision is currently required.

When a gate is required, one decision packet must state the observed fact, recommendation, exact authorization scope, exclusions, material residual risks, the next automated stage, and actions that remain separately gated.

## Files

- `policy.yaml`: permission gradient, allowed Phase A proposals, gates, notification limits, and graduation criteria.
- `workflows.yaml`: workflow registry and delegation boundaries.
- `autonomous-tasks.yaml`: recurring-task status, capability, inputs, outputs, and stop conditions.
- `autonomous-tasks.md`: human-readable deployment boundary for recurring Agent work.
- `skills.yaml`: lazy-loaded ordinary development and maintenance skill transitions.
- `schemas/skill-handoff.schema.json`: strict one-leaf handoff contract used by the resolver.
- `capability-policy.yaml`: execution modes, local comprehension bands, autonomous ceilings, and human gates.
- `capability-rubric.yaml`: public philosophical anchors for unsigned self-assessment; it contains no repository answer key.
- `contributor-agents.md`: readable policy for ordinary Contributor Agents.
- `schemas/shadow-report.schema.json`: structured output contract used by Codex and deterministic validation.
- `schemas/capability-challenge.schema.json`: dynamic assessment challenge contract.
- `schemas/capability-response.schema.json`: evidence-backed answer contract without a score or answer key.
- `schemas/capability-self-result.schema.json`: deterministic unsigned U0-C4 local task-fit result.
- `schemas/review-input.schema.json`: canonical v3 PR state, base ref name, changed-file, review, conversation, check provider/repository/workflow-name/workflow-path provenance, check result, and evidence snapshot used for review hashing, trusted-CI evidence, and spec-entity classification.
- `schemas/review-packet.schema.json`: revision-bound local review evidence contract.
- `.agents/skills/pui-integrate/SKILL.md`: exact-head integration transition after independent approval and repository-rule readiness.
- `fixtures/**`: positive and negative replay controls.
- `scripts/agent-operations/collect-github-state.mjs`: bounded, sanitizing GitHub snapshot collector.
- `scripts/agent-operations/reposteward-portfolio.mjs`: validates a raw RepoSteward portfolio snapshot and writes the stable trial envelope and Actions summary.
- `scripts/agent-operations/check-agent-operations.mjs`: policy, registry, schema, fixture, and optional live-report checker.
- `scripts/agent-operations/assessment-runtime.mjs`: snapshot, challenge, response, self-result integrity, and local scoring primitives.
- `scripts/agent-operations/skill-registry.mjs`: strict lazy registry and handoff validator.
- `scripts/agent-operations/resolve-skill.mjs`: deterministic one-leaf resolver.
- `scripts/agent-operations/validate-capability-response.mjs`: challenge-bound response validator.
- `scripts/agent-operations/derive-self-assessment.mjs`: unsigned U0-C4 task-fit result derivation.
- `scripts/agent-operations/review-runtime.mjs`: canonical review-input hashing, packet binding, prior-packet reconciliation binding, strict schema-matched validation, and submission checks.
- `scripts/agent-operations/collect-live-review-input.mjs`: live GitHub collection of the canonical review input plus viewer identity, permission, and CI state at the submission boundary.
- `scripts/agent-operations/review-packet.mjs`: CLI used by `pui-review` and `pui-integrate` to hash input, validate, inspect, submit one exact-head review disposition, or perform one exact-head merge after a fresh live preflight.
- `.github/workflows/reposteward-portfolio-shadow.yml`: manual, read-only RepoSteward portfolio trial pinned to the registered external commit.

Run:

```sh
corepack pnpm@10.32.1 check:agent-operations
corepack pnpm@10.32.1 agent:assess
corepack pnpm@10.32.1 agent:skill -- pui-orient --mode human-assisted --mode-source current-user
corepack pnpm@10.32.1 agent:review -- input-digest --input <review-input.json>
corepack pnpm@10.32.1 agent:review -- validate --packet <packet.json> --input <review-input.json> --handoff <handoff.json>
corepack pnpm@10.32.1 agent:review -- submit-review --packet <packet.json> --input <review-input.json> --handoff <handoff.json> --authorization explicit-current-user
corepack pnpm@10.32.1 agent:review -- merge-pull-request --packet <packet.json> --input <review-input.json> --handoff <handoff.json> --authorization explicit-current-user
```

## Graduation rule

Phase A must not gain GitHub write permissions merely because the workflow runs successfully. Moving that workflow to assistive writes requires a separate reviewed change with recorded shadow evidence, zero unauthorized or duplicate mutations, complete human-gate recall on the gold fixtures, and an explicit maintainer decision defining the newly allowed action set. The local `proto-ui` standing scopes cannot be used to widen the Phase A workflow.
