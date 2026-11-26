# Sprint 7 completed validation and subsequent integration boundary

Recorded 2026-11-24. This supplements the [execution delivery][delivery], [experiment recovery][recovery], and [earlier integration][integration] records. It records completed engineering checks for the recovered study carrier without changing the original research observations or exclusions.

The five original full gates completed successfully on `0a0e8f1768c86768804741d2b607231b150fbad3` (`0a`). A subsequent merge with fixed main `6dd674545c8d388c6f5cc54ec868c88ec0d60cce` produced `422a02294325556d986fcc002ac60187f535af21` (`422`), where the original prototype checker also passed. Integration with fixed main `b939afe35d30a1a436766d80beea7093a46e4fb2` after Sprint 2 PR #1782 has now completed its recorded followup: agent operations and three fast gates passed on `42a01a0a68e668db75bfe6cdcf495bc9b446ca84` (`42a`), and the complete coverage gate passed on `b0fbb3d8d294da6b5568b0f88451cc0df1e75788` (`b0`) after the Finf fixture correction. These are distinct source bindings; earlier runs are not relabelled as executions on the later head.

At the earlier recorded public readback, [PR #1774][pr] remained Draft at 0a. The later local execution receipts below do not themselves establish a public branch update, independent platform approval, merge, post-merge whole-main CI, or physical acceptance.

## Completed original gates on 0a

The [complete original terminal][actual] binds each command to 0a before and after execution, with empty tracked status before and after, `timedOut: false`, and a real process exit code. All five used a 1,536 MiB Node heap and four allowed CPUs. The two large gates had 3,600-second outer supervisor windows. These resource limits did not replace repository test selection, assertions, or individual test deadlines.

| Original command | Actual terminal result | Whole-command elapsed time |
| --- | --- | --- |
| `node scripts/coverage-matrices/prototype-coverage.mjs` | Exit 0 | 18,168 ms |
| `corepack pnpm@10.32.1 check:coverage-matrices` | 4,871 collected; 4,870 passed; 0 failed; 1 intentional portable Linux placeholder skipped; 0 cancelled; exit 0 | 1,774,899 ms |
| `corepack pnpm@10.32.1 check:agent-operations` | 1,549 passed; 0 failed, skipped, or cancelled; exit 0 | 1,205,538 ms |
| `corepack pnpm@10.32.1 check:public-docs` | Exit 0 | 7,025 ms |
| `corepack pnpm@10.32.1 check:agent-doc` | Exit 0 | 9,490 ms |

The coverage and agent-operations log summaries are separately retained. Their internal test-runner durations differ from the whole-command durations above; the latter come from the supervisor terminal receipts. The single portable placeholder remains a skip and is not counted as a passed Linux integration test.

The original terminal is now preserved directly at `current-main-integration/final-validation-b17/terminal.json`, together with the five individual command receipts. Its 3,069 bytes reproduce SHA-256 `6779f5d153393dead1bc0342d539299b2f0a9aa8115dd20bcb94170e24a80264`. The restored original 422 merge and preflight receipts are linked below. All 15 JSON texts in the restored legacy-receipt packet, including the later frozen-payload audit, were independently checked against their recorded byte lengths and hashes. This metadata check does not claim an independent execution or reread of the complete large logs.

## Narrow repair and candidate proof

The compiler/browser source-binding repair keeps both required diagnostics. It emits the foreign-owner diagnostic before the strict source guard and removes the diagnostic branch's early `continue`, so the strict guard still checks the source. The positive fixture now copies the actual reviewed browser client and requires `assert.equal(message, '')`. The existing selected 21 controls first produced 20 passes and one failure, then 21 passes with zero skips after the repair. This is a correction to diagnostic order and the truthful positive fixture; it does not authorize foreign owners or relax exact source matching. The repair source is `052e477345a1201a97834d0e8c8863047ace3249`, followed by normal integration `7fc9d23980def3fa975ea21b7e2656ed238d5f61` (`7fc`). [The recorded repair readback][repair] retains both outcomes and the source hashes.

The existing producer refreshed the candidate proof on clean 7fc:

```sh
node scripts/coverage-matrices/prototype-coverage.mjs --refresh-candidate 7fc9d23980def3fa975ea21b7e2656ed238d5f61 --write
```

The structured delta changes four subkeys of `candidateSource`. Among 6,002 bound inputs, only the Website ledger SHA changes. The original baseline, comparison and consumer rows, 141 consumer identities, counts, migration state, and research statistics remain unchanged. Normal formatting changes serialization only; reconstructing the producer serialization from the committed parsed data reproduces its retained original hash. The succeeding checker result on 0a and the later result on 422 are actual checker outcomes, rather than a statement that a newly generated file must be correct. [PR #1774][pr] and the [repair readback][repair] preserve the bounded refresh history.

## Separate calibration and retained failures

The original browser-enabled benchmark completed 111/111 with zero skips on its archived 9b5 source and separately on `f3cfa6801e3c2b86df3b62c47296f08f7b206ee2` (`f3`). The original parameters, cases, assertions, sandbox setting, and individual timeouts remain unchanged. These runs calibrate the benchmark harness; they are not new participant studies. The earlier default benchmark result remains 87 passed plus 24 browser skips out of 111 collected. [PR #1774][pr] retains the f3 browser-enabled exit-0 result and its 107,151 ms elapsed time.

The original Linux decoder integration command also ran separately on 7fc:

```sh
node --test scripts/coverage-matrices/test/decode-video-evidence.integration.mjs
```

It passed 15/15, zero skips, in 3,171 ms with FFmpeg 7.1.5 and Python 3.13.5. It is actual Linux execution, with the original integration controls. It does not establish the prescribed Ubuntu 24.04 / FFmpeg 6.1.x CI environment or native component, screen-reader, or hardware acceptance. [The execution readback][repair] retains this environment distinction.

The older f3 coverage run remains a genuine failure: 4,797 collected, 4,790 passed, six failed, and one skipped, exit 1. Five failures concerned the stale candidate proof; the sixth concerned the owner diagnostic. The complete f3 agent-operations result remains 1,549/1,549, zero skips, exit 0. The first 900-second outer-supervisor interruptions remain incomplete attempts, even though later complete runs succeeded. Earlier recovery failures also remain intact: 102/106 focused controls, 1,051/1,054 agent operations with three process-level failures, a limited retry whose terminal was unavailable, two public-docs exit-137 results, and failed commit-hook attempts. No missing terminal is reconstructed as success, and no signal-only outcome is attributed to OOM without evidence. See the [recovery record][recovery], [integration history][integration], and [PR chronology][pr].

## Preserved research and publication scope

The original study source remains `4e5e50e159573a627d5e75037b23513ad8f5f164`. Its initial source-preserving merge retained all 116 original modes and blobs. Later literal unions of `.prettierignore` make that configuration file the explicit exception. The execution owner's [final frozen-payload receipt][frozen] now lists all 115 original study payload files and all 49 recovery files, with their exact modes and blobs, checked against b0. The 36,466-byte receipt has SHA-256 `0fa74de4dd997fdf881373be86edf768a8f26f8d36b15b99c2ef156513dfb118`; independent metadata review confirms all 164 distinct paths and the original receipt bytes. The owner performed the Git equality check; this reviewer did not independently reread the final Git objects. Those files retain their original tested source, even when later Compiler or Runtime code enters the carrier. [The original preservation history][recovery] remains available.

| Study | Retained observation | Interpretation boundary |
| --- | --- | --- |
| #734, Tabs knowledge comparison | Three initial implementations in each of three paths, plus one planned maintenance observation per path; nine initial and three maintenance observations each passed 22/22. | A bounded comparison with no observed correctness advantage; no statistical superiority claim. |
| #749, Button projection comparison | Three actual deterministic Compiler outputs and three independent generative implementations; the same ten checkpoints and five real gestures; three valid and ten invalid oracle controls. | Source-mismatched or exposed attempts remain excluded and retained. No whole-library or native-mixing parity claim. |
| #750, generated Button consumption | Both consumers completed 9/9 behavioral observations. Consumer-02 alone retained the complete original timing protocol. | Consumer-01's missing timing tail remains a recorder limitation. Consumer-02 read generated source and made five edits, including one generated-source edit; no zero-reading or zero-edit claim. |
| #751, zero-marginal-cost scenario | The predeclared scenario reuses the #734 Tabs observations; all initial attempts reached the stopping condition, with no repair rounds. | No second independent study, invented repair cycles, or assertion of actual zero billing. |

The [recovery record][recovery] and linked original reports retain the complete studies, failures, exclusions, artifacts, and limited conclusions. Existing #1151 DCBot production readback remains an earlier bounded result; this validation work adds no new deployment or report collection.

The execution owner reports a new validation archive of 73 plain raw files and two browser TARs, one for f3 and one for 9b5. Each TAR contains 957 files: 279 PNGs, 633 JSON files, 24 ZIPs, and 21 HTML files. This includes controlled negative fixtures. The reported credential-pattern audit has `flags: []`; that result is not an assertion that every image was visually reviewed or that pattern matching proves absence of all sensitive content. These engineering artifacts do not add participants, new studies, or OS assistive-technology results. Their original manifests and payloads remain the publication authority.

## Historical 422 integration

The normal merge's ordered parents are fixed main `6dd674545c8d388c6f5cc54ec868c88ec0d60cce` and 0a. The resulting 422 tree is `a966337900491b5df124f7b5e28f46df530feadf`. The single `.prettierignore` conflict uses the complete literal union of both sides. The normal hook exited 0 in 5,363 ms with no changed paths between the reviewed index and committed tree; the worktree was clean. The [actual merge receipt][merge422] binds that exact tree and both parents.

On 422, the unchanged original prototype checker [exited 0 in 3,653 ms][preflight422], with the same HEAD and clean status before and after. There is no observed candidate-proof drift on this integration, and no further refresh was required: the 7fc candidate checkpoint passed the original checker. This is the only completed 422 validation recorded here. The full 0a gate results above are not reclassified as 422 executions. The recorded 0a-to-422 delta includes real Header, Tooltip, font preparation, workflow, CLI-test, and Website-provenance changes, so whole-source equivalence is not asserted.

## Completed integration with fixed main b939

The normal merge at `39b21268f66bd4d16d95aecd1de14c475fc9a29c` (`39b`) has ordered parents b939 and 422, with tree `4d431346c7477f08ed9e288ee80b5af8c39b6779`. Its normal hook exited 0 in 4,017 ms, the reviewed index and committed tree match, and tracked status was clean. The bounded resolution retains b939's changes outside the original incoming scope, including its CLI, Compiler, adapter and prototype changes; it does not reinstate the older 422 versions merely because they were previously tested. The [source-preservation receipt][b939-scope] and [merge terminal][b939-merge] bind that integration separately from subsequent repairs.

The initial source checker on 39b exceeded a 300-second outer supervisor and exited -15; that attempt remains incomplete. A later complete run on the same clean head exited 1 in 319,480 ms. Exact source-admission updates and the Website ledger repair were then committed as `97a423fef99e11cc8c3a42d578529667ca9c137c` and `ba81d77e73814b32c2c14afc74ef3a809faffc1a` (`ba81`), using normal hooks with no index-to-HEAD changes. The original full source checker passed on ba81 in 323,108 ms; the bounded original admission-control selection also exited 0. These are actual checks after source changes, not credit for changing an expected outcome. [The repair terminal][b939-source] retains both commands and their source bindings.

On clean ba81 the original producer ran successfully in 51,067 ms:

```sh
node scripts/coverage-matrices/prototype-coverage.mjs --refresh-candidate ba81d77e73814b32c2c14afc74ef3a809faffc1a --refresh-consumer-issues harness.transcript.follow-tail --write
```

The [semantic audit][b939-semantic] reports no historical-field changes. The only consumer-row semantic change restores the canonical `harness.transcript.follow-tail` issue list to `[746, 1323]`. Candidate updates remain limited to revision and source-proof fields; the expanded b939 inventory stays at 6,016 source bindings, 57 projection rows and 117 atomic-projection entries. The sole bound-file SHA change is the repaired Website ledger. The historical 71 comparison rows, 22 Base projection rows, 141 consumers and 101 migrated links remain distinct from the candidate inventory. The generated refresh was normally committed as 42a, tree `d008011559d36fd8d0cd6ae045c8b2dc4a79cecf`; its hook exited 0 in 1,324 ms and did not change matrix semantics.

| Actual source | Original command | Terminal result | Whole-command elapsed time |
| --- | --- | --- | --- |
| 42a | `node scripts/coverage-matrices/prototype-coverage.mjs` | Exit 0 | 2,743 ms |
| 42a | `corepack pnpm@10.32.1 check:public-docs` | Exit 0 | 4,137 ms |
| 42a | `corepack pnpm@10.32.1 check:agent-doc` | Exit 0 | 5,717 ms |
| 42a | `corepack pnpm@10.32.1 check:agent-operations` | 1,549/1,549 passed; zero failed, skipped or cancelled; exit 0 | 874,825 ms |
| 42a | `corepack pnpm@10.32.1 check:coverage-matrices` | 4,872 collected; 4,870 passed; one failed; one skipped; exit 1 | 1,529,526 ms |
| b0 | `corepack pnpm@10.32.1 check:coverage-matrices` | 4,872 collected; 4,871 passed; zero failed; one skipped; zero cancelled; exit 0 | 1,612,985 ms |

The complete 42a coverage failure was the Finf continuous optical closure's exact positive fixture: its material-source fixture no longer satisfied the exact source admission. That failure is retained. The fixture followup was normally committed as b0, tree `c6eca232384edc7a9e7bb2915a9047ecbb6d7f38`; its hook exited 0 in 2,577 ms, with the same reviewed index and committed tree. The original four-control Finf selection then exited 0 in 4,379 ms, followed by the complete original coverage command in the final table row. The 42a agent-operations result is not relabelled as a b0 rerun. [The 42a gate receipts][b939-fast], [agent-operations terminal][b939-agentops], and [b0 full-gate terminal][b0-coverage] preserve these separate bindings.

Every completed gate listed above retained the same clean HEAD before and after and reported no outer timeout. The retained full-log summaries distinguish the internal test-runner durations from the supervisor durations: 865,346.404078 ms for 42a agent operations, 1,149,727.606933 ms for the unsuccessful 42a coverage run, and 1,183,036.089963 ms for b0 coverage. The single intentional skip remains a skip.

The new transfer supplies 45 complete original JSON texts, six explicit log excerpts, and a complete 91-file raw manifest totalling 1,745,749 bytes. Independent metadata review reproduced all 45 text lengths and hashes and matched them to the manifest. Three short log excerpts are complete byte-identical files; the three large logs are tails with separately recorded whole-file byte lengths and hashes, not substitutes for the complete logs retained by the execution owner. The producer semantic audit is read and hash-bound here; its complete matrix comparison is the owner's recorded analysis, not a newly executed reconstruction by this reviewer.

These results complete the stated engineering checks on their exact sources. Independent formal review, applicable whole-main CI, post-merge acceptance, and outstanding physical or broader Harness/Inspector/Tree criteria remain separate work. They do not add studies, participants, statistical conclusions or completion of all seven Sprints.

[pr]: https://github.com/Proto-UI/Proto-UI/pull/1774
[delivery]: https://github.com/Proto-UI/Proto-UI/blob/0a0e8f1768c86768804741d2b607231b150fbad3/internal/records/2026-11-24-sprint7-execution-delivery.md
[recovery]: https://github.com/Proto-UI/Proto-UI/blob/0a0e8f1768c86768804741d2b607231b150fbad3/internal/records/2026-11-24-sprint7-experiment-recovery.md
[integration]: https://github.com/Proto-UI/Proto-UI/blob/0a0e8f1768c86768804741d2b607231b150fbad3/internal/records/2026-11-24-sprint7-current-main-integration.md
[actual]: evidence/2026-11-24-sprint7-current-validation/current-main-integration/final-validation-b17/terminal.json
[merge422]: evidence/2026-11-24-sprint7-current-validation/current-main-delivery/merge-terminal.json
[preflight422]: evidence/2026-11-24-sprint7-current-validation/current-main-delivery/preflight/terminal.json
[frozen]: evidence/2026-11-24-sprint7-current-validation/frozen-payload-preservation.json
[repair]: https://github.com/Proto-UI/Proto-UI/pull/1774
[b939-merge]: evidence/2026-11-24-sprint7-current-validation/main-b939-integration/merge-terminal.json
[b939-scope]: evidence/2026-11-24-sprint7-current-validation/main-b939-integration/resolved-scope.actual.json
[b939-source]: evidence/2026-11-24-sprint7-current-validation/main-b939-integration/exact-source-repair/validation/terminal.json
[b939-semantic]: evidence/2026-11-24-sprint7-current-validation/main-b939-integration/candidate-refresh/semantic-audit.json
[b939-fast]: evidence/2026-11-24-sprint7-current-validation/main-b939-integration/candidate-refresh/fast-gates/terminal.json
[b939-agentops]: evidence/2026-11-24-sprint7-current-validation/main-b939-integration/candidate-refresh/agent-operations/terminal.json
[b0-coverage]: evidence/2026-11-24-sprint7-current-validation/main-b939-integration/finf-fixture-repair/gates/terminal.json
