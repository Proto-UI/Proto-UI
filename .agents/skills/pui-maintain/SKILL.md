---
name: pui-maintain
description: Route one eligible transition in Proto UI's governed autonomous-maintenance protocol. Use for maintenance missions, drift discovery, finding verification, accepted remediation, independent maintenance review, run-ledger closure, or residual-risk planning. Do not use for ordinary user-directed development.
---

# Proto UI maintenance

Route one stage while preserving independent evidence and keeping governed maintenance moving automatically.

Read `internal/agent-operations/skills.yaml` as routing metadata. Do not preload maintenance leaves or guess their paths. Select one leaf ID, run `pnpm agent:skill -- <leaf-id> --mode autonomous --mode-source <maintainer-invocation|schedule|governed-queue>`, and load the returned `loadPath` only when `blocked` is false. Validate its handoff with `pnpm agent:skill -- --handoff <handoff.json>` before loading at most one next leaf.

## Read current state

1. Establish `executionMode: autonomous`. Resolve `pui-orient` first and retain its current envelope. Resolve `pui-assess` and then `pui-orient` again when the local self-result is absent, expired, or snapshot-mismatched.
2. Read `AGENTS.md`, `internal/autonomous-maintenance/README.md`, and `internal/autonomous-maintenance/phase-0/README.md` completely.
3. Inspect the run ledger, relevant mission and packets, baseline, and worktree state.
4. Determine the next eligible transition from recorded state, the fresh self-assessed task and review ceiling, the mission boundary, and standing or explicit maintainer authorization.
5. Treat `spec/**` as project authority and `internal/autonomous-maintenance/**` as procedure.

Before any transition, enforce the local autonomous ceiling and re-read the mission lease, current worktree, task state, and authorization. Before an external write, also re-read the target and live platform permission. Refresh stale evidence, reconcile changed state, or return a bounded no-action result; only the two attended decision classes pause the governed chain. A self-assessment never grants permission.

## Route exactly one transition

- resolve `pui-mission` to turn one explicitly selected candidate into a frozen bounded mission and lease;
- resolve `pui-observe` for a bounded read-only mission;
- resolve `pui-record` for a supported no-finding result, or for a blocked terminal result whose required evidence is complete;
- resolve `pui-verify` in a fresh context for one candidate finding;
- resolve `pui-record` directly after an independently rejected finding;
- route an independently verified drift straight to `pui-remediate` when existing authority fixes the expected result;
- request one product-direction decision only when the verifier exposes a genuinely unresolved semantic or compatibility choice;
- resolve `pui-remediate` for a verified governed finding within the current autonomous ceiling and mutation scope;
- resolve `pui-maintenance-review` in a fresh context for the actual remediation;
- resolve `pui-maintenance-close` only after adequate independent review, required validation, and revalidation of its complete maintenance-state mutation surface.

Never let an Observer verify its own finding or an implementer issue the independent review verdict. Independence is an automated evidence boundary, not a requirement for a maintainer click.

## Report

Return the transition performed, resulting state, artifacts, evidence, uncertainty, residual risks, next eligible transition, and any exact human decision required.

Communicate with the user in the user's current language. Keep repository identifiers and artifacts in their governed language.
