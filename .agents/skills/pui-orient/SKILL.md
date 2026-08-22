---
name: pui-orient
description: Establish Proto UI repository state, live contributor authority, Agent comprehension scope, task risk, and authorization before work begins. Use at the start of a development session, before autonomous task selection, after a material repository update, or when permission or assessment state may have changed.
---

# Orient to Proto UI

Produce a current working envelope; do not perform the target change.

1. Read `AGENTS.md`, `spec/README.md`, and `internal/agent-operations/contributor-agents.md` completely.
2. Inspect the worktree, branch, remotes, base SHA, changed files, and relevant recent records. Preserve unrelated changes.
3. Generate the disposable Agent snapshot when repository understanding is needed. Never commit it.
4. Query live GitHub relationship and task state when GitHub access is relevant. Treat unavailable data as unknown.
5. Verify any capability attestation with `pnpm agent:verify-attestation -- ...`; schema validity or a self-declared signature is insufficient. Treat an unsigned local self-assessment as read-only capability and treat an untrusted, expired, mismatched, or unverifiable attestation as U0.
6. Classify task risk and required human gates independently from model capability and platform permission.
7. Calculate effective capability as the intersection of all constraints. A score never increases actual permission.

Return a compact envelope containing observed facts, unknowns, effective capability, forbidden actions, stale inputs, and the next eligible skill. Stop if the requested action exceeds the envelope.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep technical identifiers canonical.
