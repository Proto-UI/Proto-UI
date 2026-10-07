# Poppy preview review checkpoint, 2026-10-01

Status: dated, non-normative repair and evidence record for PR #596. This records bounded author work; it is not independent acceptance or an exact-head private-handler attestation.

## Published repair batches

- `82510b24d3c3896052880fde956c68ac9230803e` repaired failed-build revocation across the central and configured fallback planes, accepted zero-byte regular ZIP assets within unchanged upper bounds, and read the candidate contract only as a bounded regular Git blob. The focused regression suite passed 44 tests and the locally runnable integration suite passed 92 tests on Node 22.23.3. [Repository CI 36870146527](https://github.com/Proto-UI/Proto-UI/actions/runs/36870146527) and [preview security CI 36870146491](https://github.com/Proto-UI/Proto-UI/actions/runs/36870146491) succeeded for that head.
- `cb8e209cf5ce8616bac62b4cb6f3d659ff0c07bb` extended revocation to both publication-failure paths and conditioned failed/unavailable cards on every required acknowledgement. Cleanup no longer treats a cancelled or skipped configured fallback revocation as closed. Actual workflow predicates are tested across success, failure, cancelled and skipped outcomes. The locally runnable integration suite passed 96 tests; pinned actionlint 1.7.7, formatting and installed/template lockstep passed. [Preview security CI 36875620898](https://github.com/Proto-UI/Proto-UI/actions/runs/36875620898) succeeded. The [full repository run 36875620830](https://github.com/Proto-UI/Proto-UI/actions/runs/36875620830) was still in progress at the 14:25 UTC observation, so the prior head's green result is not substituted for it.

## Verification limits

Local browser startup was blocked by executor socket restrictions. The trusted CI preview-security lane subsequently exercised the browser test on each code head above. The pinned private-handler fixture was skipped locally because no private handler checkout was provided; the two private-handler jobs also remained skipped on the observed PR-triggered runs. No external control plane, private handler, credential setting, account freeze or permission scope was changed by these repairs.

## Remaining trusted-attestation gate

The [current exact-head review finding](https://github.com/Proto-UI/Proto-UI/pull/596#discussion_r4156079519) remains open. Verifying the checked-out candidate SHA only proves which data the job inspected. GitHub's `pull_request_target` workflow and `GITHUB_SHA` use the default branch; they do not become a candidate-head check merely because a later checkout reads the PR head. See [GitHub's documented trigger behavior](https://github.blog/changelog/2025-11-07-actions-pull_request_target-and-environment-branch-protections-changes/).

A separately reviewed trusted bootstrap and an explicit, correctly revision-bound result mechanism are still needed before integration. This record does not authorize new `checks: write` or `statuses: write` permission, credential access, or execution of candidate code in a secret-bearing lane. Existing README/workflow statements that imply checkout verification alone attaches a check to the PR head must be reconciled as part of that design.

Actual Vercel deployment failure, independent reviewer acceptance and applicable review-thread disposition also remain separate gates. Contributor DCO remediation accompanies this record without rewriting prior commits or certifying another author's work.
