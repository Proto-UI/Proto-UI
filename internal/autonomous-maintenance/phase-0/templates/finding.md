# Phase 0 finding template

```yaml
schemaVersion: 2
findingId:
runId:
mission:
baselineCommit:
scope:
budgetClass: small | medium | large
elapsedMinutes:

claim:
entities: []
criteria: []
lifecycle:

expected:
observed:
reproduction:
commands: []
evidence: []
counterEvidence: []
likelyRootCause:
impact:
suggestedAction:

observer:
  actorId:
  taskId:
observerConfidence:

verifier:
  actorId:
  taskId:
  status: pending | completed | blocked
  classification: pending | confirmed | partially-confirmed | not-reproducible | expected-behavior | unresolved-semantic-question | no-finding
  evidence: []
  confidence:

findingDisposition:
  status: pending | automatic-governed-remediation | record-rejected | record-no-finding | bounded-follow-up
  evidence: []
  factScore:
  previouslyUnknown:
  hasExternalOracle:
  actionValue:
  reviewMinutes:
  notes:

decisionBoundary:
  class: none | unresolved-product-direction | privileged-or-irreversible-operation
  status: not-required | pending | resolved
  question:
  resolution:
  evidence: []

remediationReview:
  status: not-required | proposal-required | implemented-pending-review | completed | rejected
  packet:
  authorityResolution: not-required | governed | decision-resolved | unresolved
  implementationVerification: not-required | pending | passed | failed
  integrationEligibility: not-required | pending | eligible | blocked | integrated
  reviewMinutes:
```

`schemaVersion: 2` findings are cross-checked against their run-ledger entry and, when present, the linked schema-v2 remediation packet. Historical findings without `schemaVersion: 2` remain readable through the legacy path.

Use stable, non-secret invocation identifiers for `observer` and `verifier`. Both `actorId` and `taskId` are required when the finding is recorded in the ledger. The Verifier must differ from the Observer on each identifier: a new task owned by the same actor, or a different actor reusing the Observer task, is not fresh independent verification. The checker cross-binds both identities to the run ledger.

`factScore` uses `0 = false`, `1 = partially true`, and `2 = true`. `actionValue` uses `0 = no action`, `1 = further research`, and `2 = fix`. Leave disposition score fields null while disposition is pending. Finding disposition is evidence-driven: independently rejected results are recorded, while confirmed governed drift with an external oracle and `actionValue: 2` proceeds directly to remediation. Use a decision boundary only when existing authority leaves product direction unresolved or the next action is privileged or difficult to reverse. Adequate independent review plus passed required validation completes implementation automatically; current authorization, exact-head evidence, trusted CI, live permission, DCO/provenance, idempotency, and repository rules then determine integration eligibility. The checker rejects any finding, packet, and ledger combination that claims completion or integration while these states disagree.
