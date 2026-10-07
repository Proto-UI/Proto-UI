# Validation report refresh after a numeric mutation

Human-directed repair for PR #825 finding `4192020391`, based on exact parent `d012d8630279fd8df228bc7b6cfb10c0d8936e9c`. No numeric ceilings, product sources, authority grants, runtime permissions, schema formats or branch rules change.

## Reproduction and repair

The existing resolver accepted both v1 and v2 handoffs with only the source changed to `pui-validate` and destination to `pui-review`, retaining every pre-mutation report. The new direct-validator and real-resolver negative tests failed against the unmodified parent (stale CLI returned 0). The existing producer check verified only that an `evidence-report` type was present.

Validation-origin review now requires its actual received handoff. Comparison preserves format/mode, v2 repository/scope/head, and digest-bound current candidate materials. A report needs a digest absent from received reports; renaming old bytes is insufficient. V2 additionally requires explicit current revision and result. It retains historical reports; v1 replaces its singleton. A fresh failed/partial/not-run report remains valid evidence for independent review, not a green claim or integration approval.

The resolver already accepts `--prior-handoff`; the review CLI now consumes it for validate/inspect/eligibility/submit-review too. Resume passes real adjacent continuation steps and revalidates the assembled result against validation's received step. Missing predecessor/digests fail closed. Existing review-intake fixtures that do not test validation provenance now start at the entrypoint, rather than inventing a validation step. Dedicated v1/v2 CLI tests exercise the new validation predecessor boundary.

## Validation

Node 24.19.0, Linux, repository's existing locked dependency versions. Six new tests cover direct calls, actual resolver and review CLI, old/renamed/digestless reports, changed candidates, stale revisions, missing results, preserved historical evidence and explicit negative results. The four initial validator and resolver tests reproduced the old defect; the final six pass.

All 739 AgentOps tests pass. `check-agent-operations` and `check-contributor-skills` pass. The disposable Agent snapshot was generated from 665 entities and its check passes. Focused formatting and whitespace validation pass. Local setup initially lacked the canonical origin metadata and the spec schema's zod link; these local-only prerequisites were restored before successful checks. Hosted final-head CI and independent review are separate and pending publication. No UI change or invented screenshot.

## Trust boundary

This enforces consistency and refresh against a supplied predecessor. It does not authenticate that predecessor, open or hash opaque referenced contents, or prove that tests actually ran. A caller controlling both handoffs can forge both; a changed digest is not evidence of truthful execution. V1 has no revision metadata and only gains unchanged-candidate/different-report comparison; v2 adds declared revision/result binding. Review still inspects real artifacts and exact-head canonical checks under existing independent review rules. No new user authority, approval or merge admission comes from this comparison.

## Publication sign-off follow-up

The connector published source commit `0ce6663e23ac26e40b7fd5d53b6a8c7c64f8af90` under cyjin-yl's existing public `cyjin.yl <chenyejin2004@foxmail.com>` author identity. Its initial trailer mistakenly used the same account's older Gmail identity from parent d012d863, so DCO correctly requested remediation. The following author-remediation commit adds the matching certification for that self-authored contribution without rewriting any history. Only this publication record changes; all implementation and test files retain the independently reviewed bytes. Hosted checks must be evaluated on the resulting final head.
