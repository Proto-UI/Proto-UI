# Phase 0 run-ledger entry template

Use this shape for new entries in `runs.yaml`. Historical entries keep their legacy fields and are read through the compatibility path.

```yaml
- schemaVersion: 2
  id: AM-P0-000
  missionPath: internal/autonomous-maintenance/phase-0/missions/example.md
  findingPaths: []
  baselineCommit: 0000000000000000000000000000000000000000
  budgetClass: medium
  observer:
    actorId: agent:observer-example
    taskId: task:observer-example
    status: completed
    elapsedMinutes: null
    tokenUsage: null
    candidateFindingCount: 0
    trackedMutationCount: 0
  verification:
    actorId: agent:verifier-example
    taskId: task:verifier-example
    status: completed
    classification: no-finding
    confidence: 1
  findingDisposition:
    status: record-no-finding
    evidence: [internal/autonomous-maintenance/phase-0/missions/example.md]
  decisionBoundary:
    class: none
    status: not-required
    question: null
    resolution: null
    evidence: []
  automatedCompletion:
    status: not-required
    completionRule: not-required
    validationStatus: not-required
    completedOn: null
    reviewPacket: null
  integration:
    status: not-required
    exactHeadSha: null
    receipt: null
    evidence: []
  outcome:
    previouslyUnknown: false
    actionValue: 0
    residualRiskCount: 0
```

For every schema-v2 run, record stable, non-secret Observer and Verifier `actorId` and `taskId` values. Both identifiers must differ across the two roles and must exactly match any linked schema-v2 finding.

For a completed remediation, use `automatedCompletion.status: complete`, passed validation, the completion date, and the independently reviewed packet. `integration.status: eligible` records a non-baseline descendant commit whose complete changed-path inventory exactly matches `changeInventory.exactPaths` in the independently reviewed packet contained by that commit and whose canonical reviewed-content diff matches the packet's `reviewedContentDigest`. `integrated` additionally requires the live exact-head squash receipt containing `repositoryId`, pull-request number, authorized `authorizationId`, reviewed `headSha`, matching `liveHeadSha`, `mergeCommitSha`, `mergeMethod: squash`, and RFC 3339 `mergedAt`. Never record integration from an unbound write or an unknown outcome.

For an `integrated` claim, the checker verifies the local single-parent shape and reviewed tree, then reads GitHub to bind the actual merged PR, exact head, merge SHA, GitHub merge time and governed `main` ancestry. Missing or unavailable live facts block validation. These reads establish an actual merge; they cannot prove the historical merge method or authenticate a copied receipt's producer. A single-parent rebase can have the same read-side shape as a squash. The historical squash-method/producer proof is not implemented, so this branch remains explicitly blocked even when the actual merge is confirmed. Retain that decision boundary instead of treating a caller-supplied `mergeMethod` or hash as proof; no new receipt schema or trusted publisher is introduced here.
