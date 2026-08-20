# Phase 0 remediation review packet template

Use this packet after a finding has been independently verified and accepted for further work. Future remediations should create the proposal form before code is changed, then update the same packet with the actual diff and evidence after implementation.

The packet is an operational review projection. It does not replace `spec/**`, approve a semantic change, or prove that an impact surface is complete.

For a `proposal`, `changeInventory` contains planned paths; new paths may not yet exist and `proposedAnchors` names criteria awaiting semantic approval. For a post-implementation packet, declared paths must exist and differ from the baseline, while every declared anchor must exist in its referenced entity.

<!-- prettier-ignore -->
```yaml
findingId:
findingPath:
runId:
stage: proposal | post-implementation | post-implementation-pilot
reviewStatus: draft | ready-for-human-review | ready-for-independent-review | revision-required | completed | rejected
baselineCommit:

decisionRequested: []

humanDecisions:
  semantic:
    status: pending | accepted | rejected
    decision:
  integration:
    status: pending | accepted | rejected
    decision:
    evidence: []

automatedCompletion:
  status: pending | complete | blocked
  rule: adequate-independent-review-and-required-validation
  validationStatus: pending | passed | failed
  completedOn:

authority:
  - id:
    path:
    lifecycle: draft | active | deprecated | removed
    changeRole: pre-existing-authority | pre-existing-direction | proposed-draft-strengthening
    anchors: []
    proposedAnchors: []

changeInventory:
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
  reviewMinutes:
  decision:
  history:
    - round:
      classification: adequate | incomplete | misleading | blocked
      confidence:
      recommendedAction: accept-packet | revise | reject | gather-more-evidence
      summary:
```

## Review decision

State exactly what remains at the human semantic or integration gate. Ordinary implementation correctness is completed by adequate independent review plus required validation, not by a third human approval.

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

Record the fresh review-synthesizer classification and required corrections. The synthesizer assesses packet fidelity and implementation evidence; it does not make semantic or integration decisions.

## Reviewer checklist

- Can the reviewer restate the old and new behavior without reading the diff?
- Is every new semantic rule identified as existing authority or a new proposal?
- Are direct, indirect, excluded, and unknown surfaces distinguishable?
- Does every important claim have evidence and an explicit evidence limit?
- Are lifecycle transitions, cleanup, retry, and failure-during-failure addressed?
- Are semantic approval, automated implementation completion, and integration authorization clearly separated?
