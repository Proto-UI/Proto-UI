# Sprint 5 followup: local combined-source checks before publication

The followup starts at `1afa22e88c087db244f0e28a835b2926fb8bce8e` on the separate `work/sprint5-native-owner-f7b2` branch. The prior browser candidate remains intact. This record reports actual local working-source executions; it is not a substitute for final-head hosted validation or independent acceptance.

## Executed checks

| Check | Actual result and source boundary |
| --- | --- |
| Explicit workflow source selection | 49 files, **816/816**, zero failed/pending/todo; 2026-11-23 23:03:33–23:05:57 UTC |
| Source stability during that selection | All **841** recorded inputs had identical before/after SHA-256 values |
| Scheduling, cycle and native-evidence controls | **99/99**, zero skipped; 23:14:33–23:14:36 UTC, including 39 Qt evidence-checker controls |
| Final Qt request/axis/pause selection | Three files, **30/30**; 23:17:34–23:17:41 UTC |
| Official spec authoring | Seven changed catalog inputs, exit zero, against actual main `0fbb52ef832cc27c78e24c28c59a55a16f51d7fe` |
| Public documentation check | Exit zero; 305 bilingual primary routes, four inventories and 445 maintained documents |

After the 816-case execution, only the two recorded Qt request implementation/test inputs changed before this archival checkpoint. The original implementation hash was `96b624725ce01de4d8cb5dece1adda7ef9b6d94b037dfe4643cd171c2b104dbd`; the final reviewed request source is `19622fe938caa54cbbb1593ffeb906faa4e94e9770eadb1de1bbb7268e6f9670`. The later focused 30-case execution covers that change. The original 816 result is not relabelled as a run of a later tree.

The archives retain exact commands, timestamps, original logs, complete test JSON and before/after source maps under `internal/records/evidence/2026-11-24-sprint5-followup-local-validation/`. `source-continuation.json` records the two changed inputs explicitly. The complete local archive is 195,374 bytes, SHA-256 `731b4770c749b51ff01134870efad7610e917fdc8973ca22acdfa19418a076e0`.

The full workspace type check is not claimed here. The source-bound bounded strict checks and the older successful formal workspace/docs run remain in their own records. Final combined native execution, browser execution, workspace types and production generation remain registered hosted gates rather than inferred passes.

## Alias integration and one interrupted WASM worker

The next explicit source selection retained every original path and added `public-value-types.test.ts`: 50 files and 855 declared tests. It ran from 23:38:14 to 23:40:35 UTC with one worker. All 50 files were collected, and all 9,777 recorded repository inputs were unchanged. The process nevertheless exited **1**: 854 tests passed, the final WASM interruption case remained pending, and Vitest reported `Worker exited unexpectedly`. Its JSON `success: true` does not override that failed process, unhandled error or incomplete case. This is not a 855/855 pass.

Other local heavyweight suites were paused, and the complete unchanged five-case `browser-wasm.test.ts` file was then executed serially from 23:45:31 to 23:46:36 UTC. All **5/5** passed, none remained pending, and the process exited zero. The original WASM source, engine, protocol, build script, assertions and timeouts were unchanged. The failed group and the serial successor remain separate results. No kernel OOM receipt was available; concurrent resource pressure is a hypothesis, not an established cause.

The Qt receipt's trusted source closure gained the actual new `public-value-types.ts` import, changing its exact source inventory from 82 to 83 inputs; its 12 native case names and 27 generated artifacts are unchanged. The complete scheduling/cycle/evidence control selection again passed **99/99**, including all 39 Qt checks. The independent workflow review and this precise alias delta are retained with their exact workflow hashes.

The original 50-file logs and JSON, full input maps, serial WASM result, commands, resource observations, independent workflow review and formatting equivalence receipts are additive in `alias-and-serial-wasm.tar.gz` under the evidence directory. Official Prettier changed only syntax layout in the two maintained scripts and `source-values.ts`; TypeScript AST structure and every literal payload were compared before and after. Original frozen evidence bytes are preserved. Final hosted execution still owns the complete exact-head source/type/native/browser gate.
