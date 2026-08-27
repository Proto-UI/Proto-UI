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

For a completed remediation, use `automatedCompletion.status: complete`, passed validation, the completion date, and the independently reviewed packet. `integration.status: eligible` records a non-baseline descendant commit whose complete changed-path inventory exactly matches `changeInventory.exactPaths` in the independently reviewed packet contained by that commit and whose canonical reviewed-content diff matches the packet's `reviewedContentDigest`. `integrated` additionally requires an exact receipt containing `repositoryId`, pull-request number, reviewed `headSha`, `mergeCommitSha`, `mergeMethod`, and RFC 3339 `mergedAt`. Never record integration from an unbound write or an unknown outcome.
