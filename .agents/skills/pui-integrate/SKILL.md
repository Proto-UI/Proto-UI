---
name: pui-integrate
description: Integrate one already reviewed Proto UI pull request at its exact head when current-user or active standing authorization, live GitHub permission, trusted CI, review state, and repository rules all agree. Use only after pui-review; do not use to manufacture approval or bypass a blocked pull request.
---

# Integrate an approved pull request

Execute a reviewed integration decision without adding another approval prompt.

1. Require the validated `pui-review` handoff, canonical review-input, clean `APPROVE` packet, exact head SHA, and one explicit-current-user or active standing merge authorization.
2. Re-collect the canonical input live. Reject any changed body, commit, review, conversation comment, reply, thread, check, file, base, or head.
3. Require a fresh eligible C4 self-result in `autonomous` mode. Treat assessment only as advice in `human-assisted` mode. Assessment never grants GitHub permission or approval.
4. Require the target base fixed by the authorization, successful trusted repository CI, no active `CHANGES_REQUESTED` from any reviewer's latest non-dismissed review across the pull request, every review thread resolved, and at least one exact-head approval from a reviewer other than the pull-request author.
5. Require GitHub to report the exact head `MERGEABLE` and `CLEAN`, plus a live credential with write, maintain, or admin permission. Repository rules remain authoritative and cannot be bypassed.
6. Run `pnpm agent:review -- merge-pull-request --packet <packet.json> --input <review-input.json> --handoff <handoff.json> [--assessment <result.json>] [--external-evidence-file <evidence.json>] --authorization <explicit-current-user|proto-ui-scheduled-merge-v1>`.
7. Use only the command's exact-head merge write. It sends `sha` equal to the inspected head and the authorization's fixed merge method. Do not follow preflight with `gh pr merge`, a web click, force, admin bypass, or another unbound write.
8. Treat `allowed: false` as a terminal no-write result for this input. After an unknown write outcome, accept only the command's single live reconciliation; a pull request found merged during that reconciliation remains unattributed and cannot become this invocation's successful receipt. Never retry blindly.
9. Return the mutation receipt. Integration does not authorize publication, release, lifecycle promotion, access, secrets, rulesets, or any later action.

An active standing authorization resolves only the mechanical `commit-grouping`, `integration-decision`, and `merge` gates under its fixed method and conditions. It does not resolve semantic admission by itself: a spec-entity change still needs an independent exact-head approval before this leaf can run.

## Explicit handoff

Do not load or execute another skill. Return exactly one terminal handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`, carrying the registered `mutation-receipt` and relevant prior artifacts by reference, with `nextSkillId` set to `null`.

Communicate with the user in the user's current language. Keep repository, pull-request, SHA, review, check, and receipt references exact.
