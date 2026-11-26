# Sprint 1: preserve the complete general regression across independent CI jobs

This is the bounded scheduling repair for #1178. The original combined job exhausted its 45-minute allowance after executing part of the general suite. The change gives governance and the complete general runtime independent jobs, each retaining the existing 45-minute cap. It preserves the old failures and cancellation; it does not establish a new full-CI pass or either of the two required valid mainline recovery cycles.

## Original failed execution, retained without reinterpretation

[Run 45238253018](https://github.com/Proto-UI/Proto-UI/actions/runs/45238253018) executed source `81c103bd462b73910f7279122fab5f282d172d56`. The complete original general job log is retained in the evidence archive, compressed losslessly as `old81-general.log.gz`. The decompressed file is **10,560,569 bytes / 90,077 lines**, SHA-256 `555e36a4002190c628e4c124e2c536c3fbe78efccae9d5532a9f1218da568be2`. This is the whole retrieved file, not the earlier partial or connector-truncated byte count. Its gzip carrier is 1,127,474 bytes, SHA-256 `0a1a37ab36342d7141943536d0f082442a3eb79e0a68fc07689e8a10e8d1c353`. The local reconstruction checked every overlapping byte, the complete compressed hash, and the decompressed size/hash.

| Observed boundary                        | UTC on 2026-11-23 |
| ---------------------------------------- | ----------------- |
| First governed check started             | 18:33:45.5848123  |
| Runtime controls started                 | 18:52:48.9800379  |
| Complete general runtime command started | 18:52:58.6316539  |
| GitHub reported cancellation             | 19:12:13.6391424  |

The original runner selected **1,890 general suites**. Before cancellation the log reported **1,167 distinct suite summaries**, including **25 failing suites / 54 failed assertions**. The 26 lines marked with the red-style suite prefix are not 26 assertion failures: one is `focus-readiness-evidence.test.ts` with nine explicitly skipped cases. Four summarized suites contain skips, totaling 13 skipped cases. The remaining **723 selected suites have no terminal suite summary** in this log. They cannot be certified as passed, and the absence of a summary does not establish that each had never started.

The raw selection, every reported failing suite, skip rows, command starts and final cancellation remain in the carrier. A compact summary is retained separately for independent recounting. Subsequent product and fixture repairs must be evaluated against their own sources and successful successors; this scheduling change does not erase any original red result.

## Exact partition of the original command inventory

`general-check-plan.mjs` is the pure command inventory used by the producer and the independent Tests gate. It derives the existing root `test` chain from `package.json`, retains the original three prefixed commands, and expands the existing `test:runtime` into its original controls and execution commands. It rejects an unrecognized command boundary instead of silently dropping it.

| Job | Exact original work | Additional preparation | Job cap |
| --- | --- | --- | --- |
| `test-governance` | The original 20 non-runtime commands, in original relative order | Existing runner, dependency, toolbar and real FFmpeg decoder preparation | 45 minutes |
| `test-general` | Original `test:runtime:controls`, then the complete `test:runtime:execute` | Its own `build:packages`, then the existing `apps-www generate:proto-ui-style` command | 45 minutes |

The 20 governance commands are spec authoring, public-document validation, package build, release-version check, release assets, style presets, variant order, component presets, prototype catalog, coverage matrices, the production website bundle, agent operations, four GPUI fixture checks, GPUI script tests, public-document tests, release tests and type-test controls. The exact arguments are in `command-inventory.json`; the spec authoring base is supplied by the real cycle-plan output when the job executes. The inventory snapshot uses an explicit placeholder solely to display the plan and is not an execution receipt.

`test-general` depends on the runtime plan, not on the governance job. A governance failure therefore cannot suppress the independent general evidence. Each fresh worktree builds its own public package outputs. The additional website style preparation is necessary because eight current homepage fixtures directly read the ignored `proto-ui-tokens.generated.css`; the previous combined chain created it as a side effect of the earlier website build. The new job uses the existing generator and does not borrow an unbound artifact from another job or run.

The complete general inventory remains unsharded. Existing `--minWorkers=1 --maxWorkers=2`, ordinary browser exclusions, explicit production-browser exclusions and every authored product deadline remain unchanged. A static snapshot at shared head `6ccb36ad473b72e75b3b86ee9ea5a5989b73ac5b` contains 1,903 general suites: all 1,890 original paths plus 13 added regression files. This is a source inventory, not an executed count or a replacement denominator for the historical run. The current plan is recomputed from its exact checkout on every real run.

The real decoder baseline remains in governance and continues to block the aggregate Tests gate. No FFmpeg version, decoder requirement, browser shard, Matrix 60,000 ms deadline, Search readiness bound, scheduling slot or allowed mainline trigger is relaxed.

## Failures, cancellation and source binding

Within each execution chain, a failed governed command retains its own exit status and log while later commands are still attempted. A failed package or style preparation therefore cannot make the complete job pass even if Vitest subsequently succeeds. If the runtime never produces its result file, the runner does not fabricate one. The plan and incremental progress record remain useful when the outer job is interrupted.

The governance job has its own `governance` logical slot, terminal receipt and always-attempted artifact upload. General retains its existing slot and actual Vitest report; the runner attaches the separately recorded preparation/control results. The existing required `test` job now needs cycle-plan, test-plan, governance, general and all ordinary browser shards. The cycle report also includes governance.

The Tests gate independently checks the exact manifest-derived steps, arguments, order, one execution per step, exit status, signal, clock fields and log names. It binds the governance spec base to `needs.cycle-plan.outputs.spec_base`, validates clean matching before/after source snapshots, and requires general preparation and Vitest to certify the same source. A successful job label or a green Vitest payload alone is insufficient.

All receipts remain bound to the same workflow run, event checkout and logical slot. For a partial rerun, the gate selects the latest attempt for each slot before considering its outcome. A later failed or cancelled governance attempt cannot fall back to an earlier green receipt. Missing receipts and hard cancellation also keep Tests red through the existing required-job result checks. The existing required-check job ID is retained.

This split removes the observed competition for one allowance; it does not guarantee that either complete new job will finish within 45 minutes. Any new cancellation or failed case remains a concrete follow-up, with its full selection and source retained.

## Verification and independent review

The two affected Node control suites plus the existing scheduling-policy, cycle-inventory and cycle-report suites passed **211/211**, zero failed, cancelled, skipped or todo. The controls include exact partition and command mutation, failed preparation followed by actual runtime attempt, omitted or reordered checks, wrong spec base/source, missing governance, green Vitest with failed preparation, partial reruns and cancellation without old-green fallback. These are scheduling and receipt controls; they are not 211 product/browser acceptance cases.

`check-ci-schedule.mjs` exited 0, preserving the single three-slot regression owner, no push triggers and guarded event contexts. Node syntax checks passed for the new pure planner and both changed runners. Exact commands and the unabridged TAP result are in the archive.

An independent agent read all six changed source/test files against their recorded SHA-256 values. It found no blocking issue in the partition, source binding, failure continuation, aggregate dependencies or latest-attempt logic. It did not rerun the 211 controls or approve a GitHub PR. After that review, only two YAML comments were clarified: the old runtime had actually executed for about 19 minutes before cancellation, and the real decoder check lives in the independent governance job. The exact reviewed YAML and final YAML are both retained; there is no command or condition change between them.

## Evidence and remaining acceptance

[Manifest](evidence/2026-11-24-sprint1-general-ci-partition/manifest.json) and [raw evidence](evidence/2026-11-24-sprint1-general-ci-partition/raw-evidence.zip) retain the complete original cancelled log, parsed original selection, failure/count readbacks, current exact command and suite inventories, local control output, commands, independent review and source snapshots. The carrier records a dirty shared checkout plus exact file hashes; it does not label local work as a clean published candidate.

The archive is **1,256,142 bytes**, SHA-256 `df39ce6141f83bcda70817c02646fbd3307e9cc1ca7ad5b47968059d630f1d4c`. All 29 entries passed CRC and every payload size/hash was read back and verified.

The next real run must execute both new jobs on the published source, retain every original failing or unfinished condition, pass the aggregate source-bound Tests gate, and then satisfy the original two valid mainline recovery cycles. This record completes the bounded scheduling implementation and preserves the historical disposition. Full #1178 and Sprint 1 acceptance remain dependent on those actual results.
