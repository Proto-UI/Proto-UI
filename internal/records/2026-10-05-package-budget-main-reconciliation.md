# Package-budget route reconciliation with main

## Exact integration boundary

The direct Git `main` ref was `dc8bf26cd903223f2dd4c8fc5fd37b8eb5227125` (merged #821), while PR #825 remained at `fc94bed1cbff7f36e6b1fe8ecda5fe2350973672`. The PR API still reported the earlier base `d05d1a00a353b9e72326a05569233d5bb54456a9`; that cached value was not used to infer current mergeability.

`git merge-tree --write-tree` against the direct refs reported one conflicted file, `scripts/agent-operations/skill-registry.mjs`. The other overlapping skill and entrypoint files merged automatically. This reconciliation preserves both parent histories rather than rebasing or replacing the earlier signed-off commits.

## Resolution

The conflict was between #825's optional `allowedNextSkillIds` registry checks and #821's optional `interruptions` checks. Both are retained: budget mutations still route through validation, and review interruptions still admit only their registered read-only diagnostic or terminal paths. The v2 binding, repeated-material, resume, and durable-owner logic from main is retained.

Budget guidance now distinguishes the v1 singleton report from v2's revision/result-bound historical materials. A final-candidate report remains required; retaining older failed or partial measurements does not turn them into fresh passing evidence. Numeric choice still belongs to the budget leaf, not the human or the prerequisite validator.

## Verification scope

Additional controls exercise the actual v2 resolver, preservation of multiple candidate/evidence materials, rejection of a stale-report direct-review shortcut, honest terminal stops, and the independent read-only review-interruption path. The schema generator is run before its check; generated files are never hand-edited. Exact merged-candidate checks and remote CI outcomes are reported separately in the commit report.

No package-budget number, measurement implementation, unrelated gate, credential, persistent grant or protection setting changes. Existing resolved review threads stay resolved. Fresh independent review and current-head CI remain integration conditions.
