# Homepage regression workers and retained failure evidence

## Observed resource boundary

Native run [44945602403](https://github.com/Proto-UI/Proto-UI/actions/runs/44945602403), attempt 1, tested `e775cd5448b3ab13ebe08b051121fda3508de5e9`. Its [Homepage capture job](https://github.com/Proto-UI/Proto-UI/actions/runs/44945602403/job/136983015632) selected five existing browser files in one serial Vitest invocation under a shared 600-second command deadline. The command began at 21:10:57 UTC and explicitly exited 124 at 21:20:57 UTC.

Only `homepage-dogfood.browser.test.ts` (317.527 seconds, nine passed and one failed) and `home-demo-runtime.browser.test.ts` (247.865 seconds, eleven passed) produced terminal file receipts. The log then shows Vite beginning to load `demo-brutalist-remaining.browser.test.ts`; it has no completed case or file receipt before the interruption. Execution of `prototype-projection-scope.browser.test.ts` and `demo-brutalist-checkbox.browser.test.ts` was not observed in this command. These three missing terminal receipts are not three product failures or passing tests.

The previous native jobs [136937473963](https://github.com/Proto-UI/Proto-UI/actions/runs/44930338506/job/136937473963) and [136954175579](https://github.com/Proto-UI/Proto-UI/actions/runs/44937449914/job/136954175579) also explicitly exited 124 at 600 seconds. Each completed four files and interrupted the final Checkbox file. Their failed outcomes remain historical evidence.

The same five files completed in the e775 shared-browser shards:

| File                         | Reported file duration | Actual result      |
| ---------------------------- | ---------------------: | ------------------ |
| `homepage-dogfood`           |        192.829 seconds | 9 passed, 1 failed |
| `home-demo-runtime`          |        122.753 seconds | 11 passed          |
| `prototype-projection-scope` |         45.759 seconds | 5 passed           |
| `demo-brutalist-checkbox`    |          8.642 seconds | 1 passed           |
| `demo-brutalist-remaining`   |         23.878 seconds | 2 passed, 4 failed |

The 393.861-second sum uses generated styles and one prewarmed external server supplied by `run-runtime-tests.mjs`. The Homepage direct invocation instead makes each file generate styles and own its server lifetime. Shared-file timing is a scheduling observation, not a cold-worker timing guarantee or evidence that the five failed assertions are resource failures.

## Bounded scheduling correction

Move exactly those five files into the existing `isolated-controls` matrix and remove their former bundled step from `capture`. The original ten matrix rows plus the moved five form exactly fifteen unique scopes. This extends the independent-worker architecture introduced by `eb735696868fea3c9ad5a2c5789c403f4fad1f48`; it does not create another browser registry owner.

Each worker retains the existing 600-second command, 12-minute step, 15-minute job, `fail-fast: false`, exact candidate checkout, locked dependencies, verified font package, and supported toolbar preference. The change allocates independent bounded workers to the five files instead of requiring all five to share one deadline. Individual browser assertions, test and hook deadlines, and the five browser source files are unchanged.

Only the five moved matrix rows set `runtimeEvidence: true`. Their existing `PROTO_UI_RUNTIME_EVIDENCE_DIR` remains `$RUNNER_TEMP/homepage-evidence/runtime`, beneath the always-uploaded artifact directory. The original ten rows retain their previous environment behavior. The immutable-baseline probe, candidate probe, production Search, other capture steps, and other isolated-worker steps are unchanged.

## Focused controls and provenance

The existing Homepage scheduling contract now checks the exact fifteen-row union and rejects every missing row, a duplicate row, and an unexpected row. It runs the actual workflow selection shell with only the expensive timeout child replaced: all fifteen exact argv selections and the optional RuntimeBox contract are checked, as are the moved evidence paths and original unset paths. Synthetic child exit codes 1 and 124 must remain failures through the original `pipefail`/`tee` pipeline. The existing Label selection contract keeps its native drag and selection assertions and follows its one actual isolated owner and always-uploaded evidence directory.

The following command completed on 2026-11-21 at 21:32:06 UTC with **31 passed, zero failed, zero skipped, exit 0**:

```sh
node --import tsx --test apps/www/scripts/homepage-evidence-contract.test.ts apps/www/scripts/label-selection-observer.test.ts
```

This is focused working-tree evidence during the root-owned integration of newer main, not a clean final-head native result. Prettier and the scoped `git diff --check` also passed.

| Evidence | SHA-256 |
| --- | --- |
| Native e775 complete Homepage job log, 1,037,391 bytes | `4beb8fc0f73b7d027ad8b7c68aaca18aa220489e54bba209d25f0559c0d7c771` |
| Native e775 Homepage artifact 14725334872, 44,461,783 bytes | `05556b4cb95371d99e9f451deb81de8c0891d7dbc6586fe9359598215e84d242` |
| Native 031 complete Homepage job log | `1705babb2dabbc2d1ba28050d7d187a76ed7a159f6f2e37dea023b6131c61e13` |
| Native 4c2 complete Homepage job log | `7cf08633e89b3d2c8d3d7044f44a345b08b9e4f399ee6bd32519904c7bc60a69` |
| Focused 31-control log, 3,337 bytes | `17b6dbecc71408f4328795c9df55e7b76ab3804d5064ddf8406ce58c6b9684a4` |
| Workflow after scheduling correction | `807a257380402f07250a5752c0990ec6ef1dabd04365d64ae393e069fd426171` |
| Homepage evidence contract test after correction | `52828d48a3e87339fbfa64cd51b6ca9b4da72c8d803a2dba40b3d9de2d31d910` |
| Label selection observer test after correction | `fd91ff939dc2dabcd08449704bdcd10348fd77c2bb67a34dfa70e304621379b5` |

Complete raw logs, focused excerpts, per-file result identities, source hashes, the unapplied-review patch receipt and focused command receipt are retained under the task's `homepage-resource-investigation` evidence directory. This correction does not waive the five actual e775 shared-browser failures or the separate production Search assertion. The next exact integrated native cycle must establish whether all five independent workers complete and retain their actual passed or failed assertions.
