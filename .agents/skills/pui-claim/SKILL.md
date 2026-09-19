---
name: pui-claim
description: Post one already selected Proto UI work-item claim as a reversible GitHub metadata mutation. Use after pui-select produced a current proposal and the exact claim has authorization, live permission, current readiness, and an idempotent write boundary. Do not select work, decide readiness, release claims, or widen the authorized wording.
---

# Post one authorized claim

1. Require a current `pui-orient` envelope. In autonomous mode the claim must be within the fresh C2-or-higher ceiling; in human-assisted mode the assessment remains advisory.
2. Require the raw `pui-select` proposal and its `evidence-assessment`, explicit or standing authorization for the exact claim text including its `Agent evidence` section, live GitHub permission, and an idempotency key bound to the issue update time, repository, requested action, and contributor. Read `internal/agent-operations/visual-evidence.md`; verify target/cutoff, sanitized paraphrase/source, current evidence versus planned evidence, coverage/disposition and debt are present and accurately included in the authorized text.
3. Re-read the live issue, assignee, recent comments, linked pull requests, and Project claim state immediately before posting.
4. When readiness, ownership, scope, evidence, permission, authorization, or idempotency state changed, return the exact live mismatch and route a fresh selection through `pui-select`; otherwise continue immediately with the proposal unchanged.
5. Post exactly one claim containing the authorized scope, planned evidence, capability band, expiry, the assessed `Agent evidence` section, and the request-bound idempotency marker. Reuse verified links; disclose unexecuted reproduction and upload debt. `partial` or `blocked` evidence alone does not prevent this authorized claim; the soft gate never requires a human to supply images. An omitted assessment or changed authorized wording requires a revised proposal, not silently generated evidence inside this write transition.
6. After a timeout or other unknown write outcome, reconcile the live issue exactly once with that marker. Attribute success only when the exact claim is present; otherwise return the reconciled terminal result and never retry blindly.
7. Return a mutation receipt with the issue identity, claim URL or identifier, timestamp, observed pre-state, resulting state, and the bounded subject for `pui-trace`.

The selected claim is the complete mutation boundary. Readiness and semantic direction remain governed inputs, while release of an existing claim routes through `pui-unclaim`.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep GitHub identifiers canonical.
