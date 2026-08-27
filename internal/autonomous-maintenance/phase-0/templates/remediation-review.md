# Phase 0 remediation review packet template

Use this packet after a finding has been independently verified and routed to governed remediation. Future remediations should create the proposal form before code is changed, then update the same packet with the actual diff and evidence after implementation.

The packet is an operational review projection. It does not replace `spec/**`, approve a semantic change, or prove that an impact surface is complete.

For a `proposal`, `changeInventory` contains planned paths; new paths may not yet exist and `proposedAnchors` names criteria whose product direction is not yet fixed by current authority. For a post-implementation packet, declared paths must exist and differ from the baseline, while every declared anchor must exist in its referenced entity.

`schemaVersion: 2` is the Agent-forward packet shape. Historical packets keep their recorded legacy decision fields as evidence; the deterministic checker reads both shapes without requiring a history rewrite.

<!-- prettier-ignore -->
```yaml
schemaVersion: 2
findingId:
findingPath:
runId:
stage: proposal | post-implementation | post-implementation-pilot
reviewStatus: draft | ready-for-independent-review | revision-required | completed | rejected
baselineCommit:

remediationAuthor:
  actorId:
  taskId:

decisionBoundary:
  class: none | unresolved-product-direction | privileged-or-irreversible-operation
  status: not-required | pending | resolved
  question:
  resolution:
  evidence: []

automatedCompletion:
  status: pending | complete | blocked
  rule: adequate-independent-review-and-required-validation
  validationStatus: pending | passed | failed
  completedOn:

integrationEligibility:
  status: pending | eligible | blocked | integrated
  exactHead: pending | satisfied | blocked | not-required
  trustedCi: pending | satisfied | blocked | not-required
  independentReview: pending | satisfied | blocked | not-required
  livePermission: pending | satisfied | blocked | not-required
  dcoOrProvenance: pending | satisfied | blocked | not-required
  repositoryRules: pending | satisfied | blocked | not-required
  idempotency: pending | satisfied | blocked | not-required
  evidence: []

authority:
  - id:
    path:
    lifecycle: draft | active | deprecated | removed
    changeRole: pre-existing-authority | pre-existing-direction | proposed-draft-strengthening
    anchors: []
    proposedAnchors: []

changeInventory:
  exactPaths: []
  reviewedContentDigest:
  spec: []
  implementation: []
  tests: []

affectedSurfaces:
  direct: []
  indirect: []
  excluded: []
  unknown: []

evidenceClaims:
  - id:
    claim:
    proof: []
    limits: []

residualRisks:
  - id:
    title:
    followUp:
    blocksCompletion: false

independentReview:
  required: true
  status: pending | adequate | incomplete | misleading | blocked
  reviewer:
    actorId:
    taskId:
  reviewedContentDigest:
  reviewMinutes:
  decision:
  history:
    - round:
      reviewer:
        actorId:
        taskId:
      reviewedContentDigest:
      classification: adequate | incomplete | misleading | blocked
      confidence:
      recommendedAction: accept-packet | revise | reject | gather-more-evidence
      summary:
```

`eligible` and `integrated` require every listed integration condition to be `satisfied`; `not-required` is available only while integration is not being claimed. `indirect`, `excluded`, `unknown`, and `residualRisks` remain explicit arrays and may be empty when the review found none, avoiding placeholder risk text.

`changeInventory.exactPaths` is the canonical, complete path set for `baselineCommit..integration.exactHeadSha`; the categorized arrays are non-overlapping explanatory subsets. A post-implementation packet includes its own repository path in `exactPaths`. Set `reviewedContentDigest` to the `sha256:<64 lowercase hex>` produced by `scripts/autonomous-maintenance/reviewed-content-digest.mjs`: hash the binary/full-index Git diff for every other sorted exact path, then hash this packet's baseline and head modes plus full content after replacing every YAML `reviewedContentDigest` value with the fixed sentinel. The sentinel breaks the self-reference without excluding the packet's authority, impact, evidence, prose, or review metadata. At eligibility, the ledger checker requires the exact head to be a non-baseline descendant, reads this packet from that commit, revalidates its independent review, rejects any missing or undeclared changed path, and recomputes the digest. A later commit that edits an already declared remediation path or only edits the packet therefore cannot reuse the earlier review merely because its path set stayed unchanged.

Use stable, non-secret invocation identifiers for `remediationAuthor` and every reviewer record. `actorId` identifies the Agent or reviewer role instance, while `taskId` identifies the fresh task context. A pending review records `reviewer: null`, `reviewedContentDigest: null`, and `history: []`. Once a result exists, the current reviewer and every history round require both identifiers; neither identifier may equal the remediation author's. Every post-implementation history round records the digest it actually reviewed, and an `adequate` result requires the current reviewer and digest to match both the final history entry and `changeInventory.reviewedContentDigest`. This is machine-checked independence and reviewed-revision evidence, not a substitute for the review's technical argument.

## Decision boundary

State whether any attended decision remains. Use only `unresolved-product-direction` when current authority leaves a material product choice open, or `privileged-or-irreversible-operation` when the next action has that character. Ordinary finding disposition, implementation correctness, commit grouping, review disposition, and merge do not create another decision class.

## Behavioral delta

Describe behavior before and after the change. Do not substitute a list of files or passing commands for observable behavior.

## State transitions

Show the smallest state model that explains the change. Include failure and recovery paths when they are part of the remediation.

## Change and impact map

Trace direct runtime consumers, indirect consumers, explicit exclusions, and unknown surfaces. Call out any behavior expansion beyond the verifier-corrected finding scope.

## Authority analysis

Separate pre-existing active authority, pre-existing draft direction, and draft semantics proposed by this remediation. A criterion added in the same patch must not be presented as independent justification for that patch.

## Implementation argument

Map each key implementation change to a behavioral claim. Record alternatives considered and why the selected mechanism was chosen.

## Evidence matrix

For each claim, identify executable or structural evidence and what that evidence does not prove.

## Residual risks and limits

List uncertainty, untested host behavior, failure-during-cleanup, reentrancy, lifecycle, compatibility, and rollback limitations as applicable.

## Independent review

Record the fresh review-synthesizer classification and required corrections. The synthesizer assesses packet fidelity, implementation evidence, and integration eligibility; it does not resolve open product direction or perform the integration action.

## Reviewer checklist

- Can the reviewer restate the old and new behavior without reading the diff?
- Is every new semantic rule identified as existing authority or a new proposal?
- Are direct, indirect, excluded, and unknown surfaces distinguishable?
- Does every important claim have evidence and an explicit evidence limit?
- Are lifecycle transitions, cleanup, retry, and failure-during-failure addressed?
- Are authority resolution, automated implementation completion, exact-head integration eligibility, and the two exceptional decision classes clearly separated?
