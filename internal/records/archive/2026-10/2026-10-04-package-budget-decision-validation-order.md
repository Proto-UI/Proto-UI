# Package-budget decision ownership and validation order

## Reviewed gaps

Two follow-up findings against `3e147df2b16de7e0bbe8f2f7110ab8952a7183fb` exposed separate defects in the new numeric route:

- [r4179038005](https://github.com/Proto-UI/Proto-UI/pull/825#discussion_r4179038005): requiring a proposed ceiling and its margin in the input report made the validation leaf pre-decide the mutation owner's result.
- [r4179038011](https://github.com/Proto-UI/Proto-UI/pull/825#discussion_r4179038011): the retained pre-mutation `evidence-report`, plus `review-input`, satisfied the generic review artifact requirements even when the numeric leaf skipped its required validation pass.

## Correction

The input is factual: current ceilings, measured baseline/capability costs, actual failures, attribution, exact revisions and canonical environment provenance. The numeric leaf selects the proposed value and headroom rationale and records them in its existing `candidate-change` transaction. This does not add another human gate or require the validator to choose the value.

The registry now supports an optional `allowedNextSkillIds` constraint. Only `pui-package-budget` declares it, with `pui-validate` as its one next leaf. Registry validation rejects empty, duplicate, recursive, unregistered or entrypoint-incompatible declarations. Handoff validation rejects any other nonterminal next leaf before artifact completeness can disguise a skipped transition. A blocked no-edit terminal remains valid. Other leaves retain their existing routing.

No new evidence artifact type is introduced. `pui-validate` remains the producer of measurement reports and the refreshed final-candidate report; `pui-review` keeps its normal independent acceptance role. The route constraint does not claim to authenticate arbitrary caller-provided `fromId` values or certify the contents of opaque evidence references.

## Evidence

Six focused regression tests were run before the correction: five failed, including an actual resolver CLI accepting the prohibited stale-report shortcut; the existing blocked-terminal/final-validation control passed. The corrected suite covers prerequisite/decision ownership, rejected direct review and integration even with their artifacts supplied, CLI enforcement, malformed registry constraints, unaffected unrelated routes and the legitimate validation/review sequence. Candidate results and fresh CI are recorded in the SHA-bound PR report.

Numeric values, measurement implementation, external-write permissions, DCO history, independent-review requirements and unrelated attended gates are unchanged. The previously resolved standalone-route finding is not reopened or rewritten by this correction.
