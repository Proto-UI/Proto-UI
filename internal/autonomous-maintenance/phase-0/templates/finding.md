# Phase 0 finding template

```yaml
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
observerConfidence:

verifier:
  classification: pending
  evidence: []
  confidence:

humanDisposition:
  status: pending
  factScore: 0
  previouslyUnknown:
  hasExternalOracle:
  actionValue: 0
  reviewMinutes:
  notes:

remediationReview:
  status: not-required | proposal-required | implemented-pending-review | completed | rejected
  packet:
  semanticDecision:
  implementationVerification:
  integrationDecision:
  reviewMinutes:
```

`factScore` uses `0 = false`, `1 = partially true`, and `2 = true`. `actionValue` uses `0 = no action`, `1 = further research`, and `2 = fix`. Finding disposition does not grant semantic approval. After semantic approval, adequate independent review plus passed required validation completes implementation automatically; commit, merge, and release remain a separate human integration decision.
