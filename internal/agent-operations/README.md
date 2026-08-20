# Agent Operations

This directory defines the operational control plane for Agent-assisted GitHub work in Proto UI. It is not a project truth source and does not define Proto UI semantics. Applicable `spec/**` entities remain authoritative according to lifecycle.

Agent Operations coordinates multiple workflow families without flattening their domain-specific protocols:

- `issue-steward`: classify and route GitHub Issues;
- `pr-steward`: summarize pull-request state and route the next review or decision;
- `autonomous-maintenance`: delegate bounded discovery and remediation to the separate workflow under `internal/autonomous-maintenance/**`.

## Current stage: Phase A shadow

Phase A is read-only with respect to GitHub and tracked repository files during a run. It collects a bounded snapshot of open Issues and pull requests, gives that untrusted snapshot to a sandboxed Agent, validates the structured proposal, and preserves the snapshot and report as workflow artifacts.

Phase A does not:

- comment on, label, assign, edit, close, or reopen an Issue or pull request;
- create a branch, commit, pull request, task, or review;
- approve, merge, publish, release, or promote a stable guarantee;
- treat an Agent classification as a maintainer decision;
- reuse `internal/autonomous-maintenance/phase-0/runs.yaml` as a GitHub event ledger.

The live GitHub repository remains the source for Issue and pull-request state. Phase A artifacts are experimental observations with bounded retention, not a second issue tracker.

## Execution boundary

The scheduled and manually dispatched workflow in `.github/workflows/agent-operations-shadow.yml` uses this sequence:

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
- `semantic`: product behavior or a draft/active guarantee;
- `integration`: commit grouping, ready-for-review, merge, publication, or release;
- `scope`: material expansion or a choice between incompatible remediation boundaries;
- `contributor-rights`: DCO, provenance, copyright, or authority to submit;
- `security`: disclosure handling or a security-sensitive action;
- `none`: no human decision is currently required.

When a gate is required, one decision packet must state the observed fact, recommendation, exact authorization scope, exclusions, material residual risks, the next automated stage, and actions that remain separately gated.

## Files

- `policy.yaml`: permission gradient, allowed Phase A proposals, gates, notification limits, and graduation criteria.
- `workflows.yaml`: workflow registry and delegation boundaries.
- `schemas/shadow-report.schema.json`: structured output contract used by Codex and deterministic validation.
- `fixtures/**`: positive and negative replay controls.
- `scripts/agent-operations/collect-github-state.mjs`: bounded, sanitizing GitHub snapshot collector.
- `scripts/agent-operations/check-agent-operations.mjs`: policy, registry, schema, fixture, and optional live-report checker.

Run:

```sh
corepack pnpm@10.32.1 check:agent-operations
```

## Graduation rule

Phase A must not gain GitHub write permissions merely because the workflow runs successfully. Moving to assistive writes requires a separate reviewed change with recorded shadow evidence, zero unauthorized or duplicate mutations, complete human-gate recall on the gold fixtures, and an explicit maintainer decision defining the newly allowed action set.
