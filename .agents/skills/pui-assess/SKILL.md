---
name: pui-assess
description: Run Proto UI's dynamic comprehension assessment and derive an unsigned local task-fit result. Use when an Agent needs review calibration or a fresh autonomous task and review ceiling. Do not use a self-result as identity, permission, or acceptance evidence.
---

# Assess Proto UI comprehension

Produce one snapshot-bound orientation result without publishing an answer key or granting authority.

1. Generate a fresh challenge with `pnpm agent:assess`. Keep the challenge and response outside tracked repository content.
2. Generate the bound response form with `pnpm agent:assess:response -- --challenge <path>`. Answer every prompt from the bound snapshot, then set `submittedAt` to the actual RFC 3339 completion time within the challenge window. Separate conclusions, located evidence, unknowns, and any genuinely present attended decision class in the schema's `humanGates` field.
3. Validate the completed response with `pnpm agent:assess:validate -- --challenge <path> --response <path>`. Treat any binding or shape failure as U0.
4. Read `internal/agent-operations/capability-rubric.yaml`. Generate the evaluation form with `pnpm agent:assess:evaluation`, score every dimension from 0 through 4, state the rationale, and record every applicable critical failure.
5. Derive the result with `pnpm agent:assess:self-result -- --challenge <path> --response <path> --evaluation <path>`. Preserve the output as an unsigned orientation artifact.

The response is dynamic because the challenge binds a repository snapshot, nonce, subject, sampled entities, policy, and generator. Never search for or invent a static answer file.

A self-result can derive U0 through C4 without cross-dimension compensation. It is an unsigned, session-scoped self-assessment, not a runtime identity. It explicitly records that `human-assisted` use is advisory and `autonomous` selection is ceiling-bound. Live permission and decision authority remain separate; ordinary ready work does not acquire another gate from the score.

Return the challenge ID, response digest, self-assessed band, recommended task and review classes, autonomous ceilings, critical failures, snapshot binding, explicit limitations, and one next transition permitted by the current mode.

Return one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`, with `fromId` set to `pui-assess`, the registered capability-envelope artifact, and at most one `nextSkillId`.

Communicate with the user in the user's current language while preserving canonical identifiers.
