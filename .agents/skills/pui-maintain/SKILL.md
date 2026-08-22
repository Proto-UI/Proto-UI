---
name: pui-maintain
description: Route one eligible transition in Proto UI's governed autonomous-maintenance protocol. Use for maintenance missions, drift discovery, finding verification, accepted remediation, independent maintenance review, run-ledger closure, or residual-risk planning. Do not use for ordinary user-directed development.
---

# Proto UI maintenance

Route one stage without collapsing independence or human gates.

Read `internal/agent-operations/skills.yaml` as routing metadata. Do not preload maintenance leaves or guess their paths. Select one leaf ID, run `pnpm agent:skill -- <leaf-id>`, and load only the returned `loadPath`. Validate its handoff with `pnpm agent:skill -- --handoff <handoff.json>` before loading at most one next leaf.

## Read current state

1. Resolve `pui-orient` first and retain its current capability envelope. Resolve `pui-assess` and then `pui-orient` again when the assessment is absent, invalid, expired, or snapshot-mismatched.
2. Read `AGENTS.md`, `internal/autonomous-maintenance/README.md`, and `internal/autonomous-maintenance/phase-0/README.md` completely.
3. Inspect the run ledger, relevant mission and packets, baseline, and worktree state.
4. Determine the next eligible transition from recorded state, the capability envelope, and explicit authorization.
5. Treat `spec/**` as project authority and `internal/autonomous-maintenance/**` as procedure.

Before any mutation, run the repository mutation-envelope verifier for the exact leaf and scope. It validates the attested clean baseline, current worktree and diff, task class, capability, live permission, human authorization, subject binding, and fresh run-bound probe together. Stop without writing when any input is absent, stale, untrusted, replayed, narrower than the requested mutation, or dependent on an unavailable global consumer.

## Route exactly one transition

- resolve `pui-mission` to turn one explicitly selected candidate into a frozen bounded mission and lease;
- resolve `pui-observe` for a bounded read-only mission;
- resolve `pui-record` for a supported no-finding result, or for a blocked terminal result whose required evidence is complete;
- resolve `pui-verify` in a fresh context for one candidate finding;
- resolve `pui-record` after an independently rejected finding receives its required human disposition;
- request finding disposition and semantic direction as separate human decisions;
- resolve `pui-remediate` only for an accepted finding with approved scope and a valid mutation envelope and probe;
- resolve `pui-maintenance-review` in a fresh context for the actual remediation;
- resolve `pui-maintenance-close` only after adequate independent review, required validation, and revalidation of its complete maintenance-state mutation surface.

Never let an Observer verify its own finding or an implementer issue the independent review verdict. Do not simulate freshness inside one context.

## Report

Return the transition performed, resulting state, artifacts, evidence, uncertainty, residual risks, next eligible transition, and any exact human decision required.

Communicate with the user in the user's current language. Keep repository identifiers and artifacts in their governed language.
