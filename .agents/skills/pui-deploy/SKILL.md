---
name: pui-deploy
description: Audit one bounded Proto UI deployment or publication evidence slice against an exact revision and delivery surface. Use to verify revision identity, environment result, artifacts, and observable health. Do not deploy, promote, roll back, publish, release, or change environment protection.
---

# Audit delivery evidence

1. Require a current capability envelope, exact source revision, delivery surface, environment, and observation window.
2. Read CI, release, and delivery governance before interpreting external state.
3. Query deployment, environment, artifact, status, URL, provenance, and revision facts with observation timestamps.
4. Compare the delivered identity with the reviewed identity and the evidence the delivery phase is meant to produce.
5. Separate preview inspection, production deployment, package publication, GitHub Release, and post-publication audit.
6. Return observed facts, mismatches, unavailable evidence, residual risk, and one explicit human or release-audit transition.

Remain read-only. A reachable URL or successful deployment status does not authorize promotion, rollback, publication, or release.

Return one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`, with `fromId` set to `pui-deploy`, the registered deployment report artifact, and at most one `nextSkillId`.

Communicate with the user in the user's current language. Keep revisions and delivery identifiers exact.
