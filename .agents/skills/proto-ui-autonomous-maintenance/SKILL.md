---
name: proto-ui-autonomous-maintenance
description: Run or continue Proto UI's governed autonomous-maintenance workflow, including bounded Observer missions, independent finding verification, semantically approved remediation, independent remediation review, run-ledger closure, and residual-risk mission planning. Use for Agent-led maintenance experiments, drift hunting, finding verification, remediation packets, or autonomous-maintenance run records in this repository. Do not use for ordinary user-directed feature work or unrelated code review.
---

# Proto UI Autonomous Maintenance

Execute one eligible transition in Proto UI's autonomous-maintenance protocol. Keep repository authority, Agent reasoning, deterministic validation, and human decisions separate.

## Establish the current state

1. Read `AGENTS.md` completely.
2. Read `internal/autonomous-maintenance/README.md` and `internal/autonomous-maintenance/phase-0/README.md` completely.
3. Inspect `internal/autonomous-maintenance/phase-0/runs.yaml`, the relevant mission, finding, and review packet, plus `git status --short`.
4. Determine the requested stage from explicit user intent and recorded state. If the request says only “continue,” perform only the next eligible transition.
5. Treat `spec/**` as project authority according to lifecycle. Treat this Skill and `internal/autonomous-maintenance/**` as operational procedure, never as Proto UI semantics.

## Route exactly one stage

### Observe

- Read the selected mission and `internal/autonomous-maintenance/phase-0/prompts/observer.md` completely.
- Record baseline and starting worktree state.
- Remain read-only for tracked files and external systems.
- Prefer one falsifiable, externally grounded finding over multiple suspicions.
- Stop with a report or explicit no-finding result. Do not verify or remediate the result in the same task.

### Verify

- Require a candidate finding and a fresh task context.
- Read `internal/autonomous-maintenance/phase-0/prompts/verifier.md` completely.
- Reconstruct evidence independently, attempt falsification, correct scope, and remain read-only.
- Stop with the verifier classification. Do not silently accept or fix the finding.

### Record disposition or semantics

- Record whether the verified finding is worth pursuing separately from whether a proposed behavior is desirable.
- Require explicit human semantic acceptance before changing a draft or active guarantee.
- If the decision is absent, stop with the smallest concrete semantic question. This pause is required by the Phase 0 protocol.

### Remediate

- Require an accepted finding and explicit semantic direction.
- Create or update the remediation packet from `internal/autonomous-maintenance/phase-0/templates/remediation-review.md` before behavioral edits.
- Limit the change to the verifier-corrected scope. Map behavior, authority, direct and indirect consumers, exclusions, evidence limits, and residual risks.
- Run focused evidence first, then repository checks proportional to the change.
- Do not commit, merge, publish, or release merely because implementation checks pass.

### Review

- Require a fresh task context, the finding, packet, baseline, and actual diff.
- Read `internal/autonomous-maintenance/phase-0/prompts/review-synthesizer.md` completely.
- Remain read-only. Classify packet fidelity and technical-completion eligibility without making product or integration decisions.
- Return `incomplete` or `misleading` work for correction. Return product, compatibility, or scope tradeoffs to the semantic gate.

### Close or integrate

- Mark technical remediation complete only when independent review is `adequate`, required validation passed, and no residual risk blocks completion.
- Run `corepack pnpm@10.32.1 check:autonomous-maintenance` before closure.
- Update the finding, packet, mission, and `runs.yaml` consistently.
- Treat commit grouping, merge, publication, and release as an explicit human integration decision. Record the decision and evidence after execution.

## Preserve independence

- Never let an Observer verify its own finding or an implementer provide the independent remediation verdict.
- Do not simulate a fresh context inside the current task. Produce a copy-ready handoff when a new task is required; create one only when the user explicitly requests it.
- Pass raw artifacts, repository state, and exact baselines. Do not pass hidden reasoning or a desired verdict.

## Maintain run evidence

- Keep run IDs, mission paths, finding paths, baselines, classifications, completion rules, and integration evidence synchronized in `internal/autonomous-maintenance/phase-0/runs.yaml`.
- Record unknown token usage or review time as `null`; never invent metrics.
- Convert non-blocking residual risks into candidate missions only when they have an external oracle and a bounded scope.
- Keep no-finding and repeatability controls in the queue; do not optimize only for runs that produce findings.

## Report the transition

Return:

- stage performed and resulting state;
- artifacts created or updated;
- commands and evidence results;
- remaining uncertainty and residual risks;
- the next eligible transition;
- the exact human decision required, or state that none is required.
