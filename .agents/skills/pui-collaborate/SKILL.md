---
name: pui-collaborate
description: Apply one exact-target reversible Proto UI Issue, pull-request, review-thread, or Actions collaboration update and return a verified receipt. Use for governed title/body or label repair, update-branch, ready-for-review, review requests, fixed-thread resolution, bounded status comments, and exact-run CI recheck. Do not submit a review disposition, merge, close, publish, release, or change privileged repository settings.
---

# Continue collaboration state

1. Require a current capability envelope, one purpose-bound request validated by `internal/agent-operations/schemas/collaboration-request.schema.json`, an exact target, and current-user or active standing mutation authorization. Bind the handoff's `collaboration-request` digest and `mutation-authorization` reference to that request; in autonomous mode also bind the capability-envelope digest to the fresh C2-or-higher assessment and require the exact `proto-ui-scheduled-collaboration-v1` scope plus current `governed-outcome` evidence.
2. Execute only through `corepack pnpm@10.32.1 agent:collaborate -- apply --request <request.json> --handoff <handoff.json> [--assessment <result.json>]`; do not issue an equivalent GitHub write directly. The runtime recomputes the canonical request digest and re-reads the target immediately before writing, binding repository identity, Issue or pull-request number, current `updatedAt`, and head SHA, workflow run, review-thread ID, or metadata state as applicable.
3. Apply exactly one authorized reversible action:
   - repair an Issue or pull-request title, body, milestone, assignee, or existing routing label when current authority fixes the target state;
   - update a pull-request branch owned by the acting credential, or one GitHub reports as maintainer-editable, only through GitHub's update-branch operation with `expected_head_sha` equal to the live head;
   - mark an exact head ready for review after the governed scope and required validation evidence are present;
   - request an eligible independent reviewer;
   - resolve one exact review thread only after live evidence shows its finding is fixed or superseded;
   - rerun one exact trusted workflow run or its failed jobs after diagnosing the failure and confirming the run still targets the intended head; or
   - post one bounded reconciliation or progress comment whose content and target are already authorized.
4. Accept only a receipt validated against `internal/agent-operations/schemas/collaboration-receipt.schema.json`. It binds the request digest and exact target and records pre/post state digests, actor, returned platform identity, mutation count, reconciliation count, and verified result.
5. Treat an already-satisfied result as an idempotent zero-mutation no-op with evidence. Attempt at most one mutation. After an unknown outcome, reconcile live state exactly once and attribute success only when the platform object proves this invocation's exact action; never retry blindly.
6. Route the resulting state to `pui-pr`, `pui-ci`, `pui-review`, or another eligible leaf without performing that leaf's action here. Continue portfolio processing when one item is stale, conflicted, or lacks permission.

Current authority and repository rules determine the target state; this leaf does not invent semantic readiness, dismiss active findings, bypass DCO or CI, force-update a branch, or weaken protection. Use `pui-review` for `COMMENT`, `REQUEST_CHANGES`, or `APPROVE`, and `pui-integrate` for merge. Publication, release, access, secrets, applications, rulesets, branch protection, security disclosure, provenance exceptions, and other privileged or difficult-to-reverse operations remain outside this scope.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include the registered mutation receipt, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep repository, Issue, pull-request, thread, workflow, and revision identifiers exact.
