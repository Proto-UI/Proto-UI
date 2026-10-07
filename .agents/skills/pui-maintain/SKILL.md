---
name: pui-maintain
description: Route one eligible transition in Proto UI's governed autonomous-maintenance protocol. Use for maintenance missions, drift discovery, finding verification, accepted remediation, independent maintenance review, run-ledger closure, or residual-risk planning. Do not use for ordinary user-directed development.
---

# Proto UI maintenance

## Owner-authorized dot exception

The owner-authorized dot exemption in `internal/agent-operations/contributor-agents.md` takes precedence over this leaf's ModelTrace-specific sampling, record/context and disclosure requirements. When acting as dot, do not sample or invent a ModelTrace record: visibly identify `Agent: dot` and the exact not-measured exemption declaration at every write. Use the supported publisher's explicit dot branch or the guide's real connected-service path; never fake a measured artifact, a successful validator, or live `gh` responses. The exemption grants no action permission, model authentication, independent approval or repository-rule bypass. All non-ModelTrace inputs and existing authorization, exact-head/tree, DCO, CI, independent-review and readback requirements remain. Other Agents follow the measured path below unchanged.

Route one stage while preserving independent evidence and keeping governed maintenance moving automatically.

Read `internal/agent-operations/skills.yaml` as routing metadata. Do not preload maintenance leaves or guess their paths. Select one leaf ID, run `pnpm agent:skill -- <leaf-id> --mode autonomous --mode-source <maintainer-invocation|schedule|governed-queue>`, and load the returned `loadPath` only when `blocked` is false. Validate its handoff with `pnpm agent:skill -- --handoff <handoff.json>` before loading at most one next leaf.

## Read current state

1. Establish `executionMode: autonomous`. Resolve `pui-orient` first and retain its current envelope. Resolve `pui-assess` and then `pui-orient` again when the local self-result is absent, expired, or snapshot-mismatched. Resolve `pui-agent-identify` before any Agent-originated commit or Issue/PR creation, material update, comment, review or current collaboration write. Carry the exact private `modeltrace-record` reference with its canonical public receipt digest through handoffs. Each independent Observer, Verifier, Remediator or Reviewer model context measures itself; do not reuse the parent's record as its identity.
2. Read `AGENTS.md`, `internal/autonomous-maintenance/README.md`, and `internal/autonomous-maintenance/phase-0/README.md` completely.
3. Inspect the run ledger, relevant mission and packets, baseline, and worktree state.
4. Determine the next eligible transition from recorded state, the fresh self-assessed task and review ceiling, the mission boundary, and standing or explicit maintainer authorization.
5. Treat `spec/**` as project authority and `internal/autonomous-maintenance/**` as procedure.

Before any transition, enforce the local autonomous ceiling and re-read the mission lease, current worktree, task state, and authorization. Before an external write, also re-read the target and live platform permission. Refresh stale evidence, reconcile changed state, or return a bounded no-action result; only the two attended decision classes pause the governed chain. A self-assessment never grants permission.

Before a commit or external write, validate the ModelTrace record against independent current context and remeasure when missing, expired or scope/route-changed. Local edits, tracked local maintenance state, read-only review and verification do not require sampling. Normal TTL is one hour; mismatch, ambiguity or retest disagreement limits it to fifteen minutes. Ordinary code edits and growing history alone do not change scope. Use `agent:publish` for its supported commit/Issue/PR surfaces and record-aware review/collaboration primitives otherwise. Disclose honest candidate, ambiguous or failed results and anomalies, never substitute declared system/harness labels. ModelTrace is unsigned closed-set attribution, not runtime authentication, permission, independent review or acceptance; it cannot activate `pending-runtime-identity` schedules. Keep samples, private context/session IDs and private conversation/operational/account circumstances out of repository artifacts and external publications. See `internal/agent-operations/contributor-agents.md` for cache and hook/API bypass limits.

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

Apply `internal/agent-operations/visual-evidence.md` when the authorized maintenance scope includes Issue/PR evidence. Agents own reproduction, uploaded visuals, sanitized request paraphrases, and evidence debt. Humans may submit plain descriptions. This soft gate neither authorizes external writes nor changes maintenance independence or closure gates; use `internal/agent-operations/github-evidence-upload.md` for upload mechanisms.

Return the transition performed, resulting state, artifacts, evidence, uncertainty, residual risks, next eligible transition, and any exact human decision required.

Communicate with the user in the user's current language. Keep repository identifiers and artifacts in their governed language.
